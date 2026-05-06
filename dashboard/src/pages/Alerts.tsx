import { Bell, Filter, CheckCircle } from 'lucide-react'

export function Alerts() {
  return (
    <div className="page-placeholder">
      <div className="card" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Alert Feed</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary"><Filter size={16} /> Filters</button>
            <button className="btn btn-secondary"><CheckCircle size={16} /> Acknowledge All</button>
          </div>
        </div>
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <Bell size={48} style={{ opacity: 0.2, color: 'var(--text-tertiary)' }} />
          <p style={{ color: 'var(--text-tertiary)', marginTop: '12px' }}>No alerts to display</p>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', opacity: 0.6 }}>
            Alerts will appear when detection rules match incoming events
          </span>
        </div>
      </div>
    </div>
  )
}
