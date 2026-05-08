import { useState, useEffect, useCallback } from 'react'
import { Shield, Server, Bell, Activity, TrendingUp, TrendingDown } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
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
  const [recentAlerts, setRecentAlerts] = useState<any[]>([])
  const [recentAgents, setRecentAgents] = useState<any[]>([])
  const [severityData, setSeverityData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, histRes, alertsRes, agentsRes] = await Promise.all([
        fetch('/api/v1/overview/stats'),
        fetch('/api/v1/events/histogram?interval=1h'),
        fetch('/api/v1/alerts'),
        fetch('/api/v1/agents')
      ])
      
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }
      
      if (histRes.ok) {
        const histData = await histRes.json()
        setHistogram(histData.buckets || [])
      }

      if (alertsRes.ok) {
        const data = await alertsRes.json()
        const alertsList = data.data || []
        
        const sevCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        alertsList.forEach((a: any) => {
           if (a.severity) sevCounts[a.severity.toLowerCase()] = (sevCounts[a.severity.toLowerCase()] || 0) + 1
        })
        const sevData = Object.entries(sevCounts)
           .filter(([_, count]) => count > 0)
           .map(([name, value]) => ({ name: name.toUpperCase(), value }))
        
        setSeverityData(sevData)
        setRecentAlerts(alertsList.slice(0, 5))
      }

      if (agentsRes.ok) {
        const data = await agentsRes.json()
        setRecentAgents((data.data || []).slice(0, 5))
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
          <div className="chart-container" style={{ height: '240px', marginTop: '16px' }}>
            {loading ? (
              <div className="chart-placeholder">Loading...</div>
            ) : severityData.length === 0 ? (
              <div className="chart-placeholder">
                <Shield size={48} className="placeholder-icon" />
                <p>No alerts recorded</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {severityData.map((entry, index) => {
                      const colors: any = { CRITICAL: '#ff4b4b', HIGH: '#ff8a00', MEDIUM: '#fcd34d', LOW: '#4ade80', INFO: '#60a5fa' }
                      return <Cell key={`cell-${index}`} fill={colors[entry.name] || '#8884d8'} />
                    })}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', borderRadius: '6px' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Activity ────────────────────────────────────── */}
      <div className="activity-row">
        <div className="card animate-fade-in" style={{ animationDelay: '480ms' }}>
          <h3 className="card-title" style={{ marginBottom: '16px' }}>Recent Alerts</h3>
          {loading ? (
            <div className="empty-state">Loading...</div>
          ) : recentAlerts.length === 0 ? (
            <div className="empty-state">
              <Bell size={32} className="placeholder-icon" />
              <p>No alerts yet</p>
              <span className="empty-hint">Alerts will appear once detection rules are active</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentAlerts.map(alert => (
                <div key={alert._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: alert.severity === 'critical' ? '#ff4b4b' : alert.severity === 'high' ? '#ff8a00' : 'var(--text-secondary)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{alert.rule_name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{new Date(alert.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>{alert.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card animate-fade-in" style={{ animationDelay: '560ms' }}>
          <h3 className="card-title" style={{ marginBottom: '16px' }}>Agent Activity</h3>
          {loading ? (
            <div className="empty-state">Loading...</div>
          ) : recentAgents.length === 0 ? (
            <div className="empty-state">
              <Server size={32} className="placeholder-icon" />
              <p>No agents connected</p>
              <span className="empty-hint">Enroll agents to start monitoring</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentAgents.map(agent => (
                <div key={agent.agent_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Server size={16} style={{ color: 'var(--text-secondary)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{agent.hostname || agent.agent_id.substring(0,8)}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{agent.os} {agent.arch}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: agent.status === 'active' ? 'var(--success)' : 'var(--text-tertiary)' }}>
                    {agent.status === 'active' ? 'Online' : 'Offline'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
