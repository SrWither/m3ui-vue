<script setup lang="ts">
// Internal: one group of MFilterBuilder (its rules, nested groups and buttons), recursive. Changes go up as a new
// group object; it never mutates the one it got.
import { computed } from 'vue'
import MButton from './MButton.vue'
import MDatePicker from './MDatePicker.vue'
import MIconButton from './MIconButton.vue'
import MMultiSelect from './MMultiSelect.vue'
import MNumberField from './MNumberField.vue'
import MSegmentedButton from './MSegmentedButton.vue'
import MSelect from './MSelect.vue'
import MTextField from './MTextField.vue'
import MFilterGroup from './_MFilterGroup.vue'
import { useLocale } from '../composables/useLocale'
import {
  VALUELESS, createGroup, createRule, isGroup, operatorsFor,
  type FilterField, type FilterGroup, type FilterOperator, type FilterRule,
} from '../composables/filterBuilder'

const props = defineProps<{
  group: FilterGroup
  fields: FilterField[]
  depth: number
  maxDepth: number
  disabled?: boolean
}>()

const emit = defineEmits<{ update: [group: FilterGroup]; remove: [] }>()

const t = useLocale()

const fieldOptions = computed(() => props.fields.map((f) => ({ label: f.label, value: f.key })))
const fieldOf = (key: string) => props.fields.find((f) => f.key === key)

const OP_LABELS = computed<Record<FilterOperator, string>>(() => ({
  contains: t.filterOpContains, notContains: t.filterOpNotContains, equals: t.filterOpEquals, notEquals: t.filterOpNotEquals,
  startsWith: t.filterOpStartsWith, endsWith: t.filterOpEndsWith, gt: t.filterOpGt, gte: t.filterOpGte, lt: t.filterOpLt,
  lte: t.filterOpLte, between: t.filterOpBetween, in: t.filterOpIn, notIn: t.filterOpNotIn, isTrue: t.filterOpIsTrue,
  isFalse: t.filterOpIsFalse, isEmpty: t.filterOpIsEmpty, isNotEmpty: t.filterOpIsNotEmpty,
}))
function opLabel(op: FilterOperator, field?: FilterField) {
  // On dates, greater / less read as after / before
  if (field?.type === 'date' && op === 'gt') return t.filterOpAfter
  if (field?.type === 'date' && op === 'lt') return t.filterOpBefore
  return OP_LABELS.value[op]
}
const operatorOptions = (rule: FilterRule) => {
  const field = fieldOf(rule.field)
  return field ? operatorsFor(field).map((op) => ({ label: opLabel(op, field), value: op })) : []
}

const combinators = computed(() => [
  { value: 'and' as const, label: t.filterMatchAll },
  { value: 'or' as const, label: t.filterMatchAny },
])

function set(rules: (FilterRule | FilterGroup)[], combinator = props.group.combinator) {
  emit('update', { ...props.group, combinator, rules })
}
function replace(i: number, next: FilterRule | FilterGroup) {
  set(props.group.rules.map((r, j) => (j === i ? next : r)))
}
function removeAt(i: number) {
  set(props.group.rules.filter((_, j) => j !== i))
}

function setField(i: number, rule: FilterRule, key: unknown) {
  const field = fieldOf(String(key))
  if (!field || field.key === rule.field) return
  replace(i, { ...createRule(field), id: rule.id })
}
function setOperator(i: number, rule: FilterRule, op: unknown) {
  const next = op as FilterOperator
  if (next === rule.operator) return
  // A value survives when it still fits: none for valueless operators, a pair only for `between`, a list for in / notIn
  const shape = (o: FilterOperator) => (VALUELESS.includes(o) ? 'none' : o === 'between' ? 'pair' : o === 'in' || o === 'notIn' ? 'list' : 'one')
  const value = shape(next) === shape(rule.operator) ? rule.value : undefined
  replace(i, { ...rule, operator: next, value })
}
const setValue = (i: number, rule: FilterRule, value: unknown) => replace(i, { ...rule, value })
function setBound(i: number, rule: FilterRule, which: 0 | 1, value: unknown) {
  const pair = Array.isArray(rule.value) ? [...rule.value] : [null, null]
  pair[which] = value === '' ? null : value
  replace(i, { ...rule, value: pair })
}
const bound = (rule: FilterRule, which: 0 | 1) => (Array.isArray(rule.value) ? rule.value[which] ?? null : null)

function addRule() {
  const first = props.fields[0]
  if (first) set([...props.group.rules, createRule(first)])
}
function addGroup() {
  const first = props.fields[0]
  const group = createGroup(props.group.combinator === 'and' ? 'or' : 'and')
  if (first) group.rules.push(createRule(first))
  set([...props.group.rules, group])
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="group.rules.length > 1 || depth > 0" class="flex items-center gap-2">
      <MSegmentedButton
        :model-value="group.combinator"
        :options="combinators"
        density="compact"
        class="w-auto"
        :aria-disabled="disabled || undefined"
        @update:model-value="(v: 'and' | 'or') => !disabled && set(group.rules, v)"
      />
      <span class="flex-1" />
      <MIconButton v-if="depth > 0" icon="delete" :label="t.filterRemoveGroup" size="sm" :disabled="disabled" @click="emit('remove')" />
    </div>

    <p v-if="!group.rules.length && depth === 0" class="text-body-medium text-on-surface-variant">{{ t.filterNoConditions }}</p>

    <template v-for="(rule, i) in group.rules" :key="rule.id">
      <!-- A nested group -->
      <div v-if="isGroup(rule)" class="rounded-md border border-outline-variant bg-surface-container-low p-3" data-filter-group>
        <MFilterGroup
          :group="rule"
          :fields="fields"
          :depth="depth + 1"
          :max-depth="maxDepth"
          :disabled="disabled"
          @update="(g: FilterGroup) => replace(i, g)"
          @remove="removeAt(i)"
        />
      </div>

      <!-- A rule: field · operator · value · remove; wraps on narrow widths -->
      <div v-else class="flex flex-wrap items-start gap-2" data-filter-rule>
        <MSelect
          :model-value="rule.field"
          :options="fieldOptions"
          :label="t.filterField"
          variant="outlined"
          :disabled="disabled"
          class="min-w-40 flex-[1_1_10rem]"
          @update:model-value="(v: unknown) => setField(i, rule, v)"
        />
        <MSelect
          :model-value="rule.operator"
          :options="operatorOptions(rule)"
          :label="t.filterOperator"
          variant="outlined"
          :disabled="disabled"
          class="min-w-40 flex-[1_1_10rem]"
          @update:model-value="(v: unknown) => setOperator(i, rule, v)"
        />

        <div class="flex min-w-48 flex-[2_1_14rem] gap-2">
          <template v-if="VALUELESS.includes(rule.operator)" />
          <template v-else-if="rule.operator === 'between' && fieldOf(rule.field)?.type === 'date'">
            <MDatePicker :model-value="(bound(rule, 0) as string | null)" :label="t.filterFrom" variant="outlined" :disabled="disabled" class="min-w-0 flex-1" @update:model-value="(v: string | null) => setBound(i, rule, 0, v)" />
            <MDatePicker :model-value="(bound(rule, 1) as string | null)" :label="t.filterTo" variant="outlined" :disabled="disabled" class="min-w-0 flex-1" @update:model-value="(v: string | null) => setBound(i, rule, 1, v)" />
          </template>
          <template v-else-if="rule.operator === 'between'">
            <MNumberField :model-value="(bound(rule, 0) as number | null)" :label="t.filterFrom" variant="outlined" :disabled="disabled" class="min-w-0 flex-1" @update:model-value="(v: number | null) => setBound(i, rule, 0, v)" />
            <MNumberField :model-value="(bound(rule, 1) as number | null)" :label="t.filterTo" variant="outlined" :disabled="disabled" class="min-w-0 flex-1" @update:model-value="(v: number | null) => setBound(i, rule, 1, v)" />
          </template>
          <MMultiSelect
            v-else-if="rule.operator === 'in' || rule.operator === 'notIn'"
            :model-value="(Array.isArray(rule.value) ? rule.value : [])"
            :options="fieldOf(rule.field)?.options ?? []"
            :label="t.filterValue"
            variant="outlined"
            :disabled="disabled"
            class="min-w-0 flex-1"
            @update:model-value="(v: unknown[]) => setValue(i, rule, v)"
          />
          <MDatePicker
            v-else-if="fieldOf(rule.field)?.type === 'date'"
            :model-value="(rule.value as string | null) ?? null"
            :label="t.filterValue"
            variant="outlined"
            :disabled="disabled"
            class="min-w-0 flex-1"
            @update:model-value="(v: string | null) => setValue(i, rule, v)"
          />
          <MNumberField
            v-else-if="fieldOf(rule.field)?.type === 'number'"
            :model-value="(rule.value as number | null) ?? null"
            :label="t.filterValue"
            variant="outlined"
            :disabled="disabled"
            class="min-w-0 flex-1"
            @update:model-value="(v: number | null) => setValue(i, rule, v)"
          />
          <MTextField
            v-else
            :model-value="String(rule.value ?? '')"
            :label="t.filterValue"
            variant="outlined"
            :disabled="disabled"
            class="min-w-0 flex-1"
            @update:model-value="(v: string | number) => setValue(i, rule, v)"
          />
        </div>

        <MIconButton icon="close" :label="t.filterRemoveCondition" size="sm" :disabled="disabled" class="mt-3 shrink-0" @click="removeAt(i)" />
      </div>
    </template>

    <div class="flex flex-wrap gap-1">
      <MButton variant="text" icon="add" size="sm" :disabled="disabled || !fields.length" @click="addRule">{{ t.filterAddCondition }}</MButton>
      <MButton v-if="depth < maxDepth" variant="text" icon="library_add" size="sm" :disabled="disabled || !fields.length" @click="addGroup">{{ t.filterAddGroup }}</MButton>
    </div>
  </div>
</template>
