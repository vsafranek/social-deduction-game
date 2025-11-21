// jest.config.js (root projektu)

module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'electron/game/**/*.js',
    '!electron/game/**/*.test.js'
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  verbose: true
};
