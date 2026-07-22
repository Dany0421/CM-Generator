// Club-color tint: Club Office + Estádio (neutral art by design) and the
// player's kit take the save's club colors. Composite ops ONLY — under file://
// the canvas is tainted by local images, so pixels can never be read back.
// Kit zones come from Python-built masks (player-mask = shirt, player-mask2 =
// dark kit); skin/hair/boots are outside both masks and stay untouched.
const WorldTint = (() => {
  // Normalize ANY css color the AI might return ("#DA291C", "red", "rgb(…)")
  // via the fillStyle round-trip — reading fillStyle back is allowed even on
  // tainted canvases (it's not pixel data). Unparseable → fallback.
  const _normCtx = document.createElement('canvas').getContext('2d');
  function _safe(color, fallback) {
    _normCtx.fillStyle = '#010203'; // sentinel
    _normCtx.fillStyle = String(color || '').trim();
    const out = _normCtx.fillStyle;
    return out === '#010203' && String(color).trim() !== '#010203' ? fallback : out;
  }

  // mix with white so multiply keeps the art readable (pure strong colors
  // over white walls would go full poster-paint)
  function _soften(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const mix = c => Math.round(c + (255 - c) * f);
    const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  function _canvasFor(img) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    return c;
  }

  // facade takes the primary, the roof band the secondary
  function _tintBuilding(img, primary, secondary) {
    const c = _canvasFor(img);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply';
    const grad = g.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, _soften(secondary, 0.35));
    grad.addColorStop(0.30, _soften(secondary, 0.35));
    grad.addColorStop(0.34, _soften(primary, 0.35));
    grad.addColorStop(1, _soften(primary, 0.35));
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(img, 0, 0);
    return c;
  }

  function _coloredMask(mask, color) {
    const c = _canvasFor(mask);
    const g = c.getContext('2d');
    g.drawImage(mask, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function _tintPlayer(sheet, mask1, mask2, primary, secondary) {
    const c = _canvasFor(sheet);
    const g = c.getContext('2d');
    g.drawImage(sheet, 0, 0);
    if (mask1) {
      // shirt is light — multiply paints it the primary color, shading kept
      g.globalCompositeOperation = 'multiply';
      g.drawImage(_coloredMask(mask1, _soften(primary, 0.12)), 0, 0);
    }
    if (mask2) {
      // dark kit — 'color' sets the hue, a soft 'screen' lifts it into view
      const cm = _coloredMask(mask2, secondary);
      g.globalCompositeOperation = 'color';
      g.drawImage(cm, 0, 0);
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = 0.35;
      g.drawImage(cm, 0, 0);
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(sheet, 0, 0);
    return c;
  }

  function apply(assets, primary, secondary) {
    primary = _safe(primary, '#888888');
    secondary = _safe(secondary, '#dddddd');
    for (const name of ['buildings/club-office', 'buildings/estadio']) {
      const img = assets.orig(name);
      if (img) assets.setTint(name, _tintBuilding(img, primary, secondary));
    }
    const sheet = assets.orig('player');
    if (sheet) {
      assets.setTint('player',
        _tintPlayer(sheet, assets.orig('player-mask'), assets.orig('player-mask2'), primary, secondary));
    }
  }

  return { apply };
})();
