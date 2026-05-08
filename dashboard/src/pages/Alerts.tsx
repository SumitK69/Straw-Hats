import { Bell, Filter, CheckCircle } from 'lucide-react'

export function Alerts() {
  return (
    <div className="page-placeholder">
      <div className="card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Alert Feed</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary"><Filter size={14} /> Filters</button>
            <button className="btn btn-secondary"><CheckCircle size={14} /> Acknowledge All</button>
          </div>
        </div>
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <Bell size={40} style={{ opacity: 0.15, color: 'var(--text-tertiary)' }} />
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.875rem' }}>No alerts to display</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            Alerts will appear when detection rules match incoming events
          </span>
        </div>
      </div>
    </div>
  )
}
