/**
 * Package invariants — cheap structural checks run at import time on the
 * host side. Mirrors the pattern used by other dsh plugin packages.
 * @module @linxin666/dsh-balance/invariant
 */

import {
  DEFAULT_BASE_URL,
  DEFAULT_LOW_THRESHOLD,
  DEFAULT_POLL_MS,
  DEFAULT_TIMEOUT_MS,
  POLL_MS_MAX,
  POLL_MS_MIN,
} from './service.ts'
import { DISPLAY_INSET_MAX, defaultBalanceDisplayConfig } from './persist.ts'

/** Assert a condition; throws a descriptive Error when violated. */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[dsh-balance] ${message}`)
  }
}

/** Run every package invariant once; throws on the first violation. */
export function runBalanceInvariants(): void {
  invariant(POLL_MS_MIN > 0 && POLL_MS_MIN < POLL_MS_MAX, 'poll cadence bounds are incoherent')
  invariant(DEFAULT_POLL_MS >= POLL_MS_MIN && DEFAULT_POLL_MS <= POLL_MS_MAX,
    'default poll cadence is outside its bounds')
  invariant(DEFAULT_TIMEOUT_MS > 0, 'timeout must be positive')
  invariant(DEFAULT_LOW_THRESHOLD >= 0, 'low threshold must not be negative')
  invariant(/^https?:\/\//.test(DEFAULT_BASE_URL), 'base URL must be absolute http(s)')
  invariant(
    defaultBalanceDisplayConfig.right >= 0 && defaultBalanceDisplayConfig.right <= DISPLAY_INSET_MAX
    && defaultBalanceDisplayConfig.bottom >= 0 && defaultBalanceDisplayConfig.bottom <= DISPLAY_INSET_MAX,
    'default display insets are outside their bounds',
  )
}

// Run once on import (host half only; cheap and side-effect free).
runBalanceInvariants()
