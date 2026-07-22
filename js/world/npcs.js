// Fase 3 — relationship engine + NPC roster (cg_npcs) + shared card UI.
// NPC: { id, name, category, role, personality, value 0-100, streak,
//        interacted (this beat), history: [{event, delta, season}] }
// Beat = the Estádio pós-jogo. Hangouts apply their rise immediately and mark
// `interacted`; the beat then only decays whoever was NOT interacted with.
// Fans are a collective NPC: no streak, moved only by results (derby doubles).
const WorldNPCs = (() => {
  // Spec defaults (2026-07-20 npc spec, [PROPOSTA] accepted by Dany 2026-07-22):
  // rise 3, decay 2, escalation -5 at streak 10, 15, 20…; família near-immune
  // to isolated misses, imprensa streak-gated (Fase 4), adeptos result-driven.
  const TUNING = {
    family:       { baseline: 80, rise: 3, decay: 0, decayFrom: 0 },
    press:        { baseline: 50, rise: 3, decay: 2, decayFrom: 3 },
    professional: { baseline: 50, rise: 3, decay: 2, decayFrom: 1 },
    teammate:     { baseline: 50, rise: 3, decay: 2, decayFrom: 1 },
    fans:         { baseline: 50, rise: 3, decay: 2, decayFrom: 0 },
  };
  const ESCALATION = 5; // extra hit at streak 10, 15, 20…

  function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }

  function makeNpc(name, category, role, personality) {
    return {
      id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name, category, role, personality: personality || '',
      value: (TUNING[category] || TUNING.professional).baseline,
      streak: 0, interacted: false, history: [],
    };
  }

  function addEvent(npc, event, delta, season) {
    npc.value = clamp(npc.value + delta);
    npc.history.push({ event, delta, season });
    if (npc.history.length > 12) npc.history = npc.history.slice(-12);
  }

  // Positive interaction NOW (hangout, duo challenge win…): rise + streak reset.
  // Escalation hits already taken stay banked — value only recovers via rises.
  function interact(npc, event, season, extraDelta) {
    const t = TUNING[npc.category] || TUNING.professional;
    addEvent(npc, event, t.rise + (extraDelta || 0), season);
    npc.streak = 0;
    npc.interacted = true;
  }

  // One beat for one NPC (fans excluded — see fansBeat). Returns the delta.
  function beat(npc, season) {
    if (npc.category === 'fans') return 0;
    if (npc.interacted) { npc.interacted = false; return 0; }
    const t = TUNING[npc.category] || TUNING.professional;
    npc.streak += 1;
    let delta = 0;
    if (npc.streak >= t.decayFrom && t.decay) delta -= t.decay;
    if (npc.streak >= 10 && npc.streak % 5 === 0) delta -= ESCALATION;
    if (delta) addEvent(npc, `Sem interação (streak ${npc.streak})`, delta, season);
    return delta;
  }

  // Fans move with results only: W +3, D 0, L -2; challenge done +2 / failed -2;
  // everything doubled on a derby. No neglect streak.
  function fansDelta(res, isDerby, challengeResult) {
    let d = res === 'W' ? 3 : res === 'L' ? -2 : 0;
    if (challengeResult === true) d += 2;
    else if (challengeResult === false) d -= 2;
    return isDerby ? d * 2 : d;
  }

  // ── roster storage ─────────────────────────────────────────
  function load() {
    const data = Storage.get(Storage.KEYS.NPCS);
    return data && Array.isArray(data.list) ? data : { list: [] };
  }
  function save(data) { Storage.set(Storage.KEYS.NPCS, data); }
  function byCategory(data, cat) { return data.list.filter(n => n.category === cat); }
  function fans(data) {
    let f = data.list.find(n => n.category === 'fans');
    if (!f) { f = makeNpc('Adeptos', 'fans', 'Bancada'); data.list.push(f); }
    return f;
  }

  // Runs after a match entry is saved (the beat for every roster NPC).
  function processMatchBeat(outcome) {
    const season = Storage.get(Storage.KEYS.SETUP)?.season || 1;
    const data = load();
    const f = fans(data);
    const fd = fansDelta(outcome.res, outcome.isDerby, outcome.challengeResult);
    if (fd) {
      addEvent(f, `${outcome.isDerby ? 'DERBY ' : ''}vs ${outcome.opponent} (${outcome.res})`, fd, season);
    }
    for (const npc of data.list) beat(npc, season);
    save(data);
  }

  // Duo/teammate challenge outcome weighs more than a loose check-in (spec).
  // Applies to roster members whose name appears in the challenge text; delta
  // is f(to)-f(from) so toggling the tracker status never double-counts.
  function applyChallengeOutcome(ch, fromStatus, toStatus) {
    const f = s => s === 'Completed' ? 5 : s === 'Failed' ? -5 : 0;
    const delta = f(toStatus) - f(fromStatus);
    if (!delta) return;
    const season = Storage.get(Storage.KEYS.SETUP)?.season || 1;
    const text = `${ch.title} ${ch.description} ${ch.hub_line || ''}`.toLowerCase();
    const data = load();
    let changed = false;
    for (const npc of data.list) {
      const involved = npc.category === 'teammate' ||
        (npc.category === 'professional' && npc.role === 'Treinador');
      if (!involved || !text.includes(npc.name.trim().toLowerCase())) continue;
      addEvent(npc, `${delta > 0 ? 'Challenge cumprido' : 'Challenge falhado'}: ${ch.title}`, delta, season);
      if (delta > 0) { npc.streak = 0; npc.interacted = true; }
      changed = true;
    }
    if (changed) save(data);
  }

  // ── shared card UI (Casa + Balneário) ──────────────────────
  function buildCard(npc, onHangout) {
    const card = document.createElement('div');
    card.className = 'card npc-card';

    const head = document.createElement('div');
    head.className = 'npc-head';
    const who = document.createElement('div');
    const name = document.createElement('p');
    name.className = 'npc-name';
    name.textContent = npc.name;
    const role = document.createElement('p');
    role.className = 'npc-role';
    role.textContent = npc.role + (npc.personality ? ` — ${npc.personality}` : '');
    who.append(name, role);
    head.appendChild(who);
    const val = document.createElement('span');
    val.className = 'npc-value' + (npc.value < 30 ? ' low' : npc.value >= 70 ? ' high' : '');
    val.textContent = npc.value;
    head.appendChild(val);
    card.appendChild(head);

    const bar = document.createElement('div');
    bar.className = 'npc-bar';
    const fill = document.createElement('div');
    fill.className = 'npc-bar-fill' + (npc.value < 30 ? ' low' : '');
    fill.style.width = `${npc.value}%`;
    bar.appendChild(fill);
    card.appendChild(bar);

    if (npc.streak >= 3) {
      const warn = document.createElement('p');
      warn.className = 'npc-streak';
      warn.textContent = `${npc.streak} beats sem interação`;
      card.appendChild(warn);
    }

    const last = npc.history.slice(-2).reverse();
    if (last.length) {
      const hist = document.createElement('div');
      hist.className = 'npc-history';
      for (const h of last) {
        const line = document.createElement('p');
        line.textContent = `${h.delta > 0 ? '+' : ''}${h.delta} · ${h.event}`;
        hist.appendChild(line);
      }
      card.appendChild(hist);
    }

    if (onHangout) {
      const btn = document.createElement('button');
      btn.className = 'btn-ghost npc-hangout-btn';
      btn.textContent = npc.interacted ? 'Já estiveram juntos' : 'Hang out';
      btn.disabled = npc.interacted;
      btn.addEventListener('click', () => onHangout(npc, btn, card));
      card.appendChild(btn);
    }
    return card;
  }

  // Shared hangout flow: AI mini-event, counts as this beat's positive
  // interaction. Low value (<30) asks the AI for a Live Editor nudge — always
  // and only on the USER'S player (regra 233aed7).
  async function hangout(npc, btn, card, rerender) {
    btn.disabled = true;
    btn.textContent = 'A gerar…';
    try {
      const result = await API.generateHangout(npc);
      const season = Storage.get(Storage.KEYS.SETUP)?.season || 1;
      const data = load();
      const saved = data.list.find(n => n.id === npc.id);
      if (saved) {
        interact(saved, `Hang out: ${result.summary}`, season);
        save(data);
      }
      const scene = document.createElement('p');
      scene.className = 'npc-scene';
      scene.textContent = result.scene;
      card.insertBefore(scene, btn);
      if (result.live_editor_suggestion) {
        const le = document.createElement('p');
        le.className = 'npc-le';
        le.textContent = `Live Editor (o TEU jogador): ${result.live_editor_suggestion}`;
        card.insertBefore(le, btn);
      }
      // a cena fica no ecrã até o user a fechar — só aí a lista atualiza
      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn-ghost npc-hangout-btn';
      closeBtn.textContent = 'Fechar';
      closeBtn.addEventListener('click', () => { if (rerender) rerender(); });
      card.appendChild(closeBtn);
      btn.remove();
    } catch (err) {
      App.showError(err.message);
      btn.disabled = false;
      btn.textContent = 'Hang out';
    }
  }

  const api = { TUNING, makeNpc, addEvent, interact, beat, fansDelta,
    load, save, byCategory, fans, processMatchBeat, applyChallengeOutcome,
    buildCard, hangout, clamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
