// Career World engine: render loop, camera, player, collision, door detection.
const World = (() => {
  const SPEED = 220;              // world units / second
  const PLAYER = { w: 64, h: 96, feetW: 28, feetH: 14 };
  const FRAME = { w: 128, h: 192, order: { down: 0, left: 1, right: 2, up: 3 } };
  const DAY_MS = 8 * 60 * 1000;   // full day+night cycle; world clock, not FIFA's

  let _canvas, _ctx, _assets, _ground;
  let _px = 800, _py = 500;       // player world position (feet center)
  let _face = 'down';
  let _last = 0;
  let _inOverlay = false;
  let _doorZone = null;

  const _solids = () => [
    ...WorldMap.buildings.map(b => b.solid),
    ...WorldMap.props.filter(p => p.solid).map(p => p.solid),
  ];
  const _doors = () => [
    ...WorldMap.buildings.map(b => ({ ...b.door, id: b.id, label: b.label })),
    ...WorldMap.props.filter(p => p.door).map(p => ({ ...p.door, id: p.id, label: p.label })),
  ];

  function _restore() {
    const s = Storage.get(Storage.KEYS.WORLD);
    if (s && typeof s.x === 'number') { _px = s.x; _py = s.y; _face = s.face || 'down'; }
    // saved position may sit inside a solid added later — would lock movement forever
    const box = { w: PLAYER.feetW, h: PLAYER.feetH };
    if (WorldLogic.hitZone(_px, _py, box, _solids())) { _px = 800; _py = 500; }
  }
  function _persist() {
    Storage.set(Storage.KEYS.WORLD, { x: _px, y: _py, face: _face });
  }

  function _frame(ts) {
    const dt = Math.min(0.05, (ts - _last) / 1000 || 0);
    _last = ts;

    if (!_inOverlay) {
      const v = WorldInput.vector();
      if (v.x || v.y) {
        const p = WorldLogic.resolveMove(
          _px, _py, v.x * SPEED * dt, v.y * SPEED * dt,
          { w: PLAYER.feetW, h: PLAYER.feetH }, _solids());
        _px = Math.max(20, Math.min(WorldMap.W - 20, p.x));
        _py = Math.max(20, Math.min(WorldMap.H - 20, p.y));
        _face = WorldLogic.facing(v.x, v.y, _face);
        const z = WorldLogic.hitZone(_px, _py, { w: PLAYER.feetW, h: PLAYER.feetH }, _doors());
        if (z && !_doorZone) World.openBuilding(z.id, z);
        _doorZone = z;
      }
    }
    _render(ts);
    requestAnimationFrame(_frame);
  }

  function _render(ts) {
    const vw = _canvas.width, vh = _canvas.height;
    const cam = WorldLogic.clampCamera(_px - vw / 2, _py - vh / 2, vw, vh, WorldMap.W, WorldMap.H);
    const g = _ctx;
    g.clearRect(0, 0, vw, vh);
    g.drawImage(_ground, cam.x, cam.y, vw, vh, 0, 0, vw, vh);

    // depth-sorted world objects: buildings + props + player by their base Y
    const items = [];
    for (const b of WorldMap.buildings) items.push({ y: b.y + b.h, draw: () => _drawSprite(b.sprite, b.x, b.y, b.w, b.h, b.label, cam) });
    for (const p of WorldMap.props) {
      const img = _assets.img(p.sprite);
      const h = img ? Math.round(p.w * img.height / img.width) : p.w;
      items.push({ y: p.y + h, draw: () => _drawSprite(p.sprite, p.x, p.y, p.w, h, p.label || null, cam) });
    }
    items.push({ y: _py, draw: () => _drawPlayer(ts, cam) });
    items.sort((a, b) => a.y - b.y).forEach(i => i.draw());

    // day/night: warm tint peaks at dawn/dusk, darkness + lights at night
    const n = _night(Date.now());
    const dusk = Math.max(0, 1 - Math.abs(n - 0.5) * 2.5);
    if (dusk > 0.01) {
      g.fillStyle = `rgba(255,150,70,${0.13 * dusk})`;
      g.fillRect(0, 0, vw, vh);
    }
    if (n > 0.02) _drawNight(g, vw, vh, cam, n);

    const vg = g.createRadialGradient(vw/2, vh/2, Math.min(vw,vh)/2.6, vw/2, vh/2, Math.max(vw,vh)/1.1);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = vg;
    g.fillRect(0, 0, vw, vh);

    _drawStick(g);
    _updatePrompt();
  }

  function _drawSprite(name, x, y, w, h, label, cam) {
    const img = _assets.img(name);
    const g = _ctx;
    if (img) {
      g.drawImage(img, x - cam.x, y - cam.y, w, h);
    } else {
      g.fillStyle = 'rgba(60,70,90,0.85)';
      g.fillRect(x - cam.x, y - cam.y, w, h);
      if (label) {
        g.fillStyle = '#fff'; g.font = '600 14px Inter, sans-serif'; g.textAlign = 'center';
        g.fillText(label, x - cam.x + w / 2, y - cam.y + h / 2);
      }
    }
  }

  function _drawPlayer(ts, cam) {
    const img = _assets.img('player');
    const v = WorldInput.vector();
    const bob = Math.sin(ts / 180) * ((v.x || v.y) ? 3 : 1);
    const dx = _px - PLAYER.w / 2 - cam.x;
    const dy = _py - PLAYER.h - cam.y + bob;
    const g = _ctx;
    g.fillStyle = 'rgba(0,0,0,0.25)';                       // contact shadow
    g.beginPath();
    g.ellipse(_px - cam.x, _py - cam.y + 4, 20, 8, 0, 0, Math.PI * 2);
    g.fill();
    if (img) {
      const col = FRAME.order[_face];
      g.drawImage(img, col * FRAME.w, 0, FRAME.w, FRAME.h, dx, dy, PLAYER.w, PLAYER.h);
    } else {
      g.fillStyle = '#e8632c';
      g.fillRect(dx + 16, dy + 16, PLAYER.w - 32, PLAYER.h - 16);
    }
  }

  function _drawStick(g) {
    const s = WorldInput.stick();
    if (!s.active) return;
    const r = _canvas.getBoundingClientRect();
    const sx = (s.baseX - r.left) * (_canvas.width / r.width);
    const sy = (s.baseY - r.top) * (_canvas.height / r.height);
    const kx = (s.knobX - r.left) * (_canvas.width / r.width);
    const ky = (s.knobY - r.top) * (_canvas.height / r.height);
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.beginPath(); g.arc(sx, sy, 60, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.beginPath(); g.arc(kx, ky, 26, 0, Math.PI * 2); g.fill();
  }

  // 0 = midday, 1 = deep night; smoothstep keeps day/night plateaus long
  // and the transitions short. Based on wall-clock so it survives reloads.
  function _night(now) {
    const phase = (now % DAY_MS) / DAY_MS;
    const raw = 1 - (Math.cos(phase * Math.PI * 2) + 1) / 2;
    return raw * raw * (3 - 2 * raw);
  }

  let _nightCv = null;
  function _lights() {
    const out = [];
    for (const p of WorldMap.props) {
      if (p.sprite !== 'props/candeeiro') continue;
      const img = _assets.img(p.sprite);
      const h = img ? Math.round(p.w * img.height / img.width) : p.w * 2;
      out.push({ x: p.x + p.w / 2, y: p.y + h * 0.18, r: 130 });
    }
    for (const b of WorldMap.buildings)
      out.push({ x: b.door.x + b.door.w / 2, y: b.door.y, r: 80 });
    return out;
  }

  function _drawNight(g, vw, vh, cam, n) {
    if (!_nightCv) _nightCv = document.createElement('canvas');
    if (_nightCv.width !== vw || _nightCv.height !== vh) { _nightCv.width = vw; _nightCv.height = vh; }
    const d = _nightCv.getContext('2d');
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, vw, vh);
    d.fillStyle = `rgba(10,16,42,${0.55 * n})`;
    d.fillRect(0, 0, vw, vh);

    // punch light pools out of the darkness (lamps + door spill)
    d.globalCompositeOperation = 'destination-out';
    const lights = _lights();
    for (const l of lights) {
      const x = l.x - cam.x, y = l.y - cam.y;
      if (x < -l.r || y < -l.r || x > vw + l.r || y > vh + l.r) continue;
      const hole = d.createRadialGradient(x, y, 0, x, y, l.r);
      hole.addColorStop(0, `rgba(0,0,0,${0.9 * n})`);
      hole.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = hole;
      d.beginPath(); d.arc(x, y, l.r, 0, Math.PI * 2); d.fill();
    }
    g.drawImage(_nightCv, 0, 0);

    // warm additive glow on top of each light source
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const x = l.x - cam.x, y = l.y - cam.y, r = l.r * 0.7;
      if (x < -r || y < -r || x > vw + r || y > vh + r) continue;
      const glow = g.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, `rgba(255,190,90,${0.3 * n})`);
      glow.addColorStop(1, 'rgba(255,190,90,0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function _updatePrompt() {
    const el = document.getElementById('world-door-prompt');
    if (_doorZone && !_inOverlay) {
      el.textContent = _doorZone.label;
      el.classList.remove('world-hidden');
    } else {
      el.classList.add('world-hidden');
    }
  }

  function _resize() {
    _canvas.width = window.innerWidth;
    _canvas.height = window.innerHeight;
  }

  // Fase 1 mapping: which modules open inside each building (rest = placeholder).
  const MAPPING = {
    casa:          { panels: [['narrative', 'Narrativa', () => NarrativeModule.render()]] },
    'club-office': { panels: [['hub', 'Season Log', () => HubModule.render()],
                              ['challenges', 'Challenges', () => ChallengesModule.render()]] },
    boardroom:     { panels: [['ruleset', 'Ruleset', () => RulesetModule.render()],
                              ['hub', 'Boardroom', () => HubModule.render()]] },
    quadro:        { custom: () => WorldBoard.render(document.getElementById('world-generic')) },
  };
  let _returnPos = null;

  function _clearPanels() {
    document.querySelectorAll('#world-overlay .module-panel')
      .forEach(p => p.classList.remove('active'));
  }

  function _showPanel(name, renderFn) {
    _clearPanels();
    const panel = document.getElementById(`module-${name}`);
    panel.classList.add('active');
    renderFn();
    if (window.lucide) lucide.createIcons();
    document.getElementById('world-overlay').scrollTop = 0;
  }

  function _showConstruction(label) {
    const panel = document.getElementById('world-generic');
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    const wrap = document.createElement('div');
    wrap.className = 'world-construction';
    const h = document.createElement('h2');
    h.textContent = label;
    const p = document.createElement('p');
    p.textContent = 'Em construção — chega numa fase seguinte.';
    wrap.append(h, p);
    panel.appendChild(wrap);
    _clearPanels();
    panel.classList.add('active');
  }

  function _showChooser(label, panels) {
    const panel = document.getElementById('world-generic');
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    const wrap = document.createElement('div');
    wrap.className = 'world-chooser';
    for (const [name, title, renderFn] of panels) {
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      btn.textContent = title;
      btn.addEventListener('click', () => _showPanel(name, renderFn));
      wrap.appendChild(btn);
    }
    panel.appendChild(wrap);
    _clearPanels();
    panel.classList.add('active');
  }

  function openBuilding(id) {
    const b = WorldMap.buildings.find(x => x.id === id)
      || WorldMap.props.find(p => p.id === id);
    _returnPos = { x: b.door.x + b.door.w / 2, y: b.door.y + b.door.h + 18 };
    _inOverlay = true;
    document.getElementById('world-overlay').classList.add('open');
    document.getElementById('world-back-btn').classList.remove('world-hidden');
    const m = MAPPING[id];
    if (!m) _showConstruction(b.label);
    else if (m.custom) {
      _clearPanels();
      m.custom();
      document.getElementById('world-generic').classList.add('active');
      if (window.lucide) lucide.createIcons();
      document.getElementById('world-overlay').scrollTop = 0;
    }
    else if (m.panels.length === 1) _showPanel(m.panels[0][0], m.panels[0][2]);
    else _showChooser(b.label, m.panels);
  }

  function closeOverlay() {
    _inOverlay = false;
    document.getElementById('world-overlay').classList.remove('open');
    document.getElementById('world-back-btn').classList.add('world-hidden');
    if (_returnPos) { _px = _returnPos.x; _py = _returnPos.y; _persist(); }
    _doorZone = null;
  }

  async function init() {
    _canvas = document.getElementById('world-canvas');
    _ctx = _canvas.getContext('2d');
    _resize();
    window.addEventListener('resize', _resize);
    const hud = document.getElementById('world-hud');
    hud.textContent = 'A carregar a cidade...';
    _assets = await WorldAssets.load((d, t) => { hud.textContent = `A carregar ${d}/${t}`; });
    hud.textContent = 'WASD / setas para andar';
    _ground = WorldGround.build();
    WorldInput.attach(_canvas);
    // Existing modules render into the overlay panels (app.js does this in index.html).
    SetupModule.init(document.getElementById('module-setup'));
    FictionModule.init(document.getElementById('module-fiction'));
    NarrativeModule.init(document.getElementById('module-narrative'));
    ChallengesModule.init(document.getElementById('module-challenges'));
    RulesetModule.init(document.getElementById('module-ruleset'));
    HubModule.init(document.getElementById('module-hub'));
    document.getElementById('world-back-btn').addEventListener('click', closeOverlay);
    _restore();
    window.addEventListener('beforeunload', _persist);
    requestAnimationFrame(ts => { _last = ts; _frame(ts); });
  }

  const api = { init, openBuilding, closeOverlay,
    _setOverlay: v => { _inOverlay = v; }, _pos: () => ({ x: _px, y: _py }),
    _moveTo: (x, y) => { _px = x; _py = y; _persist(); } };
  document.addEventListener('DOMContentLoaded', init);
  return api;
})();
