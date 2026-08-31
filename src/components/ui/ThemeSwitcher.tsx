import React from 'react'
import { useUIStore } from '@store/uiStore'
import { cn } from '@utils/helpers'

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useUIStore()

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className={cn(
        'relative inline-flex h-8 w-14 items-center rounded-full',
        'bg-slate-300 dark:bg-slate-600',
        'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-primary-500 dark:focus:ring-offset-slate-950',
      )}
      aria-label="Toggle theme"
    >
      <span
        className={cn(
          'inline-block h-6 w-6 transform rounded-full bg-white transition-transform',
          theme === 'dark' ? 'translate-x-7' : 'translate-x-1',
        )}
      />
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
