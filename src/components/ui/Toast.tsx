import React from 'react'
import { Notification } from '@/types/ui'
import { useUIStore } from '@store/uiStore'
import { cn } from '@utils/helpers'

interface ToastProps {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  onClose: (id: string) => void
}

export const Toast: React.FC<ToastProps> = ({ id, type, message, onClose }) => {
  React.useEffect(() => {
    const timer = window.setTimeout(() => onClose(id), 3000)
    return () => window.clearTimeout(timer)
  }, [id, onClose])

  const bgColors = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  }

  const textColors = {
    success: 'text-green-800 dark:text-green-200',
    error: 'text-red-800 dark:text-red-200',
    info: 'text-blue-800 dark:text-blue-200',
    warning: 'text-yellow-800 dark:text-yellow-200',
  }

  return (
    <div className={cn('mb-2 rounded-lg border p-4 shadow-sm', bgColors[type], textColors[type])}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{message}</p>
        <button
          type="button"
          onClick={() => onClose(id)}
          className="text-sm font-bold leading-none opacity-70 hover:opacity-100"
          aria-label="Dismiss notification"
        >
          x
        </button>
      </div>
    </div>
  )
}

export const ToastContainer: React.FC<{ toasts: Notification[] }> = ({ toasts = [] }) => {
  const removeNotification = useUIStore((state) => state.removeNotification)

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          onClose={() => removeNotification(toast.id)}
        />
      ))}
    </div>
  )
}
