<script lang="ts">
/** A signature line of an `MCertificate`. */
export interface CertificateSignature {
  name: string
  /** e.g. "Course director" */
  role?: string
  /** Image of the signature (a URL or a data URL, e.g. from MSignaturePad), drawn over the line */
  image?: string
}
</script>

<script setup lang="ts">
/**
 * A printable certificate or diploma: a course completion, an award, a training, a membership. It keeps an A4 shape
 * at any width and scales its type with it, so the same component works as a thumbnail, on screen and on paper;
 * `print()` prints just the certificate on an A4 page. Three looks: `classic` (double frame and serif type),
 * `modern` (a colored band) and `minimal`.
 *
 * @slot logo The issuer's logo, at the top
 * @slot seal Replaces the seal (a rosette with an icon)
 * @slot default Extra content under the description (grades, hours, a QR to verify)
 */
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'
import { printElement } from '../composables/_printElement'

const locale = useLocale()

const ROLES = ['primary', 'secondary', 'tertiary', 'error', 'success']

const props = withDefaults(
  defineProps<{
    /** Who receives it */
    recipient: string
    /** Big title. Defaults to the locale's "Certificate of completion" */
    title?: string
    /** Line before the name. Defaults to the locale's "This certifies that" */
    presentedTo?: string
    /** What it is for, e.g. "has completed the course Vue 3 Fundamentals (24 hours)" */
    description?: string
    /** Name of the issuing organization */
    issuer?: string
    /** Date it was awarded (Date, ISO string or epoch ms) */
    date?: Date | string | number
    /** Certificate number or verification code */
    code?: string
    signatures?: CertificateSignature[]
    /** Look of the certificate */
    variant?: 'classic' | 'modern' | 'minimal'
    /** Accent color: a role (primary, secondary, tertiary, error, success) or any CSS color */
    color?: string
    /** Material Symbol in the seal; `false` hides the seal */
    seal?: string | false
    orientation?: 'landscape' | 'portrait'
  }>(),
  {
    signatures: () => [],
    variant: 'classic',
    color: 'primary',
    seal: 'workspace_premium',
    orientation: 'landscape',
  },
)

const accent = computed(() => (ROLES.includes(props.color) ? `var(--color-${props.color})` : props.color))

const dateText = computed(() => {
  if (props.date === undefined) return ''
  const d = props.date instanceof Date ? props.date : new Date(props.date)
  return new Intl.DateTimeFormat(locale.lang, { dateStyle: 'long' }).format(d)
})

const rootEl = ref<HTMLElement | null>(null)

/** Prints just the certificate, filling an A4 page */
function print() {
  if (!rootEl.value) return
  printElement(rootEl.value, {
    page: `A4 ${props.orientation}`,
    css: '.m3-certificate{width:100vw!important;max-width:none!important;box-shadow:none!important}',
  })
}

defineExpose({ print })
</script>

<template>
  <div
    ref="rootEl"
    class="m3-certificate"
    :class="[`m3-certificate--${variant}`]"
    :style="{ '--m3-cert-accent': accent, aspectRatio: orientation === 'landscape' ? '297 / 210' : '210 / 297' }"
    :data-variant="variant"
  >
    <div class="m3-certificate__frame">
      <div v-if="$slots.logo || issuer" class="m3-certificate__issuer">
        <slot name="logo" />
        <span v-if="issuer" data-issuer>{{ issuer }}</span>
      </div>

      <h2 class="m3-certificate__title" data-title>{{ title ?? locale.certTitle }}</h2>
      <p class="m3-certificate__lead">{{ presentedTo ?? locale.certPresentedTo }}</p>
      <p class="m3-certificate__name" data-recipient>{{ recipient }}</p>
      <p v-if="description" class="m3-certificate__desc">{{ description }}</p>
      <div v-if="$slots.default" class="m3-certificate__extra"><slot /></div>

      <div class="m3-certificate__footer">
        <div v-if="dateText" class="m3-certificate__sign">
          <span class="m3-certificate__sign-value">{{ dateText }}</span>
          <span class="m3-certificate__sign-line" />
          <span class="m3-certificate__sign-role">{{ locale.certDate }}</span>
        </div>

        <div v-if="seal !== false || $slots.seal" class="m3-certificate__seal" aria-hidden="true">
          <slot name="seal">
            <svg viewBox="0 0 100 100" class="m3-certificate__rosette">
              <polygon
                :points="Array.from({ length: 24 }, (_, i) => {
                  const a = (i * Math.PI) / 12
                  const r = i % 2 ? 44 : 50
                  return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`
                }).join(' ')"
              />
              <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2.5" />
            </svg>
            <MIcon :name="seal || 'workspace_premium'" class="m3-certificate__seal-icon" />
          </slot>
        </div>

        <div v-for="s in signatures" :key="s.name" class="m3-certificate__sign" data-signature>
          <img v-if="s.image" :src="s.image" alt="" class="m3-certificate__sign-img" />
          <span v-else class="m3-certificate__sign-value">&nbsp;</span>
          <span class="m3-certificate__sign-line" />
          <span class="m3-certificate__sign-name">{{ s.name }}</span>
          <span v-if="s.role" class="m3-certificate__sign-role">{{ s.role }}</span>
        </div>
      </div>

      <p v-if="code" class="m3-certificate__code" data-code>{{ locale.certId }}: {{ code }}</p>
    </div>
  </div>
</template>

<style>
@layer base {
  .m3-certificate {
    width: 100%;
    position: relative;
    overflow: hidden;
    background: #fffdf8;
    color: #1d1b20;
    box-shadow: var(--shadow-elevation-2);
  }
}
.m3-certificate {
  container-type: inline-size;
  /* The paper is always light: in the dark theme the accent role is a light tone, so it's darkened into ink */
  --m3-cert-ink: var(--m3-cert-accent);
}
:where(.dark) .m3-certificate {
  --m3-cert-ink: color-mix(in oklab, var(--m3-cert-accent) 55%, #000);
}
.m3-certificate__frame {
  position: absolute;
  inset: 3.2cqw;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3cqw 6cqw;
  gap: 1cqw;
}
.m3-certificate__issuer {
  display: flex;
  align-items: center;
  gap: 1.2cqw;
  font-size: 1.7cqw;
  font-weight: 600;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--m3-cert-ink);
}
.m3-certificate__issuer img,
.m3-certificate__issuer svg {
  height: 4.5cqw;
  width: auto;
}
.m3-certificate__title {
  font-size: 4.6cqw;
  line-height: 1.1;
  font-weight: 700;
  margin-top: 1cqw;
}
.m3-certificate__lead {
  font-size: 1.8cqw;
  color: #49454f;
  margin-top: 1.4cqw;
}
.m3-certificate__name {
  font-size: 5.4cqw;
  line-height: 1.15;
  color: var(--m3-cert-ink);
  padding: 0 4cqw 0.6cqw;
  border-bottom: 0.15cqw solid color-mix(in srgb, var(--m3-cert-ink) 50%, transparent);
}
.m3-certificate__desc {
  font-size: 1.9cqw;
  line-height: 1.45;
  max-width: 72cqw;
  color: #49454f;
  margin-top: 0.6cqw;
}
.m3-certificate__extra {
  font-size: 1.6cqw;
}
.m3-certificate__footer {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 6cqw;
  width: 100%;
  margin-top: auto;
}
.m3-certificate__sign {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 18cqw;
}
.m3-certificate__sign-value {
  font-size: 1.7cqw;
  padding-bottom: 0.4cqw;
}
.m3-certificate__sign-img {
  height: 5.5cqw;
  max-width: 22cqw;
  object-fit: contain;
  margin-bottom: -0.8cqw;
}
.m3-certificate__sign-line {
  align-self: stretch;
  border-top: 0.12cqw solid #1d1b20;
}
.m3-certificate__sign-name {
  font-size: 1.6cqw;
  font-weight: 600;
  margin-top: 0.5cqw;
}
.m3-certificate__sign-role {
  font-size: 1.35cqw;
  color: #49454f;
  margin-top: 0.3cqw;
}
.m3-certificate__seal {
  position: relative;
  width: 11cqw;
  height: 11cqw;
  flex-shrink: 0;
  color: #fff;
}
.m3-certificate__rosette {
  width: 100%;
  height: 100%;
  fill: var(--m3-cert-ink);
}
.m3-certificate__seal-icon {
  position: absolute;
  inset: 0;
  margin: auto;
  font-size: 5cqw !important;
  width: 5cqw !important;
  height: 5cqw !important;
  display: flex;
  align-items: center;
  justify-content: center;
}
.m3-certificate__code {
  position: absolute;
  bottom: 1.2cqw;
  right: 2cqw;
  font-size: 1.1cqw;
  color: #79747e;
  font-family: var(--font-mono, ui-monospace, monospace);
}

/* classic: double frame, corner marks, serif type */
.m3-certificate--classic {
  font-family: var(--font-serif, Georgia, 'Times New Roman', serif);
}
.m3-certificate--classic .m3-certificate__frame {
  border: 0.5cqw double var(--m3-cert-ink);
  outline: 0.15cqw solid color-mix(in srgb, var(--m3-cert-ink) 45%, transparent);
  outline-offset: 0.8cqw;
}
.m3-certificate--classic .m3-certificate__title {
  font-weight: 400;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.m3-certificate--classic .m3-certificate__name {
  font-style: italic;
}

/* modern: a band of the accent color on the left */
.m3-certificate--modern {
  font-family: var(--font-sans, system-ui, sans-serif);
}
.m3-certificate--modern::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 2.4cqw;
  background: var(--m3-cert-ink);
}
.m3-certificate--modern::after {
  content: '';
  position: absolute;
  top: -12cqw;
  right: -12cqw;
  width: 34cqw;
  height: 34cqw;
  border-radius: 50%;
  background: color-mix(in srgb, var(--m3-cert-ink) 10%, transparent);
}
.m3-certificate--modern .m3-certificate__frame {
  align-items: flex-start;
  text-align: start;
  inset: 3.2cqw 3.2cqw 3.2cqw 6cqw;
  z-index: 1;
}
.m3-certificate--modern .m3-certificate__name {
  padding-inline: 0 4cqw;
  font-weight: 600;
}
.m3-certificate--modern .m3-certificate__footer {
  justify-content: flex-start;
}

/* minimal: a hairline frame */
.m3-certificate--minimal {
  font-family: var(--font-sans, system-ui, sans-serif);
}
.m3-certificate--minimal .m3-certificate__frame {
  border: 0.12cqw solid #cac4d0;
}
.m3-certificate--minimal .m3-certificate__title {
  font-weight: 300;
}
</style>
