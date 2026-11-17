<script lang="ts">
/** One end of a trip in an `MTicket`: an airport, a station, a terminal. */
export interface TicketStop {
  /** Short code shown big, e.g. "EZE" or "RET" */
  code: string
  /** City or station name under the code */
  name?: string
  /** Departure / arrival time, shown under the name */
  time?: string
}

/** A label/value pair on an `MTicket`, e.g. `{ label: 'Gate', value: 'B12' }`. */
export interface TicketField {
  label: string
  value: string | number
  /** Emphasizes the value (e.g. the seat or the gate) */
  strong?: boolean
}
</script>

<script setup lang="ts">
/**
 * A ticket with a tear-off stub: a boarding pass, a bus or train ticket, a concert or cinema entry, a coupon. The
 * stub is separated by a perforated line with two notches cut out, and usually holds the code to scan (put an
 * `MQRCode` or `MBarcode` in the `stub` slot). Trips get a from → to route; any ticket gets a grid of fields.
 *
 * @slot header Replaces the title row in the colored band (e.g. an airline logo and a status chip)
 * @slot default Content of the main part, under the route and fields
 * @slot stub Content of the stub: a QR, a barcode, a number
 */
import { computed } from 'vue'
import MIcon from './MIcon.vue'

const ROLES = ['primary', 'secondary', 'tertiary', 'error', 'success']

const props = withDefaults(
  defineProps<{
    /** Title in the colored band, e.g. the airline, the event or the movie */
    title?: string
    /** A line under the title, e.g. the venue or the date */
    subtitle?: string
    /** Material Symbol before the title */
    icon?: string
    /** Band color: a role (primary, secondary, tertiary, error, success) or any CSS color */
    color?: string
    /** Where the trip starts */
    from?: TicketStop
    /** Where the trip ends */
    to?: TicketStop
    /** Material Symbol between from and to */
    transport?: string
    /** Label/value pairs in a grid */
    fields?: TicketField[]
    /** Stub beside the main part (an event ticket) or under it (a phone boarding pass) */
    orientation?: 'horizontal' | 'vertical'
    /** Width of the stub in horizontal orientation (any CSS length) */
    stubSize?: string
    /** Radius of the notches cut at the perforation, in px */
    notch?: number
  }>(),
  {
    color: 'primary',
    transport: 'flight',
    fields: () => [],
    orientation: 'horizontal',
    stubSize: '10rem',
    notch: 12,
  },
)

const band = computed(() =>
  ROLES.includes(props.color)
    ? { background: `var(--color-${props.color})`, color: `var(--color-on-${props.color})` }
    : { background: props.color, color: '#fff' },
)

const vertical = computed(() => props.orientation === 'vertical')
</script>

<template>
  <div
    class="m3-ticket flex text-on-surface"
    :class="vertical ? 'flex-col' : 'flex-row'"
    :style="{ '--m3-ticket-notch': `${notch}px`, '--m3-ticket-stub': stubSize }"
    :data-orientation="orientation"
  >
    <div class="m3-ticket__main flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-container-lowest">
      <div class="flex items-center gap-3 px-5 py-3" :style="band">
        <slot name="header">
          <MIcon v-if="icon" :name="icon" :size="24" />
          <div class="min-w-0 flex-1">
            <div v-if="title" class="truncate text-title-medium font-medium">{{ title }}</div>
            <div v-if="subtitle" class="truncate text-body-medium opacity-80">{{ subtitle }}</div>
          </div>
        </slot>
      </div>

      <div class="flex flex-1 flex-col gap-4 px-5 py-4">
        <div v-if="from || to" class="flex items-start gap-3" data-route>
          <div v-if="from" class="min-w-0">
            <div class="text-display-small font-medium leading-none tracking-tight">{{ from.code }}</div>
            <div v-if="from.name" class="mt-1 truncate text-body-medium text-on-surface-variant">{{ from.name }}</div>
            <div v-if="from.time" class="text-title-medium tabular-nums">{{ from.time }}</div>
          </div>
          <div class="flex flex-1 items-center gap-1 pt-3 text-on-surface-variant" aria-hidden="true">
            <span class="h-0 flex-1 border-t-2 border-dotted border-outline-variant" />
            <MIcon :name="transport" :size="24" :class="transport === 'flight' ? 'rotate-90' : ''" class="text-primary" />
            <span class="h-0 flex-1 border-t-2 border-dotted border-outline-variant" />
          </div>
          <div v-if="to" class="min-w-0 text-end">
            <div class="text-display-small font-medium leading-none tracking-tight">{{ to.code }}</div>
            <div v-if="to.name" class="mt-1 truncate text-body-medium text-on-surface-variant">{{ to.name }}</div>
            <div v-if="to.time" class="text-title-medium tabular-nums">{{ to.time }}</div>
          </div>
        </div>

        <dl v-if="fields.length" class="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-x-4 gap-y-3">
          <div v-for="f in fields" :key="f.label" class="min-w-0">
            <dt class="truncate text-label-medium uppercase tracking-wide text-on-surface-variant">{{ f.label }}</dt>
            <dd class="truncate" :class="f.strong ? 'text-title-large font-medium text-primary' : 'text-title-medium'">{{ f.value }}</dd>
          </div>
        </dl>

        <slot />
      </div>
    </div>

    <div
      v-if="$slots.stub"
      class="m3-ticket__stub relative flex shrink-0 flex-col items-center justify-center gap-2 bg-surface-container-lowest p-4"
    >
      <span class="m3-ticket__perforation" aria-hidden="true" />
      <slot name="stub" />
    </div>
  </div>
</template>

<style>
.m3-ticket {
  filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.15)) drop-shadow(0 1px 3px rgb(0 0 0 / 0.1));
}
.m3-ticket__main,
.m3-ticket__stub {
  --r: var(--m3-ticket-notch);
}
/* Each half cuts its own two corners at the perforation, so the notches line up whatever the content size */
.m3-ticket[data-orientation='horizontal'] .m3-ticket__main {
  border-radius: var(--radius-lg, 16px) 0 0 var(--radius-lg, 16px);
}
.m3-ticket[data-orientation='horizontal'] .m3-ticket__stub {
  width: var(--m3-ticket-stub);
  border-radius: 0 var(--radius-lg, 16px) var(--radius-lg, 16px) 0;
  -webkit-mask:
    radial-gradient(circle var(--r) at 0 0, #0000 98%, #000) top / 100% 51% no-repeat,
    radial-gradient(circle var(--r) at 0 100%, #0000 98%, #000) bottom / 100% 51% no-repeat;
  mask:
    radial-gradient(circle var(--r) at 0 0, #0000 98%, #000) top / 100% 51% no-repeat,
    radial-gradient(circle var(--r) at 0 100%, #0000 98%, #000) bottom / 100% 51% no-repeat;
}
.m3-ticket[data-orientation='horizontal']:has(.m3-ticket__stub) .m3-ticket__main {
  -webkit-mask:
    radial-gradient(circle var(--r) at 100% 0, #0000 98%, #000) top / 100% 51% no-repeat,
    radial-gradient(circle var(--r) at 100% 100%, #0000 98%, #000) bottom / 100% 51% no-repeat;
  mask:
    radial-gradient(circle var(--r) at 100% 0, #0000 98%, #000) top / 100% 51% no-repeat,
    radial-gradient(circle var(--r) at 100% 100%, #0000 98%, #000) bottom / 100% 51% no-repeat;
}
.m3-ticket[data-orientation='vertical'] .m3-ticket__main {
  border-radius: var(--radius-lg, 16px) var(--radius-lg, 16px) 0 0;
}
.m3-ticket[data-orientation='vertical'] .m3-ticket__stub {
  border-radius: 0 0 var(--radius-lg, 16px) var(--radius-lg, 16px);
  -webkit-mask:
    radial-gradient(circle var(--r) at 0 0, #0000 98%, #000) left / 51% 100% no-repeat,
    radial-gradient(circle var(--r) at 100% 0, #0000 98%, #000) right / 51% 100% no-repeat;
  mask:
    radial-gradient(circle var(--r) at 0 0, #0000 98%, #000) left / 51% 100% no-repeat,
    radial-gradient(circle var(--r) at 100% 0, #0000 98%, #000) right / 51% 100% no-repeat;
}
.m3-ticket[data-orientation='vertical']:has(.m3-ticket__stub) .m3-ticket__main {
  -webkit-mask:
    radial-gradient(circle var(--r) at 0 100%, #0000 98%, #000) left / 51% 100% no-repeat,
    radial-gradient(circle var(--r) at 100% 100%, #0000 98%, #000) right / 51% 100% no-repeat;
  mask:
    radial-gradient(circle var(--r) at 0 100%, #0000 98%, #000) left / 51% 100% no-repeat,
    radial-gradient(circle var(--r) at 100% 100%, #0000 98%, #000) right / 51% 100% no-repeat;
}
.m3-ticket:not(:has(.m3-ticket__stub)) .m3-ticket__main {
  border-radius: var(--radius-lg, 16px);
}
.m3-ticket__perforation {
  position: absolute;
  --dash: color-mix(in srgb, var(--color-on-surface) 30%, transparent);
}
.m3-ticket[data-orientation='horizontal'] .m3-ticket__perforation {
  left: 0;
  top: calc(var(--r) + 4px);
  bottom: calc(var(--r) + 4px);
  width: 2px;
  background: repeating-linear-gradient(to bottom, var(--dash) 0 6px, transparent 6px 12px);
}
.m3-ticket[data-orientation='vertical'] .m3-ticket__perforation {
  top: 0;
  left: calc(var(--r) + 4px);
  right: calc(var(--r) + 4px);
  height: 2px;
  background: repeating-linear-gradient(to right, var(--dash) 0 6px, transparent 6px 12px);
}
</style>
