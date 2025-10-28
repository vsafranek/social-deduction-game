const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const Player = require('../models/Player');
const GameLog = require('../models/GameLog');
const mongoose = require('mongoose');

const roles = ['Šerif', 'Doktor', 'Občan', 'Občan', 'Mafián', 'Mafián'];



// ==================== SPECIFIC ROUTES FIRST ====================


// Join game by room code - POST /api/game/join-by-code
router.post('/join-by-code', async (req, res) => {
  console.log('🚪 Join by room code endpoint hit');
  try {
    const { roomCode, playerName, sessionId } = req.body;
    
    console.log('Room code:', roomCode, 'Player:', playerName, 'SessionId:', sessionId);
    
    if (!roomCode || !playerName || !sessionId) {
      return res.status(400).json({ error: 'Chybí room kód, jméno nebo sessionId' });
    }
    
    // Find game by room code
    const game = await Game.findOne({ roomCode: roomCode.toString() });
    
    if (!game) {
      return res.status(404).json({ error: 'Hra s tímto room kódem nebyla nalezena' });
    }
    
    console.log('✅ Game found:', game._id);
    
    if (game.phase !== 'lobby') {
      return res.status(400).json({ error: 'Hra již běží, nelze se připojit' });
    }
    
    // ✅ FIX: Check if player already exists with this sessionId IN THIS GAME
    const existingPlayer = await Player.findOne({ 
      gameId: game._id, 
      sessionId 
    });
    
    if (existingPlayer) {
      console.log('✅ Player already exists in this game:', existingPlayer.name);
      return res.json({
        success: true,
        playerId: existingPlayer._id,
        gameId: game._id,
        message: 'Již připojen'
      });
    }
    
    // ✅ FIX: Also check if a player with same sessionId exists in ANY game
    // If yes, allow them to join this new game (remove old entry)
    const oldPlayerInDifferentGame = await Player.findOne({ sessionId });
    
    if (oldPlayerInDifferentGame) {
      console.log('⚠️ Player exists in different game, removing old entry');
      await Player.deleteOne({ _id: oldPlayerInDifferentGame._id });
    }
    
    // Create new player
    const player = new Player({
      gameId: game._id,
      sessionId,
      name: playerName
    });
    
    await player.save();
    
    await GameLog.create({
      gameId: game._id,
      message: `${playerName} se připojil`
    });
    
    console.log('✅ Hráč se připojil:', playerName);
    
    res.json({
      success: true,
      playerId: player._id,
      gameId: game._id
    });
  } catch (error) {
    console.error('❌ Chyba při připojení hráče:', error);
    res.status(500).json({ error: error.message });
  }
});



// Create new game - POST /api/game/create
router.post('/create', async (req, res) => {
  console.log('🎲 CREATE GAME endpoint hit!');
  console.log('📦 Request body:', req.body);
  
  try {
    const { ip, port } = req.body;
    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    console.log('🔨 Creating game with roomCode:', roomCode);
    
    const game = new Game({
      roomCode,
      ip,
      port
    });
    
    console.log('💾 Saving game to MongoDB...');
    await game.save();
    console.log('✅ Game saved!');
    
    console.log('📝 Creating game log...');
    await GameLog.create({
      gameId: game._id,
      message: 'Hra byla vytvořena'
    });
    
    console.log('✅ Hra vytvořena:', game._id, 'Room:', roomCode);
    
    res.json({
      success: true,
      gameId: game._id,
      roomCode: game.roomCode
    });
  } catch (error) {
    console.error('❌ Chyba při vytváření hry:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PARAMETERIZED ROUTES ====================

// Join game - POST /api/game/:gameId/join
router.post('/:gameId/join', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerName, sessionId } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ error: 'Neplatné ID hry' });
    }
    
    if (!playerName || !sessionId) {
      return res.status(400).json({ error: 'Chybí jméno nebo sessionId' });
    }
    
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Hra nenalezena' });
    }
    
    if (game.phase !== 'lobby') {
      return res.status(400).json({ error: 'Hra již běží' });
    }
    
    // Check if player already exists
    const existingPlayer = await Player.findOne({ gameId, sessionId });
    if (existingPlayer) {
      return res.json({
        success: true,
        playerId: existingPlayer._id,
        message: 'Již připojen'
      });
    }
    
    const player = new Player({
      gameId,
      sessionId,
      name: playerName
    });
    
    await player.save();
    
    await GameLog.create({
      gameId,
      message: `${playerName} se připojil`
    });
    
    console.log('✅ Hráč se připojil:', playerName);
    
    res.json({
      success: true,
      playerId: player._id
    });
  } catch (error) {
    console.error('❌ Chyba při připojení hráče:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start game with modifiers
router.post('/:gameId/start', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ error: 'Neplatné ID hry' });
    }
    
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Hra nenalezena' });
    }
    
    if (game.phase !== 'lobby') {
      return res.status(400).json({ error: 'Hra již běží' });
    }
    
    const players = await Player.find({ gameId });
    
    if (players.length < 3) {
      return res.status(400).json({ error: 'Minimálně 3 hráči' });
    }
    
    // ✅ 1. PŘIŘAĎ AKTIVNÍ ROLE
    const roleConfig = game.roleConfiguration || {
      'Doktor': 1,
      'Policie': 1,
      'Vyšetřovatel': 1,
      'Pozorovatel': 1,
      'Stopař': 1,
      'Občan': 1,
      'Vrah': 2
    };
    
    const roles = [];
    for (const [role, count] of Object.entries(roleConfig)) {
      for (let i = 0; i < count; i++) {
        roles.push(role);
      }
    }
    
    // Doplň Občany pokud je málo rolí
    while (roles.length < players.length) {
      roles.push('Občan');
    }
    
    // Shuffle a přiřaď aktivní role
    const shuffledRoles = roles.sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < players.length; i++) {
      players[i].role = shuffledRoles[i] || 'Občan';
    }
    
    // ✅ 2. PŘIŘAĎ PASIVNÍ MODIFIKÁTORY (náhodně)
    const modifierConfig = game.modifierConfiguration || {
      opilýChance: 0.2,
      poustevníkChance: 0.15
    };
    
    for (const player of players) {
      // Náhodně přiřaď modifikátory podle šance
      const rand = Math.random();
      
      if (rand < modifierConfig.opilýChance) {
        player.modifier = 'Opilý';
        console.log(`🍺 ${player.name} je Opilý ${player.role}`);
      } else if (rand < modifierConfig.opilýChance + modifierConfig.poustevníkChance) {
        player.modifier = 'Poustevník';
        console.log(`🏚️ ${player.name} je Poustevník ${player.role}`);
      } else {
        player.modifier = null;
      }
      
      await player.save();
    }
    
    // ✅ 3. START HRY
    game.phase = 'day';
    game.round = 1;
    await game.save();
    
    await GameLog.create({
      gameId,
      message: '--- HRA ZAČÍNÁ ---'
    });
    
    await GameLog.create({
      gameId,
      message: 'Kolo 1 - NOC'
    });
    
    console.log('✅ Hra spuštěna s rolemi a modifikátory');
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Chyba při startu hry:', error);
    res.status(500).json({ error: error.message });
  }
});



// POST /api/game/:gameId/start-config
router.post('/:gameId/start-config', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { assignments, modifiers } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ error: 'Neplatné ID hry' });
    }
    if (!assignments || typeof assignments !== 'object') {
      return res.status(400).json({ error: 'Chybí assignments { playerId: role }' });
    }

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Hra nenalezena' });
    if (game.phase !== 'lobby') {
      return res.status(400).json({ error: 'Hru nelze spustit mimo lobby' });
    }

    const players = await Player.find({ gameId });
    if (!players?.length || players.length < 3) {
      return res.status(400).json({ error: 'Minimálně 3 hráči' });
    }

    // 1) Přiřaď role dle mapy (bez ObjectId konstrukcí)
    const byId = new Map(players.map(p => [String(p._id), p]));
    for (const [pid, role] of Object.entries(assignments)) {
      const p = byId.get(String(pid));
      if (p) p.role = role || 'Občan';
    }
    // Fallback: kdo nemá roli, bude Občan
    for (const p of players) {
      if (!p.role) p.role = 'Občan';
      await p.save();
    }

    const now = new Date();
    game.phase = 'day';
    game.round = 1;
    game.timerState = { phaseEndsAt: new Date(now.getTime() + (game.timers.nightSeconds * 1000)) };
    await game.save();


    // 2) Modifikátory – podporuj procenta i 0–1
    const normalizeChance = (val, def) => {
      if (val === undefined || val === null) return def;
      const n = Number(val);
      if (Number.isNaN(n)) return def;
      return n > 1 ? Math.min(100, Math.max(0, n)) / 100 : Math.min(1, Math.max(0, n));
    };
    const opily = normalizeChance(modifiers?.opilýChance, game.modifierConfiguration?.opilýChance ?? 0.2);
    const poust = normalizeChance(modifiers?.poustevníkChance, game.modifierConfiguration?.poustevníkChance ?? 0.15);

    for (const p of players) {
      const r = Math.random();
      if (r < opily) p.modifier = 'Opilý';
      else if (r < opily + poust) p.modifier = 'Poustevník';
      else p.modifier = null;
      await p.save();
    }

    // 3) Start hry
    game.modifierConfiguration = {
      opilýChance: opily,
      poustevníkChance: poust
    };
    await game.save();

    await GameLog.create({ gameId, message: '--- HRA ZAČÍNÁ ---' });
    await GameLog.create({ gameId, message: 'Kolo 1 - NOC' });

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ start-config error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/game/:gameId/tick  => server zkontroluje a případně přepne fázi
router.post('/:gameId/tick', async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(gameId)) return res.status(400).json({ error: 'Neplatné ID hry' });

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Hra nenalezena' });

    const now = Date.now();
    const endsAtMs = game.timerState?.phaseEndsAt ? new Date(game.timerState.phaseEndsAt).getTime() : null;

    // Pokud není nastaveno phaseEndsAt, nastav ho podle aktuální fáze
    if (!endsAtMs) {
      const dur = game.phase === 'day' ? Number(game.timers?.daySeconds ?? 150) : Number(game.timers?.nightSeconds ?? 90);
      game.timerState = { phaseEndsAt: new Date(now + dur * 1000) };
      await game.save();
      return res.json({ success: true, phase: game.phase, phaseEndsAt: game.timerState.phaseEndsAt });
    }

    // Ještě nevypršelo
    if (now < endsAtMs) {
      return res.json({ success: true, phase: game.phase, remainingMs: endsAtMs - now, phaseEndsAt: game.timerState.phaseEndsAt });
    }

    // Vypršelo -> přepni fázi a nastav nové phaseEndsAt
    if (game.phase === 'day') {
      // TODO: vyhodnoť hlasování (tvá existující endDay logika)
      // Pokud hra nekončí:
      game.phase = 'night';
      const nightSec = Number(game.timers?.nightSeconds ?? 90);
      game.timerState.phaseEndsAt = new Date(now + nightSec * 1000);
      await GameLog.create({ gameId, message: `Kolo ${game.round} - NOC (⏱ ${nightSec}s)` });
    } else if (game.phase === 'night') {
      // TODO: vyhodnoť noční akce (tvá existující endNight logika)
      // Pokud hra nekončí:
      game.phase = 'day';
      game.round = (game.round || 0) + 1;
      const daySec = Number(game.timers?.daySeconds ?? 150);
      game.timerState.phaseEndsAt = new Date(now + daySec * 1000);
      await GameLog.create({ gameId, message: `Kolo ${game.round} - DEN (⏱ ${daySec}s)` });
    }

    await game.save();
    return res.json({ success: true, phase: game.phase, phaseEndsAt: game.timerState.phaseEndsAt });
  } catch (e) {
    console.error('tick error:', e);
    return res.status(500).json({ error: e.message });
  }
});



// PUT /api/game/:gameId/timers  (lobby only)
router.put('/:gameId/timers', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { nightSeconds, daySeconds } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(gameId)) return res.status(400).json({ error: 'Neplatné ID hry' });

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Hra nenalezena' });
    if (game.phase !== 'lobby') return res.status(400).json({ error: 'Timery lze měnit jen v lobby' });

    const n = Math.max(10, Math.min(1800, Number(nightSeconds) || game.timers.nightSeconds));
    const d = Math.max(10, Math.min(1800, Number(daySeconds) || game.timers.daySeconds));

    game.timers.nightSeconds = n;
    game.timers.daySeconds = d;
    await game.save();

    return res.json({ success: true, timers: game.timers });
  } catch (e) {
    console.error('PUT timers error:', e);
    return res.status(500).json({ error: e.message });
  }
});


// Get player role - GET /api/game/:gameId/player/:sessionId/role
router.get('/:gameId/player/:sessionId/role', async (req, res) => {
  try {
    const { gameId, sessionId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ error: 'Neplatné ID hry' });
    }
    
    const player = await Player.findOne({ 
      gameId: gameId,
      sessionId 
    });
    
    if (!player) {
      return res.status(404).json({ error: 'Hráč nenalezen' });
    }
    
    // ✅ Vrať JEN aktivní roli (modifier zůstane skrytý)
    res.json({
      role: player.role,
      playerId: player._id
      // modifier se NEPOSÍLÁ!
    });
  } catch (error) {
    console.error('❌ Chyba při získávání role:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all players with modifiers (ONLY FOR MODERATOR) - GET /api/game/:gameId/players-full
router.get('/:gameId/players-full', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ error: 'Neplatné ID hry' });
    }
    
    const players = await Player.find({ gameId }).sort({ createdAt: 1 });
    
    // ✅ Vrať VŠECHNO včetně modifikátorů
    res.json({
      players: players.map(p => ({
        _id: p._id,
        name: p.name,
        role: p.role,
        modifier: p.modifier, 
        alive: p.alive,
        hasVoted: p.hasVoted,
        nightAction: p.nightAction
      }))
    });
  } catch (error) {
    console.error('❌ Chyba při získávání hráčů:', error);
    res.status(500).json({ error: error.message });
  }
});


// Night action - POST /api/game/:gameId/night-action
router.post('/:gameId/night-action', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerId, targetId, action } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(gameId) || !mongoose.Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({ error: 'Neplatné ID' });
    }
    
    const game = await Game.findById(gameId);
    if (game.phase !== 'night') {
      return res.status(400).json({ error: 'Není noc' });
    }
    
    const player = await Player.findById(playerId);
    if (!player || !player.alive) {
      return res.status(400).json({ error: 'Hráč není naživu' });
    }
    
    player.nightAction = { targetId, action };
    await player.save();
    
    await GameLog.create({
      gameId,
      message: `${player.name} provedl noční akci`
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Chyba při noční akci:', error);
    res.status(500).json({ error: error.message });
  }
});

// End night - POST /api/game/:gameId/end-night
router.post('/:gameId/end-night', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ error: 'Neplatné ID hry' });
    }
    
    await processNightActions(gameId);
    
    const game = await Game.findById(gameId);
    game.phase = 'day';
    await game.save();
    
    await GameLog.create({
      gameId,
      message: `Kolo ${game.round} - DEN`
    });
    
    console.log('✅ Noc ukončena');
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Chyba při ukončení noci:', error);
    res.status(500).json({ error: error.message });
  }
});

// Vote - POST /api/game/:gameId/vote
router.post('/:gameId/vote', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerId, targetId } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(gameId) || !mongoose.Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({ error: 'Neplatné ID' });
    }
    
    const game = await Game.findById(gameId);
    if (game.phase !== 'day') {
      return res.status(400).json({ error: 'Není den' });
    }
    
    const player = await Player.findById(playerId);
    if (!player || !player.alive) {
      return res.status(400).json({ error: 'Hráč není naživu' });
    }
    
    player.hasVoted = true;
    player.voteFor = targetId;
    await player.save();
    
    await GameLog.create({
      gameId,
      message: `${player.name} hlasoval`
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Chyba při hlasování:', error);
    res.status(500).json({ error: error.message });
  }
});

// End day - POST /api/game/:gameId/end-day
router.post('/:gameId/end-day', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ error: 'Neplatné ID hry' });
    }
    
    await processVotes(gameId);
    
    const aliveMafia = await Player.countDocuments({ 
      gameId: gameId, 
      alive: true, 
      role: 'Mafián' 
    });
    
    const aliveTown = await Player.countDocuments({ 
      gameId: gameId, 
      alive: true, 
      role: { $ne: 'Mafián' } 
    });
    
    const game = await Game.findById(gameId);
    
    if (aliveMafia === 0) {
      game.phase = 'end';
      await game.save();
      
      await GameLog.create({
        gameId,
        message: '--- MĚSTO VYHRÁLO ---'
      });
      
      console.log('✅ Hra skončila - Město vyhrálo');
      return res.json({ success: true, winner: 'town' });
    }
    
    if (aliveMafia >= aliveTown) {
      game.phase = 'end';
      await game.save();
      
      await GameLog.create({
        gameId,
        message: '--- MAFIÁNI VYHRÁLI ---'
      });
      
      console.log('✅ Hra skončila - Mafiáni vyhráli');
      return res.json({ success: true, winner: 'mafia' });
    }
    
    game.round += 1;
    game.phase = 'night';
    await game.save();
    
    // Reset voting and actions
    await Player.updateMany(
      { gameId:gameId },
      {
        hasVoted: false,
        voteFor: null,
        'nightAction.targetId': null,
        'nightAction.action': null
      }
    );
    
    await GameLog.create({
      gameId,
      message: `Kolo ${game.round} - NOC`
    });
    
    console.log('✅ Den ukončen, nové kolo:', game.round);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Chyba při ukončení dne:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get game state - GET /api/game/:gameId
// THIS MUST BE LAST to not conflict with specific routes
router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ error: 'Neplatné ID hry' });
    }
    
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Hra nenalezena' });
    }
    
    const players = await Player.find({ gameId }).sort({ createdAt: 1 });
    const logs = await GameLog.find({ gameId }).sort({ createdAt: -1 }).limit(50);
    
    res.json({
      game: {
        _id: game._id,
        roomCode: game.roomCode,
        phase: game.phase,
        round: game.round,
        timers: game.timers,               
        timerState: game.timerState,  
        ip: game.ip,
        port: game.port,
        updatedAt: game.updatedAt
      },
      players: players.map(p => ({
        _id: p._id,
        sessionId: p.sessionId,
        name: p.name,
        role: p.role,
        alive: p.alive,
        hasVoted: p.hasVoted,
        voteFor: p.voteFor,
        nightAction: p.nightAction
      })),
      logs: logs.map(l => l.message).reverse()
    });
  } catch (error) {
    console.error('❌ Chyba při načítání hry:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== HELPER FUNCTIONS ====================

async function processNightActions(gameId) {
  const mafiaActions = await Player.find({
    gameId: gameId,
    alive: true,
    role: 'Mafián',
    'nightAction.targetId': { $ne: null }
  });
  
  if (mafiaActions.length > 0) {
    const targetId = mafiaActions[0].nightAction.targetId;
    
    const doctorAction = await Player.findOne({
      gameId:gameId,
      alive: true,
      role: 'Doktor',
      'nightAction.targetId': targetId
    });
    
    if (!doctorAction) {
      const victim = await Player.findById(targetId);
      if (victim) {
        victim.alive = false;
        await victim.save();
        
        await GameLog.create({
          gameId,
          message: `${victim.name} byl zabit v noci!`
        });
      }
    } else {
      await GameLog.create({
        gameId,
        message: 'Doktor zachránil někoho v noci!'
      });
    }
  }
  
  const sheriff = await Player.findOne({
    gameId: gameId,
    alive: true,
    role: 'Šerif',
    'nightAction.targetId': { $ne: null }
  });
  
  if (sheriff) {
    const target = await Player.findById(sheriff.nightAction.targetId);
    if (target) {
      await GameLog.create({
        gameId,
        message: `Šerif vyšetřil ${target.name}`
      });
    }
  }
}

async function processVotes(gameId) {
  const votes = await Player.aggregate([
    {
      $match: {
        gameId: gameId,
        alive: true,
        voteFor: { $ne: null }
      }
    },
    {
      $group: {
        _id: '$voteFor',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 1
    }
  ]);
  
  if (votes.length > 0) {
    const victimId = votes[0]._id;
    const victim = await Player.findById(victimId);
    
    if (victim) {
      victim.alive = false;
      await victim.save();
      
      await GameLog.create({
        gameId,
        message: `${victim.name} (${victim.role}) byl popraven hlasováním!`
      });
    }
  } else {
    await GameLog.create({
      gameId,
      message: 'Nikdo nebyl popraven'
    });
  }
}

module.exports = router;
