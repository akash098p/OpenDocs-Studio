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
          // Light mode: warm orange/amber gradient
          'fixed left-0 top-0 z-40 flex h-screen w-sidebar flex-col border-r border-orange-300/60',
          'bg-gradient-to-b from-orange-100 via-amber-100 to-yellow-100',
          // Dark mode: modern deep gradient (slate-950 -> indigo-950 -> slate-900)
          'dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 dark:border-slate-800/60',
          'transition-transform lg:translate-x-0',
          !isOpen && '-translate-x-full lg:translate-x-0',
        )}
        aria-label="Primary navigation"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-orange-300/60 dark:border-slate-800/60">
          <h1 className="text-xl font-bold bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 dark:from-sky-500 dark:via-blue-500 dark:to-indigo-500 bg-clip-text text-transparent">
            OpenDocs
          </h1>
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-orange-300/60 dark:hover:bg-slate-800/60 rounded-lg text-slate-700 dark:text-slate-200"
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
                      'flex items-center justify-between rounded-lg px-4 py-3 transition-all duration-200',
                      // Inactive: subtle text + hover
                      !isActive && 'text-slate-700 dark:text-slate-300 hover:bg-orange-300/60 dark:hover:bg-slate-800/60',
                      // Active: light mode = warm orange/amber gradient, dark mode = blue/indigo gradient
                      isActive &&
                        'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white shadow-lg shadow-orange-500/30 dark:from-sky-500 dark:via-blue-500 dark:to-indigo-500 dark:shadow-blue-500/30',
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-1 text-xs font-semibold text-white bg-white/20 rounded-full backdrop-blur">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-orange-300/60 dark:border-slate-800/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Theme
            </span>
            <ThemeSwitcher />
          </div>
        </div>
      </aside>

      {/* Spacer for desktop */}
      <div className="hidden lg:block w-sidebar" />
    </>
  )
}
