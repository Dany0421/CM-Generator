const SetupModule = (() => {
  let _container = null;
  let _saveTimer = null;
  let _lastDirection = '';
  let _mode = 'team'; // 'team' | 'player' | 'fiction'

  const ERA_OPTIONS = [
    'Rebuild Era',
    'Golden Gen',
    'Fallen Giant',
    'Underdog Run',
    'Dynasty Mode',
    'Mid-Table Crisis',
    'Promotion Push',
    'Survival Mode',
  ];

  const DIFFICULTY_OPTIONS = ['Legendary', 'Ultimate', 'Custom'];

  // ── Squad (Setup extension) ──────────────────────────────────
  const SQUAD_FORMATIONS = [
    '4-3-3', '4-2-3-1', '4-4-2', '4-1-2-1-2', '4-4-1-1', '4-5-1',
    '4-3-2-1', '4-2-2-2', '3-5-2', '3-4-3', '5-3-2', '5-2-1-2',
  ];

  function emptySquad() {
    return { formation: '4-3-3', starters: [], bench: [], reserves: [] };
  }

  // Storage-boundary cleaner: in-memory rows may be half-filled; only named
  // players persist. ovr 0 = "unset" and survives as 0.
  function normalizeSquad(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const player = p => {
      const n = parseInt(p?.ovr, 10) || 0;
      return {
        name:     String(p?.name || '').trim(),
        position: String(p?.position || '').trim().toUpperCase(),
        ovr:      n ? Math.max(1, Math.min(99, n)) : 0,
      };
    };
    const list = a => (Array.isArray(a) ? a : []).map(player).filter(p => p.name);
    const squad = {
      formation: String(raw.formation || '').trim() || '4-3-3',
      starters:  list(raw.starters),
      bench:     list(raw.bench),
      reserves:  list(raw.reserves),
    };
    if (squad.starters.length > 11) {
      squad.bench    = squad.starters.slice(11).concat(squad.bench);
      squad.starters = squad.starters.slice(0, 11);
    }
    return squad;
  }

  function init(container) {
    _container = container;
    render();
  }

  function render() {
    _container.replaceChildren();

    const saved = Storage.get(Storage.KEYS.SETUP);
    // Sync _mode from saved data
    if (saved?.mode) _mode = saved.mode;

    const headerFrag = document.createRange().createContextualFragment(`
      <div class="module-header">
        <div class="module-title-group">
          <span class="module-label">Module 1</span>
          <h1 class="module-title">Save Setup</h1>
        </div>
      </div>
    `);
    _container.appendChild(headerFrag);

    _container.appendChild(_buildModeToggle());
    _container.appendChild(_buildGenerateCard());

    if (saved?.save_concept || saved?.player?.name) {
      _container.appendChild(_buildConceptCard(saved));
    }

    _container.appendChild(_buildFormCard(saved));

    lucide.createIcons();
  }

  function _buildModeToggle() {
    const wrap = document.createElement('div');
    wrap.className = 'setup-mode-toggle';

    const teamBtn = document.createElement('button');
    teamBtn.className = 'setup-mode-btn' + (_mode === 'team' ? ' active' : '');
    teamBtn.textContent = 'Team Mode';
    teamBtn.addEventListener('click', () => {
      if (_mode === 'team') return;
      _mode = 'team';
      _saveMode();
      App.setMode(_mode);
      render();
    });

    const playerBtn = document.createElement('button');
    playerBtn.className = 'setup-mode-btn' + (_mode === 'player' ? ' active' : '');
    playerBtn.textContent = 'Player Mode';
    playerBtn.addEventListener('click', () => {
      if (_mode === 'player') return;
      _mode = 'player';
      _saveMode();
      App.setMode(_mode);
      render();
    });

    const fictionBtn = document.createElement('button');
    fictionBtn.className = 'setup-mode-btn' + (_mode === 'fiction' ? ' active' : '');
    fictionBtn.textContent = 'Fiction Mode';
    fictionBtn.addEventListener('click', () => {
      if (_mode === 'fiction') return;
      _mode = 'fiction';
      _saveMode();
      App.setMode(_mode);
      render();
    });

    wrap.appendChild(teamBtn);
    wrap.appendChild(playerBtn);
    wrap.appendChild(fictionBtn);
    return wrap;
  }

  function _saveMode() {
    const existing = Storage.get(Storage.KEYS.SETUP) || {};
    existing.mode = _mode;
    Storage.set(Storage.KEYS.SETUP, existing);
  }

  function _buildGenerateCard() {
    const isPlayer  = _mode === 'player';
    const isFiction = _mode === 'fiction';
    const card = document.createElement('div');
    card.className = 'card setup-generate-card';

    const title = document.createElement('p');
    title.className = 'setup-generate-title';
    title.textContent = isFiction ? 'Create Your Fiction Player' : isPlayer ? 'Generate Your Player Concept' : 'Generate Your Save';
    card.appendChild(title);

    const sub = document.createElement('p');
    sub.className = 'setup-generate-sub';
    sub.textContent = isFiction
      ? 'Describe a concept, vibe, or character idea — the AI creates a fully fictional player from scratch, including all FIFA stats.'
      : isPlayer
        ? 'Describe a direction or say "surprise me" — the AI creates a player, their story, and starting club.'
        : 'Give a direction or say "surprise me" — the AI picks your manager, club, and builds the whole concept.';
    card.appendChild(sub);

    const textarea = document.createElement('textarea');
    textarea.className = 'setup-direction-input';
    textarea.id = 'setup-direction';
    textarea.placeholder = isFiction
      ? 'e.g. "Brazilian striker with a tragic past and silky dribbling", "anime-style winger obsessed with perfection", "surprise me"'
      : isPlayer
        ? 'e.g. "Mbappé rewind at Monaco 2016", "Greek wonderkid underdog", "surprise me"'
        : 'e.g. "lower league England", "South American fallen giant", "surprise me"';
    textarea.rows = 2;
    if (_lastDirection) textarea.value = _lastDirection;
    card.appendChild(textarea);

    const btn = document.createElement('button');
    btn.className = 'btn-primary setup-generate-btn';
    btn.id = 'setup-generate-btn';
    const i = document.createElement('i');
    i.setAttribute('data-lucide', 'sparkles');
    btn.appendChild(i);
    btn.appendChild(document.createTextNode(isFiction ? ' Create Fiction Player' : isPlayer ? ' Generate Player Concept' : ' Generate Save Concept'));
    btn.addEventListener('click', _generateConcept);
    card.appendChild(btn);

    return card;
  }

  function _buildConceptCard(data) {
    const isPlayer  = _mode === 'player';
    const isFiction = _mode === 'fiction';
    const card = document.createElement('div');
    card.className = 'card setup-concept-card';

    const taglineText = data.save_concept || data.player?.concept_hook || '';

    const tagline = document.createElement('p');
    tagline.className = 'setup-concept-tagline setup-tagline-editable';
    tagline.title = 'Tap to edit';
    tagline.textContent = taglineText;

    const taglineInput = document.createElement('textarea');
    taglineInput.className = 'setup-tagline-input';
    taglineInput.value = taglineText;
    taglineInput.rows = 2;

    tagline.addEventListener('click', () => {
      tagline.classList.add('hidden');
      taglineInput.classList.add('visible');
      taglineInput.focus();
      taglineInput.select();
    });

    const commitTagline = () => {
      const val = taglineInput.value.trim() || taglineText;
      tagline.textContent = val;
      tagline.classList.remove('hidden');
      taglineInput.classList.remove('visible');
      const saved = Storage.get(Storage.KEYS.SETUP);
      if (!saved) return;
      saved.save_concept = val;
      if (saved.player) saved.player.concept_hook = val;
      Storage.set(Storage.KEYS.SETUP, saved);
    };

    taglineInput.addEventListener('blur', commitTagline);
    taglineInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') { tagline.classList.remove('hidden'); taglineInput.classList.remove('visible'); }
    });

    card.appendChild(tagline);
    card.appendChild(taglineInput);

    const meta = document.createElement('div');
    meta.className = 'setup-concept-meta';

    if ((isPlayer || isFiction) && data.player) {
      const p = data.player;
      [
        p.name ? `${p.name}, ${p.age}` : null,
        p.position,
        p.nationality,
        p.concept_type,
        data.club,
        data.league,
        data.difficulty,
      ].filter(Boolean).forEach(text => {
        const chip = document.createElement('span');
        chip.className = 'setup-concept-chip';
        chip.textContent = text;
        meta.appendChild(chip);
      });
    } else {
      [data.manager, data.club, data.league, `${data.difficulty} · ${data.era}`]
        .filter(Boolean)
        .forEach(text => {
          const chip = document.createElement('span');
          chip.className = 'setup-concept-chip';
          chip.textContent = text;
          meta.appendChild(chip);
        });
    }

    card.appendChild(meta);

    const rerollBtn = document.createElement('button');
    rerollBtn.className = 'btn-secondary setup-reroll-btn';
    rerollBtn.id = 'setup-reroll-btn';
    const ri = document.createElement('i');
    ri.setAttribute('data-lucide', 'shuffle');
    rerollBtn.appendChild(ri);
    rerollBtn.appendChild(document.createTextNode(' Reroll'));
    rerollBtn.addEventListener('click', _generateConcept);
    card.appendChild(rerollBtn);

    return card;
  }

  function _buildFormCard(saved) {
    const isPlayer  = _mode === 'player';
    const isFiction = _mode === 'fiction';
    const card = document.createElement('div');
    card.className = 'card';

    // Manager + Season row
    const topRow = document.createElement('div');
    topRow.className = 'form-row two-col';

    const managerGroup = document.createElement('div');
    managerGroup.className = 'form-group';
    const managerLabel = document.createElement('label');
    managerLabel.className = 'form-label';
    managerLabel.textContent = 'Manager Name';
    const managerInput = document.createElement('input');
    managerInput.className = 'form-input';
    managerInput.id = 'setup-manager';
    managerInput.type = 'text';
    managerInput.placeholder = 'e.g. Nuno Espírito Santo';
    managerInput.autocomplete = 'off';
    managerInput.value = saved?.manager || '';
    managerGroup.appendChild(managerLabel);
    managerGroup.appendChild(managerInput);
    topRow.appendChild(managerGroup);

    const seasonGroup = document.createElement('div');
    seasonGroup.className = 'form-group';
    const seasonLabel = document.createElement('label');
    seasonLabel.className = 'form-label';
    seasonLabel.textContent = 'Season';
    const seasonInput = document.createElement('input');
    seasonInput.className = 'form-input';
    seasonInput.id = 'setup-season';
    seasonInput.type = 'number';
    seasonInput.min = '1';
    seasonInput.max = '50';
    seasonInput.placeholder = '1';
    seasonInput.value = saved?.season || 1;
    seasonGroup.appendChild(seasonLabel);
    seasonGroup.appendChild(seasonInput);
    topRow.appendChild(seasonGroup);
    card.appendChild(topRow);

    // Player section (player + fiction mode)
    if (isPlayer || isFiction) {
      const playerSection = document.createElement('div');
      playerSection.className = 'setup-player-section';

      const sectionLabel = document.createElement('p');
      sectionLabel.className = 'setup-player-section-label';
      sectionLabel.textContent = 'Player';
      playerSection.appendChild(sectionLabel);

      const nameAgeRow = document.createElement('div');
      nameAgeRow.className = 'form-row two-col';

      const pNameGroup = document.createElement('div');
      pNameGroup.className = 'form-group';
      const pNameLabel = document.createElement('label');
      pNameLabel.className = 'form-label';
      pNameLabel.textContent = 'Player Name';
      const pNameInput = document.createElement('input');
      pNameInput.className = 'form-input';
      pNameInput.id = 'setup-player-name';
      pNameInput.type = 'text';
      pNameInput.placeholder = 'e.g. Kylian Mbappé';
      pNameInput.autocomplete = 'off';
      pNameInput.value = saved?.player?.name || '';
      pNameGroup.appendChild(pNameLabel);
      pNameGroup.appendChild(pNameInput);
      nameAgeRow.appendChild(pNameGroup);

      const pAgeGroup = document.createElement('div');
      pAgeGroup.className = 'form-group';
      const pAgeLabel = document.createElement('label');
      pAgeLabel.className = 'form-label';
      pAgeLabel.textContent = 'Starting Age';
      const pAgeInput = document.createElement('input');
      pAgeInput.className = 'form-input';
      pAgeInput.id = 'setup-player-age';
      pAgeInput.type = 'number';
      pAgeInput.min = '15';
      pAgeInput.max = '40';
      pAgeInput.placeholder = '17';
      pAgeInput.value = saved?.player?.age || '';
      pAgeGroup.appendChild(pAgeLabel);
      pAgeGroup.appendChild(pAgeInput);
      nameAgeRow.appendChild(pAgeGroup);
      playerSection.appendChild(nameAgeRow);

      const posNatRow = document.createElement('div');
      posNatRow.className = 'form-row two-col';

      const pPosGroup = document.createElement('div');
      pPosGroup.className = 'form-group';
      const pPosLabel = document.createElement('label');
      pPosLabel.className = 'form-label';
      pPosLabel.textContent = 'Position';
      const pPosInput = document.createElement('input');
      pPosInput.className = 'form-input';
      pPosInput.id = 'setup-player-position';
      pPosInput.type = 'text';
      pPosInput.placeholder = 'e.g. ST, CAM, CB';
      pPosInput.value = saved?.player?.position || '';
      pPosGroup.appendChild(pPosLabel);
      pPosGroup.appendChild(pPosInput);
      posNatRow.appendChild(pPosGroup);

      const pNatGroup = document.createElement('div');
      pNatGroup.className = 'form-group';
      const pNatLabel = document.createElement('label');
      pNatLabel.className = 'form-label';
      pNatLabel.textContent = 'Nationality';
      const pNatInput = document.createElement('input');
      pNatInput.className = 'form-input';
      pNatInput.id = 'setup-player-nationality';
      pNatInput.type = 'text';
      pNatInput.placeholder = 'e.g. French';
      pNatInput.value = saved?.player?.nationality || '';
      pNatGroup.appendChild(pNatLabel);
      pNatGroup.appendChild(pNatInput);
      posNatRow.appendChild(pNatGroup);
      playerSection.appendChild(posNatRow);

      // Current OVR + Potential — updated by the user as the save progresses
      // (player mode only; fiction mode edits these on the Player tab card)
      if (isPlayer) {
        const ratingRow = document.createElement('div');
        ratingRow.className = 'form-row two-col';

        [
          { id: 'setup-player-ovr',       label: 'Current OVR', value: saved?.player?.ovr,       placeholder: 'e.g. 72' },
          { id: 'setup-player-potential', label: 'Potential',   value: saved?.player?.potential, placeholder: 'e.g. 88' },
        ].forEach(({ id, label, value, placeholder }) => {
          const grp = document.createElement('div');
          grp.className = 'form-group';
          const lbl = document.createElement('label');
          lbl.className = 'form-label';
          lbl.textContent = label;
          const inp = document.createElement('input');
          inp.className = 'form-input';
          inp.id = id;
          inp.type = 'number';
          inp.min = '1';
          inp.max = '99';
          inp.placeholder = placeholder;
          inp.value = value || '';
          grp.appendChild(lbl);
          grp.appendChild(inp);
          ratingRow.appendChild(grp);
        });
        playerSection.appendChild(ratingRow);
      }

      card.appendChild(playerSection);

      // ── Linked Player (optional) ──
      const linked = saved?.player?.linked || {};
      const linkedSection = document.createElement('div');
      linkedSection.className = 'setup-player-section';

      const linkedLabel = document.createElement('p');
      linkedLabel.className = 'setup-player-section-label';
      linkedLabel.textContent = 'Linked Player (optional)';
      linkedSection.appendChild(linkedLabel);

      const linkedHint = document.createElement('p');
      linkedHint.className = 'setup-generate-sub';
      linkedHint.textContent = 'A teammate your career is tied to — challenges, narrative and career moves will revolve around the duo. Leave the name empty for none.';
      linkedSection.appendChild(linkedHint);

      const linkedRow = document.createElement('div');
      linkedRow.className = 'form-row two-col';

      const lNameGroup = document.createElement('div');
      lNameGroup.className = 'form-group';
      const lNameLabel = document.createElement('label');
      lNameLabel.className = 'form-label';
      lNameLabel.textContent = 'Teammate Name';
      const lNameInput = document.createElement('input');
      lNameInput.className = 'form-input';
      lNameInput.id = 'setup-linked-name';
      lNameInput.type = 'text';
      lNameInput.placeholder = 'e.g. Viktor Gyökeres';
      lNameInput.autocomplete = 'off';
      lNameInput.value = linked.name || '';
      lNameGroup.appendChild(lNameLabel);
      lNameGroup.appendChild(lNameInput);
      linkedRow.appendChild(lNameGroup);

      const lPosGroup = document.createElement('div');
      lPosGroup.className = 'form-group';
      const lPosLabel = document.createElement('label');
      lPosLabel.className = 'form-label';
      lPosLabel.textContent = 'Position';
      const lPosInput = document.createElement('input');
      lPosInput.className = 'form-input';
      lPosInput.id = 'setup-linked-position';
      lPosInput.type = 'text';
      lPosInput.placeholder = 'e.g. ST';
      lPosInput.value = linked.position || '';
      lPosGroup.appendChild(lPosLabel);
      lPosGroup.appendChild(lPosInput);
      linkedRow.appendChild(lPosGroup);
      linkedSection.appendChild(linkedRow);

      // Linked player ratings — upgraded by the user over the save, same as their own
      const lRatingRow = document.createElement('div');
      lRatingRow.className = 'form-row two-col';
      [
        { id: 'setup-linked-ovr',       label: 'His Current OVR', value: linked.ovr,       placeholder: 'e.g. 78' },
        { id: 'setup-linked-potential', label: 'His Potential',   value: linked.potential, placeholder: 'e.g. 86' },
      ].forEach(({ id, label, value, placeholder }) => {
        const grp = document.createElement('div');
        grp.className = 'form-group';
        const lbl = document.createElement('label');
        lbl.className = 'form-label';
        lbl.textContent = label;
        const inp = document.createElement('input');
        inp.className = 'form-input';
        inp.id = id;
        inp.type = 'number';
        inp.min = '1';
        inp.max = '99';
        inp.placeholder = placeholder;
        inp.value = value || '';
        grp.appendChild(lbl);
        grp.appendChild(inp);
        lRatingRow.appendChild(grp);
      });
      linkedSection.appendChild(lRatingRow);

      const bondGroup = document.createElement('div');
      bondGroup.className = 'form-group';
      const bondLabel = document.createElement('label');
      bondLabel.className = 'form-label';
      bondLabel.textContent = 'The Bond';
      const bondRow = document.createElement('div');
      bondRow.className = 'key-input-row';
      const bondInput = document.createElement('input');
      bondInput.className = 'form-input';
      bondInput.id = 'setup-linked-bond';
      bondInput.type = 'text';
      bondInput.placeholder = 'Why are your careers tied? Write it or generate it';
      bondInput.autocomplete = 'off';
      bondInput.value = linked.bond || '';
      bondRow.appendChild(bondInput);
      const bondBtn = document.createElement('button');
      bondBtn.className = 'btn-secondary';
      bondBtn.id = 'setup-linked-bond-btn';
      const bondIcon = document.createElement('i');
      bondIcon.setAttribute('data-lucide', 'sparkles');
      bondBtn.appendChild(bondIcon);
      bondBtn.addEventListener('click', _generateBond);
      bondRow.appendChild(bondBtn);
      bondGroup.appendChild(bondLabel);
      bondGroup.appendChild(bondRow);
      linkedSection.appendChild(bondGroup);

      card.appendChild(linkedSection);
    }

    // Club group
    const clubGroup = document.createElement('div');
    clubGroup.className = 'form-group';
    const clubLabel = document.createElement('label');
    clubLabel.className = 'form-label';
    clubLabel.textContent = 'Club Name';
    const clubInput = document.createElement('input');
    clubInput.className = 'form-input';
    clubInput.id = 'setup-club';
    clubInput.type = 'text';
    clubInput.placeholder = 'e.g. Vasco da Gama';
    clubInput.autocomplete = 'off';
    clubInput.value = saved?.club || '';
    clubGroup.appendChild(clubLabel);
    clubGroup.appendChild(clubInput);
    card.appendChild(clubGroup);

    // League + Division row
    const leagueRow = document.createElement('div');
    leagueRow.className = 'form-row two-col';

    const leagueGroup = document.createElement('div');
    leagueGroup.className = 'form-group';
    const leagueLabel = document.createElement('label');
    leagueLabel.className = 'form-label';
    leagueLabel.textContent = 'League';
    const leagueInput = document.createElement('input');
    leagueInput.className = 'form-input';
    leagueInput.id = 'setup-league';
    leagueInput.type = 'text';
    leagueInput.placeholder = 'e.g. Brasileirão Série A';
    leagueInput.autocomplete = 'off';
    leagueInput.value = saved?.league || '';
    leagueGroup.appendChild(leagueLabel);
    leagueGroup.appendChild(leagueInput);
    leagueRow.appendChild(leagueGroup);

    const divGroup = document.createElement('div');
    divGroup.className = 'form-group';
    const divLabel = document.createElement('label');
    divLabel.className = 'form-label';
    divLabel.textContent = 'Division / Tier';
    const divInput = document.createElement('input');
    divInput.className = 'form-input';
    divInput.id = 'setup-division';
    divInput.type = 'text';
    divInput.placeholder = 'e.g. 1st Division';
    divInput.autocomplete = 'off';
    divInput.value = saved?.division || '';
    divGroup.appendChild(divLabel);
    divGroup.appendChild(divInput);
    leagueRow.appendChild(divGroup);
    card.appendChild(leagueRow);

    // Difficulty + Era row
    const diffEraRow = document.createElement('div');
    diffEraRow.className = 'form-row two-col';

    const diffGroup = document.createElement('div');
    diffGroup.className = 'form-group';
    const diffLabel = document.createElement('label');
    diffLabel.className = 'form-label';
    diffLabel.textContent = 'Difficulty';
    const diffSel = document.createElement('select');
    diffSel.className = 'form-select';
    diffSel.id = 'setup-difficulty';
    DIFFICULTY_OPTIONS.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      diffSel.appendChild(o);
    });
    diffSel.value = saved?.difficulty || 'Legendary';
    diffGroup.appendChild(diffLabel);
    diffGroup.appendChild(diffSel);
    diffEraRow.appendChild(diffGroup);

    if (!isPlayer && !isFiction) {
      const eraGroup = document.createElement('div');
      eraGroup.className = 'form-group';
      const eraLabel = document.createElement('label');
      eraLabel.className = 'form-label';
      eraLabel.textContent = 'Save Era';
      const eraSel = document.createElement('select');
      eraSel.className = 'form-select';
      eraSel.id = 'setup-era';
      ERA_OPTIONS.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        eraSel.appendChild(o);
      });
      eraSel.value = saved?.era || 'Rebuild Era';
      eraGroup.appendChild(eraLabel);
      eraGroup.appendChild(eraSel);
      diffEraRow.appendChild(eraGroup);
    }

    card.appendChild(diffEraRow);

    // Save row
    const saveRow = document.createElement('div');
    saveRow.className = 'setup-save-row';
    const indicator = document.createElement('span');
    indicator.className = 'setup-saved-indicator';
    indicator.id = 'setup-saved-indicator';
    const checkIcon = document.createElement('i');
    checkIcon.setAttribute('data-lucide', 'check');
    indicator.appendChild(checkIcon);
    indicator.appendChild(document.createTextNode(' Saved'));
    saveRow.appendChild(indicator);
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-primary';
    saveBtn.id = 'setup-save-btn';
    const saveIcon = document.createElement('i');
    saveIcon.setAttribute('data-lucide', 'save');
    saveBtn.appendChild(saveIcon);
    saveBtn.appendChild(document.createTextNode(' Save Setup'));
    saveBtn.addEventListener('click', save);
    saveRow.appendChild(saveBtn);
    card.appendChild(saveRow);

    card.querySelectorAll('.form-input, .form-select').forEach(el => {
      el.addEventListener('change', () => scheduleSave());
    });

    return card;
  }

  function scheduleSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(save, 800);
  }

  function save() {
    clearTimeout(_saveTimer);
    const existing  = Storage.get(Storage.KEYS.SETUP) || {};
    const isPlayer  = _mode === 'player';
    const isFiction = _mode === 'fiction';

    const data = {
      mode:         _mode,
      manager:      _container.querySelector('#setup-manager')?.value.trim() || '',
      club:         _container.querySelector('#setup-club')?.value.trim() || '',
      league:       _container.querySelector('#setup-league')?.value.trim() || '',
      division:     _container.querySelector('#setup-division')?.value.trim() || '',
      season:       parseInt(_container.querySelector('#setup-season')?.value) || 1,
      difficulty:   _container.querySelector('#setup-difficulty')?.value || 'Legendary',
      save_concept: existing.save_concept || '',
    };

    if (!isPlayer && !isFiction) {
      data.era = _container.querySelector('#setup-era')?.value || 'Rebuild Era';
    }

    if (isPlayer || isFiction) {
      const prevPlayer = existing.player || {};
      data.player = {
        ...prevPlayer,
        name:        _container.querySelector('#setup-player-name')?.value.trim() || prevPlayer.name || '',
        age:         parseInt(_container.querySelector('#setup-player-age')?.value) || prevPlayer.age || 0,
        position:    _container.querySelector('#setup-player-position')?.value.trim() || prevPlayer.position || '',
        nationality: _container.querySelector('#setup-player-nationality')?.value.trim() || prevPlayer.nationality || '',
        linked: {
          name:      _container.querySelector('#setup-linked-name')?.value.trim() || '',
          position:  _container.querySelector('#setup-linked-position')?.value.trim() || '',
          bond:      _container.querySelector('#setup-linked-bond')?.value.trim() || '',
          ovr:       parseInt(_container.querySelector('#setup-linked-ovr')?.value) || 0,
          potential: parseInt(_container.querySelector('#setup-linked-potential')?.value) || 0,
        },
      };
      // Player-mode-only rating inputs (fiction edits these on the Player tab)
      const ovrEl = _container.querySelector('#setup-player-ovr');
      const potEl = _container.querySelector('#setup-player-potential');
      if (ovrEl) data.player.ovr       = parseInt(ovrEl.value) || 0;
      if (potEl) data.player.potential = parseInt(potEl.value) || 0;
    }

    Storage.set(Storage.KEYS.SETUP, data);
    _flashSaved();
  }

  function _flashSaved() {
    const indicator = _container.querySelector('#setup-saved-indicator');
    if (!indicator) return;
    indicator.classList.add('visible');
    setTimeout(() => indicator.classList.remove('visible'), 2000);
  }

  async function _generateConcept() {
    const directionInput = _container.querySelector('#setup-direction');
    const direction = directionInput?.value.trim() || '';
    _lastDirection = direction;

    const generateBtn = _container.querySelector('#setup-generate-btn');
    const rerollBtn   = _container.querySelector('#setup-reroll-btn');

    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.replaceChildren();
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      spinner.style.cssText = 'width:14px;height:14px;display:inline-block;margin-right:8px;flex-shrink:0;';
      generateBtn.appendChild(spinner);
      generateBtn.appendChild(document.createTextNode('Generating…'));
    }
    if (rerollBtn) rerollBtn.disabled = true;

    try {
      const existing = Storage.get(Storage.KEYS.SETUP) || {};
      let newData;

      if (_mode === 'fiction') {
        const concept = await API.generateFictionConcept(direction);
        newData = {
          mode:         'fiction',
          manager:      concept.manager     || '',
          club:         concept.club        || '',
          league:       concept.league      || '',
          division:     concept.division    || '',
          season:       existing.season     || 1,
          difficulty:   DIFFICULTY_OPTIONS.includes(concept.difficulty) ? concept.difficulty : 'Legendary',
          save_concept: concept.concept_hook || '',
          player: {
            ...(existing.player || {}),
            name:         concept.player_name     || '',
            age:          concept.player_age       || 17,
            position:     concept.player_position  || '',
            nationality:  concept.player_nationality || '',
            concept_type: 'Fiction',
            concept_hook: concept.concept_hook    || '',
          },
        };
      } else if (_mode === 'player') {
        const concept = await API.generatePlayerConcept(direction);
        newData = {
          mode:         'player',
          manager:      concept.manager     || '',
          club:         concept.club        || '',
          league:       concept.league      || '',
          division:     concept.division    || '',
          season:       existing.season     || 1,
          difficulty:   DIFFICULTY_OPTIONS.includes(concept.difficulty) ? concept.difficulty : 'Legendary',
          save_concept: concept.concept_hook || '',
          player: {
            ...(existing.player || {}),
            name:        concept.player_name        || '',
            age:         concept.player_age          || 0,
            position:    concept.player_position     || '',
            nationality: concept.player_nationality  || '',
            ovr:         concept.player_ovr          || 0,
            potential:   concept.player_potential    || 0,
            weakFoot:    concept.player_weak_foot    || 2,
            skillMoves:  concept.player_skill_moves  || 2,
            concept_type: concept.concept_type       || '',
            concept_hook: concept.concept_hook       || '',
          },
        };
      } else {
        const concept = await API.generateSaveConcept(direction);
        newData = {
          mode:         'team',
          manager:      concept.manager      || '',
          club:         concept.club         || '',
          league:       concept.league       || '',
          division:     concept.division     || '',
          season:       existing.season      || 1,
          difficulty:   DIFFICULTY_OPTIONS.includes(concept.difficulty) ? concept.difficulty : 'Legendary',
          era:          ERA_OPTIONS.includes(concept.era) ? concept.era : 'Rebuild Era',
          save_concept: concept.save_concept || '',
        };
      }

      Storage.set(Storage.KEYS.SETUP, newData);
      render();

      const dirInput = _container.querySelector('#setup-direction');
      if (dirInput) dirInput.value = _lastDirection;

      App.showToast(_mode === 'fiction' ? 'Fiction player concept created' : _mode === 'player' ? 'Player concept generated' : 'Save concept generated');

    } catch (err) {
      App.showError(err.message);

      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.replaceChildren();
        const i = document.createElement('i');
        i.setAttribute('data-lucide', 'sparkles');
        generateBtn.appendChild(i);
        generateBtn.appendChild(document.createTextNode(_mode === 'fiction' ? ' Create Fiction Player' : _mode === 'player' ? ' Generate Player Concept' : ' Generate Save Concept'));
        lucide.createIcons();
      }
      if (rerollBtn) rerollBtn.disabled = false;
    }
  }

  async function _generateBond() {
    save(); // persist linked name/position before the call
    const btn   = _container.querySelector('#setup-linked-bond-btn');
    const input = _container.querySelector('#setup-linked-bond');
    if (btn) btn.disabled = true;
    try {
      const result = await API.generateLinkedBond();
      if (input) input.value = result.bond || '';
      save();
      App.showToast('Bond written');
    } catch (err) {
      App.showError(err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // Node test export (browser ignores this) — same UMD-lite pattern as js/world/logic.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SQUAD_FORMATIONS, emptySquad, normalizeSquad };
  }

  return { init, render };
})();
