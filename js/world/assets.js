// Loads processed sprites from assets/sprites/dist/. Missing file -> null (fallback draw).
const WorldAssets = (() => {
  const NAMES = [
    'player',
    ...WorldMap.buildings.map(b => b.sprite),
    ...new Set(WorldMap.props.map(p => p.sprite)),
  ];
  const _imgs = {};

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
    return { img: name => _imgs[name] || null };
  }

  return { load };
})();
