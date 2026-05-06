import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Bell, Server, BookOpen,
  Bug, Globe, Settings, ChevronLeft, ChevronRight,
  Search, User, ShieldAlert
} from 'lucide-react'
import './AppLayout.css'

const navItems = [
  { path: '/overview', label: 'Overview', icon: LayoutDashboard },
  { path: '/alerts', label: 'Alerts', icon: Bell, badge: 12 },
  { path: '/agents', label: 'Agents', icon: Server },
  { path: '/rules', label: 'Rules', icon: BookOpen },
  { path: '/threat-intel', label: 'Threat Intel', icon: Globe },
  { path: '/vulnerabilities', label: 'Vulnerabilities', icon: Bug },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const currentPage = navItems.find(item => item.path === location.pathname)

  return (
    <div className={`app-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <ShieldAlert size={28} className="logo-icon" />
            {!collapsed && <span className="logo-text">SENTINEL</span>}
          </div>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} className="nav-icon" />
              {!collapsed && (
                <>
                  <span className="nav-label">{item.label}</span>
                  {item.badge && (
                    <span className="nav-badge">{item.badge}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && (
            <div className="server-status">
              <div className="status-dot online" />
              <span className="status-text">Server Online</span>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────── */}
      <div className="main-content">
        <header className="app-header">
          <div className="header-left">
            <h1 className="page-title">{currentPage?.label || 'Sentinel'}</h1>
          </div>
          <div className="header-right">
            <div className="search-bar">
              <Search size={16} className="search-icon" />
              <input type="text" placeholder="Search events, agents, alerts..." />
            </div>
            <button className="header-btn notification-btn">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <button className="header-btn user-btn">
              <User size={18} />
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
