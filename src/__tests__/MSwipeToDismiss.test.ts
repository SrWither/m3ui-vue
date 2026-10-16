import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import MSwipeToDismiss from '../components/MSwipeToDismiss.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

const wait = (ms = 600) => new Promise((r) => setTimeout(r, ms))

describe('MSwipeToDismiss', () => {
  function setup(props: Record<string, unknown> = {}) {
    wrapper = mount(MSwipeToDismiss, {
      props,
      slots: { default: () => h('div', 'Row'), background: ({ target }: { target: string }) => h('span', { class: 'bg' }, target) },
      attachTo: document.body,
    })
    Object.defineProperty(wrapper.element, 'offsetWidth', { value: 300, configurable: true })
    return wrapper
  }
  function drag(el: Element, dx: number, durationMs: number) {
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 10, button: 0, pointerId: 1, bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100 + dx / 2, clientY: 10, pointerId: 1, timeStamp: 0 } as PointerEventInit))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100 + dx, clientY: 10, pointerId: 1 }))
    return new Promise<void>((r) => setTimeout(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 100 + dx, clientY: 10, pointerId: 1 }))
      r()
    }, durationMs))
  }

  // Slowly (under the 125px/s fling velocity) and still moving when released, so the 56px threshold decides
  async function slowDrag(el: Element, dx: number) {
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 10, button: 0, pointerId: 1, bubbles: true }))
    const steps = 10
    for (let i = 1; i <= steps; i++) {
      await wait(60)
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100 + (dx * i) / steps, clientY: 10, pointerId: 1 }))
    }
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 100 + dx, clientY: 10, pointerId: 1 }))
  }

  it('dismisses past the 56px threshold', async () => {
    const w = setup()
    await slowDrag(w.element, -80)
    await nextTick()
    expect(w.find('.bg').text()).toBe('end-to-start')
    await wait(400)
    expect(w.emitted('dismiss')?.[0]).toEqual(['end-to-start'])
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['end-to-start'])
  })

  it('springs back from a short swipe', async () => {
    const w = setup()
    await slowDrag(w.element, 30)
    await wait(400)
    expect(w.emitted('dismiss')).toBeUndefined()
    expect((w.element.lastElementChild as HTMLElement).style.transform).toBe('')
  })

  it('a quick flick dismisses even a short swipe', async () => {
    const w = setup()
    await drag(w.element, 30, 10)
    await wait(400)
    expect(w.emitted('dismiss')?.[0]).toEqual(['start-to-end'])
  })

  it('only swipes in the allowed directions', async () => {
    const w = setup({ endToStart: false })
    await drag(w.element, -120, 300)
    await wait(400)
    expect(w.emitted('dismiss')).toBeUndefined()
  })

  it('slides back when v-model is reset from inside @dismiss', async () => {
    const state = ref<'settled' | 'start-to-end' | 'end-to-start'>('settled')
    wrapper = mount(defineComponent({
      setup: () => () => h(MSwipeToDismiss, {
        modelValue: state.value,
        'onUpdate:modelValue': (v: typeof state.value) => { state.value = v },
        onDismiss: () => { state.value = 'settled' },
      }, () => h('div', 'Row')),
    }), { attachTo: document.body })
    const root = wrapper.find('.touch-pan-y').element
    Object.defineProperty(root, 'offsetWidth', { value: 300, configurable: true })
    await drag(root, 30, 10)
    await wait(800)
    expect(state.value).toBe('settled')
    expect((root.lastElementChild as HTMLElement).style.transform).toBe('')
  })

  it('animates back when v-model is reset', async () => {
    const w = setup()
    await w.setProps({ modelValue: 'start-to-end' })
    await wait(400)
    expect((w.element.lastElementChild as HTMLElement).style.transform).toBe('translateX(300px)')
    await w.setProps({ modelValue: 'settled' })
    await wait(400)
    expect((w.element.lastElementChild as HTMLElement).style.transform).toBe('')
  })
})
