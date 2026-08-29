import React from 'react'
import { useUIStore } from '@store/uiStore'

interface HeaderProps {
  title?: string
  actions?: React.ReactNode
}

export const Header: React.FC<HeaderProps> = ({ title, actions }) => {
  const { toggleSidebar } = useUIStore()

  return (
    <header className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => toggleSidebar()}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Open navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {title && <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{title}</h1>}
        </div>
        <div className="flex items-center gap-3">
          {actions}
        </div>
      </div>
    </header>
  )
}
