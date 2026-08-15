/**
 * dsh-balance host half — mounts the balance service and its HTTP routes.
 * The browser half (the `./client` entry) renders the floating HUD and
 * drives it through the same-origin `/api/balance/*` JSON endpoints.
 * @module @linxin666/dsh-balance
 */

import { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-host-webserver'
import z from 'schemastery'
import {
  BalanceService,
  BALANCE_SETTINGS_NAMESPACE,
  DEFAULT_LOW_THRESHOLD,
  DEFAULT_POLL_MS,
  POLL_MS_MAX,
  POLL_MS_MIN,
  type BalanceConfig,
  type BalanceSettingsSection,
} from './service.ts'
import { makeBalanceRoutes } from './routes.ts'
import { DISPLAY_INSET_MAX } from './persist.ts'

export { BalanceService } from './service.ts'
export type {
  BalanceConfig,
  BalanceSettingsSection,
  BalanceStateView,
  BalanceStatus,
} from './service.ts'
export {
  BALANCE_SETTINGS_NAMESPACE,
  DEFAULT_BASE_URL,
  DEFAULT_LOW_THRESHOLD,
  DEFAULT_POLL_MS,
  DEFAULT_TIMEOUT_MS,
  POLL_MS_MAX,
  POLL_MS_MIN,
} from './service.ts'
export {
  balanceHomeDir,
  defaultBalanceDisplayConfig,
  loadBalancePersist,
  saveBalancePersist,
  DISPLAY_INSET_MAX,
} from './persist.ts'
export type { BalanceDisplayConfig, BalancePersist } from './persist.ts'
export {
  currencySymbol,
  formatAmount,
  parseAmount,
  parseBalancePayload,
} from './format.ts'
export type { ParsedBalance } from './format.ts'
export {
  BALANCE_API_PREFIX,
  makeBalanceRoutes,
} from './routes.ts'

/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export const name = 'balance'

/** Services required before the balance plugin can mount its surfaces. */
export const inject = ['webServer']

/**
 * Settings section schema: the HUD layout and poll/warning tuning the web
 * settings surface edits. The composition `base` starts as the persisted
 * balance.json values (clamped to schema bounds), so an empty user layer
 * resolves to exactly what the HUD already shows. Runtime drag/collapse
 * interactions mirror back into the settings document through the service.
 */
export const BALANCE_SETTINGS_SCHEMA = z.object({
  visible: z.boolean().default(true),
  collapsed: z.boolean().default(false),
  right: z.number().step(1).min(0).max(DISPLAY_INSET_MAX).default(24),
  bottom: z.number().step(1).min(0).max(DISPLAY_INSET_MAX).default(24),
  lowThreshold: z.number().min(0).default(DEFAULT_LOW_THRESHOLD),
  pollMs: z.number().step(1000).min(POLL_MS_MIN).max(POLL_MS_MAX).default(DEFAULT_POLL_MS),
  enabled: z.boolean().default(true),
})

/** Register the balance service and its API routes on the context. */
export function apply(ctx: Context, config: BalanceConfig = {}): void {
  const service = new BalanceService(ctx, config)

  let current: () => BalanceSettingsSection = () => base
  const base: BalanceSettingsSection = {
    visible: service.display().visible,
    collapsed: service.display().collapsed,
    right: service.display().right,
    bottom: service.display().bottom,
    lowThreshold: service.tuningView().lowThreshold,
    pollMs: service.tuningView().pollMs,
    enabled: config.enabled ?? true,
  }
  // The browser half talks to the balance plugin through same-origin JSON
  // endpoints. Routes are registered while the plugin is enabled; toggling
  // the setting off makes the balance API disappear until re-enabled.
  let disposeRoutes: (() => void) | undefined
  const syncRoutes = (): void => {
    const enabled = current().enabled ?? true
    if (disposeRoutes === undefined && enabled) {
      disposeRoutes = ctx.effect(
        () => {
          const disposers = makeBalanceRoutes(service).map((route) => ctx.webServer.register(route))
          return () => { for (const dispose of disposers) dispose() }
        },
        'balance: routes',
      )
    } else if (disposeRoutes !== undefined && !enabled) {
      disposeRoutes()
      disposeRoutes = undefined
    }
  }
  installSettingsSection(ctx, settingsNamespace(BALANCE_SETTINGS_NAMESPACE), BALANCE_SETTINGS_SCHEMA, base, {
    setSource: (source) => { current = source },
    onChange: () => {
      const section = current()
      service.applySettingsSection(section)
      syncRoutes()
    },
  })
  syncRoutes()
}
