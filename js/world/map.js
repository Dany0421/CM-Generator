// World layout data. All coords in world units (1 unit = 1 canvas px at zoom 1).
// Sprite pixel sizes are 2x world size (see asset contract in the plan/spec).
const WorldMap = (() => {
  const W = 1600, H = 1200;

  // w/h = world draw size (dist px / 2, height from measured aspect).
  // doorShift nudges the door strip horizontally when the art's door is off-center.
  const DEFS = [
    { id: 'estadio',     w: 340, h: 217, x: 630, y:  60, label: 'Estádio',     doorShift: 0 },
    { id: 'balneario',   w: 240, h: 226, x: 250, y: 120, label: 'Balneário',   doorShift: 0 },
    { id: 'boardroom',   w: 220, h: 217, x: 1230, y: 300, label: 'Boardroom',  doorShift: 0 },
    { id: 'club-office', w: 240, h: 170, x: 1180, y: 640, label: 'Club Office', doorShift: 0 },
    { id: 'casa',        w: 220, h: 216, x: 140, y: 760, label: 'Casa',        doorShift: 0 },
    { id: 'imprensa',    w: 230, h: 220, x: 560, y: 560, label: 'Imprensa',    doorShift: -20 },
    { id: 'agencia',     w: 210, h: 144, x: 900, y: 900, label: 'Agência',     doorShift: 0 },
    { id: 'sponsors',    w: 200, h: 200, x: 560, y: 920, label: 'Sponsors',    doorShift: 0 },
  ];

  const buildings = DEFS.map(d => {
    const solidH = Math.round(d.h * 0.45);
    const solid = { x: d.x, y: d.y + d.h - solidH, w: d.w, h: solidH };
    const door = {
      x: d.x + Math.round(d.w / 2) - 28 + d.doorShift,
      y: d.y + d.h - 12, w: 56, h: 24,
    };
    return { ...d, sprite: `buildings/${d.id}`, solid, door };
  });

  // Props with a `solid` box block movement (campo + estátua); the rest are walk-through.
  // Estátua is centered on the plaza circle (800,420 r70) — statue base sits in the circle.
  const props = [
    { sprite: 'props/estatua',   x: 755, y: 334, w: 90,
      solid: { x: 762, y: 414, w: 76, h: 46 } },
    { sprite: 'props/campo',     x: 120, y: 480, w: 280,
      solid: { x: 128, y: 496, w: 264, h: 130 } },
    { sprite: 'props/arvore',    x:  60, y: 150, w: 100 },
    { sprite: 'props/arvore',    x: 1050, y: 140, w: 100 },
    { sprite: 'props/arvore',    x: 1420, y: 900, w: 100 },
    { sprite: 'props/arvore',    x: 460, y: 820, w: 100 },
    { sprite: 'props/arbusto',   x: 540, y: 350, w: 60 },
    { sprite: 'props/arbusto',   x: 1150, y: 520, w: 60 },
    { sprite: 'props/arbusto',   x: 850, y: 1080, w: 60 },
    { sprite: 'props/banco',     x: 700, y: 400, w: 70 },
    { sprite: 'props/banco',     x: 1300, y: 850, w: 70 },
    { sprite: 'props/candeeiro', x: 620, y: 330, w: 50 },
    { sprite: 'props/candeeiro', x: 980, y: 330, w: 50 },
    { sprite: 'props/candeeiro', x: 500, y: 700, w: 50 },
    { sprite: 'props/candeeiro', x: 1120, y: 800, w: 50 },
    { sprite: 'props/candeeiro', x: 300, y: 1000, w: 50 },
  ];

  // Stone paths plaza-to-building (drawn by ground renderer as wide stone strokes).
  // Each path ends at the closest point on the building's rect, tucked slightly
  // under the sprite — touching the building is enough, never crossing it
  // (door positions vary per art, a door-anchored path can cut through the sprite).
  const plaza = [800, 420]; // central square in front of the Estádio
  // Imprensa has no own path — the Sponsors path runs right past it and doubles up.
  // BEND: perpendicular offset (px) of each path's curve control point — signs
  // chosen by hand so curves bow away from building solids (casa/sponsors clear
  // the Imprensa block; the rest just vary side so the city feels grown, not radial).
  const BEND = {
    estadio: 30, balneario: 45, boardroom: -50, 'club-office': -55,
    casa: -50, agencia: 60, sponsors: 45,
  };
  const paths = buildings.filter(b => b.id !== 'imprensa').map(b => {
    const ex = Math.max(b.x, Math.min(plaza[0], b.x + b.w));
    const ey = Math.max(b.y, Math.min(plaza[1], b.y + b.h));
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const m = Math.hypot(cx - ex, cy - ey) || 1;
    const tuck = 18;
    const from = [ex + (cx - ex) / m * tuck, ey + (cy - ey) / m * tuck];
    const dx = plaza[0] - from[0], dy = plaza[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    const bend = BEND[b.id] || 0;
    const via = [
      (from[0] + plaza[0]) / 2 - dy / len * bend,
      (from[1] + plaza[1]) / 2 + dx / len * bend,
    ];
    return { from, to: plaza, via };
  });

  // Links between neighbouring buildings — a ring of detours/crossings so the
  // city isn't only radial paths out of the plaza. Endpoints tuck under sprites.
  paths.push(
    { from: [470, 290],  via: [555, 215],  to: [650, 235] },   // balneário ↔ estádio
    { from: [340, 940],  via: [460, 1010], to: [580, 990] },   // casa ↔ sponsors
    { from: [740, 1010], via: [830, 1050], to: [920, 990] },   // sponsors ↔ agência
    { from: [1080, 930], via: [1200, 890], to: [1270, 795] },  // agência ↔ club office
    { from: [1340, 505], via: [1390, 580], to: [1310, 655] },  // boardroom ↔ club office
  );

  return { W, H, buildings, props, paths };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = WorldMap;
