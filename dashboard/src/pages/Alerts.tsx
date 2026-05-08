import React, { useState, useEffect, useCallback } from 'react'
import { Bell, RefreshCw, ChevronRight, Clock } from 'lucide-react'
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import './Alerts.css'

interface AlertData {
  _id: string
  id: string
  rule_id: string
  rule_name: string
  severity: string
  description: string
  status: string
  timestamp: string
  agent_id: string
  event_id: string
  fields: Record<string, string>
  raw_data: string
  tags: string[]
}

interface HistogramBucket {
  time: string
  count: number
}

const TIME_RANGES = [
  { label: 'Last 1 hour', value: '1h', interval: '1m' },
  { label: 'Last 24 hours', value: '24h', interval: '1h' },
  { label: 'Last 3 days', value: '3d', interval: '1h' },
  { label: 'Last 7 days', value: '7d', interval: '12h' }
]

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(date)
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

export function Alerts() {
  const [alerts, setAlerts] = useState<AlertData[]>([])
  const [histogram, setHistogram] = useState<HistogramBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [timeRange, setTimeRange] = useState(TIME_RANGES[2]) // Default 3d
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [totalAlerts, setTotalAlerts] = useState(0)

  const fetchAlerts = useCallback(async () => {
    try {
      const now = new Date()
      let histFromDate = new Date()
      
      switch(timeRange.value) {
        case '1h': histFromDate.setHours(now.getHours() - 1); break;
        case '24h': histFromDate.setHours(now.getHours() - 24); break;
        case '3d': histFromDate.setDate(now.getDate() - 3); break;
        case '7d': histFromDate.setDate(now.getDate() - 7); break;
      }
      
      const histFromStr = histFromDate.toISOString()
      const histToStr = now.toISOString()

      let alertsFromStr = histFromStr
      let alertsToStr = histToStr

      if (selectedBucket) {
        alertsFromStr = selectedBucket
        const fromDate = new Date(selectedBucket)
        const toDate = new Date(fromDate)
        switch(timeRange.interval) {
          case '1m': toDate.setMinutes(toDate.getMinutes() + 1); break;
          case '1h': toDate.setHours(toDate.getHours() + 1); break;
          case '12h': toDate.setHours(toDate.getHours() + 12); break;
        }
        alertsToStr = toDate.toISOString()
      }

      const alertsParams = new URLSearchParams()
      alertsParams.append('from', alertsFromStr)
      alertsParams.append('to', alertsToStr)

      const histParams = new URLSearchParams()
      histParams.append('from', histFromStr)
      histParams.append('to', histToStr)
      histParams.append('interval', timeRange.interval)

      const [alertsRes, histRes] = await Promise.all([
        fetch(`/api/v1/alerts?${alertsParams.toString()}`),
        fetch(`/api/v1/alerts/histogram?${histParams.toString()}`)
      ])

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json()
        setAlerts(alertsData.data || [])
        setTotalAlerts(alertsData.total || 0)
      }

      if (histRes.ok) {
        const histData = await histRes.json()
        setHistogram(histData.buckets || [])
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err)
    } finally {
      setLoading(false)
    }
  }, [timeRange, selectedBucket])

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 10000)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const highCount = alerts.filter(a => a.severity === 'high').length

  return (
    <div className="alerts-page">
      <div className="card" style={{ padding: '28px' }}>
        <div className="alerts-header">
          <div>
            <h2>Alerts</h2>
            <div className="alerts-meta">
              <span>{totalAlerts.toLocaleString()} alert{totalAlerts !== 1 ? 's' : ''}</span>
              {criticalCount > 0 && <><span>·</span><span className="text-critical">{criticalCount} critical</span></>}
              {highCount > 0 && <><span>·</span><span className="text-high">{highCount} high</span></>}
              <span>·</span>
              <RefreshCw size={10} />
              <span>Auto-refresh 10s</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="time-range-selector" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} />
              <select 
                value={timeRange.value} 
                onChange={(e) => {
                  setTimeRange(TIME_RANGES.find(r => r.value === e.target.value) || TIME_RANGES[2])
                  setSelectedBucket(null)
                }}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit', fontSize: '0.8125rem' }}
              >
                {TIME_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {selectedBucket && (
              <button 
                className="btn btn-secondary" 
                style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setSelectedBucket(null)}
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* Timeline Histogram */}
        {!loading && histogram.length > 0 && (
          <div className="alerts-histogram-container" style={{ height: '120px', marginBottom: '20px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '20px' }}>
             <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                <XAxis 
                  dataKey="time" 
                  tickFormatter={(time) => new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  fontSize={10}
                  tickMargin={5}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  cursor={{fill: 'var(--bg-hover)'}}
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', borderRadius: '6px', fontSize: '0.75rem' }}
                  labelFormatter={(label) => new Date(label).toLocaleString()}
                />
                <Bar 
                  dataKey="count" 
                  fill="var(--warning)" 
                  radius={[2, 2, 0, 0]}
                  onClick={(data: any) => {
                    if (data && data.payload && data.payload.time) {
                      setSelectedBucket(data.payload.time)
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {histogram.map((entry, index) => {
                    const isSelected = selectedBucket === entry.time
                    const isDimmed = selectedBucket && !isSelected
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={isSelected ? "var(--warning)" : entry.count > 0 ? "var(--warning)" : "var(--text-tertiary)"} 
                        style={{ opacity: isDimmed ? 0.3 : 1, transition: 'all 0.2s' }}
                      />
                    )
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : alerts.length === 0 ? (
          <div className="alerts-empty-state">
            <Bell size={40} style={{ opacity: 0.15 }} />
            <p>No alerts generated yet</p>
            <span>Alerts will appear when detection rules match incoming events. Try running test commands — see the docs for details.</span>
          </div>
        ) : (
          <div className="alerts-table-wrapper" style={{ marginTop: '20px' }}>
            <table className="alerts-table">
              <thead>
                <tr>
                  <th style={{ width: '36px' }}></th>
                  <th style={{ width: '90px' }}>Severity</th>
                  <th style={{ width: '160px' }}>Time</th>
                  <th>Rule / Description</th>
                  <th style={{ width: '100px' }}>Agent</th>
                  <th style={{ width: '80px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(alert => {
                  const isExpanded = expandedRows.has(alert._id)
                  return (
                    <React.Fragment key={alert._id}>
                      <tr className="alert-row animate-fade-in" onClick={() => toggleRow(alert._id)}>
                        <td className="chevron-cell">
                          <ChevronRight size={14} className={`chevron ${isExpanded ? 'expanded' : ''}`} />
                        </td>
                        <td>
                          <span className={`severity-badge sev-${alert.severity}`}>{alert.severity}</span>
                        </td>
                        <td className="time-cell" title={formatDate(alert.timestamp || (alert as any)['@timestamp'])}>
                          {timeAgo(alert.timestamp || (alert as any)['@timestamp'])}
                        </td>
                        <td>
                          <div className="alert-title">{alert.rule_name || alert.rule_id}</div>
                          <div className="alert-desc">{alert.description}</div>
                        </td>
                        <td className="agent-cell">
                          {alert.agent_id ? alert.agent_id.substring(0, 8) + '…' : '—'}
                        </td>
                        <td>
                          <span className={`status-pill status-${alert.status}`}>{alert.status || 'open'}</span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="alert-details-row">
                          <td colSpan={6}>
                            <div className="alert-details-content">
                              {alert.raw_data && (
                                <div className="detail-section">
                                  <h4>Raw Event</h4>
                                  <pre>{alert.raw_data}</pre>
                                </div>
                              )}
                              {alert.fields && Object.keys(alert.fields).length > 0 && (
                                <div className="detail-section">
                                  <h4>Event Fields</h4>
                                  <div className="fields-grid">
                                    {Object.entries(alert.fields).map(([k, v]) => (
                                      <div key={k} className="field-item">
                                        <span className="field-key">{k}</span>
                                        <span className="field-value">{v}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {alert.tags && alert.tags.length > 0 && (
                                <div className="detail-section">
                                  <h4>Tags</h4>
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {alert.tags.map((tag, i) => (
                                      <span key={i} className="tag-pill">{tag}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="detail-section">
                                <h4>Metadata</h4>
                                <div className="fields-grid">
                                  <div className="field-item">
                                    <span className="field-key">Alert ID</span>
                                    <span className="field-value">{alert.id}</span>
                                  </div>
                                  <div className="field-item">
                                    <span className="field-key">Rule ID</span>
                                    <span className="field-value">{alert.rule_id}</span>
                                  </div>
                                  <div className="field-item">
                                    <span className="field-key">Event ID</span>
                                    <span className="field-value">{alert.event_id || '—'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
