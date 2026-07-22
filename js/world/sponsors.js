// Sponsors (Fase 4) — brand deals with metric/target like season challenges,
// progress fed by the Estádio match entries, rewards applied by the user via
// Live Editor (the app never touches the game). Standing with sponsors is a
// collective NPC (professional, role 'Sponsors') — affects generosity.
const WorldSponsors = (() => {
  let _panel = null;

  function _data() {
    const d = Storage.get(Storage.KEYS.SPONSORS);
    return d && Array.isArray(d.deals) ? d : { deals: [], season: 0 };
  }
  function _save(d) { Storage.set(Storage.KEYS.SPONSORS, d); }

  function _npc() {
    const data = WorldNPCs.load();
    let n = data.list.find(x => x.role === 'Sponsors');
    if (!n) {
      n = WorldNPCs.makeNpc('Sponsors', 'professional', 'Sponsors',
        'transacionais, pagam bem a quem entrega');
      data.list.push(n);
      WorldNPCs.save(data);
    }
    return n;
  }

  function _seasonEntries(season) {
    return (Storage.get(Storage.KEYS.HUB)?.log || [])
      .filter(e => e && !e.isDivider && e.match?.outcome && e.match.season === season);
  }

  async function _generate(btn) {
    btn.disabled = true;
    btn.textContent = 'A negociar…';
    try {
      _npc(); // standing exists before the call reads it
      const result = await API.generateSponsorDeals();
      const setup = Storage.get(Storage.KEYS.SETUP) || {};
      const data = _data();
      // paid deals stay as history; open ones are replaced by the new offers
      data.deals = data.deals.filter(d => d.status === 'Paid');
      for (const d of (result.deals || [])) {
        data.deals.push({ ...d, id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          season: setup.season || 1, status: 'Active' });
      }
      data.season = setup.season || 1;
      _save(data);
      render(_panel);
    } catch (err) {
      App.showError(err.message);
      btn.disabled = false;
      btn.textContent = 'Negociar propostas';
    }
  }

  function _dealCard(deal) {
    const setup = Storage.get(Storage.KEYS.SETUP) || {};
    const solo = setup.mode === 'player' || setup.mode === 'fiction';
    const card = document.createElement('div');
    card.className = 'card sponsor-card' + (deal.status === 'Paid' ? ' paid' : '');

    const head = document.createElement('div');
    head.className = 'sponsor-head';
    const brand = document.createElement('span');
    brand.className = 'sponsor-brand';
    brand.textContent = deal.sponsor;
    const tier = document.createElement('span');
    tier.className = `sponsor-tier tier-${(deal.tier || 'Normal').toLowerCase()}`;
    tier.textContent = deal.tier;
    head.append(brand, tier);
    card.appendChild(head);

    const title = document.createElement('p');
    title.className = 'sponsor-title';
    title.textContent = deal.title;
    card.appendChild(title);
    const desc = document.createElement('p');
    desc.className = 'sponsor-desc';
    desc.textContent = deal.description;
    card.appendChild(desc);

    const value = ChallengesModule.computeProgress(deal.metric, _seasonEntries(deal.season), solo);
    const done = value >= deal.target;
    const prog = document.createElement('div');
    prog.className = 'challenge-progress';
    const bar = document.createElement('div');
    bar.className = 'challenge-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'challenge-progress-fill' + (done ? ' done' : '');
    fill.style.width = `${Math.min(100, (value / (deal.target || 1)) * 100)}%`;
    bar.appendChild(fill);
    prog.appendChild(bar);
    const lbl = document.createElement('span');
    lbl.className = 'challenge-progress-label';
    lbl.textContent = `${value} / ${deal.target} ${String(deal.metric).replace('_', ' ')}`;
    prog.appendChild(lbl);
    card.appendChild(prog);

    const reward = document.createElement('p');
    reward.className = 'sponsor-reward';
    reward.textContent = `Reward: ${Number(deal.reward).toLocaleString('en-US')} (aplicar via Live Editor)`;
    card.appendChild(reward);

    if (deal.status === 'Paid') {
      const tag = document.createElement('span');
      tag.className = 'sponsor-paid-tag';
      tag.textContent = 'Pago';
      card.appendChild(tag);
    } else if (done) {
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      btn.textContent = 'Cumprido — marcar pago';
      btn.addEventListener('click', () => {
        const data = _data();
        const d = data.deals.find(x => x.id === deal.id);
        if (d) { d.status = 'Paid'; _save(data); }
        const npcData = WorldNPCs.load();
        const n = npcData.list.find(x => x.role === 'Sponsors');
        if (n) {
          WorldNPCs.interact(n, `Deal cumprido: ${deal.sponsor} (${deal.tier})`,
            Storage.get(Storage.KEYS.SETUP)?.season || 1, 2);
          WorldNPCs.save(npcData);
        }
        App.showToast(`Aplica ${Number(deal.reward).toLocaleString('en-US')} no save via Live Editor.`);
        render(_panel);
      });
      card.appendChild(btn);
    }
    return card;
  }

  function render(panel) {
    _panel = panel;
    panel.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'npc-wrap';

    const h = document.createElement('h2');
    h.textContent = 'Sponsors';
    wrap.appendChild(h);

    const standing = _npc();
    const hint = document.createElement('p');
    hint.className = 'npc-hint';
    hint.textContent = `Standing com sponsors: ${standing.value}/100 — entrega deals e as propostas engordam.`;
    wrap.appendChild(hint);

    const genBtn = document.createElement('button');
    genBtn.className = 'btn-primary';
    genBtn.textContent = 'Negociar propostas';
    genBtn.addEventListener('click', () => _generate(genBtn));
    wrap.appendChild(genBtn);

    const data = _data();
    const open = data.deals.filter(d => d.status !== 'Paid');
    const paid = data.deals.filter(d => d.status === 'Paid');
    for (const d of open) wrap.appendChild(_dealCard(d));
    if (paid.length) {
      const ht = document.createElement('p');
      ht.className = 'stadium-section-title stadium-history-title';
      ht.textContent = 'Deals pagos';
      wrap.appendChild(ht);
      for (const d of [...paid].reverse()) wrap.appendChild(_dealCard(d));
    }
    panel.appendChild(wrap);
  }

  return { render };
})();
