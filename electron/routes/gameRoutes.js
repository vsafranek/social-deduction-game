// electron/routes/gameRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Game = require('../models/Game');
const Player = require('../models/Player');
const GameLog = require('../models/GameLog');
const { ROLES, MODIFIERS } = require('../models/Role');

// -----------------------------
// Helpers: validation & utils
// -----------------------------
function ensureObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function nowMs() {
  return Date.now();
}

function endInMs(sec) {
  return new Date(nowMs() + sec * 1000);
}

function clampNum(v, min, max, fallback) {
  const n = Number(v);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeChance(val, def) {
  if (val === undefined || val === null) return def;
  const n = Number(val);
  if (Number.isNaN(n)) return def;
  return n > 1 ? Math.min(100, Math.max(0, n)) / 100 : Math.min(1, Math.max(0, n));
}

function hasEffect(p, effectType) {
  const now = new Date();
  return (p.effects || []).some(e => e.type === effectType && (!e.expiresAt || e.expiresAt > now));
}

function addEffect(target, type, sourceId = null, expiresAt = null, meta = {}) {
  target.effects = target.effects || [];
  target.effects.push({
    type,
    source: sourceId,
    addedAt: new Date(),
    expiresAt,
    meta
  });
}

function removeEffects(target, predicate) {
  target.effects = (target.effects || []).filter(e => !predicate(e));
}

function clearExpiredEffects(players) {
  const now = new Date();
  for (const p of players) {
    p.effects = (p.effects || []).filter(e => !e.expiresAt || e.expiresAt > now);
  }
}

// -----------------------------
// Victory evaluation (declarative)
// -----------------------------
function liveTeamCounts(players) {
  const counts = new Map(); // team -> count
  for (const p of players) {
    if (!p.alive) continue;
    for (const t of (p.affiliations || [])) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return counts;
}

function groupByAffiliation(players) {
  const map = new Map(); // team -> [players]
  for (const p of players) {
    if (!p.alive) continue;
    for (const t of (p.affiliations || [])) {
      if (!map.has(t)) map.set(t, []);
      map.get(t).push(p);
    }
  }
  return map;
}

function evaluateCustomRule(rule, ctx) {
  switch (rule.type) {
    case 'eliminate': {
      const n = ctx.counts.get(rule.targetTeam) || 0;
      return n === 0;
    }
    case 'parity': {
      const a = ctx.counts.get(rule.team) || 0;
      const b = ctx.counts.get(rule.against || 'good') || 0;
      const cmp = rule.comparator || '>=';
      if (cmp === '>=') return a >= b;
      if (cmp === '>') return a > b;
      if (cmp === '===') return a === b;
      return false;
    }
    case 'aliveExactly': {
      const n = ctx.counts.get(rule.team) || 0;
      return n === rule.count;
    }
    case 'aliveAtMost': {
      const n = ctx.counts.get(rule.team) || 0;
      return n <= rule.count;
    }
    case 'aliveAtLeast': {
      const n = ctx.counts.get(rule.team) || 0;
      return n >= rule.count;
    }
    case 'allOthersHaveEffect': {
      const { effect, negate } = rule;
      const alive = ctx.players.filter(pl => pl.alive);
      const selfId = ctx.self?._id?.toString();
      for (const pl of alive) {
        if (selfId && pl._id.toString() === selfId) continue;
        const has = hasEffect(pl, effect);
        if (negate ? has : !has) return false;
      }
      return true;
    }
    default:
      return false;
  }
}

function evaluateVictory(players) {
  const alive = players.filter(p => p.alive);
  const counts = liveTeamCounts(players);
  const byTeam = groupByAffiliation(players);

  // 1) Solo wins
  for (const p of alive) {
    if (p.victoryConditions?.soloWin) {
      const others = alive.filter(x => x._id.toString() !== p._id.toString());
      if (others.length === 0) {
        return { winner: 'solo', players: [p._id], teams: ['solo'] };
      }
    }
  }

  // 2) Coalition defaults (good/evil)
  const evilAlive = (byTeam.get('evil') || []).length;
  const goodAlive = (byTeam.get('good') || []).length;
  const neutralAlive = (byTeam.get('neutral') || []).length;

  // Good win: no evil alive and at least someone else alive (good or neutral)
  if (evilAlive === 0 && (goodAlive > 0 || neutralAlive > 0)) {
    const winners = alive.filter(p => p.victoryConditions?.canWinWithTeams?.includes('good'));
    if (winners.length) return { winner: 'good', players: winners.map(w => w._id), teams: ['good'] };
  }

  // Evil win: no good alive OR parity/majority against good
  if (goodAlive === 0 || (evilAlive >= goodAlive)) {
    const winners = alive.filter(p => p.victoryConditions?.canWinWithTeams?.includes('evil'));
    if (winners.length) return { winner: 'evil', players: winners.map(w => w._id), teams: ['evil'] };
  }

  // 3) Custom rules per player
  for (const p of alive) {
    const rules = p.victoryConditions?.customRules || [];
    if (rules.length) {
      const ok = rules.every(rule => evaluateCustomRule(rule, { counts, byTeam, players, self: p }));
      if (ok) return { winner: 'custom', players: [p._id], teams: p.affiliations || [] };
    }
  }

  return null;
}

// -----------------------------
// Night resolution
// -----------------------------
async function resolveNightActions(game, players) {
  // This is a minimal but extensible resolver; tune priorities as you wish.
  const idMap = new Map(players.map(p => [p._id.toString(), p]));
  const blocked = new Set(); // actors who cannot act
  const trapped = new Set(); // actors caught by trap
  const visits = [];         // collected visits/actions

  // 0) Clear expired effects
  clearExpiredEffects(players);

  // 1) Pre-process blocks and collect visits
  for (const actor of players) {
    if (!actor.alive) continue;
    const action = actor.nightAction?.action;
    const targetId = actor.nightAction?.targetId?.toString();
    if (!action || !targetId) continue;
    const target = idMap.get(targetId);
    if (!target || !target.alive) continue;

    // Blocked actor cannot act (e.g., Jailer or prior effects)
    if (hasEffect(actor, 'blocked')) {
      blocked.add(actor._id.toString());
      continue;
    }

    // Trapper: if target has trap effect, any actor visiting is trapped
    if (hasEffect(target, 'trap')) {
      trapped.add(actor._id.toString());
      // option: add 'trapped' effect
      addEffect(actor, 'trapped', null, null, {});
      continue;
    }

    // Drunk 50% fail
    if (actor.modifier === 'Opilý' || actor.modifier === 'Drunk') {
      if (Math.random() < 0.5) {
        blocked.add(actor._id.toString());
        continue;
      }
    }

    visits.push({ actorId: actor._id.toString(), targetId, action });
  }

  // 2) Apply effects by action 
  const toSave = new Set();
  for (const v of visits) {
    if (blocked.has(v.actorId) || trapped.has(v.actorId)) continue;
    const actor = idMap.get(v.actorId);
    const target = idMap.get(v.targetId);
    if (!actor || !target) continue;

    switch (v.action) {
      case 'infect': {
        if (!hasEffect(target, 'infected')) {
          addEffect(target, 'infected', actor._id, null, {});
          toSave.add(target._id.toString());
        }
        break;
      }
      case 'frame': {
        // framed until end of next day unless cleared
        addEffect(target, 'framed', actor._id, null, {});
        toSave.add(target._id.toString());
        break;
      }
      case 'kill':
      case 'clean_kill': {
        addEffect(target, 'pendingKill', actor._id, null, { clean: v.action === 'clean_kill' });
        toSave.add(target._id.toString());
        break;
      }
      case 'protect': {
        addEffect(target, 'protected', actor._id, null, {});
        toSave.add(target._id.toString());
        break;
      }
      case 'block': {
        addEffect(target, 'blocked', actor._id, null, {});
        toSave.add(target._id.toString());
        break;
      }
      case 'trap': {
        // Add trap effect on target’s house
        addEffect(target, 'trap', actor._id, null, {});
        toSave.add(target._id.toString());
        break;
      }
      case 'watch':
      case 'track':
      case 'investigate':
        // Information roles handled in logs or separate info channels (omitted here for public UI)
        break;
      default:
        break;
    }
  }

  // 3) Resolve kill vs protect and apply deaths
  for (const p of players) {
    if (!p.alive) continue;
    const pending = (p.effects || []).filter(e => e.type === 'pendingKill');
    if (!pending.length) continue;
    const isProtected = hasEffect(p, 'protected');
    if (!isProtected) {
      p.alive = false;
      // Optionally, write clean-kill info into GameLog (hide role if meta.clean)
    }
    // Clear all pendingKill effects
    removeEffects(p, e => e.type === 'pendingKill');
    toSave.add(p._id.toString());
  }

  // 4) Persist updated players
  for (const id of toSave) {
    const pl = idMap.get(id);
    await pl.save();
  }

  // 5) Clean one-shot effects that should not persist past resolution window
  for (const p of players) {
    // Example: protected, blocked, trap could expire at end of night
    // If you want duration per effect, set expiresAt when adding.
  }
}

// -----------------------------
// Day resolution (voting)
// -----------------------------
async function resolveDayVoting(game, players) {
  // Simple majority: player with max votes is executed; tie -> no execution
  const alive = players.filter(p => p.alive);
  const counts = new Map(); // targetId -> votes
  for (const p of alive) {
    if (p.voteFor) {
      const key = p.voteFor.toString();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  if (!counts.size) {
    await GameLog.create({ gameId: game._id, message: 'No execution (no votes).' });
    return;
  }

  let topId = null;
  let topVotes = 0;
  let tied = false;
  for (const [k, v] of counts) {
    if (v > topVotes) {
      topVotes = v;
      topId = k;
      tied = false;
    } else if (v === topVotes) {
      tied = true;
    }
  }

  if (tied) {
    await GameLog.create({ gameId: game._id, message: 'No execution (tie).' });
    return;
  }

  const target = await Player.findById(topId);
  if (target && target.alive) {
    target.alive = false;
    await target.save();
    await GameLog.create({ gameId: game._id, message: `Executed: ${target.name}` });
  }

  // Clear daily votes
  for (const p of alive) {
    p.hasVoted = false;
    p.voteFor = null;
    await p.save();
  }

  // Optionally clear day-scoped effects like 'framed' at end of day
  // for (const p of players) removeEffects(p, e => e.type === 'framed');
}

// -----------------------------
// ROUTES
// -----------------------------

// Create game
router.post('/create', async (req, res) => {
  try {
    const roomCode = (Math.floor(1000 + Math.random() * 9000)).toString();
    const { ip, port } = req.body || {};
    
    const game = new Game({ 
      roomCode, 
      ip, 
      port,
      phase: 'lobby',  
      round: 0,
      timerState: { phaseEndsAt: null }  
    });
    
    await game.save();
    await GameLog.create({ gameId: game._id, message: `Game created. Room: ${roomCode}` });
    
    res.json({ success: true, gameId: game._id, roomCode });
  } catch (e) {
    console.error('create error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Join by room code
router.post('/join', async (req, res) => {
  try {
    const { roomCode, name, sessionId } = req.body || {};
    const game = await Game.findOne({ roomCode });
    if (!game) return res.status(404).json({ error: 'Game not found' });

    let player = await Player.findOne({ gameId: game._id, sessionId });
    if (!player) {
      player = new Player({ gameId: game._id, sessionId, name, role: null });
      await player.save();
      await GameLog.create({ gameId: game._id, message: `${name} joined.` });
    }

    res.json({ success: true, gameId: game._id, playerId: player._id });
  } catch (e) {
    console.error('join error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get public game state (no meta)
router.get('/:gameId/state', async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!ensureObjectId(gameId)) return res.status(400).json({ error: 'Invalid game id' });

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const players = await Player.find({ gameId }).sort({ createdAt: 1 });
    const logs = await GameLog.find({ gameId }).sort({ createdAt: 1 }).limit(200);

    const publicPlayers = players.map(p => ({
      _id: p._id,
      name: p.name,
      role: p.role,          // if you want to hide roles from public UI, set null here
      alive: p.alive,
      hasVoted: p.hasVoted,
      voteFor: p.voteFor      // front-end uses this only to aggregate counts; no names shown
    }));

    res.json({
      game: {
        _id: game._id,
        roomCode: game.roomCode,
        phase: game.phase,
        round: game.round,
        timers: game.timers,
        timerState: game.timerState
      },
      players: publicPlayers,
      logs: logs.map(l => l.message)
    });
  } catch (e) {
    console.error('state error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get full players with modifiers (moderator use only)
router.get('/:gameId/players-full', async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!ensureObjectId(gameId)) return res.status(400).json({ error: 'Invalid game id' });

    const players = await Player.find({ gameId }).sort({ createdAt: 1 });
    res.json({
      players: players.map(p => ({
        _id: p._id,
        name: p.name,
        role: p.role,
        modifier: p.modifier,
        affiliations: p.affiliations,
        victoryConditions: p.victoryConditions,
        effects: p.effects,
        alive: p.alive,
        hasVoted: p.hasVoted,
        voteFor: p.voteFor
      }))
    });
  } catch (e) {
    console.error('players-full error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get player role by sessionId
router.get('/:gameId/player/:sessionId/role', async (req, res) => {
  try {
    const { gameId, sessionId } = req.params;
    if (!ensureObjectId(gameId)) return res.status(400).json({ error: 'Invalid game id' });

    const player = await Player.findOne({ gameId, sessionId });
    if (!player) return res.status(404).json({ error: 'Player not found' });

    res.json({ role: player.role, modifier: player.modifier });
  } catch (e) {
    console.error('getPlayerRole error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Night action
router.post('/:gameId/night-action', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerId, targetId, action } = req.body || {};

    if (!ensureObjectId(gameId) || !ensureObjectId(playerId) || !ensureObjectId(targetId)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }

    const player = await Player.findById(playerId);
    if (!player || player.gameId.toString() !== gameId) {
      return res.status(404).json({ error: 'Player not found' });
    }

    player.nightAction = { targetId, action };
    await player.save();

    res.json({ success: true });
  } catch (e) {
    console.error('nightAction error:', e);
    res.status(500).json({ error: e.message });
  }
});
// Vote
// Vote endpoint with auto-shorten when all alive voted
router.post('/:gameId/vote', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerId, targetId } = req.body || {};

    if (!ensureObjectId(gameId) || !ensureObjectId(playerId)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.phase !== 'day') return res.status(400).json({ error: 'Voting only during day' });

    const player = await Player.findById(playerId);
    if (!player || player.gameId.toString() !== gameId) {
      return res.status(404).json({ error: 'Player not found' });
    }
    if (!player.alive) {
      return res.status(400).json({ error: 'Dead players cannot vote' });
    }

    // Zaznamenej hlas
    player.hasVoted = true;
    player.voteFor = targetId ? targetId : null;
    await player.save();

    await GameLog.create({ gameId, message: `${player.name} voted.` });

    // Zkontroluj, zda všichni živí odhlasovali
    const alivePlayers = await Player.find({ gameId, alive: true });
    const allVoted = alivePlayers.every(p => p.hasVoted);

    if (allVoted && game.timerState?.phaseEndsAt) {
      const now = Date.now();
      const currentEnds = new Date(game.timerState.phaseEndsAt).getTime();
      const shortDeadline = now + 10 * 1000; // 10 sekund od teď

      // Zkrať pouze pokud by to bylo dřív než původní deadline
      if (shortDeadline < currentEnds) {
        game.timerState.phaseEndsAt = new Date(shortDeadline);
        await game.save();
        await GameLog.create({ gameId, message: '⏱️ All voted, day ends in 10s' });
        console.log('⏱️ All alive players voted, shortening day to 10s');
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error('vote error:', e);
    res.status(500).json({ error: e.message });
  }
});


// Update role configuration (lobby only) – optional if still used
router.put('/:gameId/roles', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { roleConfiguration } = req.body || {};
    if (!ensureObjectId(gameId)) return res.status(400).json({ error: 'Invalid game id' });

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.phase !== 'lobby') return res.status(400).json({ error: 'Cannot change roles after start' });

    const total = Object.values(roleConfiguration || {}).reduce((s, n) => s + (Number(n) || 0), 0);
    if (total === 0) return res.status(400).json({ error: 'At least one role required' });

    game.roleConfiguration = roleConfiguration;
    await game.save();
    res.json({ success: true, roleConfiguration: game.roleConfiguration });
  } catch (e) {
    console.error('update roles error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Update timers (lobby only)
router.put('/:gameId/timers', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { nightSeconds, daySeconds } = req.body || {};
    if (!ensureObjectId(gameId)) return res.status(400).json({ error: 'Invalid game id' });

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.phase !== 'lobby') return res.status(400).json({ error: 'Timers can be changed only in lobby' });

    const night = clampNum(nightSeconds, 10, 1800, game.timers.nightSeconds);
    const day = clampNum(daySeconds, 10, 1800, game.timers.daySeconds);

    game.timers.nightSeconds = night;
    game.timers.daySeconds = day;
    await game.save();

    res.json({ success: true, timers: game.timers });
  } catch (e) {
    console.error('update timers error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Start with explicit assignments and modifiers; inject affiliations/victoryConditions from ROLES
router.post('/:gameId/start-config', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { assignments, modifiers } = req.body || {};
    if (!ensureObjectId(gameId)) return res.status(400).json({ error: 'Invalid game id' });

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.phase !== 'lobby') return res.status(400).json({ error: 'Game already started' });

    const players = await Player.find({ gameId });
    if (players.length < 3) return res.status(400).json({ error: 'At least 3 players required' });

    const byId = new Map(players.map(p => [p._id.toString(), p]));
    for (const [pid, role] of Object.entries(assignments || {})) {
      const p = byId.get(pid.toString());
      if (p) p.role = role || 'Citizen';
    }
    // Fallback to Citizen
    for (const p of players) if (!p.role) p.role = 'Citizen';

    // Inject affiliations & victory per role definition
    for (const p of players) {
      const def = ROLES[p.role];
      p.affiliations = def?.defaultAffiliations || [];
      p.victoryConditions = def?.defaultVictory || { canWinWithTeams: [], soloWin: false, customRules: [] };
      await p.save();
    }

    // Modifiers probabilities
    const drunkChance = normalizeChance(modifiers?.opilýChance ?? modifiers?.drunkChance, game.modifierConfiguration?.opilýChance ?? 0.2);
    const recluseChance = normalizeChance(modifiers?.poustevníkChance ?? modifiers?.recluseChance, game.modifierConfiguration?.poustevníkChance ?? 0.15);

    for (const p of players) {
      const r = Math.random();
      if (r < drunkChance) p.modifier = 'Drunk';
      else if (r < drunkChance + recluseChance) p.modifier = 'Recluse';
      else p.modifier = null;
      await p.save();
    }

    // Start by DAY with timer
    const daySec = Number(game.timers?.daySeconds ?? 150);
    game.phase = 'day';
    game.round = 1;
    game.timerState = { phaseEndsAt: endInMs(daySec) };
    await game.save();

    await GameLog.create({ gameId, message: '--- GAME START ---' });
    await GameLog.create({ gameId, message: `Round ${game.round} - DAY (⏱ ${daySec}s)` });

    res.json({ success: true });
  } catch (e) {
    console.error('start-config error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Tick: auto switch phases, resolve actions/voting, evaluate victory
router.post('/:gameId/tick', async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!ensureObjectId(gameId)) return res.status(400).json({ error: 'Invalid game id' });

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    if (game.phase === 'end') return res.json({ success: true, phase: 'end' });

    const endsAt = game.timerState?.phaseEndsAt ? new Date(game.timerState.phaseEndsAt).getTime() : null;
    const currentMs = nowMs();

    // If no deadline set, initialize for current phase
    if (!endsAt) {
      const dur = game.phase === 'day' ? Number(game.timers?.daySeconds ?? 150) : Number(game.timers?.nightSeconds ?? 90);
      game.timerState = { phaseEndsAt: endInMs(dur) };
      await game.save();
      return res.json({ success: true, phase: game.phase, phaseEndsAt: game.timerState.phaseEndsAt });
    }

    if (currentMs < endsAt) {
      return res.json({ success: true, phase: game.phase, remainingMs: (endsAt - currentMs), phaseEndsAt: game.timerState.phaseEndsAt });
    }

    // Phase expired -> resolve and switch
    let players = await Player.find({ gameId });

    if (game.phase === 'night') {
      await resolveNightActions(game, players);
      players = await Player.find({ gameId });

      const win = evaluateVictory(players);
      if (win) {
        game.phase = 'end';
        await game.save();
        await GameLog.create({ gameId, message: `🏁 Victory: ${win.winner}` });
        return res.json({ success: true, phase: 'end', winner: win.winner, winners: win.players });
      }

      // switch to day
      const daySec = Number(game.timers?.daySeconds ?? 150);
      game.phase = 'day';
      game.timerState.phaseEndsAt = endInMs(daySec);
      await game.save();
      await GameLog.create({ gameId, message: `Round ${game.round} - DAY (⏱ ${daySec}s)` });
      return res.json({ success: true, phase: 'day', phaseEndsAt: game.timerState.phaseEndsAt });
    }

    if (game.phase === 'day') {
      await resolveDayVoting(game, players);
      players = await Player.find({ gameId });

      const win = evaluateVictory(players);
      if (win) {
        game.phase = 'end';
        await game.save();
        await GameLog.create({ gameId, message: `🏁 Victory: ${win.winner}` });
        return res.json({ success: true, phase: 'end', winner: win.winner, winners: win.players });
      }

      // switch to night, new round
      const nightSec = Number(game.timers?.nightSeconds ?? 90);
      game.phase = 'night';
      game.round = (game.round || 0) + 1;
      game.timerState.phaseEndsAt = endInMs(nightSec);
      await game.save();
      await GameLog.create({ gameId, message: `Round ${game.round} - NIGHT (⏱ ${nightSec}s)` });
      return res.json({ success: true, phase: 'night', phaseEndsAt: game.timerState.phaseEndsAt });
    }

    return res.json({ success: true, phase: game.phase });
  } catch (e) {
    console.error('tick error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Optional endpoints to end phases manually (for admin/debug)
router.post('/:gameId/end-night', async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!ensureObjectId(gameId)) return res.status(400).json({ error: 'Invalid game id' });
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    if (game.phase !== 'night') return res.status(400).json({ error: 'Not in night phase' });

    let players = await Player.find({ gameId });
    await resolveNightActions(game, players);
    players = await Player.find({ gameId });

    const win = evaluateVictory(players);
    if (win) {
      game.phase = 'end';
      await game.save();
      await GameLog.create({ gameId, message: `🏁 Victory: ${win.winner}` });
      return res.json({ success: true, phase: 'end', winner: win.winner, winners: win.players });
    }

    const daySec = Number(game.timers?.daySeconds ?? 150);
    game.phase = 'day';
    game.timerState.phaseEndsAt = endInMs(daySec);
    await game.save();
    await GameLog.create({ gameId, message: `Round ${game.round} - DAY (⏱ ${daySec}s)` });

    res.json({ success: true });
  } catch (e) {
    console.error('end-night error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/:gameId/end-day', async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!ensureObjectId(gameId)) return res.status(400).json({ error: 'Invalid game id' });
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    if (game.phase !== 'day') return res.status(400).json({ error: 'Not in day phase' });

    let players = await Player.find({ gameId });
    await resolveDayVoting(game, players);
    players = await Player.find({ gameId });

    const win = evaluateVictory(players);
    if (win) {
      game.phase = 'end';
      await game.save();
      await GameLog.create({ gameId, message: `🏁 Victory: ${win.winner}` });
      return res.json({ success: true, phase: 'end', winner: win.winner, winners: win.players });
    }

    const nightSec = Number(game.timers?.nightSeconds ?? 90);
    game.phase = 'night';
    game.round = (game.round || 0) + 1;
    game.timerState.phaseEndsAt = endInMs(nightSec);
    await game.save();
    await GameLog.create({ gameId, message: `Round ${game.round} - NIGHT (⏱ ${nightSec}s)` });

    res.json({ success: true });
  } catch (e) {
    console.error('end-day error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/game/:gameId/reset-to-lobby
router.post('/:gameId/reset-to-lobby', async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!ensureObjectId(gameId)) return res.status(400).json({ error: 'Invalid game id' });

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    // Reset game state
    game.phase = 'lobby';
    game.round = 0;
    game.timerState = { phaseEndsAt: null };
    await game.save();

    // Reset all players
    const players = await Player.find({ gameId });
    for (const p of players) {
      p.alive = true;
      p.role = null;
      p.modifier = null;
      p.affiliations = [];
      p.victoryConditions = { canWinWithTeams: [], soloWin: false, customRules: [] };
      p.effects = [];
      p.hasVoted = false;
      p.voteFor = null;
      p.nightAction = { targetId: null, action: null };
      p.actionResults = [];
      await p.save();
    }

    await GameLog.create({ gameId, message: '🔄 Game reset to lobby by moderator' });

    console.log('✅ Game reset to lobby');
    res.json({ success: true });
  } catch (e) {
    console.error('reset-to-lobby error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/game/:gameId/end-phase
router.post('/:gameId/end-phase', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    if (!ensureObjectId(gameId)) {
      return res.status(400).json({ error: 'Invalid game id' });
    }

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const currentPhase = game.phase;
    console.log(`🔄 [END-PHASE] Current phase: ${currentPhase}`);

    if (currentPhase === 'day') {
      // Day → Night: process voting
      console.log('📋 Processing day voting...');
      
      // Najdi hráče s nejvíce hlasy
      const voteCounts = {};
      const players = await Player.find({ gameId, alive: true });
      
      for (const p of players) {
        if (p.voteFor) {
          voteCounts[p.voteFor.toString()] = (voteCounts[p.voteFor.toString()] || 0) + 1;
        }
      }

      // Hráč s nejvíce hlasy zemře
      let maxVotes = 0;
      let eliminatedId = null;
      for (const [pid, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
          maxVotes = count;
          eliminatedId = pid;
        }
      }

      if (eliminatedId) {
        const eliminated = await Player.findById(eliminatedId);
        eliminated.alive = false;
        await eliminated.save();
        await GameLog.create({ 
          gameId, 
          message: `💀 ${eliminated.name} was eliminated by vote.` 
        });
        console.log(`💀 Eliminated: ${eliminated.name}`);
      }

      // Reset votes
      await Player.updateMany(
        { gameId },
        { hasVoted: false, voteFor: null }
      );

      game.phase = 'night';
    } 
    else if (currentPhase === 'night') {
      // Night → Day: process night actions
      console.log('🌙 Processing night actions...');
      
      // Zde můžeš později přidat logiku pro noční akce
      // Zatím jen změníme fázi
      
      game.phase = 'day';
    }

    // Nastav nový deadline
    const phaseSeconds = game.phase === 'day' 
      ? (game.timers?.daySeconds ?? 150) 
      : (game.timers?.nightSeconds ?? 90);
    
    game.timerState = { 
      phaseEndsAt: new Date(Date.now() + phaseSeconds * 1000)
    };

    // Check victory
    const allPlayers = await Player.find({ gameId });
    const alive = allPlayers.filter(p => p.alive);
    const aliveBad = alive.filter(p => p.affiliations?.includes('evil') || p.team === 'evil');
    const aliveGood = alive.filter(p => p.affiliations?.includes('good') || p.team === 'good');

    if (aliveBad.length === 0) {
      console.log('✅ Good team wins!');
      game.phase = 'end';
      game.winner = 'good';
      await GameLog.create({ gameId, message: '🎉 Good team wins!' });
    } else if (aliveBad.length >= aliveGood.length) {
      console.log('✅ Evil team wins!');
      game.phase = 'end';
      game.winner = 'evil';
      await GameLog.create({ gameId, message: '🎉 Evil team wins!' });
    }

    await game.save();

    await GameLog.create({ 
      gameId, 
      message: `🔄 Phase ended: ${currentPhase} → ${game.phase}` 
    });

    console.log(`✅ [END-PHASE] Phase changed: ${currentPhase} → ${game.phase}`);
    
    res.json({ 
      success: true, 
      phase: game.phase,
      round: game.round,
      phaseEndsAt: game.timerState.phaseEndsAt,
      winner: game.winner || null
    });
  } catch (e) {
    console.error('❌ end-phase error:', e);
    console.error('Stack:', e.stack);
    res.status(500).json({ error: e.message });
  }
});


module.exports = router;
