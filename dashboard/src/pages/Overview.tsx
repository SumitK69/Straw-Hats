import { useState, useEffect, useCallback } from 'react'
import { Shield, Server, Bell, Activity, TrendingUp, TrendingDown } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import './Overview.css'

interface StatsData {
  agents: number
  events_24h: number
  events_per_sec: string
  alerts_total: number
  alerts_open: number
  alerts_critical: number
}

interface HistogramBucket {
  time: string
  count: number
}

export function Overview() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [histogram, setHistogram] = useState<HistogramBucket[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, histRes] = await Promise.all([
        fetch('/api/v1/overview/stats'),
        fetch('/api/v1/events/histogram?interval=1h')
      ])
      
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }
      
      if (histRes.ok) {
        const histData = await histRes.json()
        setHistogram(histData.buckets || [])
      }
    } catch (err) {
      console.error('Failed to fetch overview data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const statCards = [
    { label: 'Active Agents', value: stats?.agents ?? 0, icon: Server, change: null },
    { label: 'Critical Alerts', value: stats?.alerts_critical ?? 0, icon: Shield, change: null },
    { label: 'Events / sec', value: stats?.events_per_sec ?? '0', icon: Activity, change: null },
    { label: 'Open Alerts', value: stats?.alerts_open ?? 0, icon: Bell, change: null },
  ]
  return (
    <div className="overview-page">
      {/* ── Stats Grid ─────────────────────────────────────────── */}
      <div className="stats-grid">
        {statCards.map((stat, i) => (
          <div key={i} className="card stat-card animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="stat-header">
              <span className="stat-label">{stat.label}</span>
              <div className="stat-icon-wrapper">
                <stat.icon size={18} />
              </div>
            </div>
            <div className="stat-value">{loading ? '...' : stat.value}</div>
            {stat.change !== null && (
              <div className={`stat-change ${(stat.change as number) >= 0 ? 'positive' : 'negative'}`}>
                {(stat.change as number) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {Math.abs(stat.change as number)}% from last hour
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Charts Row ─────────────────────────────────────────── */}
      <div className="charts-row">
        <div className="card chart-card animate-fade-in" style={{ animationDelay: '320ms' }}>
          <h3 className="card-title">Events Timeline</h3>
          <div className="chart-container" style={{ height: '240px', marginTop: '16px' }}>
            {loading ? (
              <div className="chart-placeholder">Loading...</div>
            ) : histogram.length === 0 ? (
              <div className="chart-placeholder">
                <Activity size={48} className="placeholder-icon" />
                <p>Event data will appear here once agents are connected</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogram} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <XAxis 
                    dataKey="time" 
                    tickFormatter={(time) => new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    fontSize={10}
                    tickMargin={10}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
                  />
                  <Tooltip 
                    cursor={{fill: 'var(--bg-hover)'}}
                    contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', borderRadius: '6px' }}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Bar dataKey="count" fill="var(--text-secondary)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="card chart-card animate-fade-in" style={{ animationDelay: '400ms' }}>
          <h3 className="card-title">Alerts by Severity</h3>
          <div className="chart-placeholder">
            <Shield size={48} className="placeholder-icon" />
            <p>Alert distribution will appear here</p>
          </div>
        </div>
      </div>

      {/* ── Recent Activity ────────────────────────────────────── */}
      <div className="activity-row">
        <div className="card animate-fade-in" style={{ animationDelay: '480ms' }}>
          <h3 className="card-title">Recent Alerts</h3>
          <div className="empty-state">
            <Bell size={32} className="placeholder-icon" />
            <p>No alerts yet</p>
            <span className="empty-hint">Alerts will appear once detection rules are active</span>
          </div>
        </div>
        <div className="card animate-fade-in" style={{ animationDelay: '560ms' }}>
          <h3 className="card-title">Agent Activity</h3>
          <div className="empty-state">
            <Server size={32} className="placeholder-icon" />
            <p>No agents connected</p>
            <span className="empty-hint">Enroll agents to start monitoring</span>
          </div>
        </div>
      </div>
    </div>
  )
}
