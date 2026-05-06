import { Settings as SettingsIcon } from 'lucide-react'

export function Settings() {
  return (
    <div className="page-placeholder">
      <div className="card" style={{ padding: '32px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '24px' }}>Settings</h2>
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <SettingsIcon size={48} style={{ opacity: 0.2, color: 'var(--text-tertiary)' }} />
          <p style={{ color: 'var(--text-tertiary)', marginTop: '12px' }}>Server configuration</p>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', opacity: 0.6 }}>
            Index retention, notifications, users, and API keys
          </span>
        </div>
      </div>
    </div>
  )
}
