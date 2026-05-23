<template>
  <div class="dynamic-form">
    <div
      v-for="(group, groupKey) in schema"
      :key="groupKey"
      class="settings-group"
    >
      <!-- 如果是组 (type: group) -->
      <template v-if="group.type === 'group'">
        <div class="group-title">{{ group.label }}</div>
        <div class="settings-card">
          <div
            v-for="(field, fieldKey) in group.fields"
            :key="fieldKey"
            class="setting-field"
          >
            <div class="field-label">{{ field.label }}</div>
            <div class="field-value">
              <render-field
                :field="field"
                :field-key="fieldKey"
                :group-key="groupKey"
                :model-value="getValue(groupKey, fieldKey)"
                @update:model-value="(val) => setValue(groupKey, fieldKey, val)"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- 如果是顶级字段 -->
      <template v-else>
        <div class="group-title">额外设置</div>
        <div class="settings-card">
          <div class="setting-field">
            <div class="field-label">{{ group.label }}</div>
            <div class="field-value">
              <render-field
                :field="group"
                :field-key="groupKey"
                :model-value="getValue(groupKey)"
                @update:model-value="(val) => setValue(groupKey, null, val)"
              />
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import RenderField from "./RenderField.vue";

/**
 * 动态配置表单组件
 * 根据后端提供的 schema 自动渲染配置界面
 */
export default {
  name: "DynamicSettingsForm",
  components: {
    RenderField,
  },
  props: {
    schema: {
      type: Object,
      default: () => ({}),
    },
    values: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ["update:values"],
  methods: {
    getValue(groupKey, fieldKey) {
      if (fieldKey) {
        return (
          this.values[groupKey]?.[fieldKey] ??
          this.schema[groupKey].fields[fieldKey].default
        );
      }
      return this.values[groupKey] ?? this.schema[groupKey].default;
    },
    setValue(groupKey, fieldKey, val) {
      const newValues = JSON.parse(JSON.stringify(this.values));
      if (fieldKey) {
        if (!newValues[groupKey]) newValues[groupKey] = {};
        newValues[groupKey][fieldKey] = val;
      } else {
        newValues[groupKey] = val;
      }
      this.$emit("update:values", newValues);
    },
  },
};
</script>

<style scoped>
.dynamic-form {
  width: 100%;
}
</style>
