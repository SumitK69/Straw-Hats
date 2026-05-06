import { Globe } from 'lucide-react'

export function ThreatIntel() {
  return (
    <div className="page-placeholder">
      <div className="card" style={{ padding: '32px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '24px' }}>Threat Intelligence</h2>
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <Globe size={48} style={{ opacity: 0.2, color: 'var(--text-tertiary)' }} />
          <p style={{ color: 'var(--text-tertiary)', marginTop: '12px' }}>IOC feeds not configured</p>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', opacity: 0.6 }}>
            Configure AlienVault OTX, Abuse.ch, and Emerging Threats feeds
          </span>
        </div>
      </div>
    </div>
  )
}
