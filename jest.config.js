/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/i18n/**',
  ],
  coverageDirectory: 'coverage',
  testPathIgnorePatterns: ['/node_modules/', '/tests/integration/'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true,
};
