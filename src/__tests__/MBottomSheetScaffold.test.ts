import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MBottomSheetScaffold from '../components/MBottomSheetScaffold.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

// happy-dom has no layout: the sheet is 400px tall, so partial (56px peek) sits at translateY 344
function setup(props: Record<string, unknown> = {}) {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.getAttribute('role') === 'region' ? 400 : 0
  })
  wrapper = mount(MBottomSheetScaffold, {
    props: { 'onUpdate:modelValue': (v: string) => wrapper!.setProps({ modelValue: v }), ...props },
    slots: { default: 'Body', sheet: '<p class="content">Sheet</p>' },
    attachTo: document.body,
  })
  return wrapper.find('[role="region"]').element as HTMLElement
}

const ty = (sheet: HTMLElement) => Number(/translateY\((-?[\d.]+)px\)/.exec(sheet.style.transform)?.[1])

// 25px per move, `ms` apart: the moves' timeStamp is what the release velocity is measured from
function drag(el: HTMLElement, dy: number, ms = 200) {
  let t = 1000
  const send = (type: string, y: number) => {
    const e = new PointerEvent(type, { pointerId: 1, button: 0, bubbles: true, clientX: 100, clientY: y })
    Object.defineProperty(e, 'timeStamp', { value: t })
    el.dispatchEvent(e)
  }
  send('pointerdown', 500)
  const steps = Math.ceil(Math.abs(dy) / 25)
  for (let i = 1; i <= steps; i++) {
    t += ms
    send('pointermove', 500 + (dy * i) / steps)
  }
  send('pointerup', 500 + dy)
}

describe('MBottomSheetScaffold', () => {
  it('peeks peekHeight of the sheet and pads the content by it', () => {
    const sheet = setup()
    expect(ty(sheet)).toBe(344)
    const body = wrapper!.find('.overflow-auto').element as HTMLElement
    expect(body.style.paddingBottom).toBe('56px')
  })

  it('expands when dragged up more than 56px, and stays when dragged less', () => {
    const sheet = setup()
    drag(sheet, -40)
    expect(wrapper!.emitted('update:modelValue')).toBeUndefined()
    drag(sheet, -80)
    expect(wrapper!.emitted('update:modelValue')).toEqual([['expanded']])
  })

  it('follows a fast flick even when it moved less than 56px', () => {
    const sheet = setup()
    drag(sheet, -30, 10)
    expect(wrapper!.emitted('update:modelValue')).toEqual([['expanded']])
  })

  it('cannot be swiped away by default, but can without skipHiddenState', () => {
    const sheet = setup()
    drag(sheet, 300)
    expect(wrapper!.emitted('update:modelValue')).toBeUndefined()
    wrapper!.unmount()
    const sheet2 = setup({ skipHiddenState: false })
    drag(sheet2, 100)
    expect(wrapper!.emitted('update:modelValue')).toEqual([['hidden']])
  })

  it('toggles between partial and expanded from the handle', async () => {
    setup()
    const handle = wrapper!.find('button')
    expect(handle.attributes('aria-label')).toBe('Expand bottom sheet')
    await handle.trigger('click')
    expect(wrapper!.emitted('update:modelValue')).toEqual([['expanded']])
    expect(handle.attributes('aria-label')).toBe('Collapse bottom sheet')
    await handle.trigger('click')
    expect(wrapper!.emitted('update:modelValue')!.at(-1)).toEqual(['partial'])
  })

  it('lets an expanded sheet scroll its content up instead of moving', async () => {
    const sheet = setup({ modelValue: 'expanded' })
    const content = sheet.querySelector('.content')!.parentElement as HTMLElement
    Object.defineProperty(content, 'scrollHeight', { value: 1000 })
    Object.defineProperty(content, 'clientHeight', { value: 300 })
    content.scrollTop = 200
    drag(content.firstElementChild as HTMLElement, 150)
    expect(wrapper!.emitted('update:modelValue')).toBeUndefined()
    // Back at the top of its content, a downward drag moves the sheet
    content.scrollTop = 0
    drag(content.firstElementChild as HTMLElement, 150)
    expect(wrapper!.emitted('update:modelValue')).toEqual([['partial']])
  })
})
