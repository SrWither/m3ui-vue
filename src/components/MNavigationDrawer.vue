<script setup lang="ts">
/**
 * A slide-out or inline drawer of grouped, badge-able, optionally-nested navigation items — modal (Teleported,
 * scrim-backed, swiped closed toward its edge) or inline (participates in layout, supports a collapsed
 * icon-only mode).
 *
 * @slot header Custom header content (e.g. profile card, logo). Fully generic, no positioning constraints
 *   applied — overrides the title prop.
 * @slot default Free content rendered at the end of the scrollable area, after all sections. Use for footers,
 *   logout buttons, or any custom content.
 * @slot toggle Collapse/expand toggle button area (inline variant only). Renders inside a 72px centered
 *   container with a bottom border that aligns with MTopAppBar (64px height). The icon stays anchored in the
 *   same position during collapse/expand transitions.
 * @event update:modelValue Open/closed state for v-model
 * @event select Fires when an item is clicked — use to track the selected item
 */
import { ref, reactive, watch, provide, computed, nextTick, onBeforeUnmount } from "vue";
import MIcon from "./MIcon.vue";
import MDrawerItemList from "./_MDrawerItemList.vue";
import { motionSprings, type SpringSpec } from "../composables/motion";
import { sampleSpring, sampleAt, playSamples, prefersReducedMotion } from "../composables/_springAnimation";

export interface DrawerItem {
  value: string | number;
  label: string;
  icon?: string;
  badge?: string | number;
  disabled?: boolean;
  to?: string | Record<string, any>;
  children?: DrawerItem[];
  iconSize?: number;
  labelClass?: string;
  py?: string;
  click?: () => void;
}

export interface DrawerSection {
  title?: string;
  icon?: string;
  items: DrawerItem[];
  collapsible?: boolean;
}

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Open/closed state (v-model) */
    modelValue: boolean;
    /** Currently selected item value */
    selected?: string | number;
    /** Array of sections (see the types below) */
    sections: DrawerSection[];
    /** Drawer header title (ignored if the #header slot is used) */
    title?: string;
    /** Modal with a Teleported scrim overlay, or an inline sidebar that participates in normal layout flow */
    modal?: boolean;
    /** Compact mode (72px) showing only icons — inline variant only */
    collapsed?: boolean;
    /** Custom drawer width (e.g. "320px", "25rem"). Defaults to 22.5rem (360px) */
    width?: string;
    /**
     * Which side the drawer opens from. Top/bottom are only available for the modal variant — the inline
     * variant always renders on left or right.
     */
    side?: 'left' | 'right' | 'top' | 'bottom';
    /** Lets the modal drawer be swiped closed toward its edge; with false it only closes through v-model or the scrim */
    swipeEnabled?: boolean;
  }>(),
  { modal: true, side: 'left', swipeEnabled: true },
);

const emit = defineEmits<{
  "update:modelValue": [boolean];
  select: [string | number];
}>();

const openSections = ref<Record<string, boolean>>({});
const openItems = reactive<Record<string | number, boolean>>({});

function isSectionOpen(section: DrawerSection, index: number) {
  const key = section.title ?? `__${index}`;
  return openSections.value[key] !== false;
}

function toggleSection(section: DrawerSection, index: number) {
  refreshListTouchAction();
  const key = section.title ?? `__${index}`;
  openSections.value[key] = !isSectionOpen(section, index);
}

function isItemOpen(item: DrawerItem) {
  return openItems[item.value] === true;
}

function toggleItem(item: DrawerItem) {
  refreshListTouchAction();
  openItems[item.value] = !openItems[item.value];
}

function close() {
  emit("update:modelValue", false);
}
function select(item: DrawerItem) {
  if (item.disabled) return;
  if (item.children?.length) toggleItem(item);
  item.click?.()
  emit("select", item.value);
  if (props.modal && !item.children?.length) close();
}

function onChildSelect(item: DrawerItem) {
  if (item.disabled) return;
  item.click?.()
  emit("select", item.value);
  if (props.modal && !item.children?.length) close();
}

function onChildToggle(item: DrawerItem) {
  refreshListTouchAction();
  openItems[item.value] = !openItems[item.value];
}

function subEnter(el: Element, done: () => void) {
  const e = el as HTMLElement
  e.style.overflow = 'hidden'
  const h = e.scrollHeight
  e.animate(
    [{ height: '0px' }, { height: h + 'px' }],
    { duration: 250, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  ).onfinish = () => { e.style.overflow = ''; done() }
}
function subLeave(el: Element, done: () => void) {
  const e = el as HTMLElement
  e.style.overflow = 'hidden'
  const h = e.scrollHeight
  e.animate(
    [{ height: h + 'px' }, { height: '0px' }],
    { duration: 200, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
  ).onfinish = done
}

const inlineSide = computed(() => props.side === 'left' || props.side === 'right' ? props.side : 'left')
const collapsedRef = computed(() => props.collapsed ?? false)
provide("nd-open-items", openItems);
provide("nd-toggle-item", onChildToggle);
provide("nd-select-item", onChildSelect);
provide("nd-collapsed", collapsedRef);

defineExpose({ openItems })

function itemTag(item: DrawerItem) {
  return item.to && !item.disabled ? "RouterLink" : "button";
}

watch(
  () => props.modelValue,
  (open) => {
    if (props.modal) {
      document.body.style.overflow = open ? "hidden" : "";
    }
  },
);

// ── Modal: slide in/out + swipe to close ────────────────────────────────────────────────────
// After ModalNavigationDrawer (NavigationDrawer.kt), which is left/right only; top/bottom add a bottom sheet's
// nested scroll (see moveDrag). Opens with DefaultSpatial (0.9 / 700), closes with
// FastEffects (1.0 / 3800); a released swipe settles at the nearer anchor (DrawerPositionalThreshold 50%)
// unless flung faster than DrawerVelocityThreshold (400dp/s), with DefaultSpatial. The scrim's alpha follows
// the panel's offset.
//
// Each spring plays as a Web Animation (see _springAnimation.ts): a rAF loop janked the open on phones. Only the
// drag itself writes styles directly. Offsets are fractions of the panel's size, so opening never reads layout.
const DEFAULT_SPATIAL = motionSprings.standard.defaultSpatial
const FAST_EFFECTS = motionSprings.standard.fastEffects
const FLING_VELOCITY = 400

let panelEl: HTMLElement | null = null
let scrimEl: HTMLElement | null = null
// 0 = open, `closedDir` (-1 for left/top, 1 for right/bottom) = off-screen, in fractions of the panel's size
let offset = 0
let velocity = 0
let closedDir = -1
let anim: Animation | null = null
let scrimAnim: Animation | null = null
let samples: number[] = []
let settled: (() => void) | null = null

const horizontal = () => props.side === "left" || props.side === "right";
const transformAt = (p: number) => (horizontal() ? `translateX(${p * 100}%)` : `translateY(${p * 100}%)`);
const opacityAt = (p: number) => String(Math.min(1, Math.max(0, 1 - p / closedDir)));

function bindModal(root: Element) {
  panelEl = root.querySelector<HTMLElement>(".nd-panel");
  scrimEl = root.querySelector<HTMLElement>(".nd-scrim");
  closedDir = props.side === "left" || props.side === "top" ? -1 : 1;
}

function writeModal() {
  if (panelEl) panelEl.style.transform = transformAt(offset);
  if (scrimEl) scrimEl.style.opacity = opacityAt(offset);
}

// Freezes the panel where the running animation has it
function stopAnim() {
  if (!anim) return;
  offset = sampleAt(samples, anim.currentTime);
  writeModal();
  anim.cancel();
  scrimAnim?.cancel();
  anim = scrimAnim = null;
}

function settle() {
  const cb = settled;
  settled = null;
  cb?.();
}

// Without `done`, a pending Transition callback (an enter interrupted by a swipe) is kept for this run
function animateTo(to: number, spring: SpringSpec, done?: () => void) {
  if (done) {
    settled?.();
    settled = done;
  }
  stopAnim();
  const v = velocity;
  velocity = 0;
  const from = offset;
  // The end state goes inline underneath, so nothing jumps when the animation ends
  offset = to;
  writeModal();
  if (prefersReducedMotion() || from === to) return settle();
  samples = sampleSpring(from, to, v, spring, 0.001);
  const a = playSamples(panelEl, samples, (p) => ({ transform: transformAt(p) }));
  if (!a) return settle();
  scrimAnim = playSamples(scrimEl, samples, (p) => ({ opacity: opacityAt(p) }));
  anim = a;
  a.onfinish = () => {
    if (anim !== a) return;
    anim = scrimAnim = null;
    settle();
  };
}

// Top/bottom: wherever the touch-action lets the browser pan along the drawer's swipe, Chrome treats that drag as
// a possible scroll waiting on our touchmove listener and delivers it at 60Hz on a 120Hz phone (measured on a
// device: the panel visibly moved every other frame, while the left/right swipe, crosswise to pan-y, came at
// 120Hz). So the list only allows the scroll that can actually happen: at the edge the drawer closes toward,
// only scrolling away from it (bottom: pan-down, the finger moving up; top: pan-up), elsewhere both ways. Outside
// the list the panel is touch-action: none. Browsers without directional pan values (Safari) keep pan-y.
let listEl: HTMLElement | null = null;

function updateListTouchAction() {
  const list = listEl;
  if (!list || horizontal() || !props.swipeEnabled) return;
  const atEdge = props.side === "bottom"
    ? list.scrollTop <= 0
    : list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
  const directional = typeof CSS !== "undefined" && !!CSS.supports?.("touch-action", "pan-down");
  list.style.touchAction = atEdge && directional ? (props.side === "bottom" ? "pan-down" : "pan-up") : "pan-y";
}

// Expanding a section or item changes how far the list scrolls without a scroll event: re-check once it settles
function refreshListTouchAction() {
  setTimeout(updateListTouchAction, 400);
}

function watchList(root: Element | null) {
  listEl?.removeEventListener("scroll", updateListTouchAction);
  listEl = root?.querySelector<HTMLElement>("[data-nd-list]") ?? null;
  if (!listEl) return;
  listEl.addEventListener("scroll", updateListTouchAction, { passive: true });
  // After the first layout, so the open doesn't force one
  requestAnimationFrame(updateListTouchAction);
}

function onModalEnter(el: Element, done: () => void) {
  // Reopened mid-close: the old panel goes now
  settled?.();
  settled = null;
  anim?.cancel();
  scrimAnim?.cancel();
  anim = scrimAnim = null;
  bindModal(el);
  watchList(el);
  offset = closedDir;
  velocity = 0;
  animateTo(0, DEFAULT_SPATIAL, done);
}

function onModalLeave(el: Element, done: () => void) {
  bindModal(el);
  drag = null;
  watchList(null);
  animateTo(closedDir, FAST_EFFECTS, done);
}

onBeforeUnmount(() => {
  anim?.cancel();
  scrimAnim?.cancel();
  watchList(null);
});

// Positions below are along the drawer's axis: x for left/right, y for top/bottom.
//
// A left/right drawer's swipe is crosswise to the list's scroll, so pointer events do (touch-action pan-y leaves
// the horizontal axis to us). A top/bottom drawer's swipe runs along it, and touch-action is fixed when the finger
// lands, so a touch there goes through touch events instead, like MPullToRefresh: the first move decides, and from
// that very touchmove on preventDefault() keeps the browser out. Deciding a few pointermoves later (as for mouse)
// let the browser start its own pan or overscroll first, and the two fought: the drag lagged on phones.
let drag: { id: number; touch: boolean; main: number; cross: number; start: number; size: number; active: boolean; list: HTMLElement | null; samples: { t: number; p: number }[] } | null = null;
let suppressClick = false;

function beginDrag(id: number, touch: boolean, x: number, y: number, t: number, target: EventTarget | null) {
  const main = horizontal() ? x : y;
  const list = (target as Element | null)?.closest<HTMLElement>("[data-nd-list]") ?? null;
  drag = { id, touch, main, cross: horizontal() ? y : x, start: 0, size: 1, active: false, list, samples: [{ t, p: main }] };
}

// Returns true when this move started the drag
function moveDrag(x: number, y: number, t: number, panel: HTMLElement): boolean {
  if (!drag) return false;
  const main = horizontal() ? x : y;
  let started = false;
  if (!drag.active) {
    const d = main - drag.main;
    const dc = (horizontal() ? y : x) - drag.cross;
    if (Math.abs(dc) > 8 && Math.abs(dc) > Math.abs(d)) { drag = null; return false; }
    if (Math.abs(d) < (horizontal() ? 8 : drag.touch ? 2 : 4)) return false;
    if (!horizontal()) {
      if (Math.abs(dc) > Math.abs(d)) { drag = null; return false; }
      bindModal(panel.parentElement!);
      // Like a bottom sheet's nested scroll: dragging away from the edge only scrolls, and a drag toward it
      // scrolls the list first, the drawer following once the list can't scroll that way any more
      const list = drag.list;
      const listScrolls = !!list && (d > 0 ? list.scrollTop > 0 : list.scrollTop + list.clientHeight < list.scrollHeight - 1);
      if (Math.sign(d) !== closedDir || listScrolls) { drag = null; return false; }
    }
    drag.active = true;
    started = true;
    drag.main = main;
    bindModal(panel.parentElement!);
    // Stop a running slide; the finger owns the panel now
    stopAnim();
    velocity = 0;
    drag.start = offset;
    drag.size = (horizontal() ? panel.offsetWidth : panel.offsetHeight) || 1;
  }
  const min = Math.min(0, closedDir);
  const max = Math.max(0, closedDir);
  offset = Math.min(max, Math.max(min, drag.start + (main - drag.main) / drag.size));
  writeModal();
  drag.samples.push({ t, p: main });
  drag.samples = drag.samples.filter((s) => t - s.t < 100);
  return started;
}

function endDrag() {
  if (!drag) return;
  const wasActive = drag.active;
  const first = drag.samples[0]!;
  const lastSample = drag.samples[drag.samples.length - 1]!;
  const dt = (lastSample.t - first.t) / 1000;
  const v = dt > 0 ? (lastSample.p - first.p) / dt : 0;
  const size = drag.size;
  drag = null;
  if (!wasActive) return;
  suppressClick = true;
  setTimeout(() => { suppressClick = false; });
  const dismiss = Math.abs(v) > FLING_VELOCITY
    ? Math.sign(v) === closedDir
    : Math.abs(offset) > 0.5;
  velocity = v / size;
  if (!dismiss) return animateTo(0, DEFAULT_SPATIAL);
  close();
  // The parent may not close it (no v-model bound): spring back instead of staying mid-swipe
  nextTick(() => {
    if (props.modelValue) animateTo(0, DEFAULT_SPATIAL);
  });
}

function onPanelPointerDown(e: PointerEvent) {
  if (!props.swipeEnabled || e.button !== 0) return;
  if (e.pointerType === "touch" && !horizontal()) return;
  beginDrag(e.pointerId, false, e.clientX, e.clientY, e.timeStamp, e.target);
}

function onPanelPointerMove(e: PointerEvent) {
  if (!drag || drag.touch || e.pointerId !== drag.id) return;
  const panel = e.currentTarget as HTMLElement;
  if (moveDrag(e.clientX, e.clientY, e.timeStamp, panel)) panel.setPointerCapture?.(e.pointerId);
}

function onPanelPointerUp(e: PointerEvent) {
  if (!drag || drag.touch || e.pointerId !== drag.id) return;
  endDrag();
}

function onPanelTouchStart(e: TouchEvent) {
  if (!props.swipeEnabled || horizontal() || e.touches.length !== 1) return;
  const t = e.touches[0]!;
  beginDrag(t.identifier, true, t.clientX, t.clientY, e.timeStamp, e.target);
}

function onPanelTouchMove(e: TouchEvent) {
  if (drag?.touch) {
    const id = drag.id;
    const t = Array.from(e.changedTouches).find((x) => x.identifier === id);
    if (t) moveDrag(t.clientX, t.clientY, e.timeStamp, e.currentTarget as HTMLElement);
  }
  // From the very move that started it (top/bottom), or as belt and braces (left/right): the browser must not
  // scroll or navigate with the swipe
  if (drag?.active && e.cancelable) e.preventDefault();
}

function onPanelTouchEnd(e: TouchEvent) {
  if (!drag?.touch) return;
  const id = drag.id;
  if (Array.from(e.changedTouches).some((x) => x.identifier === id)) endDrag();
}

function onPanelClickCapture(e: MouseEvent) {
  if (!suppressClick) return;
  e.preventDefault();
  e.stopPropagation();
}
</script>

<template>
  <!-- ── Modal variant ──────────────────────────────────────── -->
  <Teleport v-if="modal" to="body">
    <Transition :css="false" @enter="onModalEnter" @leave="onModalLeave" appear>
      <div
        v-if="modelValue"
        class="fixed inset-0 z-100 flex"
        :class="[
          side === 'right' ? 'justify-end' : '',
          side === 'bottom' ? 'flex-col justify-end' : '',
          side === 'top' ? 'flex-col' : '',
        ]"
      >
        <!-- will-change: a drag writes their transform/opacity directly, without the layer an animation gets -->
        <div class="nd-scrim absolute inset-0 bg-scrim/32 will-change-[opacity]" @click="close" />

        <nav
          v-bind="$attrs"
          :class="[
            'nd-panel relative flex flex-col bg-surface-container-low shadow-elevation-1 will-change-transform',
            side === 'top' || side === 'bottom'
              ? 'w-full max-h-[85vh]'
              : 'h-full max-w-[85vw]',
            side === 'top' || side === 'bottom' || width ? '' : 'w-[22.5rem]',
            side === 'right' ? 'rounded-l-lg' : side === 'left' ? 'rounded-r-lg' : side === 'bottom' ? 'rounded-t-lg' : '',
            swipeEnabled ? (side === 'left' || side === 'right' ? 'touch-pan-y' : 'touch-none') : '',
          ]"
          :style="side !== 'top' && side !== 'bottom' && width ? { width } : undefined"
          @pointerdown="onPanelPointerDown"
          @pointermove="onPanelPointerMove"
          @pointerup="onPanelPointerUp"
          @pointercancel="onPanelPointerUp"
          @touchstart.passive="onPanelTouchStart"
          @touchmove="onPanelTouchMove"
          @touchend="onPanelTouchEnd"
          @touchcancel="onPanelTouchEnd"
          @click.capture="onPanelClickCapture"
        >
          <div v-if="$slots.header" class="shrink-0">
            <slot name="header" />
          </div>
          <div v-else-if="title" class="shrink-0 px-5 pt-6 pb-2">
            <h2 class="text-title-small font-medium text-on-surface-variant">
              {{ title }}
            </h2>
          </div>

          <!-- touch-action stops at the nearest scroll container, so this one needs pan-y of its own or a
               finger landing on an item lets the browser take a left/right drawer's swipe (top/bottom: the
               script narrows it, see updateListTouchAction) -->
          <div
            data-nd-list
            class="scrollbar-none flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-2"
            :class="swipeEnabled ? 'touch-pan-y overscroll-y-contain' : ''"
          >
            <template v-for="(section, si) in sections" :key="si">
              <div v-if="si > 0" class="my-1 border-t border-outline-variant" />

              <button
                v-if="section.title && section.collapsible"
                type="button"
                class="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-on-surface-variant transition-colors hover:bg-on-surface/8"
                @click="toggleSection(section, si)"
              >
                <MIcon
                  v-if="section.icon"
                  :name="section.icon"
                  :size="24"
                  class="shrink-0"
                />
                <span class="flex-1 text-left text-title-small font-medium">{{
                  section.title
                }}</span>
                <MIcon
                  :name="
                    isSectionOpen(section, si) ? 'expand_less' : 'expand_more'
                  "
                  :size="18"
                  class="shrink-0"
                />
              </button>
              <p
                v-else-if="section.title"
                class="px-4 pt-4 pb-2 text-title-small font-medium text-on-surface-variant"
              >
                {{ section.title }}
              </p>

              <Transition name="nd-section">
                <div
                  v-if="!section.collapsible || isSectionOpen(section, si)"
                  class="nd-section-grid"
                >
                  <div class="nd-section-body">
                    <template v-for="item in section.items" :key="item.value">
                      <component
                        :is="itemTag(item)"
                        :to="item.to && !item.disabled ? item.to : undefined"
                        :type="item.to ? undefined : 'button'"
                        class="flex w-full items-center gap-3 rounded-full py-4 text-left transition-colors focus-visible:outline-none"
                        :class="[
                          section.collapsible ? 'pl-8 pr-3' : 'px-4',
                          item.disabled
                            ? 'cursor-not-allowed opacity-[0.38]'
                            : item.value === selected
                              ? 'bg-secondary-container text-on-secondary-container'
                              : 'cursor-pointer text-on-surface-variant hover:bg-on-surface/8',
                        ]"
                        :disabled="item.disabled && !item.to"
                        @click="select(item)"
                      >
                        <MIcon v-if="item.icon" :name="item.icon" :size="item.iconSize ?? 24" />
                        <span class="flex-1 font-medium" :class="item.labelClass ?? 'text-label-large'">{{
                          item.label
                        }}</span>
                        <MIcon
                          v-if="item.children?.length"
                          :name="
                            isItemOpen(item) ? 'expand_less' : 'expand_more'
                          "
                          :size="18"
                          class="shrink-0 text-on-surface-variant"
                        />
                        <span
                          v-else-if="item.badge != null"
                          class="text-label-medium text-on-surface-variant"
                        >
                          {{ item.badge }}
                        </span>
                      </component>
                      <Transition
                        name="nd-sub"
                        :css="false"
                        @enter="subEnter"
                        @leave="subLeave"
                      >
                        <div
                          v-if="item.children?.length && isItemOpen(item)"
                        >
                          <MDrawerItemList
                            :items="item.children"
                            :selected="selected"
                          />
                        </div>
                      </Transition>
                    </template>
                  </div>
                </div>
              </Transition>
            </template>
            <slot />
          </div>
        </nav>
      </div>
    </Transition>
  </Teleport>

  <!-- ── Standard (inline) variant ──────────────────────────── -->
  <template v-else>
    <nav
      v-bind="$attrs"
      class="nd-inline flex h-full shrink-0 flex-col bg-surface"
      :class="[
        inlineSide === 'right' ? 'border-l border-outline-variant rounded-l-lg' : 'border-r border-outline-variant rounded-r-lg',
        !modelValue
          ? inlineSide === 'right' ? 'nd-hidden w-0 border-l-0' : 'nd-hidden w-0 border-r-0'
          : collapsed
            ? 'nd-collapsed w-[72px]'
            : width ? '' : 'w-[22.5rem]',
      ]"
      :style="{ width: modelValue && !collapsed && width ? width : undefined, '--nd-width': width ?? '22.5rem' }"
    >
      <div v-if="$slots.toggle" class="nd-toggle shrink-0 border-b border-outline-variant">
        <div class="nd-toggle-inner">
          <slot name="toggle" />
        </div>
      </div>
      <div v-if="$slots.header" class="shrink-0">
        <slot name="header" />
      </div>
      <div v-else-if="title" class="nd-collapse-h shrink-0 overflow-hidden">
        <div class="px-5 pt-6 pb-2">
          <h2
            class="whitespace-nowrap text-title-small font-medium text-on-surface-variant"
          >
            {{ title }}
          </h2>
        </div>
      </div>

      <div
        class="scrollbar-none flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 py-2"
      >
        <template v-for="(section, si) in sections" :key="si">
          <div v-if="si > 0" class="my-1 border-t border-outline-variant" />

          <!-- Collapsible section header -->
          <button
            v-if="section.title && section.collapsible"
            type="button"
            class="mt-1 flex w-full shrink-0 cursor-pointer items-center gap-3 overflow-hidden whitespace-nowrap rounded-xl px-3 py-2.5 text-on-surface-variant hover:bg-on-surface/8"
            :title="collapsed ? section.title : undefined"
            @click="toggleSection(section, si)"
          >
            <MIcon
              v-if="section.icon"
              :name="section.icon"
              :size="24"
              class="shrink-0"
            />
            <span
              class="nd-label min-w-0 flex-1 text-left text-title-small font-medium"
              >{{ section.title }}</span
            >
            <MIcon
              :name="isSectionOpen(section, si) ? 'expand_less' : 'expand_more'"
              :size="18"
              class="nd-label shrink-0"
            />
          </button>

          <!-- Static section title -->
          <div v-else-if="section.title" class="nd-collapse-h shrink-0 overflow-hidden">
            <p
              class="whitespace-nowrap px-4 pt-4 pb-2 text-title-small font-medium text-on-surface-variant"
            >
              {{ section.title }}
            </p>
          </div>

          <Transition name="nd-section">
            <div
              v-if="!section.collapsible || isSectionOpen(section, si)"
              class="nd-section-grid"
            >
              <div class="nd-section-body">
                <template v-for="item in section.items" :key="item.value">
                  <component
                    :is="itemTag(item)"
                    :to="item.to && !item.disabled ? item.to : undefined"
                    :type="item.to ? undefined : 'button'"
                    :title="collapsed ? item.label : undefined"
                    class="flex w-full shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap rounded-full py-4 text-left focus-visible:outline-none"
                    :class="[
                      section.collapsible && !collapsed ? 'pl-8 pr-3' : 'px-3',
                      item.disabled
                        ? 'cursor-not-allowed opacity-[0.38]'
                        : item.value === selected
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'cursor-pointer text-on-surface-variant hover:bg-on-surface/8',
                    ]"
                    :disabled="item.disabled && !item.to"
                    @click="select(item)"
                  >
                    <MIcon
                      v-if="item.icon"
                      :name="item.icon"
                      :size="item.iconSize ?? 24"
                      class="shrink-0"
                    />
                    <span
                      class="nd-label min-w-0 flex-1 font-medium"
                      :class="item.labelClass ?? 'text-label-large'"
                      >{{ item.label }}</span
                    >
                    <MIcon
                      v-if="item.children?.length"
                      :name="isItemOpen(item) ? 'expand_less' : 'expand_more'"
                      :size="18"
                      class="nd-label shrink-0 text-on-surface-variant"
                    />
                    <span
                      v-else-if="item.badge != null"
                      class="nd-label text-label-medium text-on-surface-variant"
                    >
                      {{ item.badge }}
                    </span>
                  </component>
                  <div v-if="item.children?.length && isItemOpen(item)" class="nd-children-divider" />
                  <Transition
                    :css="false"
                    @enter="subEnter"
                    @leave="subLeave"
                  >
                    <div
                      v-if="item.children?.length && isItemOpen(item)"
                    >
                      <MDrawerItemList
                        :items="item.children"
                        :selected="selected"
                      />
                    </div>
                  </Transition>
                  <div v-if="item.children?.length && isItemOpen(item)" class="nd-children-divider" />
                </template>
              </div>
            </div>
          </Transition>
        </template>
        <slot />
      </div>
    </nav>
  </template>
</template>

<style scoped>
/* ── Section collapse animation ────────────────────────── */
.nd-section-grid {
  display: grid;
  grid-template-rows: 1fr;
}
.nd-section-body {
  min-height: 0;
  overflow: hidden;
}

.nd-section-enter-active {
  transition: grid-template-rows 350ms cubic-bezier(0.2, 0, 0, 1);
}
.nd-section-enter-active > .nd-section-body {
  transition: opacity 250ms 80ms cubic-bezier(0.2, 0, 0, 1);
}
.nd-section-enter-from {
  grid-template-rows: 0fr;
}
.nd-section-enter-from > .nd-section-body {
  opacity: 0;
}

.nd-section-leave-active {
  transition: grid-template-rows 280ms cubic-bezier(0.4, 0, 1, 1);
}
.nd-section-leave-active > .nd-section-body {
  transition: opacity 150ms cubic-bezier(0.4, 0, 1, 1);
}
.nd-section-leave-to {
  grid-template-rows: 0fr;
}
.nd-section-leave-to > .nd-section-body {
  opacity: 0;
}

/* ── Inline sidebar width transition ───────────────────── */
.nd-inline {
  transition: width 300ms cubic-bezier(0.2, 0, 0, 1);
  overflow: hidden;
}

/* Freeze layout so content clips like a curtain during open/close */
.nd-inline > * {
  min-width: var(--nd-width, 22.5rem);
}
/* Collapse-to-icons: let children adapt to 72px width */
.nd-inline.nd-collapsed > * {
  min-width: 0;
}

/* Toggle slot: icon stays anchored while border spans full width */
.nd-toggle {
  display: flex;
  align-items: center;
}
.nd-toggle-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 64px;
  flex-shrink: 0;
}

/* Collapse-to-icons: fade out labels before width squishes them */
.nd-label {
  transition: opacity 200ms 80ms cubic-bezier(0.2, 0, 0, 1);
}
.nd-inline.nd-collapsed .nd-label,
.nd-inline.nd-collapsed :deep(.nd-label) {
  opacity: 0;
  transition: opacity 100ms cubic-bezier(0.2, 0, 0, 1);
}

/* Elements that should collapse to 0 height when sidebar is collapsed */
.nd-inline .nd-collapse-h {
  max-height: 80px;
  transition: max-height 300ms cubic-bezier(0.2, 0, 0, 1);
}
.nd-inline.nd-collapsed .nd-collapse-h {
  max-height: 0;
}

.nd-inline .nd-section-body > *,
.nd-inline :deep(.nd-section-body) > * {
  transition: padding 300ms cubic-bezier(0.2, 0, 0, 1);
}

/* Dividers between children groups — only visible in collapsed mode */
.nd-children-divider {
  height: 0;
  margin: 0 0.75rem;
  border-top: 1px solid transparent;
  transition: border-color 100ms, margin 100ms;
}
.nd-inline.nd-collapsed .nd-children-divider {
  border-top-color: var(--color-outline-variant);
  margin: 0.25rem 0.75rem;
  transition: border-color 200ms 300ms, margin 200ms 300ms;
}

</style>
