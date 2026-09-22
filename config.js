/**
 * 齿案台 · 云端配置（Cloudinary 图床 + 端到端加密数据）
 *
 * 填好下面两项后，工作台自动切换为「云端模式」：
 *  - 图片上传到 Cloudinary 图床（大图不受限，国内可访问）
 *  - 病例数据端到端加密后存入免费云存储（jsonstorage.net）
 *    「密码」即加密钥匙，不设账号、不存服务器，云服务商也看不到内容
 *
 * 在填好之前，工作台保持「本地模式」照常可用（数据存在浏览器本地）。
 *
 * 使用流程（详见 SETUP_CLOUD.md）：
 *  1. 首次打开 → 设置密码 → 系统生成「同步码」请保存好
 *  2. 之后打开 → 输入密码即解锁本设备数据
 *  3. 换设备 → 输入密码 + 粘贴同步码即可恢复
 *
 * ⚠️ 密码忘记无法找回（数据是加密的）；同步码换设备时才用。
 */
window.APP_CONFIG = {
  // ===== Cloudinary（图片 + 加密数据存储）=====
  // 「数据」和「图片」都存 Cloudinary：
  //  - 图片上传为 image 资源（大图不受限）
  //  - 病例数据加密后存入一个固定 raw 文件 dental_vault.json（密码即钥匙）
  // Cloudinary 控制台 → Dashboard 看 Cloud name；Settings → Upload →
  // Upload presets 看预设名。预设必须设为「Unsigned 免签名」模式。
  CLOUDINARY_CLOUD_NAME: "trolahpr", // 例如 "dx7kq2abc"
  CLOUDINARY_UPLOAD_PRESET: "Kyring" // 例如 "my_unsigned_preset"（必须 Unsigned）
};
