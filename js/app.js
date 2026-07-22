const App = (() => {
  let _activeModule = 'setup';

  // ── Navigation ──────────────────────────────────────────────
  function navigate(name) {
    if (name === _activeModule) return;
    _activeModule = name;

    document.querySelectorAll('.module-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    const panel = document.getElementById(`module-${name}`);
    if (panel) panel.classList.add('active');

    document.querySelectorAll(`.nav-tab[data-module="${name}"]`).forEach(t => t.classList.add('active'));

    if (name === 'fiction') FictionModule.render();
    if (name === 'hub') HubModule.render();

    // Scroll to top on navigation
    document.getElementById('app-main').scrollTop = 0;
  }

  function setMode(mode) {
    const fictionTab = document.querySelector('.nav-tab-fiction');
    if (!fictionTab) return;

    const statsCard = !!Storage.get(Storage.KEYS.SETUP)?.player?.statsCard;
    if (mode === 'fiction' || (mode === 'player' && statsCard)) {
      fictionTab.classList.remove('hidden');
    } else {
      fictionTab.classList.add('hidden');
      // If currently on fiction tab, navigate away
      if (_activeModule === 'fiction') navigate('setup');
    }
  }

  // ── Toast ────────────────────────────────────────────────────
  let _toastId = 0;

  function showToast(message, undoFn) {
    const container = document.getElementById('toast-container');
    const id = ++_toastId;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.dataset.id = id;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    const iconEl = document.createElement('i');
    iconEl.setAttribute('data-lucide', 'check-circle-2');
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
      undoBtn.addEventListener('click', () => {
        undoFn();
        removeToast(id);
      });
      toast.appendChild(undoBtn);
    }

    const progress = document.createElement('div');
    progress.className = 'toast-progress';
    toast.appendChild(progress);

    container.appendChild(toast);
    lucide.createIcons();

    const timer = setTimeout(() => removeToast(id), 5000);
    toast._timer = timer;

    return id;
  }

  function removeToast(id) {
    const container = document.getElementById('toast-container');
    const toast = container.querySelector(`[data-id="${id}"]`);
    if (!toast) return;
    clearTimeout(toast._timer);
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 200);
  }

  function showError(message) {
    const container = document.getElementById('toast-container');
    const id = ++_toastId;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.dataset.id = id;
    toast.style.borderColor = 'rgba(239,68,68,.35)';

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.style.color = 'var(--red)';
    const iconEl = document.createElement('i');
    iconEl.setAttribute('data-lucide', 'alert-circle');
    icon.appendChild(iconEl);
    toast.appendChild(icon);

    const msg = document.createElement('span');
    msg.className = 'toast-message';
    msg.textContent = message;
    toast.appendChild(msg);

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => removeToast(id), 6000);
    return id;
  }

  // ── Settings Modal ───────────────────────────────────────────
  function openSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.remove('hidden');
  }

  function closeSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.add('hidden');
  }

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    const hasKey = !!API.getKey();

    if (hasKey) {
      showMainApp();
    } else {
      showKeySetup();
    }

    // API key setup
    document.getElementById('api-key-save-btn').addEventListener('click', () => {
      const val = document.getElementById('api-key-input').value.trim();
      if (!val) return;
      Storage.set(Storage.KEYS.API_KEY, val);
      showMainApp();
    });

    document.getElementById('api-key-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('api-key-save-btn').click();
    });

    // Navigation
    document.getElementById('bottom-nav').addEventListener('click', e => {
      const tab = e.target.closest('.nav-tab');
      if (tab) navigate(tab.dataset.module);
    });

    // Settings open/close
    document.getElementById('open-settings-btn').addEventListener('click', openSettings);
    document.getElementById('settings-close-btn').addEventListener('click', closeSettings);
    document.getElementById('settings-backdrop').addEventListener('click', closeSettings);

    // Settings: model selection
    const modelSel = document.getElementById('settings-model');
    modelSel.value = API.getModel();
    modelSel.addEventListener('change', () => {
      API.setModel(modelSel.value);
      showToast('Model updated');
    });

    // Settings: update key
    document.getElementById('settings-key-save').addEventListener('click', () => {
      const val = document.getElementById('settings-api-key').value.trim();
      if (!val) return;
      Storage.set(Storage.KEYS.API_KEY, val);
      document.getElementById('settings-api-key').value = '';
      closeSettings();
      showToast('API key updated');
    });

    // Settings: export career
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
      a.download = `career-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Career exported');
    });

    // Settings: import career
    document.getElementById('import-data-btn').addEventListener('click', () => {
      document.getElementById('import-file-input').click();
    });

    document.getElementById('import-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          Object.entries(data).forEach(([k, v]) => Storage.set(k, v));
          closeSettings();
          SetupModule.render();
          FictionModule.render();
          NarrativeModule.render();
          ChallengesModule.render();
          RulesetModule.render();
          HubModule.render();
          const mode = Storage.get(Storage.KEYS.SETUP)?.mode || 'team';
          setMode(mode);
          showToast('Career imported successfully');
        } catch {
          showError('Invalid career file.');
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });

    // Settings: clear data
    document.getElementById('clear-data-btn').addEventListener('click', () => {
      Storage.clearAll();
      closeSettings();
      // Re-render all modules
      SetupModule.render();
      FictionModule.render();
      NarrativeModule.render();
      ChallengesModule.render();
      RulesetModule.render();
      HubModule.render();
      setMode('team');
      showToast('All save data cleared');
    });
  }

  function showKeySetup() {
    document.getElementById('api-setup-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
    lucide.createIcons();
  }

  function showMainApp() {
    document.getElementById('api-setup-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    // Init all modules
    SetupModule.init(document.getElementById('module-setup'));
    FictionModule.init(document.getElementById('module-fiction'));
    NarrativeModule.init(document.getElementById('module-narrative'));
    ChallengesModule.init(document.getElementById('module-challenges'));
    RulesetModule.init(document.getElementById('module-ruleset'));
    HubModule.init(document.getElementById('module-hub'));
    ChatModule.init();

    // Show fiction tab if already in fiction mode
    const savedMode = Storage.get(Storage.KEYS.SETUP)?.mode;
    if (savedMode) setMode(savedMode);

    lucide.createIcons();
  }

  return { init, navigate, setMode, showToast, showError };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
