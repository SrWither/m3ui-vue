<script setup lang="ts">
/**
 * A visual filter builder: conditions of field · operator · value, combined so all or any of them match, with
 * nested groups for mixes like "status is open AND (priority is high OR due before Friday)". Each field's type
 * (text, number, date, select, boolean) picks its operators and its value input. The filter is the v-model, a plain
 * JSON tree; `filterRows(rows, filter, fields)` (or `matchesFilter`) applies it to a table's rows, or send it to your
 * server. Rules still being filled in match everything. Lays out by its own width: rows wrap when narrow.
 *
 * @event update:modelValue The filter changed
 */
import { computed } from 'vue'
import MFilterGroup from './_MFilterGroup.vue'
import { createFilter, type FilterField, type FilterGroup } from '../composables/filterBuilder'

const props = withDefaults(
  defineProps<{
    /** The filter (v-model): a group of rules and nested groups. Leave it out or null to start empty */
    modelValue?: FilterGroup | null
    /** The fields that can be filtered on; see `FilterField` */
    fields: FilterField[]
    /** How deep groups can nest (0: no groups, conditions only) */
    maxDepth?: number
    /** Read-only */
    disabled?: boolean
  }>(),
  { modelValue: null, maxDepth: 1, disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [filter: FilterGroup] }>()

// Kept stable while the v-model is empty, so the root group's id doesn't change on every render
const empty = createFilter()
const root = computed(() => (props.modelValue && typeof props.modelValue === 'object' ? props.modelValue : empty))
</script>

<template>
  <div class="m3-filter-builder" role="group">
    <MFilterGroup
      :group="root"
      :fields="fields"
      :depth="0"
      :max-depth="maxDepth"
      :disabled="disabled"
      @update="(g: FilterGroup) => emit('update:modelValue', g)"
    />
  </div>
</template>
