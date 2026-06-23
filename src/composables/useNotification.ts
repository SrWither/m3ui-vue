import { ref, createApp, h } from 'vue'
import MNotificationHost from '../components/MNotificationHost.vue'

export type NotificationVariant = 'info' | 'success' | 'warning' | 'error'
export type NotificationPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface Notification {
  id: number
  message: string
  variant: NotificationVariant
  duration: number
  loading?: boolean
  icon?: string
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
  icon?: string
}

function show(
  message: string,
  variant: NotificationVariant = 'info',
  options: NotificationOptions = {},
) {
  ensureMounted()
  const id = nextId++
  const isLoading = options.loading ?? false
  const duration = isLoading ? 0 : (options.duration ?? 3000)
  notifications.value.push({ id, message, variant, duration, loading: isLoading, icon: options.icon })
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
  return show(msg, 'info', { ...opts, loading: true })
}

const success = (msg: string, opts?: NotificationOptions) => show(msg, 'success', opts ?? {})
const error = (msg: string, opts?: NotificationOptions) => show(msg, 'error', opts ?? {})
const warning = (msg: string, opts?: NotificationOptions) => show(msg, 'warning', opts ?? {})
const info = (msg: string, opts?: NotificationOptions) => show(msg, 'info', opts ?? {})

export function useNotification() {
  return { notifications, position, show, success, error, warning, info, loading, update, dismiss }
}
