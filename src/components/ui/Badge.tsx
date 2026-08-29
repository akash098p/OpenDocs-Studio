import React from 'react'
import { cn } from '@utils/helpers'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'primary'
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'neutral', ...props }) => {
  const variants = {
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    primary: 'bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-200',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
