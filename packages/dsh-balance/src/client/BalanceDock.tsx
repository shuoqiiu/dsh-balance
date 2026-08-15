/**
 * The balance HUD component — the browser half's centerpiece. Renders a
 * fixed-position floating panel (React portal onto document.body) in three
 * forms: the full HUD panel, the compact pill, and (while hidden) a small
 * summon dot. Drag repositions the panel and persists through the host's
 * set-display endpoint; a client-side sparkline keeps the last few totals
 * so "realtime" is visible at a glance.
 * @module @linxin666/dsh-balance/client/BalanceDock
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { BalanceStateView } from '../service.ts'
import type { BalanceDisplayConfig } from '../persist.ts'
import { currencySymbol, formatAmount } from '../format.ts'
import styles from './balance.module.css'

/** Sparkline capacity (recent totals kept in client memory). */
const SPARK_CAP = 48

/** Props injected by the mount in client/index.ts. */
export interface BalanceDockProps {
  /** Latest host snapshot; null while the first poll is in flight. */
  state: BalanceStateView | null
  /** Locale translate function (namespace-bound). */
  t: (key: string, params?: Record<string, unknown>) => string
  /** Force an upstream refresh. */
  onRefresh: () => void
  /** Persist a display change (drag / collapse / hide). */
  onSetDisplay: (patch: Partial<BalanceDisplayConfig>) => void
  /** True while a manual refresh is crossing the wire (spins the icon). */
  refreshing: boolean
}

/** Clamp a drag offset inside the viewport with a margin. */
function clampOffset(value: number, max: number): number {
  return Math.max(0, Math.min(max, value))
}

/** Two-digit clock field. */
function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** HH:MM:SS from an epoch-ms timestamp. */
function clockOf(epochMs: number): string {
  const date = new Date(epochMs)
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

/** One sparkline history point. */
interface SparkPoint {
  /** Epoch ms of the sample. */
  t: number
  /** Total balance at that sample. */
  v: number
}

/** Map history onto an SVG polyline + area path (viewBox 0 0 100 28). */
function sparkPaths(history: SparkPoint[]): { line: string; area: string; last: { x: number; y: number } | null } {
  if (history.length === 0) return { line: '', area: '', last: null }
  const values = history.map((point) => point.v)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const xOf = (index: number): number => history.length === 1
    ? 50
    : (index / (history.length - 1)) * 100
  const yOf = (value: number): number => span <= 0
    ? 14
    : 26 - ((value - min) / span) * 20
  const coords = history.map((point, index) => `${xOf(index).toFixed(2)},${yOf(point.v).toFixed(2)}`)
  const line = `M${coords.join(' L')}`
  const area = `${line} L${xOf(history.length - 1).toFixed(2)},28 L${xOf(0).toFixed(2)},28 Z`
  const lastIndex = history.length - 1
  return { line, area, last: { x: xOf(lastIndex), y: yOf(history[lastIndex]!.v) } }
}

/** Status-derived HUD accent class. */
function hudTone(state: BalanceStateView | null): string {
  if (state === null) return styles.hudWait
  if (state.status === 'ok') return state.low ? styles.hudLow : ''
  if (state.status === 'error') return styles.hudErr
  return styles.hudWait
}

/** Status tag copy. */
function statusTag(t: (key: string, params?: Record<string, unknown>) => string, state: BalanceStateView | null): string | null {
  if (state === null) return null
  if (state.status === 'ok') {
    if (state.stale === true) return t('balance.stale')
    if (state.low) return t('balance.lowBadge')
    return null
  }
  if (state.status === 'unconfigured') return t('balance.state.unconfigured', { error: state.error ?? '' })
  if (state.status === 'error') return t('balance.state.error', { error: state.error ?? '' })
  return t('balance.state.loading')
}

/**
 * The floating balance HUD (portal onto body; fixed right/bottom position).
 */
export function BalanceDock(props: BalanceDockProps): ReturnType<typeof createPortal> {
  const { state, t } = props
  const display: BalanceDisplayConfig = state?.display ?? { visible: true, collapsed: false, right: 24, bottom: 24 }
  const [dragPos, setDragPos] = useState<{ right: number; bottom: number } | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; right: number; bottom: number } | null>(null)
  const draggedRef = useRef(false)
  const historyRef = useRef<SparkPoint[]>([])

  // Append each fresh snapshot (dedup by checkedAt) to the sparkline memory.
  const checkedAt = state?.checkedAt
  const total = state?.total
  useEffect(() => {
    if (checkedAt === undefined || total === undefined || !Number.isFinite(total)) return
    const history = historyRef.current
    const last = history[history.length - 1]
    if (last !== undefined && last.t === checkedAt) return
    history.push({ t: checkedAt, v: total })
    if (history.length > SPARK_CAP) history.splice(0, history.length - SPARK_CAP)
  }, [checkedAt, total])

  // Dragging: pointer events on the panel/pill/summon; right/bottom based.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).closest('button') !== null) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    const current = dragPos ?? { right: display.right, bottom: display.bottom }
    dragRef.current = { startX: e.clientX, startY: e.clientY, ...current }
    draggedRef.current = false
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (drag === null) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) draggedRef.current = true
    const right = clampOffset(drag.right - dx, window.innerWidth - 60)
    const bottom = clampOffset(drag.bottom - dy, window.innerHeight - 60)
    setDragPos({ right, bottom })
  }
  const onPointerUp = (): void => {
    if (dragRef.current === null) return
    dragRef.current = null
    if (dragPos !== null) props.onSetDisplay({ right: dragPos.right, bottom: dragPos.bottom })
  }

  const pos = dragPos ?? { right: display.right, bottom: display.bottom }
  const tone = hudTone(state)

  // Hidden: a small summon dot with the yen glyph.
  if (state !== null && !display.visible) {
    return createPortal(
      <div
        className={styles.float}
        style={{ right: pos.right, bottom: pos.bottom, zIndex: 2147483000 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <button
          type="button"
          className={styles.summon}
          aria-label={t('balance.summon')}
          title={t('balance.summon')}
          onClick={() => { props.onSetDisplay({ visible: true }) }}
        >
          <span className={styles.summonRing} />
          <span>{'\u00a5'}</span>
        </button>
      </div>,
      document.body,
    )
  }

  const symbol = currencySymbol(state?.currency)
  const amountText = `${symbol}${formatAmount(state?.total)}`

  // Collapsed: the compact pill.
  if (state === null || display.collapsed) {
    const pillTone = state === null ? styles.pillWait
      : state.status === 'error' ? styles.pillErr
        : state.low && state.status === 'ok' ? styles.pillLow
          : ''
    return createPortal(
      <div
        className={`${styles.float} ${styles.pill} ${pillTone}`}
        style={{ right: pos.right, bottom: pos.bottom, zIndex: 2147483000 }}
        role="button"
        aria-label={t('balance.expand')}
        title={t('balance.expand')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => {
          if (draggedRef.current) return
          props.onSetDisplay({ collapsed: false })
        }}
      >
        <span className={styles.pillDot} />
        <span className={styles.pillAmount}>{amountText}</span>
        <span className={styles.pillHint}>{t('balance.expand')}</span>
      </div>,
      document.body,
    )
  }

  // Full HUD panel.
  const tag = statusTag(t, state)
  const { line, area, last } = sparkPaths(historyRef.current)
  const granted = Number.isFinite(state?.granted) ? (state?.granted as number) : NaN
  const toppedUp = Number.isFinite(state?.toppedUp) ? (state?.toppedUp as number) : NaN
  const barTotal = Math.max(0, granted + toppedUp)
  const totalValue = Number.isFinite(state?.total) ? (state?.total as number) : 0
  const barWidth = totalValue > 0 ? Math.min(100, (barTotal / totalValue) * 100) : 0

  return createPortal(
    <div
      className={styles.float}
      style={{ right: pos.right, bottom: pos.bottom, zIndex: 2147483000 }}
    >
      <div
        className={`${styles.hud} ${tone}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className={`${styles.corner} ${styles.cornerTl}`} />
        <span className={`${styles.corner} ${styles.cornerTr}`} />
        <span className={`${styles.corner} ${styles.cornerBl}`} />
        <span className={`${styles.corner} ${styles.cornerBr}`} />
        <span className={styles.scanlines} />
        <span className={styles.glint} />

        <div className={styles.head}>
          <div className={styles.headTitle}>
            <span className={styles.titleZh}>{t('balance.title')}</span>
            <span className={styles.titleEn}>{t('balance.engTitle')}</span>
          </div>
          {tag !== null && <span className={styles.statusTag}>{tag}</span>}
          <span className={styles.liveDot} />
        </div>

        {state !== null && state.status !== 'ok' && (
          <p className={`${styles.stateMsg} ${state.status === 'error' || state.status === 'unconfigured' ? styles.stateMsgError : ''}`}>
            {t(state.status === 'unconfigured' ? 'balance.state.unconfigured' : 'balance.state.error', {
              error: state.error ?? '',
            })}
          </p>
        )}

        <div className={styles.amountRow}>
          <span className={styles.currency}>{symbol}</span>
          <span className={`${styles.amount} ${state !== null && state.low && state.status === 'ok' ? styles.amountLow : ''}`}>
            {formatAmount(state?.total)}
          </span>
          {state !== null && state.low && state.status === 'ok' && (
            <span className={styles.lowBadge}>{t('balance.lowBadge')}</span>
          )}
        </div>

        <div className={styles.split}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>{t('balance.granted')}</span>
            <span className={styles.rowValue}>{`${symbol}${formatAmount(state?.granted)}`}</span>
          </div>
          <div className={`${styles.row} ${styles.rowTopped}`}>
            <span className={styles.rowLabel}>{t('balance.toppedUp')}</span>
            <span className={styles.rowValue}>{`${symbol}${formatAmount(state?.toppedUp)}`}</span>
          </div>
        </div>

        <div className={styles.bar}>
          <span className={styles.barFill} style={{ width: `${barWidth}%` }} />
        </div>

        <div className={styles.spark}>
          <svg
            className={styles.sparkSvg}
            viewBox="0 0 100 28"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="balanceSparkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </linearGradient>
            </defs>
            {area !== '' && <path className={styles.sparkFill} d={area} />}
            {line !== '' && <path className={styles.sparkLine} d={line} />}
            {last !== null && (
              <circle className={styles.sparkLast} cx={last.x} cy={last.y} r="1.4" />
            )}
          </svg>
        </div>

        <div className={styles.foot}>
          <span className={`${styles.footTime} ${state?.stale === true ? styles.footTimeStale : ''}`}>
            {state?.checkedAt !== undefined
              ? t('balance.updated', { time: clockOf(state.checkedAt) })
              : t('balance.neverUpdated')}
          </span>
          <button
            type="button"
            className={`${styles.btn} ${props.refreshing ? styles.btnSpin : ''}`}
            aria-label={t('balance.refresh')}
            title={t('balance.refresh')}
            onClick={props.onRefresh}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.btn}
            aria-label={t('balance.collapse')}
            title={t('balance.collapse')}
            onClick={() => { props.onSetDisplay({ collapsed: true }) }}
          >
            <span>{'\u2013'}</span>
          </button>
          <button
            type="button"
            className={styles.btn}
            aria-label={t('balance.hide')}
            title={t('balance.hide')}
            onClick={() => { props.onSetDisplay({ visible: false }) }}
          >
            <span>{'\u00d7'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
