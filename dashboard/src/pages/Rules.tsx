import { useState, useEffect, useCallback } from 'react'
import { BookOpen, RefreshCw, Shield, ToggleLeft, ToggleRight } from 'lucide-react'
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
          <button className="btn btn-secondary" onClick={() => { setLoading(true); fetchRules() }}>
            <RefreshCw size={14} /> Refresh
          </button>
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
                  <button
                    className={`toggle-btn ${rule.enabled ? 'active' : ''}`}
                    onClick={() => toggleRule(rule)}
                    aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
                  >
                    {rule.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
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
    </div>
  )
}
