import { Server, Plus } from 'lucide-react'

export function Agents() {
  return (
    <div className="page-placeholder">
      <div className="card" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Agent Inventory</h2>
          <button className="btn btn-primary"><Plus size={16} /> Add Agent</button>
        </div>
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <Server size={48} style={{ opacity: 0.2, color: 'var(--text-tertiary)' }} />
          <p style={{ color: 'var(--text-tertiary)', marginTop: '12px' }}>No agents enrolled</p>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', opacity: 0.6 }}>
            Click "Add Agent" to generate an enrollment token
          </span>
        </div>
      </div>
    </div>
  )
}
