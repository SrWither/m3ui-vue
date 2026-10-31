// Renders a slot function handed down as a prop (MFlow passes its `#node-<type>`/`#edge-<type>` slots to the
// internal components that draw each node and edge)
import type { FunctionalComponent, Slot } from 'vue'

export const SlotOutlet: FunctionalComponent<{ fn: Slot; scope: Record<string, unknown> }> = (p) => p.fn(p.scope)
SlotOutlet.props = ['fn', 'scope']
