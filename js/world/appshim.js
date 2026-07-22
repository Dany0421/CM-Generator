// Minimal App shim for world.html — the real js/app.js needs the index chrome
// (bottom-nav, #app-main, settings modal) that the world entry doesn't have.
// Modules call App.navigate/showToast/showError/setMode at event time.
const App = (() => {
  let _toastId = 0;

  function navigate(name) {
    document.querySelectorAll('#world-overlay .module-panel')
      .forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`module-${name}`);
    if (panel) panel.classList.add('active');
    if (name === 'fiction') FictionModule.render();
    if (name === 'hub') HubModule.render();
    document.getElementById('world-overlay').scrollTop = 0;
  }

  function setMode() {} // no fiction nav tab in the world entry

  function _toast(message, undoFn, error) {
    const container = document.getElementById('toast-container');
    const id = ++_toastId;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.dataset.id = id;
    if (error) toast.style.borderColor = 'rgba(239,68,68,.35)';

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    if (error) icon.style.color = 'var(--red)';
    const iconEl = document.createElement('i');
    iconEl.setAttribute('data-lucide', error ? 'alert-circle' : 'check-circle-2');
    icon.appendChild(iconEl);
    toast.appendChild(icon);

    const msg = document.createElement('span');
    msg.className = 'toast-message';
    msg.textContent = message;
    toast.appendChild(msg);

    if (undoFn) {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'toast-undo';
      undoBtn.textContent = 'Undo';
      undoBtn.addEventListener('click', () => { undoFn(); _remove(id); });
      toast.appendChild(undoBtn);
    }

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();
    toast._timer = setTimeout(() => _remove(id), error ? 6000 : 5000);
    return id;
  }

  function _remove(id) {
    const toast = document.querySelector(`#toast-container [data-id="${id}"]`);
    if (!toast) return;
    clearTimeout(toast._timer);
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 200);
  }

  // ── Settings modal + chat wiring (world chrome) ─────────────
  // Same handlers as js/app.js init, minus the index-only chrome (nav tabs,
  // api-setup screen). Modal markup lives in world.html with the same ids.
  function _openSettings() { document.getElementById('settings-modal').classList.remove('hidden'); }
  function _closeSettings() { document.getElementById('settings-modal').classList.add('hidden'); }

  function _rerenderAll() {
    SetupModule.render();
    FictionModule.render();
    NarrativeModule.render();
    ChallengesModule.render();
    RulesetModule.render();
    HubModule.render();
  }

  function initChrome() {
    document.getElementById('world-settings-btn').addEventListener('click', _openSettings);
    document.getElementById('settings-close-btn').addEventListener('click', _closeSettings);
    document.getElementById('settings-backdrop').addEventListener('click', _closeSettings);

    const modelSel = document.getElementById('settings-model');
    modelSel.value = API.getModel();
    modelSel.addEventListener('change', () => {
      API.setModel(modelSel.value);
      _toast('Model updated', null, false);
    });

    const speedSel = document.getElementById('settings-world-speed');
    speedSel.value = String(Storage.get(Storage.KEYS.WORLD)?.speed || 220);
    speedSel.addEventListener('change', () => {
      World.setSpeed(parseInt(speedSel.value));
      _toast('Velocidade atualizada', null, false);
    });

    document.getElementById('settings-key-save').addEventListener('click', () => {
      const val = document.getElementById('settings-api-key').value.trim();
      if (!val) return;
      Storage.set(Storage.KEYS.API_KEY, val);
      document.getElementById('settings-api-key').value = '';
      _closeSettings();
      _toast('API key updated', null, false);
    });

    document.getElementById('export-data-btn').addEventListener('click', () => {
      const data = {};
      const skip = new Set([Storage.KEYS.API_KEY, Storage.KEYS.MODEL]);
      Object.entries(Storage.KEYS).forEach(([, v]) => {
        if (!skip.has(v)) {
          const val = Storage.get(v);
          if (val !== null) data[v] = val;
        }
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `career-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      _toast('Career exported', null, false);
    });

    document.getElementById('import-data-btn').addEventListener('click', () => {
      document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          Object.entries(data).forEach(([k, v]) => Storage.set(k, v));
          _closeSettings();
          _rerenderAll();
          _toast('Career imported successfully', null, false);
        } catch {
          _toast('Invalid career file.', null, true);
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });

    document.getElementById('clear-data-btn').addEventListener('click', () => {
      Storage.clearAll();
      _closeSettings();
      _rerenderAll();
      _toast('All save data cleared', null, false);
    });

    ChatModule.init();
  }

  return {
    navigate,
    setMode,
    initChrome,
    showToast: (m, undoFn) => _toast(m, undoFn, false),
    showError: m => _toast(m, null, true),
  };
})();
