/**
 * 齿案台 · 云端数据层（Supabase + Cloudinary）
 *
 * 在 config.js 填好密钥后启用：
 *  - 病例数据读写 Supabase 云数据库（含登录鉴权 + RLS 行级安全）
 *  - 图片上传 Cloudinary 图床，返回远程 URL
 *
 * 未配置时：本文件不参与任何逻辑，工作台走原有 localStorage 模式，
 * 保证线上环境不被破坏、可离线正常使用。
 *
 * 依赖：config.js（window.APP_CONFIG）+ Supabase JS CDN（window.supabase）
 *       + mock.js（Storage，暴露 hydrateFromLocal / 供本文件灌入数据）
 */
(function () {
  const CFG = window.APP_CONFIG || {};

  const isConfigured =
    CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY &&
    CFG.CLOUDINARY_CLOUD_NAME && CFG.CLOUDINARY_UPLOAD_PRESET;

  if (!isConfigured) {
    // 本地模式：无需任何云逻辑
    window.CloudData = {
      active: false,
      isActive: function () { return false; },
      ready: Promise.resolve(),
      login: async function () { throw new Error("本地模式，无登录功能"); },
      logout: function () {},
      replaceAll: function () {},
      saveProfile: function () {}
    };
    return;
  }

  /** 已配置时创建 Supabase 客户端 */
  const supabase = (window.supabase || {}).createClient
    ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY)
    : null;

  if (!supabase) {
    console.error("未加载 Supabase 客户端，退回本地模式。");
    window.CloudData = {
      active: false, isActive: function () { return false; }, ready: Promise.resolve(),
      login: async function () { throw new Error("Supabase 客户端未加载"); },
      logout: function () {}, replaceAll: function () {}, saveProfile: function () {}
    };
    return;
  }

  /** 已在内存中完成的热数据缓存，供 Storage 同步读取 */
  const memory = {};

  /** 关闭任何正在展示的登录浮层 */
  function dismissLogin() {
    const el = document.getElementById("cloudLogin");
    if (el) el.remove();
  }

  /** 拉取当前登录用户的数据（cases + profile）灌入内存 */
  async function warmData() {
    const { data: rows } = await supabase
      .from("cases")
      .select("payload")
      .order("created_at", { ascending: true });

    memory.cases = (rows || [])
      .map((r) => r.payload)
      .filter(Boolean)
      .sort((a, b) => (b.updatedAt || b.visitDate || "") < (a.updatedAt || a.visitDate || "") ? 1 : -1);

    const { data: profRows } = await supabase
      .from("profiles")
      .select("*")
      .limit(1);

    const prof = (profRows || [])[0] || {};
    memory.profile = { surname: prof.surname || "" };
  }

  /** 记录每个病例最近一次的云端写入 promise，供 awaitSaved 等待 */
  const _pending = {};

  /** 异步把内存中的全部病例回写云端（增量 upsert，按 id 主键） */
  function replaceAll(items) {
    (items || []).forEach((c) => {
      if (!c || !c.id) return;
      const p = supabase
        .from("cases")
        .upsert({ id: c.id, payload: c, updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.error("云端保存病例失败：", error); });
      _pending[c.id] = p;
    });
  }

  /** 等待某个病例的云端写入完成（用于保存后跳转详情页前） */
  async function awaitSaved(id) {
    if (_pending[id]) await _pending[id].catch(() => {});
  }

  function persistProfile(p) {
    supabase
      .from("profiles")
      .upsert({ user_id: supabase.auth.user?.().id, surname: p.surname || "" })
      .then(({ error }) => { if (error) console.error("云端保存资料失败：", error); });
  }

  async function login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await confirmSession();
  }

  async function signup(email, password) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    await confirmSession();
  }

  async function logout() {
    await supabase.auth.signOut();
    memory.cases = [];
    memory.profile = {};
    if (window.Storage) {
      window.Storage._cases = [];
      window.Storage._profile = {};
    }
    location.reload();
  }

  /** 登录后：在顶栏注入「退出登录」按钮 */
  function ensureLogoutButton() {
    if (document.getElementById("cloudLogout")) return;
    const bar = document.querySelector(".top-bar__inner");
    if (!bar) return;
    const btn = document.createElement("button");
    btn.id = "cloudLogout";
    btn.textContent = "退出";
    btn.setAttribute("aria-label", "退出登录");
    btn.setAttribute("style",
      "margin-left:8px;padding:8px 14px;border:1px solid #E2E8F0;border-radius:10px;background:#fff;" +
      "color:#475569;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;transition:.15s;");
    btn.addEventListener("click", async () => {
      if (confirm("确定退出登录吗？")) { await logout(); }
    });
    bar.appendChild(btn);
  }

  /** 登录成功后：拉数据灌入 Storage，收起登录浮层，触发应用重渲染 */
  async function confirmSession() {
    await warmData();
    if (window.Storage) {
      window.Storage._cases = memory.cases;
      window.Storage._profile = memory.profile;
      window.Storage.mode = "cloud";
    }
    ensureLogoutButton();
    dismissLogin();
    // 通知 app.js 重新渲染
    document.dispatchEvent(new CustomEvent("cloud:data-ready"));
  }

  function initLoginUI() {
    if (document.getElementById("cloudLogin")) return;
    const overlay = document.createElement("div");
    overlay.id = "cloudLogin";
    overlay.setAttribute("style", `
      position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#E0F2FE,#EDE9FE,#DCFCE7);padding:20px;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
    `);
    overlay.innerHTML = `
      <form id="cloudLoginForm" style="max-width:360px;width:100%;background:#fff;border-radius:18px;padding:32px 28px;box-shadow:0 20px 50px rgba(2,132,199,.18);">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="width:56px;height:56px;margin:0 auto 10px;border-radius:16px;background:linear-gradient(135deg,#E0F2FE,#EDE9FE);display:flex;align-items:center;justify-content:center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 48 48"><defs><linearGradient id="lg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7DD3FC"/><stop offset="1" stop-color="#38BDF8"/></linearGradient></defs><path d="M24 5C16 5 10.5 11 10 18c-.3 4.5 1.5 9 3.5 12.5 1.6 2.7 3.4 3.4 4.8 2.8 1.2-.5 2-2.2 2.9-4.6.6-1.7 1.4-2.7 2.8-2.7s2.2 1 2.8 2.7c.9 2.4 1.7 4.1 2.9 4.6 1.4.6 3.2-.1 4.8-2.8 2-3.5 3.8-8 3.5-12.5C37.5 11 32 5 24 5z" fill="url(#lg2)"/><circle cx="19" cy="16" r="2.2" fill="#fff"/><circle cx="29" cy="16" r="2.2" fill="#fff"/><circle cx="19" cy="15.4" r="1" fill="#0EA5E9"/><circle cx="29" cy="15.4" r="1" fill="#0EA5E9"/></svg>
          </div>
          <h2 style="margin:0;font-size:18px;color:#16324A;">登录齿案台</h2>
          <p style="margin:6px 0 0;font-size:13px;color:#64748B;">数据已上云，登录后云端病例会同步到此设备。</p>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:13px;color:#475569;display:block;margin-bottom:6px;">邮箱</label>
          <input type="email" id="lgEmail" required placeholder="you@example.com"
            style="width:100%;padding:11px 12px;border:1.5px solid #E2E8F0;border-radius:10px;font-size:14px;box-sizing:border-box;"/>
        </div>
        <div style="margin-bottom:16px;">
          <label style="font-size:13px;color:#475569;display:block;margin-bottom:6px;">密码</label>
          <input type="password" id="lgPassword" required placeholder="至少 6 位"
            style="width:100%;padding:11px 12px;border:1.5px solid #E2E8F0;border-radius:10px;font-size:14px;box-sizing:border-box;"/>
        </div>
        <p id="lgError" style="color:#DC2626;font-size:13px;margin:0 0 10px;min-height:18px;"></p>
        <button type="submit" id="lgBtn" style="width:100%;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#0EA5E9,#8B5CF6);color:#fff;font-size:15px;font-weight:600;cursor:pointer;">登 录</button>
        <p style="text-align:center;margin:14px 0 0;font-size:13px;color:#64748B;">
          还没有账号？<a href="#" id="lgToggle" style="color:#0284C7;font-weight:600;text-decoration:none;">注册</a>
        </p>
      </form>`;

    document.body.appendChild(overlay);

    let isSignup = false;
    const linkEl = overlay.querySelector("#lgToggle");
    const btnEl = overlay.querySelector("#lgBtn");
    const errEl = overlay.querySelector("#lgError");

    linkEl.addEventListener("click", (e) => {
      e.preventDefault();
      isSignup = !isSignup;
      linkEl.textContent = isSignup ? "登录" : "注册";
      btnEl.textContent = isSignup ? "注 册" : "登 录";
    });

    overlay.querySelector("#cloudLoginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = overlay.querySelector("#lgEmail").value.trim();
      const password = overlay.querySelector("#lgPassword").value;
      errEl.textContent = "";
      btnEl.disabled = true;
      btnEl.textContent = isSignup ? "注册中…" : "登录中…";
      try {
        if (isSignup) {
          await signup(email, password);
          errEl.textContent = "注册成功！请用新账号登录一次以同步。" ;
          isSignup = false;
        } else {
          await login(email, password);
        }
      } catch (ex) {
        errEl.textContent = (ex && ex.message) || "登录失败，请重试";
      } finally {
        btnEl.disabled = false;
        btnEl.textContent = isSignup ? "注 册" : "登 录";
      }
    });
  }

  /** 顶层 init：恢复会话；未登录则弹出登录浮层 */
  async function init() {
    const saved = await supabase.auth.getSession();
    const user = saved?.data?.session?.user || (supabase.auth.user ? supabase.auth.user() : null);

    document.addEventListener("cloud:data-ready", () => location.reload());

    if (!user) {
      // 未登录：展示登录浮层；数据仍走内存空缓存
      window.Storage._cases = [];
      window.Storage.mode = "cloud";
      initLoginUI();
      return;
    }

    try {
      await warmData();
      window.Storage._cases = memory.cases;
      window.Storage._profile = memory.profile;
      window.Storage.mode = "cloud";
      ensureLogoutButton();
    } catch (e) {
      console.error("云端数据加载失败", e);
      window.Storage._cases = [];
      window.Storage.mode = "cloud";
    }
  }

  function dataURLtoBlob(dataUrl) {
    const parts = dataUrl.split(",");
    const meta = (parts[0].match(/data:(.*?);/) || [])[1] || "image/png";
    const b64 = parts[1] || "";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: meta });
  }

  /** 把一张 base64 图片上传到 Cloudinary，返回远程 URL（受上传预设限额约束） */
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
      throw new Error("图片上传失败（" + res.status + (t ? " " + t.slice(0, 80) : "") + "）");
    }
    const json = await res.json();
    return json.secure_url || json.url;
  }

  window.CloudData = {
    active: true,
    isActive: function () { return true; },
    ready: init(),
    login, signup, logout, warmData,
    replaceAll, awaitSaved,
    saveProfile: persistProfile,
    uploadImage
  };
})();