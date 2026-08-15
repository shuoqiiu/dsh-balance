/**
 * Balance display persistence — a tiny JSON store for the HUD layout
 * (visible / collapsed / right / bottom), written under $DSH_HOME (defaults
 * to ~/.dsh) as `balance.json`. One file, atomic rename write, tolerant read
 * (corrupt file falls back to defaults). Mirrors the dsh-pet persist pattern.
 * @module @linxin666/dsh-balance/persist
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

/** Display configuration the user can tweak (drag + collapse + hide). */
export interface BalanceDisplayConfig {
  /** Master switch: the HUD exists at all (hidden state keeps a summon dot). */
  visible: boolean
  /** Collapsed into the compact pill instead of the full HUD panel. */
  collapsed: boolean
  /** Horizontal inset from the viewport right edge, px. */
  right: number
  /** Vertical inset from the viewport bottom edge, px. */
  bottom: number
}

export const defaultBalanceDisplayConfig: BalanceDisplayConfig = {
  visible: true,
  collapsed: false,
  right: 24,
  bottom: 24,
}

/** Display value bound (shared by load-time validation and setDisplay). */
export const DISPLAY_INSET_MAX = 10_000

/** Everything persisted for the balance HUD. */
export interface BalancePersist {
  display: BalanceDisplayConfig
}

/** Resolve the persistence directory ($DSH_HOME or ~/.dsh). */
export function balanceHomeDir(): string {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

/** Numeric field guard: finite numbers only, else the fallback. */
function finiteNum(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Clamp one inset into [0, max]. */
function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, value))
}

/** Load persisted state; missing or corrupt files fall back to defaults. */
export function loadBalancePersist(dir: string = balanceHomeDir()): BalancePersist {
  try {
    const raw = readFileSync(join(dir, 'balance.json'), 'utf8')
    const parsed = JSON.parse(raw) as { display?: Partial<BalanceDisplayConfig> }
    const base = defaultBalanceDisplayConfig
    const rawDisplay = parsed.display ?? {}
    const display: BalanceDisplayConfig = {
      visible: typeof rawDisplay.visible === 'boolean' ? rawDisplay.visible : base.visible,
      collapsed: typeof rawDisplay.collapsed === 'boolean' ? rawDisplay.collapsed : base.collapsed,
      // Drag positions are clamped but not integral, so round at the
      // persistence boundary (the settings schema requires whole pixels).
      right: Math.round(clamp(finiteNum(rawDisplay.right, base.right), DISPLAY_INSET_MAX)),
      bottom: Math.round(clamp(finiteNum(rawDisplay.bottom, base.bottom), DISPLAY_INSET_MAX)),
    }
    return { display }
  } catch {
    return { display: { ...defaultBalanceDisplayConfig } }
  }
}

/** Atomically persist state (write temp + rename). */
export function saveBalancePersist(data: BalancePersist, dir: string = balanceHomeDir()): void {
  mkdirSync(dir, { recursive: true })
  const target = join(dir, 'balance.json')
  const tmp = `${target}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  renameSync(tmp, target)
}
