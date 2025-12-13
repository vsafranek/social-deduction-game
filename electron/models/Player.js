const mongoose = require('mongoose');

const VictoryConditionsSchema = new mongoose.Schema({
  canWinWithTeams: { type: [String], default: [] },
  soloWin: { type: Boolean, default: false },
  customRules: { type: [mongoose.Schema.Types.Mixed], default: [] }
}, { _id: false });

const EffectSchema = new mongoose.Schema({
  type: { type: String, required: true },
  source: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
  addedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

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
  role: {
    type: String,
    enum: ['Doctor', 'Jailer', 'Investigator', 'Coroner', 'Lookout', 'Guardian', 'Tracker',
      'Hunter', 'Citizen', 'Cleaner', 'Accuser', 'Consigliere',
      'SerialKiller', 'Infected', 'Jester', 'Witch', null],
    default: null
  },
  modifier: {
    type: String,
    enum: ['Drunk', 'Shady', 'Paranoid', 'Insomniac', 'Innocent', 'Sweetheart', null],
    default: null
  },
  effects: { type: [EffectSchema], default: [] },
  affiliations: {
    type: [String],
    default: []
  },
  victoryConditions: {
    type: VictoryConditionsSchema,
    default: () => ({})
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
      enum: ['protect', 'block', 'investigate', 'autopsy', 'watch', 'guard', 'track',
        'kill', 'clean_kill', 'clean_role', 'janitor_clean', 'frame',
        'hunter_kill', 'consig_investigate', 'infect', 'witch_control', null]
    },
    puppetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null
    },
    results: {
      type: [String],
      default: []
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  roleData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  roleHidden: {
    type: Boolean,
    default: false
  },
  voteWeight: {
    type: Number,
    default: 1
  },
  avatar: {
    type: String,
    default: null
  }
});

module.exports = mongoose.model('Player', PlayerSchema);
