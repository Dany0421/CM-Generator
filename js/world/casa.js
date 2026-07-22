// Casa (Fase 3) — the family house: family roster with relationship bars and
// hangouts, plus the door into the Narrative module. Family NPCs are created
// here (hybrid): names seeded in Setup, blanks invented by the AI.
const WorldCasa = (() => {
  let _panel = null;

  function _seeds() {
    const fam = Storage.get(Storage.KEYS.SETUP)?.family || {};
    // "ou" roles: a AI compromete-se com UM (nome/personalidade a condizer)
    const seeds = [
      { name: fam.pai || '', role: 'Pai' },
      { name: fam.mae || '', role: 'Mãe' },
      { name: fam.irmao || '', role: 'Irmão ou Irmã' },
    ];
    // 2º irmão: sempre que nomeado; senão roll de 40% (spec: "às vezes")
    if (fam.irmao2) seeds.push({ name: fam.irmao2, role: '2º Irmão ou 2ª Irmã' });
    else if (Math.random() < 0.4) seeds.push({ name: '', role: '2º Irmão ou 2ª Irmã' });
    return seeds;
  }

  async function _generateFamily(btn) {
    btn.disabled = true;
    btn.textContent = 'A gerar…';
    try {
      const seeds = _seeds();
      const result = await API.generateNpcs(seeds, 'family');
      const data = WorldNPCs.load();
      (result.members || []).forEach((m, i) => {
        const seed = seeds[i] || {};
        // role da AI ganha: é ela que resolve "Irmão ou Irmã" num só
        data.list.push(WorldNPCs.makeNpc(
          seed.name || m.name, 'family', m.role || seed.role, m.personality));
      });
      WorldNPCs.save(data);
      render(_panel);
      App.showToast('Família criada — cuida dela.');
    } catch (err) {
      App.showError(err.message);
      btn.disabled = false;
      btn.textContent = 'Gerar família';
    }
  }

  function render(panel) {
    _panel = panel;
    panel.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'npc-wrap';

    const h = document.createElement('h2');
    h.textContent = 'Casa';
    wrap.appendChild(h);

    const nav = document.createElement('div');
    nav.className = 'office-nav';
    const narrBtn = document.createElement('button');
    narrBtn.className = 'btn-primary';
    narrBtn.textContent = 'Narrativa';
    narrBtn.addEventListener('click', () => {
      NarrativeModule.render();
      App.navigate('narrative');
    });
    nav.appendChild(narrBtn);
    wrap.appendChild(nav);

    const family = WorldNPCs.byCategory(WorldNPCs.load(), 'family');
    if (!family.length) {
      const empty = document.createElement('div');
      empty.className = 'npc-empty';
      const p = document.createElement('p');
      p.textContent = 'A casa ainda está vazia. Gera a tua família — os nomes que meteste no Setup são respeitados, o resto é inventado à volta da tua história.';
      empty.appendChild(p);
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      btn.textContent = 'Gerar família';
      btn.addEventListener('click', () => _generateFamily(btn));
      empty.appendChild(btn);
      wrap.appendChild(empty);
    } else {
      const hint = document.createElement('p');
      hint.className = 'npc-hint';
      hint.textContent = 'A família perdoa muito — mas negligência longa fica banked e não se apaga com um jantar.';
      wrap.appendChild(hint);
      for (const npc of family) {
        wrap.appendChild(WorldNPCs.buildCard(npc, (n, btn, card) =>
          WorldNPCs.hangout(n, btn, card, () => render(_panel))));
      }
      const regen = document.createElement('button');
      regen.className = 'btn-ghost npc-regen';
      regen.textContent = 'Regenerar família (perde o histórico)';
      regen.addEventListener('click', () => {
        const data = WorldNPCs.load();
        data.list = data.list.filter(n => n.category !== 'family');
        WorldNPCs.save(data);
        render(_panel);
      });
      wrap.appendChild(regen);
    }
    panel.appendChild(wrap);
  }

  return { render };
})();
