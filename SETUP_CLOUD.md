# 齿案台 · CloudBase 共享云端配置

齿案台继续使用 GitHub Pages 提供前端页面，CloudBase 保存共享病例数据和新上传的影像。两位使用者登录同一个共享账号；病例和影像只允许登录用户访问。浏览器仍保存一份本地副本，首次迁移前也会另存备份。

## 1. 环境配置

`config.js` 已填写上海环境 ID：`dental-shared-d2gstqzg823f8a562`。环境 ID 是公开标识，不是访问密钥。

## 2. CloudBase 控制台设置

在 CloudBase 控制台选择该环境后完成以下设置：

1. 在“身份认证”中启用用户名密码登录，创建一个专供你们共同使用的账号。不要在网页代码中填写账号密码；页面只提供登录入口，不提供注册入口。
2. 将 `kyring151.github.io` 加入安全域名/可信域名。
3. 在文档型数据库创建集合 `dwb_shared`。
4. 在该集合的安全规则中设置仅共享账号 UID 可读写。先从“用户管理”复制该账号 UID，再把下面的 `SHARED_UID` 换成实际 UID：

```json
{
  "read": "auth.uid == 'SHARED_UID'",
  "create": "auth.uid == 'SHARED_UID'",
  "update": "auth.uid == 'SHARED_UID'",
  "delete": "auth.uid == 'SHARED_UID'"
}
```

5. 在云存储安全规则中同样限制为该 UID：

```json
{
  "read": "auth.uid == 'SHARED_UID'",
  "write": "auth.uid == 'SHARED_UID'"
}
```

不要设置为“所有用户可读写”，也不要启用匿名登录或开放注册。完成后将共享账号密码仅告知另一位使用者。

## 3. 首次迁移

在原来存有病例的浏览器打开工作台并用共享账号登录。页面会把本机病例按病例编号与云端合并，较新的 `updatedAt` 版本优先；迁移前数据会留在浏览器本地备份键 `dentalWorkbench.preCloudBackup`，原有导出/导入功能也仍可用。迁移完成后，另一台设备登录同一账号即可看到共享数据。

已有 Cloudinary 图片会尝试复制进 CloudBase 私有云存储；若浏览器因旧图床跨域设置无法读取，病例仍保留原图片链接，页面会提示未迁移的数量。这些旧链接仍可能被任何持有链接的人访问，建议在确认 CloudBase 图片齐全后，再从 Cloudinary 删除旧图。

## 4. 运作方式与注意事项

- 新增图片进入 CloudBase 云存储；界面使用限时访问链接，数据记录保存 CloudBase 文件 ID。
- 病例数据和个人资料同步到 `dwb_shared/workspace` 文档；请勿手工修改该文档。
- 每次变更先写本机副本，再后台同步。同步失败时右下角会提示，本机仍保留数据；联网后再次编辑即可触发同步。
- 多台设备保存时按病例编号合并，较晚的 `updatedAt` 版本优先，删除会同步；这不是字段级协同编辑。切换设备后点右下角同步状态可刷新共享记录。
- 免费环境的数据库、云存储、函数/流量等可能共用资源点；定期在控制台查看用量，并保留 JSON 备份。
- 患者资料属于敏感信息。仓库和 GitHub Pages 是公开的，里面只放环境 ID，不放患者数据、登录密码或密钥。共享账号应使用独立强密码。
- CloudBase 负责访问控制和存储，但这里没有端到端加密；CloudBase 环境管理员仍能管理并访问云端数据。

## 5. 参考

- [CloudBase Web SDK](https://cloud.tencent.com/document/product/876/46332)
- [CloudBase 身份认证](https://cloud.tencent.com/document/product/876/121347)
- [CloudBase 安全规则](https://cloud.tencent.com/document/product/876/123478)
