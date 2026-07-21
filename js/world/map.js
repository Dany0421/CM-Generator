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

  const props = [
    { sprite: 'props/estatua',   x: 780, y: 300, w: 90 },
    { sprite: 'props/campo',     x: 120, y: 480, w: 280 },
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

  // Stone paths door-to-door (drawn by ground renderer as wide stone strokes).
  const doorAnchor = id => {
    const b = buildings.find(b => b.id === id);
    return [b.door.x + b.door.w / 2, b.door.y + b.door.h / 2];
  };
  const plaza = [800, 420]; // central square in front of the Estádio
  const paths = [
    ...buildings.map(b => ({ from: doorAnchor(b.id), to: plaza })),
  ];

  return { W, H, buildings, props, paths };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = WorldMap;
