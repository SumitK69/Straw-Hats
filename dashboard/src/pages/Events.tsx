import React, { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw, Terminal, ChevronRight } from 'lucide-react'
import './Events.css'

interface Event {
  _id: string
  id: string
  agent_id: string
  type: number
  '@timestamp': string
  fields: Record<string, string>
  raw_data: string
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'Invalid Date'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false
  }).format(date)
}

const EVENT_TYPES: Record<number, string> = {
  0: 'UNKNOWN',
  1: 'PROCESS',
  2: 'FILE',
  3: 'NETWORK',
  4: 'LOG',
  5: 'METRIC',
  6: 'VULN',
  7: 'CONTAINER'
}

export function Events() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const fetchEvents = useCallback(async () => {
    try {
      // Allow searching raw_data or fields
      const queryParam = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''
      const res = await fetch(`/api/v1/events${queryParam}`)
      const json = await res.json()
      setEvents(json.data || [])
    } catch (err) {
      console.error('Failed to fetch events:', err)
    } finally {
      setLoading(false)
    }
  }, [searchQuery])

  useEffect(() => {
    fetchEvents()
    const interval = setInterval(fetchEvents, 10000)
    return () => clearInterval(interval)
  }, [fetchEvents])

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    fetchEvents()
  }

  return (
    <div className="events-page">
      <div className="card" style={{ padding: '32px' }}>
        <div className="events-header">
          <div>
            <h2>Raw Logs & Events</h2>
            <div className="events-meta">
              <span className="events-count">{events.length} event{events.length !== 1 ? 's' : ''}</span>
              <span>·</span>
              <RefreshCw size={12} />
              <span>Auto-refresh 10s</span>
            </div>
          </div>
          <form className="search-bar" onSubmit={handleSearch}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Search logs (e.g. sshd, auth...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary">Search</button>
          </form>
        </div>

        {loading ? (
          <div className="loading-spinner">
            <div className="spinner" />
          </div>
        ) : events.length === 0 ? (
          <div className="events-empty-state">
            <Terminal size={48} style={{ opacity: 0.2 }} />
            <p>No events found</p>
            <span>{searchQuery ? 'Try adjusting your search query' : 'Waiting for agents to send telemetry...'}</span>
          </div>
        ) : (
          <div className="events-table-wrapper" style={{ marginTop: '24px' }}>
            <table className="events-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th style={{ width: '220px' }}>Timestamp</th>
                  <th style={{ width: '150px' }}>Agent ID</th>
                  <th style={{ width: '100px' }}>Type</th>
                  <th>Message / Raw Data</th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt) => {
                  const isExpanded = expandedRows.has(evt._id)
                  const typeLabel = EVENT_TYPES[evt.type] || 'UNKNOWN'
                  
                  let rawDecoded = evt.raw_data || ''
                  if (rawDecoded) {
                    try {
                      rawDecoded = atob(rawDecoded)
                    } catch (e) {
                      // fallback to original if not base64
                    }
                  }
                  
                  const message = evt.fields?.message || rawDecoded || JSON.stringify(evt.fields)
                  
                  return (
                    <React.Fragment key={evt._id}>
                      <tr className="event-row animate-fade-in" onClick={() => toggleRow(evt._id)}>
                        <td className="chevron-cell">
                          <ChevronRight size={16} className={`chevron ${isExpanded ? 'expanded' : ''}`} />
                        </td>
                        <td className="time-cell">{formatDate(evt['@timestamp'])}</td>
                        <td className="agent-cell" title={evt.agent_id}>
                          {evt.agent_id ? evt.agent_id.substring(0, 8) + '…' : '—'}
                        </td>
                        <td>
                          <span className={`type-badge type-${typeLabel.toLowerCase()}`}>
                            {typeLabel}
                          </span>
                        </td>
                        <td className="message-cell">
                          <div className="truncate-text">{message}</div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="event-details-row">
                          <td colSpan={5}>
                            <div className="event-details-content">
                              <div className="detail-section">
                                <h4>Raw Data</h4>
                                <pre>{rawDecoded}</pre>
                              </div>
                              {evt.fields && Object.keys(evt.fields).length > 0 && (
                                <div className="detail-section">
                                  <h4>Parsed Fields</h4>
                                  <div className="fields-grid">
                                    {Object.entries(evt.fields).map(([k, v]) => (
                                      <div key={k} className="field-item">
                                        <span className="field-key">{k}</span>
                                        <span className="field-value">{v as string}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
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
