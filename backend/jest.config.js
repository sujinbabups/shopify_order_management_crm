module.exports = {
  moduleFileExtensions: ['js', 'json'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.js$',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  testEnvironment: 'node',
  testTimeout: 30000,
};
