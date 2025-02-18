<template>
    <div class="file-block">
      <div class="file-block-icon">
        <div class="file-icon">
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
    data() {
      return {
        file_name: "",
        file_type: "",
        formated_file_size: "",
      };
    },
    props: {
      file_url: {
        type: String,
        required: true,
      },
    },
    created() {
      // 从查询参数中获取文件大小
      const url = this.file_url.split("?");
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
    padding: 8px; /* Smaller padding */
    border-radius: 5px;
    background-color: #f5f5f5;
    margin-bottom: 8px; /* Smaller margin */
    width: 12rem; /* Smaller width */
    position: relative;
  }
  
  .file-block-icon {
    width: 40px; /* Smaller icon */
    height: 40px; /* Smaller icon */
    margin-right: 8px; /* Smaller margin */
  }
  
  .file-icon {
    width: 40px; /* Smaller icon */
    height: 40px; /* Smaller icon */
    background-color: #4285f4;
    color: #fff;
    border-radius: 5px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 14px; /* Smaller font */
  }
  
  .file-block-text {
    flex: 1;
    overflow: hidden; /* Hide overflowing text */
  }
  
  .file-name {
    font-weight: bold;
    font-size: 12px; /* Smaller font */
    color: #333;
    white-space: nowrap; /* Prevent wrapping */
    overflow: hidden; /* Hide overflowing text */
    text-overflow: ellipsis; /* Add ellipsis */
  }
  
  .file-info {
    font-size: 10px; /* Smaller font */
    color: #777;
  }
  </style>