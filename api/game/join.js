// api/game/join.js - Vercel serverless function for joining a game
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomCode, name, sessionId } = req.body || {};

    if (!roomCode || !name || !sessionId) {
      return res.status(400).json({ error: 'Missing required fields: roomCode, name, sessionId' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find game by room code
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('room_code', roomCode)
      .maybeSingle();

    if (gameError && gameError.code !== 'PGRST116') {
      console.error('Error finding game:', gameError);
      return res.status(500).json({ error: gameError.message });
    }

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Find existing player by game and session
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', game.id)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (playerError && playerError.code !== 'PGRST116') {
      console.error('Error finding player:', playerError);
      return res.status(500).json({ error: playerError.message });
    }

    let finalPlayer = player;

    if (!player) {
      // New player - assign avatar and create player
      // Get all existing players to find available avatars
      const { data: existingPlayers } = await supabase
        .from('players')
        .select('avatar')
        .eq('game_id', game.id)
        .not('avatar', 'is', null);

      const usedAvatars = new Set((existingPlayers || []).map(p => p.avatar).filter(Boolean));
      
      // List of available avatars
      const allAvatars = [
        '/avatars/badger.jpg',
        '/avatars/beaver.jpg',
        '/avatars/hedgehog.jpg',
        '/avatars/horse.jpg',
        '/avatars/meerkat.jpg',
        '/avatars/parrot.jpg',
        '/avatars/penguin.jpg',
        '/avatars/rabbit.jpg',
        '/avatars/raccoon.jpg',
        '/avatars/rat.jpg',
        '/avatars/snake.jpg',
        '/avatars/squirrel.jpg'
      ];

      const freeAvatars = allAvatars.filter(avatar => !usedAvatars.has(avatar));
      const avatar = freeAvatars.length > 0 
        ? freeAvatars[Math.floor(Math.random() * freeAvatars.length)]
        : allAvatars[Math.floor(Math.random() * allAvatars.length)];

      // Create new player
      const { data: newPlayer, error: createError } = await supabase
        .from('players')
        .insert({
          id: uuidv4(),
          game_id: game.id,
          session_id: sessionId,
          name: name,
          role: null,
          avatar: avatar
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating player:', createError);
        return res.status(500).json({ error: createError.message });
      }

      if (!newPlayer || !newPlayer.id) {
        return res.status(500).json({ error: 'Failed to create player' });
      }

      // Create game log
      await supabase
        .from('game_logs')
        .insert({
          game_id: game.id,
          message: `${name} joined.`
        });

      finalPlayer = newPlayer;
    } else {
      // Existing player - assign avatar if missing
      if (!player.avatar || !player.avatar.trim()) {
        const { data: existingPlayers } = await supabase
          .from('players')
          .select('avatar')
          .eq('game_id', game.id)
          .not('avatar', 'is', null);

        const usedAvatars = new Set((existingPlayers || []).map(p => p.avatar).filter(Boolean));
        const allAvatars = [
          '/avatars/badger.jpg',
          '/avatars/beaver.jpg',
          '/avatars/hedgehog.jpg',
          '/avatars/horse.jpg',
          '/avatars/meerkat.jpg',
          '/avatars/parrot.jpg',
          '/avatars/penguin.jpg',
          '/avatars/rabbit.jpg',
          '/avatars/raccoon.jpg',
          '/avatars/rat.jpg',
          '/avatars/snake.jpg',
          '/avatars/squirrel.jpg'
        ];

        const freeAvatars = allAvatars.filter(avatar => !usedAvatars.has(avatar));
        const avatar = freeAvatars.length > 0 
          ? freeAvatars[Math.floor(Math.random() * freeAvatars.length)]
          : allAvatars[Math.floor(Math.random() * allAvatars.length)];

        const { data: updatedPlayer, error: updateError } = await supabase
          .from('players')
          .update({ avatar })
          .eq('id', player.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating player avatar:', updateError);
        } else {
          finalPlayer = updatedPlayer;
        }
      }
    }

    if (!game?.id || !finalPlayer?.id) {
      return res.status(500).json({ error: 'Failed to create/get player' });
    }

    return res.status(200).json({
      success: true,
      gameId: game.id,
      playerId: finalPlayer.id
    });

  } catch (error) {
    console.error('Join error:', error);
    return res.status(500).json({ error: error.message });
  }
};