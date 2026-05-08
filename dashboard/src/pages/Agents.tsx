import { useState, useEffect, useCallback } from 'react'
import { Server, Plus, X, Copy, Check, Clock, RefreshCw, Terminal, Key, Trash2, Pencil } from 'lucide-react'
import './Agents.css'

interface Agent {
  _id: string
  agent_id: string
  hostname: string
  display_name?: string
  os: string
  arch: string
  version: string
  status: string
  last_seen: string
  enrolled_at: string
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

export function Agents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [uninstallAgentId, setUninstallAgentId] = useState<string | null>(null)

  // ── Rename state ──────────────────────────────────────────────
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/agents')
      const json = await res.json()
      setAgents(json.data || [])
    } catch (err) {
      console.error('Failed to fetch agents:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
    const interval = setInterval(fetchAgents, 10000)
    return () => clearInterval(interval)
  }, [fetchAgents])

  const generateToken = async () => {
    setTokenLoading(true)
    try {
      const res = await fetch('/api/v1/enrollment/token', { method: 'POST' })
      const json = await res.json()
      setToken(json.token)
    } catch (err) {
      console.error('Failed to generate token:', err)
    } finally {
      setTokenLoading(false)
    }
  }

  const deleteAgent = async (agentId: string) => {
    if (!confirm(`Delete agent ${agentId.substring(0, 12)}…? This cannot be undone.`)) return
    setDeletingId(agentId)
    try {
      await fetch(`/api/v1/agents/${agentId}`, { method: 'DELETE' })
      setAgents(prev => prev.filter(a => a.agent_id !== agentId))
      setUninstallAgentId(agentId) // Show uninstall instructions
    } catch (err) {
      console.error('Failed to delete agent:', err)
    } finally {
      setDeletingId(null)
    }
  }

  // ── Rename agent ────────────────────────────────────────────────
  const startRename = (agent: Agent) => {
    setRenamingId(agent.agent_id)
    setRenameValue(agent.display_name || agent.hostname || '')
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameValue('')
  }

  const saveRename = async (agentId: string) => {
    const trimmed = renameValue.trim()
    if (!trimmed) {
      cancelRename()
      return
    }

    try {
      await fetch(`/api/v1/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: trimmed })
      })
      setAgents(prev => prev.map(a =>
        a.agent_id === agentId ? { ...a, display_name: trimmed } : a
      ))
    } catch (err) {
      console.error('Failed to rename agent:', err)
    } finally {
      cancelRename()
    }
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent, agentId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveRename(agentId)
    } else if (e.key === 'Escape') {
      cancelRename()
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const openModal = () => {
    setModalOpen(true)
    setToken(null)
  }

  const closeModal = () => {
    setModalOpen(false)
    setToken(null)
  }

  const getAgentStatus = (agent: Agent): string => {
    const lastSeen = new Date(agent.last_seen)
    const diffMs = Date.now() - lastSeen.getTime()
    return diffMs < 60000 ? 'active' : 'offline'
  }

  const getDisplayName = (agent: Agent): string => {
    return agent.display_name || agent.hostname || '—'
  }

  return (
    <div className="agents-page">
      <div className="card" style={{ padding: '32px' }}>
        <div className="agents-header">
          <div>
            <h2>Agent Inventory</h2>
            {agents.length > 0 && (
              <div className="agents-meta">
                <span className="agents-count">{agents.length} agent{agents.length !== 1 ? 's' : ''}</span>
                <span>·</span>
                <RefreshCw size={12} />
                <span>Auto-refresh 10s</span>
              </div>
            )}
          </div>
          <button id="add-agent-btn" className="btn btn-primary" onClick={openModal}>
            <Plus size={16} /> Add Agent
          </button>
        </div>

        {loading ? (
          <div className="loading-spinner">
            <div className="spinner" />
          </div>
        ) : agents.length === 0 ? (
          <div className="agents-empty-state">
            <Server size={48} style={{ opacity: 0.2 }} />
            <p>No agents enrolled</p>
            <span>Click "Add Agent" to generate an enrollment token</span>
          </div>
        ) : (
          <div className="agents-table-wrapper" style={{ marginTop: '24px' }}>
            <table className="agents-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Name</th>
                  <th>Hostname</th>
                  <th>Agent ID</th>
                  <th>OS / Arch</th>
                  <th>Version</th>
                  <th>Last Seen</th>
                  <th>Enrolled</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => {
                  const status = getAgentStatus(agent)
                  const isRenaming = renamingId === agent.agent_id
                  return (
                    <tr key={agent._id || agent.agent_id} className="animate-fade-in">
                      <td>
                        <span className={`status-badge ${status}`}>
                          <span className="status-dot" />
                          {status}
                        </span>
                      </td>
                      <td>
                        {isRenaming ? (
                          <div className="rename-input-wrapper">
                            <input
                              type="text"
                              className="rename-input"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => handleRenameKeyDown(e, agent.agent_id)}
                              onBlur={() => saveRename(agent.agent_id)}
                              autoFocus
                              placeholder="Enter agent name"
                            />
                          </div>
                        ) : (
                          <div className="agent-name-cell">
                            <span className="agent-display-name">{getDisplayName(agent)}</span>
                            <button
                              className="rename-btn"
                              onClick={() => startRename(agent)}
                              title="Rename agent"
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{agent.hostname || '—'}</td>
                      <td className="agent-id-cell">{(agent.agent_id || '').substring(0, 12)}…</td>
                      <td>
                        <span className="os-label">
                          {agent.os || '—'} / {agent.arch || '—'}
                        </span>
                      </td>
                      <td>{agent.version || '—'}</td>
                      <td className="time-cell">
                        <span title={agent.last_seen ? formatDate(agent.last_seen) : ''}>
                          {agent.last_seen ? timeAgo(agent.last_seen) : '—'}
                        </span>
                      </td>
                      <td className="time-cell">
                        {agent.enrolled_at ? formatDate(agent.enrolled_at) : '—'}
                      </td>
                      <td>
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => deleteAgent(agent.agent_id)}
                          disabled={deletingId === agent.agent_id}
                          title="Delete agent"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Enrollment Modal ─────────────────────────────────────── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Enroll New Agent</h3>
              <button className="modal-close" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            {!token ? (
              <div className="generate-area">
                <Key size={48} style={{ color: 'var(--accent-400)', opacity: 0.4 }} />
                <p>
                  Generate a one-time enrollment token to register a new agent with
                  this Sentinel server. The token expires in 1 hour.
                </p>
                <button
                  id="generate-token-btn"
                  className="btn btn-primary"
                  onClick={generateToken}
                  disabled={tokenLoading}
                >
                  {tokenLoading ? (
                    <>
                      <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Key size={16} /> Generate Enrollment Token
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="token-section">
                <div className="token-step">
                  <div className="token-step-label">
                    <span className="step-number">1</span>
                    Enrollment Token
                  </div>
                  <div className="command-block">
                    <code>{token}</code>
                    <button
                      className={`copy-btn ${copied === 'token' ? 'copied' : ''}`}
                      onClick={() => copyToClipboard(token, 'token')}
                    >
                      {copied === 'token' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>
                  <span className="token-note">
                    <Clock size={12} /> Expires in 1 hour
                  </span>
                </div>

                <div className="token-step">
                  <div className="token-step-label">
                    <span className="step-number">2</span>
                    Run on target machine
                  </div>
                  <div className="command-block">
                    <code>
                      <Terminal size={14} style={{ marginRight: 8, verticalAlign: 'middle', opacity: 0.5 }} />
                      sudo bash install.sh --token {token.substring(0, 20)}…
                    </code>
                    <button
                      className={`copy-btn ${copied === 'install' ? 'copied' : ''}`}
                      onClick={() => copyToClipboard(`sudo bash install.sh --token ${token}`, 'install')}
                    >
                      {copied === 'install' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>
                </div>

                <div className="token-step">
                  <div className="token-step-label">
                    <span className="step-number">3</span>
                    Or use the one-liner (remote install)
                  </div>
                  <div className="command-block">
                    <code>
                      <Terminal size={14} style={{ marginRight: 8, verticalAlign: 'middle', opacity: 0.5 }} />
                      curl -sL https://get.sentinel.io | SENTINEL_TOKEN={token.substring(0, 20)}… bash
                    </code>
                    <button
                      className={`copy-btn ${copied === 'curl' ? 'copied' : ''}`}
                      onClick={() => copyToClipboard(`curl -sL https://get.sentinel.io | SENTINEL_TOKEN=${token} bash`, 'curl')}
                    >
                      {copied === 'curl' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Uninstall Instructions Modal ─────────────────────────────── */}
      {uninstallAgentId && (
        <div className="modal-overlay" onClick={() => setUninstallAgentId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--warning)' }}>Agent Unenrolled</h3>
              <button className="modal-close" onClick={() => setUninstallAgentId(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="token-section">
              <div className="token-step" style={{ padding: '20px', background: 'rgba(235, 87, 87, 0.05)', borderRadius: 'var(--radius-md)' }}>
                <p style={{ marginBottom: '16px', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Agent <strong>{uninstallAgentId.substring(0, 12)}</strong> has been removed from the server.
                  However, the agent service might still be running on the host machine. 
                  Run the following command on the agent host to completely stop and uninstall it:
                </p>
                <div className="command-block">
                  <code>sudo systemctl stop sentinel-agent && sudo systemctl disable sentinel-agent && sudo rm -f /etc/systemd/system/sentinel-agent.service && sudo rm -rf /opt/sentinel && sudo systemctl daemon-reload</code>
                  <button
                    className={`copy-btn ${copied === 'uninstall' ? 'copied' : ''}`}
                    onClick={() => copyToClipboard('sudo systemctl stop sentinel-agent && sudo systemctl disable sentinel-agent && sudo rm -f /etc/systemd/system/sentinel-agent.service && sudo rm -rf /opt/sentinel && sudo systemctl daemon-reload', 'uninstall')}
                  >
                    {copied === 'uninstall' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button className="btn btn-secondary" onClick={() => setUninstallAgentId(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
