import { defineConfig } from 'vitest/config'
import path from 'node:path'
import fs from 'node:fs'

// This workspace is reachable through a self-referencing filesystem junction
// (site-prog <-> "Новая папка"). Vite must use the PHYSICAL path as root,
// otherwise every import realpaths outside the root, gets externalized, and
// silently disappears from coverage.
const physicalRoot = fs.realpathSync(__dirname)

export default defineConfig({
  root: physicalRoot,
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    coverage: {
      // istanbul (not v8): the workspace junction + "(...)" in the path break
      // v8 script-to-source remapping, producing empty reports.
      provider: 'istanbul',
      reporter: ['text', 'lcov', 'html'],
      all: false,
      // Scope the gate to the audited security-critical modules. Route
      // handlers (app/api/**) are excluded from the gate because their
      // coverage depends on heavy Prisma mocking; they are covered by
      // targeted integration suites instead.
      thresholds: {
        '**/lib/backend/{auth,passwords,cron-lock,rate-limit}.ts': {
          statements: 85,
          functions: 85,
          branches: 75,
          lines: 85,
        },
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
    // The project root is reachable via a filesystem junction ("Новая папка").
    // Without this, module ids realpath outside the vite root, get treated as
    // external deps, and never appear in coverage.
    preserveSymlinks: true,
  },
})
