'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'

import { AdoptionBars, ColumnChart, LineChart, SERIES, formatNumber } from './charts'

type Bucket = {
  key: string
  label: string
  newUsers: number
  cumulativeUsers: number
  checkInUsers: number
  replayUsers: number
}

type EngagementStats = {
  range: { start: string; end: string; granularity: 'day' | 'week' | 'month'; excludeAdmins: boolean }
  totals: {
    registeredUsers: number
    newUsersInRange: number
    activeUsersInRange: number
    checkInsInRange: number
    replaysInRange: number
    replayHoursInRange: number
    submissionsInRange: number
  }
  adoption: {
    registeredUsers: number
    checkInUsers: number
    replayUsers: number
    submissionUsers: number
  }
  signups: {
    today: number
    last7Days: number
    last30Days: number
    last90Days: number
    last12Months: number
    allTime: number
    firstSignup: string | null
    latestSignup: string | null
  }
  recentSignups: { id: string; name: string | null; email: string | null; createdAt: string }[]
  buckets: Bucket[]
}

const RANGES = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
] as const

type RangeValue = (typeof RANGES)[number]['value']

const startFor = (range: RangeValue): string | null => {
  const now = dayjs()
  if (range === '30d') return now.subtract(30, 'day').format('YYYY-MM-DD')
  if (range === '90d') return now.subtract(90, 'day').format('YYYY-MM-DD')
  if (range === '12m') return now.subtract(12, 'month').format('YYYY-MM-DD')
  return null // all time — let the server start at the first signup
}

const pct = (value: number, total: number): string =>
  total > 0 ? `${Math.round((value / total) * 100)}% of users` : '—'

const fmtDate = (value: string | null | undefined): string =>
  value ? dayjs(value).format('D MMM YYYY') : '—'

const fmtDateTime = (value: string | null | undefined): string =>
  value ? dayjs(value).format('D MMM YYYY, HH:mm') : '—'

const relative = (value: string | null | undefined): string => {
  if (!value) return ''
  const days = dayjs().startOf('day').diff(dayjs(value).startOf('day'), 'day')
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30)
  return months < 12 ? `${months} month${months === 1 ? '' : 's'} ago` : `${Math.round(days / 365)}y ago`
}

export default function UserStatsPage() {
  const [range, setRange] = useState<RangeValue>('12m')
  const [excludeAdmins, setExcludeAdmins] = useState(true)
  const [showTable, setShowTable] = useState(false)
  const [stats, setStats] = useState<EngagementStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      const start = startFor(range)
      if (start) params.set('start', start)
      params.set('excludeAdmins', String(excludeAdmins))

      const response = await fetch(`${baseUrl}/api/users/engagement-stats?${params.toString()}`, {
        credentials: 'include',
      })
      if (response.status === 403) {
        setError('This page is admin-only.')
        setStats(null)
        return
      }
      if (!response.ok) throw new Error(`Request failed (${response.status})`)
      const data = await response.json()
      setStats(data as EngagementStats)
    } catch (err) {
      setError(`Could not load engagement stats: ${err instanceof Error ? err.message : err}`)
    } finally {
      setLoading(false)
    }
  }, [baseUrl, range, excludeAdmins])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const labels = useMemo(() => stats?.buckets.map((b) => b.label) ?? [], [stats])
  const granularityWord =
    stats?.range.granularity === 'day' ? 'day' : stats?.range.granularity === 'week' ? 'week' : 'month'

  const hasBuckets = labels.length > 0

  return (
    <div className="viz-root user-stats">
      <header className="page-head">
        <h1>Users &amp; Engagement</h1>
        <p className="page-sub">
          Registrations over time, and how many people actually use the daily check-in and the
          trade replay.
        </p>
        {stats && (
          <p className="page-range">
            Showing <strong>{fmtDate(stats.range.start)}</strong> &rarr;{' '}
            <strong>{fmtDate(stats.range.end)}</strong> · by {granularityWord}
            {stats.range.excludeAdmins ? ' · admin accounts excluded' : ''}
          </p>
        )}
      </header>

      {/* filters: one row, above everything they scope */}
      <div className="filters">
        <div className="filter">
          <label htmlFor="range">Date range</label>
          <select id="range" value={range} onChange={(e) => setRange(e.target.value as RangeValue)}>
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <label className="filter checkbox">
          <input
            type="checkbox"
            checked={excludeAdmins}
            onChange={(e) => setExcludeAdmins(e.target.checked)}
          />
          Exclude admin accounts
        </label>
        <button type="button" className="ghost-button" onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Hide data table' : 'Show data table'}
        </button>
      </div>

      {error && <div className="notice error">{error}</div>}

      {!error && (
        <div className={loading ? 'content is-loading' : 'content'}>
          {/* The direct answer to "how many users, and when" — fixed windows,
              deliberately independent of the date filter above. */}
          <section className="card signups-card">
            <div className="signups-head">
              <div>
                <h2>Registered users</h2>
                <p className="card-sub">
                  {stats?.signups.firstSignup
                    ? `First signup ${fmtDate(stats.signups.firstSignup)} · latest ${fmtDate(
                        stats.signups.latestSignup,
                      )} (${relative(stats.signups.latestSignup)})`
                    : 'No signups yet'}
                </p>
              </div>
              <p className="signups-total">{formatNumber(stats?.signups.allTime ?? 0)}</p>
            </div>
            <div className="signup-windows">
              {[
                { label: 'Today', value: stats?.signups.today ?? 0 },
                { label: 'Last 7 days', value: stats?.signups.last7Days ?? 0 },
                { label: 'Last 30 days', value: stats?.signups.last30Days ?? 0 },
                { label: 'Last 90 days', value: stats?.signups.last90Days ?? 0 },
                { label: 'Last 12 months', value: stats?.signups.last12Months ?? 0 },
                { label: 'All time', value: stats?.signups.allTime ?? 0 },
              ].map((window) => (
                <div className="signup-window" key={window.label}>
                  <span className="signup-window-value">{formatNumber(window.value)}</span>
                  <span className="signup-window-label">{window.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* headline numbers — the figures that are a number, not a chart */}
          <div className="tiles">
            <div className="tile">
              <p className="tile-label">Registered users</p>
              <p className="tile-value">{formatNumber(stats?.totals.registeredUsers ?? 0)}</p>
              <p className="tile-detail">
                +{formatNumber(stats?.totals.newUsersInRange ?? 0)} in this range
              </p>
            </div>
            <div className="tile">
              <p className="tile-label">Active users</p>
              <p className="tile-value">{formatNumber(stats?.totals.activeUsersInRange ?? 0)}</p>
              <p className="tile-detail">
                {pct(stats?.totals.activeUsersInRange ?? 0, stats?.totals.registeredUsers ?? 0)}
              </p>
            </div>
            <div className="tile">
              <p className="tile-label">Check-ins logged</p>
              <p className="tile-value">{formatNumber(stats?.totals.checkInsInRange ?? 0)}</p>
              <p className="tile-detail">
                by {formatNumber(stats?.adoption.checkInUsers ?? 0)} users
              </p>
            </div>
            <div className="tile">
              <p className="tile-label">Replay sessions</p>
              <p className="tile-value">{formatNumber(stats?.totals.replaysInRange ?? 0)}</p>
              <p className="tile-detail">
                {formatNumber(stats?.totals.replayHoursInRange ?? 0)} hours studied
              </p>
            </div>
            <div className="tile">
              <p className="tile-label">Trade submissions</p>
              <p className="tile-value">{formatNumber(stats?.totals.submissionsInRange ?? 0)}</p>
              <p className="tile-detail">
                by {formatNumber(stats?.adoption.submissionUsers ?? 0)} users
              </p>
            </div>
          </div>

          <div className="cards">
            <section className="card">
              <h2>Total registered users</h2>
              <p className="card-sub">Cumulative, by {granularityWord}</p>
              <LineChart
                labels={labels}
                series={[{ key: 'users', values: stats?.buckets.map((b) => b.cumulativeUsers) ?? [] }]}
              />
            </section>

            <section className="card">
              <h2>New signups</h2>
              <p className="card-sub">Per {granularityWord}</p>
              <ColumnChart
                labels={labels}
                values={stats?.buckets.map((b) => b.newUsers) ?? []}
                seriesKey="users"
              />
            </section>

            <section className="card wide">
              <h2>Active users by feature</h2>
              <p className="card-sub">
                Distinct users per {granularityWord} — someone who checks in five times counts once
              </p>
              {/* two series → legend always present, identity never color-alone */}
              <div className="legend">
                <span className="legend-item">
                  <span className="legend-line" style={{ background: 'var(--series-checkIns)' }} />
                  {SERIES.checkIns.label}
                </span>
                <span className="legend-item">
                  <span className="legend-line" style={{ background: 'var(--series-replay)' }} />
                  {SERIES.replay.label}
                </span>
              </div>
              <LineChart
                labels={labels}
                series={[
                  { key: 'checkIns', values: stats?.buckets.map((b) => b.checkInUsers) ?? [] },
                  { key: 'replay', values: stats?.buckets.map((b) => b.replayUsers) ?? [] },
                ]}
                height={260}
              />
            </section>

            <section className="card wide">
              <h2>Feature adoption</h2>
              <p className="card-sub">
                How many of the {formatNumber(stats?.adoption.registeredUsers ?? 0)} registered users
                touched each feature in this range
              </p>
              <AdoptionBars
                total={stats?.adoption.registeredUsers ?? 0}
                bars={[
                  {
                    key: 'checkIns',
                    label: SERIES.checkIns.label,
                    value: stats?.adoption.checkInUsers ?? 0,
                    detail: pct(stats?.adoption.checkInUsers ?? 0, stats?.adoption.registeredUsers ?? 0),
                  },
                  {
                    key: 'replay',
                    label: SERIES.replay.label,
                    value: stats?.adoption.replayUsers ?? 0,
                    detail: pct(stats?.adoption.replayUsers ?? 0, stats?.adoption.registeredUsers ?? 0),
                  },
                ]}
              />
            </section>
          </div>

          {!!stats?.recentSignups.length && (
            <section className="card">
              <h2>Latest signups</h2>
              <p className="card-sub">The {stats.recentSignups.length} most recent registrations</p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Registered</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentSignups.map((user) => (
                      <tr key={user.id}>
                        <td>{user.name || '—'}</td>
                        <td>{user.email || '—'}</td>
                        <td>{fmtDateTime(user.createdAt)}</td>
                        <td className="muted">{relative(user.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {showTable && hasBuckets && (
            <section className="card">
              <h2>Data table</h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>New users</th>
                      <th>Total users</th>
                      <th>Check-in users</th>
                      <th>Replay users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.buckets.map((bucket) => (
                      <tr key={bucket.key}>
                        <td>{bucket.label}</td>
                        <td>{formatNumber(bucket.newUsers)}</td>
                        <td>{formatNumber(bucket.cumulativeUsers)}</td>
                        <td>{formatNumber(bucket.checkInUsers)}</td>
                        <td>{formatNumber(bucket.replayUsers)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      <style jsx global>{`
        /* Palette: categorical slots 1/2/3, validated for CVD separation and
           contrast against the Payload card surfaces in both themes. */
        .viz-root {
          --series-users: #2a78d6;
          --series-checkIns: #1baf7a;
          --series-replay: #eb6834;
          --viz-surface: var(--theme-elevation-50);
          --viz-grid: var(--theme-elevation-100);
          --viz-text: var(--theme-elevation-800);
          --viz-text-muted: var(--theme-elevation-500);
        }
        html[data-theme='dark'] .viz-root {
          --series-users: #3987e5;
          --series-checkIns: #199e70;
          --series-replay: #d95926;
        }

        .viz-plot {
          position: relative;
          width: 100%;
        }
        .viz-grid {
          stroke: var(--viz-grid);
          stroke-width: 1;
        }
        .viz-axis-text {
          fill: var(--viz-text-muted);
          font-size: 11px;
        }
        .viz-end-label {
          fill: var(--viz-text);
          font-size: 11px;
          font-weight: 600;
        }
        /* 2px surface ring keeps dots legible where they cross a line */
        .viz-end-dot {
          stroke: var(--viz-surface);
          stroke-width: 2;
        }
        .viz-crosshair {
          stroke: var(--theme-elevation-300);
          stroke-width: 1;
        }
        .viz-plot svg:focus-visible {
          outline: 2px solid var(--theme-elevation-400);
          outline-offset: 2px;
        }
        .viz-empty {
          color: var(--viz-text-muted);
          font-size: 13px;
          padding: 32px 0;
          text-align: center;
        }

        .viz-tooltip {
          position: absolute;
          z-index: 5;
          pointer-events: none;
          background: var(--theme-elevation-0);
          border: 1px solid var(--theme-elevation-150);
          border-radius: 6px;
          padding: 8px 10px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
          min-width: 128px;
        }
        .viz-tooltip-title {
          font-size: 11px;
          color: var(--viz-text-muted);
          margin-bottom: 4px;
        }
        .viz-tooltip-row {
          display: flex;
          align-items: baseline;
          gap: 6px;
          font-size: 12px;
        }
        .viz-tooltip-key {
          width: 10px;
          height: 2px;
          border-radius: 1px;
          flex: none;
          transform: translateY(-3px);
        }
        .viz-tooltip-value {
          font-weight: 700;
          color: var(--viz-text);
        }
        .viz-tooltip-label {
          color: var(--viz-text-muted);
        }

        .viz-bars {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-top: 8px;
        }
        .viz-bar-row {
          display: grid;
          grid-template-columns: 140px 1fr auto;
          align-items: center;
          gap: 12px;
        }
        .viz-bar-label {
          font-size: 13px;
          color: var(--viz-text);
        }
        .viz-bar-track {
          background: var(--theme-elevation-100);
          border-radius: 4px;
          height: 20px;
          overflow: hidden;
        }
        .viz-bar-fill {
          height: 100%;
          border-radius: 0 4px 4px 0;
          transition: width 0.3s ease;
        }
        .viz-bar-value {
          font-size: 14px;
          font-weight: 700;
          color: var(--viz-text);
          text-align: right;
          min-width: 110px;
        }
        .viz-bar-detail {
          display: block;
          font-size: 11px;
          font-weight: 400;
          color: var(--viz-text-muted);
        }
      `}</style>

      <style jsx>{`
        .user-stats {
          padding: 24px 32px 64px;
          max-width: 1200px;
          margin: 0 auto;
          color: var(--theme-elevation-800);
        }
        .page-head h1 {
          margin: 0;
          font-size: 28px;
        }
        .page-sub {
          margin: 6px 0 0;
          color: var(--theme-elevation-500);
          font-size: 14px;
        }
        .filters {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 16px;
          margin: 24px 0;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--theme-elevation-100);
        }
        .filter {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--theme-elevation-600);
        }
        .filter select {
          background: var(--theme-elevation-0);
          color: var(--theme-elevation-800);
          border: 1px solid var(--theme-elevation-150);
          border-radius: 4px;
          padding: 6px 10px;
          font-size: 13px;
        }
        .filter.checkbox {
          cursor: pointer;
        }
        .ghost-button {
          margin-left: auto;
          background: transparent;
          border: 1px solid var(--theme-elevation-150);
          color: var(--theme-elevation-700);
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 13px;
          cursor: pointer;
        }
        .ghost-button:hover {
          background: var(--theme-elevation-50);
        }
        .notice.error {
          padding: 16px;
          border-radius: 6px;
          background: var(--theme-error-50);
          color: var(--theme-error-700);
          font-size: 14px;
        }
        /* refetch keeps the frame — no skeleton, no layout jump */
        .content.is-loading {
          opacity: 0.5;
          transition: opacity 0.15s ease;
        }
        .page-range {
          margin: 10px 0 0;
          font-size: 13px;
          color: var(--theme-elevation-600);
        }
        .signups-card {
          margin-bottom: 20px;
        }
        .signups-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .signups-total {
          margin: 0;
          font-size: 40px;
          font-weight: 700;
          line-height: 1;
          color: var(--theme-elevation-900);
        }
        .signup-windows {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
          gap: 1px;
          margin-top: 16px;
          background: var(--theme-elevation-100);
          border: 1px solid var(--theme-elevation-100);
          border-radius: 6px;
          overflow: hidden;
        }
        .signup-window {
          background: var(--theme-elevation-0);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .signup-window-value {
          font-size: 20px;
          font-weight: 700;
          color: var(--theme-elevation-900);
        }
        .signup-window-label {
          font-size: 11px;
          color: var(--theme-elevation-500);
        }
        .muted {
          color: var(--theme-elevation-500);
        }
        .tiles {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .tile {
          background: var(--theme-elevation-50);
          border: 1px solid var(--theme-elevation-100);
          border-radius: 8px;
          padding: 16px;
        }
        .tile-label {
          margin: 0;
          font-size: 12px;
          color: var(--theme-elevation-500);
        }
        .tile-value {
          margin: 6px 0 0;
          font-size: 28px;
          font-weight: 700;
          line-height: 1.1;
          color: var(--theme-elevation-900);
        }
        .tile-detail {
          margin: 4px 0 0;
          font-size: 12px;
          color: var(--theme-elevation-500);
        }
        .cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
          gap: 16px;
        }
        .card {
          background: var(--theme-elevation-50);
          border: 1px solid var(--theme-elevation-100);
          border-radius: 8px;
          padding: 20px;
          min-width: 0;
        }
        .card.wide {
          grid-column: 1 / -1;
        }
        .card h2 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        .card-sub {
          margin: 4px 0 12px;
          font-size: 12px;
          color: var(--theme-elevation-500);
        }
        .legend {
          display: flex;
          gap: 16px;
          margin-bottom: 8px;
        }
        .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--theme-elevation-600);
        }
        .legend-line {
          width: 14px;
          height: 2px;
          border-radius: 1px;
        }
        .table-scroll {
          overflow-x: auto;
          margin-top: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        th,
        td {
          text-align: right;
          padding: 8px 12px;
          border-bottom: 1px solid var(--theme-elevation-100);
          white-space: nowrap;
        }
        th:first-child,
        td:first-child {
          text-align: left;
        }
        th {
          color: var(--theme-elevation-500);
          font-weight: 500;
        }
      `}</style>
    </div>
  )
}
