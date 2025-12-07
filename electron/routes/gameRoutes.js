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

// Helper function to assign unique avatar with retry logic to prevent race conditions
async function assignUniqueAvatar(gameId, maxRetries = 5) {
  const MAX_AVATARS = 50; // Máme avatary 1.png až 50.png
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Vždy znovu načti aktuální stav hráčů, aby se zabránilo race condition
    const existingPlayers = await Player.find({ gameId });
    const usedAvatars = new Set(existingPlayers.map(p => p.avatar).filter(Boolean));
    
    // Najdi první dostupný avatar
    for (let i = 1; i <= MAX_AVATARS; i++) {
      const avatarPath = `/avatars/${i}.png`;
      if (!usedAvatars.has(avatarPath)) {
        // Ověř, že avatar stále není používán (double-check)
        const stillAvailable = await Player.findOne({ 
          gameId, 
          avatar: avatarPath 
        });
        
        if (!stillAvailable) {
          return avatarPath;
        }
        // Pokud je už používán, pokračuj v hledání
      }
    }
    
    // Pokud jsou všechny použité a není to poslední pokus, počkej chvíli a zkus znovu
    if (attempt < maxRetries - 1) {
      // Krátká pauza před dalším pokusem (umožní dokončit souběžné save operace)
      await new Promise(resolve => setTimeout(resolve, 50));
      continue;
    }
  }
  
  // Fallback: pokud všechny pokusy selhaly, vrať náhodný
  const randomAvatar = Math.floor(Math.random() * MAX_AVATARS) + 1;
  return `/avatars/${randomAvatar}.png`;
}

// Join by room code
router.post('/join', async (req, res) => {
  try {
    const { roomCode, name, sessionId } = req.body || {};
    const game = await Game.findOne({ roomCode });
    if (!game) return res.status(404).json({ error: 'Game not found' });

    let player = await Player.findOne({ gameId: game._id, sessionId });
    if (!player) {
      // Přiřaď unikátní avatar
      const avatar = await assignUniqueAvatar(game._id);
      player = new Player({ gameId: game._id, sessionId, name, role: null, avatar });
      await player.save();
      await GameLog.create({ gameId: game._id, message: `${name} joined.` });
    }

    res.json({ success: true, gameId: game._id, playerId: player._id });
  } catch (e) {
    console.error('join error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Kick/remove player from game (moderator action - lobby only)
// IMPORTANT: This route must come before GET routes with similar patterns
router.delete('/:gameId/player/:playerId', async (req, res) => {
  try {
    const { gameId, playerId } = req.params;
    if (!ensureObjectId(gameId)) return res.status(400).json({ error: 'Invalid game id' });
    if (!ensureObjectId(playerId)) return res.status(400).json({ error: 'Invalid player id' });

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    // Only allow kicking players in lobby phase
    if (game.phase !== 'lobby') {
      return res.status(400).json({ error: 'Can only kick players in lobby phase' });
    }

    const player = await Player.findOne({ _id: playerId, gameId });
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const playerName = player.name;
    await Player.deleteOne({ _id: playerId });
    await GameLog.create({ gameId, message: `${playerName} was kicked from the game.` });

    res.json({ success: true, message: `Player ${playerName} has been removed` });
  } catch (e) {
    console.error('kick player error:', e);
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
      voteWeight: p.voteWeight || 1,
      avatar: p.avatar,
      nightResults: p.nightAction?.results || [],
      roleData: p.roleData || {} // Přidej roleData pro sledování navštívených hráčů (Infected)
    }));

    res.json({
      game: {
        _id: game._id,
        roomCode: game.roomCode,
        phase: game.phase,
        round: game.round,
        mayor: game.mayor,
        timers: game.timers,
        timerState: game.timerState,
        winner: game.winner,
        winnerPlayerIds: game.winnerPlayerIds || []
      },
      players: publicPlayers,
      logs: logs.map(l => ({
        _id: l._id,
        message: l.message,
        createdAt: l.createdAt
      }))
    });
  } catch (e) {
    console.error('state error:', e);
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

    // Zaznamenej zprávu o hlasování
    if (targetId) {
      const target = await Player.findById(targetId);
      await GameLog.create({ gameId, message: `${player.name} voted for ${target?.name || 'unknown'}.` });
    } else {
      await GameLog.create({ gameId, message: `${player.name} skipped voting.` });
    }

    // Zkontroluj, zda všichni živí odhlasovali
    const alivePlayers = await Player.find({ gameId, alive: true });
    const allVoted = alivePlayers.every(p => p.hasVoted);
    
    // Zkontroluj, zda všichni hlasovali skip (null)
    const allSkipped = allVoted && alivePlayers.every(p => !p.voteFor);

    if (allVoted && game.timerState?.phaseEndsAt) {
      const now = Date.now();
      const currentEnds = new Date(game.timerState.phaseEndsAt).getTime();
      
      if (allSkipped) {
        // Pokud všichni hlasovali skip, přeskoč čas (ukonči den okamžitě)
        game.timerState.phaseEndsAt = new Date(now + 3 * 1000); // 3 sekundy na přechod
        await game.save();
        await GameLog.create({ gameId, message: '⏱️ All players skipped voting, day ends in 3s' });
        console.log('⏱️ All alive players skipped voting, ending day in 3s');
      } else {
        // Normální zkrácení na 10 sekund
        const shortDeadline = now + 10 * 1000; // 10 sekund od teď

        // Zkrať pouze pokud by to bylo dřív než původní deadline
        if (shortDeadline < currentEnds) {
          game.timerState.phaseEndsAt = new Date(shortDeadline);
          await game.save();
          await GameLog.create({ gameId, message: '⏱️ All voted, day ends in 10s' });
          console.log('⏱️ All alive players voted, shortening day to 10s');
        }
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error('vote error:', e);
    res.status(500).json({ error: e.message });
  }
});


// Update role configuration (lobby only) – optional if still used
router.post('/:gameId/start-config', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { assignments, modifiers, timers } = req.body || {};
    
    if (!ensureObjectId(gameId)) return res.status(400).json({ error: 'Invalid game id' });

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.phase !== 'lobby') return res.status(400).json({ error: 'Game already started' });

    const players = await Player.find({ gameId });
    if (players.length < 3) return res.status(400).json({ error: 'At least 3 players required' });

    if (timers) {
      const currentTimers = game.timers ?? {};
      const nextNight = clampNum(timers.nightSeconds, 10, 1800, currentTimers.nightSeconds ?? 90);
      const nextDay = clampNum(timers.daySeconds, 10, 1800, currentTimers.daySeconds ?? 150);
      game.timers = {
        ...currentTimers,
        nightSeconds: nextNight,
        daySeconds: nextDay
      };
    }

    // Assign roles
    console.log('📋 Assigning roles:', assignments);
    for (const [playerId, roleName] of Object.entries(assignments || {})) {
      const player = players.find(p => p._id.toString() === playerId);
      if (player) {
        player.role = roleName || 'Citizen';
        console.log(`  ✓ ${player.name} ← ${player.role}`);
        await player.save();
      }
    }

    // Set default Citizen for players without role
    for (const p of players) {
      if (!p.role) {
        p.role = 'Citizen';
        await p.save();
        console.log(`  ✓ ${p.name} ← Citizen (default)`);
      }
    }

    // Set affiliations and victory conditions
    const updatedPlayers = await Player.find({ gameId });
    for (const p of updatedPlayers) {
      const def = ROLES[p.role];
      p.affiliations = def?.defaultAffiliations || ['good'];
      p.victoryConditions = def?.defaultVictory || { 
        canWinWithTeams: ['good'], 
        soloWin: false, 
        customRules: [] 
      };
      await p.save();
    }

    // Initialize roleData for limited-use roles and dual roles
    for (const p of updatedPlayers) {
      const roleData = ROLES[p.role];
      
      // Pro dual role s hasLimitedUses - inicializuj usesRemaining pro sekundární akce
      if (roleData?.actionType === 'dual' && roleData?.hasLimitedUses) {
        if (!p.roleData) p.roleData = {};
        p.roleData.usesRemaining = roleData.maxUses || 3;
        await p.save();
        console.log(`  ✓ ${p.name} (${p.role}) initialized with ${p.roleData.usesRemaining} uses for secondary actions`);
      } else if (roleData?.hasLimitedUses) {
        if (!p.roleData) p.roleData = {};
        p.roleData.usesRemaining = roleData.maxUses || 3;
        await p.save();
        console.log(`  ✓ ${p.name} (${p.role}) initialized with ${p.roleData.usesRemaining} uses`);
      }
    }

    // ✅ Modifiers s allowedTeams kontrolou
    console.log('🎭 Assigning modifiers...');
    
    // Normalize chances
    const drunkChance = normalizeChance(modifiers?.drunkChance ?? modifiers?.opilýChance, 0.2);
    const shadyChance = normalizeChance(modifiers?.shadyChance ?? modifiers?.recluseChance ?? modifiers?.poustevníkChance, 0.15);
    const innocentChance = normalizeChance(modifiers?.innocentChance, 0.15);
    const paranoidChance = normalizeChance(modifiers?.paranoidChance, 0.1);
    const insomniacChance = normalizeChance(modifiers?.insomniacChance, 0.1);
    const amnesiacChance = normalizeChance(modifiers?.amnesiacChance, 0);

    // ✅ Check if MODIFIERS exists
    if (!MODIFIERS) {
      console.warn('⚠️ MODIFIERS not found, skipping modifier assignment');
    } else {
      // Build list of available modifiers per player based on their team
      for (const p of updatedPlayers) {
        const roleData = ROLES[p.role];
        const roleTeam = roleData?.team || 'good';
        
        // Get all valid modifiers for this team
        const validModifiers = [];
        
        // ✅ Check each modifier with proper fallback
        if (MODIFIERS.Drunk && Array.isArray(MODIFIERS.Drunk.allowedTeams)) {
          if (MODIFIERS.Drunk.allowedTeams.includes(roleTeam)) {
            validModifiers.push({ name: 'Drunk', chance: drunkChance });
          }
        }
        
        if (MODIFIERS.Shady && Array.isArray(MODIFIERS.Shady.allowedTeams)) {
          if (MODIFIERS.Shady.allowedTeams.includes(roleTeam)) {
            validModifiers.push({ name: 'Shady', chance: shadyChance });
          }
        }
        
        // Innocent uses its own chance, for evil team
        if (MODIFIERS.Innocent && Array.isArray(MODIFIERS.Innocent.allowedTeams)) {
          if (MODIFIERS.Innocent.allowedTeams.includes(roleTeam)) {
            validModifiers.push({ name: 'Innocent', chance: innocentChance });
          }
        }
        
        if (MODIFIERS.Paranoid && Array.isArray(MODIFIERS.Paranoid.allowedTeams)) {
          if (MODIFIERS.Paranoid.allowedTeams.includes(roleTeam)) {
            validModifiers.push({ name: 'Paranoid', chance: paranoidChance });
          }
        }
        
        if (MODIFIERS.Insomniac && Array.isArray(MODIFIERS.Insomniac.allowedTeams)) {
          if (MODIFIERS.Insomniac.allowedTeams.includes(roleTeam)) {
            validModifiers.push({ name: 'Insomniac', chance: insomniacChance });
          }
        }
        
        if (MODIFIERS.Amnesiac && Array.isArray(MODIFIERS.Amnesiac.allowedTeams)) {
          if (MODIFIERS.Amnesiac.allowedTeams.includes(roleTeam)) {
            validModifiers.push({ name: 'Amnesiac', chance: amnesiacChance });
          }
        }

        // Roll for modifier (first match wins)
        p.modifier = null;
        const roll = Math.random();
        let cumulative = 0;

        for (const mod of validModifiers) {
          cumulative += mod.chance;
          if (roll < cumulative) {
            p.modifier = mod.name;
            console.log(`  🎭 ${p.name} (${p.role}/${roleTeam}) ← ${mod.name}`);
            break;
          }
        }

        if (!p.modifier) {
          console.log(`  ✓ ${p.name} (${p.role}/${roleTeam}) ← No modifier`);
        }

        await p.save();
      }
    }

    // Start by DAY with timer
    const daySec = Number(game.timers?.daySeconds ?? 150);
    game.phase = 'day';
    game.round = 1;
    game.timerState = { phaseEndsAt: endInMs(daySec) };
    await game.save();

    await GameLog.create({ gameId, message: '--- GAME START ---' });
    await GameLog.create({ gameId, message: `Round ${game.round} - DAY (⏱ ${daySec}s)` });

    console.log('✅ Game started with role assignments and modifiers');
    res.json({ success: true });
  } catch (e) {
    console.error('start-config error:', e);
    console.error('Stack:', e.stack);
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
      game.winner = win.winner;
      game.winnerPlayerIds = win.players || [];
      await game.save();
      await GameLog.create({ gameId, message: `🏁 Victory: ${win.winner}` });
      return res.json({ success: true, phase: 'end', winner: win.winner, winners: win.players });
    }

    const daySec = Number(game.timers?.daySeconds ?? 150);
    game.phase = 'day';
    game.timerState.phaseEndsAt = endInMs(daySec);
    await game.save();
    
    // ✅ RESET hlasování pro nový den
    console.log('🧹 Resetting votes for new day...');
    for (const p of players) {
      p.hasVoted = false;
      p.voteFor = null;
      await p.save();
    }
    console.log('✅ Votes reset complete');
    
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
    const votingResult = await resolveDayVoting(game, players, GameLog);
    players = await Player.find({ gameId });

    // ✅ Check if Jester won (was executed)
    console.log('🔍 Voting result:', JSON.stringify(votingResult, null, 2));
    if (votingResult && votingResult.jesterWin === true) {
      console.log('🎭 Jester win detected!');
      const jester = players.find(p => p.role === 'Jester' && !p.alive);
      console.log('🎭 Found Jester:', jester ? jester.name : 'not found');
      game.phase = 'end';
      game.winner = 'custom';
      game.winnerPlayerIds = jester ? [jester._id] : [];
      await game.save();
      await GameLog.create({ gameId, message: `🏁 Victory: Jester ${jester?.name || 'unknown'} wins!` });
      console.log('🎭 Game ended - Jester wins!');
      return res.json({ success: true, phase: 'end', winner: 'custom', winners: jester ? [jester._id] : [] });
    }

    const win = evaluateVictory(players);
    if (win) {
      game.phase = 'end';
      game.winner = win.winner;
      game.winnerPlayerIds = win.players || [];
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
    game.mayor = null; // Reset mayor
    game.timerState = { phaseEndsAt: null };
    game.winner = null;
    game.winnerPlayerIds = [];
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
      p.voteWeight = 1; // Reset vote weight
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
      const votingResult = await resolveDayVoting(game, players, GameLog);
      
      // Reload players after voting
      players = await Player.find({ gameId });
      
      // ✅ Check if Jester won (was executed)
      if (votingResult && votingResult.jesterWin === true) {
        console.log('🎭 Jester win detected in end-phase!');
        const jester = players.find(p => p.role === 'Jester' && !p.alive);
        console.log('🎭 Found Jester:', jester ? jester.name : 'not found');
        game.phase = 'end';
        game.winner = 'custom';
        game.winnerPlayerIds = jester ? [jester._id] : [];
        await game.save();
        await GameLog.create({ gameId, message: `🏁 Victory: Jester ${jester?.name || 'unknown'} wins!` });
        console.log('🎭 Game ended - Jester wins!');
        return res.json({
          success: true,
          phase: 'end',
          winner: 'custom',
          winners: jester ? [jester._id] : []
        });
      }
      
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
        game.winnerPlayerIds = win.players || [];
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
        game.winnerPlayerIds = win.players || [];
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
      
      // ✅ RESET hlasování pro nový den
      console.log('🧹 Resetting votes for new day...');
      for (const p of players) {
        p.hasVoted = false;
        p.voteFor = null;
        await p.save();
      }
      console.log('✅ Votes reset complete');
      
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

// Set night action with mode selection
router.post('/:gameId/set-night-action', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerId, targetId, actionMode } = req.body;
    
    if (!ensureObjectId(gameId)) return res.status(400).json({ error: 'Invalid game id' });
    if (!ensureObjectId(playerId)) return res.status(400).json({ error: 'Invalid player id' });
    if (!ensureObjectId(targetId)) return res.status(400).json({ error: 'Invalid target id' });

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.phase !== 'night') return res.status(400).json({ error: 'Not night phase' });

    const player = await Player.findById(playerId);
    if (!player || !player.alive) return res.status(400).json({ error: 'Player not found or dead' });

    const roleData = ROLES[player.role];
    
    // Check if role has dual actions
    if (roleData?.actionType === 'dual') {
      if (!actionMode) return res.status(400).json({ error: 'Action mode required for dual role' });
      
      // Check if special ability has uses left
      if (actionMode !== 'kill') {
        if (!player.roleData) player.roleData = {};
        // Pokud není usesRemaining nastaveno, inicializuj ho z role definice
        if (player.roleData.usesRemaining === undefined || player.roleData.usesRemaining === null) {
          player.roleData.usesRemaining = roleData.maxUses || 3;
        }
        const usesLeft = player.roleData.usesRemaining;
        
        if (usesLeft <= 0) {
          return res.status(400).json({ error: 'No special ability uses remaining' });
        }
      }
      
      player.nightAction = {
        targetId,
        action: actionMode, // 'kill', 'clean_role', 'frame', 'consig_investigate'
        results: []
      };
    } else {
      // Regular action
      player.nightAction = {
        targetId,
        action: roleData?.actionType || 'none',
        results: []
      };
    }

    await player.save();
    console.log(`✓ ${player.name} set action: ${player.nightAction.action} → ${targetId}`);
    
    res.json({ success: true });
  } catch (e) {
    console.error('set-night-action error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
