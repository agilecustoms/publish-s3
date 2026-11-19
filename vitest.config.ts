import { coverageConfigDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: process.env.CI ? undefined : 0, // 0 locally, default on CI
    coverage: {
      exclude: [
        'src/index.ts',
        ...coverageConfigDefaults.exclude
      ],
      reporter: ['text'], // other: 'html', 'clover', 'json'
      // measured on integration tests (npm run test-integration): unit tests cover only FileService
      thresholds: {
        lines: 90,
        branches: 80,
      }
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
        }
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/integration/**/*.test.ts'],
        }
      }
    ]
  }
})
