import { beforeEach, vi } from 'vitest'

process.env.TELEGRAM_BOT_TOKEN = '123456:TEST_FIXED_BOT_TOKEN_FOR_TESTS'
process.env.ADMIN_SECRET = 'test-fixed-admin-secret'
process.env.AUTH_PEPPER = 'test-fixed-pepper'
// OAuth flows are fail-closed without a client secret — seed one so callback
// handlers reach their business logic under test.
process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret'

beforeEach(() => {
  vi.restoreAllMocks()
})
