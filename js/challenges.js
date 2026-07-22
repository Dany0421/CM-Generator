const ChallengesModule = (() => {
  let _container = null;

  // Default challenge set: type + how many of each
  const DEFAULT_SET = [
    { type: 'season_objective',    label: 'Season Objective',    icon: 'calendar-check',  badgeClass: 'badge-season'   },
    { type: 'transfer_rule',       label: 'Transfer Rule',       icon: 'arrow-right-left', badgeClass: 'badge-transfer' },
    { type: 'performance_trigger', label: 'Performance Trigger', icon: 'zap',             badgeClass: 'badge-trigger'  },
    { type: 'performance_trigger', label: 'Performance Trigger', icon: 'zap',             badgeClass: 'badge-trigger'  },
    { type: 'player_challenge',    label: 'Player Challenge',    icon: 'user-round',      badgeClass: 'badge-player'   },
    { type: 'chaos',               label: 'Chaos Challenge',     icon: 'dices',           badgeClass: 'badge-chaos'    },
  ];

  const TYPE_META = {
    season_objective:     { label: 'Season Objective',      icon: 'calendar-check',   badgeClass: 'badge-season'   },
    transfer_rule:        { label: 'Transfer Rule',          icon: 'arrow-right-left', badgeClass: 'badge-transfer' },
    performance_trigger:  { label: 'Performance Trigger',    icon: 'zap',              badgeClass: 'badge-trigger'  },
    player_challenge:     { label: 'Player Challenge',       icon: 'user-round',       badgeClass: 'badge-player'   },
    chaos:                { label: 'Chaos Challenge',        icon: 'dices',            badgeClass: 'badge-chaos'    },
    performance_arc:      { label: 'Performance Arc',        icon: 'trending-up',      badgeClass: 'badge-trigger'  },
    development_milestone:{ label: 'Development Milestone',  icon: 'star',             badgeClass: 'badge-player'   },
    career_decision:      { label: 'Career Decision',        icon: 'git-branch',       badgeClass: 'badge-season'   },
  };

  const PLAYER_DEFAULT_SET = [
    { type: 'performance_arc',        label: 'Performance Arc',         icon: 'trending-up',  badgeClass: 'badge-trigger'  },
    { type: 'development_milestone',  label: 'Development Milestone',   icon: 'star',         badgeClass: 'badge-player'   },
    { type: 'career_decision',        label: 'Career Decision',         icon: 'git-branch',   badgeClass: 'badge-season'   },
  ];

  const DIFF_CLASS = { Mild: 'badge-mild', Brutal: 'badge-brutal', Savage: 'badge-savage' };

  // Progress is computed, never accumulated: summed on the fly from the
  // season's Estádio match entries (entry.match). Editing/deleting an entry
  // recalculates by itself. Team mode reads team goals (gf); solo modes read
  // the player's own numbers.
  function computeProgress(metric, entries, isSolo) {
    let value = 0;
    let rated = 0;
    for (const e of entries) {
      const m = e && e.match;
      if (!m || !m.outcome) continue;
      switch (metric) {
        case 'goals':        value += isSolo ? (m.playerGoals || 0) : (m.outcome.gf || 0); break;
        case 'assists':      value += m.playerAssists || 0; break;
        case 'wins':         if (m.outcome.res === 'W') value++; break;
        case 'clean_sheets': if ((m.outcome.ga || 0) === 0) value++; break;
        case 'rating_avg':   if (m.playerRating) { value += m.playerRating; rated++; } break;
      }
    }
    if (metric === 'rating_avg') return rated ? Math.round((value / rated) * 10) / 10 : 0;
    return value;
  }

  function _seasonMatchEntries() {
    const season = Storage.get(Storage.KEYS.SETUP)?.season || 1;
    return (Storage.get(Storage.KEYS.HUB)?.log || [])
      .filter(e => e && !e.isDivider && e.match?.outcome && e.match.season === season);
  }

  // Career World view filter (Fase 3): 'balneario' = duo challenges (player
  // mode, linked name in the text) / player_challenge (team mode); 'rest' =
  // everything else (Club Office). null (index.html) shows all.
  let _view = null;

  function isBalnearioChallenge(ch, setup) {
    if (setup?.mode === 'player' || setup?.mode === 'fiction') {
      const linked = setup?.player?.linked?.name;
      if (!linked) return false;
      return `${ch.title} ${ch.description} ${ch.hub_line || ''}`
        .toLowerCase().includes(linked.trim().toLowerCase());
    }
    return ch.type === 'player_challenge';
  }

  function _inView(ch) {
    if (!_view || !_view.only) return true;
    const setup = Storage.get(Storage.KEYS.SETUP);
    const isBaln = isBalnearioChallenge(ch, setup);
    return _view.only === 'balneario' ? isBaln : !isBaln;
  }

  function init(container) {
    _container = container;
    render();
  }

  function render(view) {
    if (view !== undefined) _view = view;
    _container.replaceChildren();
    _container.appendChild(_buildHeader());

    const challenges = Storage.get(Storage.KEYS.CHALLENGES);
    if (!challenges || challenges.length === 0) {
      _container.appendChild(_view?.only === 'balneario' ? _buildViewEmpty() : _buildEmpty());
    } else {
      const grid = _buildGrid(challenges);
      _container.appendChild(grid.childElementCount ? grid : _buildViewEmpty());
    }

    lucide.createIcons();
  }

  function _buildViewEmpty() {
    const wrap = document.createElement('div');
    wrap.className = 'card challenge-empty';
    const p = document.createElement('p');
    p.textContent = _view?.only === 'balneario'
      ? 'Sem challenges do balneário nesta época — os duo challenges (e o Player Challenge em team mode) aparecem aqui quando gerados no Club Office.'
      : 'Sem challenges desta location.';
    wrap.appendChild(p);
    return wrap;
  }

  function _buildHeader() {
    const frag = document.createRange().createContextualFragment(`
      <div class="module-header">
        <div class="module-title-group">
          <span class="module-label">Module 3</span>
          <h1 class="module-title">Challenges</h1>
        </div>
        <div class="module-actions">
          <button class="btn-secondary" id="challenges-regen-all">
            <i data-lucide="refresh-cw"></i>
            Regenerate All
          </button>
        </div>
      </div>
    `);

    // Regenerate All rewrites the whole set — Club Office/index only
    if (_view?.only === 'balneario') frag.querySelector('#challenges-regen-all').remove();
    else frag.querySelector('#challenges-regen-all').addEventListener('click', _generateAll);
    const titleEl = frag.querySelector('.module-title');
    if (_view?.title) titleEl.textContent = _view.title;
    return frag;
  }

  function _buildEmpty() {
    const setup    = Storage.get(Storage.KEYS.SETUP);
    const isPlayer = setup?.mode === 'player' || setup?.mode === 'fiction';
    const wrap     = document.createElement('div');
    wrap.className = 'card challenge-empty';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'crosshair');
    wrap.appendChild(icon);

    const p = document.createElement('p');
    if (setup?.club) {
      p.textContent = isPlayer
        ? 'No active challenges. Generate 3 player career challenges tailored to your player.'
        : 'No active challenges. Generate your default set — 6 challenges across all types.';
    } else {
      p.textContent = 'Fill in your Save Setup first so challenges are generated for the right club and context.';
    }
    wrap.appendChild(p);

    if (setup?.club) {
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      const i = document.createElement('i');
      i.setAttribute('data-lucide', 'sparkles');
      btn.appendChild(i);
      btn.appendChild(document.createTextNode(' Generate Challenges'));
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

  function _buildGrid(challenges) {
    const grid = document.createElement('div');
    grid.className = 'challenge-grid';
    grid.id = 'challenges-grid';

    challenges.forEach((ch, index) => {
      if (!_inView(ch)) return; // index into storage stays the original one
      grid.appendChild(_buildCard(ch, index));
    });

    return grid;
  }

  function _buildCard(ch, index) {
    const card = document.createElement('div');
    card.className = 'challenge-card';
    card.dataset.index = index;

    // Top row: badges + regen button
    const top = document.createElement('div');
    top.className = 'challenge-card-top';

    const badges = document.createElement('div');
    badges.className = 'challenge-badges';

    const meta = TYPE_META[ch.type] || { label: ch.type, icon: 'circle', badgeClass: 'badge-season' };

    const typeBadge = document.createElement('span');
    typeBadge.className = `badge ${meta.badgeClass}`;
    const typeIcon = document.createElement('i');
    typeIcon.setAttribute('data-lucide', meta.icon);
    typeBadge.appendChild(typeIcon);
    typeBadge.appendChild(document.createTextNode(' ' + meta.label));
    badges.appendChild(typeBadge);

    if (ch.difficulty) {
      const diffBadge = document.createElement('span');
      diffBadge.className = `badge ${DIFF_CLASS[ch.difficulty] || 'badge-mild'}`;
      diffBadge.textContent = ch.difficulty;
      badges.appendChild(diffBadge);
    }

    top.appendChild(badges);

    const regenBtn = document.createElement('button');
    regenBtn.className = 'icon-btn';
    regenBtn.title = 'Regenerate this challenge';
    const regenIcon = document.createElement('i');
    regenIcon.setAttribute('data-lucide', 'refresh-cw');
    regenBtn.appendChild(regenIcon);
    regenBtn.addEventListener('click', () => _regenerateChallenge(index));
    top.appendChild(regenBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.title = 'Delete this challenge';
    const delIcon = document.createElement('i');
    delIcon.setAttribute('data-lucide', 'x');
    delBtn.appendChild(delIcon);
    delBtn.addEventListener('click', () => {
      const chs = Storage.get(Storage.KEYS.CHALLENGES) || [];
      chs.splice(index, 1);
      Storage.set(Storage.KEYS.CHALLENGES, chs);
      render();
    });
    top.appendChild(delBtn);

    card.appendChild(top);

    // Title (tap to edit)
    const titleEl = document.createElement('p');
    titleEl.className = 'challenge-title narrative-text-editable';
    titleEl.title = 'Tap to edit';
    titleEl.textContent = ch.title || '';

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'challenge-edit-input';
    titleInput.value = ch.title || '';

    titleEl.addEventListener('click', () => { titleEl.classList.add('hidden'); titleInput.classList.add('visible'); titleInput.focus(); titleInput.select(); });
    const commitTitle = () => {
      const val = titleInput.value.trim() || ch.title;
      titleEl.textContent = val; titleEl.classList.remove('hidden'); titleInput.classList.remove('visible');
      const chs = Storage.get(Storage.KEYS.CHALLENGES) || []; if (chs[index]) { chs[index].title = val; delete chs[index].hub_line; Storage.set(Storage.KEYS.CHALLENGES, chs); }
    };
    titleInput.addEventListener('blur', commitTitle);
    titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { titleEl.classList.remove('hidden'); titleInput.classList.remove('visible'); } });

    card.appendChild(titleEl);
    card.appendChild(titleInput);

    // Description (tap to edit)
    const descEl = document.createElement('p');
    descEl.className = 'challenge-description narrative-text-editable';
    descEl.title = 'Tap to edit';
    descEl.textContent = ch.description || '';

    const descInput = document.createElement('textarea');
    descInput.className = 'narrative-edit-input';
    descInput.value = ch.description || '';

    descEl.addEventListener('click', () => { descEl.classList.add('hidden'); descInput.classList.add('visible'); descInput.style.height = descInput.scrollHeight + 'px'; descInput.focus(); descInput.select(); });
    const commitDesc = () => {
      const val = descInput.value.trim() || ch.description;
      descEl.textContent = val; descEl.classList.remove('hidden'); descInput.classList.remove('visible');
      const chs = Storage.get(Storage.KEYS.CHALLENGES) || []; if (chs[index]) { chs[index].description = val; delete chs[index].hub_line; Storage.set(Storage.KEYS.CHALLENGES, chs); }
    };
    descInput.addEventListener('blur', commitDesc);
    descInput.addEventListener('keydown', e => { if (e.key === 'Escape') { descEl.classList.remove('hidden'); descInput.classList.remove('visible'); } });

    card.appendChild(descEl);
    card.appendChild(descInput);

    // Auto-tracked progress (metric/target from generation; old saves have none)
    if (ch.metric && ch.metric !== 'none' && ch.target > 0) {
      const mode = Storage.get(Storage.KEYS.SETUP)?.mode;
      const isSolo = mode === 'player' || mode === 'fiction';
      const value = computeProgress(ch.metric, _seasonMatchEntries(), isSolo);
      const done = value >= ch.target;
      const prog = document.createElement('div');
      prog.className = 'challenge-progress';
      const bar = document.createElement('div');
      bar.className = 'challenge-progress-bar';
      const fill = document.createElement('div');
      fill.className = 'challenge-progress-fill' + (done ? ' done' : '');
      fill.style.width = `${Math.min(100, (value / ch.target) * 100)}%`;
      bar.appendChild(fill);
      prog.appendChild(bar);
      const lbl = document.createElement('span');
      lbl.className = 'challenge-progress-label';
      lbl.textContent = `${value} / ${ch.target} ${ch.metric.replace('_', ' ')}`;
      prog.appendChild(lbl);
      card.appendChild(prog);
    }

    // Duration (tap to edit)
    if (ch.duration && ch.duration !== '—') {
      const wrap = document.createElement('div');
      wrap.className = 'challenge-meta-item';

      const lbl = document.createElement('span');
      lbl.className = 'challenge-meta-label';
      lbl.textContent = 'Duration';

      const val = document.createElement('span');
      val.className = 'challenge-meta-value narrative-text-editable';
      val.title = 'Tap to edit';
      val.textContent = ch.duration;

      const durInput = document.createElement('input');
      durInput.type = 'text';
      durInput.className = 'challenge-edit-input';
      durInput.value = ch.duration;
      durInput.style.marginBottom = '0';

      val.addEventListener('click', () => { val.classList.add('hidden'); durInput.classList.add('visible'); durInput.focus(); durInput.select(); });
      const commitDur = () => {
        const v = durInput.value.trim() || ch.duration;
        val.textContent = v; val.classList.remove('hidden'); durInput.classList.remove('visible');
        const chs = Storage.get(Storage.KEYS.CHALLENGES) || [];
        if (chs[index]) { chs[index].duration = v; delete chs[index].hub_line; Storage.set(Storage.KEYS.CHALLENGES, chs); }
      };
      durInput.addEventListener('blur', commitDur);
      durInput.addEventListener('keydown', e => { if (e.key === 'Enter') commitDur(); if (e.key === 'Escape') { val.classList.remove('hidden'); durInput.classList.remove('visible'); } });

      wrap.appendChild(lbl);
      wrap.appendChild(val);
      wrap.appendChild(durInput);
      card.appendChild(wrap);
    }

    return card;
  }

  function _buildMetaItem(label, value) {
    const wrap = document.createElement('div');
    wrap.className = 'challenge-meta-item';

    const lbl = document.createElement('span');
    lbl.className = 'challenge-meta-label';
    lbl.textContent = label;

    const val = document.createElement('span');
    val.className = 'challenge-meta-value';
    val.textContent = value;

    wrap.appendChild(lbl);
    wrap.appendChild(val);
    return wrap;
  }

  function _buildSkeletonCard() {
    const card = document.createElement('div');
    card.className = 'challenge-card';

    const top = document.createElement('div');
    top.className = 'challenge-card-top';
    const sk1 = document.createElement('div');
    sk1.className = 'skeleton';
    sk1.style.cssText = 'width:120px;height:22px;';
    top.appendChild(sk1);
    card.appendChild(top);

    const sk2 = document.createElement('div');
    sk2.className = 'skeleton skeleton-title';
    sk2.style.marginBottom = '12px';
    card.appendChild(sk2);

    const sk3 = document.createElement('div');
    sk3.className = 'skeleton skeleton-block';
    card.appendChild(sk3);

    return card;
  }

  function _cardSetLoading(card) {
    card.replaceChildren();
    const loadEl = document.createElement('div');
    loadEl.className = 'section-loading';
    loadEl.style.padding = '24px 0';
    loadEl.style.justifyContent = 'center';
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    const txt = document.createElement('span');
    txt.textContent = 'Generating…';
    loadEl.appendChild(spinner);
    loadEl.appendChild(txt);
    card.appendChild(loadEl);
  }

  // ── API Calls ────────────────────────────────────────────────

  async function _generateAll() {
    const setup    = Storage.get(Storage.KEYS.SETUP);
    const isPlayer = setup?.mode === 'player' || setup?.mode === 'fiction';
    if (!setup?.club) {
      App.showError('Fill in your Save Setup first.');
      return;
    }

    const regenBtn = _container.querySelector('#challenges-regen-all');
    if (regenBtn) regenBtn.disabled = true;

    let grid = _container.querySelector('#challenges-grid');
    if (!grid) {
      _container.replaceChildren();
      _container.appendChild(_buildHeader());
      grid = document.createElement('div');
      grid.className = 'challenge-grid';
      grid.id = 'challenges-grid';
      _container.appendChild(grid);
    }

    const activeSet = isPlayer ? PLAYER_DEFAULT_SET : DEFAULT_SET;
    grid.replaceChildren();
    activeSet.forEach(() => grid.appendChild(_buildSkeletonCard()));
    lucide.createIcons();

    const prevData = Storage.get(Storage.KEYS.CHALLENGES);
    let results    = [];

    if (isPlayer) {
      // single call returns array of 3
      try {
        results = await API.generatePlayerChallenges();
        // Ensure we have exactly 3
        while (results.length < 3) results.push({ type: 'career_decision', title: 'Failed', description: 'Retry', duration: '—', stakes: '—', difficulty: 'Mild', hub_line: '—' });
        results = results.slice(0, 3);
      } catch (err) {
        results = activeSet.map(s => ({ type: s.type, title: 'Generation failed', description: err.message, duration: '—', stakes: '—', difficulty: 'Mild', hub_line: '—' }));
      }
      results.forEach((ch, i) => {
        const newCard = _buildCard(ch, i);
        grid.children[i].replaceWith(newCard);
      });
      lucide.createIcons();
    } else {
      for (let i = 0; i < activeSet.length; i++) {
        const { type } = activeSet[i];
        const cardEl = grid.children[i];
        _cardSetLoading(cardEl);
        try {
          const ch = await API.generateChallenge(type);
          results.push(ch);
          const newCard = _buildCard(ch, i);
          cardEl.replaceWith(newCard);
          lucide.createIcons();
        } catch (err) {
          results.push({ type, title: 'Generation failed', description: err.message, duration: '—', stakes: '—', difficulty: 'Mild' });
          const errCard = _buildCard(results[i], i);
          cardEl.replaceWith(errCard);
          lucide.createIcons();
        }
      }
    }

    const undoFn = Storage.saveWithUndo(Storage.KEYS.CHALLENGES, results);
    App.showToast('Challenges generated', prevData ? () => { undoFn(); render(); } : null);

    if (regenBtn) regenBtn.disabled = false;
  }

  async function _regenerateChallenge(index) {
    const grid   = _container.querySelector('#challenges-grid');
    if (!grid) return;
    const cardEl = grid.querySelector(`[data-index="${index}"]`);
    if (!cardEl) return;

    const setup       = Storage.get(Storage.KEYS.SETUP);
    const isPlayer    = setup?.mode === 'player' || setup?.mode === 'fiction';
    const activeSet   = isPlayer ? PLAYER_DEFAULT_SET : DEFAULT_SET;
    const challenges  = Storage.get(Storage.KEYS.CHALLENGES) || [];
    const currentType = challenges[index]?.type || activeSet[index]?.type || 'chaos';

    _cardSetLoading(cardEl);

    const prevChallenges = [...challenges];

    try {
      const ch = isPlayer
        ? await API.generateSinglePlayerChallenge(currentType)
        : await API.generateChallenge(currentType);
      const updated = [...challenges];
      updated[index] = ch;

      const undoFn = Storage.saveWithUndo(Storage.KEYS.CHALLENGES, updated);

      const newCard = _buildCard(ch, index);
      cardEl.replaceWith(newCard);
      lucide.createIcons();

      App.showToast('Challenge regenerated', () => {
        undoFn();
        const restored = _buildCard(prevChallenges[index], index);
        newCard.replaceWith(restored);
        lucide.createIcons();
      });

    } catch (err) {
      _cardSetLoading(cardEl);
      const errCard = _buildCard({ type: currentType, title: 'Error', description: err.message, duration: '—', stakes: '—', difficulty: 'Mild' }, index);
      cardEl.replaceWith(errCard);
      lucide.createIcons();
      App.showError(err.message);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeProgress, isBalnearioChallenge };
  }
  return { init, render, isBalnearioChallenge };
})();
