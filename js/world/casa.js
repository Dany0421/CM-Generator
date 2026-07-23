// Casa (Fase 3) — the family house: family roster with relationship bars and
// hangouts, plus the door into the Narrative module. Family NPCs are created
// here (hybrid): names seeded in Setup, blanks invented by the AI.
const WorldCasa = (() => {
  let _panel = null;
  let _selected = null;          // npc.id | 'group' | null
  let _groupOff = new Set();     // membros desmarcados do próximo hangout de grupo

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

  function _polaroid(npc, i) {
    const card = document.createElement('div');
    card.className = 'casa-polaroid' + (_selected === npc.id ? ' selected' : '');
    card.style.setProperty('--tilt', `${[-3, 2, -1.5, 2.5][i % 4]}deg`);
    const photo = document.createElement('div');
    photo.className = 'casa-photo';
    photo.textContent = (npc.name || '?').trim().charAt(0).toUpperCase();
    const av = WorldTheme.avatarColors(npc.name);
    photo.style.background = `linear-gradient(135deg, ${av.a}, ${av.b})`;
    const label = document.createElement('p');
    label.className = 'casa-caption';
    label.textContent = `${npc.role} · ${npc.value}`;
    card.append(photo, label);
    card.addEventListener('click', () => { _selected = npc.id; render(_panel); });
    return card;
  }

  function _groupPolaroid(family) {
    const card = document.createElement('div');
    card.className = 'casa-polaroid casa-group' + (_selected === 'group' ? ' selected' : '');
    card.style.setProperty('--tilt', '1.5deg');
    const photo = document.createElement('div');
    photo.className = 'casa-photo';
    photo.textContent = family.map(n => (n.name || '?').charAt(0).toUpperCase()).slice(0, 4).join('');
    const label = document.createElement('p');
    label.className = 'casa-caption';
    label.textContent = 'Todos juntos';
    card.append(photo, label);
    card.addEventListener('click', () => { _selected = 'group'; render(_panel); });
    return card;
  }

  function _renderGroup(detail, family) {
    const card = document.createElement('div');
    card.className = 'card npc-card';
    const title = document.createElement('p');
    title.className = 'npc-name';
    title.textContent = 'Tempo em família';
    card.appendChild(title);
    const hint = document.createElement('p');
    hint.className = 'npc-role';
    hint.textContent = 'Todos entram por defeito — desmarca quem não está.';
    card.appendChild(hint);
    const toggles = document.createElement('div');
    toggles.className = 'casa-toggles';
    for (const npc of family) {
      const t = document.createElement('button');
      t.className = 'casa-toggle' + (_groupOff.has(npc.id) ? ' off' : '');
      t.textContent = npc.name;
      t.addEventListener('click', () => {
        if (_groupOff.has(npc.id)) _groupOff.delete(npc.id); else _groupOff.add(npc.id);
        t.classList.toggle('off');
      });
      toggles.appendChild(t);
    }
    card.appendChild(toggles);
    const go = document.createElement('button');
    go.className = 'btn-ghost npc-hangout-btn';
    go.textContent = 'Passar tempo juntos';
    go.addEventListener('click', () => _groupHangout(family, go, card));
    card.appendChild(go);
    detail.appendChild(card);
  }

  async function _groupHangout(family, btn, card) {
    const present = family.filter(n => !_groupOff.has(n.id));
    if (present.length < 2) { App.showError('Um grupo precisa de pelo menos 2 pessoas.'); return; }
    btn.disabled = true;
    btn.textContent = 'A gerar…';
    try {
      const result = await API.generateGroupHangout(present);
      const season = Storage.get(Storage.KEYS.SETUP)?.season || 1;
      const data = WorldNPCs.load();
      for (const npc of present) {
        const saved = data.list.find(n => n.id === npc.id);
        if (saved) WorldNPCs.interact(saved, `Em família: ${result.summary}`, season);
      }
      WorldNPCs.save(data);
      const scene = document.createElement('div');
      scene.className = 'npc-scene';
      for (const m of (result.messages || [])) {
        const line = document.createElement('p');
        line.className = 'npc-scene-line' + (m.speaker === 'Tu' ? ' me' : '');
        const who = document.createElement('span');
        who.className = 'npc-scene-who';
        who.textContent = m.speaker;
        line.append(who, document.createTextNode(' ' + m.text));
        scene.appendChild(line);
      }
      card.insertBefore(scene, btn);
      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn-ghost npc-hangout-btn';
      closeBtn.textContent = 'Fechar';
      closeBtn.addEventListener('click', () => render(_panel));
      card.appendChild(closeBtn);
      btn.remove();
    } catch (err) {
      App.showError(err.message);
      btn.disabled = false;
      btn.textContent = 'Passar tempo juntos';
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
      hint.textContent = 'Toca numa polaroid para abrir a conversa. A família perdoa muito — mas negligência longa fica banked.';
      wrap.appendChild(hint);

      const wall = document.createElement('div');
      wall.className = 'casa-wall';
      wall.appendChild(_groupPolaroid(family));
      family.forEach((npc, i) => wall.appendChild(_polaroid(npc, i)));
      wrap.appendChild(wall);

      const detail = document.createElement('div');
      detail.className = 'casa-detail';
      wrap.appendChild(detail);
      if (_selected === 'group') _renderGroup(detail, family);
      else {
        const sel = family.find(n => n.id === _selected);
        if (sel) detail.appendChild(WorldNPCs.buildCard(sel, (n, btn, card) =>
          WorldNPCs.hangout(n, btn, card, () => render(_panel))));
      }

      const regen = document.createElement('button');
      regen.className = 'btn-ghost npc-regen';
      regen.textContent = 'Regenerar família (perde o histórico)';
      regen.addEventListener('click', () => {
        const data = WorldNPCs.load();
        data.list = data.list.filter(n => n.category !== 'family');
        WorldNPCs.save(data);
        _selected = null;
        render(_panel);
      });
      wrap.appendChild(regen);
    }
    panel.appendChild(wrap);
  }

  return { render };
})();
