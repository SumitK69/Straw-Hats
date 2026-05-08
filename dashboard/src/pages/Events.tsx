import React, { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw, Terminal, ChevronRight, Clock } from 'lucide-react'
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
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
  const [histogram, setHistogram] = useState<HistogramBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [timeRange, setTimeRange] = useState(TIME_RANGES[2]) // Default 3d
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [totalEvents, setTotalEvents] = useState(0)

  const fetchEvents = useCallback(async () => {
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

      let eventsFromStr = histFromStr
      let eventsToStr = histToStr

      if (selectedBucket) {
        eventsFromStr = selectedBucket
        const fromDate = new Date(selectedBucket)
        const toDate = new Date(fromDate)
        switch(timeRange.interval) {
          case '1m': toDate.setMinutes(toDate.getMinutes() + 1); break;
          case '1h': toDate.setHours(toDate.getHours() + 1); break;
          case '12h': toDate.setHours(toDate.getHours() + 12); break;
        }
        eventsToStr = toDate.toISOString()
      }

      const eventsParams = new URLSearchParams()
      if (searchQuery) eventsParams.append('q', searchQuery)
      eventsParams.append('from', eventsFromStr)
      eventsParams.append('to', eventsToStr)

      const histParams = new URLSearchParams()
      if (searchQuery) histParams.append('q', searchQuery)
      histParams.append('from', histFromStr)
      histParams.append('to', histToStr)
      histParams.append('interval', timeRange.interval)

      const [eventsRes, histRes] = await Promise.all([
        fetch(`/api/v1/events?${eventsParams.toString()}`),
        fetch(`/api/v1/events/histogram?${histParams.toString()}`)
      ])

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json()
        setEvents(eventsData.data || [])
        setTotalEvents(eventsData.total || 0)
      }

      if (histRes.ok) {
        const histData = await histRes.json()
        setHistogram(histData.buckets || [])
      }
    } catch (err) {
      console.error('Failed to fetch events:', err)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, timeRange, selectedBucket])

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
      <div className="card" style={{ padding: '28px' }}>
        <div className="events-header">
          <div>
            <h2>Events</h2>
            <div className="events-meta">
              <span className="events-count">{totalEvents.toLocaleString()} event{totalEvents !== 1 ? 's' : ''}</span>
              <span>·</span>
              <RefreshCw size={10} />
              <span>Auto-refresh 10s</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="time-range-selector">
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
            <form className="events-search" onSubmit={handleSearch}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.75rem' }}>Search</button>
            </form>
          </div>
        </div>

        {/* Timeline Histogram */}
        {!loading && histogram.length > 0 && (
          <div className="events-histogram-container" style={{ height: '120px', marginBottom: '20px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '20px' }}>
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
                  fill="var(--text-tertiary)" 
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
                        fill={isSelected ? "var(--text-primary)" : entry.count > 0 ? "var(--text-secondary)" : "var(--text-tertiary)"}
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
          <div className="loading-spinner">
            <div className="spinner" />
          </div>
        ) : events.length === 0 ? (
          <div className="events-empty-state">
            <Terminal size={40} style={{ opacity: 0.15 }} />
            <p>No events found</p>
            <span>{searchQuery ? 'Try adjusting your search query' : 'Waiting for agents to send telemetry...'}</span>
          </div>
        ) : (
          <div className="events-table-wrapper" style={{ marginTop: '20px' }}>
            <table className="events-table">
              <thead>
                <tr>
                  <th style={{ width: '36px' }}></th>
                  <th style={{ width: '200px' }}>Timestamp</th>
                  <th style={{ width: '120px' }}>Agent</th>
                  <th style={{ width: '90px' }}>Type</th>
                  <th>Message</th>
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
                          <ChevronRight size={14} className={`chevron ${isExpanded ? 'expanded' : ''}`} />
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
