// Pure logic for the Career World engine. No DOM, no canvas — testable in Node.
const WorldLogic = (() => {
  function moveVector(keys) {
    let x = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    let y = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
    const m = Math.hypot(x, y);
    return m > 0 ? { x: x / m, y: y / m } : { x: 0, y: 0 };
  }

  function clampStick(dx, dy, max) {
    const m = Math.hypot(dx, dy);
    if (m / max < 0.15) return { x: 0, y: 0 };
    const s = Math.min(m, max) / max / (m || 1);
    return { x: dx * s, y: dy * s };
  }

  function _overlap(x, y, box, r) {
    return x - box.w / 2 < r.x + r.w && x + box.w / 2 > r.x &&
           y - box.h / 2 < r.y + r.h && y + box.h / 2 > r.y;
  }

  function resolveMove(px, py, dx, dy, box, solids) {
    let x = px + dx;
    if (solids.some(r => _overlap(x, py, box, r))) x = px;
    let y = py + dy;
    if (solids.some(r => _overlap(x, y, box, r))) y = py;
    return { x, y };
  }

  function hitZone(px, py, box, zones) {
    return zones.find(z => _overlap(px, py, box, z)) || null;
  }

  function clampCamera(cx, cy, vw, vh, ww, wh) {
    return {
      x: Math.max(0, Math.min(cx, ww - vw)),
      y: Math.max(0, Math.min(cy, wh - vh)),
    };
  }

  function facing(vx, vy, prev) {
    if (vx === 0 && vy === 0) return prev;
    if (Math.abs(vx) >= Math.abs(vy)) return vx > 0 ? 'right' : 'left';
    return vy > 0 ? 'down' : 'up';
  }

  return { moveVector, clampStick, resolveMove, hitZone, clampCamera, facing };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = WorldLogic;
