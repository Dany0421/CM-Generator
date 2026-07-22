// Balneário (Fase 3) — locker room: coach + teammates roster with hangouts,
// the relocated Players tab (hub.players journals), and the Player Card
// (fiction module) for fiction mode / player mode with the statsCard toggle.
// Teammates come from the Setup squad: linked player first, then top-OVR
// starters. Team mode has no coach NPC (the user IS the manager).
const WorldBalneario = (() => {
  let _panel = null;

  function _seeds() {
    const setup = Storage.get(Storage.KEYS.SETUP) || {};
    const solo = setup.mode === 'player' || setup.mode === 'fiction';
    const own = (setup.player?.name || '').toLowerCase();
    const linked = setup.player?.linked?.name || '';
    const seeds = [];
    if (solo) seeds.push({ name: '', role: 'Treinador', category: 'professional' });
    const starters = (setup.squad?.starters || [])
      .filter(p => p.name && p.name.toLowerCase() !== own && p.name !== linked)
      .sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    if (linked) seeds.push({ name: linked, role: setup.player?.linked?.position || 'Colega', category: 'teammate' });
    const want = (solo ? 4 : 5) - (linked ? 1 : 0);
    for (const p of starters.slice(0, want)) {
      seeds.push({ name: p.name, role: p.position || 'Colega', category: 'teammate' });
    }
    return seeds;
  }

  async function _generateRoster(btn) {
    const seeds = _seeds();
    if (!seeds.length) {
      App.showError('Cria o squad no Setup primeiro — os colegas saem de lá.');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'A gerar…';
    try {
      const result = await API.generateNpcs(
        seeds.map(s => ({ name: s.name, role: s.role })), 'lockerroom');
      const data = WorldNPCs.load();
      (result.members || []).forEach((m, i) => {
        const seed = seeds[i] || {};
        data.list.push(WorldNPCs.makeNpc(
          seed.name || m.name, seed.category || 'teammate', seed.role || m.role, m.personality));
      });
      WorldNPCs.save(data);
      render(_panel);
      App.showToast('Balneário formado.');
    } catch (err) {
      App.showError(err.message);
      btn.disabled = false;
      btn.textContent = 'Formar balneário';
    }
  }

  // The relation roster IS the Players view: every teammate NPC appears there
  // automatically (additive — manual hub.players entries and journals untouched).
  // The linked player carries a "Linked Player" tag and comes pinned.
  function _syncPlayers() {
    const teammates = WorldNPCs.byCategory(WorldNPCs.load(), 'teammate');
    if (!teammates.length) return;
    const hub = Storage.get(Storage.KEYS.HUB) || { log: [], tracker: {}, players: [], seasons: [] };
    hub.players = hub.players || [];
    const linkedName = (Storage.get(Storage.KEYS.SETUP)?.player?.linked?.name || '').trim().toLowerCase();
    let changed = false;
    for (const npc of teammates) {
      const isLinked = !!linkedName && npc.name.trim().toLowerCase() === linkedName;
      const entry = hub.players.find(p => (p.name || '').trim().toLowerCase() === npc.name.trim().toLowerCase());
      if (!entry) {
        hub.players.push({
          id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: npc.name, role: npc.role,
          tags: isLinked ? ['Linked Player'] : [],
          entries: [], appearances: 0, pinned: isLinked,
        });
        changed = true;
      } else if (isLinked && !(entry.tags || []).includes('Linked Player')) {
        entry.tags = [...(entry.tags || []), 'Linked Player'];
        changed = true;
      }
    }
    if (changed) Storage.set(Storage.KEYS.HUB, hub);
  }

  function render(panel) {
    _panel = panel;
    panel.replaceChildren();
    _syncPlayers();
    const setup = Storage.get(Storage.KEYS.SETUP) || {};
    const wrap = document.createElement('div');
    wrap.className = 'npc-wrap';

    const h = document.createElement('h2');
    h.textContent = 'Balneário';
    wrap.appendChild(h);

    const nav = document.createElement('div');
    nav.className = 'office-nav';
    const playersBtn = document.createElement('button');
    playersBtn.className = 'btn-primary';
    playersBtn.textContent = 'Players';
    playersBtn.addEventListener('click', () => {
      HubModule.render({ title: 'Balneário', tabs: ['players'] });
      App.navigate('hub');
    });
    nav.appendChild(playersBtn);
    const chBtn = document.createElement('button');
    chBtn.className = 'btn-primary';
    chBtn.textContent = 'Challenges';
    chBtn.addEventListener('click', () => {
      ChallengesModule.render({ title: 'Challenges do Balneário', only: 'balneario' });
      App.navigate('challenges');
    });
    nav.appendChild(chBtn);
    const cardEnabled = setup.mode === 'fiction' ||
      (setup.mode === 'player' && setup.player?.statsCard);
    if (cardEnabled) {
      const cardBtn = document.createElement('button');
      cardBtn.className = 'btn-primary';
      cardBtn.textContent = 'Player Card';
      cardBtn.addEventListener('click', () => {
        FictionModule.render();
        App.navigate('fiction');
      });
      nav.appendChild(cardBtn);
    }
    wrap.appendChild(nav);

    const data = WorldNPCs.load();
    const roster = data.list.filter(n =>
      n.category === 'teammate' || (n.category === 'professional' && n.role === 'Treinador'));
    if (!roster.length) {
      const empty = document.createElement('div');
      empty.className = 'npc-empty';
      const p = document.createElement('p');
      p.textContent = 'O balneário ainda não tem caras. Forma-o a partir do teu squad — o linked player e os melhores titulares ganham personalidade própria.';
      empty.appendChild(p);
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      btn.textContent = 'Formar balneário';
      btn.addEventListener('click', () => _generateRoster(btn));
      empty.appendChild(btn);
      wrap.appendChild(empty);
    } else {
      const hint = document.createElement('p');
      hint.className = 'npc-hint';
      hint.textContent = 'Colegas reagem a atenção e a resultados — hangouts contam como interação do próximo beat.';
      wrap.appendChild(hint);
      for (const npc of roster) {
        wrap.appendChild(WorldNPCs.buildCard(npc, (n, btn, card) =>
          WorldNPCs.hangout(n, btn, card, () => render(_panel))));
      }
      wrap.appendChild(_addColegaForm());
    }
    panel.appendChild(wrap);
  }

  // Emergent NPCs (spec): someone outside the squad can join the roster —
  // e.g. a teammate the narrative keeps mentioning. Manual fix-as-NPC for now.
  function _addColegaForm() {
    const row = document.createElement('div');
    row.className = 'npc-add-row';
    const nameIn = document.createElement('input');
    nameIn.type = 'text';
    nameIn.className = 'form-input';
    nameIn.placeholder = 'Nome do colega';
    const roleIn = document.createElement('input');
    roleIn.type = 'text';
    roleIn.className = 'form-input';
    roleIn.placeholder = 'Posição/papel';
    const btn = document.createElement('button');
    btn.className = 'btn-ghost';
    btn.textContent = 'Adicionar colega';
    btn.addEventListener('click', async () => {
      const name = nameIn.value.trim();
      if (!name) { App.showError('Escreve o nome do colega.'); return; }
      btn.disabled = true;
      btn.textContent = 'A gerar…';
      try {
        const result = await API.generateNpcs([{ name, role: roleIn.value.trim() || 'Colega' }], 'lockerroom');
        const m = (result.members || [])[0] || {};
        const data = WorldNPCs.load();
        data.list.push(WorldNPCs.makeNpc(name, 'teammate', roleIn.value.trim() || m.role || 'Colega', m.personality));
        WorldNPCs.save(data);
        render(_panel);
      } catch (err) {
        App.showError(err.message);
        btn.disabled = false;
        btn.textContent = 'Adicionar colega';
      }
    });
    row.append(nameIn, roleIn, btn);
    return row;
  }

  return { render };
})();
