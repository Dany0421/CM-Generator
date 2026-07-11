const ChatModule = (() => {
  let _messages = [];   // raw {role, content} sent to the API
  let _snapshot = '';   // save state frozen at open
  let _sending  = false;

  const ROOT_KEYS = {
    setup:      () => Storage.KEYS.SETUP,
    narrative:  () => Storage.KEYS.NARRATIVE,
    challenges: () => Storage.KEYS.CHALLENGES,
    ruleset:    () => Storage.KEYS.RULESET,
    fiction:    () => Storage.KEYS.FICTION_PLAYER,
  };

  const RENDERERS = {
    setup:      () => SetupModule.render(),
    narrative:  () => NarrativeModule.render(),
    challenges: () => ChallengesModule.render(),
    ruleset:    () => RulesetModule.render(),
    fiction:    () => FictionModule.render(),
  };

  function init() {
    document.getElementById('chat-fab').addEventListener('click', open);
    document.getElementById('chat-close-btn').addEventListener('click', close);
    document.getElementById('chat-backdrop').addEventListener('click', close);
    document.getElementById('chat-send-btn').addEventListener('click', _send);

    const input = document.getElementById('chat-input');
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _send(); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !document.getElementById('chat-modal').classList.contains('hidden')) close();
    });
  }

  function open() {
    _messages = [];
    _snapshot = _buildSnapshot();

    const log = document.getElementById('chat-messages');
    log.replaceChildren();

    const hint = document.createElement('div');
    hint.className = 'chat-msg chat-msg-hint';
    hint.textContent = 'Pede qualquer ajuste na save — narrative, challenges, rules, stats. Mudanças concretas aparecem com um botão Apply.';
    log.appendChild(hint);

    document.getElementById('chat-modal').classList.remove('hidden');
    document.getElementById('chat-input').focus();
  }

  function close() {
    document.getElementById('chat-modal').classList.add('hidden');
  }

  function _buildSnapshot() {
    const setup = Storage.get(Storage.KEYS.SETUP);
    const hub   = Storage.get(Storage.KEYS.HUB) || {};
    const snap = {
      mode:       setup?.mode || 'team',
      setup,
      narrative:  Storage.get(Storage.KEYS.NARRATIVE),
      challenges: Storage.get(Storage.KEYS.CHALLENGES),
      ruleset:    Storage.get(Storage.KEYS.RULESET),
      seasons:    (Storage.get(Storage.KEYS.SEASONS) || []).map(s => ({ season: s.season, summary: s.summary })),
      active_career_moves: (hub.careerMoves || []).filter(m => m.status === 'active')
        .map(m => ({ type: m.type, title: m.title, narrative: m.narrative, stakes: m.stakes })),
    };
    if (setup?.mode === 'fiction') snap.fiction = Storage.get(Storage.KEYS.FICTION_PLAYER);
    return JSON.stringify(snap);
  }

  // ── Messaging ────────────────────────────────────────────────

  async function _send() {
    if (_sending) return;
    const input = document.getElementById('chat-input');
    const text  = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';

    _messages.push({ role: 'user', content: text });
    _addBubble('user', text);

    const typing = _addTyping();
    _sending = true;
    document.getElementById('chat-send-btn').disabled = true;

    try {
      const raw = await API.chatCall(_snapshot, _messages);
      _messages.push({ role: 'assistant', content: raw });

      typing.remove();
      const { text: display, actions } = _parseActions(raw);
      if (display) _addBubble('assistant', display);
      if (actions && actions.length > 0) _addActionCard(actions);
    } catch (err) {
      typing.remove();
      _addBubble('error', err.message);
    } finally {
      _sending = false;
      document.getElementById('chat-send-btn').disabled = false;
      input.focus();
    }
  }

  function _addBubble(kind, text) {
    const log = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = 'chat-msg ' + (
      kind === 'user'  ? 'chat-msg-user' :
      kind === 'error' ? 'chat-msg-assistant chat-msg-error' :
      'chat-msg-assistant'
    );
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function _addTyping() {
    const log = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = 'chat-msg chat-msg-assistant chat-typing';
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.style.cssText = 'width:14px;height:14px;';
    el.appendChild(spinner);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  // ── Actions ──────────────────────────────────────────────────

  function _parseActions(raw) {
    const m = raw.match(/```json\s*([\s\S]*?)```/);
    if (!m) return { text: raw.trim(), actions: null };
    let actions = null;
    try {
      const obj = JSON.parse(m[1]);
      if (Array.isArray(obj.actions)) actions = obj.actions.filter(a => a && typeof a.target === 'string');
    } catch { /* malformed block — show text only */ }
    return { text: raw.replace(m[0], '').trim(), actions };
  }

  function _addActionCard(actions) {
    const log = document.getElementById('chat-messages');
    const card = document.createElement('div');
    card.className = 'chat-action-card';

    const title = document.createElement('span');
    title.className = 'chat-action-title';
    title.textContent = 'Proposed changes';
    card.appendChild(title);

    actions.forEach(a => {
      const item = document.createElement('div');
      item.className = 'chat-action-item';
      const target = document.createElement('span');
      target.className = 'chat-action-target';
      target.textContent = a.target;
      item.appendChild(target);
      const val = document.createElement('span');
      val.className = 'chat-action-value';
      val.textContent = _previewValue(a.value);
      item.appendChild(val);
      card.appendChild(item);
    });

    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn-primary chat-apply-btn';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', () => {
      try {
        _applyActions(actions);
        applyBtn.textContent = 'Applied';
        applyBtn.disabled = true;
        card.classList.add('chat-action-applied');
        App.showToast('Changes applied');
      } catch (err) {
        App.showError(err.message);
      }
    });
    card.appendChild(applyBtn);

    log.appendChild(card);
    log.scrollTop = log.scrollHeight;
  }

  function _previewValue(v) {
    if (typeof v === 'string') return v.length > 140 ? v.slice(0, 140) + '…' : v;
    if (Array.isArray(v)) return `[${v.length} item${v.length === 1 ? '' : 's'}]`;
    if (v && typeof v === 'object') return '{' + Object.keys(v).slice(0, 5).join(', ') + '}';
    return String(v);
  }

  function _parsePath(target) {
    const out = [];
    target.split('.').forEach(part => {
      const m = part.match(/^([^[\]]+)((?:\[\d+\])*)$/);
      if (!m) throw new Error('Invalid target: ' + target);
      out.push(m[1]);
      (m[2].match(/\d+/g) || []).forEach(n => out.push(parseInt(n)));
    });
    return out;
  }

  function _applyActions(actions) {
    const touched = new Set();

    actions.forEach(a => {
      const segs = _parsePath(a.target);
      const root = segs.shift();
      const keyFn = ROOT_KEYS[root];
      if (!keyFn) throw new Error('Cannot edit "' + root + '" from chat.');
      const key = keyFn();

      let data = Storage.get(key);
      if (segs.length === 0) {
        data = a.value;
      } else {
        if (data == null) data = typeof segs[0] === 'number' ? [] : {};
        let cur = data;
        for (let i = 0; i < segs.length - 1; i++) {
          if (cur[segs[i]] == null) cur[segs[i]] = typeof segs[i + 1] === 'number' ? [] : {};
          cur = cur[segs[i]];
        }
        cur[segs[segs.length - 1]] = a.value;
      }

      // Edited rules invalidate the condensed hub summary
      if (root === 'ruleset' && segs[0] !== 'hub_summary' && data && typeof data === 'object') {
        delete data.hub_summary;
      }

      Storage.set(key, data);
      touched.add(root);
    });

    touched.forEach(root => {
      try { RENDERERS[root](); } catch { /* module not mounted */ }
    });
  }

  return { init, open };
})();
