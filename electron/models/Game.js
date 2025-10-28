const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  timers: {
    nightSeconds: { type: Number, default: 90 }, // konfigurovatelné v lobby
    daySeconds: { type: Number, default: 150 }
  },
  timerState: {
    phaseEndsAt: { type: Date, default: null } // kdy fáze skončí (server time)
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
  ip: String,
  port: Number,
  
  // ✅ KONFIGURACE AKTIVNÍCH ROLÍ
  roleConfiguration: {
    type: Map,
    of: Number,
    default: {
      'Doktor': 1,
      'Policie': 1,
      'Vyšetřovatel': 1,
      'Pozorovatel': 1,
      'Pastičkář': 0,
      'Stopař': 1,
      'Občan': 1,
      'Vrah': 2,
      'Uklízeč': 0,
      'Falšovač': 0
    }
  },
  
  // ✅ KONFIGURACE PASIVNÍCH MODIFIKÁTORŮ
  modifierConfiguration: {
    opilýChance: {
      type: Number,
      default: 0.2, // 20% šance
      min: 0,
      max: 1
    },
    poustevníkChance: {
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
