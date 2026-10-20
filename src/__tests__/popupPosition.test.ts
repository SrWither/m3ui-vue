import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import MMenu from '../components/MMenu.vue'
import MMenuItem from '../components/MMenuItem.vue'
import { dropdownX, fitPopup } from '../composables/_popupPosition'

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) }) as DOMRect

describe('dropdownX (Compose DropdownMenuPositionProvider)', () => {
  const anchor = { left: 300, right: 340 }
  it('aligns with the asked edge when it fits, else the other, else the window edge on the anchor\'s side', () => {
    expect(dropdownX(anchor, 100, 1000, 'start')).toBe(300)
    expect(dropdownX(anchor, 100, 1000, 'end')).toBe(240)
    // Near the left edge: the end edge would overflow, so the start one
    expect(dropdownX({ left: 10, right: 40 }, 200, 360, 'end')).toBe(10)
    // Near the right edge: the start edge would overflow, so the end one
    expect(dropdownX({ left: 320, right: 350 }, 200, 360, 'start')).toBe(150)
    // Neither: against the window edge on the anchor's side
    expect(dropdownX({ left: 150, right: 180 }, 300, 360, 'start')).toBe(8)
    expect(dropdownX({ left: 200, right: 230 }, 300, 360, 'start')).toBe(52)
  })
  it('centers a popup wider than the window minus its margins', () => {
    expect(fitPopup([0, 10], 400, 360)).toBe(-20)
  })
})

describe('MMenu stays on screen', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(360)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(700)
    // Every panel measures 200 × 150
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(150)
  })
  afterEach(() => vi.restoreAllMocks())

  const open = async (trigger: DOMRect, align?: 'left' | 'right') => {
    mount(
      defineComponent({
        setup: () => () =>
          h(MMenu, { align }, {
            trigger: () => h('button', { class: 'trigger' }, 'open'),
            default: () => [
              h(MMenuItem, null, () => 'Story'),
              h(MMenuItem, null, { default: () => 'More', children: () => h(MMenuItem, null, () => 'Nested') }),
            ],
          }),
      }),
      { attachTo: document.body, global: { stubs: { transition: false } } },
    )
    const t = document.querySelector<HTMLElement>('.trigger')!
    t.parentElement!.getBoundingClientRect = () => trigger
    t.click()
    await nextTick()
    await nextTick()
    return document.querySelector<HTMLElement>('.fixed.z-500')!
  }

  it('a right-aligned menu on a trigger near the left edge opens rightwards instead of off screen', async () => {
    // The issue tracker's type button: right-aligned by default, 10px from the left edge of a phone
    const panel = await open(rect(10, 100, 30, 30))
    expect(panel.style.left).toBe('10px')
    expect(panel.style.right).toBe('')
    expect(panel.style.transformOrigin).toBe('left top')
  })

  it('a left-aligned menu near the right edge flips to the trigger\'s right edge', async () => {
    const panel = await open(rect(320, 100, 30, 30), 'left')
    expect(panel.style.left).toBe('150px')
    expect(panel.style.transformOrigin).toBe('right top')
  })

  it('caps its width at the window minus the margins', async () => {
    const panel = await open(rect(10, 100, 30, 30))
    expect(panel.style.maxWidth).toBe('344px')
  })

  it('opening above grows from the bottom', async () => {
    const panel = await open(rect(10, 650, 30, 30))
    expect(panel.style.bottom).toBe('54px')
    expect(panel.style.transformOrigin).toBe('left bottom')
  })

  it('a flyout submenu that fits on neither side of its item is clamped on screen', async () => {
    const panel = await open(rect(150, 100, 30, 30))
    const more = [...panel.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent?.includes('More'))!
    // The item spans 150–350
    more.closest<HTMLElement>('div')!.getBoundingClientRect = () => rect(150, 140, 200, 40)
    more.click()
    await nextTick()
    await nextTick()
    const sub = document.querySelector<HTMLElement>('.m3-submenu')!
    // Right of it (350) overflows a 360px window; its left (150 - 200 = -50) too: clamped to the margin
    expect(sub.style.left).toBe('8px')
    expect(sub.style.top).toBe('140px')
  })
})
