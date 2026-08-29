export interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}

export interface UIState {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  notifications: Notification[]
}
