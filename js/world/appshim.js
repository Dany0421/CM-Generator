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

  return {
    navigate,
    setMode,
    showToast: (m, undoFn) => _toast(m, undoFn, false),
    showError: m => _toast(m, null, true),
  };
})();
