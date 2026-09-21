<template>
  <template v-if="field.type === 'boolean'">
    <el-switch
      :model-value="modelValue"
      size="small"
      @update:model-value="(val) => $emit('update:modelValue', val)"
    />
  </template>
  <template v-else-if="field.type === 'select'">
    <el-select
      :model-value="modelValue"
      size="small"
      style="width: 140px"
      @update:model-value="(val) => $emit('update:modelValue', val)"
    >
      <el-option
        v-for="opt in field.options"
        :key="opt.value"
        :label="opt.label"
        :value="opt.value"
      />
    </el-select>
  </template>
  <template v-else-if="field.type === 'string'">
    <el-input
      :model-value="modelValue"
      size="small"
      style="width: 100%"
      :placeholder="field.placeholder"
      @update:model-value="(val) => $emit('update:modelValue', val)"
    />
  </template>
  <template v-else-if="field.type === 'number'">
    <el-input-number
      :model-value="modelValue"
      size="small"
      style="width: 140px"
      :min="field.min"
      :max="field.max"
      :step="field.step"
      @update:model-value="(val) => $emit('update:modelValue', val)"
    />
  </template>
  <template v-else-if="field.type === 'array'">
    <el-select
      :model-value="modelValue"
      size="small"
      style="width: 100%"
      multiple
      filterable
      allow-create
      default-first-option
      placeholder="输入并回车"
      @update:model-value="(val) => $emit('update:modelValue', val)"
    >
      <el-option
        v-for="item in modelValue || []"
        :key="item"
        :label="item"
        :value="item"
      />
    </el-select>
  </template>
</template>

<script>
export default {
  name: "RenderField",
  props: {
    field: {
      type: Object,
      required: true,
    },
    modelValue: {
      required: true,
    },
  },
  emits: ["update:modelValue"],
};
</script>
