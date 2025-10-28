const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  
  // ✅ AKTIVNÍ ROLE (hráč vidí)
  role: {
    type: String,
    enum: ['Doktor', 'Policie', 'Vyšetřovatel', 'Pozorovatel', 'Pastičkář', 
           'Stopař', 'Občan', 'Vrah', 'Uklízeč', 'Falšovač', null],
    default: null
  },
  
  // ✅ PASIVNÍ MODIFIKÁTOR (hráč NEVIDÍ)
  modifier: {
    type: String,
    enum: ['Opilý', 'Poustevník', null],
    default: null
  },
  
  alive: {
    type: Boolean,
    default: true
  },
  hasVoted: {
    type: Boolean,
    default: false
  },
  voteFor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    default: null
  },
  nightAction: {
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player'
    },
    action: {
      type: String,
      enum: ['protect', 'block', 'investigate', 'watch', 'trap', 'track', 
             'kill', 'clean_kill', 'frame', null]
    }
  },
  
  // ✅ VÝSLEDKY AKCÍ (ukládají se zde)
  actionResults: {
    type: [String],
    default: []
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Player', PlayerSchema);
