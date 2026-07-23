// Sponsors (Fase 4) — real football money, scaled to the division by the
// prompt. Each negotiation brings 5 OFFERS across tiers; the user accepts at
// most 2 ACTIVE deals at a time (choice is the game). Progress fed by the
// Estádio match entries; rewards applied by the user via Live Editor. Standing
// is a collective NPC (professional, role 'Sponsors') — affects generosity.
const WorldSponsors = (() => {
  const MAX_ACTIVE = 2;
  let _panel = null;

  function _data() {
    const d = Storage.get(Storage.KEYS.SPONSORS) || {};
    return {
      offers: Array.isArray(d.offers) ? d.offers : [],
      deals:  Array.isArray(d.deals) ? d.deals : [],
      season: d.season || 0,
    };
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

  function _money(v) { return Number(v).toLocaleString('en-US'); }

  async function _generate(btn) {
    btn.disabled = true;
    btn.textContent = 'A negociar…';
    try {
      _npc(); // standing exists before the call reads it
      const result = await API.generateSponsorDeals();
      const setup = Storage.get(Storage.KEYS.SETUP) || {};
      const data = _data();
      data.offers = (result.deals || []).map(d => ({
        ...d, id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        season: setup.season || 1,
      }));
      data.season = setup.season || 1;
      _save(data);
      render(_panel);
    } catch (err) {
      App.showError(err.message);
      btn.disabled = false;
      btn.textContent = 'Negociar propostas';
    }
  }

  function _head(deal) {
    const head = document.createElement('div');
    head.className = 'sponsor-head';
    const brand = document.createElement('span');
    brand.className = 'sponsor-brand';
    brand.textContent = deal.sponsor;
    const tier = document.createElement('span');
    tier.className = `sponsor-tier tier-${(deal.tier || 'Normal').toLowerCase()}`;
    tier.textContent = deal.tier;
    head.append(brand, tier);
    return head;
  }

  function _body(card, deal) {
    const title = document.createElement('p');
    title.className = 'sponsor-title';
    title.textContent = deal.title;
    card.appendChild(title);
    const desc = document.createElement('p');
    desc.className = 'sponsor-desc';
    desc.textContent = deal.description;
    card.appendChild(desc);
    const reward = document.createElement('p');
    reward.className = 'sponsor-reward';
    reward.textContent = `Reward: ${_money(deal.reward)} (aplicar via Live Editor)`;
    card.appendChild(reward);
  }

  function _offerCard(offer, activeCount) {
    const card = document.createElement('div');
    card.className = 'card sponsor-card pitch';
    const bc = WorldTheme.brandColor(offer.sponsor);
    card.style.setProperty('--brand-bg', bc.bg);
    card.style.setProperty('--brand-fg', bc.fg);
    card.appendChild(_head(offer));
    _body(card, offer);
    const cond = document.createElement('p');
    cond.className = 'sponsor-desc';
    cond.textContent = `Condição: ${offer.target} ${String(offer.metric).replace('_', ' ')} esta época.`;
    card.appendChild(cond);
    const btn = document.createElement('button');
    btn.className = 'btn-primary';
    if (activeCount >= MAX_ACTIVE) {
      btn.textContent = `Máx. ${MAX_ACTIVE} deals ativos`;
      btn.disabled = true;
    } else {
      btn.textContent = '✒ Assinar';
      btn.addEventListener('click', () => {
        const data = _data();
        const idx = data.offers.findIndex(o => o.id === offer.id);
        if (idx === -1) return;
        const [accepted] = data.offers.splice(idx, 1);
        data.deals.push({ ...accepted, status: 'Active' });
        _save(data);
        render(_panel);
      });
    }
    card.appendChild(btn);
    return card;
  }

  function _dealCard(deal) {
    const setup = Storage.get(Storage.KEYS.SETUP) || {};
    const solo = setup.mode === 'player' || setup.mode === 'fiction';
    const card = document.createElement('div');
    card.className = 'card sponsor-card cheque' + (deal.status === 'Paid' ? ' paid' : '');
    const num = document.createElement('span');
    num.className = 'cheque-num';
    num.textContent = `Nº ${String(deal.id || '').slice(-4).toUpperCase()}`;
    card.appendChild(num);
    card.appendChild(_head(deal));
    const payee = document.createElement('p');
    payee.className = 'cheque-payee';
    payee.textContent = 'Pague-se a: o teu clube';
    card.appendChild(payee);
    _body(card, deal);

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

    if (deal.status === 'Paid') {
      const tag = document.createElement('span');
      tag.className = 'sponsor-paid-tag';
      tag.textContent = 'DEPOSITADO';
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
        App.showToast(`Aplica ${_money(deal.reward)} no save via Live Editor.`);
        render(_panel);
      });
      card.appendChild(btn);
    } else {
      const drop = document.createElement('button');
      drop.className = 'btn-ghost npc-regen';
      drop.textContent = 'Rescindir deal';
      drop.addEventListener('click', () => {
        const data = _data();
        data.deals = data.deals.filter(x => x.id !== deal.id);
        _save(data);
        const npcData = WorldNPCs.load();
        const n = npcData.list.find(x => x.role === 'Sponsors');
        if (n) {
          WorldNPCs.addEvent(n, `Rescindiste com ${deal.sponsor}`, -3,
            Storage.get(Storage.KEYS.SETUP)?.season || 1);
          WorldNPCs.save(npcData);
        }
        render(_panel);
      });
      card.appendChild(drop);
    }
    return card;
  }

  function _section(wrap, label) {
    const ht = document.createElement('p');
    ht.className = 'stadium-section-title stadium-history-title';
    ht.textContent = label;
    wrap.appendChild(ht);
  }

  function render(panel) {
    _panel = panel;
    panel.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'npc-wrap';

    const h = document.createElement('h2');
    h.textContent = 'Sponsors';
    wrap.appendChild(h);

    const seasonNum = Storage.get(Storage.KEYS.SETUP)?.season || 1;
    const paidTotal = _data().deals
      .filter(d => d.status === 'Paid' && d.season === seasonNum)
      .reduce((s, d) => s + (Number(d.reward) || 0), 0);
    const counter = document.createElement('p');
    counter.className = 'vault-counter';
    counter.textContent = `época: ${_money(paidTotal)} recebidos`;
    wrap.appendChild(counter);

    const standing = _npc();
    const hint = document.createElement('p');
    hint.className = 'npc-hint';
    hint.textContent = `Standing: ${standing.value}/100 — entrega deals e as propostas engordam. Máximo ${MAX_ACTIVE} deals ativos: escolhe bem.`;
    wrap.appendChild(hint);

    const genBtn = document.createElement('button');
    genBtn.className = 'btn-primary';
    genBtn.textContent = 'Negociar propostas';
    genBtn.addEventListener('click', () => _generate(genBtn));
    wrap.appendChild(genBtn);

    const data = _data();
    const active = data.deals.filter(d => d.status === 'Active');
    const paid = data.deals.filter(d => d.status === 'Paid');

    if (active.length) {
      _section(wrap, 'Deals ativos');
      for (const d of active) wrap.appendChild(_dealCard(d));
    }
    if (data.offers.length) {
      _section(wrap, 'Propostas na mesa');
      for (const o of data.offers) wrap.appendChild(_offerCard(o, active.length));
    }
    if (paid.length) {
      _section(wrap, 'Deals pagos');
      for (const d of [...paid].reverse()) wrap.appendChild(_dealCard(d));
    }
    panel.appendChild(wrap);
  }

  return { render };
})();
