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

<style scoped lang="scss">
.dynamic-form {
  width: 100%;
}

.settings-group {
  margin-bottom: 18px;

  &:last-child {
    margin-bottom: 0;
  }
}

.group-title {
  padding: 0 4px 10px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--mio-text-primary, #303133);
}

.settings-card {
  background: var(--mio-bg-card, #ffffff);
  border: 1px solid var(--mio-border-color-light, #ebeef5);
  border-radius: 10px;
  padding: 8px 16px;
  box-shadow: var(--mio-shadow-light, 0 1px 4px rgba(0, 0, 0, 0.04));
  transition: background 0.2s, border-color 0.2s;
}

.setting-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--mio-border-color-lighter, #f2f6fc);

  &:last-child {
    border-bottom: none;
  }
}

.field-label {
  font-size: 13px;
  color: var(--mio-text-regular, #606266);
}

// 暗色主题适配
:global([data-theme="dark"] .dynamic-form .group-title),
:global(html.dark .dynamic-form .group-title) {
  color: #e5eaf3;
}

:global([data-theme="dark"] .dynamic-form .settings-card),
:global(html.dark .dynamic-form .settings-card) {
  background: #25252b;
  border-color: #41414b;
  box-shadow: none;
}

:global([data-theme="dark"] .dynamic-form .setting-field),
:global(html.dark .dynamic-form .setting-field) {
  border-bottom-color: #383842;
}

:global([data-theme="dark"] .dynamic-form .field-label),
:global(html.dark .dynamic-form .field-label) {
  color: #cfd3dc;
}
</style>
