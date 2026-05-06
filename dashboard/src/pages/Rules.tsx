import { BookOpen, Plus, Upload } from 'lucide-react'

export function Rules() {
  return (
    <div className="page-placeholder">
      <div className="card" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Detection Rules</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary"><Upload size={16} /> Import Sigma</button>
            <button className="btn btn-primary"><Plus size={16} /> New Rule</button>
          </div>
        </div>
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <BookOpen size={48} style={{ opacity: 0.2, color: 'var(--text-tertiary)' }} />
          <p style={{ color: 'var(--text-tertiary)', marginTop: '12px' }}>Default rule library loading...</p>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', opacity: 0.6 }}>
            200+ pre-built rules covering MITRE ATT&CK framework
          </span>
        </div>
      </div>
    </div>
  )
}
