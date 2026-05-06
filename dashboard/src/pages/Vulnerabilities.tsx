import { Bug } from 'lucide-react'

export function Vulnerabilities() {
  return (
    <div className="page-placeholder">
      <div className="card" style={{ padding: '32px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '24px' }}>Vulnerability Scanner</h2>
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <Bug size={48} style={{ opacity: 0.2, color: 'var(--text-tertiary)' }} />
          <p style={{ color: 'var(--text-tertiary)', marginTop: '12px' }}>No vulnerability data</p>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', opacity: 0.6 }}>
            Vulnerability scans will run once agents are enrolled
          </span>
        </div>
      </div>
    </div>
  )
}
