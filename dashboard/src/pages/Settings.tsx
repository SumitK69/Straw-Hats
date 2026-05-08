import { Settings as SettingsIcon } from 'lucide-react'

export function Settings() {
  return (
    <div className="page-placeholder">
      <div className="card" style={{ padding: '28px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '20px' }}>Settings</h2>
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <SettingsIcon size={40} style={{ opacity: 0.15, color: 'var(--text-tertiary)' }} />
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.875rem' }}>Server configuration</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            Index retention, notifications, users, and API keys
          </span>
        </div>
      </div>
    </div>
  )
}
