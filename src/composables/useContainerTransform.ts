import { ref, shallowRef, type ComponentPublicInstance, type Ref, type ShallowRef } from 'vue'

/** What a container transform opens from: a click (its element), an element, or a component */
export type ContainerTransformOrigin = Event | Element | ComponentPublicInstance | null | undefined

/** The state MContainerTransform plays, shared between the elements that open it and the panel they open */
export interface ContainerTransformController<T = unknown> {
  /** Whether the expanded view is open (or opening) */
  isOpen: Ref<boolean>
  /** What `open` was given, for the expanded view to show */
  item: Ref<T | undefined>
  /** The element it grows from and shrinks back into */
  source: ShallowRef<HTMLElement | null>
  /** Opens from `origin` (a click's element, an element or a component), with an optional `item` */
  open: (origin?: ContainerTransformOrigin, item?: T) => void
  /** Shrinks the expanded view back into the element it opened from */
  close: () => void
}

/** The element an origin stands for: a click's `currentTarget` (or `target`), a component's root element */
export function originElement(origin: ContainerTransformOrigin): HTMLElement | null {
  if (!origin) return null
  if (typeof Event !== 'undefined' && origin instanceof Event) {
    return ((origin.currentTarget as HTMLElement | null) ?? (origin.target as HTMLElement | null)) || null
  }
  if (typeof Element !== 'undefined' && origin instanceof Element) return origin as HTMLElement
  const el = (origin as ComponentPublicInstance).$el
  return el instanceof Element ? (el as HTMLElement) : null
}

/**
 * Material's container transform for elements that live apart from their expanded view: one controller, many
 * elements opening it (a grid of cards), and one `<MContainerTransform :controller>` wherever the expanded view
 * belongs. `open(event, item)` from a click grows that element into the expanded view, with `item` for it to show.
 *
 * ```ts
 * const detail = useContainerTransform<Recipe>()
 * // <MCard v-for="r in recipes" @click="detail.open($event, r)">…</MCard>
 * // <MContainerTransform :controller="detail"><template #expanded="{ item }">…</template></MContainerTransform>
 * ```
 */
export function useContainerTransform<T = unknown>(): ContainerTransformController<T> {
  const isOpen = ref(false)
  const item = ref<T>() as Ref<T | undefined>
  const source = shallowRef<HTMLElement | null>(null)
  return {
    isOpen,
    item,
    source,
    open(origin, value) {
      source.value = originElement(origin) ?? source.value
      item.value = value
      isOpen.value = true
    },
    close() {
      isOpen.value = false
    },
  }
}
