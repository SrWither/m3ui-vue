<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import MIcon from './MIcon.vue'
import MBadge from './MBadge.vue'

export interface NavRailItem {
  value: string | number
  label: string
  icon: string
  badge?: number
  badgeDot?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: string | number
  items: NavRailItem[]
  alignment?: 'top' | 'center' | 'bottom'
  /** M3 `WideNavigationRail`'s expanded state: items become icon+label side by side in a full-width pill instead of icon-over-label in a narrow centered one. */
  expanded?: boolean
  /**
   * M3 `ModalWideNavigationRail` (default `hideOnCollapse = false` variant — not the
   * dismissible, slide-from-offscreen one). Instead of this rail itself resizing between
   * collapsed/expanded, the collapsed rail stays on screen exactly as-is (so it never
   * affects the app's layout grid — `ModalWideNavigationRail`'s whole point) and `expanded`
   * instead opens a Teleported, scrim-backed panel that floats above the rest of the app.
   */
  modal?: boolean
}>(), { alignment: 'top', expanded: false, modal: false })

const emit = defineEmits<{
  'update:modelValue': [string | number]
  'update:expanded': [boolean]
}>()

// The inline rail never itself expands in modal mode — see `modal` prop doc above.
const railExpanded = computed(() => !props.modal && props.expanded)

/*
 * The modal panel's items animate through the exact same collapsed->expanded item
 * transition as the non-modal rail (pill grows, label slides out from under the icon) —
 * NOT pre-rendered already-expanded and just revealed by the panel's width wipe. Since the
 * panel only exists in the DOM while `expanded` is true (v-if), binding items directly to
 * `expanded` would have them mount already in their expanded state with nothing to
 * transition from. `panelExpanded` starts false on every mount and flips true a couple
 * frames later (see onPanelEnter) so the item-level CSS transition actually has a
 * collapsed -> expanded change to animate, running alongside (not instead of) the panel's
 * own width spring.
 */
const panelExpanded = ref(false)

function close() {
  emit('update:expanded', false)
}
function selectModal(item: NavRailItem) {
  if (item.disabled) return
  emit('update:modelValue', item.value)
  close()
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

/*
 * Modal panel open/close: a real width spring (rAF + semi-implicit Euler), not a CSS
 * transition — same convention as MProgressBar/MTabs/etc (see CLAUDE.md). Values are
 * `MotionSchemeKeyTokens.FastSpatial` (Standard scheme: dampingRatio 0.9, stiffness 1400 —
 * `WideNavigationRailLayout` uses this exact token for the modal variant's width animation,
 * vs `DefaultSpatial` for the non-modal inline rail). damping 0.9 is just underdamped enough
 * to produce the slight overshoot/bounce M3's modal rail has on open, which a CSS easing
 * curve can't reproduce (it can't overshoot past its own end value and settle back).
 * The panel wipes from 0 to its full width like a curtain reveal — content is already laid
 * out at full (expanded) size and is simply clipped by the panel's own `overflow-hidden`
 * width, rather than each item's pill separately animating like the non-modal rail's does.
 */
const PANEL_WIDTH = 220
const SPRING_DAMPING = 0.9
const SPRING_STIFFNESS = 1400

// Guards against two overlapping spring loops fighting over the same element's
// `style.width` (e.g. a close fired before a still-running open settles) — each call gets
// a token, and a loop quietly stops as soon as a newer call supersedes it instead of
// continuing to write stale values.
const springTokens = new WeakMap<HTMLElement, number>()

function springWidth(el: HTMLElement, from: number, to: number, done?: () => void) {
  const token = (springTokens.get(el) ?? 0) + 1
  springTokens.set(el, token)
  let pos = from
  let vel = 0
  let last = performance.now()
  const start = last
  el.style.width = `${from}px`
  function finish() {
    el.style.width = `${to}px`
    done?.()
  }
  function tick(now: number) {
    if (springTokens.get(el) !== token) return
    const dt = Math.min((now - last) / 1000, 1 / 30)
    last = now
    const accel = -SPRING_STIFFNESS * (pos - to) - 2 * SPRING_DAMPING * Math.sqrt(SPRING_STIFFNESS) * vel
    vel += accel * dt
    pos += vel * dt
    el.style.width = `${pos}px`
    // Settled normally, or a safety net in case rAF stalls/throttles badly enough that the
    // spring can't converge in reasonable real time (e.g. a backgrounded tab) — either way
    // the panel must never get stuck mid-animation forever.
    if ((Math.abs(pos - to) < 0.5 && Math.abs(vel) < 5) || now - start > 1000) {
      finish()
      return
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function onPanelEnter(el: Element, done: () => void) {
  const panel = (el as HTMLElement).querySelector<HTMLElement>('.wnr-panel')
  const scrim = (el as HTMLElement).querySelector<HTMLElement>('.wnr-scrim')
  panelExpanded.value = false
  if (scrim) {
    scrim.style.opacity = '0'
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrim.style.opacity = '1'
      panelExpanded.value = true
    }))
  } else {
    panelExpanded.value = true
  }
  if (panel) springWidth(panel, 0, PANEL_WIDTH, done)
  else done()
}
function onPanelLeave(el: Element, done: () => void) {
  const panel = (el as HTMLElement).querySelector<HTMLElement>('.wnr-panel')
  const scrim = (el as HTMLElement).querySelector<HTMLElement>('.wnr-scrim')
  panelExpanded.value = false
  if (scrim) scrim.style.opacity = '0'
  if (panel) springWidth(panel, PANEL_WIDTH, 0, done)
  else done()
}

watch(
  () => props.modal && props.expanded,
  (open) => {
    if (open) {
      document.addEventListener('keydown', onKeydown)
      document.body.style.overflow = 'hidden'
    } else {
      document.removeEventListener('keydown', onKeydown)
      document.body.style.overflow = ''
    }
  },
)

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  if (props.modal && props.expanded) document.body.style.overflow = ''
})
</script>

<template>
  <!--
    Inline rail: stays collapsed and in-flow at all times when `modal` is true — the real
    ModalWideNavigationRail's collapsed rail is never affected by the modal panel opening,
    so this half of the template intentionally reads `railExpanded` (forced false under
    `modal`), not the raw `expanded` prop. The Teleported modal panel below is the part
    that actually reacts to `expanded` when `modal` is set.
  -->
  <nav
    class="flex h-full flex-col border-r border-outline-variant bg-surface transition-[width] duration-200"
    :class="railExpanded ? 'w-[220px]' : 'w-20'"
  >
    <!--
      Header slot: menu-toggle button and/or FAB. Left-anchored (not `items-center`) inside
      a fixed 56px box, same technique as MNavigationDrawer's `.nd-toggle-inner` — `items-center`
      would re-center against the *header's own* width, which changes a lot between collapsed
      (80px rail) and expanded (220px rail), making the button visibly jump sideways when toggling.
      A fixed-width box pinned to the same left inset as the items below stays put regardless.
    -->
    <div v-if="$slots.fab" class="flex shrink-0 flex-col items-start gap-2 px-3 pt-3 pb-2">
      <div class="flex h-10 w-14 shrink-0 items-center justify-center">
        <slot name="fab" />
      </div>
    </div>

    <!-- Items -->
    <div
      class="flex flex-1 flex-col gap-1 px-3 py-3"
      :class="{
        'justify-start': alignment === 'top',
        'justify-center': alignment === 'center',
        'justify-end': alignment === 'bottom',
      }"
    >
      <button
        v-for="item in items"
        :key="item.value"
        type="button"
        class="group relative block h-16 w-full cursor-pointer focus-visible:outline-none"
        :class="item.disabled ? 'cursor-not-allowed opacity-[0.38]' : ''"
        :disabled="item.disabled"
        @click="!item.disabled && $emit('update:modelValue', item.value)"
      >
        <!--
          Row height is a constant 64dp (NavigationRailBaselineItemTokens.ContainerHeight)
          in BOTH modes so toggling `expanded` never reflows sibling items — only the pill
          and label (below) resize/reposition *within* that fixed-height row.

          The pill's own top/height offsets always use fixed pixel values (top-1.5/h-8 vs
          top-1/h-14), never percentage-based centering (top-1/2 + -translate-y-1/2) — that
          resolves relative to the element's OWN size, which is also mid-transition, so mixing
          it with an animating height makes the icon appear to snap to a center point and drift
          as the box resizes, instead of a single clean interpolation.

          Expanded width is intentionally NOT `w-full`: NavigationRailBaselineItemTokens'
          ActiveIndicatorLeadingSpace/ActiveIndicatorTrailingSpace are 16dp each (pl-4/pr-4
          below) around icon+label, not a bar stretched to the rail's own width — the pill is
          meant to hug its content, leaving empty space in the rail after a short label like
          "Home", exactly like the real WideNavigationRailItem. Nesting the label INSIDE the
          pill (rather than a separately absolutely-positioned span) is what makes that
          hugging automatic: as the label's own overflow-hidden box animates its width from 0,
          the pill (inline-flex, no explicit width) resizes right along with it via ordinary
          flex layout — no separate width bookkeeping needed. The pill is always left-anchored
          with a constant `pl-4`, so the icon's horizontal position never moves at all.
        -->
        <span
          class="absolute left-0 inline-flex items-center pl-4 rounded-full transition-all duration-200"
          :class="[
            railExpanded ? 'top-1 h-14 pr-4' : 'top-1.5 h-8 w-14',
            item.value === modelValue
              ? 'bg-secondary-container text-on-secondary-container'
              : 'bg-transparent text-on-surface-variant group-hover:bg-on-surface/8',
          ]"
        >
          <MBadge v-if="item.badge != null" :count="item.badge">
            <MIcon :name="item.icon" :size="24" />
          </MBadge>
          <MBadge v-else-if="item.badgeDot" dot>
            <MIcon :name="item.icon" :size="24" />
          </MBadge>
          <MIcon v-else :name="item.icon" :size="24" />

          <!--
            Label, expanded: revealed through an `overflow-hidden` box whose width (and
            margin, so it doesn't leave a gap when collapsed) grows left-to-right out of the
            icon's edge, so the text reads as emerging out of the icon rather than fading in
            in place. Text itself never moves — only the clipping box's width animates.
            Animating `max-width` rather than `width` (up to a generous 200px cap, well past
            any realistic label) is what lets the box settle at the label's own intrinsic
            width once expanded — a plain `width` transition would need a fixed end value,
            which is exactly the old bug: every label reveal stopped at the same hardcoded
            130px regardless of text length, leaving dead space in the pill after a short
            label like "Home" instead of hugging it. `whitespace-nowrap` plus `inline-block`
            keep it shrink-to-fit and from reflowing as max-width changes. Opacity animates
            alongside it so collapsing reads as fading out while it shrinks, rather than
            staying solid until the box clips it. Its own text color intentionally differs from
            the pill's (`text-secondary` vs the pill's `text-on-secondary-container`) — M3's
            `ItemActiveLabelTextColor` is a different token from `ItemActiveIconColor`.
          -->
          <span
            class="inline-block overflow-hidden whitespace-nowrap text-left text-label-large font-medium transition-[max-width,opacity,margin-left] duration-200"
            :class="[
              railExpanded ? 'ml-2 max-w-[200px] opacity-100' : 'ml-0 max-w-0 opacity-0',
              item.value === modelValue ? 'text-secondary' : 'text-on-surface-variant',
            ]"
          >
            {{ item.label }}
          </span>
        </span>

        <!-- Label, collapsed: stays put below the icon, just fades out when expanding -->
        <span
          class="pointer-events-none absolute left-0 top-[42px] w-14 truncate text-center text-label-medium font-medium transition-opacity duration-150"
          :class="[
            railExpanded ? 'opacity-0' : 'opacity-100',
            item.value === modelValue ? 'text-secondary' : 'text-on-surface-variant',
          ]"
        >
          {{ item.label }}
        </span>
      </button>
    </div>
  </nav>

  <!--
    Modal panel: ModalWideNavigationRail's expanded state (default hideOnCollapse=false
    variant). Floats above the app with its own scrim — `NavigationRailExpandedTokens`:
    ModalContainerColor = surface-container, ModalContainerElevation = Level2. Flush against
    the screen edge (`inset-y-0 left-0`), same as the collapsed rail and MNavigationDrawer —
    confirmed against the real M3 demo app/reference video, not floating with a margin as an
    earlier version of this comment assumed from the token name alone. Only the far (right)
    corners are rounded (`rounded-r-lg`): rounding the near/screen-edge corners too would be
    invisible anyway since they're flush against the viewport edge. Item markup below is
    intentionally a near-duplicate of the inline rail's (see the top-of-file "not DRY" note
    in CLAUDE.md for pickers/modals) — check here too if fixing a pill/label bug above.
  -->
  <Teleport v-if="modal" to="body">
    <Transition :css="false" @enter="onPanelEnter" @leave="onPanelLeave">
      <div v-if="expanded" class="fixed inset-0 z-100" @keydown.escape="close">
        <div class="wnr-scrim absolute inset-0 bg-scrim/40" @click="close" />

        <nav
          class="wnr-panel fixed inset-y-0 left-0 z-10 flex flex-col overflow-hidden rounded-r-lg bg-surface-container shadow-elevation-2"
        >
          <div v-if="$slots.fab" class="flex shrink-0 flex-col items-start gap-2 px-3 pt-3 pb-2">
            <div class="flex h-10 w-14 shrink-0 items-center justify-center">
              <slot name="fab" />
            </div>
          </div>

          <div
            class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3"
            :class="{
              'justify-start': alignment === 'top',
              'justify-center': alignment === 'center',
              'justify-end': alignment === 'bottom',
            }"
          >
            <!--
              Items animate collapsed -> expanded exactly like the inline rail's (see the
              comment on that block above) driven by `panelExpanded` instead of
              `railExpanded` — see the `panelExpanded` doc in <script> for why the panel
              can't just bind to `expanded` directly. Keep any pill/label fix in sync
              between the two copies.
            -->
            <button
              v-for="item in items"
              :key="item.value"
              type="button"
              class="group relative block h-16 w-full shrink-0 cursor-pointer focus-visible:outline-none"
              :class="item.disabled ? 'cursor-not-allowed opacity-[0.38]' : ''"
              :disabled="item.disabled"
              @click="selectModal(item)"
            >
              <span
                class="absolute left-0 inline-flex items-center pl-4 rounded-full transition-all duration-200"
                :class="[
                  panelExpanded ? 'top-1 h-14 pr-4' : 'top-1.5 h-8 w-14',
                  item.value === modelValue
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'bg-transparent text-on-surface-variant group-hover:bg-on-surface/8',
                ]"
              >
                <MBadge v-if="item.badge != null" :count="item.badge">
                  <MIcon :name="item.icon" :size="24" />
                </MBadge>
                <MBadge v-else-if="item.badgeDot" dot>
                  <MIcon :name="item.icon" :size="24" />
                </MBadge>
                <MIcon v-else :name="item.icon" :size="24" />

                <span
                  class="inline-block overflow-hidden whitespace-nowrap text-left text-label-large font-medium transition-[max-width,opacity,margin-left] duration-200"
                  :class="[
                    panelExpanded ? 'ml-2 max-w-[200px] opacity-100' : 'ml-0 max-w-0 opacity-0',
                    item.value === modelValue ? 'text-secondary' : 'text-on-surface-variant',
                  ]"
                >
                  {{ item.label }}
                </span>
              </span>

              <!-- Label, collapsed: stays put below the icon, just fades out when expanding -->
              <span
                class="pointer-events-none absolute left-0 top-[42px] w-14 truncate text-center text-label-medium font-medium transition-opacity duration-150"
                :class="[
                  panelExpanded ? 'opacity-0' : 'opacity-100',
                  item.value === modelValue ? 'text-secondary' : 'text-on-surface-variant',
                ]"
              >
                {{ item.label }}
              </span>
            </button>
          </div>
        </nav>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/*
 * Panel width is driven entirely by the JS spring in onPanelEnter/onPanelLeave (see
 * <script>) — this is only the scrim's fade, a plain CSS transition since it's a
 * non-spatial color/alpha change (M3's "effects" motion, as opposed to the panel's
 * "spatial" width spring). JS just flips `.wnr-scrim`'s opacity; this rule is what
 * actually animates that change.
 */
.wnr-scrim {
  transition: opacity 220ms ease;
}
</style>
