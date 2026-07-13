import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Node-side request-interception server used by tests that exercise the real
// `api` axios instance end-to-end. Hook-logic tests that only care about cache
// behavior mock `../../common/api` directly and never reach this.
export const server = setupServer(...handlers)
