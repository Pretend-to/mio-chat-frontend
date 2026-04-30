# 存储适配器 (Storage) API 接口文档

此接口用于管理系统的文件和图片存储方式。目前支持 **本地存储 (Local)** 和 **S3 兼容存储 (S3/R2/MinIO等)**。

## 1. 获取存储配置

获取当前的存储配置信息。出于安全考虑，`secretAccessKey` 等敏感信息会被脱敏。

- **URL**: `/api/config/storage`
- **方法**: `GET`
- **鉴权**: 需要管理员权限 (`x-admin-code` Header)

### 响应示例 (S3 兼容存储)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "type": "s3",
    "bucket": "mio-chat-storage",
    "endpoint": "https://<account-id>.r2.cloudflarestorage.com",
    "accessKeyId": "your-access-key-id",
    "secretAccessKey": "abcd...efgh",
    "baseUrl": "https://pub-xxx.r2.dev",
    "region": "auto"
  }
}
```

### 响应示例 (本地存储)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "type": "local"
  }
}
```

---

## 2. 更新存储配置

修改系统的存储方式。**更新后系统会自动重新加载存储适配器，即刻生效。**

- **URL**: `/api/config/storage`
- **方法**: `PUT`
- **鉴权**: 需要管理员权限 (`x-admin-code` Header)
- **Content-Type**: `application/json`

### 请求体 (S3 兼容存储)

| 参数            | 类型   | 必选 | 说明                                                         |
| :-------------- | :----- | :--- | :----------------------------------------------------------- |
| type            | string | 是   | 必须为 `s3` (适用于 R2, MinIO, AWS S3 等)                    |
| bucket          | string | 是   | 存储桶名称                                                   |
| endpoint        | string | 是   | 存储服务终端地址                                             |
| accessKeyId     | string | 是   | 访问密钥 ID                                                  |
| secretAccessKey | string | 是   | 访问密钥 Secret (如果传入脱敏后的值，后台将忽略此字段的更新) |
| baseUrl         | string | 否   | 公网访问的基础 URL                                           |
| region          | string | 否   | 区域，默认为 `auto`                                          |

### 请求体 (本地存储)

```json
{
  "type": "local"
}
```

### 响应示例

```json
{
  "code": 0,
  "message": "配置更新成功",
  "data": {
    "message": "配置更新成功",
    "updated": ["storage"]
  }
}
```

---

## 3. 测试存储可用性

在保存配置前，可以使用此接口测试配置是否正确（包括连接、上传权限、删除权限）。

- **URL**: `/api/config/storage/test`
- **方法**: `POST`
- **鉴权**: 需要管理员权限 (`x-admin-code` Header)
- **请求体**: 同“更新存储配置”中的请求体（必须传入真实的密钥进行测试，不支持自动替换脱敏值）

### 响应示例 (成功)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "success": true,
    "message": "存储配置测试成功，连接与读写正常"
  }
}
```

### 响应示例 (失败)

```json
{
  "code": 1,
  "message": "存储测试失败: Access Denied",
  "data": null
}
```

---

## 4. 注意事项

1. **脱敏处理**: 后端返回的 `secretAccessKey` 是经过脱敏的。前端在提交更新时，如果该字段的值没有变化（即保持为脱敏后的格式），后端会自动忽略该字段，不会覆盖数据库中真实的 Secret。
2. **测试接口行为**: 测试接口 (`/api/config/storage/test`) 是严格按照输入运行的。如果用户在界面上直接点击测试而没有重新输入密钥（此时输入框内容为脱敏字符串），测试将会因密钥错误而失败。
3. **热更新**: 修改配置后不需要重启后端服务，`StorageService` 会立即切换底层适配器。
4. **依赖安装**: 生产环境下使用 S3/R2 需要确保后端已安装 `@aws-sdk/client-s3`。
