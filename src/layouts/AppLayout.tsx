import React from 'react'
import { useUIStore } from '@store/uiStore'
import { Sidebar } from '@components/layout/Sidebar'
import { Header } from '@components/layout/Header'

interface LayoutProps {
  children: React.ReactNode
  title?: string
  headerActions?: React.ReactNode
  sidebarItems?: Array<{
    icon: React.ReactNode
    label: string
    href: string
    badge?: number
  }>
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  title,
  headerActions,
  sidebarItems = [],
}) => {
  const { sidebarOpen } = useUIStore()

  const defaultSidebarItems = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 11l4-4m0 0l4 4m-4-4v4" />
        </svg>
      ),
      label: 'Dashboard',
      href: '/dashboard',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      label: 'Files',
      href: '/files',
    },
    {
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h10M11 12h10M11 19h10M4 6h1v1H4V6zm0 7h1v1H4v-1zm0 7h1v1H4v-1z" />
        </svg>
      ),
      label: 'Tools',
      href: '/tools',
    },
  ]

  return (
    <div className="flex h-screen bg-gradient-to-br from-orange-100 via-amber-100 to-yellow-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <Sidebar
        items={sidebarItems.length > 0 ? sidebarItems : defaultSidebarItems}
        isOpen={sidebarOpen}
        onClose={() => useUIStore.getState().setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} actions={headerActions} />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
