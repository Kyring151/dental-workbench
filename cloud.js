/**
 * 齿案台 · 云端数据层（端到端加密 + Cloudinary 图床）
 *
 * 在 config.js 填好 Cloudinary 后启用：
 *  - 图片上传 Cloudinary（国内可访问，大图不受限）
 *  - 病例数据端到端加密后存 JSONBin（免费、无需绑定账号级密钥进代码）
 *  - 「密码」就是加密钥匙：不设账号、不存服务器，云服务商也看不到内容
 *
 * 安全模型：
 *  - 密码经 PBKDF2(10万次) 派生 AES-256-GCM 密钥
 *  - 明文 JSON 先 gzip 压缩再加密，云端只保存 {salt, iv, data(密文)}
 *  - 解锁后密钥保存在 sessionStorage，关掉标签页即失效，重新输入密码
 *  - JSONBin 的 Master Key（云端钥匙）不写入公开代码，只在首次创建时
 *    由你输入，并保存在本地 vault / 同步码中；bin 内容为密文，
 *    即便 bin 公开也无法被他人解读
 *
 * 换设备 / 清浏览器后，用「同步码」（含 binId + masterKey）绑定恢复。
 *
 * 未配置时：本文件不参与任何逻辑，工作台走原有 localStorage 模式。
 *
 * 依赖：config.js（window.APP_CONFIG）+ mock.js（Storage 数据约定）
 * 对外接口：active / isActive() / ready / login / signup / logout /
 *          warmData / replaceAll / awaitSaved / saveProfile / uploadImage
 */
(function () {
  const CFG = window.APP_CONFIG || {};

  const isConfigured =
    CFG.CLOUDINARY_CLOUD_NAME && CFG.CLOUDINARY_UPLOAD_PRESET;

  /** 未配置时的空实现（本地模式） */
  function fallback() {
    window.CloudData = {
      active: false,
      isActive: function () { return false; },
      ready: Promise.resolve(),
      login: async function () { throw new Error("本地模式，无登录功能"); },
      logout: function () {},
      replaceAll: function () {},
      saveProfile: function () {},
      uploadImage: async function () { throw new Error("本地模式，无图片上传"); }
    };
  }

  if (!isConfigured) {
    fallback();
    return;
  }

  const JSONBIN_BASE = "https://api.jsonbin.io/v3/b";
  const LOCAL_VAULT_KEY = "dentalWorkbench.vault";       // 本机绑定记录
  const SESSION_KEY_KEY = "dentalWorkbench.sk";          // 会话密钥（关标签失效）
  const REMEMBER_KEY_KEY = "dentalWorkbench.rk";         // 持久密钥（勾选"记住本机"后跨会话有效）

  /* ---------------- 加密 / 压缩工具 ---------------- */

  function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function b64ToBuf(b64) {
    const s = atob(b64);
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes.buffer;
  }

  function randomBytes(n) {
    const arr = new Uint8Array(n);
    crypto.getRandomValues(arr);
    return arr;
  }

  /** 密码 → AES-GCM 密钥（PBKDF2，100000 次迭代；可导出以便会话内复用） */
  async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  async function gzip(data) {
    if (!window.CompressionStream) return data;
    const cs = new CompressionStream("gzip");
    const stream = new Blob([data]).stream().pipeThrough(cs);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function gunzip(data) {
    if (!window.DecompressionStream) return data;
    const ds = new DecompressionStream("gzip");
    const stream = new Blob([data]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /** 明文对象 → 云端信封 {salt, iv, data} */
  async function encryptObject(obj, password) {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = await deriveKey(password, salt);
    const jsonBytes = new TextEncoder().encode(JSON.stringify(obj));
    const packed = await gzip(jsonBytes);
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, packed);
    return { salt: bufToB64(salt), iv: bufToB64(iv), data: bufToB64(cipher) };
  }

  /** 云端信封 → 明文对象；密码错误时抛异常 */
  async function decryptObject(envelope, password) {
    const key = await deriveKey(password, b64ToBuf(envelope.salt));
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBuf(envelope.iv) },
      key,
      b64ToBuf(envelope.data)
    );
    const packed = await gunzip(new Uint8Array(plain));
    return JSON.parse(new TextDecoder().decode(packed));
  }

  /* ---------------- JSONBin 读写 ---------------- */

  /** 创建 bin：返回 {binId, masterKey}（vault 记录） */
  async function binCreate(masterKey, envelope) {
    const res = await fetch(JSONBIN_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": masterKey,
        "X-Bin-Private": "false",
        "X-Bin-Name": "dental-workbench"
      },
      body: JSON.stringify(envelope)
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error("云端创建失败（" + res.status + "）" + t.slice(0, 80));
    }
    const json = await res.json();
    const binId = (json.metadata && json.metadata.id) || (json.record && json.record.binId);
    if (!binId) throw new Error("云端返回数据异常，请检查 Master Key 是否正确");
    return { binId, masterKey };
  }

  /** 读取 bin：返回信封对象（公开读取，无需鉴权）；8 秒超时防卡死 */
  async function binRead(vault) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    let res;
    try {
      res = await fetch(`${JSONBIN_BASE}/${vault.binId}`, { signal: ctl.signal });
    } catch (e) {
      clearTimeout(timer);
      throw new Error(e.name === "AbortError" ? "云端读取超时" : "云端读取失败（" + e.message + "）");
    }
    clearTimeout(timer);
    if (!res.ok) throw new Error("云端读取失败（" + res.status + "）");
    const json = await res.json();
    return json.record || json;
  }

  /** 更新 bin：覆盖写入；8 秒超时防卡死 */
  async function binWrite(vault, envelope) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    let res;
    try {
      res = await fetch(`${JSONBIN_BASE}/${vault.binId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": vault.masterKey
        },
        body: JSON.stringify(envelope),
        signal: ctl.signal
      });
    } catch (e) {
      clearTimeout(timer);
      throw new Error(e.name === "AbortError" ? "云端保存超时" : "云端保存失败（" + e.message + "）");
    }
    clearTimeout(timer);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error("云端保存失败（" + res.status + "）" + t.slice(0, 80));
    }
  }

  /* ---------------- 状态 ---------------- */

  // 会话密钥：默认关掉标签页即失效（sessionStorage）；
  // 勾选"记住本机"后持久化到 localStorage，重新打开浏览器也能直接进首页。
  let _rememberChoice = false; // 本次解锁是否记住本机
  function getSessionKey() {
    return localStorage.getItem(REMEMBER_KEY_KEY) || sessionStorage.getItem(SESSION_KEY_KEY) || "";
  }
  function setSessionKey(b64, remember) {
    if (remember) {
      localStorage.setItem(REMEMBER_KEY_KEY, b64);
      sessionStorage.removeItem(SESSION_KEY_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY_KEY, b64);
      localStorage.removeItem(REMEMBER_KEY_KEY);
    }
  }
  function clearSessionKey() {
    sessionStorage.removeItem(SESSION_KEY_KEY);
    localStorage.removeItem(REMEMBER_KEY_KEY);
  }

  function getLocalVault() {
    try { return JSON.parse(localStorage.getItem(LOCAL_VAULT_KEY)) || null; } catch { return null; }
  }
  function setLocalVault(v) { localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify(v)); }

  async function sessionKeyToCryptoKey(b64) {
    return crypto.subtle.importKey("raw", b64ToBuf(b64), "AES-GCM", false, ["encrypt", "decrypt"]);
  }

  /* ---------------- 数据读写 ---------------- */

  const memory = { cases: [], profile: {} };
  let _sessionCryptoKey = null;          // 当前会话已解码的密钥
  let _writeChain = Promise.resolve();   // 串行化写入
  let _writeTimer = null;                // 防抖
  let _lastSnapshot = null;              // 最近一次完整快照字符串（跳过无变化写）

  function buildSnapshot() {
    return {
      cases: (window.Storage && window.Storage._cases) || memory.cases,
      profile: (window.Storage && window.Storage._profile) || memory.profile
    };
  }

  /** 真正执行一次云端写入（加密全库 → PUT） */
  async function doWrite() {
    const snap = buildSnapshot();
    const text = JSON.stringify(snap);
    if (_lastSnapshot === text) return;              // 内容没变，跳过
    const vault = getLocalVault();
    if (!vault || !_sessionCryptoKey) {
      throw new Error("未解锁云端数据，请先在解锁界面输入密码完成解锁后再保存");
    }
    if (!vault.salt) throw new Error("缺少加密盐，请重新解锁");
    const iv = randomBytes(12);
    const jsonBytes = new TextEncoder().encode(text);
    const packed = await gzip(jsonBytes);
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, _sessionCryptoKey, packed);
    const envelope = {
      salt: vault.salt,
      iv: bufToB64(iv),
      data: bufToB64(cipher)
    };
    await binWrite(vault, envelope);
    _lastSnapshot = text;
  }

  /** 防抖 + 串行地调度一次写入 */
  function scheduleWrite() {
    if (_writeTimer) clearTimeout(_writeTimer);
    _writeTimer = setTimeout(() => {
      _writeTimer = null;
      _writeChain = _writeChain.then(doWrite).catch((e) => console.error("云端写入失败：", e));
    }, 400);
  }

  /** 等待保存（离线优先）：数据已由本机快照落盘即成功；云端在后台异步同步，不阻塞界面 */
  async function flushWrite() {
    if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null; }
    _writeChain = _writeChain.then(doWrite).catch((e) => {
      console.warn("云端暂不可用（数据已安全保存到本机，网络恢复后会自动同步）：", e && e.message);
    });
  }

  /** 从云端拉取并解密，灌入 Storage（需已持有密钥）；云端不可达时回退本机快照 */
  async function warmData() {
    const vault = getLocalVault();
    if (!vault) throw new Error("未绑定云端数据");
    let envelope;
    try {
      envelope = await binRead(vault);
    } catch (e) {
      console.warn("云端读取失败，改用本机快照兜底：", e && e.message);
      loadLocalSnapshot();
      return memory;
    }
    if (!envelope || !envelope.data) {
      loadLocalSnapshot();
      return memory;
    }
    const key = getSessionKey()
      ? await sessionKeyToCryptoKey(getSessionKey())
      : _sessionCryptoKey;
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBuf(envelope.iv) },
      key,
      b64ToBuf(envelope.data)
    );
    const packed = await gunzip(new Uint8Array(plain));
    const obj = JSON.parse(new TextDecoder().decode(packed));
    memory.cases = Array.isArray(obj.cases) ? obj.cases : [];
    memory.profile = obj.profile || {};
    return memory;
  }

  /** 用本机最近一份明文快照兜底（网络不可达时数据不丢） */
  function loadLocalSnapshot() {
    try {
      const cases = JSON.parse(localStorage.getItem(Storage.KEY_CASES) || "[]");
      const profile = JSON.parse(localStorage.getItem(Storage.KEY_PROFILE) || "{}");
      memory.cases = Array.isArray(cases) ? cases : [];
      memory.profile = profile || {};
    } catch (e) {
      memory.cases = [];
      memory.profile = {};
    }
    return memory;
  }

  /* ---------------- 对外接口 ---------------- */

  function replaceAll(items) {
    memory.cases = items || [];
    scheduleWrite();
  }

  async function awaitSaved() {
    await flushWrite();
  }

  function saveProfile(p) {
    memory.profile = p || {};
    scheduleWrite();
  }

  /** 用密码解锁（已有本地 vault：只需密码） */
  async function login(password) {
    const vault = getLocalVault();
    if (!vault) throw new Error("本设备未绑定云端数据，请粘贴同步码");
    await unlockWithPassword(vault, password);
  }

  /** 首次创建云端库：密码 + JSONBin Master Key */
  async function signup(password, masterKey) {
    if (getLocalVault()) throw new Error("本设备已绑定云端数据，请直接登录");
    const snap = buildSnapshot();
    const envelope = await encryptObject(snap, password);
    const vault = await binCreate(masterKey, envelope);
    setLocalVault(Object.assign(vault, { salt: envelope.salt }));
    await unlockWithPassword(vault, password);
  }

  /** 新设备绑定：密码 + 同步码 */
  async function bindVault(password, syncCode) {
    let vault;
    try { vault = JSON.parse(syncCode); } catch { throw new Error("同步码格式不正确"); }
    if (!vault || !vault.binId || !vault.masterKey) {
      throw new Error("同步码不完整，请重新复制");
    }
    setLocalVault(vault);
    await unlockWithPassword(vault, password);
  }

  async function unlockWithPassword(vault, password) {
    const envelope = await binRead(vault);
    const key = await deriveKey(password, b64ToBuf(envelope.salt));
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBuf(envelope.iv) },
      key,
      b64ToBuf(envelope.data)
    );
    const packed = await gunzip(new Uint8Array(plain));
    const obj = JSON.parse(new TextDecoder().decode(packed));
    memory.cases = Array.isArray(obj.cases) ? obj.cases : [];
    memory.profile = obj.profile || {};

    // 把云端固化的盐持久化到本地 vault，供后续加密写入使用
    setLocalVault(Object.assign({}, vault, { salt: envelope.salt }));

    _sessionCryptoKey = key;
    setSessionKey(bufToB64(await crypto.subtle.exportKey("raw", key)), _rememberChoice);
    confirmLoaded();
  }

  /** 解密成功：灌入 Storage、切云模式、收起浮层、通知应用重渲染 */
  function confirmLoaded() {
    if (window.Storage) {
      window.Storage._cases = memory.cases;
      window.Storage._profile = memory.profile;
      window.Storage.mode = "cloud";
    }
    dismissLogin();
    document.dispatchEvent(new CustomEvent("cloud:data-ready"));
  }

  /** 锁定（退出）：清除会话密钥，重新要求输入密码 */
  async function logout() {
    clearSessionKey();
    _sessionCryptoKey = null;
    location.reload();
  }

  /** 生成同步码文本（换设备时使用） */
  function getSyncCode() {
    const v = getLocalVault();
    return v ? JSON.stringify({ binId: v.binId, masterKey: v.masterKey }) : "";
  }

  /* ---------------- 图片上传（Cloudinary） ---------------- */

  function dataURLtoBlob(dataUrl) {
    const parts = dataUrl.split(",");
    const meta = (parts[0].match(/data:(.*?);/) || [])[1] || "image/png";
    const b64 = parts[1] || "";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: meta });
  }

  async function uploadImage(dataUrl) {
    const fd = new FormData();
    fd.append("file", dataURLtoBlob(dataUrl));
    fd.append("upload_preset", CFG.CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CFG.CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: fd }
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      const hint = res.status === 400
        ? "（请确认 Cloudinary 上传预设已设为 Unsigned 免签名模式）"
        : "";
      throw new Error("图片上传失败（" + res.status + "）" + hint + " " + t.slice(0, 60));
    }
    const json = await res.json();
    return json.secure_url || json.url;
  }

  /* ---------------- 登录浮层 UI ---------------- */

  function dismissLogin() {
    const el = document.getElementById("cloudLogin");
    if (el) el.remove();
  }

  function ensureLockButton() {
    if (document.getElementById("cloudLogout")) return;
    const bar = document.querySelector(".top-bar__inner");
    if (!bar) return;
    const btn = document.createElement("button");
    btn.id = "cloudLogout";
    btn.textContent = "锁定";
    btn.setAttribute("aria-label", "锁定（重新输入密码）");
    btn.setAttribute("style",
      "margin-left:8px;padding:8px 14px;border:1px solid #E2E8F0;border-radius:10px;background:#fff;" +
      "color:#475569;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;transition:.15s;");
    btn.addEventListener("click", async () => {
      if (confirm("确定锁定吗？下次打开需重新输入密码。")) { await logout(); }
    });
    bar.appendChild(btn);
  }

  function initLoginUI() {
    if (document.getElementById("cloudLogin")) return;
    const overlay = document.createElement("div");
    overlay.id = "cloudLogin";
    overlay.setAttribute("style", `
      position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#E0F2FE,#EDE9FE,#DCFCE7);padding:20px;
      font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
    `);
    overlay.innerHTML = `
      <form id="cloudLoginForm" style="max-width:390px;width:100%;background:#fff;border-radius:18px;padding:32px 28px;box-shadow:0 20px 50px rgba(2,132,199,.18);">
        <div style="text-align:center;margin-bottom:18px;">
          <div style="width:56px;height:56px;margin:0 auto 10px;border-radius:16px;background:linear-gradient(135deg,#E0F2FE,#EDE9FE);display:flex;align-items:center;justify-content:center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 48 48"><defs><linearGradient id="lg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7DD3FC"/><stop offset="1" stop-color="#38BDF8"/></linearGradient></defs><path d="M24 5C16 5 10.5 11 10 18c-.3 4.5 1.5 9 3.5 12.5 1.6 2.7 3.4 3.4 4.8 2.8 1.2-.5 2-2.2 2.9-4.6.6-1.7 1.4-2.7 2.8-2.7s2.2 1 2.8 2.7c.9 2.4 1.7 4.1 2.9 4.6 1.4.6 3.2-.1 4.8-2.8 2-3.5 3.8-8 3.5-12.5C37.5 11 32 5 24 5z" fill="url(#lg2)"/><circle cx="19" cy="16" r="2.2" fill="#fff"/><circle cx="29" cy="16" r="2.2" fill="#fff"/><circle cx="19" cy="15.4" r="1" fill="#0EA5E9"/><circle cx="29" cy="15.4" r="1" fill="#0EA5E9"/></svg>
          </div>
          <h2 style="margin:0;font-size:18px;color:#16324A;">解锁齿案台</h2>
          <p style="margin:6px 0 0;font-size:13px;color:#64748B;line-height:1.6;">数据已端到端加密上云，密码就是钥匙。<br/>输入密码解锁本设备数据。</p>
        </div>
        <div id="lgNewBox" style="display:none;margin-bottom:12px;">
          <label style="font-size:13px;color:#475569;display:block;margin-bottom:6px;">JSONBin Master Key（注册后从控制台复制，只首次创建需要）</label>
          <textarea id="lgMasterKey" rows="2" placeholder="形如 \$2b\$10\$..." 
            style="width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:10px;font-size:13px;box-sizing:border-box;resize:vertical;"></textarea>
        </div>
        <div id="lgSyncBox" style="display:none;margin-bottom:12px;">
          <label style="font-size:13px;color:#475569;display:block;margin-bottom:6px;">同步码（新设备绑定用）</label>
          <textarea id="lgSyncCode" rows="3" placeholder='形如 {"binId":"...","masterKey":"..."}'
            style="width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:10px;font-size:13px;box-sizing:border-box;resize:vertical;"></textarea>
        </div>
        <div style="margin-bottom:16px;">
          <label style="font-size:13px;color:#475569;display:block;margin-bottom:6px;">密码</label>
          <input type="password" id="lgPassword" required placeholder="至少 6 位"
            style="width:100%;padding:11px 12px;border:1.5px solid #E2E8F0;border-radius:10px;font-size:14px;box-sizing:border-box;"/>
        </div>
        <div style="margin-bottom:16px;display:flex;align-items:center;gap:8px;font-size:13px;color:#475569;">
          <input type="checkbox" id="lgRemember" style="width:16px;height:16px;accent-color:#0EA5E9;flex:none;"/>
          <label for="lgRemember" style="cursor:pointer;">记住本机，下次打开直接进入</label>
        </div>
        <p id="lgError" style="color:#DC2626;font-size:13px;margin:0 0 10px;min-height:18px;line-height:1.5;"></p>
        <button type="submit" id="lgBtn" style="width:100%;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#0EA5E9,#8B5CF6);color:#fff;font-size:15px;font-weight:600;cursor:pointer;">解 锁</button>
        <p style="text-align:center;margin:14px 0 0;font-size:13px;color:#64748B;line-height:1.7;">
          <a href="#" id="lgToggle" style="color:#0284C7;font-weight:600;text-decoration:none;">首次使用？设置密码并创建云端数据</a>
        </p>
      </form>`;

    document.body.appendChild(overlay);

    let isNewDevice = false; // true = 需要同步码（新设备）；false = 本机已有绑定或首次创建
    const linkEl = overlay.querySelector("#lgToggle");
    const btnEl = overlay.querySelector("#lgBtn");
    const errEl = overlay.querySelector("#lgError");
    const newBox = overlay.querySelector("#lgNewBox");
    const syncBox = overlay.querySelector("#lgSyncBox");
    const masterKey = overlay.querySelector("#lgMasterKey");
    const syncCode = overlay.querySelector("#lgSyncCode");
    const pwd = overlay.querySelector("#lgPassword");

    const hasLocalVault = !!getLocalVault();

    function updateMode() {
      if (!hasLocalVault) {
        if (!isNewDevice) {
          // 首次设置密码
          btnEl.textContent = "创建并解锁";
          newBox.style.display = "block";
          syncBox.style.display = "none";
          linkEl.style.display = "block";
          linkEl.textContent = "已有云端数据？用同步码绑定这台设备";
        } else {
          btnEl.textContent = "绑定并解锁";
          newBox.style.display = "none";
          syncBox.style.display = "block";
          linkEl.style.display = "block";
          linkEl.textContent = "返回首次设置";
        }
      } else {
        btnEl.textContent = "解 锁";
        newBox.style.display = "none";
        syncBox.style.display = "none";
        linkEl.style.display = "none";
      }
    }
    updateMode();

    linkEl.addEventListener("click", (e) => {
      e.preventDefault();
      isNewDevice = !isNewDevice;
      updateMode();
      errEl.textContent = "";
    });

    overlay.querySelector("#cloudLoginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = pwd.value;
      _rememberChoice = overlay.querySelector("#lgRemember").checked;
      errEl.textContent = "";
      btnEl.disabled = true;
      btnEl.textContent = "处理中…";
      try {
        if (password.length < 6) throw new Error("密码至少 6 位");
        if (hasLocalVault) {
          await login(password);
        } else if (isNewDevice) {
          const code = syncCode.value.trim();
          if (!code) throw new Error("请粘贴同步码，或返回首次设置");
          await bindVault(password, code);
        } else {
          const mk = masterKey.value.trim();
          if (!mk) throw new Error("请粘贴 JSONBin Master Key");
          await signup(password, mk);
          setTimeout(() => {
            alert(
              "云端数据创建成功！\n\n这是你的同步码（含读写权限），请务必复制保存好：\n\n" +
              getSyncCode() + "\n\n换电脑 / 手机或清空浏览器时，用它在新设备上恢复数据。\n" +
              "注意：密码忘记无法找回，请牢记。"
            );
          }, 200);
        }
      } catch (ex) {
        const m = (ex && ex.message) || "解锁失败，请重试";
        if (/GCM|decrypt|Decryption|OperationError/i.test(m)) {
          errEl.textContent = "密码错误，无法解密数据";
        } else {
          errEl.textContent = m;
        }
      } finally {
        btnEl.disabled = false;
        updateMode();
      }
    });
  }

  /* ---------------- 顶层 init ---------------- */

  async function init() {
    document.addEventListener("cloud:data-ready", () => location.reload());

    // 会话中已有密钥（本会话已解锁过）→ 直接拉数据
    if (getSessionKey()) {
      try {
        const vault = getLocalVault();
        if (vault) {
          _sessionCryptoKey = await sessionKeyToCryptoKey(getSessionKey());
          await warmData();
          if (window.Storage) {
            window.Storage._cases = memory.cases;
            window.Storage._profile = memory.profile;
            window.Storage.mode = "cloud";
          }
          ensureLockButton();
          return;
        }
      } catch (e) {
        console.error("会话恢复失败", e);
        clearSessionKey();
      }
    }

    // 未解锁：空缓存 + 弹出解锁浮层
    window.Storage._cases = [];
    window.Storage.mode = "cloud";
    initLoginUI();
  }

  window.CloudData = {
    active: true,
    isActive: function () { return true; },
    ready: init(),
    login, signup, logout, warmData,
    replaceAll, awaitSaved,
    saveProfile,
    uploadImage,
    getSyncCode
  };
})();
