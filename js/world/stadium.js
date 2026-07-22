// Estádio — match loop (Fase 2): pré-jogo, match challenges por surpresa
// contextual (código decide, AI escreve), pós-jogo com report + fan reaction,
// e rivalidade derivada das derrotas. Tudo aditivo dentro de cg_hub:
//   hub.upcoming, hub.rival {name, since}, hub.rivalHistory, hub.tablePosition,
//   entry.match {...} nas entries de hub.log.
const WorldStadium = (() => {

  // ── pure logic (Node-testable) ─────────────────────────────
  function matchEntries(log) {
    return (log || []).filter(e => e && !e.isDivider && e.match && e.match.outcome);
  }

  // last n results, oldest → newest, e.g. ['W','L','D']
  function deriveForm(log, n) {
    return matchEntries(log).slice(-(n || 5)).map(e => e.match.outcome.res);
  }

  // Rival = team you lost to most (≥2 losses). Chronological scan: a challenger
  // only takes the title by EXCEEDING the incumbent's count at that moment —
  // ties keep the incumbent, and "first to exceed" wins naturally.
  function deriveRival(log, currentName) {
    const counts = {};
    let best = currentName || null;
    for (const e of matchEntries(log)) {
      if (e.match.outcome.res !== 'L') continue;
      const k = String(e.match.opponent || '').trim();
      if (!k) continue;
      counts[k] = (counts[k] || 0) + 1;
      if (k === best) continue;
      const incumbentN = best ? (counts[best] || 0) : 1;
      if (counts[k] >= 2 && counts[k] > incumbentN) best = k;
    }
    if (best && (counts[best] || 0) < 2 && !currentName) return null;
    return best;
  }

  function headToHead(log, name) {
    const h = { w: 0, d: 0, l: 0 };
    const target = String(name || '').trim().toLowerCase();
    if (!target) return h;
    for (const e of matchEntries(log)) {
      if (String(e.match.opponent || '').trim().toLowerCase() !== target) continue;
      const r = e.match.outcome.res;
      if (r === 'W') h.w++; else if (r === 'D') h.d++; else h.l++;
    }
    return h;
  }

  // Code decides the surprise, never the model. Base 20%, boosts add, cap 80%.
  // Derby skips the math straight to the cap.
  function challengeChance(flags) {
    if (flags.isDerby) return 0.8;
    let c = 0.2;
    if (flags.closeInTable) c += 0.25;
    if (flags.streak)       c += 0.2;
    if (flags.rematch)      c += 0.15;
    return Math.min(0.8, c);
  }

  // ≥3 consecutive identical results at the tail of the form
  function hasStreak(form) {
    if (!form || form.length < 3) return false;
    const last = form[form.length - 1];
    return form.slice(-3).every(r => r === last);
  }

  // true/false = auto-resolved, null = self-report (metric none)
  function evalChallenge(challenge, stats) {
    if (!challenge || challenge.metric === 'none') return null;
    const t = challenge.target || 1;
    switch (challenge.metric) {
      case 'goals':        return (stats.goals || 0) >= t;
      case 'assists':      return (stats.assists || 0) >= t;
      case 'wins':         return stats.res === 'W';
      case 'clean_sheets': return (stats.ga || 0) === 0;
      case 'rating_avg':   return (stats.rating || 0) >= t;
      default:             return null;
    }
  }

  // ── storage helpers ────────────────────────────────────────
  function _hub() { return Storage.get(Storage.KEYS.HUB) || { log: [], tracker: {}, players: [], seasons: [] }; }
  function _save(hub) { Storage.set(Storage.KEYS.HUB, hub); }
  function _uid() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  let _panel = null;

  // ── UI ─────────────────────────────────────────────────────
  function _mural(hub) {
    const card = document.createElement('div');
    card.className = 'stadium-mural';
    const title = document.createElement('p');
    title.className = 'stadium-mural-title';
    title.textContent = 'Mural da Rivalidade';
    card.appendChild(title);
    const body = document.createElement('p');
    body.className = 'stadium-mural-body';
    if (hub.rival?.name) {
      const h2h = headToHead(hub.log, hub.rival.name);
      body.textContent = `${hub.rival.name} — rival desde a época ${hub.rival.since}. Contra eles: ${h2h.w}W ${h2h.d}D ${h2h.l}L.`;
    } else {
      body.textContent = 'Ainda sem rival. As derrotas repetidas contra a mesma equipa decidem isto sozinhas.';
    }
    card.appendChild(body);
    if (typeof WorldNPCs !== 'undefined') {
      const fansNpc = WorldNPCs.load().list.find(n => n.category === 'fans');
      if (fansNpc) {
        const fansLine = document.createElement('p');
        fansLine.className = 'stadium-mural-fans';
        fansLine.textContent = `Adeptos: ${fansNpc.value}/100`;
        card.appendChild(fansLine);
      }
    }
    return card;
  }

  function _challengeCard(ch, result) {
    const card = document.createElement('div');
    card.className = 'stadium-challenge' + (ch.high_stakes ? ' high-stakes' : '');
    const head = document.createElement('p');
    head.className = 'stadium-challenge-title';
    head.textContent = (ch.high_stakes ? 'HIGH STAKES — ' : 'Match challenge — ') + ch.title;
    card.appendChild(head);
    const desc = document.createElement('p');
    desc.className = 'stadium-challenge-desc';
    desc.textContent = ch.description;
    card.appendChild(desc);
    if (result === true || result === false) {
      const tag = document.createElement('span');
      tag.className = `stadium-challenge-result ${result ? 'ok' : 'fail'}`;
      tag.textContent = result ? 'Cumprido' : 'Falhado';
      card.appendChild(tag);
    }
    return card;
  }

  function _numInput(cls, placeholder, min, max) {
    const el = document.createElement('input');
    el.type = 'number';
    el.className = 'form-input ' + cls;
    el.placeholder = placeholder;
    if (min !== undefined) el.min = String(min);
    if (max !== undefined) el.max = String(max);
    return el;
  }

  function _preMatchForm(hub) {
    const card = document.createElement('div');
    card.className = 'card stadium-form';
    const h = document.createElement('p');
    h.className = 'stadium-section-title';
    h.textContent = 'Próximo jogo';
    card.appendChild(h);

    const oppInput = document.createElement('input');
    oppInput.type = 'text';
    oppInput.className = 'form-input stadium-opp';
    oppInput.placeholder = 'Adversário';
    card.appendChild(oppInput);

    const row = document.createElement('div');
    row.className = 'stadium-row';
    const oppPos = _numInput('stadium-pos', 'Posição deles', 1, 30);
    const ownPos = _numInput('stadium-pos', 'A tua posição', 1, 30);
    if (hub.tablePosition) ownPos.value = hub.tablePosition;
    row.append(oppPos, ownPos);
    card.appendChild(row);

    const form = deriveForm(hub.log, 5);
    const formLine = document.createElement('p');
    formLine.className = 'stadium-formline';
    formLine.textContent = form.length
      ? `Forma recente: ${form.join('-')}`
      : 'Forma recente: sem jogos registados ainda.';
    card.appendChild(formLine);

    const btn = document.createElement('button');
    btn.className = 'btn-primary';
    btn.textContent = 'Confirmar jogo';
    btn.addEventListener('click', async () => {
      const opponent = oppInput.value.trim();
      if (!opponent) { App.showError('Escreve o adversário.'); return; }
      btn.disabled = true;
      btn.textContent = 'A preparar o jogo…';

      const hubNow = _hub();
      const setup = Storage.get(Storage.KEYS.SETUP);
      hubNow.tablePosition = parseInt(ownPos.value) || hubNow.tablePosition || null;

      const rivalName = hubNow.rival?.name || null;
      const isDerby = !!rivalName && rivalName.trim().toLowerCase() === opponent.toLowerCase();
      const oppP = parseInt(oppPos.value) || null;
      const flags = {
        isDerby,
        closeInTable: !!(oppP && hubNow.tablePosition && Math.abs(oppP - hubNow.tablePosition) <= 2),
        streak: hasStreak(deriveForm(hubNow.log, 5)),
        rematch: matchEntries(hubNow.log).some(e =>
          e.match.challenge && String(e.match.opponent).trim().toLowerCase() === opponent.toLowerCase()),
      };
      const wantChallenge = Math.random() < challengeChance(flags);
      const highStakes = wantChallenge && Math.random() < 1 / 7;

      hubNow.upcoming = {
        opponent, oppPosition: oppP, isDerby,
        season: setup?.season || 1, ts: new Date().toISOString(),
        // roll do challenge é feito AGORA por código — persiste para que um
        // retry da call de AI não mude a sorte nem perca o challenge rolado
        wantChallenge, highStakes, rematch: flags.rematch,
      };
      _save(hubNow);

      try {
        const result = await API.preMatch({
          opponent, oppPosition: oppP, ownPosition: hubNow.tablePosition,
          form: deriveForm(hubNow.log, 5),
          rival: hubNow.rival || null,
          h2h: rivalName ? headToHead(hubNow.log, rivalName) : null,
          isDerby, rematch: flags.rematch, wantChallenge, highStakes,
        });
        const hubAfter = _hub();
        if (hubAfter.upcoming) {
          hubAfter.upcoming.reaction = result.reaction;
          if (result.challenge) hubAfter.upcoming.challenge = result.challenge;
          _save(hubAfter);
        }
      } catch (err) {
        App.showError(err.message);
      }
      render(_panel);
    });
    card.appendChild(btn);
    return card;
  }

  function _upcomingCard(hub) {
    const up = hub.upcoming;
    const card = document.createElement('div');
    card.className = 'card stadium-upcoming' + (up.isDerby ? ' derby' : '');
    const h = document.createElement('p');
    h.className = 'stadium-section-title';
    h.textContent = `Jogo marcado: vs ${up.opponent}` + (up.oppPosition ? ` (${up.oppPosition}.º)` : '');
    card.appendChild(h);
    if (up.isDerby) {
      const tag = document.createElement('span');
      tag.className = 'stadium-derby-tag';
      tag.textContent = 'DERBY';
      card.appendChild(tag);
    }
    if (up.reaction) {
      const p = document.createElement('p');
      p.className = 'stadium-reaction';
      p.textContent = up.reaction;
      card.appendChild(p);
    } else {
      const regen = document.createElement('button');
      regen.className = 'btn-ghost';
      regen.textContent = 'Gerar reação de antevisão';
      regen.addEventListener('click', async () => {
        regen.disabled = true;
        regen.textContent = 'A gerar…';
        try {
          const hubNow = _hub();
          const rivalName = hubNow.rival?.name || null;
          const result = await API.preMatch({
            opponent: up.opponent, oppPosition: up.oppPosition,
            ownPosition: hubNow.tablePosition,
            form: deriveForm(hubNow.log, 5),
            rival: hubNow.rival || null,
            h2h: rivalName ? headToHead(hubNow.log, rivalName) : null,
            isDerby: up.isDerby, rematch: !!up.rematch,
            wantChallenge: !!up.wantChallenge, highStakes: !!up.highStakes,
          });
          const hubAfter = _hub();
          if (hubAfter.upcoming) {
            hubAfter.upcoming.reaction = result.reaction;
            if (result.challenge) hubAfter.upcoming.challenge = result.challenge;
            _save(hubAfter);
          }
          render(_panel);
        } catch (err) {
          App.showError(err.message);
          regen.disabled = false;
          regen.textContent = 'Gerar reação de antevisão';
        }
      });
      card.appendChild(regen);
    }
    if (up.challenge) card.appendChild(_challengeCard(up.challenge));

    const cancel = document.createElement('button');
    cancel.className = 'btn-ghost stadium-cancel';
    cancel.textContent = 'Cancelar este jogo';
    cancel.addEventListener('click', () => {
      const hubNow = _hub();
      delete hubNow.upcoming;
      _save(hubNow);
      render(_panel);
    });
    card.appendChild(cancel);
    return card;
  }

  function _postMatchForm(hub) {
    const up = hub.upcoming;
    const setup = Storage.get(Storage.KEYS.SETUP);
    const solo = setup?.mode === 'player' || setup?.mode === 'fiction';

    const card = document.createElement('div');
    card.className = 'card stadium-form';
    const h = document.createElement('p');
    h.className = 'stadium-section-title';
    h.textContent = 'Pós-jogo — como correu?';
    card.appendChild(h);

    const scoreRow = document.createElement('div');
    scoreRow.className = 'stadium-row stadium-score';
    const usLbl = document.createElement('span');
    usLbl.className = 'stadium-score-lbl';
    usLbl.textContent = 'Nós';
    const gfIn = _numInput('stadium-goal', '0', 0, 99);
    const dash = document.createElement('span');
    dash.textContent = '–';
    const gaIn = _numInput('stadium-goal', '0', 0, 99);
    const themLbl = document.createElement('span');
    themLbl.className = 'stadium-score-lbl';
    themLbl.textContent = up.opponent;
    scoreRow.append(usLbl, gfIn, dash, gaIn, themLbl);
    card.appendChild(scoreRow);

    let goalsIn = null, assistsIn = null, ratingIn = null;
    if (solo) {
      const row = document.createElement('div');
      row.className = 'stadium-row';
      goalsIn = _numInput('stadium-stat', 'Golos teus', 0, 99);
      assistsIn = _numInput('stadium-stat', 'Assists', 0, 99);
      ratingIn = _numInput('stadium-stat', 'Nota (opc.)', 0, 10);
      ratingIn.step = '0.1';
      row.append(goalsIn, assistsIn, ratingIn);
      card.appendChild(row);
    }

    const dateRow = document.createElement('div');
    dateRow.className = 'stadium-row';
    const dayIn = _numInput('stadium-day', 'Dia', 1, 31);
    const monthSel = document.createElement('select');
    monthSel.className = 'form-select';
    ['-', 'January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'].forEach((m, i) => {
      const o = document.createElement('option');
      o.value = i === 0 ? '' : m;
      o.textContent = m === '-' ? 'Mês' : m;
      monthSel.appendChild(o);
    });
    dateRow.append(dayIn, monthSel);
    card.appendChild(dateRow);

    const textarea = document.createElement('textarea');
    textarea.className = 'form-textarea';
    textarea.placeholder = 'Notas do jogo (opcional) — momentos, lesões, o que quiseres que a história saiba…';
    card.appendChild(textarea);

    // metric none → self-report
    let selfResult = null;
    if (up.challenge && up.challenge.metric === 'none') {
      const srRow = document.createElement('div');
      srRow.className = 'stadium-row stadium-selfreport';
      const lbl = document.createElement('span');
      lbl.textContent = 'O challenge:';
      srRow.appendChild(lbl);
      const okBtn = document.createElement('button');
      okBtn.className = 'btn-ghost';
      okBtn.textContent = 'Cumprido';
      const failBtn = document.createElement('button');
      failBtn.className = 'btn-ghost';
      failBtn.textContent = 'Falhado';
      okBtn.addEventListener('click', () => {
        selfResult = true; okBtn.classList.add('selected'); failBtn.classList.remove('selected');
      });
      failBtn.addEventListener('click', () => {
        selfResult = false; failBtn.classList.add('selected'); okBtn.classList.remove('selected');
      });
      srRow.append(okBtn, failBtn);
      card.appendChild(srRow);
    }

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-primary';
    saveBtn.textContent = 'Gravar jogo';
    saveBtn.addEventListener('click', async () => {
      const gf = parseInt(gfIn.value), ga = parseInt(gaIn.value);
      const day = parseInt(dayIn.value), month = monthSel.value;
      if (isNaN(gf) || isNaN(ga)) { App.showError('Preenche o resultado.'); return; }
      if (!day || !month) { App.showError('Escolhe dia e mês.'); return; }
      saveBtn.disabled = true;
      saveBtn.textContent = 'A gravar…';

      const res = gf > ga ? 'W' : gf === ga ? 'D' : 'L';
      const stats = {
        gf, ga, res,
        goals: solo ? parseInt(goalsIn.value) || 0 : gf,
        assists: solo ? parseInt(assistsIn.value) || 0 : 0,
        rating: solo ? parseFloat(ratingIn.value) || 0 : 0,
      };
      const challengeResult = up.challenge
        ? (up.challenge.metric === 'none' ? selfResult : evalChallenge(up.challenge, stats))
        : undefined;

      const hubNow = _hub();
      const freeText = textarea.value.trim();
      const entry = {
        id: _uid(),
        text: freeText || `vs ${up.opponent} ${gf}-${ga} (${res})`,
        timestamp: new Date().toISOString(),
        gameDate: { day, month },
        highlight: undefined,
        match: {
          opponent: up.opponent,
          oppPosition: up.oppPosition || null,
          isDerby: !!up.isDerby,
          season: up.season,
          outcome: { gf, ga, res },
          challenge: up.challenge || null,
          challengeResult,
        },
      };
      if (solo) {
        entry.match.playerGoals = stats.goals;
        entry.match.playerAssists = stats.assists;
        if (stats.rating) entry.match.playerRating = stats.rating;
      }

      hubNow.log = hubNow.log || [];
      hubNow.log.push(entry);

      // rival recalcula-se sozinho a partir das entries
      const before = hubNow.rival?.name || null;
      const after = deriveRival(hubNow.log, before);
      if (after && after !== before) {
        if (before) {
          hubNow.rivalHistory = hubNow.rivalHistory || [];
          hubNow.rivalHistory.push({ ...hubNow.rival, until: up.season });
        }
        hubNow.rival = { name: after, since: up.season };
        entry.match.rivalChanged = after;
      }
      const preReaction = up.reaction || null;
      delete hubNow.upcoming;
      _save(hubNow);

      // o beat da Fase 3: adeptos movem com o resultado, resto decai se ignorado
      if (typeof WorldNPCs !== 'undefined') {
        WorldNPCs.processMatchBeat({
          res, isDerby: !!up.isDerby, challengeResult, opponent: up.opponent,
        });
      }

      // press conference only after big games: derby, high-stakes challenge,
      // or a thrashing either way — same trigger philosophy as the challenges
      const wantPress = !!up.isDerby ||
        !!(up.challenge && up.challenge.high_stakes) ||
        Math.abs(gf - ga) >= 4;
      try {
        const result = await API.reactToCheckIn(entry, { reaction: preReaction }, wantPress);
        const hubAfter = _hub();
        const saved = (hubAfter.log || []).find(e => e.id === entry.id);
        if (saved) {
          saved.match.report = result.report;
          saved.match.fanReaction = result.fan_reaction;
          if (result.press_question) {
            saved.match.press = { question: result.press_question, answers: result.press_answers || [] };
          }
          _save(hubAfter);
        }
      } catch (err) {
        App.showError('Jogo gravado, mas o report falhou — gera-o na lista em baixo. ' + err.message);
      }
      render(_panel);
    });
    card.appendChild(saveBtn);
    return card;
  }

  function _historyEntry(entry) {
    const m = entry.match;
    const card = document.createElement('div');
    card.className = 'card stadium-report' + (m.isDerby ? ' derby' : '');

    const head = document.createElement('div');
    head.className = 'stadium-report-head';
    const title = document.createElement('span');
    title.className = 'stadium-report-title';
    title.textContent = `vs ${m.opponent} ${m.outcome.gf}-${m.outcome.ga} (${m.outcome.res})`;
    head.appendChild(title);
    const when = document.createElement('span');
    when.className = 'stadium-report-date';
    when.textContent = entry.gameDate ? `${entry.gameDate.day} ${entry.gameDate.month}` : '';
    head.appendChild(when);
    card.appendChild(head);

    if (m.isDerby) {
      const tag = document.createElement('span');
      tag.className = 'stadium-derby-tag';
      tag.textContent = 'DERBY';
      card.appendChild(tag);
    }
    if (m.challenge) card.appendChild(_challengeCard(m.challenge, m.challengeResult));

    if (m.report) {
      const rep = document.createElement('p');
      rep.className = 'stadium-report-text';
      rep.textContent = m.report;
      card.appendChild(rep);
    } else {
      const regen = document.createElement('button');
      regen.className = 'btn-ghost';
      regen.textContent = 'Gerar match report';
      regen.addEventListener('click', async () => {
        regen.disabled = true;
        regen.textContent = 'A gerar…';
        try {
          const result = await API.reactToCheckIn(entry, null);
          const hubNow = _hub();
          const saved = (hubNow.log || []).find(e => e.id === entry.id);
          if (saved) {
            saved.match.report = result.report;
            saved.match.fanReaction = result.fan_reaction;
            _save(hubNow);
          }
          render(_panel);
        } catch (err) {
          App.showError(err.message);
          regen.disabled = false;
          regen.textContent = 'Gerar match report';
        }
      });
      card.appendChild(regen);
    }
    if (m.fanReaction) {
      const fan = document.createElement('p');
      fan.className = 'stadium-fan';
      fan.textContent = `Bancada: "${m.fanReaction}"`;
      card.appendChild(fan);
    }
    if (m.press) card.appendChild(_pressBlock(entry, m));
    return card;
  }

  // Press conference (Fase 4 hook): the answer feeds the press relation —
  // diplomatic +2, fiery -1 (they love the drama, you less so), dismissive -3.
  const PRESS_DELTA = { diplomatic: 2, fiery: -1, dismissive: -3 };

  function _pressBlock(entry, m) {
    const block = document.createElement('div');
    block.className = 'stadium-press';
    const q = document.createElement('p');
    q.className = 'stadium-press-q';
    q.textContent = `Imprensa: "${m.press.question}"`;
    block.appendChild(q);

    if (m.pressAnswer) {
      const a = document.createElement('p');
      a.className = 'stadium-press-a';
      a.textContent = `Tu: "${m.pressAnswer.text}"`;
      block.appendChild(a);
      return block;
    }

    for (const ans of (m.press.answers || [])) {
      const btn = document.createElement('button');
      btn.className = 'btn-ghost stadium-press-btn';
      btn.textContent = ans.text;
      btn.addEventListener('click', () => {
        const hubNow = _hub();
        const saved = (hubNow.log || []).find(e => e.id === entry.id);
        if (saved) { saved.match.pressAnswer = { text: ans.text, tone: ans.tone }; _save(hubNow); }
        if (typeof WorldNPCs !== 'undefined') {
          const npcData = WorldNPCs.load();
          const press = npcData.list.find(n => n.category === 'press');
          if (press) {
            const season = Storage.get(Storage.KEYS.SETUP)?.season || 1;
            const delta = PRESS_DELTA[ans.tone] ?? 0;
            WorldNPCs.addEvent(press, `Conferência (${ans.tone}): "${ans.text}"`, delta, season);
            if (delta > 0) { press.streak = 0; press.interacted = true; }
            WorldNPCs.save(npcData);
          }
        }
        render(_panel);
      });
      block.appendChild(btn);
    }
    return block;
  }

  function render(panel) {
    _panel = panel;
    panel.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'stadium-wrap';

    const h = document.createElement('h2');
    h.textContent = 'Estádio';
    wrap.appendChild(h);

    const hub = _hub();
    wrap.appendChild(_mural(hub));

    if (hub.upcoming) {
      wrap.appendChild(_upcomingCard(hub));
      wrap.appendChild(_postMatchForm(hub));
    } else {
      wrap.appendChild(_preMatchForm(hub));
    }

    const reports = matchEntries(hub.log).reverse();
    if (reports.length) {
      const ht = document.createElement('p');
      ht.className = 'stadium-section-title stadium-history-title';
      ht.textContent = 'Match reports';
      wrap.appendChild(ht);
      for (const e of reports) wrap.appendChild(_historyEntry(e));
    }

    panel.appendChild(wrap);
  }

  const api = { render };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      matchEntries, deriveForm, deriveRival, headToHead,
      challengeChance, hasStreak, evalChallenge,
    };
  }
  return api;
})();
