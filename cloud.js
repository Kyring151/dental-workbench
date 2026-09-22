/**
 * 齿案台 · 云图层（单机模式）
 *
 * 设计收敛：病例「数据」一律保存在本机（localStorage，离线可用、不依赖外部存储）；
 * 「图片」按配置上传到 Cloudinary 图床（大图不受限、国内可访问），图片 URL 存回本地。
 *
 * 这样规避了免费版「跨设备自动同步」所需的固定文件覆盖（Cloudinary 免签名预设禁覆盖），
 * 换来最稳的本地单机体验。跨设备如需转移，可用浏览器导出/导入数据文件。
 *
 * 对外接口：active / isActive() / hasImageCloud() / ready / login / logout /
 *          replaceAll / saveProfile / awaitSaved / uploadImage
 */
(function () {
  const CFG = window.APP_CONFIG || {};

  // 是否配置了 Cloudinary 图床（决定图片走云还是存本地小图）
  const imageEnabled = !!(CFG.CLOUDINARY_CLOUD_NAME && CFG.CLOUDINARY_UPLOAD_PRESET);

  function dataURLtoBlob(dataUrl) {
    const [meta, b64] = String(dataUrl).split(",");
    const mime = (meta.match(/data:(.*?);/) || [])[1] || "application/octet-stream";
    try {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } catch (e) {
      throw new Error("图片读取失败，请重新选择");
    }
  }

  /** 上传单张图片到 Cloudinary，返回 https 直链 */
  async function uploadDataUrl(dataUrl) {
    if (!imageEnabled) throw new Error("未配置 Cloudinary 图床");
    const fd = new FormData();
    fd.append("file", dataURLtoBlob(dataUrl));
    fd.append("upload_preset", CFG.CLOUDINARY_UPLOAD_PRESET);
    let res;
    try {
      res = await fetch(
        `https://api.cloudinary.com/v1_1/${CFG.CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: fd }
      );
    } catch (e) {
      throw new Error("图片上传失败（网络不可达，请稍后重试）");
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      const hint = res.status === 400
        ? "（请确认 Cloudinary 上传预设已设为 Unsigned 免签名模式）"
        : "";
      throw new Error("图片上传失败（" + res.status + "）" + hint + " " + t.slice(0, 60));
    }
    const json = await res.json();
    return (json.secure_url || json.url).replace(/^http:/, "https:");
  }

  window.CloudData = {
    // 数据不云化：始终本地，因此 isActive 恒为 false
    active: false,
    isActive: function () { return false; },
    // 是否有 Cloudinary 图床（app.js 据此决定图片走云还是存本地）
    hasImageCloud: function () { return !!imageEnabled; },
    ready: Promise.resolve(),
    login: async function () { throw new Error("单机模式，无登录功能"); },
    logout: function () {},
    replaceAll: function () {},
    saveProfile: function () {},
    awaitSaved: async function () { return true; },
    uploadImage: imageEnabled
      ? uploadDataUrl
      : async function () { throw new Error("未配置 Cloudinary 图床"); }
  };
})();