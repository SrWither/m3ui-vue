import { describe, it, expect, beforeEach } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import MMenu from '../components/MMenu.vue'
import MContextMenu from '../components/MContextMenu.vue'

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
