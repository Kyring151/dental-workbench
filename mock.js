/**
 * 齿案台 · 本地数据层（localStorage）
 * 纯静态站点（GitHub Pages）无法用后端数据库，这里用浏览器 localStorage
 * 实现「病例列表 / 用户个人资料」的本地持久化。
 * 后续接入真实后端时，把本文件的函数体替换为 fetch 调用即可，调用方不变。
 */

const Storage = {
  KEY_CASES: "dentalWorkbench.cases",
  KEY_PROFILE: "dentalWorkbench.profile",

  /* ---- 病例 CRUD ---- */
  getCases() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY_CASES)) || [];
    } catch {
      return [];
    }
  },

  setCases(list) {
    try {
      localStorage.setItem(this.KEY_CASES, JSON.stringify(list));
    } catch (e) {
      alert("本地存储空间不足，可能是上传的图片过大过多。请退回上一步删除部分大图后再保存。");
    }
  },

  getCase(id) {
    return this.getCases().find((c) => c.id === id);
  },

  addCase(c) {
    const list = this.getCases();
    list.push(c);
    this.setCases(list);
  },

  updateCaseStatus(id, status) {
    const list = this.getCases();
    const c = list.find((x) => x.id === id);
    if (c) {
      c.status = status;
      if (status === "已完成" && !c.completionDate) {
        c.completionDate = new Date().toISOString().slice(0, 10);
      } else if (status === "进行中") {
        c.completionDate = null;
      }
      this.setCases(list);
    }
    return list.find((x) => x.id === id);
  },

  addTimelineEntry(id, entry) {
    const list = this.getCases();
    const c = list.find((x) => x.id === id);
    if (c) {
      c.timeline = c.timeline || [];
      c.timeline.push(entry);
      this.setCases(list);
    }
    return list.find((x) => x.id === id);
  },

  /* ---- 用户个人资料 ---- */
  getProfile() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY_PROFILE)) || {};
    } catch {
      return {};
    }
  },

  setProfile(p) {
    localStorage.setItem(this.KEY_PROFILE, JSON.stringify(p));
  }
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