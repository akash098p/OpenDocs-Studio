import { create } from 'zustand'
import { UIState, Notification } from '@/types/ui'

interface UIStore extends UIState {
  setTheme: (theme: 'light' | 'dark') => void
  toggleSidebar: () => void
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
  setSidebarOpen: (isOpen: boolean) => void
}

export const useUIStore = create<UIStore>((set, get) => ({
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  sidebarOpen: true,
  notifications: [],
  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    set({ theme })
  },
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
  addNotification: (notification) => {
    const id = Date.now().toString()
    const newNotification = { ...notification, id }
    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }))
    if (notification.duration !== 0) {
      setTimeout(() => {
        get().removeNotification(id)
      }, notification.duration || 3000)
    }
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}))
