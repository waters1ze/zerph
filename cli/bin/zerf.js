#!/usr/bin/env node

import('../dist/index.js').catch((err) => {
  console.error('Failed to run Zerf CLI:', err)
  process.exit(1)
})
