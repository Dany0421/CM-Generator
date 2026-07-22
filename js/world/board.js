// Plaza notice board — the season's 10 events as covered scratch cards.
// Same data as the Hub Events tab (hub.events.pool/rolled), so both stay in
// sync; scratching a card here IS the month's roll. Choice of card is the
// player's, what's underneath stays luck (cards are blind + shuffled).
const WorldBoard = (() => {
  let _panel = null;
  let _armedIdx = null;    // covered card currently armed for scratching
  let _committed = false;  // first scratch stroke landed — no take-backs

  function _hub() { return Storage.get(Storage.KEYS.HUB) || {}; }

  // Stable per-season shuffle: covered cards keep their board spots across
  // renders and the position never leaks the event type (pool order might).
  function _order(count, seed) {
    let s = (seed * 2654435761) >>> 0;
    const rnd = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const idx = Array.from({ length: count }, (_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  }

  function _revealedContent(card, ev, rollNum) {
    card.classList.add(ev.type);
    const badge = document.createElement('span');
    badge.className = `board-badge ${ev.type}`;
    badge.textContent = ev.type === 'positive' ? '+ Positivo' : '− Negativo';
    card.appendChild(badge);
    const text = document.createElement('p');
    text.className = 'board-text';
    text.textContent = ev.text;
    card.appendChild(text);
    if (rollNum) {
      const num = document.createElement('span');
      num.className = 'board-rollnum';
      num.textContent = `Mês ${rollNum}`;
      card.appendChild(num);
    }
  }

  function _reveal(idx) {
    const hub = _hub();
    if (!hub.events || (hub.events.rolled || []).includes(idx)) return;
    hub.events.rolled = [...(hub.events.rolled || []), idx];
    Storage.set(Storage.KEYS.HUB, hub);
    _armedIdx = null;
    _committed = false;
    render(_panel);
    App.showToast('Evento revelado — está no quadro e no Hub.');
  }

  function _scratchCanvas(card, idx) {
    const cv = document.createElement('canvas');
    cv.className = 'board-scratch';
    requestAnimationFrame(() => {
      cv.width = card.clientWidth || 240;
      cv.height = card.clientHeight || 120;
      const g = cv.getContext('2d');
      g.fillStyle = '#59637a';
      g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      for (let i = 0; i < 26; i++) {
        g.fillRect(Math.random() * cv.width, Math.random() * cv.height, 16, 2);
      }
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.font = '800 16px Inter, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('RASPA', cv.width / 2, cv.height / 2);
    });

    let down = false;
    const erase = e => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) * (cv.width / r.width);
      const y = (e.clientY - r.top) * (cv.height / r.height);
      const g = cv.getContext('2d');
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.fill();
      if (!_committed) {
        _committed = true;   // stroke landed: this is the month's card now
        const grid = _panel.querySelector('.board-grid');
        if (grid) grid.classList.add('board-locked');
        const cancel = _panel.querySelector('.board-cancel');
        if (cancel) cancel.remove();
      }
    };
    cv.addEventListener('pointerdown', e => {
      down = true; cv.setPointerCapture(e.pointerId); erase(e); e.preventDefault();
    });
    cv.addEventListener('pointermove', e => { if (down) erase(e); });
    cv.addEventListener('pointerup', () => {
      down = false;
      const g = cv.getContext('2d');
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      let clear = 0, total = 0;
      for (let i = 3; i < d.length; i += 16) { total++; if (d[i] === 0) clear++; }
      if (total > 0 && clear / total > 0.5) _reveal(idx);
    });
    return cv;
  }

  function _buildCard(pool, rolled, idx) {
    const card = document.createElement('div');
    card.className = 'board-card';
    const rolledPos = rolled.indexOf(idx);

    if (rolledPos !== -1) {
      _revealedContent(card, pool[idx], rolledPos + 1);
      return card;
    }

    if (_armedIdx === idx) {
      // event content underneath, scratch foil on top
      _revealedContent(card, pool[idx], null);
      card.appendChild(_scratchCanvas(card, idx));
      return card;
    }

    card.classList.add('covered');
    const q = document.createElement('div');
    q.className = 'board-cover-q';
    q.textContent = '?';
    card.appendChild(q);
    card.addEventListener('click', () => {
      if (_committed) return;
      _armedIdx = idx;
      render(_panel);
    });
    return card;
  }

  function render(panel) {
    _panel = panel;
    panel.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'board-wrap';

    const h = document.createElement('h2');
    h.textContent = 'Quadro de Avisos';
    wrap.appendChild(h);

    const setup = Storage.get(Storage.KEYS.SETUP);
    const season = setup?.season || 1;
    const events = _hub().events;
    const hasPool = events && events.season === season && (events.pool || []).length > 0;

    if (!hasPool) {
      _armedIdx = null;
      _committed = false;
      const empty = document.createElement('div');
      empty.className = 'board-empty';
      const p = document.createElement('p');
      p.textContent = `Ainda não há eventos para a época ${season}. Gera o pool — 10 cartas cobertas, 5 boas e 5 más, baralhadas.`;
      empty.appendChild(p);
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      btn.textContent = 'Gerar eventos da época';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'A gerar…';
        try {
          await API.generateEvents();
          render(panel);
        } catch (err) {
          App.showError(err.message);
          btn.disabled = false;
          btn.textContent = 'Gerar eventos da época';
        }
      });
      empty.appendChild(btn);
      wrap.appendChild(empty);
      panel.appendChild(wrap);
      return;
    }

    const pool = events.pool;
    const rolled = events.rolled || [];

    const hint = document.createElement('p');
    hint.className = 'board-hint';
    hint.textContent = 'Raspa 1 carta por mês — a escolha da carta é tua, o que está por baixo é sorte.';
    wrap.appendChild(hint);

    const counter = document.createElement('p');
    counter.className = 'board-counter';
    counter.textContent = `${rolled.length} / ${pool.length} reveladas`;
    wrap.appendChild(counter);

    if (_armedIdx !== null && !_committed) {
      const cancel = document.createElement('button');
      cancel.className = 'btn-ghost board-cancel';
      cancel.textContent = 'Afinal outra carta — cancelar escolha';
      cancel.addEventListener('click', () => { _armedIdx = null; render(panel); });
      wrap.appendChild(cancel);
    }

    const grid = document.createElement('div');
    grid.className = 'board-grid';
    if (_committed) grid.classList.add('board-locked');
    for (const idx of _order(pool.length, season)) {
      grid.appendChild(_buildCard(pool, rolled, idx));
    }
    wrap.appendChild(grid);
    panel.appendChild(wrap);
  }

  return { render };
})();
