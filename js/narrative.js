const NarrativeModule = (() => {
  let _container = null;

  const SECTIONS_TEAM = [
    { key: 'manager_backstory', label: 'Manager Backstory',  icon: 'user-round' },
    { key: 'club_situation',    label: 'Club Situation',     icon: 'building-2' },
    { key: 'season_framing',    label: 'Season Framing',     icon: 'flag' },
  ];

  const SECTIONS_PLAYER = [
    { key: 'manager_backstory', label: 'Player Backstory',  icon: 'user-round' },
    { key: 'club_situation',    label: 'Club Context',       icon: 'building-2' },
    { key: 'season_framing',    label: 'Season Arc',         icon: 'flag' },
  ];

  function _getSections() {
    const mode = Storage.get(Storage.KEYS.SETUP)?.mode;
    return (mode === 'player' || mode === 'fiction') ? SECTIONS_PLAYER : SECTIONS_TEAM;
  }

  function init(container) {
    _container = container;
    render();
  }

  function render() {
    _container.replaceChildren();

    const header = _buildHeader();
    _container.appendChild(header);

    const data = Storage.get(Storage.KEYS.NARRATIVE);
    const setup = Storage.get(Storage.KEYS.SETUP);

    if (!data) {
      _container.appendChild(_buildEmpty(!!setup));
    } else {
      _container.appendChild(_buildContent(data));
    }

    lucide.createIcons();
  }

  function _buildHeader() {
    const frag = document.createRange().createContextualFragment(`
      <div class="module-header">
        <div class="module-title-group">
          <span class="module-label">Module 2</span>
          <h1 class="module-title">Narrative</h1>
        </div>
        <div class="module-actions">
          <button class="btn-secondary" id="narrative-regen-all">
            <i data-lucide="refresh-cw"></i>
            Regenerate
          </button>
        </div>
      </div>
    `);

    frag.querySelector('#narrative-regen-all').addEventListener('click', _generateAll);
    return frag;
  }

  function _buildEmpty(hasSetup) {
    const wrap = document.createElement('div');
    wrap.className = 'card narrative-empty';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'book-open');
    wrap.appendChild(icon);

    const p = document.createElement('p');
    if (hasSetup) {
      p.textContent = 'No narrative generated yet. Generate a backstory, club situation, season framing, and key events for your save.';
    } else {
      p.textContent = 'Fill in your Save Setup first — the narrative engine uses your club, league, and era to generate something specific.';
    }
    wrap.appendChild(p);

    if (hasSetup) {
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      const i = document.createElement('i');
      i.setAttribute('data-lucide', 'sparkles');
      btn.appendChild(i);
      btn.appendChild(document.createTextNode(' Generate Narrative'));
      btn.addEventListener('click', _generateAll);
      wrap.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn-secondary';
      btn.textContent = 'Go to Setup';
      btn.addEventListener('click', () => App.navigate('setup'));
      wrap.appendChild(btn);
    }

    return wrap;
  }

  function _buildContent(data) {
    const frag = document.createDocumentFragment();

    // Named text sections
    _getSections().forEach(({ key, label, icon }) => {
      const card = _buildSectionCard(key, label, icon, data[key] || '');
      frag.appendChild(card);
    });

    // Narrative events
    const eventsCard = _buildEventsCard(data.narrative_events || []);
    frag.appendChild(eventsCard);

    return frag;
  }

  function _buildSectionCard(key, label, iconName, text) {
    const card = document.createElement('div');
    card.className = 'card narrative-section';
    card.dataset.sectionKey = key;

    // Header
    const headerEl = document.createElement('div');
    headerEl.className = 'narrative-section-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'narrative-section-title';
    titleEl.textContent = label;
    headerEl.appendChild(titleEl);

    const regenBtn = document.createElement('button');
    regenBtn.className = 'icon-btn';
    regenBtn.title = 'Regenerate ' + label;
    const regenIcon = document.createElement('i');
    regenIcon.setAttribute('data-lucide', 'refresh-cw');
    regenBtn.appendChild(regenIcon);
    regenBtn.addEventListener('click', () => _regenerateSection(key));
    headerEl.appendChild(regenBtn);

    card.appendChild(headerEl);

    // Content area
    const contentEl = document.createElement('div');
    contentEl.className = 'narrative-section-content';
    _setSectionText(contentEl, text, key);
    card.appendChild(contentEl);

    return card;
  }

  function _buildEventsCard(events) {
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'narrative-events-card';

    const headerEl = document.createElement('div');
    headerEl.className = 'card-header';
    const titleEl = document.createElement('span');
    titleEl.className = 'card-title';
    titleEl.textContent = 'Narrative Events';
    headerEl.appendChild(titleEl);
    card.appendChild(headerEl);

    const grid = document.createElement('div');
    grid.className = 'narrative-events-grid';

    [0, 1].forEach(i => {
      const eventEl = _buildEventItem(i, events[i] || '');
      grid.appendChild(eventEl);
    });

    card.appendChild(grid);
    return card;
  }

  function _buildEventItem(index, text) {
    const item = document.createElement('div');
    item.className = 'narrative-event-item';
    item.dataset.eventIndex = index;

    const header = document.createElement('div');
    header.className = 'narrative-event-header';

    const label = document.createElement('span');
    label.className = 'event-index-label';
    label.textContent = `Event ${index + 1}`;
    header.appendChild(label);

    const regenBtn = document.createElement('button');
    regenBtn.className = 'icon-btn';
    regenBtn.title = `Regenerate Event ${index + 1}`;
    const regenIcon = document.createElement('i');
    regenIcon.setAttribute('data-lucide', 'refresh-cw');
    regenBtn.appendChild(regenIcon);
    regenBtn.addEventListener('click', () => _regenerateEvent(index));
    header.appendChild(regenBtn);

    item.appendChild(header);

    const contentEl = document.createElement('div');
    contentEl.className = 'event-content';
    _setSectionText(contentEl, text, null, index);
    item.appendChild(contentEl);

    return item;
  }

  function _setSectionText(el, text, storageKey, eventIndex) {
    el.replaceChildren();
    if (!text) {
      const p = document.createElement('p');
      p.className = 'narrative-text';
      p.style.color = 'var(--text-muted)';
      p.style.fontStyle = 'italic';
      p.textContent = 'Not generated yet.';
      el.appendChild(p);
      return;
    }

    const p = document.createElement('p');
    p.className = 'narrative-text narrative-text-editable';
    p.title = 'Tap to edit';
    p.textContent = text;

    const textarea = document.createElement('textarea');
    textarea.className = 'narrative-edit-input';
    textarea.value = text;

    p.addEventListener('click', () => {
      p.classList.add('hidden');
      textarea.classList.add('visible');
      textarea.style.height = textarea.scrollHeight + 'px';
      textarea.focus();
      textarea.select();
    });

    const commit = () => {
      const val = textarea.value.trim() || text;
      p.textContent = val;
      p.classList.remove('hidden');
      textarea.classList.remove('visible');
      if (!storageKey) return;
      const saved = Storage.get(Storage.KEYS.NARRATIVE) || {};
      if (eventIndex != null) {
        const events = saved.narrative_events || [];
        events[eventIndex] = val;
        saved.narrative_events = events;
      } else {
        saved[storageKey] = val;
      }
      Storage.set(Storage.KEYS.NARRATIVE, saved);
    };

    textarea.addEventListener('blur', commit);
    textarea.addEventListener('keydown', e => {
      if (e.key === 'Escape') { p.classList.remove('hidden'); textarea.classList.remove('visible'); }
    });

    el.appendChild(p);
    el.appendChild(textarea);
  }

  function _setLoading(contentEl) {
    contentEl.replaceChildren();
    const loadEl = document.createElement('div');
    loadEl.className = 'section-loading';
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    const txt = document.createElement('span');
    txt.textContent = 'Generating…';
    loadEl.appendChild(spinner);
    loadEl.appendChild(txt);
    contentEl.appendChild(loadEl);
  }

  function _setError(contentEl, message) {
    contentEl.replaceChildren();
    const errEl = document.createElement('div');
    errEl.className = 'error-banner';
    const i = document.createElement('i');
    i.setAttribute('data-lucide', 'alert-circle');
    errEl.appendChild(i);
    const txt = document.createElement('span');
    txt.textContent = message;
    errEl.appendChild(txt);
    contentEl.appendChild(errEl);
    lucide.createIcons();
  }

  // ── API Calls ────────────────────────────────────────────────

  async function _generateAll() {
    const setup = Storage.get(Storage.KEYS.SETUP);
    if (!setup || !setup.club) {
      App.showError('Fill in your Save Setup first.');
      return;
    }

    // Re-render shell with loading states if needed
    const existing = Storage.get(Storage.KEYS.NARRATIVE);
    const prevData = existing;

    // Show loading in all sections
    if (!_container.querySelector('.narrative-section')) {
      // First time — render empty structure with loaders
      _container.replaceChildren();
      _container.appendChild(_buildHeader());

      const tempFrag = document.createDocumentFragment();
      _getSections().forEach(({ key, label, icon }) => {
        const card = _buildSectionCard(key, label, icon, '');
        tempFrag.appendChild(card);
      });
      tempFrag.appendChild(_buildEventsCard([]));
      _container.appendChild(tempFrag);
      lucide.createIcons();
    }

    // Set all content areas to loading
    _getSections().forEach(({ key }) => {
      const card = _container.querySelector(`[data-section-key="${key}"]`);
      if (card) _setLoading(card.querySelector('.narrative-section-content'));
    });

    const eventsCard = _container.querySelector('#narrative-events-card');
    if (eventsCard) {
      [0, 1].forEach(i => {
        const item = eventsCard.querySelector(`[data-event-index="${i}"] .event-content`);
        if (item) _setLoading(item);
      });
    }

    // Disable regen button
    const regenBtn = _container.querySelector('#narrative-regen-all');
    if (regenBtn) regenBtn.disabled = true;

    try {
      const data = await API.generateNarrative(null);

      const undoFn = Storage.saveWithUndo(Storage.KEYS.NARRATIVE, data);

      // Update UI
      _getSections().forEach(({ key }) => {
        const card = _container.querySelector(`[data-section-key="${key}"]`);
        if (card) _setSectionText(card.querySelector('.narrative-section-content'), data[key] || '');
      });

      if (eventsCard && data.narrative_events) {
        [0, 1].forEach(i => {
          const item = eventsCard.querySelector(`[data-event-index="${i}"] .event-content`);
          if (item) _setSectionText(item, data.narrative_events[i] || '');
        });
      }

      App.showToast('Narrative generated', prevData ? () => { undoFn(); render(); } : null);

    } catch (err) {
      _getSections().forEach(({ key }) => {
        const card = _container.querySelector(`[data-section-key="${key}"]`);
        if (card) _setError(card.querySelector('.narrative-section-content'), err.message);
      });
      App.showError(err.message);
    } finally {
      if (regenBtn) regenBtn.disabled = false;
    }
  }

  async function _regenerateSection(key) {
    const card = _container.querySelector(`[data-section-key="${key}"]`);
    if (!card) return;
    const contentEl = card.querySelector('.narrative-section-content');
    const regenBtn  = card.querySelector('.icon-btn');

    _setLoading(contentEl);
    if (regenBtn) regenBtn.disabled = true;

    const prevData = Storage.get(Storage.KEYS.NARRATIVE);

    try {
      const data = await API.generateNarrative(key);
      const merged = { ...(prevData || {}), [key]: data[key] };
      const undoFn = Storage.saveWithUndo(Storage.KEYS.NARRATIVE, merged);

      _setSectionText(contentEl, data[key] || '');

      const sectionLabel = _getSections().find(s => s.key === key)?.label || key;
      App.showToast(`${sectionLabel} regenerated`, () => {
        undoFn();
        _setSectionText(contentEl, prevData?.[key] || '');
      });

    } catch (err) {
      _setError(contentEl, err.message);
      App.showError(err.message);
    } finally {
      if (regenBtn) regenBtn.disabled = false;
    }
  }

  async function _regenerateEvent(index) {
    const eventsCard = _container.querySelector('#narrative-events-card');
    if (!eventsCard) return;
    const item    = eventsCard.querySelector(`[data-event-index="${index}"]`);
    const content = item?.querySelector('.event-content');
    const btn     = item?.querySelector('.icon-btn');

    if (!content) return;
    _setLoading(content);
    if (btn) btn.disabled = true;

    const prevData = Storage.get(Storage.KEYS.NARRATIVE);

    try {
      const data = await API.generateNarrativeEvent(index);
      const merged = { ...(prevData || {}), narrative_events: [...((prevData || {}).narrative_events || ['', ''])] };
      merged.narrative_events[index] = data.narrative_events?.[index] || '';
      const undoFn = Storage.saveWithUndo(Storage.KEYS.NARRATIVE, merged);

      _setSectionText(content, merged.narrative_events[index]);

      App.showToast(`Event ${index + 1} regenerated`, () => {
        undoFn();
        _setSectionText(content, prevData?.narrative_events?.[index] || '');
      });

    } catch (err) {
      _setError(content, err.message);
      App.showError(err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  return { init, render };
})();
