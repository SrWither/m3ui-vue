import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import MMenu from '../components/MMenu.vue'
import MContextMenu from '../components/MContextMenu.vue'
import MMenuItem from '../components/MMenuItem.vue'

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
// Long enough for the open spring to finish, so the close has real distance to cover
const settle = () => new Promise<void>((r) => setTimeout(r, 400))

describe('MMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('removes its panel from <body> when unmounted mid-close', async () => {
    // e.g. a "Log out" item: close() then router.push() unmounts the menu
    // while its close animation is still playing
    const show = ref(true)
    const menuRef = ref<InstanceType<typeof MMenu> | null>(null)
    mount(
      defineComponent({
        setup: () => () =>
          show.value
            ? h(MMenu, { ref: menuRef }, {
                trigger: () => h('button', { class: 'trigger' }, 'open'),
                default: () => h('span', { class: 'item' }, 'Log out'),
              })
            : null,
      }),
      { attachTo: document.body, global: { stubs: { transition: false } } },
    )

    document.querySelector<HTMLElement>('.trigger')!.click()
    await nextTick()
    expect(document.querySelector('.item')).not.toBeNull()
    await settle()

    menuRef.value!.close()
    await nextTick()
    await frame()
    show.value = false
    await nextTick()

    expect(document.querySelector('.item')).toBeNull()
  })

  describe('push submenus: swipe back', () => {
    let wrapper: ReturnType<typeof mount> | null = null
    afterEach(() => { wrapper?.unmount(); wrapper = null })
    const finishAnimations = () => document.querySelectorAll('*').forEach((el) => el.getAnimations().forEach((a) => a.finish()))

    async function openSubmenu() {
      wrapper = mount(
        defineComponent({
          setup: () => () =>
            h(MMenu, { submenuMode: 'push' }, {
              trigger: () => h('button', { class: 'trigger' }, 'open'),
              default: () => h(MMenuItem, null, {
                default: () => 'Share',
                children: () => h('span', { class: 'leaf' }, 'Email'),
              }),
            }),
        }),
        { attachTo: document.body, global: { stubs: { transition: false } } },
      )
      document.querySelector<HTMLElement>('.trigger')!.click()
      await nextTick()
      await settle()
      document.querySelector<HTMLElement>('[aria-haspopup="menu"]')!.click()
      await nextTick()
      const level = document.querySelector<HTMLElement>('[data-menu-level="1"]')!
      const box = level.parentElement!
      Object.defineProperty(box, 'clientWidth', { value: 300, configurable: true })
      return { box }
    }

    function swipe(box: HTMLElement, to: number, steps = 6) {
      const at = (type: string, x: number, target: EventTarget) =>
        target.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'touch', clientX: x, clientY: 100, bubbles: true }))
      at('pointerdown', 20, box)
      for (let i = 1; i <= steps; i++) at('pointermove', 20 + (to - 20) * i / steps, window)
      at('pointerup', to, window)
    }

    it('goes back to the parent level when swiped past a third of the panel', async () => {
      const { box } = await openSubmenu()
      expect(document.querySelector('.leaf')).not.toBeNull()
      expect(box.style.touchAction).toBe('pan-y')
      swipe(box, 160)
      await nextTick()
      finishAnimations()
      await nextTick()
      expect(document.querySelector('[data-menu-level]')).toBeNull()
      expect(document.querySelector('[aria-haspopup="menu"]')).not.toBeNull()
    })

    it('stays on the submenu after a short, slow swipe, and ignores a mouse drag', async () => {
      const { box } = await openSubmenu()
      const at = (type: string, x: number, target: EventTarget, t: number) =>
        target.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'touch', clientX: x, clientY: 100, bubbles: true, timeStamp: t } as PointerEventInit))
      at('pointerdown', 20, box, 0)
      at('pointermove', 40, window, 500)
      at('pointermove', 50, window, 1000)
      at('pointerup', 50, window, 1500)
      await nextTick()
      expect(document.querySelector('[data-menu-level="1"]')).not.toBeNull()

      box.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, pointerType: 'mouse', clientX: 20, clientY: 100, bubbles: true }))
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, pointerType: 'mouse', clientX: 250, clientY: 100 }))
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, pointerType: 'mouse', clientX: 250, clientY: 100 }))
      await nextTick()
      expect(document.querySelector('[data-menu-level="1"]')).not.toBeNull()
    })
  })
})

describe('MContextMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('removes its panel from <body> when unmounted mid-close', async () => {
    const show = ref(true)
    mount(
      defineComponent({
        setup: () => () =>
          show.value
            ? h(MContextMenu, null, {
                trigger: () => h('div', { class: 'area' }, 'right-click me'),
                default: () => h('span', { class: 'item' }, 'Delete'),
              })
            : null,
      }),
      { attachTo: document.body, global: { stubs: { transition: false } } },
    )

    document.querySelector('.area')!.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }),
    )
    await nextTick()
    expect(document.querySelector('.item')).not.toBeNull()
    await settle()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    await frame()
    show.value = false
    await nextTick()

    expect(document.querySelector('.item')).toBeNull()
  })
})

describe('menus on the Escape stack', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))

  it('a menu open in a dialog takes Escape alone; the next one closes the dialog', async () => {
    const { default: MDialog } = await import('../components/MDialog.vue')
    const dialog = mount(MDialog, {
      props: { modelValue: true, title: 'T' },
      slots: {
        default: () =>
          h(MMenu, null, {
            trigger: () => h('button', { class: 'trigger' }, 'open'),
            default: () => h('span', { class: 'item' }, 'Copy'),
          }),
      },
      attachTo: document.body,
    })
    await nextTick()
    document.querySelector<HTMLElement>('.trigger')!.click()
    await nextTick()

    escape()
    await nextTick()
    expect(dialog.emitted('update:modelValue')).toBeUndefined()

    escape()
    expect(dialog.emitted('update:modelValue')).toEqual([[false]])
    dialog.unmount()
  })
})
