# 齿案台 · 云端部署指南（Supabase + Cloudinary）

把这份做了，工作台就从「本地版」升级为「云版」：数据存在云端数据库，
图片上传到专业图床，**手机和电脑打开是同一份数据，可传大图**。

全程不需要写代码，都是网页上点点。大约 15~20 分钟。

---

## 一共要拿 4 样东西（都填进 `config.js`）

| 配置项 | 从哪拿 | 长什么样 |
|---|---|---|
| `SUPABASE_URL` | Supabase | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase | `eyJhbGciOi...`（一大串） |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary | `dx7kq2abc` |
| `CLOUDINARY_UPLOAD_PRESET` | Cloudinary | 你自定义的名字，如 `dental` |

---

## 第一部分：Supabase（数据库 + 登录）

1. 打开 **https://supabase.com** → 用 GitHub 账号登录（绿框 Continue with GitHub）。
2. 点 **New project**：
   - Name：填 `dental-workbench`
   - 选一个离你近的区域（如 **Singapore / Asia East**）
   - Database Password：设一个密码（记一下），点 **Create new project**
   - 等 1~2 分钟项目创建完成。
3. 进项目后，左侧 **Project Settings → API / Data API**：
   - 复制 **Project URL** → 填进 `config.js` 的 `SUPABASE_URL`
   - 复制 **anon public** 那个 key → 填进 `SUPABASE_ANON_KEY`
   > 别用 `service_role` key，那是后门，绝对不要暴露在网页里。
4. 左侧 **SQL Editor** → 点 **New query** → 把仓库里
   `supabase/schema.sql` 的全部内容粘贴进去 → 右下 **Run**。
   看到 4 条 success / 已创建 即可。
5. （可选但推荐）左侧 **Authentication → Providers → Email** 打开，
   并把 `Confirm email` 关掉，这样注册后不用点邮件确认就能直接登录。

---

## 第二部分：Cloudinary（图片图床）

1. 打开 **https://cloudinary.com** → 点 **Sign up for free**，用邮箱或 Google 注册。
   免费额度约 25GB 存储 + 每月 25GB 流量，对这个用途绰绰有余。
2. 注册后进入 **Dashboard**，顶部能看到你的 **Cloud name**（形如 `dx7kq2abc`）
   → 填进 `config.js` 的 `CLOUDINARY_CLOUD_NAME`。
3. 左侧 **Settings → Upload → Upload presets**：
   - 点 **Add upload preset** → Signature 选 **Unsigned**（允许网页匿名上传）
   - Name 随意，例如 `dental`
   - 建议把 Storage 下面 **Access mode 设为 Public**
   - 保存后，把 preset 的名字填进 `config.js` 的 `CLOUDINARY_UPLOAD_PRESET`。

---

## 第三部分：填写配置并部署

1. 用记事本/编辑器打开 `config.js`，把上面 4 项填进去并保存。
2. 把整个 `dental-workbench` 目录推送到 GitHub（自动触发 Pages 重新上线）：
   ```
   git add -A
   git commit -m "接入 Supabase 与 Cloudinary 云端存储"
   git push
   ```
3. 等 1~2 分钟，打开你的站点。

首次打开会弹出**登录框**：点「注册」创建你的账号（邮箱 + 密码）。
以后换设备登录同一个账号，就能看到全部云端病例。

---

## 常见问题

- **上传图片提示失败**：多半是 Cloudinary 的 upload preset 还没配好，或名字拼错。
- **登录后看不到之前本地存的病例**：正常。云版和本地版是两套存储，
  你之前在本机试的数据不会自动搬上云（下个版本可加一键迁移）。
- **担心数据安全**：病例表已开启 RLS，只有你登录的账号能读写；
  图片在 Cloudinary 上，URL 是随机的，不公开分享别人很难看到。
- **想回到本地版**：把 `config.js` 里 4 项清空再部署即可。