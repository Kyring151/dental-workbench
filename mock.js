/**
 * 齿案台 · 内存缓存 + 本机副本/CloudBase 共享区
 */
const Storage = {
  mode: "local",

  /* ---- 内存缓存（唯一真相来源） ---- */
  _cases: [],
  _profile: {},
  _deletedIds: [],

  /* ---- 持久化分发 ---- */
  _persist() {
    // 本机副本用于离线保底；已登录时同步到 CloudBase 共享区。
    try {
      localStorage.setItem(Storage.KEY_CASES, JSON.stringify(this._cases));
      localStorage.setItem(Storage.KEY_PROFILE, JSON.stringify(this._profile));
    } catch (e) {
      alert("本地存储空间不足，请删除部分大图后重试。");
    }
    if (window.CloudData && window.CloudData.active) {
      window.CloudData.queueSave(this._cases, this._profile, this._deletedIds);
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
    try {
      this._deletedIds = JSON.parse(localStorage.getItem(Storage.KEY_DELETED)) || [];
    } catch {
      this._deletedIds = [];
    }
  },

  hydrateFromCloud(cases, profile, deletedIds) {
    this._cases = Array.isArray(cases) ? cases : [];
    this._profile = profile && typeof profile === "object" ? profile : {};
    this._deletedIds = Array.isArray(deletedIds) ? deletedIds : [];
    try {
      localStorage.setItem(Storage.KEY_CASES, JSON.stringify(this._cases));
      localStorage.setItem(Storage.KEY_PROFILE, JSON.stringify(this._profile));
      localStorage.setItem(Storage.KEY_DELETED, JSON.stringify(this._deletedIds));
    } catch (e) {
      console.warn("Cloud data loaded, but the local backup could not be updated", e);
    }
  },

  getCases() {
    return this._cases;
  },

  setCases(list) {
    this._cases = list;
    const restored = new Set((list || []).map((item) => item && item.id).filter(Boolean));
    this._deletedIds = this._deletedIds.filter((id) => !restored.has(id));
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
      c.updatedAt = new Date().toISOString();
      if (status === "已完成" && !c.completionDate) {
        c.completionDate = new Date().toISOString().slice(0, 10);
      } else if (status === "进行中") {
        c.completionDate = null;
      }
      this._persist();
    }
    return this._cases.find((x) => x.id === id);
  },

  /** 更新病例任意字段（编辑初始信息） */
  updateCase(id, patch) {
    const c = this._cases.find((x) => x.id === id);
    if (c) {
      Object.keys(patch).forEach((k) => { c[k] = patch[k]; });
      c.updatedAt = new Date().toISOString();
      this._persist();
    }
    return this._cases.find((x) => x.id === id);
  },

  /** 删除病例 */
  deleteCase(id) {
    const i = this._cases.findIndex((x) => x.id === id);
    let removed = null;
    if (i >= 0) {
      removed = this._cases[i];
      this._cases.splice(i, 1);
      this._deletedIds = Array.from(new Set(this._deletedIds.concat(id)));
      this._persist();
    }
    return removed;
  },

  /** 一键复制病例（保留诊疗/影像，重置为「进行中」并标记副本） */
  duplicateCase(id) {
    const src = this._cases.find((x) => x.id === id);
    if (!src) return null;
    const copy = {
      ...JSON.parse(JSON.stringify(src)),
      id: genCaseId(),
      status: "进行中",
      completionDate: null,
      visitDate: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
      patientName: (src.patientName || "未命名") + "（副本）",
      timeline: (src.timeline || []).map((t) => ({ ...t }))
    };
    this._cases.unshift(copy);
    this._persist();
    return copy;
  },

  /** 汇总所有已使用标签（去重） */
  getAllTags() {
    const set = new Set();
    this._cases.forEach((c) => (c.tags || []).forEach((t) => set.add(t)));
    return Array.from(set);
  },

  addTimelineEntry(id, entry) {
    const c = this._cases.find((x) => x.id === id);
    if (c) {
      c.timeline = c.timeline || [];
      c.timeline.push(entry);
      c.updatedAt = new Date().toISOString();
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
  KEY_PROFILE: "dentalWorkbench.profile",
  KEY_DELETED: "dentalWorkbench.deletedCaseIds"
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
