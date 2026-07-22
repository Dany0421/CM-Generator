// Imprensa (Fase 4) — consequent news: the facts come from the structured
// truth layer (match entries, rival, revealed events), the AI only writes the
// reaction. Rumors mixed in (is_rumor stays hidden — the user never sees the
// flag). Tone follows the collective press NPC; generating news counts as
// this beat's interaction with the press.
const WorldImprensa = (() => {
  let _panel = null;

  function _data() {
    const d = Storage.get(Storage.KEYS.NEWS);
    return d && Array.isArray(d.items) ? d : { items: [] };
  }
  function _save(d) { Storage.set(Storage.KEYS.NEWS, d); }

  function _npc() {
    const data = WorldNPCs.load();
    let n = data.list.find(x => x.category === 'press');
    if (!n) {
      n = WorldNPCs.makeNpc('Imprensa', 'press', 'Imprensa',
        'justa quando alimentada, cruel quando ignorada');
      data.list.push(n);
      WorldNPCs.save(data);
    }
    return n;
  }

  async function _generate(btn) {
    btn.disabled = true;
    btn.textContent = 'A escrever…';
    try {
      _npc();
      const result = await API.generateNews();
      const setup = Storage.get(Storage.KEYS.SETUP) || {};
      const data = _data();
      for (const item of (result.items || [])) {
        data.items.push({ ...item,
          id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          season: setup.season || 1, ts: new Date().toISOString() });
      }
      _save(data);
      // dar matéria à imprensa conta como interação do beat
      const npcData = WorldNPCs.load();
      const n = npcData.list.find(x => x.category === 'press');
      if (n) {
        WorldNPCs.interact(n, 'Ciclo de notícias alimentado', setup.season || 1);
        WorldNPCs.save(npcData);
      }
      render(_panel);
    } catch (err) {
      App.showError(err.message);
      btn.disabled = false;
      btn.textContent = 'Gerar notícias';
    }
  }

  function _newsCard(item) {
    const card = document.createElement('div');
    card.className = 'card news-card' + (item.manual ? ' manual' : '');
    const head = document.createElement('p');
    head.className = 'news-headline';
    head.textContent = item.headline;
    card.appendChild(head);
    if (item.snippet) {
      const p = document.createElement('p');
      p.className = 'news-snippet';
      p.textContent = item.snippet;
      card.appendChild(p);
    }
    const meta = document.createElement('span');
    meta.className = 'news-meta';
    meta.textContent = `Época ${item.season}` + (item.manual ? ' · nota tua' : '');
    card.appendChild(meta);
    return card;
  }

  function _manualForm() {
    const row = document.createElement('div');
    row.className = 'news-manual';
    const headIn = document.createElement('input');
    headIn.type = 'text';
    headIn.className = 'form-input';
    headIn.placeholder = 'Manchete manual — algo que a imprensa não apanhou';
    const btn = document.createElement('button');
    btn.className = 'btn-ghost';
    btn.textContent = 'Publicar';
    btn.addEventListener('click', () => {
      const headline = headIn.value.trim();
      if (!headline) { App.showError('Escreve a manchete.'); return; }
      const data = _data();
      data.items.push({
        id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        headline, snippet: '', manual: true,
        season: Storage.get(Storage.KEYS.SETUP)?.season || 1,
        ts: new Date().toISOString(),
      });
      _save(data);
      render(_panel);
    });
    row.append(headIn, btn);
    return row;
  }

  function render(panel) {
    _panel = panel;
    panel.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'npc-wrap';

    const h = document.createElement('h2');
    h.textContent = 'Imprensa';
    wrap.appendChild(h);

    const press = _npc();
    const hint = document.createElement('p');
    hint.className = 'npc-hint';
    hint.textContent = `Relação com a imprensa: ${press.value}/100 — ` +
      (press.value < 30 ? 'estão a afiar as facas.' : 'o tom acompanha o que lhes dás.');
    wrap.appendChild(hint);

    const genBtn = document.createElement('button');
    genBtn.className = 'btn-primary';
    genBtn.textContent = 'Gerar notícias';
    genBtn.addEventListener('click', () => _generate(genBtn));
    wrap.appendChild(genBtn);

    wrap.appendChild(_manualForm());

    const items = [..._data().items].reverse();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'npc-hint';
      empty.style.marginTop = '16px';
      empty.textContent = 'Banca vazia — joga uns jogos no Estádio e gera o primeiro ciclo de notícias.';
      wrap.appendChild(empty);
    }
    for (const item of items) wrap.appendChild(_newsCard(item));
    panel.appendChild(wrap);
  }

  return { render };
})();
