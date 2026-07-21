const test = require('node:test');
const assert = require('node:assert');
const M = require('../js/world/map.js');

test('eight buildings with unique ids', () => {
  assert.strictEqual(M.buildings.length, 8);
  assert.strictEqual(new Set(M.buildings.map(b => b.id)).size, 8);
});
test('every building fits inside the world', () => {
  for (const b of M.buildings) {
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= M.W && b.y + b.h <= M.H, b.id);
  }
});
test('door zone touches or overlaps its solid box', () => {
  for (const b of M.buildings) {
    const s = b.solid, d = b.door;
    assert.ok(d.x < s.x + s.w && d.x + d.w > s.x, b.id);
    assert.ok(d.y <= s.y + s.h + 24, b.id); // door sits at/just below the base
  }
});
test('no two solid boxes overlap', () => {
  const S = M.buildings.map(b => b.solid);
  for (let i = 0; i < S.length; i++)
    for (let j = i + 1; j < S.length; j++) {
      const a = S[i], c = S[j];
      const sep = a.x + a.w <= c.x || c.x + c.w <= a.x || a.y + a.h <= c.y || c.y + c.h <= a.y;
      assert.ok(sep, `${M.buildings[i].id} vs ${M.buildings[j].id}`);
    }
});
