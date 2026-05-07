<template>
  <template v-if="field.type === 'boolean'">
    <el-switch :model-value="modelValue" @update:model-value="val => $emit('update:modelValue', val)" />
  </template>
  <template v-else-if="field.type === 'select'">
    <el-select :model-value="modelValue" @update:model-value="val => $emit('update:modelValue', val)" style="width: 10rem">
      <el-option v-for="opt in field.options" :key="opt.value" :label="opt.label" :value="opt.value" />
    </el-select>
  </template>
  <template v-else-if="field.type === 'string'">
    <el-input :model-value="modelValue" @update:model-value="val => $emit('update:modelValue', val)" :placeholder="field.placeholder" />
  </template>
  <template v-else-if="field.type === 'number'">
    <el-input-number :model-value="modelValue" @update:model-value="val => $emit('update:modelValue', val)" :min="field.min" :max="field.max" :step="field.step" />
  </template>
  <template v-else-if="field.type === 'array'">
    <el-select :model-value="modelValue" @update:model-value="val => $emit('update:modelValue', val)" multiple filterable allow-create default-first-option placeholder="输入并回车">
      <el-option v-for="item in (modelValue || [])" :key="item" :label="item" :value="item" />
    </el-select>
  </template>
</template>

<script>
export default {
  name: 'RenderField',
  props: {
    field: {
      type: Object,
      required: true
    },
    modelValue: {
      required: true
    }
  },
  emits: ['update:modelValue']
}
</script>
