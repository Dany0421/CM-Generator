// Career World engine: render loop, camera, player, collision, door detection.
const World = (() => {
  const SPEED = 220;              // world units / second
  const PLAYER = { w: 64, h: 96, feetW: 28, feetH: 14 };
  const FRAME = { w: 128, h: 192, order: { down: 0, left: 1, right: 2, up: 3 } };

  let _canvas, _ctx, _assets, _ground;
  let _px = 800, _py = 500;       // player world position (feet center)
  let _face = 'down';
  let _last = 0;
  let _inOverlay = false;
  let _doorZone = null;

  const _solids = () => WorldMap.buildings.map(b => b.solid);
  const _doors = () => WorldMap.buildings.map(b => ({ ...b.door, id: b.id, label: b.label }));

  function _restore() {
    const s = Storage.get(Storage.KEYS.WORLD);
    if (s && typeof s.x === 'number') { _px = s.x; _py = s.y; _face = s.face || 'down'; }
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
      items.push({ y: p.y + h, draw: () => _drawSprite(p.sprite, p.x, p.y, p.w, h, null, cam) });
    }
    items.push({ y: _py, draw: () => _drawPlayer(ts, cam) });
    items.sort((a, b) => a.y - b.y).forEach(i => i.draw());

    // evening tint + vignette
    g.fillStyle = 'rgba(255,180,90,0.06)';
    g.fillRect(0, 0, vw, vh);
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

  // Task 7 replaces these stubs with the real overlay logic.
  function openBuilding(id) { console.log('enter', id); }
  function closeOverlay() {}

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
