const HubModule = (() => {
  let _container = null;
  let _activeTab = 'log';

  const TABS = [
    { key: 'log',      label: 'Season Log'  },
    { key: 'tracker',  label: 'Tracker'     },
    { key: 'rulebook', label: 'Rulebook'    },
    { key: 'events',   label: 'Events'      },
    { key: 'career',   label: 'Career',     playerOnly: true },
    { key: 'players',  label: 'Players'     },
    { key: 'trophies', label: 'Trophies'    },
    { key: 'archive',  label: 'Archive'     },
  ];


  const TROPHY_TYPES = [
    'League Title', 'Domestic Cup', 'Super Cup',
    'Continental Cup', 'Promotion', 'Best Manager Award',
  ];

  const STATUSES   = ['Active', 'Completed', 'Failed', 'Broken'];
  const STATUS_CLS = { Active: 'badge-active', Completed: 'badge-completed', Failed: 'badge-failed', Broken: 'badge-broken' };

  function _getHub() {
    return Storage.get(Storage.KEYS.HUB) || _emptyHub();
  }

  function _emptyHub() {
    return { log: [], tracker: {}, players: [], seasons: [] };
  }

  function _saveHub(data) {
    Storage.set(Storage.KEYS.HUB, data);
  }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function _formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Init / Render ────────────────────────────────────────────

  function init(container) {
    _container = container;
    render();
  }

  function render() {
    _ensureCurrentSeasonEntry();
    _container.replaceChildren();
    _container.appendChild(_buildHeader());
    _container.appendChild(_buildTabs());
    _container.appendChild(_buildSections());
    _showTab(_activeTab);
    lucide.createIcons();
  }

  function _ensureCurrentSeasonEntry() {
    const setup  = Storage.get(Storage.KEYS.SETUP);
    const season = setup?.season || 1;
    const hub    = _getHub();
    if (!hub.seasons) hub.seasons = [];
    if (!hub.seasons.some(s => s.season === season)) {
      hub.seasons.unshift({
        id:       _uid(),
        season,
        club:     setup?.club || '',
        trophies: {},
        notes:    '',
        position: null,
      });
      _saveHub(hub);
    }
  }

  function _buildHeader() {
    const setup  = Storage.get(Storage.KEYS.SETUP);
    const season = setup?.season || 1;
    const frag = document.createRange().createContextualFragment(`
      <div class="module-header">
        <div class="module-title-group">
          <span class="module-label">Module 5</span>
          <h1 class="module-title">Season Hub</h1>
        </div>
        <span class="season-badge">Season ${season}</span>
      </div>
    `);
    return frag;
  }

  function _isPlayerMode() {
    const mode = Storage.get(Storage.KEYS.SETUP)?.mode;
    return mode === 'player' || mode === 'fiction';
  }

  function _buildTabs() {
    const isPlayer = _isPlayerMode();
    const nav = document.createElement('div');
    nav.className = 'hub-tabs';
    nav.id = 'hub-tab-nav';

    TABS.forEach(({ key, label, playerOnly }) => {
      if (playerOnly && !isPlayer) return;
      const btn = document.createElement('button');
      btn.className = 'hub-tab-btn';
      btn.dataset.tab = key;
      btn.textContent = label;
      btn.addEventListener('click', () => _showTab(key));
      nav.appendChild(btn);
    });

    return nav;
  }

  function _buildSections() {
    const isPlayer = _isPlayerMode();
    const wrap = document.createElement('div');
    wrap.id = 'hub-sections';

    TABS.forEach(({ key, playerOnly }) => {
      if (playerOnly && !isPlayer) return;
      const section = document.createElement('div');
      section.className = 'hub-section';
      section.id = `hub-section-${key}`;
      section.appendChild(_buildSectionContent(key));
      wrap.appendChild(section);
    });

    return wrap;
  }

  function _buildSectionContent(key) {
    switch (key) {
      case 'log':      return _buildLog();
      case 'tracker':  return _buildTracker();
      case 'rulebook': return _buildRulebook();
      case 'events':   return _buildEvents();
      case 'career':   return _buildCareer();
      case 'players':  return _buildPlayers();
      case 'trophies': return _buildTrophies();
      case 'archive':  return _buildArchive();
      default:         return document.createDocumentFragment();
    }
  }

  function _showTab(key) {
    _activeTab = key;

    // These tabs read from external storage — rebuild on every visit
    if (key === 'tracker' || key === 'rulebook' || key === 'events' || key === 'career') {
      const section = _container.querySelector(`#hub-section-${key}`);
      if (section) {
        section.replaceChildren();
        section.appendChild(
          key === 'tracker'  ? _buildTracker()  :
          key === 'rulebook' ? _buildRulebook() :
          key === 'career'   ? _buildCareer()   :
          _buildEvents()
        );
        lucide.createIcons();
      }
    }

    _container.querySelectorAll('.hub-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === key);
    });
    _container.querySelectorAll('.hub-section').forEach(section => {
      section.classList.toggle('active', section.id === `hub-section-${key}`);
    });
  }

  // ── Season Log ───────────────────────────────────────────────

  function _buildLog() {
    const wrap  = document.createElement('div');
    const hub   = _getHub();
    const log   = hub.log || [];
    const setup = Storage.get(Storage.KEYS.SETUP);
    const season = setup?.season || 1;

    // Season row — label + end season button
    const seasonRow = document.createElement('div');
    seasonRow.className = 'log-season-row';
    const seasonLbl = document.createElement('span');
    seasonLbl.className = 'log-season-label';
    seasonLbl.textContent = `Season ${season}`;
    seasonRow.appendChild(seasonLbl);
    if (season < 15) {
      const endBtn = document.createElement('button');
      endBtn.className = 'btn-ghost log-end-season-btn';
      endBtn.id = 'end-season-btn';
      endBtn.textContent = 'End Season →';
      endBtn.addEventListener('click', () => _showEndSeasonPanel(wrap, season));
      seasonRow.appendChild(endBtn);
    }
    wrap.appendChild(seasonRow);

    // End season panel container (empty until triggered)
    const panelWrap = document.createElement('div');
    panelWrap.id = 'end-season-panel-wrap';
    wrap.appendChild(panelWrap);

    // Add entry area
    const addArea = document.createElement('div');
    addArea.className = 'card log-add-area';

    // Date row: day + month
    const dateRow = document.createElement('div');
    dateRow.className = 'log-date-row';

    const dayInput = document.createElement('input');
    dayInput.type = 'number';
    dayInput.min = '1';
    dayInput.max = '31';
    dayInput.className = 'form-input log-day-input';
    dayInput.placeholder = 'Day';

    const monthSel = document.createElement('select');
    monthSel.className = 'form-select log-month-select';
    ['-','January','February','March','April','May','June','July','August','September','October','November','December'].forEach((m, i) => {
      const o = document.createElement('option');
      o.value = i === 0 ? '' : m;
      o.textContent = m === '-' ? 'Month' : m;
      monthSel.appendChild(o);
    });

    dateRow.appendChild(dayInput);
    dateRow.appendChild(monthSel);
    addArea.appendChild(dateRow);

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Write a match result, transfer note, key moment…';
    addArea.appendChild(textarea);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-primary';
    const saveIcon = document.createElement('i');
    saveIcon.setAttribute('data-lucide', 'plus');
    saveBtn.appendChild(saveIcon);
    saveBtn.appendChild(document.createTextNode(' Add Entry'));
    saveBtn.addEventListener('click', () => {
      const text  = textarea.value.trim();
      const day   = parseInt(dayInput.value);
      const month = monthSel.value;
      if (!day || !month) { App.showError('Pick a day and month for this entry.'); return; }
      if (!text) { App.showError('Write something before adding an entry.'); return; }
      _addLogEntry(text, day, month);
      textarea.value  = '';
      dayInput.value  = '';
      monthSel.value  = '';
      _refreshLog();
    });
    addArea.appendChild(saveBtn);
    wrap.appendChild(addArea);

    // Entries
    const entriesWrap = document.createElement('div');
    entriesWrap.id = 'log-entries';
    wrap.appendChild(entriesWrap);
    _renderLogEntries(entriesWrap, log);

    return wrap;
  }

  function _renderLogEntries(container, log) {
    container.replaceChildren();

    if (log.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'log-empty';
      empty.textContent = 'No log entries yet. Start tracking your season.';
      container.appendChild(empty);
      return;
    }

    const sorted = [...log].reverse();
    sorted.forEach(entry => {
      container.appendChild(_buildLogEntry(entry));
    });
  }

  function _buildLogEntry(entry) {
    // Season boundary divider
    if (entry.isDivider) {
      const divider = document.createElement('div');
      divider.className = 'log-divider';
      divider.textContent = entry.text;
      return divider;
    }

    const el = document.createElement('div');
    el.className = 'log-entry card';
    if (entry.highlight) el.classList.add(`log-highlight-${entry.highlight}`);

    const header = document.createElement('div');
    header.className = 'log-entry-header';

    const time = document.createElement('span');
    time.className = 'log-entry-time';
    time.textContent = entry.gameDate
      ? `${entry.gameDate.day} ${entry.gameDate.month}`
      : _formatDate(entry.timestamp);
    header.appendChild(time);

    const actions = document.createElement('div');
    actions.className = 'log-entry-actions';

    // Highlight toggle — cycles: none → yellow → red → none
    const hlBtn = document.createElement('button');
    hlBtn.className = 'icon-btn log-highlight-btn';
    hlBtn.title = 'Highlight';
    const hlIcon = document.createElement('i');
    hlIcon.setAttribute('data-lucide', 'flag');
    if (entry.highlight === 'yellow') hlBtn.classList.add('hl-yellow');
    if (entry.highlight === 'red')    hlBtn.classList.add('hl-red');
    if (entry.highlight === 'green')  hlBtn.classList.add('hl-green');
    hlBtn.appendChild(hlIcon);
    hlBtn.addEventListener('click', () => {
      const next = { undefined: 'yellow', yellow: 'red', red: 'green', green: undefined }[entry.highlight];
      entry.highlight = next;
      _updateLogEntry(entry.id, { highlight: next });
      hlBtn.classList.toggle('hl-yellow', next === 'yellow');
      hlBtn.classList.toggle('hl-red',    next === 'red');
      hlBtn.classList.toggle('hl-green',  next === 'green');
      el.classList.remove('log-highlight-yellow', 'log-highlight-red', 'log-highlight-green');
      if (next) el.classList.add(`log-highlight-${next}`);
    });
    actions.appendChild(hlBtn);

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.title = 'Edit entry';
    const editIcon = document.createElement('i');
    editIcon.setAttribute('data-lucide', 'pencil');
    editBtn.appendChild(editIcon);
    actions.appendChild(editBtn);

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.title = 'Delete entry';
    const delIcon = document.createElement('i');
    delIcon.setAttribute('data-lucide', 'trash-2');
    delBtn.appendChild(delIcon);
    delBtn.addEventListener('click', () => {
      _deleteLogEntry(entry.id);
      _refreshLog();
    });
    actions.appendChild(delBtn);

    header.appendChild(actions);
    el.appendChild(header);

    // Text display
    const textEl = document.createElement('p');
    textEl.className = 'log-entry-text';
    textEl.textContent = entry.text;
    el.appendChild(textEl);

    // Edit textarea (hidden by default)
    const editArea = document.createElement('textarea');
    editArea.className = 'log-edit-textarea';
    editArea.value = entry.text;
    el.appendChild(editArea);

    const commitEdit = () => {
      const val = editArea.value.trim();
      if (val && val !== entry.text) {
        entry.text = val;
        _updateLogEntry(entry.id, { text: val });
        textEl.textContent = val;
      }
      editArea.classList.remove('editing');
      textEl.classList.remove('editing');
      editBtn.title = 'Edit entry';
    };

    editBtn.addEventListener('click', () => {
      const isEditing = editArea.classList.contains('editing');
      if (isEditing) {
        commitEdit();
      } else {
        editArea.classList.add('editing');
        textEl.classList.add('editing');
        editArea.focus();
        editArea.setSelectionRange(editArea.value.length, editArea.value.length);
        editBtn.title = 'Save';
      }
    });

    editArea.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        editArea.value = entry.text;
        editArea.classList.remove('editing');
        textEl.classList.remove('editing');
        editBtn.title = 'Edit entry';
      }
    });
    editArea.addEventListener('blur', commitEdit);

    return el;
  }

  function _buildEvents() {
    const wrap   = document.createElement('div');
    const hub    = _getHub();
    const setup  = Storage.get(Storage.KEYS.SETUP);
    const season = setup?.season || 1;
    const events = hub.events;
    const hasPool = events && events.season === season && (events.pool || []).length > 0;

    if (!hasPool) {
      const card = document.createElement('div');
      card.className = 'card events-empty-card';

      const title = document.createElement('p');
      title.className = 'events-empty-title';
      title.textContent = `No events for Season ${season} yet.`;
      card.appendChild(title);

      const desc = document.createElement('p');
      desc.className = 'events-empty-desc';
      desc.textContent = '10 random events will be generated — one to roll per month. Mix of positive and negative. Roll when you want a shake-up.';
      card.appendChild(desc);

      const genBtn = document.createElement('button');
      genBtn.className = 'btn-primary';
      const genIcon = document.createElement('i');
      genIcon.setAttribute('data-lucide', 'shuffle');
      genBtn.appendChild(genIcon);
      genBtn.appendChild(document.createTextNode(' Generate Season Events'));
      genBtn.addEventListener('click', async () => {
        genBtn.disabled = true;
        genBtn.lastChild.textContent = ' Generating…';
        try {
          await API.generateEvents();
          const section = _container.querySelector('#hub-section-events');
          if (section) {
            section.replaceChildren();
            section.appendChild(_buildEvents());
            lucide.createIcons();
          }
        } catch (err) {
          App.showError(err.message);
          genBtn.disabled = false;
          genBtn.lastChild.textContent = ' Generate Season Events';
        }
      });
      card.appendChild(genBtn);
      wrap.appendChild(card);
      return wrap;
    }

    const pool    = events.pool;
    const rolled  = events.rolled || [];
    const remaining = pool.length - rolled.length;

    // Header: counter + roll button
    const header = document.createElement('div');
    header.className = 'events-header';

    const counter = document.createElement('span');
    counter.className = 'events-counter';
    counter.textContent = `${rolled.length} / ${pool.length} rolled`;
    header.appendChild(counter);

    const rollBtn = document.createElement('button');
    rollBtn.className = 'btn-primary events-roll-btn';
    rollBtn.disabled = remaining === 0;
    const diceIcon = document.createElement('i');
    diceIcon.setAttribute('data-lucide', remaining === 0 ? 'check' : 'dice-5');
    rollBtn.appendChild(diceIcon);
    rollBtn.appendChild(document.createTextNode(remaining === 0 ? ' All Rolled' : ' Roll Event'));
    rollBtn.addEventListener('click', () => {
      const available = pool.map((_, i) => i).filter(i => !rolled.includes(i));
      if (available.length === 0) return;

      // Cap: max 3 consecutive same type
      let eligible = available;
      if (rolled.length >= 3) {
        const last3 = rolled.slice(-3).map(i => pool[i].type);
        if (last3.every(t => t === last3[0])) {
          const filtered = available.filter(i => pool[i].type !== last3[0]);
          if (filtered.length > 0) eligible = filtered;
        }
      }

      const pick = eligible[Math.floor(Math.random() * eligible.length)];
      rolled.push(pick);
      const hubData = _getHub();
      hubData.events.rolled = rolled;
      _saveHub(hubData);
      const section = _container.querySelector('#hub-section-events');
      if (section) {
        section.replaceChildren();
        section.appendChild(_buildEvents());
        lucide.createIcons();
      }
    });
    header.appendChild(rollBtn);
    wrap.appendChild(header);

    if (rolled.length === 0) {
      const hint = document.createElement('p');
      hint.className = 'events-hint';
      hint.textContent = 'Roll one event per month — or whenever you want chaos.';
      wrap.appendChild(hint);
      return wrap;
    }

    // Revealed events (most recent first)
    const list = document.createElement('div');
    list.className = 'events-list';

    [...rolled].reverse().forEach((idx, i) => {
      const ev   = pool[idx];
      const card = document.createElement('div');
      card.className = `card event-card event-${ev.type}`;

      const badge = document.createElement('span');
      badge.className = `event-type-badge event-badge-${ev.type}`;
      badge.textContent = ev.type === 'positive' ? '+ Positive' : '− Negative';
      card.appendChild(badge);

      const text = document.createElement('p');
      text.className = 'event-text';
      text.textContent = ev.text;
      card.appendChild(text);

      const rollNum = document.createElement('span');
      rollNum.className = 'event-roll-num';
      rollNum.textContent = `Roll ${rolled.length - i}`;
      card.appendChild(rollNum);

      list.appendChild(card);
    });

    wrap.appendChild(list);
    return wrap;
  }

  async function _showEndSeasonPanel(wrap, season) {
    const endBtn    = wrap.querySelector('#end-season-btn');
    const panelWrap = wrap.querySelector('#end-season-panel-wrap');
    if (!panelWrap) return;

    // Gate: must have league position filled in Trophies tab
    const hub   = _getHub();
    const entry = (hub.seasons || []).find(s => s.season === season);
    if (!entry?.position) {
      if (endBtn) endBtn.style.display = 'none';
      const gate = document.createElement('div');
      gate.className = 'card end-season-gate';
      const msg = document.createElement('p');
      msg.className = 'end-season-gate-msg';
      msg.textContent = 'Fill in your league position (and any trophies / notes) in the Trophies tab before ending the season — the AI needs your actual results to write the summary.';
      gate.appendChild(msg);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;margin-top:12px;';
      const goBtn = document.createElement('button');
      goBtn.className = 'btn-primary';
      goBtn.textContent = 'Go to Trophies →';
      goBtn.addEventListener('click', () => {
        panelWrap.replaceChildren();
        if (endBtn) endBtn.style.display = '';
        _showTab('trophies');
      });
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn-ghost';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => {
        panelWrap.replaceChildren();
        if (endBtn) endBtn.style.display = '';
      });
      row.appendChild(goBtn);
      row.appendChild(cancelBtn);
      gate.appendChild(row);
      panelWrap.replaceChildren(gate);
      return;
    }

    if (endBtn) endBtn.style.display = 'none';
    panelWrap.replaceChildren(_buildEndSeasonPanel(season));
    lucide.createIcons();

    // Auto-generate summary
    const textarea = panelWrap.querySelector('textarea');
    if (!textarea) return;
    textarea.disabled = true;
    textarea.placeholder = 'Generating season summary…';
    try {
      const result = await API.generateSeasonSummary();
      textarea.value = result.summary || '';
    } catch {
      textarea.placeholder = 'Could not auto-generate — write your own summary.';
    } finally {
      textarea.disabled = false;
    }
  }

  function _buildEndSeasonPanel(season) {
    const panel = document.createElement('div');
    panel.className = 'card end-season-panel';

    const heading = document.createElement('p');
    heading.className = 'end-season-heading';
    heading.textContent = `End Season ${season}`;
    panel.appendChild(heading);

    const desc = document.createElement('p');
    desc.className = 'end-season-desc';
    desc.textContent = 'This summary tells the AI what happened — it avoids repeating narrative arcs and challenge concepts in future seasons.';
    panel.appendChild(desc);

    const textarea = document.createElement('textarea');
    textarea.className = 'end-season-textarea';
    textarea.placeholder = 'Season summary…';
    panel.appendChild(textarea);

    const regenBtn = document.createElement('button');
    regenBtn.className = 'btn-ghost end-season-regen';
    const regenIcon = document.createElement('i');
    regenIcon.setAttribute('data-lucide', 'refresh-cw');
    regenBtn.appendChild(regenIcon);
    regenBtn.appendChild(document.createTextNode(' Regenerate'));
    regenBtn.addEventListener('click', async () => {
      regenBtn.disabled = true;
      textarea.disabled = true;
      textarea.value = '';
      textarea.placeholder = 'Generating…';
      try {
        const result = await API.generateSeasonSummary();
        textarea.value = result.summary || '';
      } catch (err) {
        App.showError(err.message);
      } finally {
        regenBtn.disabled = false;
        textarea.disabled = false;
        textarea.placeholder = 'Season summary…';
      }
    });
    panel.appendChild(regenBtn);

    const actions = document.createElement('div');
    actions.className = 'end-season-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-ghost';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      const panelWrap = panel.closest('#end-season-panel-wrap');
      if (panelWrap) panelWrap.replaceChildren();
      const endBtn = _container.querySelector('#end-season-btn');
      if (endBtn) endBtn.style.display = '';
    });
    actions.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn-primary';
    confirmBtn.textContent = `Confirm → Season ${season + 1}`;
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Saving…';
      API.advanceSeason(textarea.value.trim());
      render();
      // Auto-generate events for the new season in background
      try {
        await API.generateEvents();
        const evSection = _container.querySelector('#hub-section-events');
        if (evSection) {
          evSection.replaceChildren();
          evSection.appendChild(_buildEvents());
          lucide.createIcons();
        }
      } catch { /* silent — user can generate manually from Events tab */ }
    });
    actions.appendChild(confirmBtn);

    panel.appendChild(actions);
    return panel;
  }

  function _addLogEntry(text, day, month) {
    const hub = _getHub();
    hub.log.push({ id: _uid(), text, timestamp: new Date().toISOString(), gameDate: { day, month }, highlight: undefined });
    _saveHub(hub);
  }

  function _updateLogEntry(id, changes) {
    const hub = _getHub();
    const idx = hub.log.findIndex(e => e.id === id);
    if (idx === -1) return;
    Object.assign(hub.log[idx], changes);
    _saveHub(hub);
  }

  function _deleteLogEntry(id) {
    const hub = _getHub();
    hub.log = hub.log.filter(e => e.id !== id);
    _saveHub(hub);
  }

  function _refreshLog() {
    const hub       = _getHub();
    const container = _container.querySelector('#log-entries');
    if (container) {
      _renderLogEntries(container, hub.log);
      lucide.createIcons();
    }
  }

  // ── Quick Reference (Challenges + Ruleset) ──────────────────

  function _buildTracker() {
    const wrap       = document.createElement('div');
    const challenges = Storage.get(Storage.KEYS.CHALLENGES) || [];
    const ruleset    = Storage.get(Storage.KEYS.RULESET);
    const hub        = _getHub();
    const tracker    = hub.tracker || {};

    const hasChallenges = challenges.length > 0;
    const hasRuleset    = ruleset && (
      (ruleset.squad_rules    || []).length > 0 ||
      (ruleset.transfer_rules || []).length > 0 ||
      (ruleset.gameplay_rules || []).length > 0 ||
      Object.values(ruleset.special_mechanics || {}).some(v => v)
    );

    if (!hasChallenges && !hasRuleset) {
      const empty = document.createElement('div');
      empty.className = 'tracker-empty card';
      empty.textContent = 'Nothing here yet. Generate your Challenges and Ruleset first.';

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;justify-content:center;';
      const c = document.createElement('button');
      c.className = 'btn-secondary';
      c.textContent = 'Challenges';
      c.addEventListener('click', () => App.navigate('challenges'));
      const r = document.createElement('button');
      r.className = 'btn-secondary';
      r.textContent = 'Ruleset';
      r.addEventListener('click', () => App.navigate('ruleset'));
      row.appendChild(c);
      row.appendChild(r);
      empty.appendChild(row);
      wrap.appendChild(empty);
      return wrap;
    }

    // Condense banner if any challenge is missing hub_line
    if (hasChallenges && challenges.some(ch => !ch.hub_line)) {
      wrap.appendChild(_buildCondenseBanner());
    }

    // ── Challenges section ──
    if (hasChallenges) {
      wrap.appendChild(_buildRefSection('Challenges', () => App.navigate('challenges'), () => {
        const list = document.createElement('div');
        list.className = 'hub-ref-challenges';
        challenges.forEach((ch, i) => {
          const status = tracker[i] || 'Active';
          list.appendChild(_buildChallengeRef(ch, i, status));
        });
        return list;
      }));
    }

    return wrap;
  }

  function _buildRulebook() {
    const wrap    = document.createElement('div');
    const ruleset = Storage.get(Storage.KEYS.RULESET);

    const hasRuleset = ruleset && (
      (ruleset.squad_rules    || []).length > 0 ||
      (ruleset.transfer_rules || []).length > 0 ||
      (ruleset.gameplay_rules || []).length > 0 ||
      Object.values(ruleset.special_mechanics || {}).some(v => v)
    );

    if (!hasRuleset) {
      const empty = document.createElement('div');
      empty.className = 'tracker-empty card';
      empty.textContent = 'No ruleset yet.';
      const btn = document.createElement('button');
      btn.className = 'btn-secondary';
      btn.style.marginTop = '12px';
      btn.textContent = 'Go to Ruleset';
      btn.addEventListener('click', () => App.navigate('ruleset'));
      empty.appendChild(btn);
      wrap.appendChild(empty);
      return wrap;
    }

    if (!ruleset.hub_summary) {
      wrap.appendChild(_buildCondenseBanner());
    }

    wrap.appendChild(_buildRefSection('Ruleset', () => App.navigate('ruleset'), () => {
      const inner   = document.createElement('div');
      const summary = ruleset.hub_summary || {};

      const RULE_GROUPS = [
        { key: 'squad_rules',    label: 'Squad'    },
        { key: 'transfer_rules', label: 'Transfer' },
        { key: 'gameplay_rules', label: 'Gameplay' },
      ];

      RULE_GROUPS.forEach(({ key, label }) => {
        const fullRules      = (ruleset[key] || []).filter(Boolean);
        const condensedRules = summary[key] || [];
        if (fullRules.length === 0) return;

        const group = document.createElement('div');
        group.className = 'hub-rules-group';

        const lbl = document.createElement('div');
        lbl.className = 'hub-rules-label';
        lbl.textContent = label;
        group.appendChild(lbl);

        fullRules.forEach((r, i) => {
          const item = document.createElement('div');
          item.className = 'hub-rule-item';
          const dot = document.createElement('span');
          dot.className = 'hub-rule-dot';
          dot.textContent = '•';
          item.appendChild(dot);
          const txt = document.createElement('span');
          txt.textContent = condensedRules[i] || r;
          item.appendChild(txt);
          group.appendChild(item);
        });

        inner.appendChild(group);
      });

      const mechanics  = ruleset.special_mechanics || {};
      const isPlayerMode = _isPlayerMode();
      const MECH_KEYS  = isPlayerMode
        ? ['chaos_wheel']
        : ['chaos_wheel', 'protected_player', 'academy_tracker'];
      const MECH_NAMES = { chaos_wheel: 'Chaos Wheel', protected_player: 'Protected Player', academy_tracker: 'Academy Tracker' };
      const mechEntries = MECH_KEYS.filter(k => mechanics[k]);
      if (mechEntries.length > 0) {
        const group = document.createElement('div');
        group.className = 'hub-rules-group';

        const lbl = document.createElement('div');
        lbl.className = 'hub-rules-label';
        lbl.textContent = 'Special Mechanics';
        group.appendChild(lbl);

        mechEntries.forEach(key => {
          const item = document.createElement('div');
          item.className = 'hub-mechanic-ref';
          const name = document.createElement('span');
          name.className = 'hub-mechanic-name';
          name.textContent = MECH_NAMES[key];
          item.appendChild(name);
          const txt = document.createElement('span');
          txt.className = 'hub-mechanic-val';
          txt.textContent = summary[key] || mechanics[key];
          item.appendChild(txt);
          group.appendChild(item);
        });

        inner.appendChild(group);
      }

      return inner;
    }));

    return wrap;
  }

  function _buildCondenseBanner() {
    const banner = document.createElement('div');
    banner.className = 'card hub-condense-banner';

    const text = document.createElement('span');
    text.className = 'hub-condense-text';
    text.textContent = 'Condense with AI for a shorter, cleaner view';
    banner.appendChild(text);

    const btn = document.createElement('button');
    btn.className = 'btn-secondary hub-condense-btn';
    btn.textContent = 'Condense';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Condensing…';
      try {
        await API.condenseHubData();
        // Rebuild both sections so banners disappear in both
        ['tracker', 'rulebook'].forEach(key => {
          const section = _container.querySelector(`#hub-section-${key}`);
          if (section) {
            section.replaceChildren();
            section.appendChild(key === 'tracker' ? _buildTracker() : _buildRulebook());
          }
        });
        lucide.createIcons();
      } catch (err) {
        App.showError(err.message);
        btn.disabled = false;
        btn.textContent = 'Condense';
      }
    });
    banner.appendChild(btn);

    return banner;
  }

  function _buildRefSection(title, onNavigate, buildContent) {
    const card = document.createElement('div');
    card.className = 'card hub-ref-card';

    const header = document.createElement('div');
    header.className = 'hub-ref-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'hub-ref-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    const link = document.createElement('button');
    link.className = 'hub-ref-link';
    link.textContent = 'View full →';
    link.addEventListener('click', onNavigate);
    header.appendChild(link);

    card.appendChild(header);
    card.appendChild(buildContent());
    return card;
  }

  function _buildChallengeRef(ch, index, status) {
    const item = document.createElement('div');
    item.className = 'hub-challenge-ref';

    const desc = document.createElement('p');
    desc.className = 'hub-challenge-desc';
    desc.textContent = ch.hub_line || ch.description || ch.title || '';
    item.appendChild(desc);

    const statusBtn = document.createElement('button');
    statusBtn.className = `tracker-status-btn badge ${STATUS_CLS[status] || 'badge-active'}`;
    statusBtn.textContent = status;
    statusBtn.addEventListener('click', () => {
      const next = STATUSES[(STATUSES.indexOf(status) + 1) % STATUSES.length];
      _setTrackerStatus(index, next);
      statusBtn.textContent = next;
      statusBtn.className = `tracker-status-btn badge ${STATUS_CLS[next] || 'badge-active'}`;
      status = next;
    });
    item.appendChild(statusBtn);

    return item;
  }

  function _setTrackerStatus(index, status) {
    const hub = _getHub();
    if (!hub.tracker) hub.tracker = {};
    hub.tracker[index] = status;
    _saveHub(hub);
  }

  // ── Career Moves (player mode only) ─────────────────────────

  const CAREER_MOVE_LABELS = {
    transfer_saga:         'Transfer Saga',
    contract_standoff:     'Contract Standoff',
    manager_conflict:      'Manager Conflict',
    big_club_interest:     'Big Club Interest',
    loan_decision:         'Loan Decision',
    media_storm:           'Media Storm',
  };

  function _getCareerMoves() {
    return _getHub().careerMoves || [];
  }

  function _saveCareerMove(move) {
    const hub = _getHub();
    if (!hub.careerMoves) hub.careerMoves = [];
    hub.careerMoves.push(move);
    _saveHub(hub);
  }

  function _updateCareerMove(id, changes) {
    const hub = _getHub();
    const idx = (hub.careerMoves || []).findIndex(m => m.id === id);
    if (idx === -1) return;
    Object.assign(hub.careerMoves[idx], changes);
    _saveHub(hub);
  }

  function _buildCareer() {
    const setup  = Storage.get(Storage.KEYS.SETUP) || {};
    const moves  = _getCareerMoves();
    const active = moves.filter(m => m.status === 'active');
    const resolved = moves.filter(m => m.status === 'resolved');
    const pending  = moves.filter(m => m.status === 'pending');

    const wrap = document.createElement('div');
    wrap.className = 'career-tab';

    // Header
    const header = document.createElement('div');
    header.className = 'career-header';

    const titleGroup = document.createElement('div');
    const title = document.createElement('h2');
    title.className = 'career-title';
    title.textContent = 'Career Moves';
    const sub = document.createElement('p');
    sub.className = 'career-sub';
    sub.textContent = 'Generate a career-defining situation when the moment feels right. Transfer sagas, contract standoffs, manager conflicts — the arcs that shape this player\'s story.';
    titleGroup.appendChild(title);
    titleGroup.appendChild(sub);
    header.appendChild(titleGroup);

    const genBtn = document.createElement('button');
    genBtn.className = 'btn-primary';
    genBtn.id = 'career-generate-btn';
    const genIcon = document.createElement('i');
    genIcon.setAttribute('data-lucide', 'sparkles');
    genBtn.appendChild(genIcon);
    genBtn.appendChild(document.createTextNode(' Generate Situation'));
    genBtn.addEventListener('click', _generateCareerMove);
    header.appendChild(genBtn);

    wrap.appendChild(header);

    // Mid-season club update card
    wrap.appendChild(_buildClubUpdateCard());

    // Pending card (freshly generated, not yet activated)
    if (pending.length > 0) {
      const p = pending[pending.length - 1];
      wrap.appendChild(_buildPendingCard(p));
    }

    // Active situation
    if (active.length > 0) {
      const sectionLbl = document.createElement('p');
      sectionLbl.className = 'career-section-label';
      sectionLbl.textContent = 'Active Situation';
      wrap.appendChild(sectionLbl);
      active.forEach(m => wrap.appendChild(_buildActiveCard(m)));
    }

    // Resolved history
    if (resolved.length > 0) {
      const sectionLbl = document.createElement('p');
      sectionLbl.className = 'career-section-label';
      sectionLbl.textContent = 'Career History';
      wrap.appendChild(sectionLbl);
      [...resolved].reverse().forEach(m => wrap.appendChild(_buildResolvedCard(m)));
    }

    if (moves.length === 0 && pending.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'card career-empty';
      const emptyIcon = document.createElement('i');
      emptyIcon.setAttribute('data-lucide', 'milestone');
      empty.appendChild(emptyIcon);
      const emptyTxt = document.createElement('p');
      emptyTxt.textContent = 'No career situations yet. Generate one when you feel a major moment coming.';
      empty.appendChild(emptyTxt);
      wrap.appendChild(empty);
    }

    return wrap;
  }

  function _buildPendingCard(move) {
    const card = document.createElement('div');
    card.className = 'card career-pending-card';

    const typeChip = document.createElement('span');
    typeChip.className = 'career-type-chip career-chip-pending';
    typeChip.textContent = CAREER_MOVE_LABELS[move.type] || move.type;
    card.appendChild(typeChip);

    const title = document.createElement('p');
    title.className = 'career-move-title';
    title.textContent = move.title;
    card.appendChild(title);

    const body = document.createElement('div');
    body.className = 'career-move-body';

    const parts = [move.narrative, move.stakes, move.mechanic].filter(Boolean);
    parts.forEach((txt, i) => {
      const p = document.createElement('p');
      p.className = i === 0 ? 'career-move-narrative' : 'career-move-extra';
      p.textContent = txt;
      body.appendChild(p);
    });
    card.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'career-pending-actions';

    const activateBtn = document.createElement('button');
    activateBtn.className = 'btn-primary';
    activateBtn.textContent = 'Activate';
    activateBtn.addEventListener('click', () => {
      _updateCareerMove(move.id, { status: 'active' });
      _refreshCareer();
    });

    const rerollBtn = document.createElement('button');
    rerollBtn.className = 'btn-secondary';
    const ri = document.createElement('i');
    ri.setAttribute('data-lucide', 'shuffle');
    rerollBtn.appendChild(ri);
    rerollBtn.appendChild(document.createTextNode(' Reroll'));
    rerollBtn.addEventListener('click', _generateCareerMove);

    const discardBtn = document.createElement('button');
    discardBtn.className = 'btn-ghost';
    discardBtn.textContent = 'Discard';
    discardBtn.addEventListener('click', () => {
      const hub = _getHub();
      hub.careerMoves = (hub.careerMoves || []).filter(m => m.id !== move.id);
      _saveHub(hub);
      _refreshCareer();
    });

    actions.appendChild(activateBtn);
    actions.appendChild(rerollBtn);
    actions.appendChild(discardBtn);
    card.appendChild(actions);

    return card;
  }

  function _buildActiveCard(move) {
    const card = document.createElement('div');
    card.className = 'card career-active-card';

    const typeChip = document.createElement('span');
    typeChip.className = 'career-type-chip career-chip-active';
    typeChip.textContent = CAREER_MOVE_LABELS[move.type] || move.type;
    card.appendChild(typeChip);

    const title = document.createElement('p');
    title.className = 'career-move-title';
    title.textContent = move.title;
    card.appendChild(title);

    const body = document.createElement('div');
    body.className = 'career-move-body';
    [move.narrative, move.stakes, move.mechanic].filter(Boolean).forEach((txt, i) => {
      const p = document.createElement('p');
      p.className = i === 0 ? 'career-move-narrative' : 'career-move-extra';
      p.textContent = txt;
      body.appendChild(p);
    });
    card.appendChild(body);

    // Resolve section
    const resolveWrap = document.createElement('div');
    resolveWrap.className = 'career-resolve-wrap';
    const resolveLbl = document.createElement('label');
    resolveLbl.className = 'career-stakes-label';
    resolveLbl.textContent = 'Outcome';
    const resolveInput = document.createElement('textarea');
    resolveInput.className = 'career-outcome-input';
    resolveInput.placeholder = 'What happened? Write 1-2 lines…';
    resolveInput.value = move.outcome || '';
    resolveWrap.appendChild(resolveLbl);
    resolveWrap.appendChild(resolveInput);
    card.appendChild(resolveWrap);

    const resolveBtn = document.createElement('button');
    resolveBtn.className = 'btn-primary career-resolve-btn';
    const resolveIcon = document.createElement('i');
    resolveIcon.setAttribute('data-lucide', 'check');
    resolveBtn.appendChild(resolveIcon);
    resolveBtn.appendChild(document.createTextNode(' Mark Resolved'));
    resolveBtn.addEventListener('click', () => {
      const outcome = resolveInput.value.trim();
      if (!outcome) { App.showError('Write the outcome before resolving.'); return; }
      _updateCareerMove(move.id, { status: 'resolved', outcome });
      _refreshCareer();
      App.showToast('Career situation resolved.');
    });
    card.appendChild(resolveBtn);

    return card;
  }

  function _buildResolvedCard(move) {
    const card = document.createElement('div');
    card.className = 'card career-resolved-card';

    const header = document.createElement('div');
    header.className = 'career-resolved-header';

    const left = document.createElement('div');
    const typeChip = document.createElement('span');
    typeChip.className = 'career-type-chip career-chip-resolved';
    typeChip.textContent = CAREER_MOVE_LABELS[move.type] || move.type;
    left.appendChild(typeChip);
    const titleEl = document.createElement('span');
    titleEl.className = 'career-resolved-title';
    titleEl.textContent = move.title;
    left.appendChild(titleEl);
    header.appendChild(left);

    const seasonBadge = document.createElement('span');
    seasonBadge.className = 'career-season-badge';
    seasonBadge.textContent = `S${move.season}`;
    header.appendChild(seasonBadge);

    card.appendChild(header);

    const outcome = document.createElement('p');
    outcome.className = 'career-resolved-outcome';
    outcome.textContent = move.outcome || '—';
    card.appendChild(outcome);

    return card;
  }

  function _buildClubUpdateCard() {
    const setup = Storage.get(Storage.KEYS.SETUP) || {};
    const card  = document.createElement('div');
    card.className = 'card career-club-update';

    const lbl = document.createElement('p');
    lbl.className = 'career-club-update-label';
    lbl.textContent = 'Mid-Season Transfer';
    card.appendChild(lbl);

    const sub = document.createElement('p');
    sub.className = 'career-club-update-sub';
    sub.textContent = `Current club: ${setup.club || '—'} · ${setup.league || '—'}`;
    card.appendChild(sub);

    const fields = document.createElement('div');
    fields.className = 'career-club-fields';

    const clubInput = document.createElement('input');
    clubInput.type = 'text';
    clubInput.className = 'form-input';
    clubInput.placeholder = 'New club';
    clubInput.value = '';

    const leagueInput = document.createElement('input');
    leagueInput.type = 'text';
    leagueInput.className = 'form-input';
    leagueInput.placeholder = 'League (exact FC 25 name)';
    leagueInput.value = '';

    const divInput = document.createElement('input');
    divInput.type = 'text';
    divInput.className = 'form-input';
    divInput.placeholder = 'Division (e.g. 1st Division)';
    divInput.value = '';

    fields.appendChild(clubInput);
    fields.appendChild(leagueInput);
    fields.appendChild(divInput);
    card.appendChild(fields);

    const actions = document.createElement('div');
    actions.className = 'career-club-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-secondary';
    saveBtn.textContent = 'Update Club';
    saveBtn.addEventListener('click', () => {
      const club    = clubInput.value.trim();
      const league  = leagueInput.value.trim();
      const div     = divInput.value.trim();
      if (!club || !league) { App.showError('Fill in club and league.'); return; }
      const s = Storage.get(Storage.KEYS.SETUP) || {};
      s.club     = club;
      s.league   = league;
      s.division = div || s.division;
      Storage.set(Storage.KEYS.SETUP, s);
      sub.textContent = `Current club: ${club} · ${league}`;
      clubInput.value = leagueInput.value = divInput.value = '';
      App.showToast('Club updated.');
    });

    const regenBtn = document.createElement('button');
    regenBtn.className = 'btn-primary';
    const ri = document.createElement('i');
    ri.setAttribute('data-lucide', 'sparkles');
    regenBtn.appendChild(ri);
    regenBtn.appendChild(document.createTextNode(' Regenerate Narrative'));
    regenBtn.addEventListener('click', async () => {
      regenBtn.disabled = true;
      regenBtn.replaceChildren();
      const sp = document.createElement('div');
      sp.className = 'spinner';
      sp.style.cssText = 'width:14px;height:14px;display:inline-block;margin-right:8px;flex-shrink:0;';
      regenBtn.appendChild(sp);
      regenBtn.appendChild(document.createTextNode('Regenerating…'));

      try {
        const current = Storage.get(Storage.KEYS.NARRATIVE) || {};
        const data    = await API.generateNarrativeAfterTransfer();
        Storage.set(Storage.KEYS.NARRATIVE, {
          ...current,
          club_situation: data.club_situation || current.club_situation,
          season_framing: data.season_framing || current.season_framing,
        });
        App.showToast('Narrative updated for new club. Check the Narrative tab.');
      } catch (err) {
        console.error('[Career] Narrative regen failed:', err);
        App.showError(err.message || 'Narrative regeneration failed.');
      } finally {
        regenBtn.disabled = false;
        regenBtn.replaceChildren();
        const i2 = document.createElement('i');
        i2.setAttribute('data-lucide', 'sparkles');
        regenBtn.appendChild(i2);
        regenBtn.appendChild(document.createTextNode(' Regenerate Narrative'));
        lucide.createIcons();
      }
    });

    actions.appendChild(saveBtn);
    actions.appendChild(regenBtn);
    card.appendChild(actions);

    return card;
  }

  async function _generateCareerMove() {
    const setup = Storage.get(Storage.KEYS.SETUP);
    if (!setup?.player?.name) {
      App.showError('Fill in your player details in Setup first.');
      return;
    }

    const btn = _container.querySelector('#career-generate-btn');
    if (btn) {
      btn.disabled = true;
      btn.replaceChildren();
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      spinner.style.cssText = 'width:14px;height:14px;display:inline-block;margin-right:8px;flex-shrink:0;';
      btn.appendChild(spinner);
      btn.appendChild(document.createTextNode('Generating…'));
    }

    try {
      // Remove any existing pending moves first
      const hub = _getHub();
      hub.careerMoves = (hub.careerMoves || []).filter(m => m.status !== 'pending');
      _saveHub(hub);

      const result = await API.generateCareerMove();
      _saveCareerMove({
        id:        _uid(),
        status:    'pending',
        season:    setup.season || 1,
        timestamp: new Date().toISOString(),
        ...result,
      });
      _refreshCareer();
      App.showToast('Career situation generated.');
    } catch (err) {
      App.showError(err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.replaceChildren();
        const i = document.createElement('i');
        i.setAttribute('data-lucide', 'sparkles');
        btn.appendChild(i);
        btn.appendChild(document.createTextNode(' Generate Situation'));
        lucide.createIcons();
      }
    }
  }

  function _refreshCareer() {
    const section = _container.querySelector('#hub-section-career');
    if (!section) return;
    section.replaceChildren();
    section.appendChild(_buildCareer());
    lucide.createIcons();
  }

  // ── Key Players ──────────────────────────────────────────────

  function _buildPlayers() {
    const hub     = _getHub();
    const players = hub.players || [];
    const wrap    = document.createElement('div');

    // Add player button
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-accent-ghost';
    addBtn.style.marginBottom = '14px';
    const addIcon = document.createElement('i');
    addIcon.setAttribute('data-lucide', 'user-plus');
    addBtn.appendChild(addIcon);
    addBtn.appendChild(document.createTextNode(' Add Player'));
    addBtn.addEventListener('click', () => _showAddPlayerForm());
    wrap.appendChild(addBtn);

    // Add form (hidden by default)
    const addForm = _buildAddPlayerForm();
    addForm.id = 'add-player-form';
    wrap.appendChild(addForm);

    // Players grid
    const grid = document.createElement('div');
    grid.className = 'players-grid';
    grid.id = 'players-grid';

    if (players.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'card';
      empty.style.cssText = 'text-align:center;padding:32px;color:var(--text-muted);font-size:.875rem;';
      empty.textContent = 'No players tracked yet. Add key players to follow their journey.';
      grid.appendChild(empty);
    } else {
      const sorted = [...players].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
      sorted.forEach(p => grid.appendChild(_buildPlayerCard(p)));
    }

    wrap.appendChild(grid);
    return wrap;
  }

  function _buildAddPlayerForm() {
    const form = document.createElement('div');
    form.className = 'card add-player-form';

    const row = document.createElement('div');
    row.className = 'form-row two-col';

    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    const nameLabel = document.createElement('label');
    nameLabel.className = 'form-label';
    nameLabel.textContent = 'Player Name';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'form-input';
    nameInput.id = 'new-player-name';
    nameInput.placeholder = 'e.g. João Silva';
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    row.appendChild(nameGroup);

    const roleGroup = document.createElement('div');
    roleGroup.className = 'form-group';
    const roleLabel = document.createElement('label');
    roleLabel.className = 'form-label';
    roleLabel.textContent = 'Role';
    const roleInput = document.createElement('input');
    roleInput.type = 'text';
    roleInput.className = 'form-input';
    roleInput.id = 'new-player-role';
    roleInput.placeholder = 'e.g. Key Man, Captain…';
    roleGroup.appendChild(roleLabel);
    roleGroup.appendChild(roleInput);
    row.appendChild(roleGroup);

    form.appendChild(row);

    const actions = document.createElement('div');
    actions.className = 'add-player-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-ghost';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => form.classList.remove('visible'));
    actions.appendChild(cancelBtn);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-primary';
    saveBtn.textContent = 'Add Player';
    saveBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) return;
      _addPlayer({ id: _uid(), name, role: roleInput.value.trim(), tags: [], entries: [], appearances: 0, pinned: false });
      nameInput.value = '';
      form.classList.remove('visible');
      _refreshPlayers();
    });
    actions.appendChild(saveBtn);

    form.appendChild(actions);
    return form;
  }

  function _showAddPlayerForm() {
    const form = _container.querySelector('#add-player-form');
    if (form) {
      form.classList.add('visible');
      form.querySelector('#new-player-name')?.focus();
    }
  }

  function _buildPlayerCard(player) {
    const card = document.createElement('div');
    card.className = 'player-card' + (player.pinned ? ' player-pinned' : '');
    card.dataset.id = player.id;
    card.addEventListener('click', () => _openPlayerModal(player.id));

    // ── Header ──
    const header = document.createElement('div');
    header.className = 'player-card-header';

    const pinBtn = document.createElement('button');
    pinBtn.className = 'icon-btn player-pin-btn' + (player.pinned ? ' pinned' : '');
    pinBtn.title = player.pinned ? 'Unpin' : 'Pin';
    const pinIcon = document.createElement('i');
    pinIcon.setAttribute('data-lucide', 'pin');
    pinBtn.appendChild(pinIcon);
    pinBtn.addEventListener('click', e => {
      e.stopPropagation();
      _updatePlayer(player.id, { pinned: !player.pinned });
      _refreshPlayers();
    });
    header.appendChild(pinBtn);

    const nameGroup = document.createElement('div');
    nameGroup.className = 'player-name-group';
    const nameEl = document.createElement('div');
    nameEl.className = 'player-name';
    nameEl.textContent = player.name || '';
    nameGroup.appendChild(nameEl);

    // Role — click to edit inline
    const roleEl = document.createElement('span');
    roleEl.className = 'player-role-badge' + (!player.role ? ' player-role-empty' : '');
    roleEl.textContent = player.role || 'Set role';
    roleEl.title = 'Click to edit';
    const roleInputEl = document.createElement('input');
    roleInputEl.type = 'text';
    roleInputEl.className = 'player-role-input';
    roleInputEl.value = player.role || '';
    roleInputEl.placeholder = 'Role…';
    roleInputEl.style.display = 'none';
    const commitRole = () => {
      const val = roleInputEl.value.trim();
      _updatePlayer(player.id, { role: val });
      roleEl.textContent = val || 'Set role';
      roleEl.className = 'player-role-badge' + (!val ? ' player-role-empty' : '');
      roleEl.style.display = '';
      roleInputEl.style.display = 'none';
    };
    roleEl.addEventListener('click', e => {
      e.stopPropagation();
      roleEl.style.display = 'none';
      roleInputEl.style.display = '';
      roleInputEl.focus();
      roleInputEl.select();
    });
    roleInputEl.addEventListener('click', e => e.stopPropagation());
    roleInputEl.addEventListener('blur', commitRole);
    roleInputEl.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') commitRole();
      if (e.key === 'Escape') { roleInputEl.style.display = 'none'; roleEl.style.display = ''; }
    });
    nameGroup.appendChild(roleEl);
    nameGroup.appendChild(roleInputEl);
    header.appendChild(nameGroup);

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.title = 'Remove';
    delBtn.style.color = 'var(--red)';
    const delIcon = document.createElement('i');
    delIcon.setAttribute('data-lucide', 'trash-2');
    delBtn.appendChild(delIcon);
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      _deletePlayer(player.id);
      _refreshPlayers();
    });
    header.appendChild(delBtn);
    card.appendChild(header);

    // ── Tags ──
    const tagsRow = document.createElement('div');
    tagsRow.className = 'player-tags';
    tagsRow.addEventListener('click', e => e.stopPropagation());
    _renderTagChips(tagsRow, player);
    card.appendChild(tagsRow);

    // ── Appearances ──
    const appsRow = document.createElement('div');
    appsRow.className = 'player-appearances';
    const appsLabel = document.createElement('span');
    appsLabel.className = 'player-apps-label';
    appsLabel.textContent = 'Apps';
    const appsInput = document.createElement('input');
    appsInput.type = 'number';
    appsInput.className = 'player-apps-input';
    appsInput.value = player.appearances || 0;
    appsInput.min = '0';
    appsInput.addEventListener('click', e => e.stopPropagation());
    appsInput.addEventListener('change', () => {
      _updatePlayer(player.id, { appearances: parseInt(appsInput.value) || 0 });
    });
    appsRow.appendChild(appsLabel);
    appsRow.appendChild(appsInput);
    card.appendChild(appsRow);

    // ── Footer: entry count + open hint ──
    const entries = player.entries || [];
    const footer = document.createElement('div');
    footer.className = 'player-card-footer';
    const countEl = document.createElement('span');
    countEl.className = 'player-entry-count';
    countEl.textContent = entries.length > 0
      ? `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`
      : 'No entries yet';
    footer.appendChild(countEl);
    const openHint = document.createElement('span');
    openHint.className = 'player-open-hint';
    openHint.textContent = 'Open journal →';
    footer.appendChild(openHint);
    card.appendChild(footer);

    return card;
  }

  function _renderTagChips(container, player) {
    container.replaceChildren();
    const tags = player.tags || [];
    tags.forEach((tag, i) => {
      const chip = document.createElement('span');
      chip.className = 'player-tag';
      chip.textContent = tag;
      const x = document.createElement('button');
      x.className = 'player-tag-remove';
      x.textContent = '×';
      x.title = 'Remove tag';
      x.addEventListener('click', e => {
        e.stopPropagation();
        const newTags = tags.filter((_, j) => j !== i);
        player.tags = newTags;
        _updatePlayer(player.id, { tags: newTags });
        _renderTagChips(container, player);
      });
      chip.appendChild(x);
      container.appendChild(chip);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'player-tag-add-btn';
    addBtn.textContent = '+ tag';
    const tagInput = document.createElement('input');
    tagInput.type = 'text';
    tagInput.className = 'player-tag-input';
    tagInput.placeholder = 'Tag…';
    tagInput.style.display = 'none';

    addBtn.addEventListener('click', e => {
      e.stopPropagation();
      addBtn.style.display = 'none';
      tagInput.style.display = '';
      tagInput.focus();
    });
    const commitTag = () => {
      const val = tagInput.value.trim();
      tagInput.value = '';
      tagInput.style.display = 'none';
      addBtn.style.display = '';
      if (!val) return;
      const newTags = [...(player.tags || []), val];
      player.tags = newTags;
      _updatePlayer(player.id, { tags: newTags });
      _renderTagChips(container, player);
    };
    tagInput.addEventListener('blur', commitTag);
    tagInput.addEventListener('click', e => e.stopPropagation());
    tagInput.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') commitTag();
      if (e.key === 'Escape') { tagInput.value = ''; tagInput.style.display = 'none'; addBtn.style.display = ''; }
    });
    container.appendChild(addBtn);
    container.appendChild(tagInput);
  }

  function _addPlayer(player) {
    const hub = _getHub();
    hub.players.push(player);
    _saveHub(hub);
  }

  function _updatePlayer(id, changes) {
    const hub = _getHub();
    const idx = hub.players.findIndex(p => p.id === id);
    if (idx === -1) return;
    Object.assign(hub.players[idx], changes);
    _saveHub(hub);
  }

  function _deletePlayer(id) {
    const hub = _getHub();
    hub.players = hub.players.filter(p => p.id !== id);
    _saveHub(hub);
  }

  function _refreshPlayers() {
    const hub     = _getHub();
    const section = _container.querySelector('#hub-section-players');
    if (!section) return;
    section.replaceChildren();
    section.appendChild(_buildPlayers());
    lucide.createIcons();
  }

  // ── Player Modal (Journal) ────────────────────────────────────

  function _openPlayerModal(playerId) {
    const hub    = _getHub();
    const player = hub.players.find(p => p.id === playerId);
    if (!player) return;

    document.querySelector('.player-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal player-modal';

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.addEventListener('click', () => overlay.remove());
    overlay.appendChild(backdrop);

    const sheet = document.createElement('div');
    sheet.className = 'modal-sheet player-modal-sheet';

    const handle = document.createElement('div');
    handle.className = 'modal-handle';
    sheet.appendChild(handle);

    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';
    const titleWrap = document.createElement('div');
    const nameEl = document.createElement('h2');
    nameEl.textContent = player.name;
    titleWrap.appendChild(nameEl);
    if (player.role) {
      const rb = document.createElement('span');
      rb.className = 'player-role-badge';
      rb.style.cssText = 'display:inline-block;margin-top:4px;';
      rb.textContent = player.role;
      titleWrap.appendChild(rb);
    }
    header.appendChild(titleWrap);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'icon-btn';
    const closeIcon = document.createElement('i');
    closeIcon.setAttribute('data-lucide', 'x');
    closeBtn.appendChild(closeIcon);
    closeBtn.addEventListener('click', () => overlay.remove());
    header.appendChild(closeBtn);
    sheet.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'player-modal-body';

    // Add entry area
    const addArea = document.createElement('div');
    addArea.className = 'card log-add-area';
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Match note, injury, transfer interest…';
    addArea.appendChild(textarea);
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-primary';
    const addIcon = document.createElement('i');
    addIcon.setAttribute('data-lucide', 'plus');
    addBtn.appendChild(addIcon);
    addBtn.appendChild(document.createTextNode(' Add Entry'));
    addBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text) return;
      _addPlayerEntry(playerId, text);
      textarea.value = '';
      const wrap = body.querySelector('.player-modal-entries');
      if (wrap) { _renderPlayerEntries(wrap, playerId); lucide.createIcons(); }
      _refreshPlayers();
    });
    addArea.appendChild(addBtn);
    body.appendChild(addArea);

    // Entries list
    const entriesWrap = document.createElement('div');
    entriesWrap.className = 'player-modal-entries';
    _renderPlayerEntries(entriesWrap, playerId);
    body.appendChild(entriesWrap);

    sheet.appendChild(body);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    lucide.createIcons();
  }

  function _renderPlayerEntries(container, playerId) {
    const hub    = _getHub();
    const player = hub.players.find(p => p.id === playerId);
    const entries = (player?.entries || []);
    container.replaceChildren();

    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'log-empty';
      empty.textContent = 'No entries yet for this player.';
      container.appendChild(empty);
      return;
    }

    [...entries].reverse().forEach(entry => {
      container.appendChild(_buildPlayerEntryEl(entry, playerId, container));
    });
  }

  function _buildPlayerEntryEl(entry, playerId, container) {
    const el = document.createElement('div');
    el.className = 'log-entry card';
    if (entry.highlight) el.classList.add(`log-highlight-${entry.highlight}`);

    const header = document.createElement('div');
    header.className = 'log-entry-header';
    const time = document.createElement('span');
    time.className = 'log-entry-time';
    time.textContent = _formatDate(entry.timestamp);
    header.appendChild(time);

    const actions = document.createElement('div');
    actions.className = 'log-entry-actions';

    // Highlight cycle: none → yellow → red → green → none
    const hlBtn = document.createElement('button');
    hlBtn.className = 'icon-btn log-highlight-btn';
    hlBtn.title = 'Highlight';
    if (entry.highlight === 'yellow') hlBtn.classList.add('hl-yellow');
    if (entry.highlight === 'red')    hlBtn.classList.add('hl-red');
    if (entry.highlight === 'green')  hlBtn.classList.add('hl-green');
    const hlIcon = document.createElement('i');
    hlIcon.setAttribute('data-lucide', 'flag');
    hlBtn.appendChild(hlIcon);
    hlBtn.addEventListener('click', () => {
      const next = { undefined: 'yellow', yellow: 'red', red: 'green', green: undefined }[entry.highlight];
      entry.highlight = next;
      _updatePlayerEntry(playerId, entry.id, { highlight: next });
      hlBtn.className = 'icon-btn log-highlight-btn';
      if (next) hlBtn.classList.add(`hl-${next}`);
      el.classList.remove('log-highlight-yellow', 'log-highlight-red', 'log-highlight-green');
      if (next) el.classList.add(`log-highlight-${next}`);
    });
    actions.appendChild(hlBtn);

    // Edit
    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.title = 'Edit';
    const editIcon = document.createElement('i');
    editIcon.setAttribute('data-lucide', 'pencil');
    editBtn.appendChild(editIcon);
    actions.appendChild(editBtn);

    // Delete
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.title = 'Delete';
    const delIcon = document.createElement('i');
    delIcon.setAttribute('data-lucide', 'trash-2');
    delBtn.appendChild(delIcon);
    delBtn.addEventListener('click', () => {
      _deletePlayerEntry(playerId, entry.id);
      _renderPlayerEntries(container, playerId);
      lucide.createIcons();
      _refreshPlayers();
    });
    actions.appendChild(delBtn);

    header.appendChild(actions);
    el.appendChild(header);

    const textEl = document.createElement('p');
    textEl.className = 'log-entry-text';
    textEl.textContent = entry.text;
    el.appendChild(textEl);

    const editArea = document.createElement('textarea');
    editArea.className = 'log-edit-textarea';
    editArea.value = entry.text;
    el.appendChild(editArea);

    const commitEdit = () => {
      const val = editArea.value.trim();
      if (val && val !== entry.text) {
        entry.text = val;
        _updatePlayerEntry(playerId, entry.id, { text: val });
        textEl.textContent = val;
      }
      editArea.classList.remove('editing');
      textEl.classList.remove('editing');
      editBtn.title = 'Edit';
    };
    editBtn.addEventListener('click', () => {
      const isEditing = editArea.classList.contains('editing');
      if (isEditing) { commitEdit(); }
      else {
        editArea.classList.add('editing');
        textEl.classList.add('editing');
        editArea.focus();
        editArea.setSelectionRange(editArea.value.length, editArea.value.length);
        editBtn.title = 'Save';
      }
    });
    editArea.addEventListener('blur', commitEdit);
    editArea.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        editArea.value = entry.text;
        editArea.classList.remove('editing');
        textEl.classList.remove('editing');
      }
    });

    return el;
  }

  function _addPlayerEntry(playerId, text) {
    const hub    = _getHub();
    const player = hub.players.find(p => p.id === playerId);
    if (!player) return;
    if (!player.entries) player.entries = [];
    player.entries.push({ id: _uid(), text, timestamp: new Date().toISOString(), highlight: undefined });
    _saveHub(hub);
  }

  function _updatePlayerEntry(playerId, entryId, changes) {
    const hub    = _getHub();
    const player = hub.players.find(p => p.id === playerId);
    if (!player?.entries) return;
    const idx = player.entries.findIndex(e => e.id === entryId);
    if (idx === -1) return;
    Object.assign(player.entries[idx], changes);
    _saveHub(hub);
  }

  function _deletePlayerEntry(playerId, entryId) {
    const hub    = _getHub();
    const player = hub.players.find(p => p.id === playerId);
    if (!player?.entries) return;
    player.entries = player.entries.filter(e => e.id !== entryId);
    _saveHub(hub);
  }

  // ── Trophy Cabinet ───────────────────────────────────────────

  function _buildTrophies() {
    const hub     = _getHub();
    const seasons = hub.seasons || [];
    const wrap    = document.createElement('div');

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-accent-ghost';
    addBtn.style.marginBottom = '14px';
    const addIcon = document.createElement('i');
    addIcon.setAttribute('data-lucide', 'plus');
    addBtn.appendChild(addIcon);
    addBtn.appendChild(document.createTextNode(' New Season'));
    addBtn.addEventListener('click', () => {
      const setup = Storage.get(Storage.KEYS.SETUP);
      _addSeason({
        id:       _uid(),
        season:   setup?.season || (seasons.length + 1),
        club:     setup?.club   || '',
        trophies: {},
        notes:    '',
      });
      _refreshTrophies();
    });
    wrap.appendChild(addBtn);

    if (seasons.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'card';
      empty.style.cssText = 'text-align:center;padding:32px;color:var(--text-muted);font-size:.875rem;';
      empty.textContent = 'No seasons recorded yet. Add a season to start tracking trophies.';
      wrap.appendChild(empty);
    } else {
      seasons.forEach((s, i) => wrap.appendChild(_buildSeasonEntry(s, i)));
    }

    return wrap;
  }

  function _buildSeasonEntry(season, index) {
    const setup         = Storage.get(Storage.KEYS.SETUP);
    const currentSeason = setup?.season || 1;
    const isCurrent     = season.season === currentSeason;

    const el = document.createElement('div');
    el.className = 'trophy-entry card';
    if (isCurrent) el.classList.add('trophy-entry-current');
    el.dataset.id = season.id;

    const header = document.createElement('div');
    header.className = 'trophy-season-header';

    const tagRow = document.createElement('div');
    tagRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const tag = document.createElement('div');
    tag.className = 'trophy-season-label';
    tag.textContent = `Season ${season.season || index + 1}`;
    tagRow.appendChild(tag);
    if (isCurrent) {
      const badge = document.createElement('span');
      badge.className = 'trophy-current-badge';
      badge.textContent = 'Current';
      tagRow.appendChild(badge);
    }
    header.appendChild(tagRow);

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.title = 'Delete season';
    const delIcon = document.createElement('i');
    delIcon.setAttribute('data-lucide', 'trash-2');
    delBtn.appendChild(delIcon);
    delBtn.addEventListener('click', () => {
      _deleteSeason(season.id);
      _refreshTrophies();
    });
    header.appendChild(delBtn);

    el.appendChild(header);

    const isPlayer = setup?.mode === 'player' || setup?.mode === 'fiction';

    // Club + League Position row
    const metaRow = document.createElement('div');
    metaRow.className = 'trophy-meta-row';

    const clubGroup = document.createElement('div');
    clubGroup.className = 'trophy-meta-group';
    const clubLbl = document.createElement('label');
    clubLbl.className = 'trophy-meta-label';
    clubLbl.textContent = 'Club';
    const clubInput = document.createElement('input');
    clubInput.type = 'text';
    clubInput.className = 'form-input';
    clubInput.value = season.club || '';
    clubInput.placeholder = 'Club name';
    clubInput.addEventListener('input', () => _updateSeason(season.id, { club: clubInput.value }));
    clubGroup.appendChild(clubLbl);
    clubGroup.appendChild(clubInput);
    metaRow.appendChild(clubGroup);

    if (!isPlayer) {
      const posGroup = document.createElement('div');
      posGroup.className = 'trophy-meta-group trophy-meta-position';
      const posLbl = document.createElement('label');
      posLbl.className = 'trophy-meta-label';
      posLbl.textContent = 'League Position';
      const posInput = document.createElement('input');
      posInput.type = 'number';
      posInput.className = 'form-input';
      posInput.min = '1';
      posInput.max = '25';
      posInput.value = season.position || '';
      posInput.placeholder = '—';
      posInput.addEventListener('input', () => _updateSeason(season.id, { position: parseInt(posInput.value) || null }));
      posGroup.appendChild(posLbl);
      posGroup.appendChild(posInput);
      metaRow.appendChild(posGroup);
    }

    el.appendChild(metaRow);

    // Player stats section (player mode only)
    if (isPlayer) {
      const ps = season.playerStats || {};
      const statsSection = document.createElement('div');
      statsSection.className = 'player-season-stats';

      const statsLabel = document.createElement('div');
      statsLabel.className = 'trophy-season-label';
      statsLabel.style.marginBottom = '10px';
      statsLabel.textContent = 'Player Stats';
      statsSection.appendChild(statsLabel);

      const statsGrid = document.createElement('div');
      statsGrid.className = 'player-stats-grid';

      const statFields = [
        { key: 'apps',      label: 'Apps',      type: 'number', placeholder: '0'  },
        { key: 'goals',     label: 'Goals',     type: 'number', placeholder: '0'  },
        { key: 'assists',   label: 'Assists',   type: 'number', placeholder: '0'  },
        { key: 'avgRating', label: 'Avg Rating',type: 'number', placeholder: '7.0', step: '0.1' },
        { key: 'ovrStart',  label: 'OVR Start', type: 'number', placeholder: '72' },
        { key: 'ovrEnd',    label: 'OVR End',   type: 'number', placeholder: '75' },
        { key: 'potential', label: 'Potential', type: 'number', placeholder: '85' },
      ];

      statFields.forEach(({ key, label, type, placeholder, step }) => {
        const grp = document.createElement('div');
        grp.className = 'trophy-meta-group';
        const lbl = document.createElement('label');
        lbl.className = 'trophy-meta-label';
        lbl.textContent = label;
        const inp = document.createElement('input');
        inp.type = type;
        inp.className = 'form-input';
        inp.placeholder = placeholder;
        if (step) inp.step = step;
        inp.value = ps[key] != null ? ps[key] : '';
        inp.addEventListener('input', () => {
          const updated = { ...(season.playerStats || {}) };
          updated[key] = step ? parseFloat(inp.value) : (parseInt(inp.value) || null);
          _updateSeason(season.id, { playerStats: updated });
        });
        grp.appendChild(lbl);
        grp.appendChild(inp);
        statsGrid.appendChild(grp);
      });
      statsSection.appendChild(statsGrid);

      // Career moment textarea
      const momentLbl = document.createElement('label');
      momentLbl.className = 'trophy-meta-label';
      momentLbl.style.marginTop = '10px';
      momentLbl.style.display = 'block';
      momentLbl.textContent = 'Key Career Moment';
      const momentInput = document.createElement('textarea');
      momentInput.className = 'trophy-notes-input';
      momentInput.placeholder = 'e.g. "Scored hat-trick vs rivals, linked with Real Madrid"…';
      momentInput.value = ps.careerMoment || '';
      momentInput.addEventListener('input', () => {
        const updated = { ...(season.playerStats || {}) };
        updated.careerMoment = momentInput.value;
        _updateSeason(season.id, { playerStats: updated });
      });
      statsSection.appendChild(momentLbl);
      statsSection.appendChild(momentInput);

      el.appendChild(statsSection);
    }

    // Trophies checklist
    const checklistLabel = document.createElement('div');
    checklistLabel.className = 'trophy-season-label';
    checklistLabel.style.marginBottom = '8px';
    checklistLabel.textContent = 'Trophies Won';
    el.appendChild(checklistLabel);

    const checklist = document.createElement('div');
    checklist.className = 'trophies-checklist';

    TROPHY_TYPES.forEach(t => {
      const item = document.createElement('label');
      item.className = 'trophy-check-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!(season.trophies || {})[t];
      cb.addEventListener('change', () => {
        const trophies = { ...(season.trophies || {}) };
        trophies[t] = cb.checked;
        _updateSeason(season.id, { trophies });
      });
      item.appendChild(cb);

      const lbl = document.createElement('span');
      lbl.className = 'trophy-check-label';
      lbl.textContent = t;
      item.appendChild(lbl);

      checklist.appendChild(item);
    });

    el.appendChild(checklist);

    // Notes
    const notes = document.createElement('textarea');
    notes.className = 'trophy-notes-input';
    notes.placeholder = 'Season notes, e.g. "Lost CL final on pens"…';
    notes.value = season.notes || '';
    notes.addEventListener('input', () => _updateSeason(season.id, { notes: notes.value }));
    el.appendChild(notes);

    return el;
  }

  function _addSeason(season) {
    const hub = _getHub();
    if (!hub.seasons) hub.seasons = [];
    hub.seasons.unshift(season);
    _saveHub(hub);
  }

  function _updateSeason(id, changes) {
    const hub = _getHub();
    const idx = hub.seasons.findIndex(s => s.id === id);
    if (idx === -1) return;
    Object.assign(hub.seasons[idx], changes);
    _saveHub(hub);
  }

  function _deleteSeason(id) {
    const hub = _getHub();
    hub.seasons = hub.seasons.filter(s => s.id !== id);
    _saveHub(hub);
  }

  function _refreshTrophies() {
    const section = _container.querySelector('#hub-section-trophies');
    if (!section) return;
    section.replaceChildren();
    section.appendChild(_buildTrophies());
    lucide.createIcons();
  }

  // ── History Archive ──────────────────────────────────────────

  function _buildArchive() {
    const hub     = _getHub();
    const seasons = (hub.seasons || []).filter(s => s.club || s.notes || Object.values(s.trophies || {}).some(Boolean));
    const wrap    = document.createElement('div');

    if (seasons.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'history-empty card';
      empty.textContent = 'No seasons recorded yet. Add seasons in the Trophies tab to build your archive.';
      wrap.appendChild(empty);
      return wrap;
    }

    const card = document.createElement('div');
    card.className = 'card';

    const listLabel = document.createElement('div');
    listLabel.className = 'card-title';
    listLabel.style.marginBottom = '20px';
    listLabel.textContent = 'Career Timeline';
    card.appendChild(listLabel);

    seasons.forEach((s, i) => {
      const entry = document.createElement('div');
      entry.className = 'history-entry';

      const tag = document.createElement('div');
      tag.className = 'history-season-tag';
      tag.textContent = `Season ${s.season || i + 1}`;
      entry.appendChild(tag);

      const clubRow = document.createElement('div');
      clubRow.className = 'history-club-row';
      const club = document.createElement('span');
      club.className = 'history-club';
      club.textContent = s.club || 'Unknown Club';
      clubRow.appendChild(club);
      if (s.position) {
        const pos = document.createElement('span');
        pos.className = 'history-position';
        pos.textContent = `${s.position}${_ordinal(s.position)}`;
        clubRow.appendChild(pos);
      }
      entry.appendChild(clubRow);

      const wonTrophies = Object.entries(s.trophies || {}).filter(([, v]) => v).map(([k]) => k);
      if (wonTrophies.length > 0) {
        const trophiesRow = document.createElement('div');
        trophiesRow.className = 'history-trophies';
        wonTrophies.forEach(t => {
          const badge = document.createElement('span');
          badge.className = 'badge badge-completed';
          badge.textContent = t;
          trophiesRow.appendChild(badge);
        });
        entry.appendChild(trophiesRow);
      }

      if (s.notes) {
        const notes = document.createElement('div');
        notes.className = 'history-notes';
        notes.textContent = s.notes;
        entry.appendChild(notes);
      }

      card.appendChild(entry);
    });

    wrap.appendChild(card);
    return wrap;
  }

  function _ordinal(n) {
    const s = ['th','st','nd','rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  return { init, render };
})();
