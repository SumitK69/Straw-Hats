import { Globe } from 'lucide-react'

export function ThreatIntel() {
  return (
    <div className="page-placeholder">
      <div className="card" style={{ padding: '28px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '20px' }}>Threat Intelligence</h2>
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <Globe size={40} style={{ opacity: 0.15, color: 'var(--text-tertiary)' }} />
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.875rem' }}>IOC feeds not configured</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            Configure AlienVault OTX, Abuse.ch, and Emerging Threats feeds
          </span>
        </div>
      </div>
    </div>
  )
}
