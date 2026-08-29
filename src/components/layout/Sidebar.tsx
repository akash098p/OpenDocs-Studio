import React from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@utils/helpers'
import { ThemeSwitcher } from '@components/ui/ThemeSwitcher'

interface NavItem {
  icon: React.ReactNode
  label: string
  href: string
  badge?: number
}

interface SidebarProps {
  items: NavItem[]
  isOpen: boolean
  onClose?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ items, isOpen, onClose }) => {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-30"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen w-sidebar flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0',
          !isOpen && '-translate-x-full lg:translate-x-0',
        )}
        aria-label="Primary navigation"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-xl font-bold text-primary-600">OpenDocs</h1>
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            aria-label="Close navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.href}>
                <NavLink
                  to={item.href}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center justify-between rounded-lg px-4 py-3 transition-colors',
                      'hover:bg-slate-100 dark:hover:bg-slate-800',
                      isActive
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-200'
                        : 'text-slate-700 dark:text-slate-300',
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-1 text-xs font-semibold text-white bg-primary-600 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Theme</span>
            <ThemeSwitcher />
          </div>
        </div>
      </aside>

      {/* Spacer for desktop */}
      <div className="hidden lg:block w-sidebar" />
    </>
  )
}
