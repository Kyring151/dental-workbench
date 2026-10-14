/** 齿案台 · CloudBase shared workspace */
(function () {
  const CFG = window.APP_CONFIG || {};
  const env = CFG.CLOUDBASE_ENV_ID;
  let app;
  let auth;
  let db;
  let currentUser;
  let saveTimer;
  let saveQueue = Promise.resolve();
  let pendingSave = null;
  let readyResolve;
  let readyReject;
  let readyStarted = false;

  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  function showGate(message) {
    let root = document.getElementById("cloud-login-gate");
    if (!root) {
      root = document.createElement("div");
      root.id = "cloud-login-gate";
      root.innerHTML = `
        <section class="cloud-gate-panel" aria-labelledby="cloud-gate-title">
          <div class="cloud-gate-mark" aria-hidden="true">齿</div>
          <h1 id="cloud-gate-title">齿案台共享区</h1>
          <p>登录共享账号以访问病例与影像</p>
          <form id="cloud-login-form">
            <label for="cloud-username">用户名或邮箱</label>
            <input id="cloud-username" autocomplete="username" required />
            <label for="cloud-password">密码</label>
            <input id="cloud-password" type="password" autocomplete="current-password" required />
            <p class="cloud-gate-error" id="cloud-gate-error" role="alert"></p>
            <button class="btn btn--primary" type="submit">登录并同步</button>
          </form>
        </section>`;
      document.body.appendChild(root);
      root.querySelector("form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = root.querySelector("button");
        const errorEl = root.querySelector("#cloud-gate-error");
        button.disabled = true;
        errorEl.textContent = "正在登录…";
        try {
          const identity = root.querySelector("#cloud-username").value.trim();
          const { data, error } = await auth.signInWithPassword({
            ...(identity.includes("@") ? { email: identity } : { username: identity }),
            password: root.querySelector("#cloud-password").value
          });
          if (error) throw error;
          currentUser = data.user;
          await initializeWorkspace();
          root.remove();
          readyResolve();
        } catch (error) {
          errorEl.textContent = error.message || "登录失败，请检查账号、密码及 CloudBase 配置。";
          button.disabled = false;
        }
      });
    }
    root.querySelector("#cloud-gate-error").textContent = message || "";
    root.querySelector("form").style.display = auth ? "grid" : "none";
  }

  function showStatus(message, state) {
    let el = document.getElementById("cloud-sync-status");
    if (!el) {
      el = document.createElement("button");
      el.id = "cloud-sync-status";
      el.type = "button";
      el.title = "点击刷新并重新读取共享病例";
      el.addEventListener("click", async () => {
        if (window.CloudData) await window.CloudData.awaitSaved();
        location.reload();
      });
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.dataset.state = state || "ok";
  }

  function cleanCases(cases) {
    return JSON.parse(JSON.stringify(cases || [])).map((item) => {
      (item.images ? Object.values(item.images) : []).forEach((group) => {
        (group || []).forEach((image) => {
          if (image.cloudFileId) delete image.url;
        });
      });
      return item;
    });
  }

  async function resolveImageUrls(cases) {
    const fileIds = [];
    cases.forEach((item) => Object.values(item.images || {}).forEach((group) =>
      (group || []).forEach((image) => { if (image.cloudFileId) fileIds.push(image.cloudFileId); })
    ));
    if (!fileIds.length) return cases;
    const result = await app.getTempFileURL({ fileList: Array.from(new Set(fileIds)) });
    const urls = new Map((result.fileList || []).map((item) => [item.fileID, item.tempFileURL]));
    cases.forEach((item) => Object.values(item.images || {}).forEach((group) =>
      (group || []).forEach((image) => { if (image.cloudFileId) image.url = urls.get(image.cloudFileId) || ""; })
    ));
    return cases;
  }

  async function uploadBlob(blob, fileName, cloudPath) {
    const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
    const uploaded = await app.uploadFile({ cloudPath, filePath: file });
    const link = await app.getTempFileURL({ fileList: [uploaded.fileID] });
    return { cloudFileId: uploaded.fileID, url: link.fileList[0].tempFileURL };
  }

  async function uploadDataUrl(dataUrl, cloudPath) {
    const [meta, encoded] = String(dataUrl).split(",");
    const mime = (meta.match(/data:(.*?);/) || [])[1] || "application/octet-stream";
    const raw = atob(encoded);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return uploadBlob(new Blob([bytes], { type: mime }), cloudPath.split("/").pop(), cloudPath);
  }

  async function uploadLocalImages(cases) {
    let count = 0;
    let publicLinks = 0;
    for (const item of cases) {
      for (const group of Object.values(item.images || {})) {
        for (const image of group || []) {
          if (!image.cloudFileId && image.url && (image.url.startsWith("data:") || /^https?:\/\//i.test(image.url))) {
            const cloudPath = `cases/${item.id}/${Date.now()}-${count}.image`;
            try {
              const uploaded = image.url.startsWith("data:")
                ? await uploadDataUrl(image.url, cloudPath)
                : await fetch(image.url).then((response) => {
                  if (!response.ok) throw new Error("旧图床不可访问");
                  return response.blob();
                }).then((blob) => uploadBlob(blob, cloudPath.split("/").pop(), cloudPath));
              image.cloudFileId = uploaded.cloudFileId;
              image.url = uploaded.url;
              count++;
            } catch (error) {
              if (!image.url.startsWith("data:")) publicLinks++;
              else throw error;
            }
          }
        }
      }
    }
    return { uploaded: count, publicLinks };
  }

  function mergeCases(cloudCases, localCases) {
    const merged = new Map((cloudCases || []).map((item) => [item.id, item]));
    (localCases || []).forEach((local) => {
      if (!local || !local.id) return;
      const cloud = merged.get(local.id);
      if (!cloud) merged.set(local.id, local);
      else if (Date.parse(local.updatedAt || 0) > Date.parse(cloud.updatedAt || 0)) merged.set(local.id, local);
    });
    return Array.from(merged.values()).sort((a, b) => (b.visitDate || "").localeCompare(a.visitDate || ""));
  }

  async function readWorkspace() {
    try {
      const result = await db.collection("dwb_shared").doc("workspace").get();
      const value = result && result.data;
      return Array.isArray(value) ? value[0] || null : value || null;
    } catch (error) {
      if (/not.?found|does not exist|not exist|DOCUMENT_NOT_EXIST|COLLECTION_NOT_EXIST/i.test(
        `${error.code || ""} ${error.message || ""}`
      )) return null;
      throw error;
    }
  }

  async function writeWorkspace(cases, profile, deletedIds) {
    return db.collection("dwb_shared").doc("workspace").set({ data: {
      cases: cleanCases(cases),
      profile: profile || {},
      deletedIds: deletedIds || [],
      updatedAt: new Date().toISOString()
    } });
  }

  async function initializeWorkspace() {
    const localCases = Storage.getCases().map((item) => JSON.parse(JSON.stringify(item)));
    const localProfile = JSON.parse(JSON.stringify(Storage.getProfile() || {}));
    const cloud = await readWorkspace();
    const cloudCases = cloud && Array.isArray(cloud.cases) ? cloud.cases : [];
    const deletedIds = Array.from(new Set([...(cloud && cloud.deletedIds || []), ...Storage._deletedIds]));
    let merged;

    if (localCases.length) {
      try {
        localStorage.setItem("dentalWorkbench.preCloudBackup", JSON.stringify({
          backedUpAt: new Date().toISOString(), cases: localCases, profile: localProfile
        }));
      } catch (_) {}
      merged = mergeCases(cloudCases, localCases).filter((item) => !deletedIds.includes(item.id));
      const migration = await uploadLocalImages(merged);
      const profile = { ...(cloud && cloud.profile || {}), ...localProfile };
      await writeWorkspace(merged, profile, deletedIds);
      const migrationMessage = migration.publicLinks
        ? `${migration.uploaded} 张图片已转入私有云存储，${migration.publicLinks} 张旧外链图未能迁移`
        : `${migration.uploaded} 张图片已转入私有云存储`;
      const caseMessage = cloudCases.length
        ? `已合并 ${localCases.length} 份本机病例`
        : `已迁移 ${localCases.length} 份本机病例`;
      showStatus(`${caseMessage} · ${migrationMessage} · 本机备份已保留`, migration.publicLinks ? "error" : "ok");
      Storage.hydrateFromCloud(await resolveImageUrls(merged), profile, deletedIds);
      return;
    }

    if (!cloud) {
      await writeWorkspace([], localProfile, Storage._deletedIds);
      Storage.hydrateFromCloud([], localProfile, Storage._deletedIds);
      showStatus("共享云端已就绪", "ok");
      return;
    }

    merged = await resolveImageUrls(cloudCases);
    Storage.hydrateFromCloud(merged.filter((item) => !deletedIds.includes(item.id)), cloud.profile || {}, deletedIds);
    showStatus("共享云端已同步", "ok");
  }

  function start() {
    if (readyStarted) return;
    readyStarted = true;
    if (!env) {
      showGate("CloudBase 环境尚未配置，请检查 config.js。");
      readyReject(new Error("CloudBase 环境尚未配置"));
      return;
    }
    if (!window.cloudbase || typeof window.cloudbase.init !== "function") {
      showGate("CloudBase SDK 加载失败，请检查网络后刷新页面。");
      readyReject(new Error("CloudBase SDK 未加载"));
      return;
    }
    app = window.cloudbase.init({ env, region: CFG.CLOUDBASE_REGION || "ap-shanghai" });
    auth = app.auth;
    db = app.database();
    auth.getSession().then(async ({ data, error }) => {
      if (error) throw error;
      if (data.session) {
        currentUser = data.session.user;
        await initializeWorkspace();
        readyResolve();
      } else {
        showGate("");
      }
    }).catch((error) => showGate(error.message || "连接云端失败，请检查网络和安全域名设置。"));
  }

  function flushSave() {
    clearTimeout(saveTimer);
    if (!pendingSave || !currentUser) return saveQueue;
    const snapshot = pendingSave;
    pendingSave = null;
    saveQueue = saveQueue.catch(() => {}).then(async () => {
      const cloud = await readWorkspace();
      const deletedIds = Array.from(new Set([...(cloud && cloud.deletedIds || []), ...snapshot.deletedIds]));
      const merged = mergeCases(cloud && cloud.cases || [], snapshot.cases)
        .filter((item) => !deletedIds.includes(item.id));
      const migration = await uploadLocalImages(merged);
      await writeWorkspace(merged, snapshot.profile, deletedIds);
      Storage.hydrateFromCloud(await resolveImageUrls(merged), snapshot.profile, deletedIds);
      showStatus(migration.publicLinks
        ? `已同步；${migration.publicLinks} 张旧外链图仍未转入私有存储`
        : "云端已同步", migration.publicLinks ? "error" : "ok");
    }).catch((error) => {
      showStatus("同步失败 · 本机副本已保留", "error");
      console.error("CloudBase sync failed", error);
    });
    return saveQueue;
  }

  function queueSave(cases, profile, deletedIds) {
    if (!currentUser) return;
    pendingSave = {
      cases: cleanCases(cases),
      profile: JSON.parse(JSON.stringify(profile || {})),
      deletedIds: Array.isArray(deletedIds) ? deletedIds.slice() : []
    };
    clearTimeout(saveTimer);
    showStatus("正在同步…", "pending");
    saveTimer = setTimeout(flushSave, 700);
  }

  window.CloudData = {
    active: true,
    isActive: () => true,
    hasImageCloud: () => true,
    ready,
    start,
    login: async (username, password) => auth.signInWithPassword({ username, password }),
    logout: async () => auth.signOut(),
    replaceAll: (cases, profile) => queueSave(cases, profile),
    saveProfile: (profile) => queueSave(Storage.getCases(), profile),
    queueSave,
    awaitSaved: async () => { await flushSave(); await saveQueue; return true; },
    uploadImage: async (dataUrl) => uploadDataUrl(dataUrl, `cases/uploads/${crypto.randomUUID()}.image`)
  };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
})();
