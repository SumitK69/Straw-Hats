import { useState, useEffect, useCallback } from 'react'
import { BookOpen, RefreshCw, Shield, ToggleLeft, ToggleRight, Plus, X, Trash2, Edit } from 'lucide-react'
import './Rules.css'

interface Condition {
  field: string
  operator: string
  value: string
}

interface Rule {
  id: string
  name: string
  description: string
  severity: string
  enabled: boolean
  event_types: number[]
  conditions: Condition[]
  tags: string[]
  created_at: string
  updated_at: string
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4
}

const EVENT_TYPE_LABELS: Record<number, string> = {
  1: 'PROCESS', 2: 'FILE', 3: 'NETWORK', 4: 'LOG', 5: 'METRIC'
}

export function Rules() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  
  // Form State
  const [formData, setFormData] = useState<Partial<Rule>>({
    name: '',
    description: '',
    severity: 'medium',
    enabled: true,
    event_types: [],
    conditions: [],
    tags: []
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      severity: 'medium',
      enabled: true,
      event_types: [],
      conditions: [{ field: 'message', operator: 'contains', value: '' }],
      tags: []
    })
    setEditingRule(null)
  }

  const openModal = (rule?: Rule) => {
    if (rule) {
      setEditingRule(rule)
      setFormData(rule)
    } else {
      resetForm()
    }
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    resetForm()
  }

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/rules')
      const json = await res.json()
      const sorted = (json.data || []).sort((a: Rule, b: Rule) =>
        (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5)
      )
      setRules(sorted)
    } catch (err) {
      console.error('Failed to fetch rules:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const toggleRule = async (rule: Rule) => {
    try {
      await fetch(`/api/v1/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rule, enabled: !rule.enabled })
      })
      setRules(prev =>
        prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r)
      )
    } catch (err) {
      console.error('Failed to toggle rule:', err)
    }
  }

  const deleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return
    try {
      await fetch(`/api/v1/rules/${id}`, { method: 'DELETE' })
      setRules(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      console.error('Failed to delete rule:', err)
    }
  }

  const saveRule = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingRule) {
        await fetch(`/api/v1/rules/${editingRule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, id: editingRule.id })
        })
      } else {
        await fetch('/api/v1/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
      }
      closeModal()
      fetchRules()
    } catch (err) {
      console.error('Failed to save rule:', err)
    }
  }

  const enabledCount = rules.filter(r => r.enabled).length

  return (
    <div className="rules-page">
      <div className="card" style={{ padding: '28px' }}>
        <div className="rules-header">
          <div>
            <h2>Detection Rules</h2>
            <div className="rules-meta">
              <span>{rules.length} rules</span>
              <span>·</span>
              <span>{enabledCount} enabled</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => { setLoading(true); fetchRules() }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="btn btn-primary" onClick={() => openModal()}>
              <Plus size={14} /> New Rule
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : rules.length === 0 ? (
          <div className="rules-empty-state">
            <BookOpen size={40} style={{ opacity: 0.15 }} />
            <p>No detection rules loaded</p>
            <span>The server should auto-load default rules on startup</span>
          </div>
        ) : (
          <div className="rules-list">
            {rules.map(rule => (
              <div key={rule.id} className={`rule-card ${rule.enabled ? '' : 'disabled'}`}>
                <div className="rule-card-header">
                  <div className="rule-title-row">
                    <Shield size={14} className="rule-icon" />
                    <span className="rule-name">{rule.name}</span>
                    <span className={`severity-badge sev-${rule.severity}`}>{rule.severity}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      className="btn-icon"
                      onClick={() => openModal(rule)}
                      title="Edit rule"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      className="btn-icon btn-icon-danger"
                      onClick={() => deleteRule(rule.id)}
                      title="Delete rule"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      className={`toggle-btn ${rule.enabled ? 'active' : ''}`}
                      onClick={() => toggleRule(rule)}
                      aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      {rule.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                  </div>
                </div>
                <p className="rule-desc">{rule.description}</p>
                <div className="rule-footer">
                  <div className="rule-conditions">
                    {rule.conditions.map((c, i) => (
                      <span key={i} className="condition-pill">
                        {c.field} {c.operator} "{c.value}"
                      </span>
                    ))}
                  </div>
                  <div className="rule-tags">
                    {(rule.tags || []).map((tag, i) => (
                      <span key={i} className="tag-pill">{tag}</span>
                    ))}
                  </div>
                  <div className="rule-event-types">
                    {(rule.event_types || []).map(et => (
                      <span key={et} className="event-type-pill">{EVENT_TYPE_LABELS[et] || et}</span>
                    ))}
                  </div>
                </div>
                <div className="rule-id">ID: {rule.id}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Rule Editor Modal ─────────────────────────────────────── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingRule ? 'Edit Rule' : 'Create New Rule'}</h3>
              <button className="modal-close" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={saveRule} className="rule-form">
              <div className="form-group">
                <label>Rule Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="e.g. SSH Brute Force Attempt"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <input 
                  type="text" 
                  required
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Severity</label>
                  <select 
                    value={formData.severity} 
                    onChange={e => setFormData({...formData, severity: e.target.value})}
                  >
                    <option value="info">Info</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Conditions (AND)</label>
                <div className="conditions-builder">
                  {(formData.conditions || []).map((cond, idx) => (
                    <div key={idx} className="condition-row">
                      <input 
                        type="text" 
                        value={cond.field} 
                        onChange={e => {
                          const newConds = [...(formData.conditions || [])]
                          newConds[idx].field = e.target.value
                          setFormData({...formData, conditions: newConds})
                        }} 
                        placeholder="Field (e.g. message)" 
                      />
                      <select 
                        value={cond.operator}
                        onChange={e => {
                          const newConds = [...(formData.conditions || [])]
                          newConds[idx].operator = e.target.value
                          setFormData({...formData, conditions: newConds})
                        }}
                      >
                        <option value="contains">contains</option>
                        <option value="equals">equals</option>
                        <option value="not_contains">not_contains</option>
                        <option value="regex">regex</option>
                        <option value="starts_with">starts_with</option>
                      </select>
                      <input 
                        type="text" 
                        value={cond.value} 
                        onChange={e => {
                          const newConds = [...(formData.conditions || [])]
                          newConds[idx].value = e.target.value
                          setFormData({...formData, conditions: newConds})
                        }} 
                        placeholder="Value" 
                      />
                      <button 
                        type="button" 
                        className="btn-icon btn-icon-danger"
                        onClick={() => {
                          const newConds = formData.conditions?.filter((_, i) => i !== idx)
                          setFormData({...formData, conditions: newConds})
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm mt-2"
                    onClick={() => setFormData({
                      ...formData, 
                      conditions: [...(formData.conditions || []), { field: '', operator: 'contains', value: '' }]
                    })}
                  >
                    <Plus size={12} /> Add Condition
                  </button>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
