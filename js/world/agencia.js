// Agência (Fase 4) — the agent (professional NPC) brings AI opportunities with
// 2-3 choices; the choice is narrative (the real move happens in FC 25), is
// checked against the Transfers Ruleset (Boardroom edits it, this only reads),
// and moves the agent relation (follow or ignore the advice). Also home of the
// Career tab (career moves + mid-season transfer) and the agência-type
// challenges (Transfer Rule / non-duo Career Decision).
const WorldAgencia = (() => {
  let _panel = null;

  function _data() {
    const d = Storage.get(Storage.KEYS.AGENCY);
    return d && typeof d === 'object' ? { current: d.current || null, history: d.history || [] } : { current: null, history: [] };
  }
  function _save(d) { Storage.set(Storage.KEYS.AGENCY, d); }

  function _agent() {
    return WorldNPCs.load().list.find(n => n.role === 'Agente') || null;
  }

  async function _ensureAgent() {
    if (_agent()) return;
    const result = await API.generateNpcs([{ name: '', role: 'Agente' }], 'lockerroom');
    const m = (result.members || [])[0] || {};
    const data = WorldNPCs.load();
    data.list.push(WorldNPCs.makeNpc(m.name || 'Agente', 'professional', 'Agente', m.personality));
    WorldNPCs.save(data);
  }

  async function _newOpportunity(btn) {
    btn.disabled = true;
    btn.textContent = 'O agente está ao telefone…';
    try {
      await _ensureAgent();
      const result = await API.generateAgencyOpportunity();
      const data = _data();
      data.current = { situation: result.situation, options: result.options || [] };
      _save(data);
      render(_panel);
    } catch (err) {
      App.showError(err.message);
      btn.disabled = false;
      btn.textContent = 'Nova oportunidade';
    }
  }

  function _choose(option) {
    const setup = Storage.get(Storage.KEYS.SETUP) || {};
    const season = setup.season || 1;
    const data = _data();
    data.history.push({
      situation: data.current?.situation || '',
      chosen: option.label, consequence: option.consequence,
      season, ts: new Date().toISOString(),
    });
    data.current = null;
    _save(data);

    const npcData = WorldNPCs.load();
    const agent = npcData.list.find(n => n.role === 'Agente');
    if (agent) {
      if (option.agent_pick) {
        WorldNPCs.interact(agent, `Seguiste o conselho: ${option.label}`, season, 1);
      } else {
        WorldNPCs.addEvent(agent, `Ignoraste o conselho: ${option.label}`, -2, season);
      }
      WorldNPCs.save(npcData);
    }
    render(_panel);
  }

  function _opportunityCard(current) {
    const card = document.createElement('div');
    card.className = 'card agency-opp';
    const sit = document.createElement('p');
    sit.className = 'agency-situation';
    sit.textContent = current.situation;
    card.appendChild(sit);
    for (const opt of current.options) {
      const optWrap = document.createElement('div');
      optWrap.className = 'agency-option';
      const btn = document.createElement('button');
      btn.className = 'btn-secondary';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => _choose(opt));
      const cons = document.createElement('p');
      cons.className = 'agency-consequence';
      cons.textContent = opt.consequence;
      optWrap.append(btn, cons);
      card.appendChild(optWrap);
    }
    const note = document.createElement('p');
    note.className = 'npc-hint';
    note.textContent = 'A decisão real acontece no FC 25 — isto molda a história (e o agente lembra-se do que escolhes).';
    card.appendChild(note);
    return card;
  }

  function _historyCard(h) {
    const card = document.createElement('div');
    card.className = 'card agency-history';
    const head = document.createElement('p');
    head.className = 'news-headline';
    head.textContent = h.chosen;
    card.appendChild(head);
    const cons = document.createElement('p');
    cons.className = 'news-snippet';
    cons.textContent = h.consequence;
    card.appendChild(cons);
    const meta = document.createElement('span');
    meta.className = 'news-meta';
    meta.textContent = `Época ${h.season}`;
    card.appendChild(meta);
    return card;
  }

  function render(panel) {
    _panel = panel;
    panel.replaceChildren();
    const setup = Storage.get(Storage.KEYS.SETUP) || {};
    const wrap = document.createElement('div');
    wrap.className = 'npc-wrap';

    const h = document.createElement('h2');
    h.textContent = 'Agência';
    wrap.appendChild(h);

    const agent = _agent();
    if (agent) {
      wrap.appendChild(WorldNPCs.buildCard(agent, (n, btn, card) =>
        WorldNPCs.hangout(n, btn, card, () => render(_panel))));
    } else {
      const hint = document.createElement('p');
      hint.className = 'npc-hint';
      hint.textContent = 'Ainda não tens agente — a primeira oportunidade traz um contigo.';
      wrap.appendChild(hint);
    }

    const nav = document.createElement('div');
    nav.className = 'office-nav';
    const chBtn = document.createElement('button');
    chBtn.className = 'btn-primary';
    chBtn.textContent = 'Challenges';
    chBtn.addEventListener('click', () => {
      ChallengesModule.render({ title: 'Challenges da Agência', only: 'agencia' });
      App.navigate('challenges');
    });
    nav.appendChild(chBtn);
    if (setup.mode === 'player' || setup.mode === 'fiction') {
      const carBtn = document.createElement('button');
      carBtn.className = 'btn-primary';
      carBtn.textContent = 'Transfers & Career';
      carBtn.addEventListener('click', () => {
        HubModule.render({ title: 'Agência', tabs: ['career'] });
        App.navigate('hub');
      });
      nav.appendChild(carBtn);
    }
    wrap.appendChild(nav);

    const data = _data();
    if (data.current) {
      wrap.appendChild(_opportunityCard(data.current));
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      btn.textContent = 'Nova oportunidade';
      btn.addEventListener('click', () => _newOpportunity(btn));
      wrap.appendChild(btn);
    }

    if (data.history.length) {
      const ht = document.createElement('p');
      ht.className = 'stadium-section-title stadium-history-title';
      ht.textContent = 'Decisões anteriores';
      wrap.appendChild(ht);
      for (const h2 of [...data.history].reverse()) wrap.appendChild(_historyCard(h2));
    }
    panel.appendChild(wrap);
  }

  return { render };
})();
