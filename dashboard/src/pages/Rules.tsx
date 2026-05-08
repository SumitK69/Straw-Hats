import { useState, useEffect, useCallback, useRef } from 'react'
import { BookOpen, RefreshCw, Shield, ToggleLeft, ToggleRight, Plus, X, Trash2, Edit, Upload, FileText, Filter } from 'lucide-react'
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
  source: string
  created_at: string
  updated_at: string
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4
}

const EVENT_TYPE_LABELS: Record<number, string> = {
  1: 'PROCESS', 2: 'FILE', 3: 'NETWORK', 4: 'LOG', 5: 'METRIC'
}

type SourceFilter = 'all' | 'sigma' | 'custom'

export function Rules() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [yamlInput, setYamlInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form State
  const [formData, setFormData] = useState<Partial<Rule>>({
    name: '',
    description: '',
    severity: 'medium',
    enabled: true,
    event_types: [],
    conditions: [],
    tags: [],
    source: 'custom'
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      severity: 'medium',
      enabled: true,
      event_types: [4],
      conditions: [{ field: 'message', operator: 'contains', value: '' }],
      tags: [],
      source: 'custom'
    })
    setEditingRule(null)
    setTagInput('')
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadStatus(null)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/v1/rules/import', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (res.ok) {
        setUploadStatus({ type: 'success', message: json.message || `${json.count} rule(s) imported` })
        fetchRules()
      } else {
        setUploadStatus({ type: 'error', message: json.error || 'Import failed' })
      }
    } catch (err) {
      setUploadStatus({ type: 'error', message: 'Network error during upload' })
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleManualImport = async () => {
    if (!yamlInput.trim()) return
    setUploadStatus(null)
    try {
      const res = await fetch('/api/v1/rules/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-yaml' },
        body: yamlInput,
      })
      const json = await res.json()
      if (res.ok) {
        setUploadStatus({ type: 'success', message: json.message || `${json.count} rule(s) imported` })
        setYamlInput('')
        fetchRules()
      } else {
        setUploadStatus({ type: 'error', message: json.error || 'Import failed' })
      }
    } catch (err) {
      setUploadStatus({ type: 'error', message: 'Network error during import' })
    }
  }

  const handleTagAdd = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = tagInput.trim().replace(/,$/, '')
      if (tag && !(formData.tags || []).includes(tag)) {
        setFormData({ ...formData, tags: [...(formData.tags || []), tag] })
      }
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: (formData.tags || []).filter(t => t !== tag) })
  }

  const toggleEventType = (et: number) => {
    const current = formData.event_types || []
    if (current.includes(et)) {
      setFormData({ ...formData, event_types: current.filter(t => t !== et) })
    } else {
      setFormData({ ...formData, event_types: [...current, et] })
    }
  }

  // Filtering
  const filteredRules = rules.filter(r => {
    if (sourceFilter === 'all') return true
    return r.source === sourceFilter
  })

  const enabledCount = rules.filter(r => r.enabled).length
  const sigmaCount = rules.filter(r => r.source === 'sigma').length
  const customCount = rules.filter(r => r.source === 'custom').length

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
              <span>·</span>
              <span className="source-count sigma">{sigmaCount} Sigma</span>
              <span className="source-count custom">{customCount} Custom</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => { setLoading(true); fetchRules() }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="btn btn-secondary" onClick={() => setUploadModalOpen(true)}>
              <Upload size={14} /> Import YAML
            </button>
            <button className="btn btn-primary" onClick={() => openModal()}>
              <Plus size={14} /> New Rule
            </button>
          </div>
        </div>

        {/* ── Source Filter Tabs ────────────────────────────────────── */}
        <div className="rules-filter-bar">
          <div className="filter-tabs">
            <button
              className={`filter-tab ${sourceFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSourceFilter('all')}
            >
              <Filter size={12} /> All Rules
              <span className="filter-count">{rules.length}</span>
            </button>
            <button
              className={`filter-tab ${sourceFilter === 'sigma' ? 'active' : ''}`}
              onClick={() => setSourceFilter('sigma')}
            >
              <Shield size={12} /> Sigma / Predefined
              <span className="filter-count">{sigmaCount}</span>
            </button>
            <button
              className={`filter-tab ${sourceFilter === 'custom' ? 'active' : ''}`}
              onClick={() => setSourceFilter('custom')}
            >
              <FileText size={12} /> Custom
              <span className="filter-count">{customCount}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : filteredRules.length === 0 ? (
          <div className="rules-empty-state">
            <BookOpen size={40} style={{ opacity: 0.15 }} />
            <p>{sourceFilter === 'all' ? 'No detection rules loaded' : `No ${sourceFilter} rules found`}</p>
            <span>
              {sourceFilter === 'custom'
                ? 'Click "New Rule" to create a custom rule or "Import YAML" to upload'
                : 'The server loads Sigma rules from the rules/sigma/ directory on startup'}
            </span>
          </div>
        ) : (
          <div className="rules-list">
            {filteredRules.map(rule => (
              <div key={rule.id} className={`rule-card ${rule.enabled ? '' : 'disabled'}`}>
                <div className="rule-card-header">
                  <div className="rule-title-row">
                    <Shield size={14} className="rule-icon" />
                    <span className="rule-name">{rule.name}</span>
                    <span className={`severity-badge sev-${rule.severity}`}>{rule.severity}</span>
                    <span className={`source-badge source-${rule.source || 'custom'}`}>
                      {rule.source === 'sigma' ? 'SIGMA' : 'CUSTOM'}
                    </span>
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
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. SSH Brute Force Attempt"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What does this rule detect?"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Severity</label>
                  <select
                    value={formData.severity}
                    onChange={e => setFormData({ ...formData, severity: e.target.value })}
                  >
                    <option value="info">Info</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.enabled ? 'enabled' : 'disabled'}
                    onChange={e => setFormData({ ...formData, enabled: e.target.value === 'enabled' })}
                  >
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              {/* Event Types */}
              <div className="form-group">
                <label>Event Types</label>
                <div className="event-type-selector">
                  {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => {
                    const num = parseInt(key)
                    const selected = (formData.event_types || []).includes(num)
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`event-type-btn ${selected ? 'selected' : ''}`}
                        onClick={() => toggleEventType(num)}
                      >
                        {label}
                      </button>
                    )
                  })}
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
                          newConds[idx] = { ...newConds[idx], field: e.target.value }
                          setFormData({ ...formData, conditions: newConds })
                        }}
                        placeholder="Field (e.g. message)"
                      />
                      <select
                        value={cond.operator}
                        onChange={e => {
                          const newConds = [...(formData.conditions || [])]
                          newConds[idx] = { ...newConds[idx], operator: e.target.value }
                          setFormData({ ...formData, conditions: newConds })
                        }}
                      >
                        <option value="contains">contains</option>
                        <option value="equals">equals</option>
                        <option value="not_contains">not_contains</option>
                        <option value="regex">regex</option>
                        <option value="starts_with">starts_with</option>
                        <option value="ends_with">ends_with</option>
                      </select>
                      <input
                        type="text"
                        value={cond.value}
                        onChange={e => {
                          const newConds = [...(formData.conditions || [])]
                          newConds[idx] = { ...newConds[idx], value: e.target.value }
                          setFormData({ ...formData, conditions: newConds })
                        }}
                        placeholder="Value"
                      />
                      <button
                        type="button"
                        className="btn-icon btn-icon-danger"
                        onClick={() => {
                          const newConds = formData.conditions?.filter((_, i) => i !== idx)
                          setFormData({ ...formData, conditions: newConds })
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

              {/* Tags */}
              <div className="form-group">
                <label>Tags</label>
                <div className="tag-input-wrapper">
                  <div className="tag-input-chips">
                    {(formData.tags || []).map((tag, i) => (
                      <span key={i} className="tag-chip">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)}>
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={handleTagAdd}
                      placeholder={formData.tags?.length ? '' : 'Type and press Enter to add tags'}
                      className="tag-text-input"
                    />
                  </div>
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

      {/* ── YAML Import Modal ──────────────────────────────────────── */}
      {uploadModalOpen && (
        <div className="modal-overlay" onClick={() => { setUploadModalOpen(false); setUploadStatus(null) }}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import YAML Rules</h3>
              <button className="modal-close" onClick={() => { setUploadModalOpen(false); setUploadStatus(null) }}>
                <X size={20} />
              </button>
            </div>

            <div className="upload-section">
              <div className="upload-info">
                <p>
                  Upload a <strong>.yml</strong> or <strong>.yaml</strong> file containing one or more detection rules
                  in Sigma-compatible format. Multiple rules can be separated with <code>---</code> in a single file.
                </p>
              </div>

              <div
                className="upload-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover') }}
                onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove('dragover') }}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('dragover')
                  const file = e.dataTransfer.files[0]
                  if (file && fileInputRef.current) {
                    const dt = new DataTransfer()
                    dt.items.add(file)
                    fileInputRef.current.files = dt.files
                    fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }))
                  }
                }}
              >
                <Upload size={32} style={{ opacity: 0.3 }} />
                <p>Drag & drop a YAML file here, or click to browse</p>
                <span className="upload-hint">.yml or .yaml files — Sigma-compatible format</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".yml,.yaml"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </div>

              {uploadStatus && (
                <div className={`upload-status ${uploadStatus.type}`}>
                  {uploadStatus.type === 'success' ? '✓' : '✗'} {uploadStatus.message}
                </div>
              )}

              <div className="upload-manual">
                <div className="upload-manual-header">
                  <FileText size={14} />
                  <span>Enter YAML Rule Code Directly</span>
                </div>
                <textarea
                  className="yaml-editor"
                  value={yamlInput}
                  onChange={e => setYamlInput(e.target.value)}
                  placeholder={`title: My Custom Rule\nid: my-rule-id\ndescription: Detects something suspicious\n...`}
                  rows={12}
                />
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleManualImport}
                    disabled={!yamlInput.trim()}
                  >
                    Save YAML Rule
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setUploadModalOpen(false); setUploadStatus(null) }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
