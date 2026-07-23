# OffPitch

A companion app for **EA FC 25 career mode** that turns your save into a living story. Instead of menus, you walk a **free-roam 2D city**: every building is a part of your career — your house, the locker room, the stadium, the press, your agent. AI (Claude) writes the narrative around the *real* things you do in the game; the app never touches FC 25 itself.

## Features

- **Free-roam city** — canvas 2D world with WASD/arrows on desktop and a floating virtual joystick on mobile. Day/night cycle on its own clock, with street lamps and stadium floodlights glowing at night.
- **Club identity** — the stadium, club office and your character's kit are tinted with your club's real colors (AI-fetched once, manually adjustable in Settings).
- **Three save modes** — Team (manager), Player (real player, incl. rewind saves with a generated era-accurate stats card) and Fiction (a fully invented player with his own FIFA-style card).
- **The city:**
  - **Estádio** — the match loop: minimal pre-match form, AI hype, code-rolled surprise match challenges, post-match reports with fan reactions, press conferences after big games, and a rivalry system derived from your defeats.
  - **Casa** — your family (AI-generated around your story) with a relationship system: hang out, neglect has consequences, long neglect leaves scars.
  - **Balneário** — coach and teammates from your squad as characters, player journals, duo challenges with your linked player.
  - **Club Office** — squad admin, season log, trophies, season challenges with auto-tracked progress bars.
  - **Boardroom** — rulesets, challenge tracker, end-of-season flow, archive.
  - **Agência** — your agent brings contract/transfer opportunities with real choices and consequences, checked against your own transfer rules.
  - **Sponsors** — brand deals with real-football money scaled to your division and squad level; pick at most 2 active deals.
  - **Imprensa** — a social-style news feed with posts and fan comments; confirmed transfers come from the right account, rumors get tempered in the comments.
  - **Quadro de avisos** — 10 season events as scratch cards on the plaza: pick one a month, scratch it blind.
- **Relationships everywhere** — every NPC (family, teammates, coach, agent, press, fans) has a 0–100 relation that moves with what you do, and colors every AI generation.
- **Nothing is automatic in your game** — the app suggests (e.g. Live Editor tweaks, sponsor payouts); you apply them in FC 25 yourself. The truth layer (results, stats) always comes from what you type, never from the AI.

## Getting started

1. Clone/download and open **`index.html`** in a modern browser — no server, no build, no dependencies.
2. Open **Settings** (gear icon, top right) and paste your **Anthropic API key** (`sk-ant-...`).
3. The Setup opens automatically on a fresh browser — pick a mode, club and season, and walk into your city.

Data lives entirely in your browser's `localStorage` (export/import available in Settings). API calls go directly from your browser to the Anthropic API — your key never touches any other server.

> Tip: after pulling an update, hard-refresh (`Ctrl+F5`) — browsers cache local JS aggressively.

## Project structure

```
index.html        the app (the world)
world.html        same world (legacy dev entry)
classic.html      the original menu-based UI (kept as a fallback)
style.css         app-wide styles · css/world.css — world styles
js/               modules: setup, narrative, challenges, ruleset, hub, fiction, chat, api, storage
js/world/         the city: engine, map, ground, input, tint, NPCs, stadium, board, office, casa, balneário, sponsors, imprensa, agência
data/leagues.js   playable clubs/leagues dataset (anti-hallucination layer for AI calls)
assets/sprites/dist/   processed sprites used by the engine (committed; AI-generated source art stays local)
```

## Tech

Vanilla JavaScript (IIFE modules, no frameworks, no build step), HTML5 canvas, `localStorage`, and the Claude API with structured outputs for every generation. Sprite art is AI-generated and processed by a local pure-Python pipeline into `assets/sprites/dist/`; the engine falls back to labeled placeholders for any missing asset, so nothing ever blocks on art.

## Notes

- Requires an Anthropic API key; generation costs depend on the model picked in Settings.
- This is a personal fan project for a single player's career saves. Not affiliated with EA, the clubs or leagues referenced, or any real person mentioned in generated content.
