# 齿案台 · 云端配置指南（LeanCloud 国内版）

把工作台的「本地模式」升级为「云端模式」：病例数据和图片存到 LeanCloud
云服务，实现 **手机 / 电脑同步、大图上传不受限**。

> 之前尝试的 Supabase 因国内网络无法访问（`ERR_CONNECTION_CLOSED`）已弃用；
> 本指南改用 **LeanCloud 国内版**，国内访问快、免费开发版个人用足够。

---

## 一、注册 LeanCloud 并创建应用（约 10 分钟）

1. 打开 **https://www.leancloud.cn** → 右上角 **注册**（手机号注册）
   - 注册后需完成 **实名认证**（个人实名，按页面提示提交即可，通常几分钟通过）
2. 登录后进入控制台 → **创建应用**
   - 名称随意（如 `dental-workbench`）
   - **服务节点** 选默认的 **华东**（国内节点，速度快）
   - 定价选 **开发版**（免费）
3. 创建完成后，点进该应用

## 二、复制 App ID 和 App Key

1. 左侧栏点 **设置 → 应用凭证**
2. 复制 **App ID** 和 **App Key**（⚠️ 只要这两个，**千万不要**用 Master Key）
3. 顺便看一眼 **API 服务器绑定域名**：
   - 如果那里有专属域名（形如 `https://xxxx.api.lc-cn-n1-shared.com`），
     把它复制下来备用
   - 如果没有 / 是空的，就跳过

## 三、填写 config.js 并推送

打开 `config.js`，填入：

```js
LEANCLOUD_APP_ID: "你在控制台复制的 App ID",
LEANCLOUD_APP_KEY: "你在控制台复制的 App Key",
LEANCLOUD_SERVER_URLS: "如果有专属域名就填，没有留空"
```

然后提交推送（在 `dental-workbench` 目录运行）：

```
git add -A
git commit -m "启用 LeanCloud 云端模式"
git push
```

等 GitHub Pages 重新部署（约 1-2 分钟），刷新站点：
- 页面会弹出 **登录框** → 点「注册」用邮箱建号，注册成功即自动登录
- 首页显示空状态 → 新建一个病例、传几张图试试

## 四、可选设置（建议做）

1. **确认可自动建表**：LeanCloud 无需手动建表，代码首次写入会自动创建
   `Case` / `Profile` 两个数据类。若写入报「类不存在」错误，去控制台
   **设置 → 安全设置**，确认勾选「允许客户端创建 Class」。
2. **数据安全说明**：每个病例创建时都会打上 ACL（只有你的账号能读写），
   别人即使拿到 App Key 也读不到你的数据。

## 五、常见问题

| 现象 | 处理 |
| --- | --- |
| 注册提示「该邮箱已注册」 | 直接切换到登录页登录 |
| 提示「邮箱或密码不正确」 | 检查邮箱密码；LeanCloud 用户名即邮箱 |
| 图片上传失败 | 免费版单文件上限 10MB，超过请压缩图片；重试 |
| 页面一直显示登录框且登录转圈 | 检查 `config.js` 的 App ID / App Key 是否填对、是否已推送 |
| 想回到本地模式 | 把 `config.js` 里 App ID / App Key 清空再推送 |

## 六、以后如何更新

改完代码后，在 `dental-workbench` 目录：

```
git add -A
git commit -m "本次改动说明"
git push
```

Pages 自动重新部署，约 1-2 分钟后线上生效。
