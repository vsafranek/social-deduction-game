// electron/routes/gameRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Game = require('../models/Game');
const Player = require('../models/Player');
const GameLog = require('../models/GameLog');
const { ROLES, MODIFIERS } = require('../models/Role');
const { resolveNightActions } = require('../game/nightActionResolver');
const { evaluateVictory } = require('../game/victoryEvaluator');
const { resolveDayVoting } = require('../game/votingResolver');

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
      role: p.role,
      alive: p.alive,
      hasVoted: p.hasVoted,
      voteFor: p.voteFor,
      nightResults: p.nightAction?.results || []
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
    const { playerId, targetId, action } = req.body;

    if (!ensureObjectId(gameId) || !ensureObjectId(playerId) || !ensureObjectId(targetId)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }

    const player = await Player.findById(playerId);
    if (!player || player.gameId.toString() !== gameId) {
      return res.status(404).json({ error: 'Player not found' });
    }

    player.nightAction = {
      targetId,
      action,
      results: []  
    };

    await player.save();
    
    console.log(`✅ Night action set: ${player.name} → ${action} → ${targetId}`);
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

// V gameRoutes.js - oprav endpoint /start-config
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

    // ✅ OPRAVA: Mapuj role na hráče podle ID
    console.log('📋 Assigning roles:', assignments);
    
    for (const [playerId, roleName] of Object.entries(assignments || {})) {
      const player = players.find(p => p._id.toString() === playerId);
      if (player) {
        player.role = roleName || 'Citizen';
        console.log(`  ✓ ${player.name} ← ${player.role}`);
        await player.save();
      }
    }

    for (const p of players) {
      if (!p.role) {
        p.role = 'Citizen';
        await p.save();
        console.log(`  ✓ ${p.name} ← Citizen (default)`);
      }
    }

    const updatedPlayers = await Player.find({ gameId });
    for (const p of updatedPlayers) {
      const def = ROLES[p.role];
      p.affiliations = def?.defaultAffiliations || ['good'];
      p.victoryConditions = def?.defaultVictory || { canWinWithTeams: ['good'], soloWin: false, customRules: [] };
      await p.save();
    }

    // ✅ Modifiers
    const drunkChance = normalizeChance(modifiers?.opilýChance ?? modifiers?.drunkChance, 0.2);
    const recluseChance = normalizeChance(modifiers?.poustevníkChance ?? modifiers?.recluseChance, 0.15);

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

    console.log('✅ Game started with role assignments');
    res.json({ success: true });

  } catch (e) {
    console.error('start-config error:', e);
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

    game.phase = 'lobby';
    game.round = 0;
    game.timerState = { phaseEndsAt: null };
    await game.save();

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
      p.nightAction = { targetId: null, action: null, results: [] };
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
      // Day → Night: process voting + RESET night actions
      console.log('📋 Processing day voting...');
      
      let players = await Player.find({ gameId });
      await resolveDayVoting(game, players, GameLog);
      
      // Reload players after voting
      players = await Player.find({ gameId });
      
      // ✅ RESET nočních akcí pro novou noc
      console.log('🧹 Resetting night actions for new night...');
      for (const p of players) {
        p.nightAction = {
          targetId: null,
          action: null,
          results: []
        };
        await p.save();
      }
      console.log('✅ Night actions reset complete');
      
      // Check victory
      const win = evaluateVictory(players);
      if (win) {
        game.phase = 'end';
        game.winner = win.winner;
        await game.save();
        await GameLog.create({ gameId, message: `🏁 Victory: ${win.winner}` });
        console.log(`✅ Victory: ${win.winner}`);
        return res.json({
          success: true,
          phase: 'end',
          winner: win.winner,
          winners: win.players
        });
      }

      // Switch to night
      const nightSec = Number(game.timers?.nightSeconds ?? 90);
      game.phase = 'night';
      game.round = (game.round || 0) + 1;
      game.timerState = {
        phaseEndsAt: new Date(Date.now() + nightSec * 1000)
      };
      await game.save();
      await GameLog.create({ gameId, message: `Round ${game.round} - NIGHT (⏱ ${nightSec}s)` });
      console.log(`✅ [END-PHASE] Day → Night (Round ${game.round})`);

    } else if (currentPhase === 'night') {
      // Night → Day: process night actions
      console.log('🌙 Processing night actions...');
      
      let players = await Player.find({ gameId });
      await resolveNightActions(game, players);
      
      // Reload players after night resolution
      players = await Player.find({ gameId });
      
      // Check victory
      const win = evaluateVictory(players);
      if (win) {
        game.phase = 'end';
        game.winner = win.winner;
        await game.save();
        await GameLog.create({ gameId, message: `🏁 Victory: ${win.winner}` });
        console.log(`✅ Victory: ${win.winner}`);
        return res.json({
          success: true,
          phase: 'end',
          winner: win.winner,
          winners: win.players
        });
      }

      // Switch to day
      const daySec = Number(game.timers?.daySeconds ?? 150);
      game.phase = 'day';
      game.timerState = {
        phaseEndsAt: new Date(Date.now() + daySec * 1000)
      };
      await game.save();
      await GameLog.create({ gameId, message: `Round ${game.round} - DAY (⏱ ${daySec}s)` });
      console.log(`✅ [END-PHASE] Night → Day (Round ${game.round})`);
    }

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
