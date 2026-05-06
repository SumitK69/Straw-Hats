import { Shield, Server, Bell, Activity, TrendingUp, TrendingDown } from 'lucide-react'
import './Overview.css'

const stats = [
  { label: 'Active Agents', value: '0', icon: Server, change: null },
  { label: 'Critical Alerts', value: '0', icon: Shield, change: null },
  { label: 'Events / sec', value: '0', icon: Activity, change: null },
  { label: 'Open Alerts', value: '0', icon: Bell, change: null },
]

export function Overview() {
  return (
    <div className="overview-page">
      {/* ── Stats Grid ─────────────────────────────────────────── */}
      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div key={i} className="card stat-card animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="stat-header">
              <span className="stat-label">{stat.label}</span>
              <div className="stat-icon-wrapper">
                <stat.icon size={18} />
              </div>
            </div>
            <div className="stat-value">{stat.value}</div>
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
          <div className="chart-placeholder">
            <Activity size={48} className="placeholder-icon" />
            <p>Event data will appear here once agents are connected</p>
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
