import { useState } from 'react'
import { Settings as SettingsIcon, Database, Trash2, ShieldAlert } from 'lucide-react'

export function Settings() {
  const [retentionDays, setRetentionDays] = useState(7)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null)

  const handleDeleteLogs = async () => {
    if (!confirm("WARNING: This will permanently delete all events and alerts from OpenSearch. This action cannot be undone! Are you sure?")) {
      return
    }

    setIsDeleting(true)
    setDeleteStatus(null)

    try {
      const res = await fetch('/api/v1/dev/purge-logs', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to purge logs')
      setDeleteStatus('Successfully deleted all logs.')
    } catch (err) {
      console.error(err)
      setDeleteStatus('Error deleting logs. See console.')
    } finally {
      setIsDeleting(false)
      setTimeout(() => setDeleteStatus(null), 5000)
    }
  }

  return (
    <div className="page-wrapper animate-fade-in" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <SettingsIcon size={24} style={{ color: 'var(--text-secondary)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>System Settings</h2>
        </div>

        <div className="settings-section" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px' }}>Log Retention</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Configure how long raw telemetry events and alerts are kept in OpenSearch before being automatically deleted.
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select 
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
            >
              <option value={3}>3 Days</option>
              <option value={7}>7 Days (Default)</option>
              <option value={14}>14 Days</option>
              <option value={30}>30 Days</option>
              <option value={90}>90 Days</option>
            </select>
            <button className="btn btn-primary" style={{ padding: '8px 16px' }}>Save</button>
          </div>
        </div>

        <div className="settings-section">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px' }}>Storage Information</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Sentinel uses OpenSearch as its primary data store.
          </p>
          <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Database size={16} /> <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>OpenSearch Indices</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '24px', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li><code>sentinel-events-*</code>: Stores raw telemetry (syslog, process events, metrics)</li>
              <li><code>sentinel-alerts-*</code>: Stores generated security alerts</li>
              <li><code>sentinel-agents</code>: Stores enrolled agent metadata</li>
              <li><code>sentinel-rules</code>: Stores active detection rules</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '28px', border: '1px solid rgba(235, 87, 87, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <ShieldAlert size={20} style={{ color: 'var(--warning)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--warning)' }}>Developer Tools</h3>
        </div>
        
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          These tools are for use during development and testing phases only. Use with extreme caution.
        </p>

        <button 
          className="btn btn-secondary" 
          style={{ padding: '8px 16px', color: 'var(--warning)', borderColor: 'rgba(235, 87, 87, 0.3)' }}
          onClick={handleDeleteLogs}
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting...' : <><Trash2 size={16} style={{ marginRight: '6px' }} /> Delete All Logs & Alerts</>}
        </button>

        {deleteStatus && (
          <div style={{ marginTop: '12px', fontSize: '0.875rem', color: deleteStatus.includes('Error') ? 'var(--warning)' : 'var(--success)' }}>
            {deleteStatus}
          </div>
        )}
      </div>
    </div>
  )
}
