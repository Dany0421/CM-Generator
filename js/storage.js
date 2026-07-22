const Storage = (() => {
  const KEYS = {
    API_KEY:        'cg_api_key',
    MODEL:          'cg_model',
    SETUP:          'cg_setup',
    NARRATIVE:      'cg_narrative',
    CHALLENGES:     'cg_challenges',
    RULESET:        'cg_ruleset',
    HUB:            'cg_hub',
    SEASONS:        'cg_seasons',
    FICTION_PLAYER: 'cg_fiction_player',
    WORLD:          'cg_world',
    NPCS:           'cg_npcs',
    SPONSORS:       'cg_sponsors',
    NEWS:           'cg_news',
    AGENCY:         'cg_agency',
  };

  // { [storageKey]: { prev: any, onUndo: fn, timerId: id } }
  const _undoBuffer = {};

  function get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage.set failed:', e);
    }
  }

  function remove(key) {
    localStorage.removeItem(key);
  }

  // Save previous value to undo buffer, persist new value, return undo function.
  // The caller is responsible for showing the toast and wiring up the undo button.
  function saveWithUndo(key, newValue) {
    const prev = get(key);

    // Cancel any pending undo for same key
    if (_undoBuffer[key]) {
      clearTimeout(_undoBuffer[key].timerId);
    }

    set(key, newValue);

    const entry = {
      prev,
      timerId: setTimeout(() => { delete _undoBuffer[key]; }, 5500),
    };
    _undoBuffer[key] = entry;

    return function undo() {
      if (!_undoBuffer[key]) return false;
      clearTimeout(_undoBuffer[key].timerId);
      set(key, _undoBuffer[key].prev);
      delete _undoBuffer[key];
      return true;
    };
  }

  function clearAll() {
    const keep = new Set([KEYS.API_KEY, KEYS.MODEL]);
    Object.values(KEYS).forEach(k => {
      if (!keep.has(k)) remove(k);
    });
  }

  return { KEYS, get, set, remove, saveWithUndo, clearAll };
})();
