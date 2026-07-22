// Procedural ground: layered grass with noise splotches + stone paths.
// Built once into an offscreen canvas; the main loop just blits from it.
const WorldGround = (() => {
  // deterministic PRNG so the map looks the same every session
  function mulberry32(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function build() {
    const c = document.createElement('canvas');
    c.width = WorldMap.W; c.height = WorldMap.H;
    const g = c.getContext('2d');
    const rnd = mulberry32(20260721);

    // base grass
    const grad = g.createLinearGradient(0, 0, 0, WorldMap.H);
    grad.addColorStop(0, '#7dae4e');
    grad.addColorStop(1, '#6a9c40');
    g.fillStyle = grad;
    g.fillRect(0, 0, WorldMap.W, WorldMap.H);

    // tone splotches (large, soft)
    for (let i = 0; i < 260; i++) {
      const r = 30 + rnd() * 90;
      g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,180,0.05)' : 'rgba(30,80,20,0.06)';
      g.beginPath();
      g.ellipse(rnd() * WorldMap.W, rnd() * WorldMap.H, r, r * 0.6, 0, 0, Math.PI * 2);
      g.fill();
    }
    // fine speckle
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,200,0.08)' : 'rgba(20,60,15,0.08)';
      g.fillRect(rnd() * WorldMap.W, rnd() * WorldMap.H, 2, 2);
    }

    // stone paths (under buildings/props, so draw before world objects)
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const p of WorldMap.paths) {
      for (const [color, width] of [['#b9b09a', 34], ['#cfc6ae', 26]]) {
        g.strokeStyle = color;
        g.lineWidth = width;
        g.beginPath();
        g.moveTo(p.from[0], p.from[1]);
        if (p.via) g.quadraticCurveTo(p.via[0], p.via[1], p.to[0], p.to[1]);
        else g.lineTo(p.to[0], p.to[1]);
        g.stroke();
      }
    }
    // plaza circle where paths meet
    g.fillStyle = '#cfc6ae';
    g.beginPath(); g.arc(800, 420, 70, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#b9b09a'; g.lineWidth = 6; g.stroke();

    // stone joints on paths (subtle)
    for (let i = 0; i < 700; i++) {
      g.fillStyle = 'rgba(120,110,90,0.15)';
      const x = rnd() * WorldMap.W, y = rnd() * WorldMap.H;
      const d = g.getImageData(x, y, 1, 1).data;
      if (d[0] > 180 && d[1] > 170) g.fillRect(x, y, 6, 2); // only on light stone
    }
    return c;
  }

  return { build };
})();
