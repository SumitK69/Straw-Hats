import { Bug } from 'lucide-react'

export function Vulnerabilities() {
  return (
    <div className="page-placeholder">
      <div className="card" style={{ padding: '28px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '20px' }}>Vulnerability Scanner</h2>
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <Bug size={40} style={{ opacity: 0.15, color: 'var(--text-tertiary)' }} />
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.875rem' }}>No vulnerability data</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            Vulnerability scans will run once agents are enrolled
          </span>
        </div>
      </div>
    </div>
  )
}
