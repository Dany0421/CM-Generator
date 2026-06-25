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

    // Scroll to top on navigation
    document.getElementById('app-main').scrollTop = 0;
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

    // Settings: update key
    document.getElementById('settings-key-save').addEventListener('click', () => {
      const val = document.getElementById('settings-api-key').value.trim();
      if (!val) return;
      Storage.set(Storage.KEYS.API_KEY, val);
      document.getElementById('settings-api-key').value = '';
      closeSettings();
      showToast('API key updated');
    });

    // Settings: clear data
    document.getElementById('clear-data-btn').addEventListener('click', () => {
      Storage.clearAll();
      closeSettings();
      // Re-render all modules
      SetupModule.render();
      NarrativeModule.render();
      ChallengesModule.render();
      RulesetModule.render();
      HubModule.render();
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
    NarrativeModule.init(document.getElementById('module-narrative'));
    ChallengesModule.init(document.getElementById('module-challenges'));
    RulesetModule.init(document.getElementById('module-ruleset'));
    HubModule.init(document.getElementById('module-hub'));

    lucide.createIcons();
  }

  return { init, navigate, showToast, showError };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
