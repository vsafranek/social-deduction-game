// jest.config.js (root projektu)

module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'electron/game/**/*.js',
    '!electron/game/**/*.test.js'
  ],
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  // Ignore tests in src/ that use ES6 modules (they need Babel)
  // Optionally skip integration tests if SKIP_INTEGRATION_TESTS is set
  testPathIgnorePatterns: [
    '/node_modules/',
    '/src/',
    ...(process.env.SKIP_INTEGRATION_TESTS === 'true' ? ['/__tests__/.*integration.*\\.test\\.js$'] : [])
  ],
  // Timeout settings to prevent hanging
  testTimeout: 10000, // 10 seconds per test
  // Run tests serially to avoid database connection issues
  maxWorkers: 1,
  verbose: true
};
