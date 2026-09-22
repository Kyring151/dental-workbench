/**
 * 齿案台 · 云端配置（LeanCloud 国内版）
 *
 * 把下面两个密钥填好后，工作台会自动切换为「云端模式」：
 *  - 病例数据 + 登录账号 存入 LeanCloud 云数据库（手机/电脑同步）
 *  - 图片上传到 LeanCloud 文件存储（国内 CDN，不再受 5MB 限制）
 *
 * 在填好之前，工作台保持「本地模式」照常可用（数据存在浏览器本地）。
 *
 * 密钥获取方式见 SETUP_CLOUD.md。注意：App Key 是「公开令牌」，任何人
 * 都能在网页源码里看到，所以我们用 LeanCloud 的登录账号 + 数据 ACL
 * （每个病例只允许创建它的账号读写）来保护数据。
 */
window.APP_CONFIG = {
  // ===== LeanCloud（数据库 + 用户系统 + 图片存储）=====
  // 控制台 → 设置 → 应用凭证：复制「App ID」和「App Key」（不是 Master Key！）
  LEANCLOUD_APP_ID: "", // 例如 "abcd1234wxyz5678abcd1234"
  LEANCLOUD_APP_KEY: "", // 例如 "abcd1234wxyz5678abcd1234"

  // 可选。留空则自动使用公共入口 https://api.leancloud.cn
  // 若控制台「设置 → 应用凭证」里有专属 API 绑定域名（形如
  // https://xxxx.api.lc-cn-n1-shared.com），建议填到这里，更稳定。
  LEANCLOUD_SERVER_URLS: ""

  // ===== 判定 =====
  // App ID 与 App Key 都填了才视为云端模式；否则走本地模式。
};
