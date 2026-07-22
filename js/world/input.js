// Desktop keys + Brawl-Stars-style floating touch joystick.
const WorldInput = (() => {
  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  };
  const MAX_R = 60;
  const _keys = new Set();
  const _stick = { active: false, id: null, baseX: 0, baseY: 0, knobX: 0, knobY: 0 };

  // typing in a form field must never be hijacked by movement keys (WASD…)
  function _typing(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
      t.tagName === 'SELECT' || t.isContentEditable);
  }

  function attach(canvas) {
    window.addEventListener('keydown', e => {
      if (_typing(e)) return;
      const d = KEYMAP[e.code];
      if (d) { _keys.add(d); e.preventDefault(); }
    });
    window.addEventListener('keyup', e => {
      const d = KEYMAP[e.code];
      if (d) _keys.delete(d);
    });
    window.addEventListener('blur', () => _keys.clear());

    canvas.addEventListener('pointerdown', e => {
      if (_stick.active) return;
      _stick.active = true; _stick.id = e.pointerId;
      _stick.baseX = _stick.knobX = e.clientX;
      _stick.baseY = _stick.knobY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (!_stick.active || e.pointerId !== _stick.id) return;
      _stick.knobX = e.clientX; _stick.knobY = e.clientY;
    });
    const end = e => {
      if (e.pointerId === _stick.id) { _stick.active = false; _stick.id = null; }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  function vector() {
    const kv = WorldLogic.moveVector(_keys);
    if (kv.x || kv.y) return kv;
    if (!_stick.active) return { x: 0, y: 0 };
    return WorldLogic.clampStick(_stick.knobX - _stick.baseX, _stick.knobY - _stick.baseY, MAX_R);
  }

  function stick() {
    if (!_stick.active) return { active: false };
    const dx = _stick.knobX - _stick.baseX, dy = _stick.knobY - _stick.baseY;
    const m = Math.hypot(dx, dy) || 1;
    const cl = Math.min(m, MAX_R);
    return {
      active: true, baseX: _stick.baseX, baseY: _stick.baseY,
      knobX: _stick.baseX + dx / m * cl, knobY: _stick.baseY + dy / m * cl,
    };
  }

  return { attach, vector, stick };
})();
