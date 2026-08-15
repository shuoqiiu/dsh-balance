import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  defaultBalanceDisplayConfig,
  DISPLAY_INSET_MAX,
  loadBalancePersist,
  saveBalancePersist,
} from '../src/persist.ts'

/** One temp dir per suite, cleaned up after. */
function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'dsh-balance-persist-'))
}

describe('loadBalancePersist', () => {
  it('falls back to defaults when no file exists', () => {
    const dir = tempDir()
    try {
      const persist = loadBalancePersist(dir)
      expect(persist.display).toEqual(defaultBalanceDisplayConfig)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('falls back to defaults on a corrupt file', () => {
    const dir = tempDir()
    try {
      writeFileSync(join(dir, 'balance.json'), '{not json', 'utf8')
      const persist = loadBalancePersist(dir)
      expect(persist.display).toEqual(defaultBalanceDisplayConfig)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('round-trips a save/load and clamps out-of-range insets', () => {
    const dir = tempDir()
    try {
      saveBalancePersist({
        display: { visible: false, collapsed: true, right: 321, bottom: 45.6 },
      }, dir)
      const persist = loadBalancePersist(dir)
      expect(persist.display).toEqual({ visible: false, collapsed: true, right: 321, bottom: 46 })

      saveBalancePersist({
        display: { visible: true, collapsed: false, right: -5, bottom: DISPLAY_INSET_MAX + 900 },
      }, dir)
      const clamped = loadBalancePersist(dir)
      expect(clamped.display.right).toBe(0)
      expect(clamped.display.bottom).toBe(DISPLAY_INSET_MAX)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('defaults only the missing fields, not the whole record', () => {
    const dir = tempDir()
    try {
      writeFileSync(join(dir, 'balance.json'), JSON.stringify({
        display: { right: 777 },
      }), 'utf8')
      const persist = loadBalancePersist(dir)
      expect(persist.display.right).toBe(777)
      expect(persist.display.visible).toBe(defaultBalanceDisplayConfig.visible)
      expect(persist.display.collapsed).toBe(defaultBalanceDisplayConfig.collapsed)
      expect(persist.display.bottom).toBe(defaultBalanceDisplayConfig.bottom)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
