const RulesetModule = (() => {
  let _container = null;

  const SECTIONS = [
    { key: 'squad_rules',    label: 'Squad Rules',     icon: 'users'          },
    { key: 'transfer_rules', label: 'Transfer Rules',  icon: 'arrow-right-left' },
    { key: 'gameplay_rules', label: 'Gameplay Rules',  icon: 'gamepad-2'      },
  ];

  function _maxRules() {
    return Storage.get(Storage.KEYS.SETUP)?.mode === 'player' ? 2 : 3;
  }

  const MECHANIC_LABELS = {
    chaos_wheel:      'Chaos Wheel',
    protected_player: 'Protected Player',
    academy_tracker:  'Academy Tracker',
  };

  function _defaultRuleset() {
    return {
      squad_rules:    [],
      transfer_rules: [],
      gameplay_rules: [],
      special_mechanics: { chaos_wheel: '', protected_player: '', academy_tracker: '' },
    };
  }

  function _getRuleset() {
    return Storage.get(Storage.KEYS.RULESET) || _defaultRuleset();
  }

  function _saveRuleset(data) {
    Storage.set(Storage.KEYS.RULESET, data);
  }

  function init(container) {
    _container = container;
    render();
  }

  function render() {
    _container.replaceChildren();
    _container.appendChild(_buildHeader());

    const ruleset = _getRuleset();

    // Rules sections
    SECTIONS.forEach(({ key, label, icon }) => {
      _container.appendChild(_buildRulesSection(key, label, icon, ruleset[key] || []));
    });

    // Special Mechanics
    _container.appendChild(_buildMechanicsCard(ruleset.special_mechanics || {}));

    lucide.createIcons();
  }

  function _buildHeader() {
    const frag = document.createRange().createContextualFragment(`
      <div class="module-header">
        <div class="module-title-group">
          <span class="module-label">Module 4</span>
          <h1 class="module-title">Ruleset</h1>
        </div>
        <div class="module-actions">
          <button class="btn-secondary" id="ruleset-ai-suggest">
            <i data-lucide="sparkles"></i>
            AI Suggest
          </button>
        </div>
      </div>
    `);

    frag.querySelector('#ruleset-ai-suggest').addEventListener('click', _aiSuggest);
    return frag;
  }

  function _buildRulesSection(key, label, iconName, rules) {
    const card = document.createElement('div');
    card.className = 'card ruleset-section';
    card.dataset.sectionKey = key;

    // Section header
    const header = document.createElement('div');
    header.className = 'ruleset-section-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'ruleset-section-title';
    const iconEl = document.createElement('i');
    iconEl.setAttribute('data-lucide', iconName);
    titleWrap.appendChild(iconEl);
    const titleText = document.createElement('span');
    titleText.textContent = label;
    titleWrap.appendChild(titleText);
    header.appendChild(titleWrap);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-accent-ghost';
    const addIcon = document.createElement('i');
    addIcon.setAttribute('data-lucide', 'plus');
    addBtn.appendChild(addIcon);
    addBtn.appendChild(document.createTextNode(' Add Rule'));
    addBtn.id = `add-rule-btn-${key}`;
    if (rules.length >= _maxRules()) addBtn.style.display = 'none';
    addBtn.addEventListener('click', () => _addRule(key));
    header.appendChild(addBtn);

    card.appendChild(header);

    // Rules list
    const listEl = document.createElement('div');
    listEl.className = 'rules-list';
    listEl.id = `rules-list-${key}`;

    if (rules.length === 0) {
      listEl.appendChild(_buildEmptyRuleText());
    } else {
      rules.forEach((rule, i) => {
        listEl.appendChild(_buildRuleItem(key, rule, i));
      });
    }

    card.appendChild(listEl);
    return card;
  }

  function _buildEmptyRuleText() {
    const p = document.createElement('p');
    p.className = 'ruleset-empty-text';
    p.textContent = 'No rules yet. Add your own or use AI Suggest.';
    return p;
  }

  function _buildRuleItem(sectionKey, text, index) {
    const item = document.createElement('div');
    item.className = 'rule-item';
    item.dataset.index = index;

    const dot = document.createElement('div');
    dot.className = 'rule-dot';
    item.appendChild(dot);

    const textEl = document.createElement('span');
    textEl.className = 'rule-text';
    textEl.textContent = text;
    textEl.title = 'Click to edit';
    item.appendChild(textEl);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'rule-edit-input';
    input.value = text;
    item.appendChild(input);

    const rerollBtn = document.createElement('button');
    rerollBtn.className = 'rule-reroll-btn icon-btn';
    rerollBtn.title = 'Reroll this rule';
    const rerollIcon = document.createElement('i');
    rerollIcon.setAttribute('data-lucide', 'refresh-cw');
    rerollBtn.appendChild(rerollIcon);
    item.appendChild(rerollBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'rule-delete-btn';
    deleteBtn.title = 'Remove rule';
    const delIcon = document.createElement('i');
    delIcon.setAttribute('data-lucide', 'x');
    deleteBtn.appendChild(delIcon);
    item.appendChild(deleteBtn);

    // Click to edit
    textEl.addEventListener('click', () => {
      textEl.classList.add('editing');
      input.classList.add('editing');
      input.focus();
      input.select();
    });

    // Commit edit on blur/enter
    const commitEdit = () => {
      const val = input.value.trim();
      textEl.classList.remove('editing');
      input.classList.remove('editing');
      if (!val) {
        _deleteRule(sectionKey, index);
        return;
      }
      textEl.textContent = val;
      _updateRule(sectionKey, index, val);
    };

    input.addEventListener('blur', commitEdit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { commitEdit(); }
      if (e.key === 'Escape') {
        input.value = text;
        textEl.classList.remove('editing');
        input.classList.remove('editing');
      }
    });

    rerollBtn.addEventListener('click', () => _rerollRule(sectionKey, index, item));
    deleteBtn.addEventListener('click', () => _deleteRule(sectionKey, index));

    return item;
  }

  async function _rerollRule(sectionKey, index, item) {
    const textEl    = item.querySelector('.rule-text');
    const rerollBtn = item.querySelector('.rule-reroll-btn');
    const deleteBtn = item.querySelector('.rule-delete-btn');

    if (rerollBtn) rerollBtn.disabled = true;
    if (deleteBtn) deleteBtn.disabled = true;
    if (textEl)   textEl.style.opacity = '0.4';

    try {
      const result  = await API.generateSingleRule(sectionKey);
      const newText = result.rule || '';

      _updateRule(sectionKey, index, newText);

      if (textEl) {
        textEl.textContent = newText;
        textEl.style.opacity = '';
      }
      const input = item.querySelector('.rule-edit-input');
      if (input) input.value = newText;

    } catch (err) {
      App.showError(err.message);
      if (textEl) textEl.style.opacity = '';
    } finally {
      if (rerollBtn) rerollBtn.disabled = false;
      if (deleteBtn) deleteBtn.disabled = false;
      lucide.createIcons();
    }
  }

  function _buildMechanicsCard(mechanics) {
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'mechanics-card';

    const header = document.createElement('div');
    header.className = 'card-header';
    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = 'Special Mechanics';
    header.appendChild(title);
    card.appendChild(header);

    const wrap = document.createElement('div');
    wrap.className = 'special-mechanics';

    const isPlayer = Storage.get(Storage.KEYS.SETUP)?.mode === 'player';
    const playerHiddenMechanics = new Set(['protected_player', 'academy_tracker']);

    Object.entries(MECHANIC_LABELS).forEach(([key, label]) => {
      if (isPlayer && playerHiddenMechanics.has(key)) return;

      const item = document.createElement('div');
      item.className = 'mechanic-item';

      const labelRow = document.createElement('div');
      labelRow.className = 'mechanic-label-row';

      const lbl = document.createElement('div');
      lbl.className = 'mechanic-label';
      lbl.textContent = label;
      labelRow.appendChild(lbl);

      const regenBtn = document.createElement('button');
      regenBtn.className = 'icon-btn';
      regenBtn.title = 'Regenerate ' + label;
      const regenIcon = document.createElement('i');
      regenIcon.setAttribute('data-lucide', 'refresh-cw');
      regenBtn.appendChild(regenIcon);
      regenBtn.addEventListener('click', () => _regenerateMechanic(key));
      labelRow.appendChild(regenBtn);

      item.appendChild(labelRow);

      const textarea = document.createElement('textarea');
      textarea.className = 'mechanic-textarea';
      textarea.id = `mechanic-${key}`;
      textarea.value = mechanics[key] || '';

      const placeholders = {
        chaos_wheel:      'e.g. Spin on every 3rd loss — consequence can be sell top scorer for €1, switch formation permanently, or ban a position for 5 games',
        protected_player: 'e.g. Nominated before season start — must start 70%+ of matches, immune to all selling rules',
        academy_tracker:  'e.g. Track up to 3 youth players — each must hit 10 appearances or gets released',
      };
      textarea.placeholder = placeholders[key] || '';

      const autoResize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      };
      textarea.addEventListener('input', () => { _saveMechanic(key, textarea.value); autoResize(); });
      requestAnimationFrame(autoResize);
      item.appendChild(textarea);
      wrap.appendChild(item);
    });

    card.appendChild(wrap);
    return card;
  }

  // ── Data Mutations ────────────────────────────────────────────

  function _addRule(sectionKey) {
    const ruleset = _getRuleset();
    const rules = ruleset[sectionKey] || [];

    const max = _maxRules();
    if (rules.length >= max) {
      App.showError(`Max ${max} rules per group.`);
      return;
    }

    const newRule = '';
    rules.push(newRule);
    ruleset[sectionKey] = rules;
    _saveRuleset(ruleset);

    const listEl = _container.querySelector(`#rules-list-${sectionKey}`);
    if (!listEl) return;

    listEl.querySelectorAll('.ruleset-empty-text').forEach(el => el.remove());

    const index = rules.length - 1;
    const item = _buildRuleItem(sectionKey, newRule, index);
    listEl.appendChild(item);

    if (rules.length >= _maxRules()) {
      const addBtn = _container.querySelector(`#add-rule-btn-${sectionKey}`);
      if (addBtn) addBtn.style.display = 'none';
    }

    lucide.createIcons();

    const input = item.querySelector('.rule-edit-input');
    const textEl = item.querySelector('.rule-text');
    if (input && textEl) {
      textEl.classList.add('editing');
      input.classList.add('editing');
      input.focus();
    }
  }

  function _updateRule(sectionKey, index, value) {
    const ruleset = _getRuleset();
    if (!ruleset[sectionKey]) return;
    ruleset[sectionKey][index] = value;
    _saveRuleset(ruleset);
  }

  function _deleteRule(sectionKey, index) {
    const ruleset = _getRuleset();
    if (!ruleset[sectionKey]) return;
    ruleset[sectionKey].splice(index, 1);
    _saveRuleset(ruleset);

    // Re-render just this section's list
    const listEl = _container.querySelector(`#rules-list-${sectionKey}`);
    if (!listEl) return;
    listEl.replaceChildren();

    const remaining = ruleset[sectionKey].length;
    if (remaining === 0) {
      listEl.appendChild(_buildEmptyRuleText());
    } else {
      ruleset[sectionKey].forEach((rule, i) => {
        listEl.appendChild(_buildRuleItem(sectionKey, rule, i));
      });
      lucide.createIcons();
    }

    const addBtn = _container.querySelector(`#add-rule-btn-${sectionKey}`);
    if (addBtn) addBtn.style.display = remaining < _maxRules() ? '' : 'none';
  }

  async function _regenerateMechanic(key) {
    const textarea = _container.querySelector(`#mechanic-${key}`);
    const regenBtn = textarea?.closest('.mechanic-item')?.querySelector('.icon-btn');
    if (!textarea) return;

    const prev = textarea.value;
    textarea.disabled = true;
    textarea.value = 'Generating…';
    if (regenBtn) regenBtn.disabled = true;

    try {
      const result = await API.generateSingleMechanic(key);
      const value  = result.value || '';
      textarea.value = value;
      _saveMechanic(key, value);
      App.showToast(`${MECHANIC_LABELS[key] || key} regenerated`, () => {
        textarea.value = prev;
        _saveMechanic(key, prev);
      });
    } catch (err) {
      textarea.value = prev;
      App.showError(err.message);
    } finally {
      textarea.disabled = false;
      if (regenBtn) regenBtn.disabled = false;
    }
  }

  function _saveMechanic(key, value) {
    const ruleset = _getRuleset();
    if (!ruleset.special_mechanics) ruleset.special_mechanics = {};
    ruleset.special_mechanics[key] = value;
    _saveRuleset(ruleset);
  }

  // ── AI Suggest ───────────────────────────────────────────────

  async function _aiSuggest() {
    const setup = Storage.get(Storage.KEYS.SETUP);
    if (!setup?.club) {
      App.showError('Fill in your Save Setup first.');
      return;
    }

    const btn = _container.querySelector('#ruleset-ai-suggest');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '';
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      spinner.style.cssText = 'width:14px;height:14px;margin-right:8px;display:inline-block;';
      btn.appendChild(spinner);
      btn.appendChild(document.createTextNode('Generating…'));
    }

    try {
      const suggested = await API.generateRuleset();
      const prevData  = _getRuleset();
      const max       = _maxRules();
      const undoFn    = Storage.saveWithUndo(Storage.KEYS.RULESET, {
        squad_rules:       (suggested.squad_rules       || []).slice(0, max),
        transfer_rules:    (suggested.transfer_rules    || []).slice(0, max),
        gameplay_rules:    (suggested.gameplay_rules    || []).slice(0, max),
        special_mechanics: suggested.special_mechanics || {},
      });

      // Re-render to show new rules
      render();

      App.showToast('Ruleset generated', () => {
        undoFn();
        render();
      });

    } catch (err) {
      App.showError(err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.replaceChildren();
        const i = document.createElement('i');
        i.setAttribute('data-lucide', 'sparkles');
        btn.appendChild(i);
        btn.appendChild(document.createTextNode(' AI Suggest'));
        lucide.createIcons();
      }
    }
  }

  return { init, render };
})();
