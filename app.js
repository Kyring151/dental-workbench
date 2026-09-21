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
let casesSearch = "";

function initCasesPage() {
  const gridView = document.getElementById("cases-grid-view");
  const listView = document.getElementById("cases-list-view");
  const searchInput = document.getElementById("cases-search");
  const filterChips = document.querySelectorAll("[data-filter]");
  const viewButtons = document.querySelectorAll("[data-view]");

  if (!gridView || !listView) return;

  function renderCases() {
    const all = Storage.getCases();
    const filtered = all.filter((c) => {
      const matchesFilter =
        casesFilter === "全部" || c.status === casesFilter || c.treatmentType === casesFilter;
      const q = casesSearch;
      const matchesSearch =
        q === "" ||
        (c.patientName || "").includes(q) ||
        (c.diagnosis || "").includes(q) ||
        (c.chiefComplaint || "").includes(q) ||
        (c.tags || []).some((t) => t.includes(q)) ||
        (c.treatmentType || "").includes(q);
      return matchesFilter && matchesSearch;
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

/* ==========================================================
   5. Case Detail (动态读取) + 状态可编辑
   ========================================================== */
let detailCase = null;
let detailPhase = "pre";
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
        <button class="btn btn--secondary" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          导出 PDF
        </button>
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

    <div class="gallery-note">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span>点击缩略图切换主图；后续版本将支持拖拽对比与图片标注。</span>
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
        <div class="empty-state" style="padding:40px 20px;">
          <div class="empty-state__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </div>
          <h3 class="empty-state__title">该阶段暂无影像</h3>
          <p class="empty-state__text">可通过「新建病例」或后续编辑补充图片。</p>
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
      <button class="thumbnail ${i === 0 ? "thumbnail--active" : ""}" data-index="${i}" aria-label="查看 ${esc(img.label || "")}">
        ${img.url ? `<img class="thumb-image" src="${img.url}" alt=""/>` : `<div class="thumbnail__placeholder" style="background:${TYPE_BG[img.type] || TYPE_BG.xray}"></div>`}
        <span class="thumbnail__label">${esc(img.label || "")}</span>
      </button>`
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
    });
  });
}

/* ==========================================================
   6. New Case Wizard + 多图上传
   ========================================================== */
let uploadedImages = { pre: [], during: [], post: [] };

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

    // 云端模式：把图片真正上传到 Cloudinary；本地模式：直接用 base64
    const images =
      window.CloudData && window.CloudData.isActive()
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

    // 云端模式下等待该病例真正写入云端后再跳转详情页
    if (window.CloudData && window.CloudData.isActive()) {
      await window.CloudData.awaitSaved(c.id);
    }

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

  // 云端模式：等待 CloudData 就绪（可能弹出登录浮层）；本地模式直接灌入缓存
  if (window.CloudData && window.CloudData.isActive()) {
    await window.CloudData.ready;
  } else {
    Storage.hydrateFromLocal();
  }

  initProfile();
  renderDashboardStats();
  renderRecentCases();
  initCasesPage();
  initCaseDetail();
  initNewCaseWizard();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}