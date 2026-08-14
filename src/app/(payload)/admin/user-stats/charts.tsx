'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Small hand-rolled SVG charts for the admin engagement page.
 *
 * Deliberately dependency-free (the admin bundle has no chart library) and
 * written against CSS custom properties so the Payload light/dark themes both
 * work. Palette: categorical slots 1/2/3, validated for CVD separation against
 * the Payload card surfaces in both themes.
 */

export const SERIES = {
  users: { light: '#2a78d6', dark: '#3987e5', label: 'Registered users' },
  checkIns: { light: '#1baf7a', dark: '#199e70', label: 'Daily check-in' },
  replay: { light: '#eb6834', dark: '#d95926', label: 'Trade replay' },
} as const

export type SeriesKey = keyof typeof SERIES

export type Point = { label: string; value: number }

/* ── layout helpers ─────────────────────────────────────────────── */

/**
 * Measures the plot container.
 *
 * Uses a *callback ref* on purpose: these charts render an "no data" paragraph
 * before the first fetch resolves, so the container element doesn't exist on
 * mount. A useRef + mount-only effect would observe null, never re-run, and the
 * chart would stay blank forever once the data did arrive.
 */
const useMeasure = () => {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      setWidth(Math.round(w))
    })
    observer.observe(node)
    setWidth(Math.round(node.getBoundingClientRect().width))
    return () => observer.disconnect()
  }, [node])

  return { ref: setNode, width }
}

const niceCeil = (value: number): number => {
  if (value <= 0) return 1
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

const ticksFor = (max: number, count = 4): number[] => {
  const step = max / count
  return Array.from({ length: count + 1 }, (_, i) => Math.round(step * i))
    .filter((v, i, arr) => arr.indexOf(v) === i)
}

const formatNumber = (n: number): string => n.toLocaleString('en-US')

/** Keeps the x-axis readable: show at most `max` labels, evenly skipped. */
const labelStride = (count: number, max = 8): number => Math.max(1, Math.ceil(count / max))

/* ── tooltip ────────────────────────────────────────────────────── */

type TooltipRow = { color: string; label: string; value: string }

const Tooltip: React.FC<{
  x: number
  y: number
  title: string
  rows: TooltipRow[]
  containerWidth: number
}> = ({ x, y, title, rows, containerWidth }) => {
  const flip = x > containerWidth - 160
  return (
    <div
      className="viz-tooltip"
      style={{
        left: flip ? undefined : x + 12,
        right: flip ? containerWidth - x + 12 : undefined,
        top: Math.max(0, y - 12),
      }}
      role="status"
    >
      <div className="viz-tooltip-title">{title}</div>
      {rows.map((row) => (
        <div className="viz-tooltip-row" key={row.label}>
          <span className="viz-tooltip-key" style={{ background: row.color }} />
          <span className="viz-tooltip-value">{row.value}</span>
          <span className="viz-tooltip-label">{row.label}</span>
        </div>
      ))}
    </div>
  )
}

/* ── line chart (one or more series over time) ──────────────────── */

export type LineSeries = { key: SeriesKey; values: number[] }

export const LineChart: React.FC<{
  labels: string[]
  series: LineSeries[]
  height?: number
  valueSuffix?: string
  emptyMessage?: string
}> = ({ labels, series, height = 240, valueSuffix = '', emptyMessage = 'No data in this range' }) => {
  const { ref, width } = useMeasure()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const pad = { top: 16, right: 56, bottom: 28, left: 44 }
  const plotW = Math.max(0, width - pad.left - pad.right)
  const plotH = height - pad.top - pad.bottom

  const max = useMemo(
    () => niceCeil(Math.max(1, ...series.flatMap((s) => s.values))),
    [series],
  )
  const xAt = useCallback(
    (i: number) => (labels.length <= 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW),
    [labels.length, plotW],
  )
  const yAt = useCallback((v: number) => plotH - (v / max) * plotH, [max, plotH])

  const handleMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!labels.length || plotW <= 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const rel = event.clientX - rect.left - pad.left
    const ratio = labels.length <= 1 ? 0 : rel / plotW
    const idx = Math.round(ratio * (labels.length - 1))
    setHoverIndex(Math.min(labels.length - 1, Math.max(0, idx)))
  }

  const handleKey = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (!labels.length) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      setHoverIndex((prev) => {
        const next = (prev === null ? 0 : prev) + delta
        return Math.min(labels.length - 1, Math.max(0, next))
      })
    }
  }

  if (!labels.length) return <p className="viz-empty">{emptyMessage}</p>

  const stride = labelStride(labels.length)
  const single = series.length === 1

  return (
    <div className="viz-plot" ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          tabIndex={0}
          aria-label={`${series.map((s) => SERIES[s.key].label).join(' and ')} over time`}
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIndex(null)}
          onKeyDown={handleKey}
          onBlur={() => setHoverIndex(null)}
        >
          <g transform={`translate(${pad.left},${pad.top})`}>
            {ticksFor(max).map((tick) => (
              <g key={tick}>
                <line
                  className="viz-grid"
                  x1={0}
                  x2={plotW}
                  y1={yAt(tick)}
                  y2={yAt(tick)}
                />
                <text className="viz-axis-text" x={-8} y={yAt(tick)} dy="0.32em" textAnchor="end">
                  {formatNumber(tick)}
                </text>
              </g>
            ))}

            {labels.map((label, i) =>
              i % stride === 0 || i === labels.length - 1 ? (
                <text
                  key={`${label}-${i}`}
                  className="viz-axis-text"
                  x={xAt(i)}
                  y={plotH + 18}
                  textAnchor={i === labels.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
                >
                  {label}
                </text>
              ) : null,
            )}

            {series.map((s) => {
              const color = `var(--series-${s.key})`
              const path = s.values
                .map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(v)}`)
                .join(' ')
              const areaPath = single
                ? `${path} L${xAt(s.values.length - 1)},${plotH} L${xAt(0)},${plotH} Z`
                : null
              const lastIndex = s.values.length - 1
              const lastValue = s.values[lastIndex] ?? 0
              return (
                <g key={s.key}>
                  {areaPath && <path d={areaPath} fill={color} fillOpacity={0.1} />}
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* end marker + direct label — identity without relying on color alone */}
                  <circle
                    cx={xAt(lastIndex)}
                    cy={yAt(lastValue)}
                    r={4}
                    fill={color}
                    className="viz-end-dot"
                  />
                  <text
                    className="viz-end-label"
                    x={xAt(lastIndex) + 10}
                    y={yAt(lastValue)}
                    dy="0.32em"
                  >
                    {formatNumber(lastValue)}
                    {valueSuffix}
                  </text>
                </g>
              )
            })}

            {hoverIndex !== null && (
              <g>
                <line
                  className="viz-crosshair"
                  x1={xAt(hoverIndex)}
                  x2={xAt(hoverIndex)}
                  y1={0}
                  y2={plotH}
                />
                {series.map((s) => (
                  <circle
                    key={s.key}
                    cx={xAt(hoverIndex)}
                    cy={yAt(s.values[hoverIndex] ?? 0)}
                    r={4.5}
                    fill={`var(--series-${s.key})`}
                    className="viz-end-dot"
                  />
                ))}
              </g>
            )}
          </g>
        </svg>
      )}

      {hoverIndex !== null && (
        <Tooltip
          containerWidth={width}
          x={pad.left + xAt(hoverIndex)}
          y={pad.top}
          title={labels[hoverIndex] ?? ''}
          rows={series.map((s) => ({
            color: `var(--series-${s.key})`,
            label: SERIES[s.key].label,
            value: `${formatNumber(s.values[hoverIndex] ?? 0)}${valueSuffix}`,
          }))}
        />
      )}
    </div>
  )
}

/* ── column chart (one series, e.g. new signups per period) ─────── */

export const ColumnChart: React.FC<{
  labels: string[]
  values: number[]
  seriesKey: SeriesKey
  height?: number
  emptyMessage?: string
}> = ({ labels, values, seriesKey, height = 200, emptyMessage = 'No data in this range' }) => {
  const { ref, width } = useMeasure()
  const [hover, setHover] = useState<number | null>(null)

  const pad = { top: 20, right: 12, bottom: 28, left: 44 }
  const plotW = Math.max(0, width - pad.left - pad.right)
  const plotH = height - pad.top - pad.bottom
  const max = niceCeil(Math.max(1, ...values))

  if (!labels.length) return <p className="viz-empty">{emptyMessage}</p>

  const band = plotW / labels.length
  const barW = Math.min(24, Math.max(2, band - 2)) // 2px surface gap between neighbours
  const stride = labelStride(labels.length)
  const peak = values.indexOf(Math.max(...values))
  const color = `var(--series-${seriesKey})`

  return (
    <div className="viz-plot" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`${SERIES[seriesKey].label} per period`}>
          <g transform={`translate(${pad.left},${pad.top})`}>
            {ticksFor(max).map((tick) => (
              <g key={tick}>
                <line className="viz-grid" x1={0} x2={plotW} y1={plotH - (tick / max) * plotH} y2={plotH - (tick / max) * plotH} />
                <text className="viz-axis-text" x={-8} y={plotH - (tick / max) * plotH} dy="0.32em" textAnchor="end">
                  {formatNumber(tick)}
                </text>
              </g>
            ))}

            {values.map((value, i) => {
              const h = (value / max) * plotH
              const x = i * band + (band - barW) / 2
              const y = plotH - h
              return (
                <g key={`${labels[i]}-${i}`}>
                  {/* hit target is wider than the mark */}
                  <rect
                    x={i * band}
                    y={0}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${labels[i]}: ${value}`}
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                  />
                  {value > 0 && (
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(h, 2)}
                      rx={Math.min(4, barW / 2)}
                      fill={color}
                      opacity={hover === null || hover === i ? 1 : 0.55}
                      pointerEvents="none"
                    />
                  )}
                  {/* label the peak and the latest bar only — never every column */}
                  {value > 0 && (i === peak || i === values.length - 1) && (
                    <text className="viz-end-label" x={i * band + band / 2} y={y - 6} textAnchor="middle">
                      {formatNumber(value)}
                    </text>
                  )}
                </g>
              )
            })}

            {labels.map((label, i) =>
              i % stride === 0 || i === labels.length - 1 ? (
                <text
                  key={`${label}-${i}`}
                  className="viz-axis-text"
                  x={i * band + band / 2}
                  y={plotH + 18}
                  textAnchor="middle"
                >
                  {label}
                </text>
              ) : null,
            )}
          </g>
        </svg>
      )}

      {hover !== null && (
        <Tooltip
          containerWidth={width}
          x={pad.left + hover * band + band / 2}
          y={pad.top}
          title={labels[hover] ?? ''}
          rows={[{ color, label: SERIES[seriesKey].label, value: formatNumber(values[hover] ?? 0) }]}
        />
      )}
    </div>
  )
}

/* ── horizontal bars (adoption) ─────────────────────────────────── */

export type AdoptionBar = { key: SeriesKey; label: string; value: number; detail?: string }

export const AdoptionBars: React.FC<{ bars: AdoptionBar[]; total: number }> = ({ bars, total }) => {
  const max = Math.max(1, total, ...bars.map((b) => b.value))

  return (
    <div className="viz-bars">
      {bars.map((bar) => (
        <div className="viz-bar-row" key={bar.label}>
          <div className="viz-bar-label">{bar.label}</div>
          <div className="viz-bar-track">
            <div
              className="viz-bar-fill"
              style={{
                width: `${Math.max(bar.value > 0 ? 1.5 : 0, (bar.value / max) * 100)}%`,
                background: `var(--series-${bar.key})`,
              }}
            />
          </div>
          {/* value always shown: the light-mode marks sit under 3:1, so labels carry it */}
          <div className="viz-bar-value">
            {formatNumber(bar.value)}
            {bar.detail && <span className="viz-bar-detail">{bar.detail}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

export { formatNumber }
