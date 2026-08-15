import { describe, expect, it } from 'vitest'
import {
  currencySymbol,
  formatAmount,
  parseAmount,
  parseBalancePayload,
} from '../src/format.ts'

describe('parseAmount', () => {
  it('parses plain strings and numbers', () => {
    expect(parseAmount('110.00')).toBe(110)
    expect(parseAmount(42.5)).toBe(42.5)
    expect(parseAmount('1,234.56')).toBe(1234.56)
    expect(parseAmount(' 88 ')).toBe(88)
  })

  it('returns NaN for unusable values', () => {
    expect(parseAmount(undefined)).toBeNaN()
    expect(parseAmount('')).toBeNaN()
    expect(parseAmount('n/a')).toBeNaN()
  })
})

describe('parseBalancePayload', () => {
  it('parses the documented DeepSeek payload', () => {
    const parsed = parseBalancePayload({
      is_available: true,
      balance_infos: [{
        currency: 'CNY',
        total_balance: '110.00',
        granted_balance: '10.00',
        topped_up_balance: '100.00',
      }],
    })
    expect(parsed).toEqual({ currency: 'CNY', total: 110, granted: 10, toppedUp: 100 })
  })

  it('skips unreadable lines and picks the first usable one', () => {
    const parsed = parseBalancePayload({
      balance_infos: [
        { currency: 'CNY', total_balance: 'x' },
        { currency: 'usd', total_balance: '3.50', granted_balance: '1.00' },
      ],
    })
    expect(parsed).toEqual({ currency: 'USD', total: 3.5, granted: 1, toppedUp: NaN })
  })

  it('returns undefined for empty or malformed payloads', () => {
    expect(parseBalancePayload(undefined)).toBeUndefined()
    expect(parseBalancePayload(null)).toBeUndefined()
    expect(parseBalancePayload({})).toBeUndefined()
    expect(parseBalancePayload({ balance_infos: 'nope' })).toBeUndefined()
    expect(parseBalancePayload({ balance_infos: [] })).toBeUndefined()
  })
})

describe('currencySymbol', () => {
  it('maps common codes and falls back to the code itself', () => {
    expect(currencySymbol('CNY')).toBe('\u00a5')
    expect(currencySymbol('USD')).toBe('$')
    expect(currencySymbol('EUR')).toBe('\u20ac')
    expect(currencySymbol('XXX')).toBe('XXX ')
    expect(currencySymbol(undefined)).toBe('')
  })
})

describe('formatAmount', () => {
  it('groups thousands and keeps decimals', () => {
    expect(formatAmount(1234567.891)).toBe('1,234,567.89')
    expect(formatAmount(0.004)).toBe('0.00')
    expect(formatAmount(110)).toBe('110.00')
  })

  it('renders NaN/undefined as a dash placeholder', () => {
    expect(formatAmount(NaN)).toBe('--')
    expect(formatAmount(undefined)).toBe('--')
  })
})
