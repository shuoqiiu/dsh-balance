/**
 * dsh-balance browser half — mounts the floating balance HUD as a global
 * surface and drives it from the host's same-origin `/api/balance/*` JSON
 * endpoints: poll the host snapshot (~5 s), force refreshes, persist drag /
 * collapse / hide. The HUD is host-global (no session dimension), so it
 * mounts directly onto `document.body` via a single React root rather than a
 * session-scoped slot — on the new-conversation screen no session exists.
 * @module @linxin666/dsh-balance/client
 */

import type { ClientContext, SettingsScope, SettingsScopeSpec } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the settings-surface Context merge (ctx.settingsScope).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { BalanceStateView } from '../service.ts'
import type { BalanceDisplayConfig } from '../persist.ts'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { BalanceDock } from './BalanceDock.tsx'
import { BalanceSettingsCard, BalanceSettingsCardController, type BalanceSettings } from './BalanceSettingsCard.tsx'
import { NS, en, zh, t } from './locales.ts'

/** The host balance API as the browser sees it (same-origin JSON endpoints). */
interface BalanceHttpApi {
  state(): Promise<BalanceStateView>
  refresh(): Promise<BalanceStateView>
  setDisplay(patch: Partial<BalanceDisplayConfig>): Promise<{ ok: true; display: BalanceDisplayConfig }>
}

/** Same-origin JSON fetch helper (GET without body, POST with JSON body). */
async function balanceFetch<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, body === undefined
    ? {}
    : {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
  if (!response.ok) {
    throw new Error(`balance ${path} failed: ${response.status}`)
  }
  return (await response.json()) as T
}

/** The live host API instance (always defined; failures surface per call). */
const balanceApi: BalanceHttpApi = {
  state: () => balanceFetch('/api/balance/state'),
  refresh: () => balanceFetch('/api/balance/refresh', {}),
  setDisplay: (patch) => balanceFetch('/api/balance/set-display', patch),
}

/** Poll interval for the host snapshot, ms. */
const POLL_MS = 5_000

/** Settings namespace the balance settings card edits (the Host plugin registers it). */
const BALANCE_SETTINGS_NS = 'balance'

/** Required services. */
export const inject = ['slots', 'locale', 'connection', 'settingsScope', 'remote']

/** Re-exported for consumers that type against the injected face. */
export type { BalanceDockProps } from './BalanceDock.tsx'
export type { BalanceSettingsCardFace, BalanceSettingsCardState } from './BalanceSettingsCard.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * The child slot the Web UI plugin group declares; this card registers
     * into the group instead of the top-level `settings.plugin.item` list.
     * Spelled here with the same shape so this package can register without
     * depending on the sibling UI package.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the group card supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /**
     * Optional rc.6 compatibility binder provided by dsh-web-ui-settings;
     * absent when that group plugin is not installed, so callers fall back to
     * the official settings scope.
     */
    webUiSettings?: { bind<S>(spec: SettingsScopeSpec<S>): SettingsScope<S> }
  }
}

/**
 * Client plugin body: register dictionaries, mount the global balance HUD
 * and poll loop while the plugin is enabled, and seat the settings card in
 * the Web UI plugin group.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'balance: dictionaries')

  const binder = ctx.get('webUiSettings') ?? ctx.settingsScope
  const settingsScope = binder.bind<BalanceSettings>({ namespace: BALANCE_SETTINGS_NS })
  const enabled = (): boolean => {
    const snapshot = settingsScope.getSnapshot()
    return snapshot.status === 'ready'
      ? snapshot.value?.enabled ?? true
      : snapshot.status === 'unavailable'
  }

  // Plugin configuration card: one staged form over the `balance` settings
  // namespace, contributed to the Web UI plugin group.
  const balanceSettings = new BalanceSettingsCardController(settingsScope)
  ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
    name: 'web-ui.plugin.item',
    id: 'balance-settings',
    order: 150,
    locale: NS,
    inject: () => balanceSettings.inject(),
  }, BalanceSettingsCard))

  // The global HUD lives while the plugin is enabled; toggling the setting
  // off hides it and stops polling.
  let disposeUi: (() => void) | undefined
  const syncUi = (): void => {
    if (enabled() && disposeUi === undefined) {
      // ONE mount for the whole app, owned by this apply body. The HUD is
      // host-global (state/display are /api/balance/* endpoints with no
      // session dimension), so the slot system's per-session store scoping
      // would only reset the widget on session switches and leave it
      // stateless on the new-conversation screen.
      const container = document.createElement('div')
      container.dataset.dshBalanceRoot = ''
      document.body.appendChild(container)
      const domRoot = createRoot(container)

      let disposed = false
      let snapshot: BalanceStateView | null = null
      let refreshing = false

      const renderNow = (): void => {
        domRoot.render(createElement(BalanceDock, {
          state: snapshot,
          t,
          refreshing,
          onRefresh: () => {
            refreshing = true
            renderNow()
            balanceApi.refresh().then((next) => {
              snapshot = next
            }, () => {
              // Ignore; next poll resyncs.
            }).finally(() => {
              refreshing = false
              renderNow()
            })
          },
          onSetDisplay: (patch) => {
            balanceApi.setDisplay(patch).then((result) => {
              if (snapshot !== null) {
                snapshot = { ...snapshot, display: result.display }
              }
              renderNow()
            }, () => {
              // Ignore; next poll resyncs.
            })
          },
        }))
      }

      const pollNow = (): void => {
        balanceApi.state().then((next) => {
          if (disposed) return
          snapshot = next
          renderNow()
        }, () => {
          // Keep the last snapshot on transport errors; the next poll resyncs.
        })
      }

      const disposePoll = ctx.effect(() => {
        // Poll only while the tab is visible: the host snapshot does not
        // change while the page is hidden, so a background interval would
        // only burn RPCs.
        let timer: number | undefined
        const stop = (): void => {
          if (timer !== undefined) {
            window.clearInterval(timer)
            timer = undefined
          }
        }
        const start = (): void => {
          if (timer === undefined && document.visibilityState === 'visible') {
            timer = window.setInterval(pollNow, POLL_MS)
          }
        }
        const onVisibility = (): void => {
          if (document.visibilityState === 'visible') {
            pollNow()
            start()
          } else {
            stop()
          }
        }
        start()
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
          stop()
          document.removeEventListener('visibilitychange', onVisibility)
        }
      }, 'balance: poll')

      renderNow()
      pollNow()

      disposeUi = () => {
        disposed = true
        domRoot.unmount()
        container.remove()
        disposePoll()
        disposeUi = undefined
      }
    } else if (!enabled() && disposeUi !== undefined) {
      disposeUi()
      disposeUi = undefined
    }
  }
  settingsScope.subscribe(syncUi)
  syncUi()
}
