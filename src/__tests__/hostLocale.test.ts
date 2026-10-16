import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

// useToast() and useNotification() mount their hosts in an app of their own, which doesn't see the
// locale createM3UI() provides to the user's app. The modules keep state (the host is mounted once),
// so each test imports fresh copies.
beforeEach(() => {
  vi.resetModules()
  document.body.innerHTML = ''
})

async function setup(locale: Parameters<typeof import('../plugin').createM3UI>[0]['locale']) {
  const { createM3UI } = await import('../plugin')
  const app = createApp(defineComponent({ render: () => h('div') }))
  app.use(createM3UI({ locale }))
  app.mount(document.createElement('div'))
}

describe('toast and notification hosts follow the app locale', () => {
  it('toast close button uses the locale from createM3UI', async () => {
    await setup({ close: 'Cerrar' })
    const { useToast } = await import('../composables/useToast')
    useToast().info('Hola')
    await nextTick()
    const close = document.querySelector('#m3-toast-host button[aria-label]')
    expect(close?.getAttribute('aria-label')).toBe('Cerrar')
  })

  it('notification close button is labelled, in the locale from createM3UI', async () => {
    await setup({ close: 'Fermer' })
    const { useNotification } = await import('../composables/useNotification')
    useNotification().info('Bonjour')
    await nextTick()
    const host = document.body.lastElementChild!
    const close = [...host.querySelectorAll('button')].find((b) => b.querySelector('.material-symbols-outlined')?.textContent?.trim() === 'close')
    expect(close?.getAttribute('aria-label')).toBe('Fermer')
  })

  it('follows a ref locale when it changes', async () => {
    const locale = ref({ close: 'Cerrar' })
    await setup(locale)
    const { useToast } = await import('../composables/useToast')
    useToast().info('Hola')
    await nextTick()
    locale.value = { close: 'Schließen' }
    await nextTick()
    expect(document.querySelector('#m3-toast-host button[aria-label]')?.getAttribute('aria-label')).toBe('Schließen')
  })

  it('stays English without a locale', async () => {
    await setup(undefined)
    const { useToast } = await import('../composables/useToast')
    useToast().info('Hi')
    await nextTick()
    expect(document.querySelector('#m3-toast-host button[aria-label]')?.getAttribute('aria-label')).toBe('Close')
  })
})
