const API = (() => {
  const ENDPOINT      = 'https://api.anthropic.com/v1/messages';
  const DEFAULT_MODEL = 'claude-sonnet-4-6';

  function getModel() {
    return Storage.get(Storage.KEYS.MODEL) || DEFAULT_MODEL;
  }

  function setModel(model) {
    Storage.set(Storage.KEYS.MODEL, model);
  }

  // ── Structured Output Schemas ────────────────────────────────
  // Passed as output_config.format (json_schema) — the API guarantees the
  // response is valid JSON matching the schema, so parse failures disappear.
  const S = {
    str:    { type: 'string' },
    int:    { type: 'integer' },
    strArr: { type: 'array', items: { type: 'string' } },
    arr(items) { return { type: 'array', items }; },
    obj(properties, required) {
      return {
        type: 'object',
        properties,
        required: required || Object.keys(properties),
        additionalProperties: false,
      };
    },
  };

  const NARRATIVE_SCHEMA = S.obj({
    manager_backstory: S.str,
    club_situation:    S.str,
    season_framing:    S.str,
    narrative_events:  S.strArr,
  });

  const CHALLENGE_SCHEMA = S.obj({
    title:       S.str,
    type:        S.str,
    description: S.str,
    duration:    S.str,
    stakes:      S.str,
    difficulty:  { type: 'string', enum: ['Mild', 'Brutal', 'Savage'] },
    hub_line:    S.str,
  });

  const PLAYER_CHALLENGES_SCHEMA = S.obj({ challenges: S.arr(CHALLENGE_SCHEMA) });

  const SAVE_CONCEPT_SCHEMA = S.obj({
    manager: S.str, club: S.str, league: S.str, division: S.str,
    season: S.int, difficulty: S.str, era: S.str, save_concept: S.str,
  });

  const PLAYER_CONCEPT_SCHEMA = S.obj({
    player_name: S.str, player_age: S.int, player_position: S.str, player_nationality: S.str,
    player_ovr: S.int, player_potential: S.int, player_weak_foot: S.int, player_skill_moves: S.int,
    concept_type: S.str, concept_hook: S.str,
    manager: S.str, club: S.str, league: S.str, division: S.str, difficulty: S.str,
  });

  const FICTION_CONCEPT_SCHEMA = S.obj({
    player_name: S.str, player_age: S.int, player_position: S.str, player_nationality: S.str,
    manager: S.str, club: S.str, league: S.str, division: S.str,
    difficulty: S.str, concept_hook: S.str,
  });

  const RULESET_SCHEMA = S.obj({
    squad_rules:    S.strArr,
    transfer_rules: S.strArr,
    gameplay_rules: S.strArr,
    special_mechanics: S.obj({ chaos_wheel: S.str, protected_player: S.str, academy_tracker: S.str }),
    hub_summary: S.obj({
      squad_rules: S.strArr, transfer_rules: S.strArr, gameplay_rules: S.strArr,
      chaos_wheel: S.str, protected_player: S.str, academy_tracker: S.str,
    }),
  });

  const EVENTS_SCHEMA = S.obj({
    events: S.arr(S.obj({ text: S.str, type: { type: 'string', enum: ['positive', 'negative'] } })),
  });

  const SUMMARY_SCHEMA = S.obj({ summary: S.str });

  const CAREER_MOVE_SCHEMA = S.obj({
    type: S.str, title: S.str, narrative: S.str, stakes: S.str, mechanic: S.str,
  });

  const CONDENSE_SCHEMA = S.obj({
    challenges: S.strArr, squad_rules: S.strArr, transfer_rules: S.strArr, gameplay_rules: S.strArr,
    chaos_wheel: S.str, protected_player: S.str, academy_tracker: S.str,
  });

  const VALUE_SCHEMA = S.obj({ value: S.str });
  const RULE_SCHEMA  = S.obj({ rule: S.str });

  const SYSTEM_NARRATIVE = `You are a career mode narrative engine for FC 25. Your job is to generate deeply immersive, specific, and emotionally grounded storylines for a football manager career save.

You will receive structured save data: club name, league, division, season number, manager name, difficulty, and era tag. Use ALL of this to generate content that is specific to that exact save — not generic football manager clichés.

RULES YOU MUST FOLLOW:
- Never use phrases like "prove the doubters wrong", "fulfill your potential", "a club with a rich history", or any other cliché that could apply to any save.
- Every narrative element must be specific. Name tensions, name factions, name pressure points. Vague is failure.
- The manager backstory must feel earned — a reason why THIS person is at THIS club at THIS moment. It should create a slight emotional weight, not just set context.
- The club situation must reflect realistic football dynamics — financial pressure, board politics, fan frustration, squad age issues, recent form. Pick 2-3 and make them feel interconnected.
- Narrative events seeded at the start must be ticking time bombs — things that will force a decision or create drama before the season ends. Not background flavour.
- Season 1 saves feel like chaos and uncertainty. Season 3+ saves feel like legacy and pressure. Adjust tone accordingly.
- If the era tag is "Fallen Giant" — the narrative must feel like decay and desperate rebuilding. If it's "Golden Gen" — it must feel like a window closing. Match the era.
- Write in punchy, direct prose. No essays. Mobile-readable paragraphs. Each section max 4-5 sentences.

OUTPUT FORMAT (strict JSON):
{
"manager_backstory": "string",
"club_situation": "string",
"season_framing": "string",
"narrative_events": ["string", "string"]
}

Return ONLY the JSON object. No preamble, no explanation, no markdown fences.`;

  const SYSTEM_CHALLENGE = `You are a challenge engine for a serious FC 25 career mode player. Your job is to generate challenges that create real narrative tension, force difficult decisions, and make the save feel like it has stakes.

You will receive: club, league, division, season number, era tag, and which challenge TYPE to generate (season_objective / transfer_rule / performance_trigger / player_challenge / chaos).

THE BAR IS HIGH. These challenges must NOT be things you would find on a Reddit list. They must feel designed for someone who already plays with a Chaos Wheel, a Protected Player system, performance-based budget penalties, and academy tracking rules. That is the baseline. Clear it.

RULES BY CHALLENGE TYPE:

SEASON OBJECTIVE:
- Must create a structural constraint that lasts all season and changes HOW the user builds and manages the squad
- Must have a clear pass/fail condition with a meaningful consequence if failed
- Cannot be something passive — it must force active decisions throughout the season

TRANSFER RULE:
- Must create a genuine dilemma in the transfer window, not just a random restriction
- The best ones create a system — a rule that interacts with other decisions
- Must specify: what you can/cannot do, and what happens if broken

PERFORMANCE TRIGGER:
- Must be conditional — activates ONLY when a specific result pattern occurs
- Must have both a negative trigger AND a positive trigger (punishment for bad runs, reward/unlock for good runs)
- The consequence must sting enough to matter but not destroy the save

PLAYER CHALLENGE:
- Must be tied to a specific player archetype (highest earner, youngest starter, academy product, Protected Player, most appearances, etc.)
- Must create a tension between squad management and the rule
- Must have a consequence that is personal and narrative — not just budget-based

CHAOS:
- These are wild, unpredictable, and occasionally cruel
- They must be the kind of thing that makes the user laugh or groan — not rage quit
- They can be absurd but must be executable within FC 25's actual mechanics
- Always involve a random element (dice roll, coin flip, first letter of next opponent's name, etc.)

OUTPUT FORMAT (strict JSON):
{
"title": "string (max 6 words)",
"type": "season_objective | transfer_rule | performance_trigger | player_challenge | chaos",
"description": "string (2-4 sentences max)",
"duration": "string (e.g. 'Full season', 'Next transfer window', 'Until triggered')",
"stakes": "string (1-2 sentences — what happens if broken or failed)",
"difficulty": "Mild | Brutal | Savage",
"hub_line": "string — ONE line, max 12 words. The core constraint only: what you must/cannot do. Direct, assertive. Arrow (→) for conditional triggers. Zero context, zero fluff."
}

Return ONLY the JSON object. No preamble, no explanation, no markdown fences.`;

  const SYSTEM_SAVE_CONCEPT = `You are an FC 25 career mode save architect. Design compelling, narratively rich career mode save concepts for serious players with hundreds of hours in the game.

ALLOWED LEAGUES — EXACT LIST. These are the ONLY leagues that exist in FC 25. Any club not in one of these leagues is a hard failure. No exceptions.

ENGLAND (4 leagues):
  Premier League        → 1st Division
  Championship          → 2nd Division
  League One            → 3rd Division
  League Two            → 4th Division

SPAIN (2 leagues):
  La Liga               → 1st Division
  La Liga 2             → 2nd Division

GERMANY (3 leagues):
  Bundesliga            → 1st Division
  2. Bundesliga         → 2nd Division
  3. Liga               → 3rd Division

FRANCE (2 leagues):
  Ligue 1               → 1st Division
  Ligue 2               → 2nd Division

ITALY (2 leagues):
  Serie A               → 1st Division
  Serie B               → 2nd Division

PORTUGAL (1 league only — FC 25 has NO Portuguese second division):
  Liga Portugal Bwin    → 1st Division

NETHERLANDS:
  Eredivisie            → 1st Division

BELGIUM:
  Pro League            → 1st Division

TURKEY:
  Süper Lig             → 1st Division

SAUDI ARABIA:
  Saudi Pro League      → 1st Division

USA:
  MLS                   → 1st Division

NOT IN FC 25 — HARD FAILURE if used:
- Japan (J1 League / J.League) — NOT in FC 25. Clubs like Gamba Osaka, Urawa Red Diamonds, Vissel Kobe, Kashima Antlers — NONE are in FC 25.
- China (CSL) — NOT in FC 25
- South Korea (K League) — NOT in FC 25
- Brazil (Brasileirão) — NOT in FC 25
- Argentina (Liga Profesional) — NOT in FC 25
- Mexico (Liga MX) — NOT in FC 25
- Any other league not listed above

"league" in your output MUST be copied EXACTLY from this list. "division" must match the tier shown above.

DIVISION ACCURACY IS NON-NEGOTIABLE:
- You must know with 100% certainty which league a club is in for FC 25 (2024/25 season) before picking it.
- If you are not certain, pick a DIFFERENT club you ARE certain about. A wrong division is an automatic failure.
- Do not guess. Do not estimate. Do not pick a club because it "sounds right" — only pick clubs you are certain about.

MANDATORY QUALITY RULES — break any of these and the response is a failure:
- "manager" MUST be a realistic coaching name — a gaffer, a manager, NOT a player. Culturally plausible for the club's country. Examples: Nuno Espírito Santo, Slaviša Jokanović, Artur Jorge, Hansi Flick, Paulo Fonseca, Julen Lopetegui, Roberto De Zerbi. NEVER a player name.
- NEVER generate: Man City, Liverpool, Arsenal, Chelsea, Manchester United, Tottenham, Bayern Munich, Real Madrid, Barcelona — unless the user EXPLICITLY names them.
- ALWAYS choose clubs with story potential: fallen giants, clubs under financial or sporting pressure, unstable fanbases, underdogs with a real identity. Avoid safe, stable, already-successful clubs.
- Explore lower divisions — Championship, League One, League Two, Serie B, 2. Bundesliga, 3. Liga, Ligue 2, La Liga 2 — they have the richest career mode stories.
- "save_concept" = ONE sentence only. A movie logline. Specific, punchy, impossible to confuse with any other save. BANNED phrases: "prove the doubters wrong", "restore former glory", "rise from the ashes", "journey of a lifetime", "new era", "turning point". If it could describe any generic save, rewrite it.
- "era" MUST be EXACTLY one of (copy verbatim): Rebuild Era | Golden Gen | Fallen Giant | Underdog Run | Dynasty Mode | Mid-Table Crisis | Promotion Push | Survival Mode
- "difficulty" MUST be EXACTLY one of: Legendary | Ultimate | Custom
- Manager, club, league, difficulty, and era must tell ONE coherent story.

Return ONLY valid JSON. No markdown fences, no preamble, no explanation.

Output format:
{
  "manager": "string",
  "club": "string",
  "league": "string — exact name from the allowed list above",
  "division": "string — e.g. 1st Division, 2nd Division, 3rd Division",
  "season": 1,
  "difficulty": "Legendary | Ultimate | Custom",
  "era": "exact era value from the list above",
  "save_concept": "one sentence — specific and punchy"
}`;

  const SYSTEM_RULESET = `You are a ruleset architect for a serious FC 25 career mode player. When called, you generate a complete set of self-imposed laws for a career mode save based on the save context provided.

These rules are permanent — they define the boundaries of the entire save, not just one season. They must be coherent as a system, not a random list of restrictions.

You will receive: club, league, division, era tag, difficulty.

RULES FOR GENERATION:
- The ruleset must feel like it was designed for that specific save context. A League Two underdog ruleset should feel like survival and grit. A Premier League fallen giant should feel like political chaos and budget warfare.
- Every rule must be executable within FC 25's actual mechanics — no rules that require features the game doesn't have
- Rules must interact — they should feel like a system, not a checklist
- Include at least one rule that will create a memorable moment of pain at some point in the save
- Squad rules, transfer rules, gameplay rules, and special mechanics must all be covered

IF THE CONTEXT SAYS "PLAYER CAREER SAVE" OR "FICTION PLAYER CAREER SAVE":
- You are NOT the manager. You are writing rules for a PLAYER controlling their own career.
- squad_rules → personal conduct rules: who the player will/won't play alongside, position loyalty, captain ambitions, relationships with teammates
- transfer_rules → career decisions the player must follow: rejecting/accepting clubs, never returning to a former club, only moving upward, loyalty clauses
- gameplay_rules → personal performance standards: minimum avg rating, stats targets per season that trigger Live Editor consequences, play style restrictions
- special_mechanics → tied to the player's personal concept and arc, not the club's finances
- NO rules about squad composition, signing players, board decisions, or budget — the player doesn't control those
- In FICTION MODE specifically: every rule must feel like it belongs to this character's story and identity

OUTPUT FORMAT (strict JSON):
{
"squad_rules": ["string", "string", "string"],
"transfer_rules": ["string", "string", "string"],
"gameplay_rules": ["string", "string", "string"],
"special_mechanics": {
"chaos_wheel": "string — ALWAYS enabled, never disabled. Must be genuinely chaotic and punishing: multiple trigger conditions, wild consequences (fire your best player, sell your top scorer for €1, switch formation permanently, play 3 youth players every game for a month, ban yourself from using a position). The more absurd and painful the better. Do NOT write safe, polite chaos.",
"protected_player": "string (how to select, what protection means, obligations)",
"academy_tracker": "string (rules for tracking youth players)"
},
"hub_summary": {
"squad_rules": ["string — condensed version of each squad rule, max 12 words, direct and assertive"],
"transfer_rules": ["string — same style"],
"gameplay_rules": ["string — same style"],
"chaos_wheel": "string — condensed, max 12 words, or empty string if disabled",
"protected_player": "string — condensed, max 12 words",
"academy_tracker": "string — condensed, max 12 words"
}
}

hub_summary rules: each entry = ONE line, max 12 words, only what you must/cannot do, zero context. Arrow (→) for triggers. Arrays must match the length of their parent arrays exactly.

Return ONLY the JSON object. No preamble, no explanation, no markdown fences.`;

  function getKey() {
    return Storage.get(Storage.KEYS.API_KEY);
  }

  async function call(systemPrompt, userMessage, maxTokens = 2048, schema = null) {
    const key = getKey();
    if (!key) throw new Error('No API key configured.');

    const body = {
      model: getModel(),
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    };
    if (schema) {
      body.output_config = { format: { type: 'json_schema', schema } };
    }

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errMsg = `API error ${res.status}`;
      try {
        const errData = await res.json();
        errMsg = errData?.error?.message || errMsg;
      } catch { /* ignore */ }
      throw new Error(errMsg);
    }

    const data = await res.json();
    const raw = (data.content || []).find(b => b.type === 'text')?.text ?? '';

    // With a schema the API guarantees valid JSON; without one, strip fences first
    const cleaned = schema
      ? raw.trim()
      : raw.replace(/^\s*```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      console.error('JSON parse failed. Raw response:', raw);
      throw new Error('AI returned invalid JSON. Try regenerating.');
    }
  }

  function _isPlayerMode() {
    const mode = Storage.get(Storage.KEYS.SETUP)?.mode;
    return mode === 'player' || mode === 'fiction';
  }

  function _getLastSeasonHighlights() {
    const log = (Storage.get(Storage.KEYS.HUB) || {}).log || [];
    const divIdxs = log.reduce((acc, e, i) => { if (e.isDivider) acc.push(i); return acc; }, []);
    if (divIdxs.length === 0) return [];
    const last = divIdxs[divIdxs.length - 1];
    const prev = divIdxs.length >= 2 ? divIdxs[divIdxs.length - 2] : -1;
    return log.slice(prev + 1, last).filter(e => !e.isDivider && e.highlight);
  }

  function buildPlayerContext() {
    const setup      = Storage.get(Storage.KEYS.SETUP) || {};
    const narrative  = Storage.get(Storage.KEYS.NARRATIVE);
    const challenges = Storage.get(Storage.KEYS.CHALLENGES);
    const ruleset    = Storage.get(Storage.KEYS.RULESET);
    const player     = setup.player || {};
    const pastSeasons = Storage.get(Storage.KEYS.SEASONS) || [];
    const currentAge = (player.age || 0);

    const parts = [];

    const isFiction = setup.mode === 'fiction';
    const isRewind  = !isFiction && (player.concept_type || '').toLowerCase() === 'rewind';

    parts.push(
      (isFiction ? 'FICTION PLAYER CAREER SAVE\n' : 'PLAYER CAREER SAVE\n') +
      `Player: ${player.name || '—'} | Age: ${currentAge || '—'} | ${player.position || '—'} | ${player.nationality || '—'}\n` +
      (player.ovr || player.potential ? `OVR: ${player.ovr || '—'} | Potential: ${player.potential || '—'} | Weak Foot: ${player.weakFoot || '—'}★ | Skill Moves: ${player.skillMoves || '—'}★\n` : '') +
      `Manager: ${setup.manager || '—'}\n` +
      `Current Club: ${setup.club || '—'} | ${setup.league || '—'} | ${setup.division || '—'}\n` +
      `Season: ${setup.season || 1} | Difficulty: ${setup.difficulty || '—'}\n` +
      `Concept: ${player.concept_type || '—'}${player.concept_hook ? ` — ${player.concept_hook}` : ''}`
    );

    if (isRewind) {
      parts.push(
        `REWIND SAVE — CRITICAL CONTEXT:\n` +
        `This is a Rewind of ${player.name || 'this player'}'s career. You have knowledge of their real-world career — use it.\n` +
        `The real career is NARRATIVE SHADOW, not a roadmap:\n` +
        `- Reference what defined them in real life (trophies, failures, injuries, clubs, key moments) as the weight this save is diverging FROM\n` +
        `- The save is going somewhere DIFFERENT from real history — that is the entire point\n` +
        `- Never suggest or imply the player should follow their real career path\n` +
        `- The concept hook above names the specific divergence angle — build everything around that`
      );
    }

    if (isFiction) {
      const fp = Storage.get(Storage.KEYS.FICTION_PLAYER);
      parts.push(
        `FICTION MODE — PLAYER IS THE STORY:\n` +
        `This player is entirely fictional. The story lives INSIDE the player — their identity, their inner conflict, their growth, their relationships.\n` +
        `The club, league, and finances are BACKDROP ONLY. Do not make the club the subject.\n` +
        `BANNED in fiction mode: board decisions, club budget problems, transfer market pressure, team results as the main driver.\n` +
        `REQUIRED: every narrative beat, every challenge, every event must trace back to something personal to THIS specific character — their concept, their psychology, their arc.\n` +
        `The concept/vibe above IS the story. Build everything around it.`
      );
      if (fp?.stats) {
        const s = fp.stats;
        const identity = fp;
        const psLine = (fp.play_styles || []).join(', ') || '—';
        const pspLine = (fp.play_styles_plus || []).join(', ') || '—';
        parts.push(
          `FICTION PLAYER FIFA CARD:\n` +
          `${identity.height || '—'}cm | ${identity.weight || '—'}kg | ${identity.preferred_foot || '—'} foot | Weak Foot ${identity.weak_foot || '—'}★ | Skill Moves ${identity.skill_moves || '—'}★\n` +
          `Work Rate: ${identity.work_rate_att || '—'} / ${identity.work_rate_def || '—'} | Alt Positions: ${(identity.alt_positions || []).join(', ') || '—'}\n` +
          (fp.is_gk
            ? `GK Stats: Diving ${s.diving||'—'} | Handling ${s.handling||'—'} | Kicking ${s.kicking||'—'} | Positioning ${s.gk_positioning||'—'} | Reflexes ${s.reflexes||'—'}`
            : `Pace: Acc ${s.acceleration||'—'} / Spd ${s.sprint_speed||'—'}\n` +
              `Shooting: Fin ${s.finishing||'—'} | Sht ${s.shot_power||'—'} | Long ${s.long_shots||'—'} | Vol ${s.volleys||'—'} | Pen ${s.penalties||'—'} | Pos ${s.attacking_positioning||'—'}\n` +
              `Passing: Short ${s.short_passing||'—'} | Long ${s.long_passing||'—'} | Vis ${s.vision||'—'} | Cur ${s.curve||'—'} | Crs ${s.crossing||'—'}\n` +
              `Dribbling: BC ${s.ball_control||'—'} | Drib ${s.dribbling||'—'} | Agi ${s.agility||'—'} | Bal ${s.balance||'—'} | Cmp ${s.composure||'—'}\n` +
              `Defending: DA ${s.defensive_awareness||'—'} | Int ${s.interceptions||'—'} | Hd ${s.heading_accuracy||'—'} | Tck ${s.standing_tackle||'—'}\n` +
              `Physical: Sta ${s.stamina||'—'} | Str ${s.strength||'—'} | Jmp ${s.jumping||'—'} | Agg ${s.aggression||'—'}`) + `\n` +
          `PlayStyles: ${psLine} | PS+: ${pspLine}`
        );
      }
    }

    if (pastSeasons.length > 0) {
      const lines = pastSeasons.map(s => {
        const ps = s.playerStats || {};
        const pAge   = (player.age || 0) - (pastSeasons.length - s.season + 1) + 1;
        const pChalls = (s.challenges || []).map(c => {
          const line = c.hub_line || c.title;
          return line ? `[${(c.status || 'Active').toUpperCase()}] ${line}` : null;
        }).filter(Boolean).join(' / ');
        const ovrLine = ps.ovrStart != null && ps.ovrEnd != null ? `OVR ${ps.ovrStart}→${ps.ovrEnd}` : null;
        const potLine = ps.potential != null ? `Potential ${ps.potential}` : null;

        let statsStr;
        if (ps.competitions && ps.competitions.length > 0) {
          statsStr = ps.competitions.map(c => {
            const parts = [
              c.apps       != null ? `${c.apps} apps`        : null,
              c.goals      != null ? `${c.goals}G`           : null,
              c.assists    != null ? `${c.assists}A`         : null,
              c.cleanSheets != null ? `${c.cleanSheets} CS`  : null,
              c.avgRating  != null ? `avg ${c.avgRating}`    : null,
            ].filter(Boolean).join(' ');
            return `${c.name || 'Unknown'}: ${parts || '—'}`;
          }).join(' | ');
        } else {
          // backward compat with old flat structure
          statsStr = [
            ps.apps      != null ? `${ps.apps} apps`      : null,
            ps.goals     != null ? `${ps.goals}G`          : null,
            ps.assists   != null ? `${ps.assists}A`         : null,
            ps.avgRating != null ? `avg ${ps.avgRating}`   : null,
          ].filter(Boolean).join(', ');
        }

        let line = `Season ${s.season} (age ${pAge}, ${ps.club || setup.club || '—'}):`;
        if (ovrLine || potLine) line += ` ${[ovrLine, potLine].filter(Boolean).join(' | ')}`;
        if (statsStr) line += `\n  ${statsStr}`;
        if (s.summary)       line += `\n  ${s.summary}`;
        if (ps.careerMoment) line += `\n  Key moment: ${ps.careerMoment}`;
        if (pChalls)         line += `\n  Challenges: ${pChalls}`;
        return line;
      }).join('\n');
      parts.push(
        `CAREER ARC — ${pastSeasons.length} completed season(s):\n` +
        `(Do NOT revisit resolved arcs. Do NOT reuse past challenge concepts.)\n` +
        `(Challenge statuses are canon: FAILED/BROKEN challenges left real marks on this player's career — reference their consequences. COMPLETED ones are earned reputation.)\n${lines}`
      );
    }

    const lastSeason = pastSeasons[pastSeasons.length - 1];
    if (lastSeason?.narrative) {
      const n = lastSeason.narrative;
      parts.push(
        `PREVIOUS SEASON NARRATIVE (Season ${lastSeason.season} — build on this, evolve it, do NOT repeat):\n` +
        `Player identity: ${n.manager_backstory || '—'}\n` +
        `Club-player relationship: ${n.club_situation || '—'}\n` +
        `Season stakes: ${n.season_framing || '—'}\n` +
        `Seeded events: ${(n.narrative_events || []).join(' / ')}`
      );
    }

    if (narrative) {
      parts.push(
        'CURRENT SEASON NARRATIVE (build on this, do not contradict):\n' +
        `Player identity: ${narrative.manager_backstory || '—'}\n` +
        `Club-player relationship: ${narrative.club_situation || '—'}\n` +
        `Season stakes: ${narrative.season_framing || '—'}\n` +
        `Seeded events: ${(narrative.narrative_events || []).join(' / ')}`
      );
    }

    if (challenges && challenges.length > 0) {
      const tracker = (Storage.get(Storage.KEYS.HUB) || {}).tracker || {};
      const list = challenges.map((c, i) => `- [${(tracker[i] || 'Active').toUpperCase()}] ${c.hub_line || c.title}`).join('\n');
      parts.push('CURRENT SEASON CHALLENGES with live status (do not contradict or repeat; FAILED/BROKEN ones already have consequences in play):\n' + list);
    }

    if (ruleset) {
      const summary  = ruleset.hub_summary;
      const mechanics = ruleset.special_mechanics || {};
      const ruleLines = summary
        ? [...(summary.squad_rules||[]),...(summary.transfer_rules||[]),...(summary.gameplay_rules||[]),summary.chaos_wheel||''].filter(Boolean).map(r=>`- ${r}`).join('\n')
        : [...(ruleset.squad_rules||[]),...(ruleset.transfer_rules||[]),...(ruleset.gameplay_rules||[]),mechanics.chaos_wheel||''].filter(Boolean).map(r=>`- ${r}`).join('\n');
      if (ruleLines) parts.push(`PERMANENT RULESET (do not contradict):\n${ruleLines}`);
    }

    const hub = Storage.get(Storage.KEYS.HUB) || {};
    const careerMoves = (hub.careerMoves || []);
    if (careerMoves.length > 0) {
      const active   = careerMoves.filter(m => m.status === 'active');
      const resolved = careerMoves.filter(m => m.status === 'resolved');

      const lines = [];
      if (active.length > 0) {
        lines.push('ACTIVE CAREER SITUATION (currently unfolding — weave into narrative and challenges):');
        active.forEach(m => {
          lines.push(`[${m.type.replace(/_/g,' ').toUpperCase()}] ${m.title}: ${m.narrative} Stakes: ${m.stakes}`);
        });
      }
      if (resolved.length > 0) {
        lines.push('RESOLVED CAREER MOVES (established facts — do NOT revisit or reuse):');
        resolved.forEach(m => {
          lines.push(`Season ${m.season} — [${m.type.replace(/_/g,' ')}] ${m.title}: ${m.outcome || 'resolved'}`);
        });
      }
      if (lines.length > 0) parts.push(lines.join('\n'));
    }

    const highlights = _getLastSeasonHighlights();
    if (highlights.length > 0) {
      const lines = highlights.map(e => {
        const date = e.gameDate ? `${e.gameDate.day} ${e.gameDate.month}: ` : '';
        return `- ${date}${e.text}`;
      }).join('\n');
      parts.push(`KEY MOMENTS FROM LAST SEASON (use as context — reference these events, do not ignore them):\n${lines}`);
    }

    return parts.join('\n\n');
  }

  // Build context string from all saved modules for chaining
  function buildContext() {
    const setup      = Storage.get(Storage.KEYS.SETUP);
    const narrative  = Storage.get(Storage.KEYS.NARRATIVE);
    const challenges = Storage.get(Storage.KEYS.CHALLENGES);
    const ruleset    = Storage.get(Storage.KEYS.RULESET);

    const parts = [];

    if (setup) {
      parts.push(
        'SAVE SETUP:\n' +
        `Club: ${setup.club || '—'}\n` +
        `League: ${setup.league || '—'}\n` +
        `Division: ${setup.division || '—'}\n` +
        `Season: ${setup.season || 1}\n` +
        `Manager: ${setup.manager || '—'}\n` +
        `Difficulty: ${setup.difficulty || '—'}\n` +
        `Era: ${setup.era || '—'}`
      );
    }

    const pastSeasons = Storage.get(Storage.KEYS.SEASONS) || [];
    if (pastSeasons.length > 0) {
      const lines = pastSeasons.map(s => {
        const pChalls = (s.challenges || [])
          .map(c => {
            const line = c.hub_line || c.title;
            return line ? `[${(c.status || 'Active').toUpperCase()}] ${line}` : null;
          }).filter(Boolean)
          .join(' / ');
        return `Season ${s.season}: ${s.summary || '(no summary)'}` +
          (pChalls ? `\n  Past challenges: ${pChalls}` : '');
      }).join('\n');
      parts.push(
        `SEASON HISTORY — ${pastSeasons.length} completed season(s):\n` +
        `(Do NOT revisit resolved narrative arcs. Do NOT reuse past challenge concepts.)\n` +
        `(Challenge statuses are canon: FAILED/BROKEN challenges are scars — the board, fans and media remember them; reference their consequences. COMPLETED ones are earned history.)\n${lines}`
      );
    }

    // Previous season's narrative — only the most recent archived one
    const lastSeason = pastSeasons[pastSeasons.length - 1];
    if (lastSeason?.narrative) {
      const n = lastSeason.narrative;
      parts.push(
        `PREVIOUS SEASON NARRATIVE (Season ${lastSeason.season} — build on this, evolve it, do NOT repeat the same arcs):\n` +
        `Manager backstory: ${n.manager_backstory || '—'}\n` +
        `Club situation: ${n.club_situation || '—'}\n` +
        `Season framing: ${n.season_framing || '—'}\n` +
        `Seeded events: ${(n.narrative_events || []).join(' / ')}`
      );
    }

    if (narrative) {
      parts.push(
        'CURRENT SEASON NARRATIVE (use as context — do not contradict, may reference or build on it):\n' +
        `Manager backstory: ${narrative.manager_backstory || '—'}\n` +
        `Club situation: ${narrative.club_situation || '—'}\n` +
        `Season framing: ${narrative.season_framing || '—'}\n` +
        `Seeded events: ${(narrative.narrative_events || []).join(' / ')}`
      );
    }

    if (challenges && Array.isArray(challenges) && challenges.length > 0) {
      const tracker = (Storage.get(Storage.KEYS.HUB) || {}).tracker || {};
      const list = challenges.map((c, i) => `- [${(tracker[i] || 'Active').toUpperCase()}] ${c.hub_line || c.title}`).join('\n');
      parts.push('CURRENT SEASON CHALLENGES with live status (do not contradict or repeat; FAILED/BROKEN ones already have consequences in play):\n' + list);
    }

    if (ruleset) {
      const summary = ruleset.hub_summary;
      const mechanics = ruleset.special_mechanics || {};
      if (summary) {
        const ruleLines = [
          ...(summary.squad_rules    || []),
          ...(summary.transfer_rules || []),
          ...(summary.gameplay_rules || []),
          summary.chaos_wheel      || '',
          summary.protected_player || '',
          summary.academy_tracker  || '',
        ].filter(Boolean).map(r => `- ${r}`).join('\n');
        if (ruleLines) parts.push(`PERMANENT RULESET (do not contradict or reuse these mechanics):\n${ruleLines}`);
      } else if (ruleset.squad_rules || ruleset.transfer_rules || ruleset.gameplay_rules) {
        const ruleLines = [
          ...(ruleset.squad_rules    || []),
          ...(ruleset.transfer_rules || []),
          ...(ruleset.gameplay_rules || []),
          mechanics.chaos_wheel      || '',
          mechanics.protected_player || '',
          mechanics.academy_tracker  || '',
        ].filter(Boolean).map(r => `- ${r}`).join('\n');
        if (ruleLines) parts.push(`PERMANENT RULESET (do not contradict or reuse these mechanics):\n${ruleLines}`);
      }
    }

    const highlights = _getLastSeasonHighlights();
    if (highlights.length > 0) {
      const lines = highlights.map(e => {
        const date = e.gameDate ? `${e.gameDate.day} ${e.gameDate.month}: ` : '';
        return `- ${date}${e.text}`;
      }).join('\n');
      parts.push(`KEY MOMENTS FROM LAST SEASON (use as context — reference these events, do not ignore them):\n${lines}`);
    }

    return parts.join('\n\n');
  }

  async function generateNarrative(sectionOnly) {
    const mode   = _isPlayerMode();
    const context = mode ? buildPlayerContext() : buildContext();
    const system  = mode ? SYSTEM_PLAYER_NARRATIVE : SYSTEM_NARRATIVE;
    let msg;

    if (sectionOnly) {
      const sectionNames = mode
        ? { manager_backstory: 'Player Backstory', club_situation: 'Club Context', season_framing: 'Season Arc' }
        : { manager_backstory: 'Manager Backstory', club_situation: 'Club Situation', season_framing: 'Season Framing' };
      const name = sectionNames[sectionOnly] || sectionOnly;
      const current = Storage.get(Storage.KEYS.NARRATIVE) || {};
      msg = context + `\n\nRegenerate ONLY the ${name}. Return the complete JSON with unchanged values for all other fields.\n` +
        `Current values to keep unchanged:\n` +
        Object.entries(current)
          .filter(([k]) => k !== sectionOnly)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' / ') : v}`)
          .join('\n');
    } else {
      msg = `Generate a narrative for this save:\n\n${context}`;
    }

    return call(system, msg, 2048, NARRATIVE_SCHEMA);
  }

  async function generateNarrativeEvent(eventIndex) {
    const context  = buildContext();
    const current  = Storage.get(Storage.KEYS.NARRATIVE) || {};
    const otherIdx = eventIndex === 0 ? 1 : 0;
    const other    = (current.narrative_events || [])[otherIdx];

    const msg = `${context}\n\nRegenerate ONLY narrative_events[${eventIndex}]. Return the complete JSON with unchanged values for all other fields.\n` +
      `Keep unchanged:\nmanager_backstory: ${current.manager_backstory || '—'}\n` +
      `club_situation: ${current.club_situation || '—'}\n` +
      `season_framing: ${current.season_framing || '—'}\n` +
      `narrative_events[${otherIdx}]: ${other || '—'}`;

    return call(SYSTEM_NARRATIVE, msg, 2048, NARRATIVE_SCHEMA);
  }

  async function generateChallenge(type) {
    const context = buildContext();
    const msg = `Generate a ${type} challenge for this save:\n\n${context}`;
    return call(SYSTEM_CHALLENGE, msg, 2048, CHALLENGE_SCHEMA);
  }

  async function generateRuleset() {
    const setup = Storage.get(Storage.KEYS.SETUP) || {};
    const isPlayerMode = setup.mode === 'player' || setup.mode === 'fiction';
    const context = isPlayerMode ? buildPlayerContext() : buildContext();
    const msg = `Suggest a ruleset for this save:\n\n${context}`;
    return call(SYSTEM_RULESET, msg, 4096, RULESET_SCHEMA);
  }

  async function generateSaveConcept(direction) {
    const existing = Storage.get(Storage.KEYS.SETUP);
    const prevBlock = existing?.club
      ? `\n\nPREVIOUS CONCEPT — do NOT repeat the same club, manager, league, or save idea. Pick something meaningfully different:\nManager: ${existing.manager || '—'}\nClub: ${existing.club}\nLeague: ${existing.league || '—'}\nEra: ${existing.era || '—'}\nConcept: ${existing.save_concept || '—'}`
      : '';

    const msg = `User's direction: "${direction || 'surprise me'}"\n\nDesign a complete FC 25 career mode save concept. If the direction is vague or says "surprise me", be bold and unexpected — pick something a serious career mode player would find genuinely compelling, not the obvious first choice.${prevBlock}`;
    return call(SYSTEM_SAVE_CONCEPT, msg, 2048, SAVE_CONCEPT_SCHEMA);
  }

  const SYSTEM_EVENTS = `You generate 10 random season events for a FC 25 career mode save. These are one-time bombshell moments — not ongoing rules, not challenges. The player must act on each one immediately when it is rolled.

TONE: Direct, assertive, slightly chaotic. Board decision, injury shock, surprise windfall — things that actually happen in football.

RULES:
- Generate EXACTLY 10 events: 5 negative + 5 positive
- Every event must be immediately executable within FC 25's actual mechanics — no invented features
- Max 15 words per event. Start with an action verb or clear subject. Zero fluff.
- Negative: forced sales, budget cuts, squad restrictions, emergency decisions
- Positive: budget injections, unlock a free transfer, board reward, youth opportunity
- Example negative: "Sell your highest-wage player before the next transfer window closes"
- Example negative: "Release your oldest outfield player from the squad immediately"
- Example positive: "Board injects 15M into your transfer budget — use it this window"
- Example positive: "Academy graduate must start your next 3 consecutive league matches"
- Do NOT repeat any event from past seasons (list will be provided if applicable)

Return ONLY valid JSON (no markdown fences):
{ "events": [{ "text": "string", "type": "positive" }, { "text": "string", "type": "negative" }, ...] }`;

  const SYSTEM_SEASON_SUMMARY = `You summarize a completed FC 25 career mode season in 2-4 punchy sentences.
Be specific: final league position or cup result, key moments, how active challenges played out, important transfers or injuries.
No fluff. Concrete facts only. Write in past tense.
Return ONLY valid JSON (no markdown fences): { "summary": "string" }`;

  // ── Player Mode System Prompts ───────────────────────────────

  const SYSTEM_PLAYER_CONCEPT = `You are a player career mode save architect for FC 25 with Live Editor (changes OVR, attributes, potential, weak foot/skill move stars, playstyles, forces transfers — NOT minutes or starting lineups).

Design player career mode save concepts for a serious player with hundreds of hours in career mode. The user manages a club but the narrative revolves around ONE player's career arc.

CONCEPT TYPES — pick one or go unexpected:
- REWIND: A real licensed FC 25 player at 17-18 years old, starting from their actual early club. The goal is NOT to recreate their real career — it is to DIVERGE from it. Their real career is the shadow hanging over this save, not the roadmap. See REWIND RULES below.
- UNDERDOG: Low-rated player with untapped potential. Live Editor sets a high potential ceiling — they just need the right environment.
- PRODIGY PRESSURE: Highly-rated wonderkid. The hype is real, the collapse risk is real.
- SHADOW: A player living in the shadow of a more famous teammate (same position, same club). The whole save is about overtaking them.
- REDEMPTION: A player with a setback (injury, exile, bad loan). This is their second chapter.
- POSITION CONVERSION: A player moved to a new role — Live Editor reshapes the attributes.
- WILD CARD: Something completely unexpected. Surprise the user.

REWIND RULES — READ THIS BEFORE GENERATING A REWIND:
A Rewind is NOT "play as Messi and do what Messi did." A Rewind is about picking a real player, starting at their first real club at 17-18, and doing something DIFFERENT from what their real career became.

The real career is the narrative context — the weight of what ACTUALLY happened (the trophies not won, the injury that defined them, the club they left too early, the choice that changed everything) — but in this save, none of that is predetermined. The concept_hook must name the specific divergence: WHAT are we rewriting, and WHY is that interesting?

GOOD Rewind (interesting divergence angle):
→ Robben at 17 in Groningen: the injury curse hasn't started yet. Can you build the career without it?
→ Xabi Alonso at Real Sociedad at 17: what if he never went to Liverpool and built everything in Spain instead?
→ Cavani at Danubio at 18: what if he never took the path to Europe's giants and stayed to build a legacy in South America first?
→ Van Persie at Feyenoord at 18: a generational striker who spent his best years on a broken team — what does the alternative look like?

BAD Rewind (just recreates real career, no divergence):
→ Messi at La Masia at 17 — doing exactly what Messi did (boring, no stakes)
→ Ronaldo at Sporting at 17 — replicating the Man Utd path (the answer is already known)
→ Any player where the "hook" is just "become as good as he became" — that is not a rewind, that is a repeat

The concept_hook for a Rewind must name the divergence point or the tension with the real career. Examples:
→ "Robben starts clean — no injuries, no Bayern, no PSV. What does the real career look like without the curse?"
→ "Van Persie never wastes his 20s at Arsenal — build the legacy he never got."
→ "What if Xabi Alonso never left Spain?"

QUALITY RULES:
- concept_hook = ONE sentence, movie logline. About THIS player at THIS moment. BANNED: "prove the doubters wrong", "fulfil potential", "rise from the ashes", "journey".
- Do not pick obvious or safe. A Mbappé rewind at PSG is boring. Mbappé at Monaco at 16 before everything is interesting.
- manager = realistic coaching name for that club (NOT a player name). Culturally plausible for the club's country.
- This is FC 25 (2024/25 season). Not FC 26. Not any other year. Only clubs and leagues that exist in FC 25.

LICENSED PLAYERS ONLY — CRITICAL:
- The player you pick MUST be a licensed player who appears in FC 25 as a playable card. Do NOT pick retired legends, unlicensed players, or anyone not in the FC 25 database.
- Ronaldinho, Zidane, Ronaldo Nazário, Beckham, Henry, Maldini, Maradona, etc. — NONE of these are in FC 25. Do NOT use them, even for a Rewind concept.
- For a Rewind, pick a CURRENT active player who IS in FC 25, and imagine them at an earlier age/club. Example: Lewandowski at Borussia Dortmund at 22, not at some club from when he was unlicensed. The player must exist in the FC 25 database right now.
- If you are not 100% certain a player is in FC 25, pick someone you ARE certain about.

ALLOWED LEAGUES — EXACT LIST. These are the ONLY leagues that exist in FC 25. Any club not in one of these leagues is a hard failure. No exceptions.

ENGLAND (4 leagues):
  Premier League        → 1st Division
  Championship          → 2nd Division
  League One            → 3rd Division
  League Two            → 4th Division

SPAIN (2 leagues):
  La Liga               → 1st Division
  La Liga 2             → 2nd Division

GERMANY (3 leagues):
  Bundesliga            → 1st Division
  2. Bundesliga         → 2nd Division
  3. Liga               → 3rd Division

FRANCE (2 leagues):
  Ligue 1               → 1st Division
  Ligue 2               → 2nd Division

ITALY (2 leagues):
  Serie A               → 1st Division
  Serie B               → 2nd Division

PORTUGAL (1 league only — FC 25 has NO Portuguese second division):
  Liga Portugal Bwin    → 1st Division

NETHERLANDS:
  Eredivisie            → 1st Division

BELGIUM:
  Pro League            → 1st Division

TURKEY:
  Süper Lig             → 1st Division

SAUDI ARABIA:
  Saudi Pro League      → 1st Division

USA:
  MLS                   → 1st Division

NOT IN FC 25 — HARD FAILURE if used:
- Japan (J1 League / J.League) — NOT in FC 25. Clubs like Gamba Osaka, Urawa Red Diamonds, Vissel Kobe, Kashima Antlers, FC Tokyo — NONE of them are in FC 25. Do not use any Japanese club.
- China (CSL) — NOT in FC 25
- South Korea (K League) — NOT in FC 25
- Brazil (Brasileirão) — NOT in FC 25
- Argentina (Liga Profesional) — NOT in FC 25
- Mexico (Liga MX) — NOT in FC 25
- Any other league not listed above

IMPORTANT: A player's nationality does NOT determine their league. A Japanese player can play in the Premier League, Bundesliga, or any allowed league. Never pick a league based on the player's nationality — only pick from the allowed list above.

DIVISION ACCURACY IS NON-NEGOTIABLE:
- You must know with 100% certainty which league a club is in for FC 25 (2024/25 season) before picking it.
- If you are not certain, pick a DIFFERENT club you ARE certain about. A wrong division is an automatic failure.
- Do not guess. Do not pick a club because it "sounds right" — only pick clubs you are certain about.

Output format (strict JSON):
{
  "player_name": "string",
  "player_age": number,
  "player_position": "string — one of: GK | CB | LB | RB | CDM | CM | CAM | LW | RW | ST | CF",
  "player_nationality": "string",
  "player_ovr": number,
  "player_potential": number,
  "player_weak_foot": number,
  "player_skill_moves": number,
  "concept_type": "Rewind | Underdog | Prodigy | Shadow | Redemption | Position Change | Wild Card",
  "concept_hook": "string — one sentence, specific and punchy",
  "manager": "string",
  "club": "string",
  "league": "string — exact from allowed list",
  "division": "string — e.g. 1st Division",
  "difficulty": "Legendary | Ultimate | Custom"
}

Return ONLY the JSON object. No preamble, no markdown fences.`;

  const SYSTEM_PLAYER_NARRATIVE = `You are a player career narrative engine for FC 25. Generate deeply immersive, specific storylines centered on ONE player — their ambitions, relationships, pressures. The user manages the club but the story follows the player.

THE BAR IS HIGH. No generic phrases. No "a talented young player looking to make his mark." Every element must feel earned and specific to this exact player.

RULES:
- manager_backstory = this player's identity and why THIS moment in their career matters. A specific wound, ambition, or tension. 2-4 sentences.
- club_situation = the club's attitude toward this player. Is he the project, the backup, the wildcard? Financial or sporting context that directly affects him. 2-4 sentences.
- season_framing = what THIS season means for the player's career. Name the stakes. What decision or outcome defines it? 2-4 sentences.
- narrative_events = two ticking time bombs specific to THIS player. Moments that will force a choice before the season ends. Not background flavour. Specific, datable, consequential.
- If this is a REWIND save: the real career is narrative shadow, not a roadmap. Reference what actually happened in real life (what defined him, what he failed to achieve, what hurt him) as the weight this save is DIVERGING from — NOT as a path to follow. The player_backstory should name the real career's defining tension. The season_framing should make clear this save is going somewhere different. Never write as if the player will simply replicate real history.
- Season 1: raw, uncertain, proving ground. Season 3+: a player mid-story with history behind him.
- Never use: "prove the doubters wrong", "fulfil potential", "journey", "turning point", or any phrase that could apply to any player.
- If the context says FICTION MODE: the club is backdrop. manager_backstory and club_situation must still be written from the player's perspective — how THEY experience the club, not what the club is doing. No board politics, no budget talk, no team results as the main driver. Everything must trace back to the player's fictional identity and concept.

OUTPUT FORMAT (strict JSON):
{
  "manager_backstory": "string",
  "club_situation": "string",
  "season_framing": "string",
  "narrative_events": ["string", "string"]
}

Return ONLY the JSON object. No preamble, no markdown fences.`;

  const SYSTEM_PLAYER_CHALLENGE = `You are a challenge engine for FC 25 player career mode. Generate challenges that feel like real career situations with immediate consequences — not objectives. The situation, condition and consequence all live in the same description.

The user has Live Editor:
✅ Can change: OVR, individual attributes, potential, weak foot stars (1-5), skill moves stars (1-5), playstyles, force transfers
❌ Cannot control: minutes played, starting lineups, match frequency

DESCRIPTION LENGTH: MAX 4 LINES per challenge. Tight, direct, specific. No walls of text.

ATTRIBUTE CONSEQUENCES — MANDATORY:
At least 2 of the 3 challenges must have a consequence on SPECIFIC individual attributes (e.g. Finishing -2, Composure +3, Sprint Speed frozen, Weak Foot +1★) — NOT just OVR or potential. Pick attributes that match the player's position and the story of the challenge (a striker's confidence crisis hits Finishing and Composure; a winger forced to defend gains Def. Awareness but loses Flair-adjacent stats). OVR/potential consequences are still allowed, but attribute-level consequences are the core currency.

CORE RULE — how a challenge must read:
One sentence of context. Then condition → consequence. That's it.
Right tone:
→ "The club has no budget left. If he doesn't hit 6 goal contributions before January, he gets listed — if no offer comes, potential drops 3 pts via Live Editor. The ceiling just cracked."
→ "He hasn't scored in 5 games and the manager is already looking at replacements. 3 more blanks → Finishing -3 and Composure -2 (Live Editor). Score twice in that run → Finishing +2 instead."
→ "Sevilla want him at €15M but only if he's in form. 7+ avg in the next 4 games → you MUST accept (Live Editor transfer). Miss it → offer dies, potential drops 2 pts. Either way something is lost."
→ "The coach put him on a weak-foot programme and told the press. 5 goal contributions with clear weak-foot involvement by March → Weak Foot +1★. Fail → Curve and Long Shots -2 each."

BANNED: generic stat targets ("score 15 goals"), soft consequences, long paragraphs, anything that could apply to any player, vague outcomes.

If the context says FICTION MODE: challenges must be rooted in the player's fictional identity and concept — NOT club finances, board decisions, or transfer market pressure. The club is backdrop. Every challenge must feel like it belongs to THIS specific character's story.

Generate EXACTLY 3 challenges — one of each type:

PERFORMANCE ARC (type: "performance_arc"):
- In-game stats as triggers for Live Editor consequences. Context + condition + consequence in one block.
- Good: "3 games below 7.0 against top-half sides → Composure -3 and Reactions -2 (Live Editor). The board's belief in his ceiling just cracked publicly."
- Good: "A rival in the same position is ahead. If the gap hits 5 goal contributions by March → OVR drops 2 pts and the starting spot is formally gone. Overtake him → Attacking Positioning +3."

DEVELOPMENT MILESTONE (type: "development_milestone"):
- Live Editor growth with a locked cost for failure. One sentence of WHY, then the condition and consequence.
- Good: "The national team manager named him but made it clear: 7.5 avg over 8 games or the call-up is cancelled and potential gets locked 4 pts lower via Live Editor."
- Good: "He's promised this weak foot improvement for too long. No 10 goal contributions by end of season → weak foot frozen permanently at current stars (Live Editor lock)."

CAREER DECISION (type: "career_decision"):
- A real fork where both paths cost something. Specific condition, specific moment.
- Good: "A bigger club tabled an offer. Hit 8 contributions in the first half → you MUST accept (Live Editor transfer). Miss it → offer dies and potential drops 2 pts. No safe path."
- Good: "Contract expires in 6 months, the club's offer is an insult. Under 8 contributions → forced free transfer to lower division (Live Editor). Over 14 → release clause triggers automatically."

OUTPUT (strict JSON — exactly 3 challenges):
{
  "challenges": [
    {
      "title": "string — max 6 words, punchy",
      "type": "performance_arc | development_milestone | career_decision",
      "description": "string — MAX 4 LINES. Situation + condition + consequence in one block.",
      "duration": "string",
      "stakes": "string — 1 sentence, the absolute worst case",
      "difficulty": "Mild | Brutal | Savage",
      "hub_line": "string — ONE line, max 12 words. Trigger → consequence. Arrow (→)."
    },
    { ... },
    { ... }
  ]
}

Return ONLY the JSON object. No preamble, no markdown fences.`;

  const SYSTEM_PLAYER_EVENTS = `You generate 10 random season events for a FC 25 player career mode save. These are one-time bombshell moments affecting the PLAYER specifically — not the team in general. The user must act on each one immediately when rolled.

The user has Live Editor: can change OVR, attributes, potential, stars, playstyles, force transfers. Cannot control minutes or lineups.

RULES:
- Generate EXACTLY 10 events: 5 negative + 5 positive
- ALL events about the PLAYER, not the team broadly
- Events can and should involve Live Editor mechanics
- Max 15 words per event. Zero fluff. Start with action verb or clear subject.
- Negative: stat penalty, potential drop, forced transfer, attribute freeze, attribute drop, stars reduction
- Positive: potential raise, playstyle unlock, OVR boost, attribute upgrade, forced transfer to better club, stars upgrade
- Example negative: "Fitness concerns raised — freeze his Pace attribute for 4 matches (Live Editor)"
- Example negative: "Falling out with the manager — reduce potential by 3 pts until next window (Live Editor)"
- Example positive: "Breakthrough performance catches eye — boost his highest attribute by 2 pts (Live Editor)"
- Example positive: "International call-up reward — add any one playstyle (Live Editor)"
- Do NOT repeat any past event (list provided if applicable)

Return ONLY valid JSON (no markdown fences):
{ "events": [{ "text": "string", "type": "positive" }, ...] }`;

  const SYSTEM_PLAYER_SEASON_SUMMARY = `You summarize a completed FC 25 player career mode season in 2-4 punchy sentences. The PLAYER is the subject — their stats, their arc, their key moments, their progression. Include team context briefly but keep the player central.
Be specific: goals/assists (or clean sheets), appearances, OVR progression, Live Editor changes made, how challenges resolved.
No fluff. Concrete facts. Past tense.
Return ONLY valid JSON: { "summary": "string" }`;

  const SYSTEM_PLAYER_CAREER_MOVE = `You generate a single career-defining situation for an FC 25 player career mode save. This is NOT a random event and NOT a season challenge — it is a major arc that shapes where this player's career goes next.

TYPES — pick the most narratively compelling given the current context:
- transfer_saga: A club wants this player. Negotiations, loyalty vs ambition, price tags, ultimatums.
- contract_standoff: Renewal time. The club's offer isn't what the player expected. Power play.
- manager_conflict: The manager stopped trusting him. Falling out of favour, public or silent.
- big_club_interest: A significantly bigger club is circling. Dream move vs comfort zone.
- loan_decision: He needs game time. A loan arrives — but at what cost to his future here?
- media_storm: The player becomes a story for the wrong reasons. Pressure from outside the club.

OUTPUT LENGTH — MAX 4 LINES TOTAL across narrative + stakes + mechanic. This is non-negotiable.
The right tone reads like this:
→ "The club has no budget left. Next window he'll be listed unless he hits 6 goal contributions — if no offer comes, potential drops 3 pts via Live Editor and he's stuck."
→ "Sevilla have tabled €18M and the board want to accept. If he doesn't hit 7+ rating in the next 4 games, you must sell. If he does, the offer dies and he earns his place."
→ "The manager hasn't picked him in 5 games and said nothing publicly. If he doesn't force his way in by January, use Live Editor to drop his OVR 2 pts — the belief is gone."

Short. Specific. Situation + condition + consequence. Nothing else.

QUALITY RULES:
- Reference the player's actual age, OVR, club, past seasons from context — never generic
- Stakes must have no obvious right answer — both paths cost something
- Live Editor consequences (OVR drop, potential cut, forced transfer) make stakes real and immediate
- BANNED: "prove himself", "step up", "turning point", "new chapter", long paragraphs, vague outcomes

Return strict JSON:
{
  "type": "transfer_saga | contract_standoff | manager_conflict | big_club_interest | loan_decision | media_storm",
  "title": "string — 4-6 words, punchy",
  "narrative": "string — 1-2 sentences. The situation. Specific.",
  "stakes": "string — 1-2 sentences. Condition → consequence. Must sting.",
  "mechanic": "string — 1 line on FC 25 execution, or empty string if obvious"
}

Return ONLY the JSON. No preamble, no markdown fences.`;

  const SYSTEM_CHAT = `You are the save assistant inside a FC 25 career mode companion app. The user chats with you to inspect or adjust anything in their current save. You receive the full save state as JSON below.

BEHAVIOUR:
- Reply in the language the user writes in (they often mix Portuguese and English).
- Short, direct answers. Mobile-readable. No fluff.
- You are a co-writer with taste: when rewriting narrative or challenges, match the existing quality bar — specific, punchy, zero clichés ("prove the doubters wrong", "new chapter" etc. are banned).
- Never invent save data — everything you say about the save must come from the JSON.

MAKING CHANGES:
When the user asks you to change something concrete, explain the change in one short line and include EXACTLY ONE fenced json block:

\`\`\`json
{"actions":[{"target":"fiction.stats.finishing","value":84}]}
\`\`\`

The app renders this as a preview card with an Apply button — the user confirms before anything is saved. Do not repeat the JSON content in prose.

TARGETS — dot/bracket paths rooted at one of:
- setup — {manager, club, league, division, season, difficulty, era, save_concept, player:{name, age, position, nationality, ovr, potential, weakFoot, skillMoves, concept_hook}}
- narrative — {manager_backstory, club_situation, season_framing, narrative_events:[2 strings]}
- challenges — array of {title, type, description, duration, stakes, difficulty, hub_line}
- ruleset — {squad_rules:[], transfer_rules:[], gameplay_rules:[], special_mechanics:{chaos_wheel, protected_player, academy_tracker}}
- fiction — the fiction player card (fiction mode only): {overall, potential, height, weight, preferred_foot, weak_foot, skill_moves, work_rate_att, work_rate_def, alt_positions, stats:{...}, play_styles, play_styles_plus, possible_play_styles, possible_play_styles_plus}

Path examples:
- narrative.season_framing
- narrative.narrative_events[1]
- challenges[2].description
- challenges[0]  (replace a whole challenge object)
- ruleset.transfer_rules[0]
- ruleset.special_mechanics.chaos_wheel
- fiction.stats.finishing
- setup.player.potential

RULES:
- Value types must match the existing schema. Stats are numbers 1-99. Setting an array path replaces the whole array.
- When you edit a challenge's title or description, ALSO set its hub_line in the same actions block (max 12 words, trigger → consequence style).
- Every change must stay executable within FC 25 + Live Editor mechanics.
- If the user asks to edit something outside these targets (season log, trophies, players journal), say you can't edit that from chat and point them to the right tab.
- Only include an actions block when the user clearly wants a change. Questions get answers, not actions.`;

  async function chatCall(snapshot, messages, maxTokens = 2048) {
    const key = getKey();
    if (!key) throw new Error('No API key configured.');

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: getModel(),
        max_tokens: maxTokens,
        system: SYSTEM_CHAT + '\n\nCURRENT SAVE STATE:\n' + snapshot,
        messages,
      }),
    });

    if (!res.ok) {
      let errMsg = `API error ${res.status}`;
      try {
        const errData = await res.json();
        errMsg = errData?.error?.message || errMsg;
      } catch { /* ignore */ }
      throw new Error(errMsg);
    }

    const data = await res.json();
    return (data.content || []).find(b => b.type === 'text')?.text ?? '';
  }

  const SYSTEM_CONDENSE = `You condense FC 25 career mode challenges and rules into ultra-short hub lines.

Each item → ONE line, max 12 words, direct, assertive. Only what must/cannot happen — zero context, zero fluff. Arrow (→) for conditional triggers. No "you must", no "make sure" — just state the rule.

Return ONLY valid JSON (no markdown fences):
{
  "challenges": ["hub_line for index 0", "hub_line for index 1"],
  "squad_rules": ["condensed rule", ...],
  "transfer_rules": ["condensed rule", ...],
  "gameplay_rules": ["condensed rule", ...],
  "chaos_wheel": "condensed or empty string",
  "protected_player": "condensed or empty string",
  "academy_tracker": "condensed or empty string"
}`;

  async function condenseHubData() {
    const challenges = Storage.get(Storage.KEYS.CHALLENGES) || [];
    const ruleset    = Storage.get(Storage.KEYS.RULESET)    || {};
    const mechanics  = ruleset.special_mechanics || {};

    const payload = {
      challenges:       challenges.map(ch => ch.description || ch.title || ''),
      squad_rules:      ruleset.squad_rules    || [],
      transfer_rules:   ruleset.transfer_rules || [],
      gameplay_rules:   ruleset.gameplay_rules || [],
      chaos_wheel:      mechanics.chaos_wheel      || '',
      protected_player: mechanics.protected_player || '',
      academy_tracker:  mechanics.academy_tracker  || '',
    };

    const msg = `Condense these FC 25 career mode items into ultra-short hub lines:\n${JSON.stringify(payload, null, 2)}`;
    const result = await call(SYSTEM_CONDENSE, msg, 2048, CONDENSE_SCHEMA);

    // Patch hub_line into each challenge and save
    const updatedChallenges = challenges.map((ch, i) => ({
      ...ch,
      hub_line: result.challenges?.[i] || ch.hub_line || '',
    }));
    Storage.set(Storage.KEYS.CHALLENGES, updatedChallenges);

    // Patch hub_summary into ruleset and save
    const updatedRuleset = {
      ...ruleset,
      hub_summary: {
        squad_rules:      result.squad_rules      || [],
        transfer_rules:   result.transfer_rules   || [],
        gameplay_rules:   result.gameplay_rules   || [],
        chaos_wheel:      result.chaos_wheel      || '',
        protected_player: result.protected_player || '',
        academy_tracker:  result.academy_tracker  || '',
      },
    };
    Storage.set(Storage.KEYS.RULESET, updatedRuleset);

    return { challenges: updatedChallenges, ruleset: updatedRuleset };
  }

  async function generateEvents() {
    const setup       = Storage.get(Storage.KEYS.SETUP) || {};
    const mode        = setup.mode;
    const pastSeasons = Storage.get(Storage.KEYS.SEASONS) || [];

    const usedTexts = pastSeasons.flatMap(s => (s.events || []).map(e => e.text)).filter(Boolean);
    const avoidBlock = usedTexts.length > 0
      ? `\n\nPAST EVENTS — do NOT use any of these (not even similar concepts):\n${usedTexts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
      : '';

    const context = mode === 'player' ? buildPlayerContext() : buildContext();
    const system  = mode === 'player' ? SYSTEM_PLAYER_EVENTS : SYSTEM_EVENTS;
    const msg = `Generate 10 random season events for this save:\n\n${context}${avoidBlock}`;
    const result = await call(system, msg, 1024, EVENTS_SCHEMA);

    const hub = Storage.get(Storage.KEYS.HUB) || {};
    hub.events = {
      season: setup.season || 1,
      pool:   result.events || [],
      rolled: [],
    };
    Storage.set(Storage.KEYS.HUB, hub);

    return hub.events;
  }

  async function generateSeasonSummary() {
    const setup  = Storage.get(Storage.KEYS.SETUP);
    const mode   = setup?.mode;
    const hub    = Storage.get(Storage.KEYS.HUB) || {};
    const entry  = (hub.seasons || []).find(s => s.season === (setup?.season || 1));
    const context = mode === 'player' ? buildPlayerContext() : buildContext();
    const system  = mode === 'player' ? SYSTEM_PLAYER_SEASON_SUMMARY : SYSTEM_SEASON_SUMMARY;

    let resultsBlock = '';
    if (entry) {
      const wonTrophies = Object.entries(entry.trophies || {}).filter(([, v]) => v).map(([k]) => k);
      if (mode === 'player') {
        const ps = entry.playerStats || {};
        resultsBlock =
          `\n\nPLAYER SEASON RESULTS — use as factual basis, do not invent or contradict:\n` +
          `Appearances: ${ps.apps ?? '—'}\n` +
          `Goals: ${ps.goals ?? '—'} | Assists: ${ps.assists ?? '—'}\n` +
          `Avg Match Rating: ${ps.avgRating ?? '—'}\n` +
          `OVR: ${ps.ovrStart ?? '—'} → ${ps.ovrEnd ?? '—'}\n` +
          `Potential: ${ps.potential ?? '—'}\n` +
          `Trophies: ${wonTrophies.length > 0 ? wonTrophies.join(', ') : 'None'}\n` +
          (ps.careerMoment ? `Key moment: ${ps.careerMoment}\n` : '') +
          (entry.notes ? `Notes: ${entry.notes}` : '');
      } else {
        resultsBlock =
          `\n\nSEASON RESULTS — use as factual basis, do not invent or contradict:\n` +
          `Final League Position: ${entry.position ?? '—'}\n` +
          `Trophies Won: ${wonTrophies.length > 0 ? wonTrophies.join(', ') : 'None'}\n` +
          (entry.notes ? `Key moments / notes: ${entry.notes}` : '');
      }
    }

    const msg = `Summarize this completed season:\n\n${context}${resultsBlock}`;
    return call(system, msg, 512, SUMMARY_SCHEMA);
  }

  function advanceSeason(summary) {
    const setup       = Storage.get(Storage.KEYS.SETUP) || {};
    const pastSeasons = Storage.get(Storage.KEYS.SEASONS) || [];
    const hub         = Storage.get(Storage.KEYS.HUB) || {};
    const currentNum  = setup.season || 1;

    // Capture player stats from hub trophy entry if player/fiction mode
    let playerStats = undefined;
    if (setup.mode === 'player' || setup.mode === 'fiction') {
      const hubEntry = (hub.seasons || []).find(s => s.season === currentNum);
      if (hubEntry) {
        playerStats = { club: setup.club || '', position: setup.player?.position || '', ...hubEntry.playerStats };
      }
    }

    pastSeasons.push({
      season:      currentNum,
      summary:     summary || '',
      narrative:   Storage.get(Storage.KEYS.NARRATIVE),
      // Archive challenges WITH their final tracker status — failed ones become scars
      challenges:  (Storage.get(Storage.KEYS.CHALLENGES) || []).map((c, i) => ({
        ...c,
        status: (hub.tracker || {})[i] || 'Active',
      })),
      events:      (hub.events?.rolled || []).map(i => hub.events?.pool?.[i]).filter(Boolean),
      ...(playerStats ? { playerStats } : {}),
    });
    Storage.set(Storage.KEYS.SEASONS, pastSeasons);

    setup.season = Math.min(currentNum + 1, 15);
    // Player ages one year per season
    if ((setup.mode === 'player' || setup.mode === 'fiction') && setup.player) {
      setup.player.age = (setup.player.age || 0) + 1;
    }
    Storage.set(Storage.KEYS.SETUP, setup);

    // Clear per-season data — ruleset stays (it's permanent)
    Storage.set(Storage.KEYS.NARRATIVE,  null);
    Storage.set(Storage.KEYS.CHALLENGES, []);

    // Add season divider to log, reset tracker, clear events
    if (!hub.log) hub.log = [];
    hub.log.push({
      id:        Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text:      `── Season ${currentNum} Complete ──`,
      timestamp: new Date().toISOString(),
      isDivider: true,
    });
    hub.tracker = {};
    hub.events  = null;
    Storage.set(Storage.KEYS.HUB, hub);

    return setup.season;
  }

  async function generateSingleMechanic(key) {
    const context = _isPlayerMode() ? buildPlayerContext() : buildContext();
    const ruleset  = Storage.get(Storage.KEYS.RULESET) || {};
    const mechanic = ruleset.special_mechanics || {};
    const names = {
      chaos_wheel:      'chaos_wheel — a wild spin mechanic with random consequences (must always be enabled, consequences should be punishing or weird)',
      protected_player: 'protected_player — a single player given immunity/must-play rules',
      academy_tracker:  'academy_tracker — rules for tracking youth player progression and appearances',
    };
    const desc = names[key] || key;
    const current = mechanic[key] || '(not set)';
    const msg = `${context}\n\nCurrent value for ${key}:\n${current}\n\nGenerate a NEW, more interesting version of this mechanic: ${desc}.\nMust be executable within FC 25. Return ONLY:\n{\n  "value": "string"\n}`;
    return call(SYSTEM_RULESET, msg, 2048, VALUE_SCHEMA);
  }

  async function generateSingleRule(sectionKey) {
    const setup = Storage.get(Storage.KEYS.SETUP) || {};
    const context = (setup.mode === 'player' || setup.mode === 'fiction') ? buildPlayerContext() : buildContext();
    const ruleset = Storage.get(Storage.KEYS.RULESET) || {};
    const existing = (ruleset[sectionKey] || []).map((r, i) => `${i + 1}. ${r}`).join('\n') || '(none yet)';
    const sectionNames = {
      squad_rules:    'squad (player limits, selection rules, squad composition)',
      transfer_rules: 'transfer (buying, selling, loan restrictions)',
      gameplay_rules: 'gameplay (in-game decisions, match rules, tactical restrictions)',
    };
    const name = sectionNames[sectionKey] || sectionKey;
    const msg = `${context}\n\nExisting ${name} rules:\n${existing}\n\nGenerate ONE new rule for the ${name} section. Must fit the existing ruleset as a coherent addition, not duplicate existing rules, and be executable within FC 25 mechanics.\n\nReturn ONLY this JSON:\n{\n  "rule": "string"\n}`;
    return call(SYSTEM_RULESET, msg, 2048, RULE_SCHEMA);
  }

  async function generateNarrativeAfterTransfer() {
    // Builds context WITHOUT current narrative so the old club_situation
    // doesn't anchor the AI to the previous club
    const setup      = Storage.get(Storage.KEYS.SETUP) || {};
    const challenges = Storage.get(Storage.KEYS.CHALLENGES);
    const ruleset    = Storage.get(Storage.KEYS.RULESET);
    const player     = setup.player || {};
    const pastSeasons = Storage.get(Storage.KEYS.SEASONS) || [];
    const hub        = Storage.get(Storage.KEYS.HUB) || {};

    const parts = [];

    parts.push(
      'PLAYER CAREER SAVE — MID-SEASON CLUB CHANGE\n' +
      `Player: ${player.name || '—'} | Age: ${player.age || '—'} | ${player.position || '—'} | ${player.nationality || '—'}\n` +
      `Manager: ${setup.manager || '—'}\n` +
      `NEW Club: ${setup.club || '—'} | ${setup.league || '—'} | ${setup.division || '—'}\n` +
      `Season: ${setup.season || 1} | Difficulty: ${setup.difficulty || '—'}`
    );

    if (pastSeasons.length > 0) {
      const lines = pastSeasons.map(s => {
        const ps = s.playerStats || {};
        const pAge = (player.age || 0) - (pastSeasons.length - s.season + 1) + 1;
        return `Season ${s.season} (age ${pAge}, ${ps.club || '—'}): ${s.summary || '(no summary)'}`;
      }).join('\n');
      parts.push(`CAREER ARC:\n${lines}`);
    }

    // Include resolved career moves — especially the transfer that caused this
    const careerMoves = (hub.careerMoves || []).filter(m => m.status === 'resolved');
    if (careerMoves.length > 0) {
      const lines = careerMoves.map(m => `[${m.type}] ${m.title}: ${m.outcome || '—'}`).join('\n');
      parts.push(`RESOLVED CAREER MOVES (the transfer that brought him here is in this list):\n${lines}`);
    }

    const active = (hub.careerMoves || []).filter(m => m.status === 'active');
    if (active.length > 0) {
      const lines = active.map(m => `[${m.type}] ${m.title}: ${m.narrative} ${m.stakes}`).join('\n');
      parts.push(`ACTIVE CAREER SITUATION:\n${lines}`);
    }

    if (challenges && challenges.length > 0) {
      parts.push('ACTIVE CHALLENGES:\n' + challenges.map(c => `- ${c.hub_line || c.title}`).join('\n'));
    }

    const context = parts.join('\n\n');
    const msg = `The player has JUST transferred to a new club mid-season. Generate a fresh narrative for this new situation:\n\n${context}\n\nGenerate ONLY club_situation and season_framing relevant to the NEW club. manager_backstory can stay general about the player's identity. narrative_events should reflect the new club context.`;

    return call(SYSTEM_PLAYER_NARRATIVE, msg, 2048, NARRATIVE_SCHEMA);
  }

  async function generateCareerMove() {
    const context = buildPlayerContext();
    const msg = `Generate a career-defining situation for this player right now:\n\n${context}`;
    return call(SYSTEM_PLAYER_CAREER_MOVE, msg, 1024, CAREER_MOVE_SCHEMA);
  }

  async function generatePlayerConcept(direction) {
    const existing = Storage.get(Storage.KEYS.SETUP);
    const prevBlock = existing?.player?.name
      ? `\n\nPREVIOUS CONCEPT — pick something meaningfully different:\nPlayer: ${existing.player.name}, age ${existing.player.age}, ${existing.player.position}\nClub: ${existing.club}\nConcept: ${existing.save_concept || '—'}`
      : '';
    const msg = `User direction: "${direction || 'surprise me'}"\n\nDesign a complete FC 25 player career mode save concept.${prevBlock}`;
    return call(SYSTEM_PLAYER_CONCEPT, msg, 1024, PLAYER_CONCEPT_SCHEMA);
  }

  async function generatePlayerChallenges() {
    const context = buildPlayerContext();
    const msg = `Generate 3 player challenges for this save:\n\n${context}`;
    const result = await call(SYSTEM_PLAYER_CHALLENGE, msg, 2048, PLAYER_CHALLENGES_SCHEMA);
    if (Array.isArray(result?.challenges)) return result.challenges;
    return Array.isArray(result) ? result : [];
  }

  async function generateSinglePlayerChallenge(type) {
    const context = buildPlayerContext();
    const challenges = Storage.get(Storage.KEYS.CHALLENGES) || [];
    const existing = challenges.map(c => `- ${c.hub_line || c.title}`).join('\n');
    const msg = `Generate ONE player challenge of type "${type}" for this save:\n\n${context}` +
      (existing ? `\n\nEXISTING ACTIVE CHALLENGES — do not repeat these:\n${existing}` : '') +
      `\n\nReturn a single JSON object (NOT an array):\n{ "title":..., "type":..., "description":..., "duration":..., "stakes":..., "difficulty":..., "hub_line":... }`;
    return call(SYSTEM_PLAYER_CHALLENGE, msg, 1024, CHALLENGE_SCHEMA);
  }

  // ── Fiction Mode ─────────────────────────────────────────────

  const SYSTEM_FICTION_CONCEPT = `You are a fiction player architect for FC 25 career mode. Your job is to design a compelling fictional player concept — a character that feels like they belong in a story, not a Wikipedia page.

RULES:
- The player must be ENTIRELY FICTIONAL. No real player should share their name, background, or career arc.
- Draw from the user's concept/vibe: the archetype, the emotional tone, the context. This is the soul of the character.
- The concept_hook is the character's core identity in one sentence — their defining tension, drive, or contradiction.
- Club and league must be from the FC 25 allowed list below. No exceptions.
- Age 16-22 for a starting save (unless the concept suggests otherwise).

ALLOWED LEAGUES — FC 25 only. Pick ONLY from this list:
  Premier League | Championship | League One | League Two (England)
  La Liga | La Liga 2 (Spain)
  Bundesliga | 2. Bundesliga | 3. Liga (Germany)
  Ligue 1 | Ligue 2 (France)
  Serie A | Serie B (Italy)
  Liga Portugal Bwin (Portugal)
  Eredivisie (Netherlands)
  Jupiler Pro League (Belgium)
  Süper Lig (Turkey)
  Saudi Pro League (Saudi Arabia)
  MLS (USA)

Do NOT use any league outside this list. Any other league is a hard failure.

BANNED LEAGUES — using these is an automatic failure regardless of the character concept:
- Japan: J1 League / J.League (Gamba Osaka, Urawa Red Diamonds, Vissel Kobe, Kashima Antlers, FC Tokyo — ALL banned)
- China: CSL — Brazil: Brasileirão — Argentina: Liga Profesional — Mexico: Liga MX — South Korea: K League
- ANY league not in the allowed list above

CRITICAL: A character's nationality, aesthetic, or inspiration (e.g. anime, Japanese culture) does NOT mean they play in a Japanese league. A Japanese-inspired character plays in the Premier League, Bundesliga, Eredivisie, or another allowed league. Never match league to nationality.

OUTPUT FORMAT (strict JSON):
{
  "player_name": "string",
  "player_age": number,
  "player_position": "string (main position — ST, CAM, CB, GK, etc.)",
  "player_nationality": "string",
  "manager": "string",
  "club": "string — a plausible fictional or real club name from that league",
  "league": "string — exact name from the allowed list",
  "division": "string — e.g. 1st Division, 2nd Division",
  "difficulty": "Legendary | Ultimate | Custom",
  "concept_hook": "string (1 sentence — the character's core identity and tension)"
}

Return ONLY the JSON. No preamble, no markdown fences.`;

  const SYSTEM_FICTION_PLAYER = `You are a FIFA card generator for fictional FC 25 players. Given a character concept, you generate their complete FIFA card — identity, attributes, and PlayStyles.

RULES — NON-NEGOTIABLE:
1. PURELY FICTIONAL. The player does not exist. No real player should inspire the numbers directly.
2. STATS TELL THE STORY. A technically obsessed player has 90+ ball control and dribbling but maybe 60 stamina. A raw physical beast has pace and strength but low composure. An anime-style prodigy might have elite reactions and agility but weak defending. Stats are character writing.
3. REALISTIC DISTRIBUTION. No player has 99 in everything. Every concept has strengths AND weaknesses that define them. Total stat floor/ceiling should reflect the age and concept (a 17-year-old raw talent isn't 90+ across the board).
4. PLAYSTYLES from FC25 only. Field players: Finesse Shot, Power Header, Dead Ball, Power Shot, Chip Shot, Long Ball Pass, Whipped Pass, Incisive Pass, Trickster, Rapid, Flair, First Touch, Technical, Block, Intercept, Jockey, Slide Tackle, Bruiser, Long Throw, Aerial, Acrobatic, Bicycle Kick. GK: Far Reach, Cross Claimer, Footwork, Rush Out, Far Throw.
5. AGE-BASED PLAYSTYLE LIMITS — HARD CAPS, no exceptions:
   - Age 16-18: play_styles max 2, play_styles_plus MUST be [] (empty)
   - Age 19-27: play_styles max 3, play_styles_plus max 2
   - Age 28+:   play_styles max 4, play_styles_plus max 2
   Only assign PS+ for the single most defining trait of the concept.
6. POSSIBLE PLAYSTYLES: Separately list the playstyles this player could realistically DEVELOP over their career — styles they don't have yet but fit their concept ceiling. These go in possible_play_styles and possible_play_styles_plus. Max 4 possible regular, max 2 possible PS+. Do not repeat styles already in play_styles / play_styles_plus.
7. GK flag: set is_gk=true only if position is GK. GK stat fields: diving, handling, kicking, gk_positioning, reflexes (plus acceleration and sprint_speed). Field players get the full field stat set.
8. OVR MUST BE CALCULATED FROM YOUR STATS — NOT GUESSED. FC 25 uses this exact formula:

   Face stats (round each):
   PAC = acceleration×0.55 + sprint_speed×0.45
   SHO = attacking_positioning×0.32 + finishing×0.30 + shot_power×0.20 + long_shots×0.10 + volleys×0.05 + penalties×0.03
   PAS = short_passing×0.30 + long_passing×0.20 + crossing×0.20 + vision×0.18 + curve×0.07 + free_kick_accuracy×0.05
   DRI = ball_control×0.30 + reactions×0.25 + dribbling×0.20 + agility×0.15 + balance×0.10
   DEF = standing_tackle×0.30 + defensive_awareness×0.25 + interceptions×0.20 + sliding_tackle×0.15 + heading_accuracy×0.10
   PHY = strength×0.35 + stamina×0.25 + jumping×0.20 + aggression×0.20

   Position OVR weights [PAC, SHO, PAS, DRI, DEF, PHY] (must sum to 100):
   ST/CF: 5, 35, 5, 25, 5, 25
   LW/RW: 15, 20, 15, 35, 5, 10
   CAM:   5, 20, 30, 35, 5, 5
   CM:    5, 15, 35, 25, 10, 10
   CDM:   5, 5, 25, 15, 30, 20
   LB/RB: 10, 5, 20, 20, 30, 15
   CB:    5, 5, 10, 10, 40, 30
   GK OVR = round(diving×0.23 + handling×0.23 + reflexes×0.23 + gk_positioning×0.15 + kicking×0.10 + (acceleration×0.55+sprint_speed×0.45)×0.06)

   WORKFLOW: choose stats first → compute face stats → apply position weights → that result IS the overall. Do NOT set an overall target first and then pick stats to match it — work the formula forward, never backward.

OUTPUT FORMAT (strict JSON):
{
  "name": "string",
  "nationality": "string",
  "age": number,
  "position": "string",
  "overall": number (0-99, CALCULATED from the formula above — not guessed),
  "potential": number (0-99, career ceiling; must be >= overall; reflects concept ambition vs age),
  "height": number,
  "weight": number,
  "preferred_foot": "Right | Left",
  "weak_foot": number (1-5),
  "skill_moves": number (1-5),
  "work_rate_att": "High | Medium | Low",
  "work_rate_def": "High | Medium | Low",
  "alt_positions": ["string"],
  "is_gk": false,
  "stats": {
    "acceleration": number, "sprint_speed": number,
    "agility": number, "balance": number, "reactions": number,
    "ball_control": number, "dribbling": number, "composure": number,
    "finishing": number, "heading_accuracy": number,
    "short_passing": number, "long_passing": number,
    "curve": number, "free_kick_accuracy": number, "crossing": number,
    "shot_power": number, "long_shots": number, "volleys": number, "penalties": number,
    "attacking_positioning": number, "vision": number,
    "jumping": number, "stamina": number, "strength": number,
    "aggression": number, "interceptions": number,
    "defensive_awareness": number, "standing_tackle": number, "sliding_tackle": number
  },
  "play_styles": ["string"],
  "play_styles_plus": ["string"],
  "possible_play_styles": ["string"],
  "possible_play_styles_plus": ["string"]
}

Return ONLY the JSON. No preamble, no markdown fences.`;

  async function generateFictionConcept(direction) {
    const existing = Storage.get(Storage.KEYS.SETUP);
    const prevBlock = existing?.player?.name
      ? `\n\nPREVIOUS CONCEPT — create something meaningfully different. Do NOT reuse the same club, league, nationality, or concept:\nPlayer: ${existing.player.name}, ${existing.player.position}, ${existing.player.nationality || '—'}\nClub: ${existing.club} | League: ${existing.league || '—'}\nConcept: ${existing.save_concept || '—'}`
      : '';
    const msg = `User concept/vibe: "${direction || 'surprise me'}"\n\nDesign a fictional FC 25 player concept.${prevBlock}`;
    return call(SYSTEM_FICTION_CONCEPT, msg, 1024, FICTION_CONCEPT_SCHEMA);
  }

  async function updateFictionPlayer() {
    const setup       = Storage.get(Storage.KEYS.SETUP) || {};
    const player      = setup.player || {};
    const fp          = Storage.get(Storage.KEYS.FICTION_PLAYER) || {};
    const pastSeasons = Storage.get(Storage.KEYS.SEASONS) || [];

    const currentStats = fp.stats ? Object.entries(fp.stats)
      .map(([k, v]) => `${k}: ${v}`).join(', ') : 'none';

    const seasonHistory = pastSeasons.length > 0
      ? pastSeasons.map(s => {
          const ps = s.playerStats || {};
          const ovrLine = ps.ovrStart != null && ps.ovrEnd != null ? `OVR ${ps.ovrStart}→${ps.ovrEnd}` : null;
          const potLine = ps.potential != null ? `Potential ${ps.potential}` : null;
          let statsStr;
          if (ps.competitions && ps.competitions.length > 0) {
            statsStr = ps.competitions.map(c => {
              const parts = [
                c.apps        != null ? `${c.apps} apps`      : null,
                c.goals       != null ? `${c.goals}G`         : null,
                c.assists     != null ? `${c.assists}A`       : null,
                c.cleanSheets != null ? `${c.cleanSheets} CS` : null,
                c.avgRating   != null ? `avg ${c.avgRating}`  : null,
              ].filter(Boolean).join(' ');
              return `${c.name || 'Unknown'}: ${parts || '—'}`;
            }).join(' | ');
          } else {
            statsStr = [
              ps.apps      != null ? `${ps.apps} apps`      : null,
              ps.goals     != null ? `${ps.goals}G`          : null,
              ps.assists   != null ? `${ps.assists}A`         : null,
              ps.avgRating != null ? `avg ${ps.avgRating}`   : null,
            ].filter(Boolean).join(', ');
          }
          const summary = [[ovrLine, potLine].filter(Boolean).join(' | '), statsStr].filter(Boolean).join(' — ');
          return `Season ${s.season}: ${summary || '(no stats)'}`;
        }).join('\n')
      : 'No past seasons yet';

    const msg =
      `Update the FIFA stats for this fictional player based on their career progression:\n\n` +
      `Player: ${player.name || '—'} | Age: ${player.age || '—'} | ${player.position || '—'}\n` +
      `Current Season: ${setup.season || 1}\n` +
      `Concept: ${player.concept_hook || setup.save_concept || '—'}\n\n` +
      `CURRENT STATS:\n${currentStats}\n\n` +
      `CAREER HISTORY:\n${seasonHistory}\n\n` +
      `Update the stats to reflect where this player is NOW in their career. ` +
      `Evolve naturally from the current stats — improvements in areas consistent with their concept, ` +
      `realistic progression for their age and career arc. ` +
      `Do NOT completely change the stat profile — this is an evolution, not a new player.\n\n` +
      `Return ONLY the updated fields in this JSON format: ` +
      `"overall" (updated OVR), "stats", "play_styles", "play_styles_plus", "possible_play_styles", "possible_play_styles_plus". ` +
      `Do NOT return identity fields (name, height, etc.) or "potential" — potential is managed separately. ` +
      `Apply the same age-based playstyle limits as defined in the system prompt.`;

    return call(SYSTEM_FICTION_PLAYER, msg, 1024);
  }

  async function generateFictionPlayer() {
    const setup  = Storage.get(Storage.KEYS.SETUP) || {};
    const player = setup.player || {};
    const msg =
      `Create the full FIFA card for this fictional player:\n\n` +
      `Name: ${player.name || '—'}\n` +
      `Age: ${player.age || 17}\n` +
      `Position: ${player.position || '—'}\n` +
      `Nationality: ${player.nationality || '—'}\n` +
      `Club: ${setup.club || '—'} | ${setup.league || '—'}\n` +
      `Character concept: ${player.concept_hook || setup.save_concept || 'surprise me'}\n\n` +
      `Generate a complete FC25 card that embodies this concept. Stats must reflect who this character IS.`;
    return call(SYSTEM_FICTION_PLAYER, msg, 1024);
  }

  return {
    getKey,
    getModel,
    setModel,
    call,
    chatCall,
    buildContext,
    buildPlayerContext,
    generateNarrative,
    generateNarrativeEvent,
    generateChallenge,
    generateRuleset,
    generateSaveConcept,
    generatePlayerConcept,
    generateNarrativeAfterTransfer,
    generateCareerMove,
    generatePlayerChallenges,
    generateSinglePlayerChallenge,
    generateSingleMechanic,
    generateSingleRule,
    condenseHubData,
    generateEvents,
    generateSeasonSummary,
    advanceSeason,
    generateFictionConcept,
    generateFictionPlayer,
    updateFictionPlayer,
  };
})();
