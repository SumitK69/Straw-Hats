import React, { useState, useEffect, useCallback } from 'react'
import { Bell, RefreshCw, ChevronRight } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/alerts')
      const json = await res.json()
      setAlerts(json.data || [])
    } catch (err) {
      console.error('Failed to fetch alerts:', err)
    } finally {
      setLoading(false)
    }
  }, [])

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
              <span>{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</span>
              {criticalCount > 0 && <><span>·</span><span className="text-critical">{criticalCount} critical</span></>}
              {highCount > 0 && <><span>·</span><span className="text-high">{highCount} high</span></>}
              <span>·</span>
              <RefreshCw size={10} />
              <span>Auto-refresh 10s</span>
            </div>
          </div>
        </div>

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
