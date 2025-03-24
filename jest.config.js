/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: [
        "**/test/unit/**/*.ts",
        "**/test/func/**/*.test.ts"
    ],
};
