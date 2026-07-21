const test = require('node:test');
const assert = require('node:assert');
const L = require('../js/world/logic.js');

test('moveVector: single key', () => {
  assert.deepStrictEqual(L.moveVector(new Set(['right'])), { x: 1, y: 0 });
});
test('moveVector: diagonal is normalized', () => {
  const v = L.moveVector(new Set(['right', 'down']));
  assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-9);
  assert.ok(v.x > 0 && v.y > 0);
});
test('moveVector: opposing keys cancel', () => {
  assert.deepStrictEqual(L.moveVector(new Set(['left', 'right'])), { x: 0, y: 0 });
});
test('clampStick: inside radius scales linearly', () => {
  const v = L.clampStick(30, 0, 60);
  assert.ok(Math.abs(v.x - 0.5) < 1e-9 && v.y === 0);
});
test('clampStick: beyond radius clamps to 1', () => {
  const v = L.clampStick(0, 200, 60);
  assert.ok(Math.abs(v.y - 1) < 1e-9);
});
test('clampStick: dead zone', () => {
  assert.deepStrictEqual(L.clampStick(3, 3, 60), { x: 0, y: 0 });
});
test('resolveMove: free movement applies delta', () => {
  const p = L.resolveMove(100, 100, 5, -3, { w: 24, h: 12 }, []);
  assert.deepStrictEqual(p, { x: 105, y: 97 });
});
test('resolveMove: blocked on X still slides on Y', () => {
  // wall starts beyond the player's initial box edge (100 + 12 = 112)
  const wall = { x: 120, y: 0, w: 20, h: 400 };
  const p = L.resolveMove(100, 100, 10, 7, { w: 24, h: 12 }, [wall]);
  assert.strictEqual(p.x, 100);      // X blocked
  assert.strictEqual(p.y, 107);      // Y slides
});
test('hitZone: overlap returns zone, else null', () => {
  const z = { id: 'casa', x: 90, y: 90, w: 40, h: 20 };
  assert.strictEqual(L.hitZone(100, 100, { w: 24, h: 12 }, [z]), z);
  assert.strictEqual(L.hitZone(300, 300, { w: 24, h: 12 }, [z]), null);
});
test('clampCamera: clamps to world bounds', () => {
  assert.deepStrictEqual(L.clampCamera(-50, -50, 800, 600, 1600, 1200), { x: 0, y: 0 });
  assert.deepStrictEqual(L.clampCamera(2000, 2000, 800, 600, 1600, 1200), { x: 800, y: 600 });
});
test('facing: dominant axis wins, idle keeps prev', () => {
  assert.strictEqual(L.facing(0.9, 0.2, 'down'), 'right');
  assert.strictEqual(L.facing(0, -1, 'down'), 'up');
  assert.strictEqual(L.facing(0, 0, 'left'), 'left');
});
