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
    if (out === '#010203' && String(color).trim() !== '#010203') return fallback;
    return /^#[0-9a-fA-F]{6}$/.test(out) ? out : fallback; // rgba() etc → fallback
  }

  // Same hue, fixed HIGH lightness — dark club colors (navy, black-ish) would
  // crush the buildings under multiply; walls must stay bright, only hued.
  function _pastel(hex, L) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0)
        : max === g ? (b - r) / d + 2
        : (r - g) / d + 4;
      h /= 6;
    }
    if (s > 0.08) s = Math.max(s, 0.5); // punch for saturated-but-dark kits
    const q = L < 0.5 ? L * (1 + s) : L + s - L * s;
    const p = 2 * L - q;
    const hue = t => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const to255 = v => Math.round(v * 255);
    const rr = to255(hue(h + 1 / 3)), gg = to255(hue(h)), bb = to255(hue(h - 1 / 3));
    return `#${((rr << 16) | (gg << 8) | bb).toString(16).padStart(6, '0')}`;
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

  // Same recipe as the player kit: walls (light-neutral mask) painted SOLID
  // with the primary via multiply, mid-tone zones (roof/trim mask) take the
  // secondary via color+screen. No masks loaded → gentle pastel fallback.
  function _tintBuilding(img, mask1, mask2, mask3, primary, secondary) {
    const c = _canvasFor(img);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    if (mask1 || mask2) {
      if (mask1) {
        g.globalCompositeOperation = 'multiply';
        g.drawImage(_coloredMask(mask1, _soften(primary, 0.12)), 0, 0);
      }
      if (mask2) {
        const cm = _coloredMask(mask2, secondary);
        g.globalCompositeOperation = 'color';
        g.drawImage(cm, 0, 0);
        g.globalCompositeOperation = 'screen';
        g.globalAlpha = 0.35;
        g.drawImage(cm, 0, 0);
        g.globalAlpha = 1;
      }
      if (mask3) {
        // floodlight towers — flattened to the pole gray (never club colors);
        // 30% of the original art shows through to keep a hint of shading
        const cm3 = _coloredMask(mask3, '#565b62');
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 0.7;
        g.drawImage(cm3, 0, 0);
        g.globalAlpha = 1;
      }
    } else {
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = _pastel(primary, 0.72);
      g.fillRect(0, 0, c.width, c.height);
    }
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
      if (img) {
        assets.setTint(name, _tintBuilding(img,
          assets.orig(`${name}-mask`), assets.orig(`${name}-mask2`),
          assets.orig(`${name}-mask3`), primary, secondary));
      }
    }
    const sheet = assets.orig('player');
    if (sheet) {
      assets.setTint('player',
        _tintPlayer(sheet, assets.orig('player-mask'), assets.orig('player-mask2'), primary, secondary));
    }
  }

  return { apply };
})();
