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
  // Props with id/label/door are interactive — walking onto the door opens them.
  // Estátua is centered on the plaza circle (800,420 r70) — statue base sits in the circle.
  const props = [
    { sprite: 'props/estatua',   x: 755, y: 334, w: 90,
      solid: { x: 762, y: 414, w: 76, h: 46 } },
    { sprite: 'props/quadro',    x: 880, y: 345, w: 80,
      id: 'quadro', label: 'Quadro de Avisos',
      door: { x: 872, y: 420, w: 96, h: 26 } },
    { sprite: 'props/campo',     x: 120, y: 480, w: 280,
      solid: { x: 128, y: 496, w: 264, h: 130 } },
    { sprite: 'props/arvore',    x:  60, y: 150, w: 100 },
    { sprite: 'props/arvore',    x: 1050, y: 140, w: 100 },
    { sprite: 'props/arvore',    x: 1420, y: 900, w: 100 },
    { sprite: 'props/arvore',    x: 460, y: 820, w: 100 },
    { sprite: 'props/arbusto',   x: 540, y: 350, w: 60 },
    { sprite: 'props/arbusto',   x: 1150, y: 520, w: 60 },
    { sprite: 'props/arbusto',   x: 850, y: 1080, w: 60 },
    // vegetation pass — clusters in the empty pockets, sizes varied on purpose
    { sprite: 'props/arvore',    x: 1250, y:  80, w: 110 },  // top-right grove
    { sprite: 'props/arvore2',   x: 1350, y: 160, w: 85 },
    { sprite: 'props/arbusto',   x: 1300, y: 240, w: 60 },
    { sprite: 'props/arbusto',   x: 1180, y: 120, w: 50 },
    { sprite: 'props/arvore',    x: 1500, y: 400, w: 95 },   // east edge
    { sprite: 'props/arbusto',   x: 1510, y: 510, w: 60 },
    { sprite: 'props/arvore',    x: 520, y:  90, w: 95 },    // balneário/estádio gap
    { sprite: 'props/arbusto',   x: 990, y: 230, w: 55 },
    { sprite: 'props/arvore',    x:  30, y: 320, w: 90 },    // west edge, above campo
    { sprite: 'props/arbusto',   x: 100, y: 410, w: 55 },
    { sprite: 'props/arvore2',   x:  20, y: 540, w: 90 },
    { sprite: 'props/arbusto',   x: 150, y: 680, w: 60 },    // below campo
    { sprite: 'props/arvore',    x:  60, y: 1050, w: 105 },  // bottom-left corner
    { sprite: 'props/arbusto',   x: 175, y: 1110, w: 60 },
    { sprite: 'props/arbusto',   x: 790, y: 1140, w: 65 },   // south strip
    { sprite: 'props/arvore',    x: 1290, y: 1080, w: 95 },  // bottom-right grove
    { sprite: 'props/arbusto',   x: 1400, y: 1040, w: 60 },
    { sprite: 'props/arvore2',   x: 1495, y: 1090, w: 100 },
    // props round 2 — canteiros, pedras e jardins (sprites do Dany, 2026-07-22)
    { sprite: 'props/canteiro',  x: 705, y: 465, w: 70 },    // beira da praça
    { sprite: 'props/canteiro',  x: 1245, y: 255, w: 65 },   // norte do boardroom
    { sprite: 'props/canteiro',  x: 330, y: 645, w: 65 },    // abaixo do campo
    { sprite: 'props/pedra',     x: 1445, y: 175, w: 80 },   // top-right grove
    { sprite: 'props/pedra',     x:  60, y: 905, w: 75 },    // oeste da casa
    { sprite: 'props/pedra',     x: 1175, y: 1125, w: 80 },  // faixa sul
    { sprite: 'props/jardim',    x: 1445, y: 640, w: 115 },  // borda este
    { sprite: 'props/jardim',    x: 235, y: 1045, w: 110 },  // canto inf. esquerdo
    { sprite: 'props/banco',     x: 625, y: 440, w: 70 },
    { sprite: 'props/banco',     x: 1300, y: 850, w: 70 },
    { sprite: 'props/candeeiro', x: 410, y: 480, w: 50 },
    { sprite: 'props/candeeiro', x: 70, y: 600, w: 50 },
    { sprite: 'props/candeeiro', x: 620, y: 330, w: 50 },
    { sprite: 'props/candeeiro', x: 980, y: 330, w: 50 },
    { sprite: 'props/candeeiro', x: 500, y: 700, w: 50 },
    { sprite: 'props/candeeiro', x: 1120, y: 800, w: 50 },
    { sprite: 'props/candeeiro', x: 300, y: 1000, w: 50 },
  ];

  // Stone paths plaza-to-building (drawn by ground renderer as wide stone strokes).
  // Each path ends at the closest point on the building's rect, tucked toward the
  // center deep enough to sit under opaque art even when that point is a trimmed
  // corner (roofs slope, corners are transparent) — but well short of the center,
  // so a path never crosses the building and pokes out by the door on the far side.
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
    const tuck = 55;
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
    { from: [450, 300],  via: [555, 215],  to: [680, 225] },   // balneário ↔ estádio
    { from: [320, 930],  via: [460, 1010], to: [600, 995] },   // casa ↔ sponsors
    { from: [720, 1015], via: [830, 1050], to: [940, 985] },   // sponsors ↔ agência
    { from: [1070, 935], via: [1200, 890], to: [1275, 780] },  // agência ↔ club office
    { from: [1340, 490], via: [1390, 580], to: [1310, 670] },  // boardroom ↔ club office
  );

  return { W, H, buildings, props, paths };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = WorldMap;
