/** @type {import('jest').Config} */
module.exports = {
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "../coverage",
  moduleFileExtensions: ["js", "json", "ts"],
  moduleNameMapper: {
    "^jose$": "<rootDir>/__mocks__/jose.cjs",
    "^jose/(.*)$": "<rootDir>/__mocks__/jose.cjs",
  },
  rootDir: "src",
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
  transformIgnorePatterns: ["/node_modules/(?!(jose)/)"],
};
