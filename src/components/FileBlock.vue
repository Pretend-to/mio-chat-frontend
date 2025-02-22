<template>
  <div class="file-block">
    <div class="file-block-icon">
      <div class="file-icon" :class="iconClass">
        <!-- Dynamic class binding -->
        <span v-if="file_type"> {{ file_type.toUpperCase() }}</span>
      </div>
    </div>
    <div class="file-block-text">
      <div class="file-name" :title="file_name">{{ file_name }}</div>
      <div class="file-info">
        {{ file_type.toUpperCase() }}, {{ formated_file_size }}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    fileUrl: {
      // 修改为 camelCase
      type: String,
      required: true,
    },
  },
  data() {
    return {
      file_name: "",
      file_type: "",
      formated_file_size: "",
    };
  },
  computed: {
    iconClass() {
      //Use lower case for comparison, easier to manage
      const type = this.file_type.toLowerCase();

      if (type === "pdf") {
        return "file-icon-pdf";
      } else if (["xls", "xlsx", "csv"].includes(type)) {
        // Spreadsheet (Excel, CSV)
        return "file-icon-spreadsheet";
      } else if (["doc", "docx"].includes(type)) {
        // Word
        return "file-icon-word";
      } else if (["ppt", "pptx"].includes(type)) {
        // PowerPoint
        return "file-icon-ppt";
      } else {
        return "file-icon-other"; // Default (gray)
      }
    },
  },
  created() {
    // 从查询参数中获取文件大小
    const url = this.fileUrl.split("?");
    const params = new URLSearchParams(url[1]);
    const bits = params.get("size");
    this.file_name = params.get("name");
    this.formated_file_size = this.formatFileSize(bits);
    // 从url中获取文件类型
    const file_type = url[0].split(".");
    this.file_type = file_type[file_type.length - 1];
  },
  methods: {
    formatFileSize(bits) {
      const units = ["B", "KB", "MB"];
      let unitIndex = 0;
      while (bits >= 1024) {
        bits /= 1024;
        unitIndex++;
      }
      return bits.toFixed(2) + " " + units[unitIndex];
    },
  },
};
</script>

<style scoped>
.file-block {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 5px;
  background-color: #f5f5f5;
  margin-bottom: 8px;
  width: 12rem;
  position: relative;
}

.file-block-icon {
  width: 40px;
  height: 40px;
  margin-right: 8px;
}

.file-icon {
  width: 40px;
  height: 40px;
  /*  Remove default background  */
  /* background-color: #4285f4; */
  color: #fff;
  border-radius: 5px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
}
/* Add specific styles for each file type */
.file-icon-pdf {
  background-color: red;
}

.file-icon-spreadsheet {
  background-color: green;
}

.file-icon-word {
  background-color: blue;
}
.file-icon-ppt {
  background-color: red;
}

.file-icon-other {
  background-color: gray;
}

.file-block-text {
  flex: 1;
  overflow: hidden;
}

.file-name {
  font-weight: bold;
  font-size: 12px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-info {
  font-size: 10px;
  color: #777;
}
</style>
