const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  timers: {
    nightSeconds: { type: Number, default: 30 }, 
    daySeconds: { type: Number, default: 30 }
  },
  timerState: {
    phaseEndsAt: { type: Date, default: null } 
  },

  winner: {
    type: String,
    enum: ['good', 'evil', 'solo', 'custom'],
    default: null
  },
  winnerPlayerIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Player',
    default: []
  },

  phase: {
    type: String,
    enum: ['lobby', 'night', 'day', 'end'],
    default: 'lobby'
  },
  round: {
    type: Number,
    default: 0
  },
  mayor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    default: null
  },
  ip: String,
  port: Number,
  

  roleConfiguration: {
    type: Map,
    of: Number,
    default: {
      'Doctor': 1,
      'Police': 1,
      'Investigator': 1,
      'Lookout': 1,
      'Trapper': 1,
      'Tracker': 1,
      'Citizen': 1,
      'Cleaner': 0,
      'Falšovač': 0
    }
  },
  
  // ✅ KONFIGURACE PASIVNÍCH MODIFIKÁTORŮ
  modifierConfiguration: {
    drunkChance: {
      type: Number,
      default: 0.2, // 20% šance
      min: 0,
      max: 1
    },
    shadyChance: {
      type: Number,
      default: 0.15, // 15% šance
      min: 0,
      max: 1
    }
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

GameSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Game', GameSchema);
