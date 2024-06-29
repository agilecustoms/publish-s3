import type { Config } from '@jest/types';

/**
 * Jest configuration to be used ONLY by IDE, it is not used in package.json
 */
const config: Config.InitialOptions = {
    preset: 'ts-jest',
    testEnvironment: 'node',

    roots: ["<rootDir>"],
    modulePaths: ["./"],
    moduleNameMapper: {
        "^/(.*)$": "<rootDir>/src/$1",
    },
}
export default config;
