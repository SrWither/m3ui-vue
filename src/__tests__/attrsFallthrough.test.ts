import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, type Component } from 'vue'
import MMenu from '../components/MMenu.vue'
import MContextMenu from '../components/MContextMenu.vue'
import MTooltip from '../components/MTooltip.vue'
import MFab from '../components/MFab.vue'
import MSplitButton from '../components/MSplitButton.vue'
import MLightbox from '../components/MLightbox.vue'
import MBarcode from '../components/MBarcode.vue'
import MLoadingOverlay from '../components/MLoadingOverlay.vue'
import MNavigationDrawer from '../components/MNavigationDrawer.vue'
import MNavigationRail from '../components/MNavigationRail.vue'
import MSkeleton from '../components/MSkeleton.vue'
import MStepper from '../components/MStepper.vue'
import MTabs from '../components/MTabs.vue'
import MTransferList from '../components/MTransferList.vue'

// These components render more than one root node (an element plus a Teleport, a v-if/v-show
// pair, a comment before the root...), which makes Vue drop a consumer's class/attrs silently.
// Each case names the element that should receive them.
const cases: [name: string, component: Component, props: Record<string, unknown>, tag: string][] = [
  ['MMenu', MMenu, {}, 'DIV'],
  ['MContextMenu', MContextMenu, {}, 'DIV'],
  ['MTooltip', MTooltip, { text: 'Tip' }, 'SPAN'],
  ['MFab', MFab, { icon: 'add' }, 'DIV'],
  ['MSplitButton', MSplitButton, { label: 'Save' }, 'DIV'],
  ['MLightbox', MLightbox, { modelValue: false, items: [] }, 'DIV'],
  ['MBarcode', MBarcode, { value: '123456789012', displayValue: false }, 'svg'],
  ['MBarcode (error)', MBarcode, { value: 'abc', format: 'EAN13', displayValue: false }, 'DIV'],
  ['MLoadingOverlay', MLoadingOverlay, { visible: true }, 'DIV'],
  ['MLoadingOverlay (fullscreen)', MLoadingOverlay, { visible: true, fullscreen: true }, 'DIV'],
  ['MNavigationDrawer', MNavigationDrawer, { modelValue: true, sections: [] }, 'NAV'],
  ['MNavigationDrawer (modal)', MNavigationDrawer, { modelValue: true, sections: [], modal: true }, 'NAV'],
  ['MNavigationRail', MNavigationRail, { modelValue: 'a', items: [] }, 'NAV'],
  ['MNavigationRail (modal)', MNavigationRail, { modelValue: 'a', items: [], modal: true }, 'NAV'],
  ['MSkeleton', MSkeleton, {}, 'DIV'],
  ['MSkeleton (lines)', MSkeleton, { variant: 'text', lines: 3 }, 'DIV'],
  ['MStepper', MStepper, { steps: [{ label: 'One' }], modelValue: 0 }, 'DIV'],
  ['MStepper (vertical)', MStepper, { steps: [{ label: 'One' }], modelValue: 0, direction: 'vertical' }, 'DIV'],
  ['MTabs', MTabs, { modelValue: 'a', tabs: [{ value: 'a', label: 'A' }] }, 'DIV'],
  ['MTabs (secondary)', MTabs, { modelValue: 'a', tabs: [{ value: 'a', label: 'A' }], variant: 'secondary' }, 'DIV'],
  ['MTransferList', MTransferList, { modelValue: [], items: [] }, 'DIV'],
]

describe('consumer attrs reach multi-root components', () => {
  let wrapper: VueWrapper | null = null
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it.each(cases)('%s', async (_name, component, props, tag) => {
    wrapper = mount(component, {
      props,
      attrs: { class: 'consumer-class', 'data-consumer': 'yes' },
      attachTo: document.body,
    })
    await nextTick()
    const matches = document.body.querySelectorAll('[data-consumer="yes"]')
    expect(matches).toHaveLength(1)
    expect(matches[0].tagName).toBe(tag)
    expect(matches[0].classList.contains('consumer-class')).toBe(true)
  })
})
