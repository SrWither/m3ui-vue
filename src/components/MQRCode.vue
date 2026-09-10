<script setup lang="ts">
import { computed } from 'vue'
import QRCode from 'qrcode-generator'

const props = withDefaults(
  defineProps<{
    value: string
    size?: number
    /** Quiet zone around the code, in modules. */
    margin?: number
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
    color?: string
    background?: string
    label?: string
    /** Rounds the outer container corners. */
    rounded?: boolean
    /** 'square' is the classic scannable pixel grid. 'dots' rounds each module — still fully scannable, just a softer look. */
    moduleStyle?: 'square' | 'dots'
  }>(),
  {
    size: 200,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: '#000000',
    background: '#ffffff',
    rounded: true,
    moduleStyle: 'square',
  },
)

// qr and error are derived together in one computed so they can never be
// read out of sync with each other (e.g. a template `v-if="error"` seeing a
// stale value from before `qr` — which sets it — was actually evaluated).
const result = computed(() => {
  try {
    const instance = QRCode(0, props.errorCorrectionLevel)
    instance.addData(props.value)
    instance.make()
    return { qr: instance, error: null as string | null }
  } catch (err) {
    // qrcode-generator throws plain strings (e.g. "code length overflow...")
    const message = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Failed to generate QR code'
    return { qr: null, error: message }
  }
})

const qr = computed(() => result.value.qr)
const error = computed(() => result.value.error)

const moduleCount = computed(() => qr.value?.getModuleCount() ?? 0)
const totalModules = computed(() => moduleCount.value + props.margin * 2)
const moduleSize = computed(() => (totalModules.value > 0 ? props.size / totalModules.value : 0))
const containerRadius = computed(() => (props.rounded ? props.size * 0.06 : 0))

// A corner rounds only when neither of its two perpendicular neighbors is
// also dark — otherwise adjacent modules (e.g. the finder-pattern squares,
// or any run of touching pixels) would each round independently and leave
// visible notches instead of merging into one smooth shape.
function roundedRectPath(x: number, y: number, s: number, rTL: number, rTR: number, rBR: number, rBL: number): string {
  return `M${x + rTL},${y} H${x + s - rTR} A${rTR},${rTR} 0 0 1 ${x + s},${y + rTR} V${y + s - rBR} A${rBR},${rBR} 0 0 1 ${x + s - rBR},${y + s} H${x + rBL} A${rBL},${rBL} 0 0 1 ${x},${y + s - rBL} V${y + rTL} A${rTL},${rTL} 0 0 1 ${x + rTL},${y} Z`
}

const cells = computed(() => {
  const result: { x: number; y: number; d?: string }[] = []
  const inst = qr.value
  if (!inst) return result
  const count = moduleCount.value
  const s = moduleSize.value
  const isDark = (row: number, col: number) => row >= 0 && row < count && col >= 0 && col < count && inst.isDark(row, col)

  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!isDark(row, col)) continue
      const x = (col + props.margin) * s
      const y = (row + props.margin) * s

      if (props.moduleStyle !== 'dots') {
        result.push({ x, y })
        continue
      }

      const radius = s / 2
      const up = isDark(row - 1, col)
      const down = isDark(row + 1, col)
      const left = isDark(row, col - 1)
      const right = isDark(row, col + 1)
      result.push({
        x, y,
        d: roundedRectPath(
          x, y, s,
          up || left ? 0 : radius,
          up || right ? 0 : radius,
          down || right ? 0 : radius,
          down || left ? 0 : radius,
        ),
      })
    }
  }
  return result
})
</script>

<template>
  <div v-if="error" class="flex items-center justify-center text-body-small text-error" :style="{ width: `${size}px`, height: `${size}px` }">
    <slot name="error">{{ error }}</slot>
  </div>
  <svg
    v-else
    :width="size"
    :height="size"
    :viewBox="`0 0 ${size} ${size}`"
    role="img"
    :aria-label="label ?? value"
  >
    <rect x="0" y="0" :width="size" :height="size" :rx="containerRadius" :ry="containerRadius" :fill="background" />
    <template v-if="moduleStyle === 'dots'">
      <path v-for="(cell, i) in cells" :key="i" :d="cell.d" :fill="color" />
    </template>
    <template v-else>
      <rect
        v-for="(cell, i) in cells"
        :key="i"
        :x="cell.x"
        :y="cell.y"
        :width="moduleSize"
        :height="moduleSize"
        :fill="color"
      />
    </template>
  </svg>
</template>
