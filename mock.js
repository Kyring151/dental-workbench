/**
 * 齿案台 · 数据层（内存缓存 + 本地/云端双持久化）
 *
 * 工作台所有代码都从这里读写数据，内部会按配置自动选择存储：
 *  - 未配置云端（默认）→ 写入浏览器 localStorage（离线可用）
 *  - 配置云端后        → 写入 Supabase 云数据库（手机/电脑同步）
 *
 * 对外接口保持同步调用；云模式时数据先由 cloud.js 灌入内存缓存，
 * 写入在内存中即时生效，同时后台逐步同步到云端。
 */
const Storage = {
  mode: "local",

  /* ---- 内存缓存（唯一真相来源） ---- */
  _cases: [],
  _profile: {},

  /* ---- 持久化分发 ---- */
  _persist() {
    // 单机模式：数据一律写本机 localStorage；图片只存 URL（大图在 Cloudinary）
    try {
      localStorage.setItem(Storage.KEY_CASES, JSON.stringify(this._cases));
      localStorage.setItem(Storage.KEY_PROFILE, JSON.stringify(this._profile));
    } catch (e) {
      alert("本地存储空间不足，请删除部分大图后重试。");
    }
  },

  /* ---- 病例 CRUD ---- */
  hydrateFromLocal() {
    try {
      this._cases = JSON.parse(localStorage.getItem(Storage.KEY_CASES)) || [];
    } catch {
      this._cases = [];
    }
    try {
      this._profile = JSON.parse(localStorage.getItem(Storage.KEY_PROFILE)) || {};
    } catch {
      this._profile = {};
    }
  },

  getCases() {
    return this._cases;
  },

  setCases(list) {
    this._cases = list;
    this._persist();
  },

  getCase(id) {
    return this._cases.find((c) => c.id === id);
  },

  addCase(c) {
    this._cases.push(c);
    this._persist();
  },

  updateCaseStatus(id, status) {
    const c = this._cases.find((x) => x.id === id);
    if (c) {
      c.status = status;
      if (status === "已完成" && !c.completionDate) {
        c.completionDate = new Date().toISOString().slice(0, 10);
      } else if (status === "进行中") {
        c.completionDate = null;
      }
      this._persist();
    }
    return this._cases.find((x) => x.id === id);
  },

  addTimelineEntry(id, entry) {
    const c = this._cases.find((x) => x.id === id);
    if (c) {
      c.timeline = c.timeline || [];
      c.timeline.push(entry);
      this._persist();
    }
    return this._cases.find((x) => x.id === id);
  },

  /* ---- 用户个人资料 ---- */
  getProfile() {
    return this._profile;
  },

  setProfile(p) {
    this._profile = p;
    this._persist();
  },

  KEY_CASES: "dentalWorkbench.cases",
  KEY_PROFILE: "dentalWorkbench.profile"
};

/* ---- 通用工具 ---- */
function getInitials(name) {
  return name ? name.charAt(0) : "?";
}

function genCaseId() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `CASE-${y}${m}${day}-${String(Math.floor(Math.random() * 900) + 100)}`;
}

function getTagClass(tag) {
  const map = {
    "根管治疗": "tag--primary",
    "种植": "tag--purple",
    "牙周": "tag--teal",
    "拔牙": "tag--rose",
    "美学修复": "tag--purple",
    "美白": "tag--amber",
    "修复": "tag--primary",
    "龋病充填": "tag--amber",
    "乳牙": "tag--teal",
    "儿童口腔": "tag--teal"
  };
  return map[tag] || "tag--gray";
}