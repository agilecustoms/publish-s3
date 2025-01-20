import {coverageConfigDefaults, defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'src/index.ts',
        ...coverageConfigDefaults.exclude
      ],
      reporter: ['text'], // other: 'html', 'clover', 'json'
      thresholds: {
        lines: 91,
        branches: 87,
      }
    }
  }
})
