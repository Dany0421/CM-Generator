// Club Office (Fase 2) — home page of the club building: squad admin
// (formation + OVR quick-edit mirroring what the user changed in-game),
// read-only ruleset summary, and doors into Season Log/Trophies + Challenges.
// Squad data is setup.squad (same storage as the Setup module — no duplication:
// full add/remove/rename editing stays in Setup, this is the day-to-day mirror).
const WorldOffice = (() => {
  const HUB_VIEW = { title: 'Club Office', tabs: ['log', 'trophies', 'players'] };
  const GROUPS = [
    { key: 'starters', label: 'Titulares' },
    { key: 'bench',    label: 'Banco' },
    { key: 'reserves', label: 'Reservas' },
  ];

  function _setup() { return Storage.get(Storage.KEYS.SETUP) || {}; }

  function _saveOvr(groupKey, index, value) {
    const setup = _setup();
    const p = setup.squad?.[groupKey]?.[index];
    if (!p) return;
    const n = parseInt(value);
    p.ovr = isNaN(n) ? 0 : Math.max(1, Math.min(99, n));
    Storage.set(Storage.KEYS.SETUP, setup);
  }

  function _squadCard(setup) {
    const card = document.createElement('div');
    card.className = 'card office-card';
    const head = document.createElement('div');
    head.className = 'office-card-head';
    const title = document.createElement('p');
    title.className = 'office-card-title';
    title.textContent = 'Plantel';
    head.appendChild(title);
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-ghost office-edit-btn';
    editBtn.textContent = 'Editar no Setup';
    editBtn.addEventListener('click', () => World.openSetup());
    head.appendChild(editBtn);
    card.appendChild(head);

    const squad = setup.squad;
    if (!squad || !(squad.starters || []).length) {
      const empty = document.createElement('p');
      empty.className = 'office-empty';
      empty.textContent = 'Ainda não há plantel — cria-o no Setup (à mão ou com Generate Squad).';
      card.appendChild(empty);
      return card;
    }

    const formation = document.createElement('p');
    formation.className = 'office-formation';
    formation.textContent = `Formação: ${squad.formation || '—'}`;
    card.appendChild(formation);

    const hint = document.createElement('p');
    hint.className = 'office-hint';
    hint.textContent = 'OVR editável aqui — espelha o que mudaste no jogo/Live Editor.';
    card.appendChild(hint);

    for (const g of GROUPS) {
      const players = squad[g.key] || [];
      if (!players.length) continue;
      const lbl = document.createElement('p');
      lbl.className = 'office-group-label';
      lbl.textContent = g.label;
      card.appendChild(lbl);
      const list = document.createElement('div');
      list.className = 'office-squad-list';
      players.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'office-squad-row';
        const pos = document.createElement('span');
        pos.className = 'office-squad-pos';
        pos.textContent = p.position || '—';
        const name = document.createElement('span');
        name.className = 'office-squad-name';
        name.textContent = p.name;
        const ovr = document.createElement('input');
        ovr.type = 'number';
        ovr.min = '1'; ovr.max = '99';
        ovr.className = 'form-input office-squad-ovr';
        ovr.value = p.ovr || '';
        ovr.placeholder = '—';
        ovr.addEventListener('change', () => _saveOvr(g.key, i, ovr.value));
        row.append(pos, name, ovr);
        list.appendChild(row);
      });
      card.appendChild(list);
    }
    return card;
  }

  function _rulesCard() {
    const card = document.createElement('div');
    card.className = 'card office-card';
    const title = document.createElement('p');
    title.className = 'office-card-title';
    title.textContent = 'Regras do plantel';
    card.appendChild(title);

    const rules = (Storage.get(Storage.KEYS.RULESET)?.squad_rules || []).slice(0, 3);
    if (rules.length) {
      const list = document.createElement('ul');
      list.className = 'office-rules';
      for (const r of rules) {
        const li = document.createElement('li');
        li.textContent = r;
        list.appendChild(li);
      }
      card.appendChild(list);
    } else {
      const empty = document.createElement('p');
      empty.className = 'office-empty';
      empty.textContent = 'Sem ruleset gerado ainda.';
      card.appendChild(empty);
    }

    const note = document.createElement('p');
    note.className = 'office-hint';
    note.textContent = 'Só leitura — o ruleset edita-se no Boardroom.';
    card.appendChild(note);
    return card;
  }

  function render(panel) {
    panel.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'office-wrap';

    const h = document.createElement('h2');
    h.textContent = 'Club Office';
    wrap.appendChild(h);

    const nav = document.createElement('div');
    nav.className = 'office-nav';
    const logBtn = document.createElement('button');
    logBtn.className = 'btn-primary';
    logBtn.textContent = 'Season Log & Trophies';
    logBtn.addEventListener('click', () => {
      HubModule.render(HUB_VIEW);
      App.navigate('hub');
    });
    const chBtn = document.createElement('button');
    chBtn.className = 'btn-primary';
    chBtn.textContent = 'Challenges';
    chBtn.addEventListener('click', () => {
      ChallengesModule.render();
      App.navigate('challenges');
    });
    nav.append(logBtn, chBtn);
    wrap.appendChild(nav);

    wrap.appendChild(_squadCard(_setup()));
    wrap.appendChild(_rulesCard());
    panel.appendChild(wrap);
  }

  return { render };
})();
