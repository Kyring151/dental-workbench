/**
 * 齿案台 · 图床配置（Cloudinary）
 *
 * 单机模式：病例「数据」一律保存在本机浏览器（离线可用）；
 * 「图片」按下面配置上传到 Cloudinary 图床（大图不受限，国内可访问），
 * 图片直链存回本地数据，刷新不丢、换浏览器也以本机为准。
 *
 * 留空则图片也存本地（仅适合小图）。跨设备转移用浏览器导出/导入数据文件。
 * 详见 SETUP_CLOUD.md。
 */
window.APP_CONFIG = {
  // ===== Cloudinary（图片图床）=====
  //  - 图片上传为 image 资源（大图不受限）；数据仍存本机
  // Cloudinary 控制台 → Dashboard 看 Cloud name；Settings → Upload →
  // Upload presets 看预设名。预设必须设为「Unsigned 免签名」模式。
  CLOUDINARY_CLOUD_NAME: "trolahpr", // 例如 "dx7kq2abc"
  CLOUDINARY_UPLOAD_PRESET: "Kyring" // 例如 "my_unsigned_preset"（必须 Unsigned）
};
