/**
 * Balance host service — the poller behind the floating HUD. Resolves the
 * DeepSeek API key through the optional credential seam (`ctx.credentials`,
 * same seam the official llm-deepseek adapter reads), fetches
 * `GET {baseUrl}/user/balance` on a poll cadence plus on demand, and keeps a
 * cached snapshot the `/api/balance/state` route serves. Also owns the
 * persisted display config (drag / collapse / hide).
 * @module @linxin666/dsh-balance/service
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { credentialRef, type CredentialProvider } from '@deepseek-ai/dsh-credentials'
import { parseBalancePayload, type ParsedBalance } from './format.ts'
import {
  balanceHomeDir,
  loadBalancePersist,
  saveBalancePersist,
  DISPLAY_INSET_MAX,
  type BalanceDisplayConfig,
  type BalancePersist,
} from './persist.ts'

/** Upstream defaults (public API; $DEEPSEEK_BASE_URL overrides in the dsh env). */
export const DEFAULT_BASE_URL = 'https://api.deepseek.com'
/** Default upstream poll cadence, ms. */
export const DEFAULT_POLL_MS = 60_000
/** Poll cadence bounds (settings schema). */
export const POLL_MS_MIN = 10_000
export const POLL_MS_MAX = 600_000
/** Default per-request timeout, ms. */
export const DEFAULT_TIMEOUT_MS = 10_000
/** Default low-balance warning threshold. */
export const DEFAULT_LOW_THRESHOLD = 5

/** Plugin configuration (composition layer). */
export interface BalanceConfig {
  /** Credential reference holding the DeepSeek API key (default `DEEPSEEK_API_KEY`). */
  apiKeyEnv?: string
  /** API base URL (default `https://api.deepseek.com`). */
  baseUrl?: string
  /** Upstream poll cadence, ms. */
  pollMs?: number
  /** Per-request timeout, ms. */
  timeoutMs?: number
  /** Below this total the HUD switches to the low-balance warning look. */
  lowThreshold?: number
  /** Master switch for the plugin (browser half + host routes). */
  enabled?: boolean
  /** Persistence directory override (defaults to $DSH_HOME). */
  persistDir?: string
}

/**
 * The balance settings-namespace section: HUD layout plus the poll/warning
 * tuning the web settings surface edits. `right`/`bottom` are also updated
 * by drag interactions, which keep the settings document in sync through the
 * service (see syncSettingsFromDisplay).
 */
export interface BalanceSettingsSection {
  /** Master switch. */
  visible: boolean
  /** Collapse to the compact pill. */
  collapsed: boolean
  /** Horizontal inset from the viewport right edge, px. */
  right: number
  /** Vertical inset from the viewport bottom edge, px. */
  bottom: number
  /** Low-balance warning threshold. */
  lowThreshold: number
  /** Upstream poll cadence, ms. */
  pollMs: number
  /** Master switch for the plugin (browser half + host routes). */
  enabled?: boolean
}

/** Settings namespace of the balance capability. Spelled here rather than imported: the browser half spells the same value. */
export const BALANCE_SETTINGS_NAMESPACE = 'balance'

/** Fetch state the HUD renders. */
export type BalanceStatus = 'loading' | 'ok' | 'error' | 'unconfigured'

/** Snapshot returned by the `/api/balance/state` route. */
export interface BalanceStateView {
  status: BalanceStatus
  /** Currency code of the parsed line. */
  currency?: string
  /** Total available balance. */
  total?: number
  /** Granted (promotional) balance. */
  granted?: number
  /** Topped-up (paid) balance. */
  toppedUp?: number
  /** Upstream `is_available` flag. */
  isAvailable?: boolean
  /** Epoch ms of the last successful fetch. */
  checkedAt?: number
  /** True while the last successful fetch is older than the poll cadence. */
  stale?: boolean
  /** Last failure detail (kept alongside a stale-but-good snapshot). */
  error?: string
  /** Whether the total is below the warning threshold. */
  low: boolean
  /** The threshold the `low` flag uses. */
  lowThreshold: number
  /** The poll cadence the host polls with. */
  pollMs: number
  /** Display configuration. */
  display: BalanceDisplayConfig
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    balance: BalanceService
  }
}

/** Resolved tuning (config defaults + runtime settings section). */
interface Tuning {
  baseUrl: string
  timeoutMs: number
  pollMs: number
  lowThreshold: number
}

/**
 * Cordis service exposing the balance RPC domain. Lazy: nothing is fetched
 * until the poll timer fires or a route asks; the key is resolved per fetch
 * so a changed credential reaches the next request without a restart.
 */
export class BalanceService extends Service {
  static inject: string[] = []

  private readonly apiKeyEnv: string
  private readonly persistDir: string
  private tuning: Tuning
  private persist: BalancePersist
  private enabled: boolean
  private cached: BalanceStateView | undefined
  private lastFetchedAt = 0
  private lastError: { status: 'error' | 'unconfigured'; message: string } | undefined
  private inflight: Promise<void> | null = null
  private timer: ReturnType<typeof setInterval> | undefined

  constructor(ctx: Context, config: BalanceConfig = {}) {
    super(ctx, 'balance')
    this.apiKeyEnv = config.apiKeyEnv?.trim() || 'DEEPSEEK_API_KEY'
    this.persistDir = config.persistDir ?? balanceHomeDir()
    this.tuning = {
      baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      pollMs: Math.min(POLL_MS_MAX, Math.max(POLL_MS_MIN, config.pollMs ?? DEFAULT_POLL_MS)),
      lowThreshold: Math.max(0, config.lowThreshold ?? DEFAULT_LOW_THRESHOLD),
    }
    this.persist = loadBalancePersist(this.persistDir)
    this.enabled = config.enabled ?? true
    this.syncPolling()
  }

  /** Whether the balance service consumes upstream requests while enabled. */
  isEnabled(): boolean {
    return this.enabled
  }

  /** Current persisted display config (read-only view). */
  display(): BalanceDisplayConfig {
    return { ...this.persist.display }
  }

  /** Start or stop the poll timer. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.syncPolling()
  }

  /** Current effective tuning (read-only view). */
  tuningView(): Pick<Tuning, 'pollMs' | 'lowThreshold'> {
    return { pollMs: this.tuning.pollMs, lowThreshold: this.tuning.lowThreshold }
  }

  /**
   * RPC: current state snapshot. Refreshes upstream when the cache is older
   * than the poll cadence (first call fetches immediately); a concurrent
   * refresh is joined instead of duplicated.
   */
  async state(): Promise<BalanceStateView> {
    await this.refresh(false)
    return this.view()
  }

  /** RPC: force an upstream refresh, bypassing the cache TTL. */
  async refreshNow(): Promise<BalanceStateView> {
    await this.refresh(true)
    return this.view()
  }

  /** RPC: update display config (position / collapse / visibility). */
  async setDisplay(patch: Partial<BalanceDisplayConfig>): Promise<{ ok: true; display: BalanceDisplayConfig }> {
    const next = { ...this.persist.display, ...patch }
    next.right = Math.round(Math.min(DISPLAY_INSET_MAX, Math.max(0, next.right)))
    next.bottom = Math.round(Math.min(DISPLAY_INSET_MAX, Math.max(0, next.bottom)))
    this.persist = { ...this.persist, display: next }
    this.flush()
    this.syncSettingsFromDisplay()
    return { ok: true, display: { ...next } }
  }

  /**
   * Apply a committed settings section: display fields, warning threshold,
   * poll cadence, and the master switch. Values are clamped exactly like
   * setDisplay so both write paths converge.
   * @param section - the resolved settings section.
   */
  applySettingsSection(section: BalanceSettingsSection): void {
    const next = { ...this.persist.display }
    next.visible = section.visible && (section.enabled ?? true)
    next.collapsed = section.collapsed
    next.right = Math.round(Math.min(DISPLAY_INSET_MAX, Math.max(0, section.right)))
    next.bottom = Math.round(Math.min(DISPLAY_INSET_MAX, Math.max(0, section.bottom)))
    this.persist = { ...this.persist, display: next }
    this.tuning = {
      ...this.tuning,
      lowThreshold: Math.max(0, section.lowThreshold),
      pollMs: Math.min(POLL_MS_MAX, Math.max(POLL_MS_MIN, Math.round(section.pollMs))),
    }
    this.enabled = section.enabled ?? true
    this.flush()
    this.syncPolling()
  }

  /** Reschedule (or stop) the poll timer to match `enabled` + pollMs. */
  private syncPolling(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer)
      this.timer = undefined
    }
    if (!this.enabled) return
    this.timer = setInterval(() => {
      void this.refresh(false).catch(() => {
        // refresh never rejects; guard belt for safety.
      })
    }, this.tuning.pollMs)
    // Never hold the host process open just for the balance poller.
    this.timer.unref?.()
  }

  /** TTL-gated refresh with in-flight dedup. Never rejects. */
  private async refresh(force: boolean): Promise<void> {
    const now = Date.now()
    if (!force && this.lastFetchedAt > 0 && now - this.lastFetchedAt < this.tuning.pollMs) return
    if (this.inflight !== null) {
      await this.inflight
      return
    }
    this.inflight = this.doFetch().finally(() => {
      this.inflight = null
    })
    await this.inflight
  }

  /** One upstream fetch: resolve key, call /user/balance, parse, cache. */
  private async doFetch(): Promise<void> {
    let apiKey: string | undefined
    try {
      apiKey = await this.resolveApiKey()
    } catch (cause) {
      this.lastError = {
        status: 'error',
        message: `credential resolution failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      }
      return
    }
    if (apiKey === undefined) {
      this.lastError = {
        status: 'unconfigured',
        message: `no API key resolved for credential ref "${this.apiKeyEnv}"`,
      }
      return
    }
    const url = `${this.tuning.baseUrl}/user/balance`
    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(this.tuning.timeoutMs),
      })
    } catch (cause) {
      this.lastError = {
        status: 'error',
        message: cause instanceof Error && cause.name === 'TimeoutError'
          ? `balance fetch timed out after ${this.tuning.timeoutMs} ms`
          : 'balance fetch transport error',
      }
      return
    }
    if (!response.ok) {
      this.lastError = {
        status: 'error',
        message: response.status === 401
          ? 'API key rejected (HTTP 401)'
          : `balance endpoint answered HTTP ${response.status}`,
      }
      return
    }
    let parsed: ParsedBalance | undefined
    try {
      parsed = parseBalancePayload(await response.json())
    } catch {
      parsed = undefined
    }
    if (parsed === undefined) {
      this.lastError = { status: 'error', message: 'balance endpoint returned an unreadable payload' }
      return
    }
    this.cached = {
      status: 'ok',
      currency: parsed.currency,
      total: parsed.total,
      granted: parsed.granted,
      toppedUp: parsed.toppedUp,
      isAvailable: true,
      checkedAt: Date.now(),
      stale: false,
      low: parsed.total < this.tuning.lowThreshold,
      lowThreshold: this.tuning.lowThreshold,
      pollMs: this.tuning.pollMs,
      display: { ...this.persist.display },
    }
    this.lastError = undefined
    this.lastFetchedAt = Date.now()
  }

  /** Resolve the API key: credential seam first, then the process env. */
  private async resolveApiKey(): Promise<string | undefined> {
    const credentials = this.ctx.get('credentials', false) as CredentialProvider | undefined
    if (credentials !== undefined) {
      const resolved = await credentials.resolve(credentialRef(this.apiKeyEnv))
      if (resolved !== undefined && resolved.value.trim() !== '') return resolved.value
    }
    const env = process.env[this.apiKeyEnv]
    if (env !== undefined && env.trim() !== '') return env
    return undefined
  }

  /** Render the current snapshot (cached values + latest error/staleness). */
  private view(): BalanceStateView {
    const display = { ...this.persist.display }
    if (this.cached !== undefined) {
      return {
        ...this.cached,
        stale: this.lastFetchedAt > 0 && Date.now() - this.lastFetchedAt >= this.tuning.pollMs,
        low: this.cached.total !== undefined && this.cached.total < this.tuning.lowThreshold,
        lowThreshold: this.tuning.lowThreshold,
        pollMs: this.tuning.pollMs,
        display,
        ...(this.lastError === undefined ? {} : { error: this.lastError.message }),
      }
    }
    const last = this.lastError
    return {
      status: last?.status ?? 'loading',
      low: false,
      lowThreshold: this.tuning.lowThreshold,
      pollMs: this.tuning.pollMs,
      display,
      ...(last === undefined ? {} : { error: last.message }),
    }
  }

  /** Mirror the persisted display config into the settings document (best-effort). */
  private syncSettingsFromDisplay(): void {
    const settings = this.ctx.get('settings', false) as { update(ns: string, patch: object): Promise<void> } | undefined
    if (settings === undefined) return
    void settings.update(BALANCE_SETTINGS_NAMESPACE, {
      visible: this.persist.display.visible,
      collapsed: this.persist.display.collapsed,
      right: this.persist.display.right,
      bottom: this.persist.display.bottom,
    }).catch(() => {
      // A settings write failure must not break the HUD's own persistence.
    })
  }

  private flush(): void {
    try {
      saveBalancePersist(this.persist, this.persistDir)
    } catch {
      // Persistence is best-effort; the in-memory state keeps working.
    }
  }
}
