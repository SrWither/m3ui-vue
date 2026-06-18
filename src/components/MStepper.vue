<script setup lang="ts">
import { computed } from 'vue'
import MIcon from './MIcon.vue'

export interface StepItem {
  label: string
  description?: string
  icon?: string
  optional?: boolean
  error?: boolean
}

const props = withDefaults(defineProps<{
  steps: StepItem[]
  modelValue: number
  direction?: 'horizontal' | 'vertical'
  linear?: boolean
}>(), { direction: 'horizontal', linear: true })

const emit = defineEmits<{ 'update:modelValue': [number] }>()

function stepState(index: number) {
  if (props.steps[index]?.error) return 'error'
  if (index < props.modelValue) return 'completed'
  if (index === props.modelValue) return 'active'
  return 'inactive'
}

const canClick = computed(() => !props.linear)

function select(index: number) {
  if (canClick.value) emit('update:modelValue', index)
}
</script>

<template>
  <!-- Horizontal -->
  <div
    v-if="direction === 'horizontal'"
    class="flex w-full items-start"
  >
    <template v-for="(step, i) in steps" :key="i">
      <!-- Step -->
      <div
        class="flex flex-col items-center gap-2"
        :class="canClick && stepState(i) !== 'active' ? 'cursor-pointer' : ''"
        @click="select(i)"
      >
        <!-- Circle -->
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-label-large font-medium transition-colors duration-200"
          :class="{
            'bg-primary text-on-primary': stepState(i) === 'active' || stepState(i) === 'completed',
            'bg-error text-on-error': stepState(i) === 'error',
            'bg-surface-container-highest text-on-surface-variant': stepState(i) === 'inactive',
          }"
        >
          <MIcon v-if="stepState(i) === 'completed'" name="check" :size="20" />
          <MIcon v-else-if="stepState(i) === 'error'" name="priority_high" :size="20" />
          <MIcon v-else-if="step.icon" :name="step.icon" :size="20" />
          <span v-else>{{ i + 1 }}</span>
        </div>

        <!-- Label -->
        <div class="flex flex-col items-center text-center">
          <span
            class="text-label-large"
            :class="{
              'font-medium text-on-surface': stepState(i) === 'active' || stepState(i) === 'completed',
              'text-error': stepState(i) === 'error',
              'text-on-surface-variant': stepState(i) === 'inactive',
            }"
          >
            {{ step.label }}
          </span>
          <span v-if="step.description" class="text-body-small text-on-surface-variant">
            {{ step.description }}
          </span>
          <span v-if="step.optional" class="text-body-small text-on-surface-variant">
            Opcional
          </span>
        </div>
      </div>

      <!-- Connector -->
      <div
        v-if="i < steps.length - 1"
        class="mt-[18px] flex flex-1 items-center px-2"
      >
        <div
          class="h-[1px] w-full transition-colors duration-300"
          :class="i < modelValue ? 'bg-primary' : 'bg-outline-variant'"
        />
      </div>
    </template>
  </div>

  <!-- Vertical -->
  <div v-else class="flex flex-col">
    <template v-for="(step, i) in steps" :key="i">
      <div class="flex gap-4">
        <!-- Left column: circle + connector -->
        <div class="flex flex-col items-center">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-label-large font-medium transition-colors duration-200"
            :class="[
              {
                'bg-primary text-on-primary': stepState(i) === 'active' || stepState(i) === 'completed',
                'bg-error text-on-error': stepState(i) === 'error',
                'bg-surface-container-highest text-on-surface-variant': stepState(i) === 'inactive',
              },
              canClick && stepState(i) !== 'active' ? 'cursor-pointer' : '',
            ]"
            @click="select(i)"
          >
            <MIcon v-if="stepState(i) === 'completed'" name="check" :size="20" />
            <MIcon v-else-if="stepState(i) === 'error'" name="priority_high" :size="20" />
            <MIcon v-else-if="step.icon" :name="step.icon" :size="20" />
            <span v-else>{{ i + 1 }}</span>
          </div>
          <!-- Vertical connector -->
          <div
            v-if="i < steps.length - 1"
            class="my-1 w-[1px] flex-1 transition-colors duration-300"
            :class="i < modelValue ? 'bg-primary' : 'bg-outline-variant'"
            style="min-height: 24px"
          />
        </div>

        <!-- Right column: label + content -->
        <div
          class="pb-6"
          :class="canClick && stepState(i) !== 'active' ? 'cursor-pointer' : ''"
          @click="select(i)"
        >
          <span
            class="text-label-large"
            :class="{
              'font-medium text-on-surface': stepState(i) === 'active' || stepState(i) === 'completed',
              'text-error': stepState(i) === 'error',
              'text-on-surface-variant': stepState(i) === 'inactive',
            }"
          >
            {{ step.label }}
          </span>
          <p v-if="step.description" class="mt-0.5 text-body-small text-on-surface-variant">
            {{ step.description }}
          </p>
          <p v-if="step.optional" class="text-body-small text-on-surface-variant">
            Opcional
          </p>

          <!-- Slot for step content when active -->
          <div v-if="stepState(i) === 'active' && $slots[`step-${i}`]" class="mt-3">
            <slot :name="`step-${i}`" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
