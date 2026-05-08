import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Bell, Server, BookOpen,
  Settings, ChevronLeft, ChevronRight,
  Search, ShieldAlert, ScrollText, Sun, Moon
} from 'lucide-react'
import './AppLayout.css'

interface NavItem {
  path: string
  label: string
  icon: any
  badge?: string | number
}

const navItems: NavItem[] = [
  { path: '/overview', label: 'Overview', icon: LayoutDashboard },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/agents', label: 'Agents', icon: Server },
  { path: '/events', label: 'Events', icon: ScrollText },
  { path: '/rules', label: 'Rules', icon: BookOpen },
  { path: '/settings', label: 'Settings', icon: Settings },
]

function getInitialTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('sentinel-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)
  const location = useLocation()

  const currentPage = navItems.find(item => item.path === location.pathname)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sentinel-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  return (
    <div className={`app-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <ShieldAlert size={22} className="logo-icon" />
            {!collapsed && <span className="logo-text">SENTINEL</span>}
          </div>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
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
              <item.icon size={18} className="nav-icon" />
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
            <div className="header-search">
              <Search size={14} />
              <input type="text" placeholder="Search..." />
            </div>
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
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
