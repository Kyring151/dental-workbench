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
  SUPABASE_URL: "https://wpgxllhbftpjijmesswf.supabase.co", // 例如 "https://xxxx.supabase.co"
  // 新版密钥体系用「Publishable key」（sb_publishable_...）：
  // 控制台 → Settings → API Keys → 第一个标签页最上面那行，点复制。
  // （旧概念叫 anon key；在旧页面 "Legacy anon, service_role" 标签里也能找到。）
  SUPABASE_ANON_KEY: "sb_publishable_9LkRLSZz856voeapznYCqw_2Rd7h7dj", // 例如 "sb_publishable_..."

  // ===== Cloudinary（图片存储）=====
  CLOUDINARY_CLOUD_NAME: "trolahpr", // 例如 "dx7kq2abc"
  CLOUDINARY_UPLOAD_PRESET: "Kyring" // 例如 "my_unsigned_preset"（必须是 Unsigned 免签名预设）

  // ===== 判定 =====
  // 三者都填了才视为云端模式；否则走本地模式。
};