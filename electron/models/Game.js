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
  
  // Game mode: 'party' (moderator only) or 'classic' (host can also play)
  mode: {
    type: String,
    enum: ['party', 'classic'],
    default: 'party'
  },

  roleConfiguration: {
    type: Map,
    of: Number,
    default: {
      'Doctor': 1,
      'Police': 1,
      'Investigator': 1,
      'Lookout': 1,
      'Guardian': 1,
      'Tracker': 1,
      'Citizen': 1,
      'Cleaner': 0,
      'Falšovač': 0
    }
  },
  
  // Role configuration limits and settings
  roleMaxLimits: {
    type: Map,
    of: Number, // null values are stored as missing keys
    default: {}
  },
  guaranteedRoles: {
    type: [String],
    default: []
  },
  teamLimits: {
    good: { type: Number, default: 2 },
    evil: { type: Number, default: 1 },
    neutral: { type: Number, default: 0 }
  },
  
  // ✅ PASSIVE MODIFIER CONFIGURATION
  modifierConfiguration: {
    drunkChance: {
      type: Number,
      default: 0.2, // 20% chance
      min: 0,
      max: 1
    },
    shadyChance: {
      type: Number,
      default: 0.15, // 15% chance
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
