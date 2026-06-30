import { ref, createApp, h } from 'vue'
import MNotificationHost from '../components/MNotificationHost.vue'

export type NotificationVariant = 'info' | 'success' | 'warning' | 'error'
export type NotificationPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface NotificationAction { label: string; onClick: () => void }

export interface Notification {
  id: number
  message: string
  variant: NotificationVariant
  duration: number
  loading?: boolean
  icon?: string | null  // null = suppress icon entirely
  closable?: boolean
  action?: NotificationAction
  count: number         // ≥ 2 → show badge
}

let nextId = 1
let mounted = false
const timers = new Map<number, ReturnType<typeof setTimeout>>()

const notifications = ref<Notification[]>([])
const position = ref<NotificationPosition>('top-right')

function ensureMounted() {
  if (mounted || typeof document === 'undefined') return
  mounted = true
  const container = document.createElement('div')
  container.id = 'm3-notification-host'
  document.body.appendChild(container)
  createApp({ render: () => h(MNotificationHost) }).mount(container)
}

function dismiss(id: number) {
  const timer = timers.get(id)
  if (timer) { clearTimeout(timer); timers.delete(id) }
  notifications.value = notifications.value.filter((n) => n.id !== id)
}

export interface NotificationOptions {
  duration?: number
  loading?: boolean
  icon?: string | null
  closable?: boolean
  action?: NotificationAction
}

function show(
  message: string,
  variant: NotificationVariant = 'info',
  options: NotificationOptions = {},
) {
  ensureMounted()
  const isLoading = options.loading ?? false

  // Dedup: identical non-loading, non-action notifications increment count
  if (!isLoading && !options.action) {
    const existing = notifications.value.find(
      n => n.message === message && n.variant === variant && !n.loading && !n.action,
    )
    if (existing) {
      existing.count++
      const old = timers.get(existing.id)
      if (old) clearTimeout(old)
      if (existing.duration > 0)
        timers.set(existing.id, setTimeout(() => dismiss(existing.id), existing.duration))
      return existing.id
    }
  }

  const id = nextId++
  const duration = isLoading ? 0 : (options.duration ?? 3000)
  const closable = options.closable ?? true
  notifications.value.push({ id, message, variant, duration, loading: isLoading, icon: options.icon, closable, action: options.action, count: 1 })
  if (duration > 0) timers.set(id, setTimeout(() => dismiss(id), duration))
  return id
}

function update(id: number, patch: Partial<Omit<Notification, 'id'>>) {
  const n = notifications.value.find((n) => n.id === id)
  if (!n) return
  Object.assign(n, patch)
  if ('loading' in patch && !patch.loading) {
    const timer = timers.get(id)
    if (timer) clearTimeout(timer)
    const dur = patch.duration ?? 3000
    if (dur > 0) {
      n.duration = dur
      timers.set(id, setTimeout(() => dismiss(id), dur))
    }
  }
}

function loading(msg: string, opts?: Omit<NotificationOptions, 'loading'>) {
  return show(msg, 'info', { ...opts, loading: true, closable: opts?.closable ?? false })
}

const success = (msg: string, opts?: NotificationOptions) => show(msg, 'success', opts ?? {})
const error = (msg: string, opts?: NotificationOptions) => show(msg, 'error', opts ?? {})
const warning = (msg: string, opts?: NotificationOptions) => show(msg, 'warning', opts ?? {})
const info = (msg: string, opts?: NotificationOptions) => show(msg, 'info', opts ?? {})

export function useNotification() {
  return { notifications, position, show, success, error, warning, info, loading, update, dismiss }
}
