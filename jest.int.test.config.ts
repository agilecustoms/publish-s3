import type { Config } from '@jest/types';
import * as base from './jest.config';

/**
 * Jest configuration for integration tests. Main difference - longer timeout (and different source root)
 */
const config: Config.InitialOptions = {...base.default,
    testMatch: ["<rootDir>/integration-tests/**/*.test.ts"],
    testTimeout: 60_000, // default is 5000 (5 seconds) - is not enough to download the localstack image
}
export default config;
