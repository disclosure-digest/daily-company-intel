const state = {
  data: null,
  latestData: null,
  selectedDate: "",
  loadedArchiveDate: "",
  importance: "all",
  industry: "all",
  market: "all",
  sort: "impact-desc",
  groupByIndustry: false,
  loading: false
};

const labels = {
  earnings: "決算情報",
  high: "高",
  medium: "中",
  low: "低"
};

const elements = {
  meta: document.querySelector("#meta"),
  date: document.querySelector("#dateInput"),
  dateStatus: document.querySelector("#dateStatus"),
  today: document.querySelector("#todayButton"),
  clearDate: document.querySelector("#clearDateButton"),
  importance: document.querySelector("#importanceFilter"),
  industry: document.querySelector("#industryFilter"),
  market: document.querySelector("#marketFilter"),
  sort: document.querySelector("#sortSelect"),
  groupIndustry: document.querySelector("#groupIndustryToggle"),
  title: document.querySelector("#pageTitle"),
  overview: document.querySelector("#overview"),
  items: document.querySelector("#items"),
  refresh: document.querySelector("#refreshButton")
};

async function loadData() {
  state.latestData = await fetchJson("./data/latest.json");
  const newestDate = state.latestData.coverageThrough ?? newestItemDate(state.latestData);
  state.selectedDate ||= newestDate;
  elements.date.value = state.selectedDate;
  await loadSelectedDate();
}

async function loadSelectedDate() {
  state.loadedArchiveDate = "";

  if (state.selectedDate) {
    setLoading(true);
    try {
      state.data = await fetchJson(`/api/earnings?date=${encodeURIComponent(state.selectedDate)}`);
      state.loadedArchiveDate = state.selectedDate;
    } catch {
      try {
        state.data = await fetchJson(`./data/by-date/${state.selectedDate}.json`);
        state.loadedArchiveDate = state.selectedDate;
      } catch {
        state.data = cloneDataForDate(state.latestData, state.selectedDate);
      }
    } finally {
      setLoading(false);
    }
  } else {
    state.data = state.latestData;
    populateFilterOptions();
    render();
  }
}

async function fetchJson(path) {
  const response = await fetch(`${path}${path.includes("?") ? "&" : "?"}ts=${Date.now()}`);
  if (!response.ok) throw new Error(`${path} could not be loaded`);
  return response.json();
}

function setLoading(isLoading) {
  state.loading = isLoading;
  for (const control of [elements.date, elements.today, elements.clearDate, elements.refresh]) {
    control.disabled = isLoading;
  }
  if (isLoading) {
    elements.dateStatus.textContent = `${state.selectedDate} のTDnet開示を取得しています...`;
    elements.items.innerHTML = `<p class="empty">TDnetから決算一覧を取得しています。</p>`;
  } else {
    populateFilterOptions();
    render();
  }
}

function cloneDataForDate(data, date) {
  return {
    ...data,
    summary: `${date} に発表された決算情報を latest.json 内の履歴から抽出しています。`,
    coverageThrough: date,
    companies: (data?.companies ?? [])
      .map((company) => ({
        ...company,
        items: (company.items ?? []).filter((item) => item.date === date)
      }))
      .filter((company) => company.items.length > 0)
  };
}

function baseRows() {
  return (state.data?.companies ?? []).flatMap((company) =>
    (company.items ?? [])
      .filter((item) => item.type === "earnings")
      .filter((item) => !state.selectedDate || item.date === state.selectedDate)
      .map((item) => ({ company, item }))
  );
}

function earningsRows() {
  return sortRows(baseRows().filter(({ company, item }) => {
    const industry = company.industry17 || company.industry || "未分類";
    const market = company.market || "未分類";
    return (state.importance === "all" || item.importance === state.importance)
      && (state.industry === "all" || industry === state.industry)
      && (state.market === "all" || market === state.market);
  }));
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    if (state.sort === "impact-desc") return numericDesc(a.company.marketImpactScore, b.company.marketImpactScore) || fallbackSort(a, b);
    if (state.sort === "marketcap-desc") return numericDesc(a.company.marketCap, b.company.marketCap) || numericDesc(a.company.marketImpactScore, b.company.marketImpactScore) || fallbackSort(a, b);
    if (state.sort === "marketcap-asc") return numericAsc(a.company.marketCap, b.company.marketCap) || fallbackSort(a, b);
    if (state.sort === "time-desc") return String(b.item.time ?? "").localeCompare(String(a.item.time ?? ""));
    if (state.sort === "time-asc") return String(a.item.time ?? "").localeCompare(String(b.item.time ?? ""));
    if (state.sort === "code-asc") return String(a.company.ticker).localeCompare(String(b.company.ticker));
    if (state.sort === "company-asc") return a.company.name.localeCompare(b.company.name, "ja");
    return fallbackSort(a, b);
  });
}

function numericDesc(a, b) {
  const left = Number(a);
  const right = Number(b);
  const leftOk = Number.isFinite(left);
  const rightOk = Number.isFinite(right);
  if (leftOk && rightOk) return right - left;
  if (leftOk) return -1;
  if (rightOk) return 1;
  return 0;
}

function numericAsc(a, b) {
  const left = Number(a);
  const right = Number(b);
  const leftOk = Number.isFinite(left);
  const rightOk = Number.isFinite(right);
  if (leftOk && rightOk) return left - right;
  if (leftOk) return -1;
  if (rightOk) return 1;
  return 0;
}

function fallbackSort(a, b) {
  return String(b.item.time ?? "").localeCompare(String(a.item.time ?? ""))
    || String(a.company.ticker).localeCompare(String(b.company.ticker));
}

function populateFilterOptions() {
  const rows = baseRows();
  fillSelect(elements.industry, "すべての業種", unique(rows.map(({ company }) => company.industry17 || company.industry || "未分類")), state.industry);
  fillSelect(elements.market, "すべての市場", unique(rows.map(({ company }) => company.market || "未分類")), state.market);
}

function fillSelect(select, allLabel, values, selectedValue) {
  const current = values.includes(selectedValue) ? selectedValue : "all";
  select.innerHTML = `<option value="all">${allLabel}</option>${values.map((value) =>
    `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`
  ).join("")}`;
  select.value = current;
  if (select === elements.industry) state.industry = current;
  if (select === elements.market) state.market = current;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));
}

function render() {
  const rows = earningsRows();
  const companies = new Set(rows.map((row) => row.company.ticker));
  const withMarketCap = rows.filter(({ company }) => Number.isFinite(Number(company.marketCap)) && Number(company.marketCap) > 0).length;
  const industries = new Set(rows.map(({ company }) => company.industry17 || company.industry || "未分類"));

  elements.meta.textContent = `更新: ${formatDateTime(state.data?.generatedAt)} / 対象: ${state.data?.coverageThrough ?? "-"}`;
  elements.dateStatus.textContent = dateStatusText(rows, companies.size);
  elements.title.textContent = state.selectedDate ? `${state.selectedDate} の発表決算` : "発表決算一覧";
  elements.overview.innerHTML = `
    <div class="metric"><span>会社数</span><strong>${companies.size}</strong></div>
    <div class="metric"><span>決算件数</span><strong>${rows.length}</strong></div>
    <div class="metric"><span>業種数</span><strong>${industries.size}</strong></div>
    <div class="metric"><span>実時価総額あり</span><strong>${withMarketCap}/${rows.length}</strong></div>
    <div class="metric"><span>全開示件数</span><strong>${escapeHtml(state.data?.meta?.totalDisclosures ?? "-")}</strong></div>
  `;
  elements.items.innerHTML = rows.length
    ? renderRows(rows)
    : `<p class="empty">この条件で表示できる決算関連開示はありません。</p>`;
}

function renderRows(rows) {
  if (!state.groupByIndustry) return rows.map(renderEarningsCard).join("");

  const groups = new Map();
  for (const row of rows) {
    const industry = row.company.industry17 || row.company.industry || "未分類";
    if (!groups.has(industry)) groups.set(industry, []);
    groups.get(industry).push(row);
  }

  return [...groups.entries()].map(([industry, groupRows]) => `
    <section class="industry-group">
      <h3>${escapeHtml(industry)} <span>${groupRows.length}件</span></h3>
      ${groupRows.map(renderEarningsCard).join("")}
    </section>
  `).join("");
}

function dateStatusText(rows, companyCount) {
  if (!state.selectedDate) return `全期間の決算情報: ${companyCount} 社 / ${rows.length} 件`;
  const source = state.loadedArchiveDate ? "TDnet取得済み" : "最新データ内の履歴";
  return `${state.selectedDate} の決算情報: ${companyCount} 社 / ${rows.length} 件（${source}）`;
}

function renderEarningsCard({ company, item }) {
  const documents = documentLinks(item);
  const industry = company.industry17 || company.industry || "未分類";

  return `
    <article class="item earnings-card">
      <div class="item-header">
        <div>
          <p class="company-meta">${escapeHtml(item.time ?? "")} / ${escapeHtml(company.ticker)} / ${escapeHtml(company.market ?? "")}</p>
          <h3>${escapeHtml(company.name)}</h3>
        </div>
        <span class="tag ${escapeAttribute(item.importance)}">${escapeHtml(labels[item.importance] ?? item.importance ?? "-")}</span>
      </div>
      <div class="tags">
        <span class="tag">${escapeHtml(industry)}</span>
        <span class="tag">TOPIX規模 ${escapeHtml(company.topixSize ?? "-")}</span>
        <span class="tag">時価総額 ${escapeHtml(formatMarketCap(company.marketCap))}</span>
        <span class="tag">インパクト ${escapeHtml(company.marketImpactScore ?? "-")}</span>
        <span class="tag">${escapeHtml(item.title ?? "決算発表")}</span>
      </div>
      <p>${escapeHtml(item.summary ?? company.brief ?? "")}</p>
      ${company.impactRankReason ? `<p class="source">順位根拠: ${escapeHtml(company.impactRankReason)}</p>` : ""}
      <div class="document-links">${documents}</div>
    </article>
  `;
}

function documentLinks(item) {
  const docs = Array.isArray(item.documents) ? [...item.documents] : [];
  if (item.sourceUrl && !docs.some((doc) => doc.url === item.sourceUrl)) {
    docs.unshift({ label: item.sourceName || "原文", url: item.sourceUrl });
  }

  if (docs.length === 0) return `<span class="empty">閲覧リンクがありません。</span>`;

  return docs.map((doc) => `
    <a class="doc-link" href="${escapeAttribute(doc.url)}" target="_blank" rel="noreferrer">
      ${escapeHtml(doc.label ?? "資料")}
    </a>
  `).join("");
}

function formatMarketCap(value) {
  const cap = Number(value);
  if (!Number.isFinite(cap) || cap <= 0) return "未取得";
  if (cap >= 1_000_000_000_000) return `${(cap / 1_000_000_000_000).toFixed(1)}兆円`;
  if (cap >= 100_000_000) return `${Math.round(cap / 100_000_000).toLocaleString("ja-JP")}億円`;
  return `${cap.toLocaleString("ja-JP")}円`;
}

function newestItemDate(data) {
  return (data?.companies ?? [])
    .flatMap((company) => company.items ?? [])
    .map((item) => item.date)
    .filter(Boolean)
    .sort()
    .at(-1) ?? "";
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

elements.date.addEventListener("change", async (event) => {
  state.selectedDate = event.target.value;
  await loadSelectedDate();
});

elements.today.addEventListener("click", async () => {
  state.selectedDate = state.latestData?.coverageThrough ?? newestItemDate(state.latestData);
  elements.date.value = state.selectedDate;
  await loadSelectedDate();
});

elements.clearDate.addEventListener("click", async () => {
  state.selectedDate = "";
  elements.date.value = "";
  await loadSelectedDate();
});

elements.importance.addEventListener("change", (event) => {
  state.importance = event.target.value;
  render();
});

elements.industry.addEventListener("change", (event) => {
  state.industry = event.target.value;
  render();
});

elements.market.addEventListener("change", (event) => {
  state.market = event.target.value;
  render();
});

elements.sort.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});

elements.groupIndustry.addEventListener("change", (event) => {
  state.groupByIndustry = event.target.checked;
  render();
});

elements.refresh.addEventListener("click", loadData);

loadData().catch((error) => {
  elements.meta.textContent = "データを読み込めませんでした。";
  elements.items.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
});
