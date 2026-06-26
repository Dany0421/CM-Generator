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
    const frag = document.createRange().createContextualFragment(`
      <div class="module-header">
        <div class="module-title-group">
          <span class="module-label">Fiction</span>
          <h1 class="module-title">Player Creation</h1>
        </div>
        <div class="module-actions">
          <button class="btn-secondary" id="fiction-generate-btn">
            <i data-lucide="sparkles"></i>
            Generate Player
          </button>
        </div>
      </div>
    `);
    frag.querySelector('#fiction-generate-btn').addEventListener('click', _generatePlayer);
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

    const chips = document.createElement('div');
    chips.className = 'fiction-chips';

    const chipsData = [
      p.age ? `Age ${p.age}` : null,
      p.position || null,
      ...(p.alt_positions || []),
      p.preferred_foot ? `${p.preferred_foot} foot` : null,
    ].filter(Boolean);

    chipsData.forEach(text => {
      const chip = document.createElement('span');
      chip.className = 'setup-concept-chip';
      chip.textContent = text;
      chips.appendChild(chip);
    });
    card.appendChild(chips);

    const physical = document.createElement('div');
    physical.className = 'fiction-physical-row';

    const physItems = [
      { label: 'Height',     value: p.height ? `${p.height}cm` : '—' },
      { label: 'Weight',     value: p.weight ? `${p.weight}kg` : '—' },
      { label: 'Weak Foot',  value: p.weak_foot  ? '★'.repeat(p.weak_foot)  + '☆'.repeat(5 - p.weak_foot)  : '—' },
      { label: 'Skill',      value: p.skill_moves ? '★'.repeat(p.skill_moves) + '☆'.repeat(5 - p.skill_moves) : '—' },
      { label: 'Work Rate',  value: p.work_rate_att && p.work_rate_def ? `${p.work_rate_att[0]}/${p.work_rate_def[0]}` : '—' },
    ];

    physItems.forEach(({ label, value }) => {
      const item = document.createElement('div');
      item.className = 'fiction-physical-item';
      const lbl = document.createElement('span');
      lbl.className = 'fiction-physical-label';
      lbl.textContent = label;
      const val = document.createElement('span');
      val.className = 'fiction-physical-value';
      val.textContent = value;
      item.appendChild(lbl);
      item.appendChild(val);
      physical.appendChild(item);
    });

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
        valEl.className = 'fiction-stat-value';
        valEl.textContent = val;
        valEl.style.color = _statColor(val);

        row.appendChild(nameEl);
        row.appendChild(valEl);
        grid.appendChild(row);
      });

      group.appendChild(grid);
      card.appendChild(group);
    });

    return card;
  }

  function _buildPlayStylesCard(p) {
    const styles     = p.play_styles     || [];
    const stylesPlus = p.play_styles_plus || [];
    if (styles.length === 0 && stylesPlus.length === 0) return document.createDocumentFragment();

    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('div');
    title.className = 'card-header';
    const t = document.createElement('span');
    t.className = 'card-title';
    t.textContent = 'PlayStyles';
    title.appendChild(t);
    card.appendChild(title);

    const wrap = document.createElement('div');
    wrap.className = 'fiction-playstyles';

    stylesPlus.forEach(s => {
      const chip = document.createElement('span');
      chip.className = 'fiction-ps-chip fiction-ps-chip--plus';
      chip.textContent = s.endsWith('+') ? s : s + ' +';
      wrap.appendChild(chip);
    });

    styles.forEach(s => {
      const chip = document.createElement('span');
      chip.className = 'fiction-ps-chip';
      chip.textContent = s;
      wrap.appendChild(chip);
    });

    card.appendChild(wrap);
    return card;
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
