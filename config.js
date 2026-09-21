/**
 * 齿案台 · 云端配置
 *
 * 把下面三个密钥填好后，工作台会自动切换为「云端模式」：
 *  - 数据存入 Supabase 云数据库（手机/电脑同步）
 *  - 图片上传到 Cloudinary 图床（不再受 5MB 限制）
 *
 * 在填好之前，工作台保持「本地模式」照常可用（数据存在浏览器本地）。
 *
 * 密钥获取方式见 SETUP_CLOUD.md，注意：这些是「公开令牌」，任何人
 * 都能在网页源码里看到，所以我们用 Supabase 的登录 + 行级安全(RLS)
 * 来保护数据，只有你登录的账号能读写自己的病例。
 */
window.APP_CONFIG = {
  // ===== Supabase（数据库）=====
  SUPABASE_URL: "", // 例如 "https://xxxx.supabase.co"
  SUPABASE_ANON_KEY: "", // 例如 "eyJhbGciOi..."

  // ===== Cloudinary（图片存储）=====
  CLOUDINARY_CLOUD_NAME: "", // 例如 "dx7kq2abc"
  CLOUDINARY_UPLOAD_PRESET: "" // 例如 "my_unsigned_preset"

  // ===== 判定 =====
  // 三者都填了才视为云端模式；否则走本地模式。
};