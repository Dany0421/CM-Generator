const FictionModule = (() => {
  let _container = null;

  const STAT_GROUPS = [
    { label: 'Pace',     keys: ['acceleration','sprint_speed'] },
    { label: 'Shooting', keys: ['finishing','shot_power','long_shots','volleys','penalties','attacking_positioning'] },
    { label: 'Passing',  keys: ['short_passing','long_passing','vision','curve','crossing','free_kick_accuracy'] },
    { label: 'Dribbling',keys: ['ball_control','dribbling','agility','balance','reactions','composure'] },
    { label: 'Defending',keys: ['defensive_awareness','interceptions','heading_accuracy','standing_tackle','sliding_tackle'] },
    { label: 'Physical', keys: ['jumping','stamina','strength','aggression'] },
  ];

  const GK_STAT_GROUPS = [
    { label: 'Pace',    keys: ['acceleration','sprint_speed'] },
    { label: 'GK',      keys: ['diving','handling','kicking','gk_positioning','reflexes'] },
  ];

  const STAT_LABELS = {
    acceleration:        'Acceleration',
    sprint_speed:        'Sprint Speed',
    agility:             'Agility',
    balance:             'Balance',
    reactions:           'Reactions',
    ball_control:        'Ball Control',
    dribbling:           'Dribbling',
    composure:           'Composure',
    finishing:           'Finishing',
    heading_accuracy:    'Heading',
    short_passing:       'Short Pass',
    long_passing:        'Long Pass',
    curve:               'Curve',
    free_kick_accuracy:  'FK Accuracy',
    crossing:            'Crossing',
    shot_power:          'Shot Power',
    long_shots:          'Long Shots',
    volleys:             'Volleys',
    penalties:           'Penalties',
    attacking_positioning: 'Positioning',
    vision:              'Vision',
    jumping:             'Jumping',
    stamina:             'Stamina',
    strength:            'Strength',
    aggression:          'Aggression',
    interceptions:       'Interceptions',
    defensive_awareness: 'Def. Awareness',
    standing_tackle:     'Stand. Tackle',
    sliding_tackle:      'Slide Tackle',
    diving:              'Diving',
    handling:            'Handling',
    kicking:             'Kicking',
    gk_positioning:      'Positioning',
    reflexes:            'Reflexes',
  };

  function _statColor(v) {
    if (v >= 80) return 'var(--accent)';
    if (v >= 65) return '#f0b429';
    return 'var(--text-muted)';
  }

  function init(container) {
    _container = container;
    render();
  }

  function render() {
    _container.replaceChildren();
    const setup = Storage.get(Storage.KEYS.SETUP);
    if (setup?.mode !== 'fiction') return;

    _container.appendChild(_buildHeader());

    const player = Storage.get(Storage.KEYS.FICTION_PLAYER);
    if (player?.stats) {
      _container.appendChild(_buildIdentityCard(player, setup));
      _container.appendChild(_buildStatsCard(player));
      _container.appendChild(_buildPlayStylesCard(player));
    } else {
      _container.appendChild(_buildEmptyState(!!setup?.player?.name));
    }

    lucide.createIcons();
  }

  function _buildHeader() {
    const hasPlayer = !!(Storage.get(Storage.KEYS.FICTION_PLAYER)?.stats);
    const frag = document.createRange().createContextualFragment(`
      <div class="module-header">
        <div class="module-title-group">
          <span class="module-label">Fiction</span>
          <h1 class="module-title">Player Creation</h1>
        </div>
        <div class="module-actions">
          ${hasPlayer
            ? `<button class="btn-secondary" id="fiction-update-btn">
                <i data-lucide="trending-up"></i>
                Update Stats
               </button>`
            : `<button class="btn-secondary" id="fiction-generate-btn">
                <i data-lucide="sparkles"></i>
                Generate Player
               </button>`
          }
        </div>
      </div>
    `);
    if (hasPlayer) {
      frag.querySelector('#fiction-update-btn').addEventListener('click', _updateStats);
    } else {
      frag.querySelector('#fiction-generate-btn').addEventListener('click', _generatePlayer);
    }
    return frag;
  }

  function _buildEmptyState(hasConcept) {
    const card = document.createElement('div');
    card.className = 'card fiction-empty';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'user-round-pen');
    card.appendChild(icon);

    const p = document.createElement('p');
    p.textContent = hasConcept
      ? 'Your concept is set. Generate your full player card — stats, identity, and PlayStyles.'
      : 'Go to Setup and create your fiction concept first, then generate your player card here.';
    card.appendChild(p);

    if (hasConcept) {
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      const i = document.createElement('i');
      i.setAttribute('data-lucide', 'sparkles');
      btn.appendChild(i);
      btn.appendChild(document.createTextNode(' Generate Player'));
      btn.addEventListener('click', _generatePlayer);
      card.appendChild(btn);
    }

    return card;
  }

  function _buildIdentityCard(p, setup) {
    const card = document.createElement('div');
    card.className = 'card fiction-identity-card';

    const nameRow = document.createElement('div');
    nameRow.className = 'fiction-name-row';

    const name = document.createElement('h2');
    name.className = 'fiction-player-name';
    name.textContent = p.name || setup?.player?.name || '—';
    nameRow.appendChild(name);

    const nat = document.createElement('span');
    nat.className = 'fiction-player-nat';
    nat.textContent = p.nationality || setup?.player?.nationality || '';
    nameRow.appendChild(nat);
    card.appendChild(nameRow);

    // OVR + Potential row
    const ovrRow = document.createElement('div');
    ovrRow.className = 'fiction-ovr-row';

    function makeOvrField(label, storageKey, currentVal) {
      const wrap = document.createElement('div');
      wrap.className = 'fiction-ovr-item';

      const lbl = document.createElement('span');
      lbl.className = 'fiction-ovr-label';
      lbl.textContent = label;

      const valEl = document.createElement('span');
      valEl.className = 'fiction-ovr-value fiction-stat-editable';
      valEl.textContent = currentVal ?? '—';
      if (currentVal != null) valEl.style.color = _statColor(currentVal);
      valEl.title = 'Tap to edit';

      const input = document.createElement('input');
      input.type = 'number';
      input.min = 1;
      input.max = 99;
      input.className = 'fiction-stat-input';
      input.value = currentVal ?? '';

      valEl.addEventListener('click', () => {
        valEl.classList.add('hidden');
        input.classList.add('visible');
        input.focus();
        input.select();
      });

      const commit = () => {
        let v = parseInt(input.value);
        if (isNaN(v)) v = currentVal ?? 0;
        v = Math.max(1, Math.min(99, v));
        input.value = v;
        valEl.textContent = v;
        valEl.style.color = _statColor(v);
        valEl.classList.remove('hidden');
        input.classList.remove('visible');
        const fp = Storage.get(Storage.KEYS.FICTION_PLAYER);
        if (fp) { fp[storageKey] = v; Storage.set(Storage.KEYS.FICTION_PLAYER, fp); }
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { input.value = currentVal ?? ''; valEl.classList.remove('hidden'); input.classList.remove('visible'); }
      });

      wrap.appendChild(lbl);
      wrap.appendChild(valEl);
      wrap.appendChild(input);
      return wrap;
    }

    ovrRow.appendChild(makeOvrField('OVR', 'overall', p.overall ?? null));
    ovrRow.appendChild(makeOvrField('Potential', 'potential', p.potential ?? null));
    card.appendChild(ovrRow);

    const chips = document.createElement('div');
    chips.className = 'fiction-chips';

    function saveIdentity(key, value) {
      const fp = Storage.get(Storage.KEYS.FICTION_PLAYER);
      if (!fp) return;
      fp[key] = value;
      Storage.set(Storage.KEYS.FICTION_PLAYER, fp);
    }

    function makeEditableChip(text, onCommit) {
      const chip = document.createElement('span');
      chip.className = 'setup-concept-chip fiction-chip-editable';
      chip.title = 'Tap to edit';

      const label = document.createElement('span');
      label.textContent = text;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'fiction-chip-input';
      input.value = text;

      chip.appendChild(label);
      chip.appendChild(input);

      label.addEventListener('click', () => {
        label.classList.add('hidden');
        input.classList.add('visible');
        input.focus();
        input.select();
      });

      const commit = () => {
        const val = input.value.trim();
        if (val) { label.textContent = val; onCommit(val); }
        label.classList.remove('hidden');
        input.classList.remove('visible');
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { input.blur(); }
        if (e.key === 'Escape') { label.classList.remove('hidden'); input.classList.remove('visible'); }
      });

      return chip;
    }

    // Age (read-only)
    if (p.age) {
      const chip = document.createElement('span');
      chip.className = 'setup-concept-chip';
      chip.textContent = `Age ${p.age}`;
      chips.appendChild(chip);
    }

    // Position (editable)
    if (p.position) {
      chips.appendChild(makeEditableChip(p.position, val => saveIdentity('position', val)));
    }

    // Alt positions (editable + deletable + add)
    const altPositions = p.alt_positions || [];
    altPositions.forEach((pos, idx) => {
      const chip = makeEditableChip(pos, val => {
        const fp = Storage.get(Storage.KEYS.FICTION_PLAYER);
        if (!fp) return;
        fp.alt_positions = (fp.alt_positions || []).map((p2, i) => i === idx ? val : p2);
        Storage.set(Storage.KEYS.FICTION_PLAYER, fp);
      });
      const del = document.createElement('button');
      del.className = 'fiction-ps-delete';
      del.textContent = '×';
      del.addEventListener('click', e => {
        e.stopPropagation();
        const fp = Storage.get(Storage.KEYS.FICTION_PLAYER);
        if (!fp) return;
        fp.alt_positions = (fp.alt_positions || []).filter((_, i) => i !== idx);
        Storage.set(Storage.KEYS.FICTION_PLAYER, fp);
        render();
      });
      chip.appendChild(del);
      chips.appendChild(chip);
    });

    // Add alt position button
    const addAltBtn = document.createElement('button');
    addAltBtn.className = 'fiction-chip-add';
    addAltBtn.textContent = '+ pos';
    addAltBtn.addEventListener('click', () => {
      const fp = Storage.get(Storage.KEYS.FICTION_PLAYER);
      if (!fp) return;
      fp.alt_positions = [...(fp.alt_positions || []), 'CAM'];
      Storage.set(Storage.KEYS.FICTION_PLAYER, fp);
      render();
    });
    chips.appendChild(addAltBtn);

    // Preferred foot (toggle)
    if (p.preferred_foot) {
      const footChip = document.createElement('span');
      footChip.className = 'setup-concept-chip fiction-chip-editable';
      footChip.textContent = `${p.preferred_foot} foot`;
      footChip.title = 'Tap to toggle';
      footChip.addEventListener('click', () => {
        const newFoot = p.preferred_foot === 'Right' ? 'Left' : 'Right';
        saveIdentity('preferred_foot', newFoot);
        footChip.textContent = `${newFoot} foot`;
        p.preferred_foot = newFoot;
      });
      chips.appendChild(footChip);
    }

    card.appendChild(chips);

    const physical = document.createElement('div');
    physical.className = 'fiction-physical-row';

    const WR_OPTS = ['High', 'Medium', 'Low'];

    function makePhysItem(label, valueEl) {
      const item = document.createElement('div');
      item.className = 'fiction-physical-item';
      const lbl = document.createElement('span');
      lbl.className = 'fiction-physical-label';
      lbl.textContent = label;
      item.appendChild(lbl);
      item.appendChild(valueEl);
      return item;
    }

    function makeNumberPhys(current, suffix, storageKey, min, max) {
      const val = document.createElement('span');
      val.className = 'fiction-physical-value fiction-stat-editable';
      val.title = 'Tap to edit';
      val.textContent = current ? `${current}${suffix}` : '—';

      const input = document.createElement('input');
      input.type = 'number';
      input.min = min; input.max = max;
      input.className = 'fiction-stat-input';
      input.value = current || '';
      input.style.width = '52px';

      val.addEventListener('click', () => { val.classList.add('hidden'); input.classList.add('visible'); input.focus(); input.select(); });
      const commit = () => {
        let v = parseInt(input.value);
        if (isNaN(v)) v = current;
        v = Math.max(min, Math.min(max, v));
        input.value = v;
        val.textContent = `${v}${suffix}`;
        val.classList.remove('hidden'); input.classList.remove('visible');
        saveIdentity(storageKey, v);
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { val.classList.remove('hidden'); input.classList.remove('visible'); } });

      const wrap = document.createElement('span');
      wrap.appendChild(val); wrap.appendChild(input);
      return wrap;
    }

    function makeStarsPhys(current, storageKey) {
      const val = document.createElement('span');
      val.className = 'fiction-physical-value fiction-stat-editable';
      val.title = 'Tap to change';
      let cur = current || 1;
      val.textContent = '★'.repeat(cur) + '☆'.repeat(5 - cur);
      val.addEventListener('click', () => {
        cur = (cur % 5) + 1;
        val.textContent = '★'.repeat(cur) + '☆'.repeat(5 - cur);
        saveIdentity(storageKey, cur);
      });
      return val;
    }

    function makeWorkRatePhys(att, def) {
      const wrap = document.createElement('span');
      wrap.className = 'fiction-physical-value';

      let curAtt = att || 'Medium';
      let curDef = def || 'Medium';

      const attSpan = document.createElement('span');
      attSpan.className = 'fiction-stat-editable';
      attSpan.title = 'Tap to change';
      attSpan.textContent = curAtt[0];
      attSpan.addEventListener('click', () => {
        curAtt = WR_OPTS[(WR_OPTS.indexOf(curAtt) + 1) % 3];
        attSpan.textContent = curAtt[0];
        saveIdentity('work_rate_att', curAtt);
      });

      const sep = document.createTextNode('/');

      const defSpan = document.createElement('span');
      defSpan.className = 'fiction-stat-editable';
      defSpan.title = 'Tap to change';
      defSpan.textContent = curDef[0];
      defSpan.addEventListener('click', () => {
        curDef = WR_OPTS[(WR_OPTS.indexOf(curDef) + 1) % 3];
        defSpan.textContent = curDef[0];
        saveIdentity('work_rate_def', curDef);
      });

      wrap.appendChild(attSpan); wrap.appendChild(sep); wrap.appendChild(defSpan);
      return wrap;
    }

    physical.appendChild(makePhysItem('Height',    makeNumberPhys(p.height,      'cm', 'height',      140, 210)));
    physical.appendChild(makePhysItem('Weight',    makeNumberPhys(p.weight,      'kg', 'weight',       40, 120)));
    physical.appendChild(makePhysItem('Weak Foot', makeStarsPhys(p.weak_foot,   'weak_foot')));
    physical.appendChild(makePhysItem('Skill',     makeStarsPhys(p.skill_moves, 'skill_moves')));
    physical.appendChild(makePhysItem('Work Rate', makeWorkRatePhys(p.work_rate_att, p.work_rate_def)));

    card.appendChild(physical);
    return card;
  }

  function _buildStatsCard(p) {
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('div');
    title.className = 'card-header';
    const t = document.createElement('span');
    t.className = 'card-title';
    t.textContent = 'Attributes';
    title.appendChild(t);
    card.appendChild(title);

    const groups = p.is_gk ? GK_STAT_GROUPS : STAT_GROUPS;
    const stats  = p.stats || {};

    groups.forEach(({ label, keys }) => {
      const validKeys = keys.filter(k => stats[k] != null);
      if (validKeys.length === 0) return;

      const groupAvg = Math.round(validKeys.reduce((sum, k) => sum + stats[k], 0) / validKeys.length);

      const group = document.createElement('div');
      group.className = 'fiction-stat-group';

      const groupHeader = document.createElement('div');
      groupHeader.className = 'fiction-stat-group-header';
      const groupLabel = document.createElement('span');
      groupLabel.className = 'fiction-stat-group-label';
      groupLabel.textContent = label;
      const groupAvgEl = document.createElement('span');
      groupAvgEl.className = 'fiction-stat-group-avg';
      groupAvgEl.textContent = groupAvg;
      groupAvgEl.style.color = _statColor(groupAvg);
      groupHeader.appendChild(groupLabel);
      groupHeader.appendChild(groupAvgEl);
      group.appendChild(groupHeader);

      const grid = document.createElement('div');
      grid.className = 'fiction-stats-grid';

      validKeys.forEach(k => {
        const val = stats[k];
        const row = document.createElement('div');
        row.className = 'fiction-stat-row';

        const nameEl = document.createElement('span');
        nameEl.className = 'fiction-stat-name';
        nameEl.textContent = STAT_LABELS[k] || k;

        const valEl = document.createElement('span');
        valEl.className = 'fiction-stat-value fiction-stat-editable';
        valEl.textContent = val;
        valEl.style.color = _statColor(val);
        valEl.title = 'Tap to edit';

        const input = document.createElement('input');
        input.type = 'number';
        input.min = 1;
        input.max = 99;
        input.className = 'fiction-stat-input';
        input.value = val;

        valEl.addEventListener('click', () => {
          valEl.classList.add('hidden');
          input.classList.add('visible');
          input.focus();
          input.select();
        });

        const commit = () => {
          let v = parseInt(input.value);
          if (isNaN(v)) v = val;
          v = Math.max(1, Math.min(99, v));
          input.value = v;
          valEl.textContent = v;
          valEl.style.color = _statColor(v);
          valEl.classList.remove('hidden');
          input.classList.remove('visible');
          _saveStat(k, v);
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter')  commit();
          if (e.key === 'Escape') {
            input.value = val;
            valEl.classList.remove('hidden');
            input.classList.remove('visible');
          }
        });

        row.appendChild(nameEl);
        row.appendChild(valEl);
        row.appendChild(input);
        grid.appendChild(row);
      });

      group.appendChild(grid);
      card.appendChild(group);
    });

    return card;
  }

  function _buildPlayStylesCard(p) {
    const styles         = p.play_styles              || [];
    const stylesPlus     = p.play_styles_plus         || [];
    const possible       = p.possible_play_styles     || [];
    const possiblePlus   = p.possible_play_styles_plus || [];

    const hasActive   = styles.length > 0 || stylesPlus.length > 0;
    const hasPossible = possible.length > 0 || possiblePlus.length > 0;
    if (!hasActive && !hasPossible) return document.createDocumentFragment();

    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('div');
    title.className = 'card-header';
    const t = document.createElement('span');
    t.className = 'card-title';
    t.textContent = 'PlayStyles';
    title.appendChild(t);
    card.appendChild(title);

    function makeChip(text, field, index, isPlus, isPossible) {
      const chip = document.createElement('span');
      chip.className = 'fiction-ps-chip' +
        (isPlus ? ' fiction-ps-chip--plus' : '') +
        (isPossible ? ' fiction-ps-chip--possible' : '');
      chip.textContent = text;

      if (!isPossible) {
        const del = document.createElement('button');
        del.className = 'fiction-ps-delete';
        del.textContent = '×';
        del.addEventListener('click', () => _deletePlayStyle(field, index));
        chip.appendChild(del);
      }

      return chip;
    }

    if (hasActive) {
      const wrap = document.createElement('div');
      wrap.className = 'fiction-playstyles';
      stylesPlus.forEach((s, i) => wrap.appendChild(makeChip(s.endsWith('+') ? s : s + ' +', 'play_styles_plus', i, true, false)));
      styles.forEach((s, i)     => wrap.appendChild(makeChip(s, 'play_styles', i, false, false)));
      card.appendChild(wrap);
    }

    if (hasPossible) {
      const divider = document.createElement('div');
      divider.className = 'fiction-ps-divider';
      const label = document.createElement('span');
      label.className = 'fiction-ps-possible-label';
      label.textContent = 'Possible';
      divider.appendChild(label);
      card.appendChild(divider);

      const possWrap = document.createElement('div');
      possWrap.className = 'fiction-playstyles';
      possiblePlus.forEach((s, i) => possWrap.appendChild(makeChip(s.endsWith('+') ? s : s + ' +', 'possible_play_styles_plus', i, true, true)));
      possible.forEach((s, i)     => possWrap.appendChild(makeChip(s, 'possible_play_styles', i, false, true)));
      card.appendChild(possWrap);
    }

    return card;
  }

  function _deletePlayStyle(field, index) {
    const fp = Storage.get(Storage.KEYS.FICTION_PLAYER);
    if (!fp) return;
    fp[field] = (fp[field] || []).filter((_, i) => i !== index);
    Storage.set(Storage.KEYS.FICTION_PLAYER, fp);
    render();
  }

  function _saveStat(key, value) {
    const fp = Storage.get(Storage.KEYS.FICTION_PLAYER);
    if (!fp?.stats) return;
    fp.stats[key] = value;
    Storage.set(Storage.KEYS.FICTION_PLAYER, fp);
  }

  async function _updateStats() {
    const setup = Storage.get(Storage.KEYS.SETUP);
    if (!setup?.player?.name) {
      App.showError('No fiction player found.');
      return;
    }

    const btn = _container.querySelector('#fiction-update-btn');
    if (btn) {
      btn.disabled = true;
      btn.replaceChildren();
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      spinner.style.cssText = 'width:14px;height:14px;display:inline-block;margin-right:8px;flex-shrink:0;';
      btn.appendChild(spinner);
      btn.appendChild(document.createTextNode('Updating…'));
    }

    try {
      const result = await API.updateFictionPlayer();
      const current = Storage.get(Storage.KEYS.FICTION_PLAYER) || {};
      // Only update stats + playstyles, keep identity intact
      Storage.set(Storage.KEYS.FICTION_PLAYER, {
        ...current,
        overall:                   result.overall                   ?? current.overall,
        stats:                     result.stats                     || current.stats,
        play_styles:               result.play_styles               || current.play_styles,
        play_styles_plus:          result.play_styles_plus          || current.play_styles_plus,
        possible_play_styles:      result.possible_play_styles      || current.possible_play_styles,
        possible_play_styles_plus: result.possible_play_styles_plus || current.possible_play_styles_plus,
      });
      render();
      App.showToast('Stats updated for current season');
    } catch (err) {
      App.showError(err.message);
      if (btn) {
        btn.disabled = false;
        btn.replaceChildren();
        const i = document.createElement('i');
        i.setAttribute('data-lucide', 'trending-up');
        btn.appendChild(i);
        btn.appendChild(document.createTextNode(' Update Stats'));
        lucide.createIcons();
      }
    }
  }

  async function _generatePlayer() {
    const setup = Storage.get(Storage.KEYS.SETUP);
    if (!setup?.player?.name) {
      App.showError('Create your fiction concept in Setup first.');
      return;
    }

    const btn = _container.querySelector('#fiction-generate-btn');
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
      const result = await API.generateFictionPlayer();
      Storage.set(Storage.KEYS.FICTION_PLAYER, result);
      render();
      App.showToast('Player card generated');
    } catch (err) {
      App.showError(err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.replaceChildren();
        const i = document.createElement('i');
        i.setAttribute('data-lucide', 'sparkles');
        btn.appendChild(i);
        btn.appendChild(document.createTextNode(' Generate Player'));
        lucide.createIcons();
      }
    }
  }

  return { init, render };
})();
