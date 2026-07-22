// Loads processed sprites from assets/sprites/dist/. Missing file -> null (fallback draw).
const WorldAssets = (() => {
  const NAMES = [
    'player',
    // masks for club-color recolor (kit + the two neutral buildings)
    'player-mask', 'player-mask2',
    'buildings/club-office-mask', 'buildings/club-office-mask2',
    'buildings/estadio-mask', 'buildings/estadio-mask2', 'buildings/estadio-mask3',
    ...WorldMap.buildings.map(b => b.sprite),
    ...new Set(WorldMap.props.map(p => p.sprite)),
  ];
  const _imgs = {};
  const _tinted = {};                // club-colored canvases override originals

  function _one(name) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => { _imgs[name] = img; resolve(); };
      img.onerror = () => { _imgs[name] = null; resolve(); };
      img.src = `assets/sprites/dist/${name}.png`;
    });
  }

  async function load(onProgress) {
    let done = 0;
    await Promise.all(NAMES.map(n => _one(n).then(() => {
      done++;
      if (onProgress) onProgress(done, NAMES.length);
    })));
    return {
      img:  name => _tinted[name] || _imgs[name] || null,
      orig: name => _imgs[name] || null,
      setTint: (name, canvas) => { _tinted[name] = canvas; },
      clearTint: () => { for (const k of Object.keys(_tinted)) delete _tinted[k]; },
    };
  }

  return { load };
})();
