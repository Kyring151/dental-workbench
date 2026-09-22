/**
 * 齿案台 · 交互逻辑
 * - 导航高亮 + 移动端菜单
 * - 个人资料（姓氏/称呼）设置
 * - 首页统计 + 最近病例（空态展示）
 * - 病例列表搜索/筛选/卡片与表格视图
 * - 病例详情（动态读取本地病例）+ 状态可编辑
 * - 新建病例三步向导 + 多图上传
 */

/* ==========================================================
   1. Navigation
   ========================================================== */
function initNavigation() {
  const currentPage = document.body.dataset.page || "dashboard";

  document.querySelectorAll(".top-bar__nav .nav-link, .mobile-nav .nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === currentPage);
  });

  const menuToggle = document.querySelector(".menu-toggle");
  const mobileNav = document.getElementById("mobile-nav");

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = mobileNav.classList.toggle("is-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
    mobileNav.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        mobileNav.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }
}

/* ==========================================================
   2. Personal Profile (姓氏称呼)
   ========================================================== */
function initProfile() {
  const greetingEl = document.getElementById("greeting");
  if (!greetingEl) return;

  function renderGreeting() {
    const profile = Storage.getProfile();
    const surname = profile.surname;
    greetingEl.innerHTML = surname ? `你好，${surname}医生` : "你好，医生";
  }

  renderGreeting();

  const editBtn = document.getElementById("profile-edit");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      const current = Storage.getProfile().surname || "";
      const surname = prompt("请输入你的姓氏（用于首页称呼，例如「张」）：", current);
      if (surname !== null) {
        const cleaned = surname.trim().slice(0, 8);
        if (cleaned) {
          Storage.setProfile({ ...Storage.getProfile(), surname: cleaned });
        } else {
          Storage.setProfile({ ...Storage.getProfile(), surname: "" });
        }
        renderGreeting();
      }
    });
  }
}

/* ==========================================================
   3. Dashboard: Stats & Recent Cases
   ========================================================== */
function renderDashboardStats() {
  const el = {
    total: document.getElementById("stat-total"),
    done: document.getElementById("stat-done"),
    active: document.getElementById("stat-active"),
    images: document.getElementById("stat-images")
  };
  if (!el.total) return;

  const cases = Storage.getCases();
  const done = cases.filter((c) => c.status === "已完成").length;
  const active = cases.filter((c) => c.status === "进行中").length;
  const images = cases.reduce((sum, c) => sum + countImages(c), 0);

  el.total.textContent = cases.length;
  el.done.textContent = done;
  el.active.textContent = active;
  el.images.textContent = images;
}

function countImages(c) {
  let n = 0;
  const g = c.images || {};
  ["pre", "during", "post"].forEach((k) => {
    n += (g[k] || []).length;
  });
  return n;
}

/* 统计看板：治疗类型分布 + 近 6 个月新增 */
function renderDashboardCharts() {
  const typeBox = document.getElementById("chart-types");
  const monthBox = document.getElementById("chart-months");
  if (!typeBox && !monthBox) return;

  const cases = Storage.getCases();

  if (typeBox) {
    const counts = {};
    (cases.length ? cases : []).forEach((c) => {
      const t = c.treatmentType || "未分类";
      counts[t] = (counts[t] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map((e) => e[1]));
    if (!entries.length) {
      typeBox.innerHTML = `<p class="chart-empty">暂无数据</p>`;
    } else {
      typeBox.innerHTML = entries.map(([t, n]) => `
        <div class="chart-row">
          <span class="chart-row__label">${esc(t)}</span>
          <div class="chart-row__track"><div class="chart-row__bar" style="width:${Math.round((n / max) * 100)}%"></div></div>
          <span class="chart-row__num">${n}</span>
        </div>`).join("");
    }
  }

  if (monthBox) {
    const now = new Date();
    const labels = [];
    const points = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      const label = (d.getMonth() + 1) + "月";
      labels.push(label);
      points.push(cases.filter((c) => (c.visitDate || "").slice(0, 7) === key).length);
    }
    const maxM = Math.max(1, ...points);
    monthBox.innerHTML = `
      <div class="bar-chart">
        ${labels.map((lb, i) => `
          <div class="bar-col">
            <div class="bar-col__value">${points[i] || ""}</div>
            <div class="bar-col__track"><div class="bar-col__bar" style="height:${Math.max(4, Math.round((points[i] / maxM) * 100))}%"></div></div>
            <div class="bar-col__label">${lb}</div>
          </div>`).join("")}
      </div>`;
  }
}

function renderRecentCases() {
  const container = document.getElementById("recent-cases");
  if (!container) return;

  const recent = Storage.getCases().slice(0, 4);

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state__icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C7.5 2 5 6.5 5 10c0 3 1 5 2 7s2 3 2 3c.5.5 1.5.5 2 0s1-2 1-2 .5 1.5 1 2 1.5.5 2 0 1-1 2-3 2-4 2-7c0-3.5-2.5-8-7-8z"/></svg>
        </div>
        <h3 class="empty-state__title">还没有病例</h3>
        <p class="empty-state__text">创建你的第一个病例，开始沉淀属于自己的临床作品集。</p>
        <a href="new-case.html" class="btn btn--primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          新建病例
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = recent.map((c) => buildCaseCard(c)).join("");
}

function buildCaseCard(c) {
  const statusClass = c.status === "已完成" ? "case-card__status--done" : "case-card__status--active";
  const tagsHtml = (c.tags || []).slice(0, 2).map((t) => `<span class="tag ${getTagClass(t)}">${t}</span>`).join("");
  const imgCount = countImages(c);

  return `
    <a href="case-detail.html?id=${c.id}" class="card card--interactive case-card">
      <div class="case-card__top">
        <div class="case-card__avatar">${getInitials(c.patientName)}</div>
        <div style="flex: 1; min-width: 0;">
          <h3 class="case-card__title">${c.patientName || "未命名病例"}</h3>
          <div class="case-card__meta">${c.diagnosis || "诊断待填写"} · ${c.visitDate || "--"}</div>
        </div>
        <span class="case-card__status ${statusClass}">${c.status || "进行中"}</span>
      </div>
      <div class="case-card__body">
        <p class="paragraph mb-0">${c.chiefComplaint || "暂无主诉"}</p>
      </div>
      <div class="case-card__footer">
        <div class="tag-list">${tagsHtml}</div>
        <div class="case-card__count">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          ${imgCount}
        </div>
      </div>
    </a>
  `;
}

/* ==========================================================
   4. Cases List Page
   ========================================================== */
let casesViewMode = "grid";
let casesFilter = "全部";
let casesTag = "全部";
let casesSearch = "";

function initCasesPage() {
  const gridView = document.getElementById("cases-grid-view");
  const listView = document.getElementById("cases-list-view");
  const searchInput = document.getElementById("cases-search");
  const filterChips = document.querySelectorAll("[data-filter]");
  const viewButtons = document.querySelectorAll("[data-view]");
  const tagWrap = document.getElementById("cases-tagfilter");

  if (!gridView || !listView) return;

  function renderTagFilter() {
    if (!tagWrap) return;
    const tags = Storage.getAllTags();
    const chips = ["<button class='filter-chip " + (casesTag === "全部" ? "filter-chip--active" : "") + "' data-tagfilter='全部'>全部标签</button>"]
      .concat(tags.map((t) => "<button class='filter-chip " + (casesTag === t ? "filter-chip--active" : "") + "' data-tagfilter='" + esc(t) + "'>" + esc(t) + "</button>"))
      .join("");
    tagWrap.innerHTML = chips;
    tagWrap.querySelectorAll("[data-tagfilter]").forEach((chip) => {
      chip.addEventListener("click", () => {
        casesTag = chip.dataset.tagfilter;
        renderTagFilter();
        renderCases();
      });
    });
  }

  function renderCases() {
    const all = Storage.getCases();
    const filtered = all.filter((c) => {
      const matchesFilter =
        casesFilter === "全部" || c.status === casesFilter || c.treatmentType === casesFilter;
      const matchesTag =
        casesTag === "全部" || (c.tags || []).includes(casesTag);
      const q = casesSearch.toLowerCase();
      const haystack = [
        c.patientName, c.diagnosis, c.chiefComplaint, c.patientRequest,
        c.history, c.pastHistory, c.reason, c.plan, c.exam, c.treatmentType,
        (c.tags || []).join(" ")
      ].join(" ").toLowerCase();
      const matchesSearch = q === "" || haystack.includes(q);
      return matchesFilter && matchesTag && matchesSearch;
    });

    const countEl = document.getElementById("cases-count");
    if (countEl) countEl.textContent = `共 ${filtered.length} 个病例`;

    if (filtered.length === 0) {
      const empty = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <h3 class="empty-state__title">${all.length === 0 ? "还没有病例" : "未找到病例"}</h3>
          <p class="empty-state__text">${all.length === 0 ? "先创建一个病例吧。" : "尝试更换关键词或筛选条件。"}</p>
          ${all.length === 0 ? '<a href="new-case.html" class="btn btn--primary">新建病例</a>' : ""}
        </div>
      `;
      gridView.innerHTML = empty;
      listView.innerHTML = empty;
      applyView();
      return;
    }

    gridView.innerHTML = filtered.map((c) => buildCaseCard(c)).join("");
    listView.innerHTML = buildCaseTable(filtered);
    applyView();
  }

  function applyView() {
    gridView.style.display = casesViewMode === "grid" ? "grid" : "none";
    listView.style.display = casesViewMode === "list" ? "block" : "none";
  }

  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      filterChips.forEach((c) => c.classList.remove("filter-chip--active"));
      chip.classList.add("filter-chip--active");
      casesFilter = chip.dataset.filter;
      renderCases();
    });
  });

  viewButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      viewButtons.forEach((b) => b.classList.remove("view-toggle__btn--active"));
      btn.classList.add("view-toggle__btn--active");
      casesViewMode = btn.dataset.view;
      applyView();
    });
  });

  searchInput.addEventListener("input", (e) => {
    casesSearch = e.target.value.trim();
    renderCases();
  });

  renderTagFilter();
  renderCases();
}

function buildCaseTable(list) {
  return `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>病例编号</th>
            <th>患者</th>
            <th>诊断</th>
            <th>治疗类型</th>
            <th>状态</th>
            <th>日期</th>
            <th>影像</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${list
            .map(
              (c) => `
            <tr>
              <td><span class="text-muted">${c.id}</span></td>
              <td><a href="case-detail.html?id=${c.id}" style="color:var(--color-primary);font-weight:600;">${c.patientName || "未命名"}</a><br><span class="text-muted">${c.age ? c.age + " 岁" : "--"} · ${c.gender || "--"}</span></td>
              <td>${c.diagnosis || "--"}</td>
              <td>${c.treatmentType ? `<span class="tag ${getTagClass(c.treatmentType)}">${c.treatmentType}</span>` : "--"}</td>
              <td><span class="tag ${c.status === "已完成" ? "tag--teal" : "tag--amber"}">${c.status || "进行中"}</span></td>
              <td>${c.visitDate || "--"}</td>
              <td>${countImages(c)}</td>
              <td><a href="case-detail.html?id=${c.id}" class="btn btn--ghost btn--sm">查看</a></td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ---- 数据导入 / 导出（.json 备份，跨设备搬运） ---- */
function initDataTransfer() {
  const exportBtn = document.getElementById("btn-export-data");
  const importInput = document.getElementById("btn-import-data");

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const payload = {
        app: "齿案台",
        version: 1,
        exportedAt: new Date().toISOString(),
        profile: Storage.getProfile(),
        cases: Storage.getCases()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const d = new Date();
      a.download = "齿案台备份-" + d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }

  if (importInput) {
    importInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const incoming = Array.isArray(data.cases) ? data.cases : Array.isArray(data) ? data : null;
          if (!incoming) { alert("文件格式不正确，请选择齿案台导出的 .json 备份。"); return; }
          const doMerge = confirm(
            "检测到 " + incoming.length + " 个病例。\n\n确定 = 合并（保留现有，跳过编号相同的）\n取消 = 整体替换为备份内容"
          );
          if (doMerge) {
            const existingIds = new Set(Storage.getCases().map((c) => c.id));
            const merged = Storage.getCases().concat(incoming.filter((c) => c && !existingIds.has(c.id)));
            Storage.setCases(merged);
          } else {
            Storage.setCases(incoming);
          }
          if (data.profile && typeof data.profile === "object") {
            Storage.setProfile({ ...Storage.getProfile(), ...data.profile });
          }
          alert("导入完成。");
          location.reload();
        } catch (err) {
          alert("导入失败：文件无法解析。");
        }
      };
      reader.readAsText(file);
    });
  }
}

/* ==========================================================
   5. Case Detail (动态读取) + 状态可编辑
   ========================================================== */
let detailCase = null;
let detailPhase = "pre";
let galleryDragFrom = null;
let detailImageId = null;

const TYPE_BG = {
  xray: "var(--color-type-xray)",
  intraoral: "var(--color-type-intraoral)",
  endoscope: "var(--color-type-endoscope)",
  uploaded: "var(--color-type-xray)"
};

const PHASE_LABEL = { pre: "术前", during: "术中", post: "术后" };

function initCaseDetail() {
  const root = document.getElementById("detail-root");
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  if (!id) {
    root.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C7.5 2 5 6.5 5 10c0 3 1 5 2 7s2 3 2 3c.5.5 1.5.5 2 0s1-2 1-2 .5 1.5 1 2 1.5.5 2 0 1-1 2-3 2-4 2-7c0-3.5-2.5-8-7-8z"/></svg>
        </div>
        <h3 class="empty-state__title">未选择病例</h3>
        <a href="cases.html" class="btn btn--primary">返回病例列表</a>
      </div>
    `;
    return;
  }

  detailCase = Storage.getCase(id);
  if (!detailCase) {
    root.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </div>
        <h3 class="empty-state__title">病例不存在</h3>
        <p class="empty-state__text">该病例可能已被删除。</p>
        <a href="cases.html" class="btn btn--primary">返回病例列表</a>
      </div>
    `;
    return;
  }

  renderDetail();
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderDetail() {
  // 始终读取最新存储，保证状态/时间线的变更能立即反映
  detailCase = Storage.getCase(detailCase.id) || detailCase;
  const c = detailCase;
  const root = document.getElementById("detail-root");
  const isDone = c.status === "已完成";
  const tags = (c.tags || []).map((t) => `<span class="tag ${getTagClass(t)}">${esc(t)}</span>`).join("");

  const statusControl = `
    <div class="status-control" role="group" aria-label="病例状态">
      <button class="status-opt ${isDone ? "" : "status-opt--active"}" data-status="进行中">治疗中</button>
      <button class="status-opt ${isDone ? "status-opt--active" : ""}" data-status="已完成">已完成</button>
    </div>
  `;

  root.innerHTML = `
    <div class="page__header">
      <div>
        <div class="breadcrumbs">
          <a href="cases.html">病例列表</a>
          <span class="breadcrumbs__sep" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
          <span>病例详情</span>
        </div>
      </div>
      <div class="page__actions">
        <button class="btn btn--primary" type="button" id="edit-case-btn">编辑信息</button>
        <button class="btn btn--secondary" type="button" id="copy-case-btn">复制病例</button>
        <button class="btn btn--secondary" type="button" id="share-case-btn">导出展示页</button>
        <button class="btn" type="button" id="delete-case-btn" style="color:#DC2626;border-color:#FECACA;">删除病例</button>
      </div>
    </div>

    <article class="case-layout">
      <section class="case-info card">
        <div class="case-info__header">
          <div>
            <div class="case-info__id">${esc(c.id)}</div>
            <h1 class="case-info__name">${esc(c.patientName) || "未命名病例"}</h1>
          </div>
          ${statusControl}
        </div>

        ${tags ? `<div class="tag-list" aria-label="病例标签">${tags}</div>` : ""}

        <div class="patient-meta">
          <div class="meta-item"><span class="meta-item__label">年龄</span><span class="meta-item__value">${c.age ? esc(c.age) + " 岁" : "--"}</span></div>
          <div class="meta-item"><span class="meta-item__label">性别</span><span class="meta-item__value">${esc(c.gender) || "--"}</span></div>
          <div class="meta-item"><span class="meta-item__label">初诊日期</span><span class="meta-item__value">${esc(c.visitDate) || "--"}</span></div>
          <div class="meta-item"><span class="meta-item__label">完成日期</span><span class="meta-item__value">${esc(c.completionDate) || "--"}</span></div>
        </div>

        <div class="section-group">
          ${[
            ["主诉与诉求",
              `<p class="paragraph"><strong>主诉：</strong>${esc(c.chiefComplaint) || "--"}</p>
               <p class="paragraph"><strong>就诊原因：</strong>${esc(c.reason) || "--"}</p>
               <p class="paragraph"><strong>患者诉求：</strong>${esc(c.patientRequest) || "--"}</p>`],
            ["现病史与检查",
              `<p class="paragraph"><strong>现病史：</strong>${esc(c.history) || "--"}</p>
               <p class="paragraph"><strong>既往史：</strong>${esc(c.pastHistory) || "--"}</p>
               <p class="paragraph"><strong>临床检查：</strong>${esc(c.exam) || "--"}</p>
               <p class="paragraph"><strong>诊断：</strong>${esc(c.diagnosis) || "--"}</p>`],
            ["治疗计划",
              `<p class="paragraph">${esc(c.plan) || "--"}</p>`]
          ].map(([title, html]) => `
            <div class="section">
              <h2 class="section__title">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                ${title}
              </h2>
              <div class="section__body">${html}</div>
            </div>
          `).join("")}

          ${buildCustomFieldsHtml(c)}

          <div class="section section--timeline">
            <div class="section__header-row">
              <h2 class="section__title">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                治疗过程
              </h2>
              <button class="btn btn--ghost btn--sm" type="button" id="add-visit-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                添加治疗记录
              </button>
            </div>
            <ol class="timeline" id="timeline-list">
              ${buildTimeline(c)}
            </ol>
            <form class="visit-form" id="visit-form" hidden>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="visit-date">日期</label>
                  <input type="date" class="input" id="visit-date" value="${esc(new Date().toISOString().slice(0, 10))}" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="visit-step">阶段</label>
                  <input type="text" class="input" id="visit-step" placeholder="如：复诊、根管充填、戴冠…" />
                </div>
              </div>
              <div class="form-group mb-0">
                <label class="form-label" for="visit-content">内容 / 备注</label>
                <textarea class="textarea" id="visit-content" rows="2" placeholder="本次治疗做了什么、患者反应…"></textarea>
              </div>
              <div class="section__actions">
                <button type="button" class="btn btn--ghost btn--sm" id="visit-cancel">取消</button>
                <button type="submit" class="btn btn--primary btn--sm">保存记录</button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section class="case-gallery card" id="gallery-root">
        ${buildGallery()}
      </section>
    </article>
  `;

  // 绑定状态编辑交互
  root.querySelectorAll(".status-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      Storage.updateCaseStatus(c.id, btn.dataset.status);
      renderDetail();
    });
  });

  // 编辑初始信息
  const editBtn = root.querySelector("#edit-case-btn");
  if (editBtn) editBtn.addEventListener("click", () => openEditCaseModal(c.id));

  // 导出展示页（含隐私选项）
  const shareBtn = root.querySelector("#share-case-btn");
  if (shareBtn) shareBtn.addEventListener("click", () => openShareModal(c.id));

  // 复制病例
  const copyBtn = root.querySelector("#copy-case-btn");
  if (copyBtn) copyBtn.addEventListener("click", () => {
    const copy = Storage.duplicateCase(c.id);
    if (copy) location.href = "case-detail.html?id=" + copy.id;
  });

  // 删除病例
  const delBtn = root.querySelector("#delete-case-btn");
  if (delBtn) delBtn.addEventListener("click", () => doDeleteCase(c.id));

  // 绑定「添加治疗记录」
  const addVisitBtn = root.querySelector("#add-visit-btn");
  const visitForm = root.querySelector("#visit-form");
  if (addVisitBtn && visitForm) {
    addVisitBtn.addEventListener("click", () => {
      visitForm.hidden = false;
      addVisitBtn.style.display = "none";
    });
    const cancelBtn = root.querySelector("#visit-cancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        visitForm.hidden = true;
        addVisitBtn.style.display = "inline-flex";
      });
    }
    visitForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const date = (root.querySelector("#visit-date") || {}).value || new Date().toISOString().slice(0, 10);
      const step = (root.querySelector("#visit-step") || {}).value.trim() || "复诊";
      const content = (root.querySelector("#visit-content") || {}).value.trim();
      Storage.addTimelineEntry(c.id, { date, step, content });
      renderDetail();
    });
  }

  initGallery();
}

function buildTimeline(c) {
  if (c.timeline && c.timeline.length) {
    return c.timeline
      .map(
        (t, i) => `
        <li class="timeline__item ${i === c.timeline.length - 1 ? "timeline__item--last" : ""}">
          <time class="timeline__date">${esc(t.date)}</time>
          <div class="timeline__content"><strong>${esc(t.step)}</strong><span>${esc(t.content)}</span></div>
        </li>`
      )
      .join("");
  }
  return `<li class="timeline__item timeline__item--last">
    <time class="timeline__date">${esc(c.visitDate) || "--"}</time>
    <div class="timeline__content"><strong>初诊</strong><span>病例创建。后续可补充治疗过程。</span></div>
  </li>`;
}

function buildCustomFieldsHtml(c) {
  const fields = (c.customFields || []).filter((f) => (f.k || f.v));
  if (!fields.length) return "";
  return `
    <div class="section">
      <h2 class="section__title">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><rect x="4" y="7" width="6" height="13" rx="1"/><rect x="14" y="7" width="6" height="13" rx="1"/></svg>
        补充信息
      </h2>
      <div class="section__body">
        ${fields.map((f) => `<p class="paragraph"><strong>${esc(f.k)}：</strong>${esc(f.v)}</p>`).join("")}
      </div>
    </div>`;
}

function buildGallery() {
  const images = (detailCase.images || {})[detailPhase] || [];
  const caption = images[0]?.caption || "";

  const tabsHtml = ["pre", "during", "post"]
    .map(
      (p) => `
      <button class="tab ${p === detailPhase ? "tab--active" : ""}" role="tab" aria-selected="${p === detailPhase}" data-phase="${p}">${PHASE_LABEL[p]}</button>`
    )
    .join("");

  const galleryInner = `
    <div class="case-gallery__header">
      <h2 class="card__title" id="gallery-title">
        <span style="display:inline-flex;align-items:center;gap:8px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-primary);"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          影像资料
        </span>
      </h2>
      <div class="gallery-legend" aria-label="图例">
        <span class="legend-dot legend-dot--pre"></span>术前
        <span class="legend-dot legend-dot--during"></span>术中
        <span class="legend-dot legend-dot--post"></span>术后
      </div>
    </div>

    <div class="tabs" role="tablist" aria-label="影像阶段">${tabsHtml}</div>

    <div class="gallery-viewer" aria-live="polite">
      <figure class="main-image" id="main-image">
        ${buildMainImage(images[0])}
      </figure>
    </div>

    <div class="thumbnail-strip" id="thumbnail-gallery">${buildThumbs(images)}</div>

    <div class="gallery-actions">
      <label class="btn btn--ghost btn--sm" for="gallery-add">＋ 新增图片</label>
      <input type="file" id="gallery-add" accept="image/*" multiple style="display:none" />
      <button class="btn btn--ghost btn--sm" type="button" id="gallery-compare">术前 ⊖ 术后 对比</button>
      <span class="gallery-hint">双击名称可重命名 · 拖拽调顺序 · 右上×删除 · 左下⇄替换</span>
    </div>
  `;

  if (((detailCase.images || {})[detailPhase] || []).length === 0) {
    return `
      <div style="display:flex;flex-direction:column;gap:20px;">
        <div class="case-gallery__header"><h2 class="card__title">影像资料</h2>
          <div class="gallery-legend">
            <span class="legend-dot legend-dot--pre"></span>术前
            <span class="legend-dot legend-dot--during"></span>术中
            <span class="legend-dot legend-dot--post"></span>术后
          </div>
        </div>
        <div class="tabs" role="tablist" aria-label="影像阶段">${tabsHtml}</div>
        <div class="empty-state" style="padding:30px 20px;">
          <div class="empty-state__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </div>
          <h3 class="empty-state__title">该阶段暂无影像</h3>
          <p class="empty-state__text">可在下方为该阶段补充图片。</p>
        </div>
        <div class="gallery-actions">
          <label class="btn btn--ghost btn--sm" for="gallery-add">＋ 新增图片</label>
          <input type="file" id="gallery-add" accept="image/*" multiple style="display:none" />
        </div>
      </div>
    `;
  }

  return galleryInner;
}

function buildMainImage(img) {
  if (!img) return "";
  if (img.url) {
    return `<img class="gallery-image" src="${img.url}" alt="${esc(img.label || "")}">
      <figcaption class="main-image__caption">${esc(img.caption || img.label || "")}</figcaption>`;
  }
  const variant = img.type === "intraoral" ? "image-placeholder--intraoral" : img.type === "endoscope" ? "image-placeholder--endoscope" : "image-placeholder--xray";
  return `
    <div class="image-placeholder ${variant}" aria-label="${esc(img.label || "")}">
      <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <span class="image-placeholder__label">${esc(img.label || "影像")}</span>
    </div>
    <figcaption class="main-image__caption">${esc(img.caption || img.label || "")}</figcaption>`;
}

function buildThumbs(images) {
  return images
    .map(
      (img, i) => `
      <div class="thumb-wrap" data-idx="${i}" draggable="true">
        <button class="thumbnail ${i === 0 ? "thumbnail--active" : ""}" data-index="${i}" aria-label="查看 ${esc(img.label || "")}">
          ${img.url ? `<img class="thumb-image" src="${img.url}" alt="" draggable="false"/>` : `<div class="thumbnail__placeholder" style="background:${TYPE_BG[img.type] || TYPE_BG.xray}"></div>`}
        </button>
        <span class="thumbnail__label" title="双击重命名">${esc(img.label || "")}</span>
        <button class="thumb-ctl thumb-ctl--replace" data-act="replace" data-index="${i}" title="替换" aria-label="替换这张图片">⇄</button>
        <button class="thumb-ctl thumb-ctl--delete" data-act="del" data-index="${i}" title="删除" aria-label="删除这张图片">×</button>
      </div>`
    )
    .join("");
}

function initGallery() {
  const galleryRoot = document.getElementById("gallery-root");
  if (!galleryRoot) return;

  galleryRoot.querySelectorAll(".tab[data-phase]").forEach((btn) => {
    btn.addEventListener("click", () => {
      detailPhase = btn.dataset.phase;
      renderDetail();
    });
  });

  const thumbs = galleryRoot.querySelectorAll(".thumbnail");
  thumbs.forEach((th) => {
    th.addEventListener("click", () => {
      const images = (detailCase.images || {})[detailPhase] || [];
      const idx = Number(th.dataset.index);
      const img = images[idx];
      if (!img) return;
      const main = galleryRoot.querySelector("#main-image");
      main.innerHTML = buildMainImage(img);
      thumbs.forEach((x) => x.classList.remove("thumbnail--active"));
      th.classList.add("thumbnail--active");
      openLightbox(img, detailPhase, idx);
    });
  });

  // 删除 / 替换单张图片
  galleryRoot.querySelectorAll(".thumb-ctl").forEach((ctl) => {
    ctl.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = Number(ctl.dataset.index);
      if (ctl.dataset.act === "del") {
        removeImageAt(detailPhase, idx);
      } else if (ctl.dataset.act === "replace") {
        replaceImagePrompt(detailPhase, idx);
      }
    });
  });

  // 拖拽调整缩略图顺序
  const strip = galleryRoot.querySelector("#thumbnail-gallery");
  if (strip) {
    strip.addEventListener("dragstart", (e) => {
      const w = e.target.closest(".thumb-wrap");
      if (!w) return;
      galleryDragFrom = Number(w.dataset.idx);
      w.classList.add("thumb-wrap--dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    strip.addEventListener("dragend", (e) => {
      const w = e.target.closest(".thumb-wrap");
      if (w) w.classList.remove("thumb-wrap--dragging");
      strip.querySelectorAll(".thumb-wrap--over").forEach((x) => x.classList.remove("thumb-wrap--over"));
      galleryDragFrom = null;
    });
    strip.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (galleryDragFrom == null) return;
      const w = e.target.closest(".thumb-wrap");
      if (!w) return;
      strip.querySelectorAll(".thumb-wrap--over").forEach((x) => x.classList.remove("thumb-wrap--over"));
      w.classList.add("thumb-wrap--over");
    });
    strip.addEventListener("drop", (e) => {
      e.preventDefault();
      if (galleryDragFrom == null) return;
      const w = e.target.closest(".thumb-wrap");
      if (w) reorderPhaseImage(detailPhase, galleryDragFrom, Number(w.dataset.idx));
      galleryDragFrom = null;
    });
  }

  // 双击图片名称重命名
  galleryRoot.querySelectorAll(".thumbnail__label").forEach((label) => {
    const wrap = label.closest(".thumb-wrap");
    if (!wrap) return;
    const idx = Number(wrap.dataset.idx);
    label.addEventListener("dblclick", () => startRenameLabel(detailPhase, idx, label));
  });

  // 新增图片（当前阶段）
  const addInput = galleryRoot.querySelector("#gallery-add");
  if (addInput) addInput.addEventListener("change", (e) => {
    addImagesToPhase(detailPhase, Array.from(e.target.files));
    e.target.value = "";
  });

  // 术前术后对比
  const cmpBtn = galleryRoot.querySelector("#gallery-compare");
  if (cmpBtn) cmpBtn.addEventListener("click", () => openCompare());
}

function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target.result);
    r.readAsDataURL(file);
  });
}

async function uploadRawFiles(files) {
  const out = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    const dataUrl = await readFileAsDataURL(file);
    let url = dataUrl;
    if (window.CloudData && window.CloudData.hasImageCloud()) {
      try { url = await window.CloudData.uploadImage(dataUrl); }
      catch (e) { alert((e && e.message) || "图片上传失败"); return null; }
    }
    out.push({
      id: "g" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      type: "uploaded",
      label: file.name,
      url
    });
  }
  return out;
}

async function addImagesToPhase(phase, files) {
  if (!detailCase) return;
  const items = await uploadRawFiles(files);
  if (!items || items.length === 0) return;
  detailCase.images = detailCase.images || { pre: [], during: [], post: [] };
  detailCase.images[phase] = detailCase.images[phase] || [];
  detailCase.images[phase].push(...items);
  Storage.updateCase(detailCase.id, { images: detailCase.images });
  renderDetail();
}

function removeImageAt(phase, idx) {
  if (!detailCase) return;
  if (!confirm("确定删除这张图片吗？")) return;
  const list = (detailCase.images || {})[phase] || [];
  if (idx < 0 || idx >= list.length) return;
  list.splice(idx, 1);
  Storage.updateCase(detailCase.id, { images: detailCase.images });
  renderDetail();
}

function replaceImagePrompt(phase, idx) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => handleReplaceImage(phase, idx, Array.from(input.files)[0]);
  input.click();
}

async function handleReplaceImage(phase, idx, file) {
  if (!detailCase || !file) return;
  const items = await uploadRawFiles([file]);
  if (!items || !items.length) return;
  const list = (detailCase.images || {})[phase] || [];
  if (idx < 0 || idx >= list.length) return;
  list[idx].url = items[0].url;
  list[idx].label = items[0].label;
  Storage.updateCase(detailCase.id, { images: detailCase.images });
  renderDetail();
}

function reorderPhaseImage(phase, from, to) {
  if (!detailCase) return;
  const list = (detailCase.images || {})[phase] || [];
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return;
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  Storage.updateCase(detailCase.id, { images: detailCase.images });
  renderDetail();
}

function startRenameLabel(phase, idx, labelEl) {
  if (!detailCase) return;
  const list = (detailCase.images || {})[phase] || [];
  if (idx < 0 || idx >= list.length) return;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "thumb-label-input";
  input.value = list[idx].label || "";
  input.maxLength = 30;
  input.setAttribute("aria-label", "图片名称");
  labelEl.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    const v = input.value.trim();
    list[idx].label = v;
    Storage.updateCase(detailCase.id, { images: detailCase.images });
    renderDetail();
  };
  const cancel = () => {
    if (done) return;
    done = true;
    renderDetail();
  };
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") { commit(); input.blur(); }
    if (e.key === "Escape") { done = true; renderDetail(); }
  });
}

/* ---- 术前术后对比滑杆 ---- */
function openCompare() {
  const pre = ((detailCase.images || {}).pre || []);
  const post = ((detailCase.images || {}).post || []);
  if (!pre.length || !post.length) {
    alert("需要「术前」和「术后」都至少有一张图片才能对比。");
    return;
  }
  const shell = document.createElement("div");
  shell.setAttribute("style", "position:fixed;inset:0;z-index:9000;background:rgba(15,23,42,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:20px;");
  shell.innerHTML = `
    <div style="color:#fff;font-weight:600;font-size:15px;">术前 ⊖ 术后：拖动滑杆对比</div>
    <div id="cmp-stage" style="position:relative;max-width:min(92vw,760px);width:100%;aspect-ratio:4/3;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4);background:#000;">
      <div id="cmp-under" style="position:absolute;inset:0;background-repeat:no-repeat;background-size:cover;background-position:center;"></div>
      <div id="cmp-over" style="position:absolute;top:0;bottom:0;left:0;width:50%;overflow:hidden;background-repeat:no-repeat;background-size:cover;background-position:center;border-right:2px solid #fff;"></div>
      <div id="cmp-handle" style="position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:34px;background:rgba(255,255,255,.14);cursor:ew-resize;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;">⇄</div>
    </div>
    <button type="button" id="cmp-close" style="padding:8px 22px;border:none;border-radius:10px;background:#0EA5E9;color:#fff;font-weight:600;cursor:pointer;">关闭</button>`;
  document.body.appendChild(shell);
  shell.querySelector("#cmp-under").style.backgroundImage = "url(" + post[0].url + ")";
  shell.querySelector("#cmp-over").style.backgroundImage = "url(" + pre[0].url + ")";
  const stage = shell.querySelector("#cmp-stage");
  const overDiv = shell.querySelector("#cmp-over");
  const handle = shell.querySelector("#cmp-handle");
  let dragging = false;
  const setPos = (clientX) => {
    const r = stage.getBoundingClientRect();
    let p = ((clientX - r.left) / r.width) * 100;
    p = Math.max(0, Math.min(100, p));
    overDiv.style.width = p + "%";
    handle.style.left = p + "%";
  };
  handle.addEventListener("mousedown", () => { dragging = true; });
  window.addEventListener("mousemove", (e) => { if (dragging) setPos(e.clientX); });
  window.addEventListener("mouseup", () => { dragging = false; });
  overDiv.addEventListener("click", (e) => setPos(e.clientX));
  shell.querySelector("#cmp-close").addEventListener("click", () => shell.remove());
}

/* ---- 图片标注 ---- */
function openLightbox(img, phase, idx) {
  if (!img || !img.url) return;
  const box = document.createElement("div");
  box.setAttribute("style", "position:fixed;inset:0;z-index:9000;background:rgba(15,23,42,.92);display:flex;align-items:center;justify-content:center;padding:20px;");
  box.innerHTML = `
    <div style="position:relative;max-width:min(94vw,860px);width:100%;max-height:90vh;display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;color:#fff;">
        <span style="font-weight:600;">${esc(img.caption || img.label || "影像")}</span>
        <button type="button" id="lb-close" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">×</button>
      </div>
      <div id="lb-stage" style="position:relative;background:#000;border-radius:12px;overflow:hidden;flex:1;min-height:58vh;">
        <img id="lb-img" src="${img.url}" style="width:100%;height:100%;object-fit:contain;display:block;"/>
        <div id="lb-marks" style="position:absolute;inset:0;pointer-events:none;"></div>
      </div>
      <div id="lb-annots" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"></div>
    </div>`;
  document.body.appendChild(box);
  const stage = box.querySelector("#lb-stage");
  const marks = box.querySelector("#lb-marks");
  const annots = box.querySelector("#lb-annots");
  img.annotations = img.annotations || [];
  function draw() {
    marks.innerHTML = "";
    annots.innerHTML = "";
    img.annotations.forEach((m) => {
      const p = document.createElement("div");
      p.style.cssText = "position:absolute;left:" + m.x + "%;top:" + m.y + "%;transform:translate(-50%,-130%);background:#EF4444;color:#fff;font-size:12px;padding:2px 8px;border-radius:12px;white-space:nowrap;";
      p.textContent = m.text || "标注";
      const dot = document.createElement("div");
      dot.style.cssText = "position:absolute;left:" + m.x + "%;top:" + m.y + "%;width:13px;height:13px;margin:-6.5px 0 0 -6.5px;border-radius:50%;background:#EF4444;border:2px solid #fff;";
      marks.appendChild(dot);
      marks.appendChild(p);
    });
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn--primary btn--sm";
    addBtn.type = "button";
    addBtn.textContent = "＋ 添加标注";
    addBtn.onclick = () => {
      const onStage = (e) => {
        stage.removeEventListener("click", onStage);
        const r = stage.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        const text = (window.prompt("标注文字：") || "").trim();
        if (text) img.annotations.push({ x: +x.toFixed(2), y: +y.toFixed(2), text });
        persistDetailImages();
        draw();
      };
      stage.addEventListener("click", onStage);
      window.alert("请在图片上点击要标注的位置");
    };
    annots.appendChild(addBtn);
    img.annotations.forEach((m, i) => {
      const chip = document.createElement("span");
      chip.style.cssText = "display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.12);color:#fff;font-size:12px;padding:3px 10px;border-radius:20px;";
      chip.textContent = (i + 1) + ". " + m.text;
      const del = document.createElement("button");
      del.style.cssText = "background:none;border:none;color:#FCA5A5;cursor:pointer;font-size:14px;";
      del.textContent = "×";
      del.onclick = () => { img.annotations.splice(i, 1); persistDetailImages(); draw(); };
      chip.appendChild(del);
      annots.appendChild(chip);
    });
  }
  function persistDetailImages() { Storage.updateCase(detailCase.id, { images: detailCase.images }); }
  draw();
  box.querySelector("#lb-close").onclick = () => box.remove();
}

/* ---- 编辑病例初始信息 ---- */
function openEditCaseModal(id) {
  const c = Storage.getCase(id);
  if (!c) return;
  const TYPES = ["龋病充填", "根管治疗", "种植", "牙周", "拔牙", "美学修复", "美白", "修复", "儿童口腔"];
  const opts = TYPES.map((t) => "<option " + (c.treatmentType === t ? "selected" : "") + ">" + t + "</option>").join("");
  const overlay = document.createElement("div");
  overlay.setAttribute("style", "position:fixed;inset:0;z-index:9500;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;");
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:560px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 24px 60px rgba(2,132,199,.25);">
      <div style="padding:18px 22px;border-bottom:1px solid #E2E8F0;"><h2 style="margin:0;font-size:18px;">编辑病例信息</h2></div>
      <div style="padding:20px 22px;display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:14px;">
        <label style="grid-column:1 / -1;"><span style="display:block;color:#475569;margin-bottom:4px;">患者姓名</span><input class="input" id="e-name" value="${esc(c.patientName || "")}"/></label>
        <label><span style="display:block;color:#475569;margin-bottom:4px;">年龄</span><input class="input" id="e-age" type="number" value="${esc(c.age || "")}"/></label>
        <label><span style="display:block;color:#475569;margin-bottom:4px;">性别</span><select class="input" id="e-gender"><option value="">--</option><option ${c.gender === "男" ? "selected" : ""}>男</option><option ${c.gender === "女" ? "selected" : ""}>女</option></select></label>
        <label><span style="display:block;color:#475569;margin-bottom:4px;">初诊日期</span><input class="input" id="e-visit" type="date" value="${esc(c.visitDate || "")}"/></label>
        <label><span style="display:block;color:#475569;margin-bottom:4px;">治疗类型</span><select class="input" id="e-type">${opts}</select></label>
        <label style="grid-column:1 / -1;"><span style="display:block;color:#475569;margin-bottom:4px;">诊断</span><input class="input" id="e-diagnosis" value="${esc(c.diagnosis || "")}"/></label>
        <label style="grid-column:1 / -1;"><span style="display:block;color:#475569;margin-bottom:4px;">主诉</span><textarea class="textarea" id="e-chief" rows="2">${esc(c.chiefComplaint || "")}</textarea></label>
        <label style="grid-column:1 / -1;"><span style="display:block;color:#475569;margin-bottom:4px;">患者诉求</span><textarea class="textarea" id="e-request" rows="2">${esc(c.patientRequest || "")}</textarea></label>
        <label style="grid-column:1 / -1;"><span style="display:block;color:#475569;margin-bottom:4px;">现病史</span><textarea class="textarea" id="e-history" rows="2">${esc(c.history || "")}</textarea></label>
        <label style="grid-column:1 / -1;"><span style="display:block;color:#475569;margin-bottom:4px;">既往史</span><textarea class="textarea" id="e-past" rows="2">${esc(c.pastHistory || "")}</textarea></label>
        <label style="grid-column:1 / -1;"><span style="display:block;color:#475569;margin-bottom:4px;">治疗计划</span><textarea class="textarea" id="e-plan" rows="2">${esc(c.plan || "")}</textarea></label>
        <label style="grid-column:1 / -1;"><span style="display:block;color:#475569;margin-bottom:4px;">标签（逗号分隔）</span><input class="input" id="e-tags" value="${esc((c.tags || []).join(","))}"/></label>
        <label style="grid-column:1 / -1;"><span style="display:block;color:#475569;margin-bottom:4px;">补充字段（每行一项，格式：字段名: 值，如「复诊提醒: 3月后」）</span><textarea class="textarea" id="e-custom" rows="3">${esc((c.customFields || []).map((f) => f.k + ": " + f.v).join("\n"))}</textarea></label>
      </div>
      <div style="padding:16px 22px;border-top:1px solid #E2E8F0;display:flex;justify-content:flex-end;gap:10px;">
        <button class="btn btn--ghost" type="button" id="e-cancel">取消</button>
        <button class="btn btn--primary" type="button" id="e-save">保存</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const val = (s) => (overlay.querySelector(s) || {}).value || "";
  overlay.querySelector("#e-cancel").onclick = () => overlay.remove();
  overlay.querySelector("#e-save").onclick = () => {
    Storage.updateCase(c.id, {
      patientName: val("#e-name").trim(),
      age: val("#e-age") || null,
      gender: val("#e-gender"),
      visitDate: val("#e-visit"),
      treatmentType: val("#e-type"),
      diagnosis: val("#e-diagnosis").trim(),
      chiefComplaint: val("#e-chief").trim(),
      patientRequest: val("#e-request").trim(),
      history: val("#e-history").trim(),
      pastHistory: val("#e-past").trim(),
      plan: val("#e-plan").trim(),
      tags: val("#e-tags").split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      customFields: val("#e-custom").split("\n").map((line) => {
        const i = line.indexOf(":");
        if (i < 0) return null;
        const k = line.slice(0, i).trim();
        const v = line.slice(i + 1).trim();
        return k && v ? { k, v } : null;
      }).filter(Boolean)
    });
    overlay.remove();
    renderDetail();
  };
}

/* ---- 删除病例 ---- */
function doDeleteCase(id) {
  if (!confirm("确定删除该病例吗？此操作不可恢复。")) return;
  Storage.deleteCase(id);
  location.href = "cases.html";
}

/* ---- 导出单个病例为一个可直接分享的展示页 ---- */
function openShareModal(id) {
  const c = Storage.getCase(id);
  if (!c) return;
  const overlay = document.createElement("div");
  overlay.setAttribute("style", "position:fixed;inset:0;z-index:9500;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;");
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:440px;width:100%;box-shadow:0 24px 60px rgba(2,132,199,.25);overflow:hidden;">
      <div style="padding:18px 22px;border-bottom:1px solid #E2E8F0;"><h2 style="margin:0;font-size:18px;">导出展示</h2></div>
      <div style="padding:20px 22px;display:grid;gap:12px;">
        <p style="margin:0 0 2px;color:#475569;font-size:14px;">选择导出格式：</p>
        <div style="display:flex;gap:8px;" role="group" aria-label="导出格式">
          <button class="btn btn--primary btn--sm" type="button" id="sh-fmt-web">网页（.html）</button>
          <button class="btn btn--secondary btn--sm" type="button" id="sh-fmt-pdf">PDF（打印保存）</button>
        </div>
        <p style="margin:6px 0 2px;color:#475569;font-size:14px;">选择版本：</p>
        <button class="btn btn--secondary" type="button" id="sh-public">
          对外版本（隐藏患者姓名 / 年龄 / 性别）
        </button>
        <button class="btn btn--secondary" type="button" id="sh-full">
          完整版本（含患者信息，仅自用）
        </button>
        <p style="margin:6px 0 0;color:#94A3B8;font-size:12px;">
          PDF 会打开一个打印窗口，在打印对话框中选择「另存为 PDF」或系统 PDF 打印机即可。
        </p>
      </div>
      <div style="padding:14px 22px;border-top:1px solid #F1F5F9;display:flex;justify-content:flex-end;">
        <button class="btn btn--ghost btn--sm" type="button" id="sh-cancel">取消</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  let fmt = "web";
  function markWeb() {
    const w = overlay.querySelector("#sh-fmt-web");
    const p = overlay.querySelector("#sh-fmt-pdf");
    w.className = "btn btn--primary btn--sm";
    p.className = "btn btn--secondary btn--sm";
  }
  function markPdf() {
    const w = overlay.querySelector("#sh-fmt-web");
    const p = overlay.querySelector("#sh-fmt-pdf");
    w.className = "btn btn--secondary btn--sm";
    p.className = "btn btn--primary btn--sm";
  }
  overlay.querySelector("#sh-fmt-web").onclick = () => { fmt = "web"; markWeb(); };
  overlay.querySelector("#sh-fmt-pdf").onclick = () => { fmt = "pdf"; markPdf(); };

  function run(privacy) {
    overlay.remove();
    if (fmt === "pdf") exportCasePdf(id, privacy);
    else exportCasePage(id, privacy);
  }
  overlay.querySelector("#sh-public").onclick = () => run(true);
  overlay.querySelector("#sh-full").onclick = () => run(false);
  overlay.querySelector("#sh-cancel").onclick = () => overlay.remove();
}

function buildShareHTML(c, privacy) {
  const e2 = (q) => String(q == null ? "" : q).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const dispName = privacy ? "患者" : ((c.patientName || "未命名病例"));
  const col = (ph) => (c.images && c.images[ph] ? c.images[ph] : []);
  const imgRow = (arr) => arr.map((img) => `<figure class="ph"><img src="${img.url}" alt=""/>${img.caption || img.label ? "<figcaption>" + e2(img.caption || img.label) + "</figcaption>" : ""}</figure>`).join("");
  const groups = [
    ["术前", col("pre")], ["术中", col("during")], ["术后", col("post")]
  ].map(([t, arr]) => arr.length ? `<div class="step"><h3>${t}</h3><div class="grid">${imgRow(arr)}</div></div>` : "").join("");
  const timeline = (c.timeline || []).map((t) => `<li><strong>${e2(t.date)}</strong> · ${e2(t.step)} — ${e2(t.content)}</li>`).join("");
  const tags = (c.tags || []).map((t) => `<span class="tag">${e2(t)}</span>`).join("");
  const customF = (c.customFields || []).filter((f) => (f.k || f.v)).map((f) => `<div class="label">${e2(f.k)}</div><p>${e2(f.v)}</p>`).join("");
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${e2(dispName)} · 病例展示</title>
<style>
  body{margin:0;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1F2937;background:linear-gradient(135deg,#E0F2FE,#EDE9FE,#DCFCE7);}
  .wrap{max-width:880px;margin:0 auto;padding:40px 24px;}
  .card{background:#fff;border-radius:18px;box-shadow:0 14px 40px rgba(2,132,199,.10);padding:30px;margin-bottom:24px;}
  h1{margin:0 0 6px;font-size:26px;} .id{color:#64748B;font-size:13px;margin-bottom:12px;}
  .meta{display:flex;gap:20px;flex-wrap:wrap;color:#475569;font-size:14px;margin-bottom:14px;}
  .tag{display:inline-block;background:#E0F2FE;color:#0369A1;border-radius:20px;padding:3px 12px;font-size:13px;margin-right:6px;}
  .label{color:#64748B;font-size:13px;font-weight:600;margin:14px 0 6px;}
  p{margin:4px 0;color:#374151;font-size:15px;line-height:1.7;}
  .step h3{color:#0284C7;margin:0 0 12px;} .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;}
  .ph{margin:0;} .ph img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.12);}
  .ph figcaption{font-size:12px;color:#64748B;margin-top:6px;text-align:center;}
  ul.timeline{list-style:none;padding:0;margin:0;} li{padding:8px 0;border-bottom:1px dashed #E2E8F0;color:#374151;font-size:15px;}
  .footer{text-align:center;color:#94A3B8;font-size:13px;margin-top:8px;}
  @page{margin:12mm;}
  @media print{
    body{background:#fff !important;}
    .wrap{max-width:none;padding:0;margin:0;}
    .card{box-shadow:none;border:1px solid #E2E8F0;border-radius:8px;page-break-inside:avoid;break-inside:avoid;}
    .step, .grid{page-break-inside:avoid;break-inside:avoid;}
    .ph img{box-shadow:none;}
  }
</style></head><body><div class="wrap">
<div class="card"><h1>${e2(dispName)}</h1>
<div class="meta"><span>初诊：${e2(c.visitDate || "--")}</span><span>状态：${e2(c.status || "进行中")}</span></div>
${tags}</div>
<div class="card"><div class="label">主诉</div><p>${e2(c.chiefComplaint || "--")}</p>
<div class="label">患者诉求</div><p>${e2(c.patientRequest || "--")}</p>
<div class="label">现病史</div><p>${e2(c.history || "--")}</p>
<div class="label">诊断</div><p>${e2(c.diagnosis || "--")}</p>
<div class="label">治疗计划</div><p>${e2(c.plan || "--")}</p>
${customF}</div>
${groups ? `<div class="card">${groups}</div>` : ""}
${timeline ? `<div class="card"><h3 style="color:#0284C7;margin-top:0;">治疗过程</h3><ul class="timeline">${timeline}</ul></div>` : ""}
<div class="footer">由「齿案台」生成</div>
</div></body></html>`;
}

function exportCasePage(id, privacy) {
  const c = Storage.getCase(id);
  if (!c) return;
  const dispName = privacy ? "患者" : ((c.patientName || "未命名病例"));
  const blob = new Blob([buildShareHTML(c, privacy)], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = dispName + "-病例展示.html";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportCasePdf(id, privacy) {
  const c = Storage.getCase(id);
  if (!c) return;
  const dispName = privacy ? "患者" : ((c.patientName || "未命名病例"));
  const w = window.open("", "_blank");
  if (!w) { alert("弹窗被阻止，请允许本网站打开新窗口后再试。"); return; }
  w.document.write(buildShareHTML(c, privacy));
  w.document.close();
  w.document.title = dispName + "-病例展示";
  let tries = 0;
  const ready = () => {
    tries += 1;
    if (w.document.readyState === "complete" || tries > 20) {
      setTimeout(() => { w.focus(); w.print(); }, 250);
    } else {
      setTimeout(ready, 150);
    }
  };
  setTimeout(ready, 200);
}

/* ==========================================================
   6. New Case Wizard + 多图上传
   ========================================================== */
let uploadedImages = { pre: [], during: [], post: [] };

const CASE_TEMPLATES = {
  "龋病充填": {
    "f-chief": "右下后牙龋坏，冷热刺激时有酸痛",
    "f-request": "补牙恢复咀嚼功能，尽量保留天然牙",
    "f-diagnosis": "下颌第二磨牙深龋",
    "f-type": "龋病充填",
    "f-history": "进食甜食或冷热刺激时酸痛约 2 周，平日无自发痛",
    "f-past": "",
    "f-plan": "去除腐质 → 窝洞预备 → 树脂分层充填 → 咬合调整"
  },
  "根管治疗": {
    "f-chief": "左下后牙夜间自发性疼痛 3 天",
    "f-request": "缓解疼痛，保留患牙，恢复功能",
    "f-diagnosis": "下第一磨牙急性牙髓炎",
    "f-type": "根管治疗",
    "f-history": "近 1 周冷热刺激痛，昨日夜间痛明显加剧",
    "f-past": "",
    "f-plan": "开髓引流 → 根管预备与消毒 → 根管充填 → 冠修复"
  },
  "种植修复": {
    "f-chief": "右下后牙缺失 3 个月，要求种植修复",
    "f-request": "恢复咀嚼功能与美观",
    "f-diagnosis": "下颌第二前磨牙缺失",
    "f-type": "种植修复",
    "f-history": "缺牙区牙槽嵴愈合良好，邻牙无明显倾斜、对颌未伸长",
    "f-past": "",
    "f-plan": "CBCT 评估 → 一期植入 → 骨结合期 → 二期取模 → 戴冠"
  },
  "牙周治疗": {
    "f-chief": "刷牙出血、牙龈红肿约 1 个月",
    "f-request": "改善牙龈出血，防止牙齿松动",
    "f-diagnosis": "慢性牙周炎",
    "f-type": "牙周治疗",
    "f-history": "刷牙或啃咬硬物时易出血，偶有口腔异味",
    "f-past": "",
    "f-plan": "口腔卫生宣教 → 龈上洁治 → 龈下刮治 → 定期复查维护"
  }
};

function initTemplatePicker() {
  const buttons = document.querySelectorAll("[data-template]");
  if (!buttons.length) return;

  function applyTemplate(name) {
    const tpl = CASE_TEMPLATES[name];
    const ids = ["f-chief", "f-request", "f-diagnosis", "f-type", "f-history", "f-past", "f-plan"];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (tpl) {
        el.value = tpl[id] || "";
      } else {
        el.value = "";
      }
    });
    saveDraft();
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      applyTemplate(btn.dataset.template);
      btn.classList.add("btn--primary");
      buttons.forEach((b) => { if (b !== btn) b.classList.remove("btn--primary"); });
    });
  });
}

function initUploadZone(phase) {
  const input = document.getElementById(`upload-${phase}`);
  const grid = document.getElementById(`preview-${phase}`);
  if (!input || !grid) return;

  input.addEventListener("change", () => {
    const files = Array.from(input.files);
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadedImages[phase].push({
          id: phase + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
          type: "uploaded",
          label: file.name,
          url: e.target.result
        });
        renderUploadGrid(phase);
        saveDraft();
      };
      reader.readAsDataURL(file);
    });
    input.value = "";
  });
}

function renderUploadGrid(phase) {
  const grid = document.getElementById(`preview-${phase}`);
  if (!grid) return;

  const list = uploadedImages[phase];
  if (list.length === 0) {
    grid.innerHTML = "";
    grid.style.display = "none";
    return;
  }

  grid.style.display = "grid";
  grid.innerHTML = list
    .map(
      (img, i) => `
      <div class="upload-holder">
        <img src="${img.url}" alt="预览" />
        <button class="upload-holder__remove" type="button" data-phase="${phase}" data-idx="${i}" aria-label="移除图片">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`
    )
    .join("");

  grid.querySelectorAll(".upload-holder__remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      uploadedImages[btn.dataset.phase].splice(Number(btn.dataset.idx), 1);
      renderUploadGrid(btn.dataset.phase);
      saveDraft();
    });
  });
}

function value(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

/* ---- 新建病例草稿自动保存 ----
   填写中途退出去（刷新/返回/关闭）也不丢，重新进入自动恢复。 */
const DRAFT_KEY = "dentalWorkbench.newCaseDraft";

const DRAFT_FIELD_IDS = [
  "f-name", "f-age", "f-gender", "f-visit-date",
  "f-chief", "f-request", "f-diagnosis", "f-type",
  "f-history", "f-past", "f-plan"
];

function saveDraft() {
  const fields = {};
  DRAFT_FIELD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) fields[id] = el.value;
  });
  const payload = {
    savedAt: Date.now(),
    fields,
    images: uploadedImages
  };
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch (e) {
    // 图片过大导致超出本地容量时，仅保留文字草稿，图片降级为不保存
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...payload, images: { pre: [], during: [], post: [] } }));
    } catch (_) {}
  }
}

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null;
  } catch {
    return null;
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function initNewCaseWizard() {
  const steps = document.querySelectorAll(".step");
  const stepPanels = document.querySelectorAll(".wizard-step");
  const btnNext = document.getElementById("wizard-next");
  const btnPrev = document.getElementById("wizard-prev");

  if (!steps.length) return;

  initTemplatePicker();
  ["pre", "during", "post"].forEach((p) => initUploadZone(p));

  // 恢复未完成的草稿（文字 + 已选图片）
  const draft = loadDraft();
  if (draft) {
    Object.entries(draft.fields || {}).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val || "";
    });
    uploadedImages = { pre: [], during: [], post: [] };
    Object.entries(draft.images || {}).forEach(([phase, arr]) => {
      (arr || []).forEach((img) => uploadedImages[phase].push(img));
    });
    ["pre", "during", "post"].forEach((p) => renderUploadGrid(p));
  }

  // 随输入自动保存草稿
  DRAFT_FIELD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", saveDraft);
  });

  const draftClear = document.getElementById("draft-clear");
  if (draftClear) {
    draftClear.addEventListener("click", () => {
      if (confirm("确定清空当前草稿吗？已填写的内容和已选的图片都会被清除。")) {
        clearDraft();
        location.reload();
      }
    });
  }

  let currentStep = 0;

  function stepValid() {
    if (currentStep === 0) {
      if (!value("f-name")) { alert("请填写患者昵称。"); return false; }
      if (!value("f-chief")) { alert("请填写主诉 / 就诊原因。"); return false; }
    } else if (currentStep === 1) {
      if (!value("f-diagnosis")) { alert("请填写诊断。"); return false; }
    }
    return true;
  }

  function updateWizard() {
    steps.forEach((s, i) => {
      s.classList.remove("step--active", "step--completed");
      if (i < currentStep) s.classList.add("step--completed");
      if (i === currentStep) s.classList.add("step--active");
    });
    stepPanels.forEach((p, i) => {
      p.style.display = i === currentStep ? "block" : "none";
    });
    btnPrev.style.display = currentStep === 0 ? "none" : "inline-flex";
    btnNext.innerHTML =
      currentStep === stepPanels.length - 1
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 保存病例`
        : `下一步 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
  }

  function collectTags() {
    const tags = [];
    const type = value("f-type");
    if (type) tags.push(type);
    if (value("f-diagnosis")) tags.push(value("f-diagnosis"));
    return tags.slice(0, 3);
  }

  async function uploadImagesCloud(images) {
    const out = { pre: [], during: [], post: [] };
    for (const k of ["pre", "during", "post"]) {
      out[k] = [];
      for (const img of images[k] || []) {
        try {
          const url = await window.CloudData.uploadImage(img.url);
          out[k].push({ ...img, url: url.replace(/^http:/, "https:") });
        } catch (e) {
          alert((e && e.message) || "图片上传失败，请重试");
          return null;
        }
      }
    }
    return out;
  }

  async function saveCase() {
    const selectedType = value("f-type");

    const rawImages = {
      pre: uploadedImages.pre,
      during: uploadedImages.during,
      post: uploadedImages.post
    };

    // 有 Cloudinary 图床：图片上传云端取直链（大图不受限）；否则用本地 base64（小图直存）
    const images =
      window.CloudData && window.CloudData.hasImageCloud()
        ? await uploadImagesCloud(rawImages)
        : { pre: rawImages.pre.slice(), during: rawImages.during.slice(), post: rawImages.post.slice() };
    if (!images) return;

    const c = {
      id: genCaseId(),
      patientName: value("f-name"),
      age: value("f-age") || null,
      gender: (document.getElementById("f-gender") || {}).value || "",
      visitDate: value("f-visit-date") || new Date().toISOString().slice(0, 10),
      completionDate: null,
      status: "进行中",
      chiefComplaint: value("f-chief"),
      patientRequest: value("f-request"),
      reason: value("f-chief"),
      history: value("f-history"),
      pastHistory: value("f-past"),
      exam: "",
      diagnosis: value("f-diagnosis"),
      plan: value("f-plan"),
      treatmentType: selectedType,
      tags: collectTags(),
      updatedAt: new Date().toISOString(),
      images
    };

    Storage.addCase(c);
    clearDraft();

    location.href = "case-detail.html?id=" + c.id;
  }

  btnNext.addEventListener("click", () => {
    if (!stepValid()) return;
    if (currentStep < stepPanels.length - 1) {
      currentStep++;
      updateWizard();
    } else {
      saveCase();
    }
  });

  btnPrev.addEventListener("click", () => {
    if (currentStep > 0) {
      currentStep--;
      updateWizard();
    }
  });

  updateWizard();
}

/* ==========================================================
   7. Initialize
   ========================================================== */
async function init() {
  initNavigation();

  // 单机模式：直接灌入本地缓存
  Storage.hydrateFromLocal();

  initProfile();
  renderDashboardStats();
  renderDashboardCharts();
  renderRecentCases();
  initCasesPage();
  initDataTransfer();
  initCaseDetail();
  initNewCaseWizard();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}