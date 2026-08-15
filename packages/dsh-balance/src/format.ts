/**
 * Pure balance parsing/formatting helpers — shared by the host poller and
 * the client widget (the client bundle inlines its own copy; no shared
 * runtime identity is involved, only plain functions).
 * @module @linxin666/dsh-balance/format
 */

/** One parsed balance line. */
export interface ParsedBalance {
  /** Uppercase currency code, e.g. `CNY`. */
  currency: string
  /** Total available balance. */
  total: number
  /** Granted (promotional) balance. */
  granted: number
  /** Topped-up (paid) balance. */
  toppedUp: number
}

/**
 * Parse a balance amount. Upstream amounts are strings like `"110.00"` (or
 * with thousands separators); tolerates numbers and blank values. Returns
 * NaN when the value cannot be read as a number.
 * @param text - the raw amount.
 * @returns the numeric amount, or NaN.
 */
export function parseAmount(text: string | number | undefined): number {
  if (text === undefined || text === null) return NaN
  if (typeof text === 'number') return Number.isFinite(text) ? text : NaN
  const cleaned = text.replace(/[,\s\u00a0]/g, '').trim()
  if (cleaned === '') return NaN
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : NaN
}

/**
 * Parse the DeepSeek `/user/balance` payload (GET https://api.deepseek.com/user/balance).
 * Prefers the first `balance_infos` entry carrying a recognizable total.
 * @param payload - the parsed JSON body.
 * @returns the parsed balance, or undefined when the payload has no usable line.
 */
export function parseBalancePayload(payload: unknown): ParsedBalance | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const body = payload as { balance_infos?: unknown }
  if (!Array.isArray(body.balance_infos)) return undefined
  for (const entry of body.balance_infos) {
    if (typeof entry !== 'object' || entry === null) continue
    const info = entry as {
      currency?: unknown
      total_balance?: unknown
      granted_balance?: unknown
      topped_up_balance?: unknown
    }
    const total = parseAmount(
      typeof info.total_balance === 'string' || typeof info.total_balance === 'number'
        ? info.total_balance
        : undefined,
    )
    if (!Number.isFinite(total)) continue
    const currency = typeof info.currency === 'string' && info.currency.trim() !== ''
      ? info.currency.trim().toUpperCase()
      : 'CNY'
    return {
      currency,
      total,
      granted: parseAmount(
        typeof info.granted_balance === 'string' || typeof info.granted_balance === 'number'
          ? info.granted_balance
          : undefined,
      ),
      toppedUp: parseAmount(
        typeof info.topped_up_balance === 'string' || typeof info.topped_up_balance === 'number'
          ? info.topped_up_balance
          : undefined,
      ),
    }
  }
  return undefined
}

/** Currency code to display symbol (falls back to the code itself). */
export function currencySymbol(currency: string | undefined): string {
  switch ((currency ?? '').toUpperCase()) {
    case 'CNY':
    case 'RMB':
      return '\u00a5'
    case 'USD':
      return '$'
    case 'EUR':
      return '\u20ac'
    case 'GBP':
      return '\u00a3'
    case 'JPY':
      return '\u00a5'
    case 'HKD':
      return 'HK$'
    default:
      return currency !== undefined && currency.trim() !== '' ? `${currency.trim()} ` : ''
  }
}

/**
 * Format an amount for display with thousands separators and `digits`
 * decimals; NaN renders as `--` so a bad upstream line never shows garbage.
 * @param value - the amount.
 * @param digits - decimal places.
 * @returns the formatted amount.
 */
export function formatAmount(value: number | undefined, digits: number = 2): string {
  if (value === undefined || !Number.isFinite(value)) return '--'
  const fixed = Math.abs(value) < 0.5 * 10 ** -digits && value !== 0
    ? (0).toFixed(digits)
    : value.toFixed(digits)
  const [int, frac] = fixed.split('.')
  const grouped = (int ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac === undefined ? grouped : `${grouped}.${frac}`
}
