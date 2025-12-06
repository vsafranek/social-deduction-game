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
  // Ignore tests in src/ that use ES6 modules (they need Babel)
  testPathIgnorePatterns: [
    '/node_modules/',
    '/src/'
  ],
  verbose: true
};
