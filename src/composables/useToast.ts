import { ref } from 'vue'

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
  action?: ToastAction
}

let nextId = 1

const toasts = ref<Toast[]>([])
const position = ref<ToastPosition>('bottom-center')

function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

function show(
  message: string,
  variant: ToastVariant = 'info',
  options: number | { duration?: number; action?: ToastAction } = {},
) {
  const id = nextId++
  const opts = typeof options === 'number' ? { duration: options } : options
  const duration = opts.duration ?? (variant === 'error' ? 6000 : 4000)
  toasts.value.push({ id, message, variant, duration, action: opts.action })
  if (duration > 0) setTimeout(() => dismiss(id), duration)
  return id
}

const success = (msg: string, opts?: { duration?: number; action?: ToastAction }) =>
  show(msg, 'success', opts ?? {})
const error = (msg: string, opts?: { duration?: number; action?: ToastAction }) =>
  show(msg, 'error', opts ?? {})
const warning = (msg: string, opts?: { duration?: number; action?: ToastAction }) =>
  show(msg, 'warning', opts ?? {})
const info = (msg: string, opts?: { duration?: number; action?: ToastAction }) =>
  show(msg, 'info', opts ?? {})

export function useToast() {
  return { toasts, position, show, success, error, warning, info, dismiss }
}
