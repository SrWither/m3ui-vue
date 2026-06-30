import { ref, createApp, h } from 'vue'
import MSnackbar from '../components/MSnackbar.vue'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'
export type ToastPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface ToastAction { label: string; onClick: () => void }

export interface Toast {
  id: number
  message: string
  variant: ToastVariant
  duration: number
  loading?: boolean
  action?: ToastAction
  icon?: string | null  // null = suppress icon entirely
  color?: string
  count: number         // ≥ 2 → show badge
}

let nextId = 1
let mounted = false
const timers = new Map<number, ReturnType<typeof setTimeout>>()

const toasts = ref<Toast[]>([])
const position = ref<ToastPosition>('bottom-center')

function ensureMounted() {
  if (mounted || typeof document === 'undefined') return
  mounted = true
  const container = document.createElement('div')
  container.id = 'm3-toast-host'
  document.body.appendChild(container)
  createApp({ render: () => h(MSnackbar) }).mount(container)
}

function dismiss(id: number) {
  const timer = timers.get(id)
  if (timer) { clearTimeout(timer); timers.delete(id) }
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export interface ToastOptions {
  duration?: number
  loading?: boolean
  action?: ToastAction
  icon?: string | null
  color?: string
}

function show(
  message: string,
  variant: ToastVariant = 'info',
  options: number | ToastOptions = {},
) {
  ensureMounted()
  const opts = typeof options === 'number' ? { duration: options } : options
  const isLoading = opts.loading ?? false

  // Dedup: identical non-loading, non-action toasts increment count instead of stacking
  if (!isLoading && !opts.action) {
    const existing = toasts.value.find(
      t => t.message === message && t.variant === variant && !t.loading && !t.action,
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
  const duration = isLoading ? 0 : (opts.duration ?? (variant === 'error' ? 6000 : 4000))
  toasts.value.push({ id, message, variant, duration, loading: isLoading, action: opts.action, icon: opts.icon, color: opts.color, count: 1 })
  if (duration > 0) timers.set(id, setTimeout(() => dismiss(id), duration))
  return id
}

function update(id: number, patch: Partial<Omit<Toast, 'id'>>) {
  const t = toasts.value.find((t) => t.id === id)
  if (!t) return
  Object.assign(t, patch)
  if ('loading' in patch && !patch.loading) {
    const timer = timers.get(id)
    if (timer) clearTimeout(timer)
    const dur = patch.duration ?? 4000
    if (dur > 0) {
      t.duration = dur
      timers.set(id, setTimeout(() => dismiss(id), dur))
    }
  }
}

function loading(msg: string, opts?: Omit<ToastOptions, 'loading'>) {
  return show(msg, 'info', { ...opts, loading: true })
}

const success = (msg: string, opts?: ToastOptions) => show(msg, 'success', opts ?? {})
const error = (msg: string, opts?: ToastOptions) => show(msg, 'error', opts ?? {})
const warning = (msg: string, opts?: ToastOptions) => show(msg, 'warning', opts ?? {})
const info = (msg: string, opts?: ToastOptions) => show(msg, 'info', opts ?? {})

export function useToast() {
  return { toasts, position, show, success, error, warning, info, loading, update, dismiss }
}
