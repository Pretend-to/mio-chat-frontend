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
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.group-title {
  padding: 0 4px 12px;
  font-size: 15px;
  font-weight: 500;
  color: var(--mio-text-primary);
  text-align: left;
}

.settings-card {
  background: var(--mio-bg-card);
  border-radius: 12px;
  padding: 8px 24px;
  margin-bottom: 0;
  box-shadow: var(--mio-shadow-light);
}

.setting-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--mio-border-color-lighter);

  &:last-child {
    border-bottom: none;
  }
}

.field-label {
  width: 14rem;
  font-size: 13px;
  color: var(--mio-text-secondary);
  flex-shrink: 0;
  text-align: left;
}

.field-value {
  flex: 1;
  max-width: 60%;
  text-align: right;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
</style>
