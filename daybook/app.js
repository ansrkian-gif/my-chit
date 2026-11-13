(() => {
  "use strict";

  const STORAGE_KEY = "daybook.v1";
  const RING = 2 * Math.PI * 52;
  const TZ = "Asia/Kuwait";
  const CLOUD_BASE =
    "https://raw.githubusercontent.com/ansrkian-gif/my-chit/main/daybook/cloud";
  // Optional live mirror that writes daybook/cloud/{id}.json on GitHub.
  // Personal link packing (?book=&d=) is the reliable cross-device path.
  const SYNC_API = "https://daybook-ansrkian.loca.lt";

  const defaultState = () => ({
    bookId: "",
    budget: 300,
    currency: "KWD",
    name: "",
    expenses: [],
    lastSummaryDate: "",
    updatedAt: 0,
  });

  const els = {
    headerDate: document.getElementById("headerDate"),
    monthLabel: document.getElementById("monthLabel"),
    heroSub: document.getElementById("heroSub"),
    remainingAmount: document.getElementById("remainingAmount"),
    remainingMeta: document.getElementById("remainingMeta"),
    spentToday: document.getElementById("spentToday"),
    spentSelectedLabel: document.getElementById("spentSelectedLabel"),
    spentMonth: document.getElementById("spentMonth"),
    meterRing: document.getElementById("meterRing"),
    meterValue: document.getElementById("meterValue"),
    expenseForm: document.getElementById("expenseForm"),
    amountInput: document.getElementById("amountInput"),
    categoryInput: document.getElementById("categoryInput"),
    noteInput: document.getElementById("noteInput"),
    dateInput: document.getElementById("dateInput"),
    viewDateInput: document.getElementById("viewDateInput"),
    viewDateMeta: document.getElementById("viewDateMeta"),
    prevDayBtn: document.getElementById("prevDayBtn"),
    nextDayBtn: document.getElementById("nextDayBtn"),
    jumpTodayBtn: document.getElementById("jumpTodayBtn"),
    todayTitle: document.getElementById("todayTitle"),
    todayList: document.getElementById("todayList"),
    todayCount: document.getElementById("todayCount"),
    historyList: document.getElementById("historyList"),
    dayChart: document.getElementById("dayChart"),
    categoryChart: document.getElementById("categoryChart"),
    dayChartLabel: document.getElementById("dayChartLabel"),
    categoryChartLabel: document.getElementById("categoryChartLabel"),
    chartsSub: document.getElementById("chartsSub"),
    currencyPrefix: document.getElementById("currencyPrefix"),
    settingsCurrencyPrefix: document.getElementById("settingsCurrencyPrefix"),
    settingsBtn: document.getElementById("settingsBtn"),
    showSummaryBtn: document.getElementById("showSummaryBtn"),
    summaryModal: document.getElementById("summaryModal"),
    settingsModal: document.getElementById("settingsModal"),
    summaryDate: document.getElementById("summaryDate"),
    summarySpent: document.getElementById("summarySpent"),
    summaryRemaining: document.getElementById("summaryRemaining"),
    summaryNote: document.getElementById("summaryNote"),
    summaryTitle: document.getElementById("summaryTitle"),
    settingsForm: document.getElementById("settingsForm"),
    budgetInput: document.getElementById("budgetInput"),
    currencyInput: document.getElementById("currencyInput"),
    nameInput: document.getElementById("nameInput"),
    syncLinkInput: document.getElementById("syncLinkInput"),
    copySyncBtn: document.getElementById("copySyncBtn"),
    syncBanner: document.getElementById("syncBanner"),
    bannerCopyBtn: document.getElementById("bannerCopyBtn"),
    toast: document.getElementById("toast"),
  };

  let state = defaultState();
  let viewDate = "";
  let toastTimer = null;
  let syncTimer = null;
  let booting = true;

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        ...defaultState(),
        ...parsed,
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      };
    } catch {
      return defaultState();
    }
  }

  function persistLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function ensureBookId() {
    if (!state.bookId) {
      state.bookId = uid().replaceAll("-", "").slice(0, 12);
    }
    return state.bookId;
  }

  function toISODate(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  function parseISODate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function shiftISODate(iso, days) {
    const d = parseISODate(iso);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function daysInMonth(iso) {
    const d = parseISODate(iso);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }

  function setViewDate(iso, { syncInputs = true } = {}) {
    viewDate = iso || toISODate();
    if (syncInputs) {
      if (els.viewDateInput) els.viewDateInput.value = viewDate;
      if (els.dateInput) els.dateInput.value = viewDate;
    }
    renderAll();
  }

  function monthKey(iso = toISODate()) {
    return iso.slice(0, 7);
  }

  function currencyDecimals(code) {
    return code === "KWD" || code === "BHD" || code === "OMR" ? 3 : 2;
  }

  function formatMoney(amount, withCode = true) {
    const decimals = currencyDecimals(state.currency);
    const n = Number(amount) || 0;
    const formatted = n.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return withCode ? `${state.currency} ${formatted}` : formatted;
  }

  function formatLongDate(iso) {
    return parseISODate(iso).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatShortDate(iso) {
    return parseISODate(iso).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function expensesForDate(iso) {
    return state.expenses
      .filter((e) => e.date === iso)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  function expensesForMonth(ym = monthKey()) {
    return state.expenses.filter((e) => e.date.startsWith(ym));
  }

  function sum(list) {
    return list.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  }

  function daysLeftInMonth(iso = toISODate()) {
    const d = parseISODate(iso);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return Math.max(1, end - d.getDate() + 1);
  }

  function getTotals(iso = toISODate()) {
    const todaySpend = sum(expensesForDate(iso));
    const monthSpend = sum(expensesForMonth(monthKey(iso)));
    const remaining = state.budget - monthSpend;
    const usedRatio = state.budget > 0 ? Math.min(1, Math.max(0, monthSpend / state.budget)) : 0;
    return { todaySpend, monthSpend, remaining, usedRatio };
  }

  function exportPayload() {
    return {
      bookId: ensureBookId(),
      budget: state.budget,
      currency: state.currency,
      name: state.name,
      expenses: state.expenses,
      lastSummaryDate: state.lastSummaryDate,
      updatedAt: state.updatedAt || Date.now(),
    };
  }

  function bytesToBase64Url(bytes) {
    let binary = "";
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  }

  function base64UrlToBytes(text) {
    const padded = text.replaceAll("-", "+").replaceAll("_", "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function compressPayload(payload) {
    const json = JSON.stringify(payload);
    if (!globalThis.CompressionStream) {
      return `j.${bytesToBase64Url(new TextEncoder().encode(json))}`;
    }
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
    const buffer = await new Response(stream).arrayBuffer();
    return `g.${bytesToBase64Url(new Uint8Array(buffer))}`;
  }

  async function decompressPayload(token) {
    if (!token) return null;
    const [kind, data] = token.split(".");
    if (!data) return null;
    const bytes = base64UrlToBytes(data);
    if (kind === "j") {
      return JSON.parse(new TextDecoder().decode(bytes));
    }
    if (kind === "g" && globalThis.DecompressionStream) {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      const text = await new Response(stream).text();
      return JSON.parse(text);
    }
    return null;
  }

  function buildSyncLink(payloadToken) {
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("book", ensureBookId());
    // Keep payload in the query string (not hash) so copied/shared links
    // still restore data in messengers that strip #fragments.
    if (payloadToken) url.searchParams.set("d", payloadToken);
    return url.toString();
  }

  async function syncLink() {
    const token = await compressPayload(exportPayload());
    return buildSyncLink(token);
  }

  async function updateAddressBar() {
    const link = await syncLink();
    history.replaceState(null, "", link);
    if (els.syncLinkInput) els.syncLinkInput.value = link;
    if (els.syncBanner) els.syncBanner.hidden = false;
    return link;
  }

  async function copySyncLink() {
    const link = await updateAddressBar();
    try {
      await navigator.clipboard.writeText(link);
      showToast("Link copied — open it on any device");
    } catch {
      if (els.syncLinkInput) {
        els.syncLinkInput.focus();
        els.syncLinkInput.select();
      }
      showToast("Copy the link from the box");
    }
  }

  function applyPayload(payload, { force = false } = {}) {
    if (!payload || typeof payload !== "object") return false;
    const incomingUpdated = Number(payload.updatedAt || 0);
    if (!force && state.updatedAt && incomingUpdated && incomingUpdated < state.updatedAt) {
      return false;
    }
    state = {
      ...defaultState(),
      ...payload,
      bookId: payload.bookId || state.bookId || ensureBookId(),
      expenses: Array.isArray(payload.expenses) ? payload.expenses : [],
      updatedAt: incomingUpdated || Date.now(),
    };
    persistLocal();
    return true;
  }

  async function saveState({ quiet = false } = {}) {
    ensureBookId();
    state.updatedAt = Date.now();
    persistLocal();
    localStorage.setItem(STORAGE_KEY + ".initialized", "1");
    await updateAddressBar();
    queueCloudMirror();
    if (!quiet) {
      // callers show their own toasts
    }
  }

  function queueCloudMirror() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      mirrorToGithub().catch(() => {});
    }, 400);
  }

  async function mirrorToGithub() {
    const payload = exportPayload();
    try {
      sessionStorage.setItem(`daybook.cloud.${payload.bookId}`, JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
    try {
      const response = await fetch(`${SYNC_API}/books/${payload.bookId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Bypass-Tunnel-Reminder": "true",
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        state.cloudSyncedAt = Date.now();
      }
    } catch {
      // Tunnel/API may be offline; personal link packing still works.
    }
  }

  async function loadFromGithub(bookId) {
    try {
      const live = await fetch(`${SYNC_API}/books/${bookId}`, {
        headers: { "Bypass-Tunnel-Reminder": "true" },
        cache: "no-store",
      });
      if (live.ok) return live.json();
    } catch {
      // fall through to raw GitHub
    }
    const url = `${CLOUD_BASE}/${bookId}.json?ts=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  }

  function showToast(message) {
    els.toast.hidden = false;
    els.toast.textContent = message;
    requestAnimationFrame(() => els.toast.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove("show");
      setTimeout(() => {
        els.toast.hidden = true;
      }, 300);
    }, 2400);
  }

  function syncModalBodyClass() {
    const open = !els.summaryModal.hidden || !els.settingsModal.hidden;
    document.body.classList.toggle("modal-open", open);
    document.body.style.overflow = open ? "hidden" : "";
  }

  function openModal(which) {
    const modal = which === "summary" ? els.summaryModal : els.settingsModal;
    modal.hidden = false;
    syncModalBodyClass();
    if (which === "settings") {
      updateAddressBar();
    }
  }

  function closeModal(which) {
    const modal = which === "summary" ? els.summaryModal : els.settingsModal;
    modal.hidden = true;
    syncModalBodyClass();
  }

  function fillSummary(iso = toISODate()) {
    const { todaySpend, remaining, monthSpend } = getTotals(iso);
    const left = daysLeftInMonth(iso);
    const dailyPace = remaining / left;
    const name = state.name.trim();

    els.summaryTitle.textContent = name
      ? `${name}, here’s your day`
      : "How’s your day looking?";
    els.summaryDate.textContent = formatLongDate(iso);
    els.summarySpent.textContent = formatMoney(todaySpend);
    els.summaryRemaining.textContent = formatMoney(remaining);

    if (state.budget <= 0) {
      els.summaryNote.textContent = "Set a monthly budget to track what’s left.";
    } else if (remaining < 0) {
      els.summaryNote.textContent = `You’re ${formatMoney(Math.abs(remaining))} over budget this month. Ease up when you can.`;
    } else if (todaySpend === 0) {
      els.summaryNote.textContent = `No spend logged yet today. About ${formatMoney(dailyPace)} per remaining day keeps you on track.`;
    } else if (remaining / state.budget < 0.2) {
      els.summaryNote.textContent = `Budget is getting tight — roughly ${formatMoney(dailyPace)} left per day for the rest of the month.`;
    } else {
      els.summaryNote.textContent = `You’ve used ${formatMoney(monthSpend)} this month. About ${formatMoney(dailyPace)} per day keeps you inside budget.`;
    }
  }

  function showDailySummary({ force = false } = {}) {
    const today = toISODate();
    fillSummary(today);
    openModal("summary");
    if (!force) {
      state.lastSummaryDate = today;
      saveState({ quiet: true });
    }
  }

  function maybeShowDailyPopup() {
    const today = toISODate();
    if (state.lastSummaryDate !== today) {
      setTimeout(() => showDailySummary(), 450);
    }
  }

  function renderMeter() {
    const selectedSpend = sum(expensesForDate(viewDate));
    const { monthSpend, remaining, usedRatio } = getTotals(viewDate);
    const leftRatio = 1 - usedRatio;
    els.meterValue.style.strokeDasharray = String(RING);
    els.meterValue.style.strokeDashoffset = String(RING * usedRatio);
    els.meterRing.classList.toggle("is-warning", leftRatio < 0.35 && leftRatio >= 0.15);
    els.meterRing.classList.toggle("is-danger", leftRatio < 0.15 || remaining < 0);
    els.remainingAmount.textContent = formatMoney(remaining, false);
    els.remainingMeta.textContent = `of ${formatMoney(state.budget)}`;
    els.spentToday.textContent = formatMoney(selectedSpend, false);
    els.spentMonth.textContent = formatMoney(monthSpend, false);
    if (els.spentSelectedLabel) {
      els.spentSelectedLabel.textContent =
        viewDate === toISODate() ? "Spent today" : "Spent this day";
    }
  }

  function renderViewDateMeta() {
    if (!els.viewDateMeta) return;
    const selectedSpend = sum(expensesForDate(viewDate));
    const label =
      viewDate === toISODate()
        ? "Today"
        : viewDate === shiftISODate(toISODate(), -1)
          ? "Yesterday"
          : formatLongDate(viewDate);
    els.viewDateMeta.textContent = `${label} · ${formatMoney(selectedSpend)} spent`;
  }

  function renderToday() {
    const items = expensesForDate(viewDate);
    const isToday = viewDate === toISODate();
    if (els.todayTitle) {
      els.todayTitle.textContent = isToday
        ? "Today’s expenses"
        : `Expenses · ${formatShortDate(viewDate)}`;
    }
    els.todayCount.textContent = items.length
      ? `${items.length} entr${items.length === 1 ? "y" : "ies"}`
      : "No entries yet";

    if (!items.length) {
      els.todayList.innerHTML = `<li class="empty">${
        isToday
          ? "Add your first expense for today."
          : "No expenses logged on this day."
      }</li>`;
      return;
    }

    els.todayList.innerHTML = items
      .map(
        (e) => `
      <li class="expense-item">
        <span class="title">${escapeHtml(e.category)}${e.note ? ` · ${escapeHtml(e.note)}` : ""}</span>
        <span class="amount">${formatMoney(e.amount)}</span>
        <span class="meta">${formatTime(e.createdAt)}</span>
        <button type="button" class="delete" data-id="${e.id}">Remove</button>
      </li>`
      )
      .join("");
  }

  function renderHistory() {
    const ym = monthKey(viewDate);
    const byDay = new Map();
    for (const e of expensesForMonth(ym)) {
      byDay.set(e.date, (byDay.get(e.date) || 0) + Number(e.amount));
    }
    const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    if (!days.length) {
      els.historyList.innerHTML = `<li class="empty">Your month will fill in as you log spend.</li>`;
      return;
    }
    els.historyList.innerHTML = days
      .map(
        ([date, total]) => `
      <li class="history-item${date === viewDate ? " is-active" : ""}" data-date="${date}" role="button" tabindex="0">
        <span class="title">${escapeHtml(formatShortDate(date))}</span>
        <span class="amount">${formatMoney(total)}</span>
        <span class="meta">${
          date === toISODate() ? "Today" : date === viewDate ? "Selected" : "This month"
        }</span>
      </li>`
      )
      .join("");
  }

  function categoryColor(index) {
    const palette = [
      "#5EC4B5",
      "#E07A5F",
      "#E2B86A",
      "#7EB6FF",
      "#C084FC",
      "#86EFAC",
      "#F9A8D4",
    ];
    return palette[index % palette.length];
  }

  function renderDayChart() {
    if (!els.dayChart) return;
    const ym = monthKey(viewDate);
    const totalDays = daysInMonth(viewDate);
    const byDay = new Map();
    for (let day = 1; day <= totalDays; day += 1) {
      const iso = `${ym}-${String(day).padStart(2, "0")}`;
      byDay.set(iso, sum(expensesForDate(iso)));
    }
    const values = [...byDay.values()];
    const max = Math.max(...values, 0);
    const monthLabel = parseISODate(viewDate).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    if (els.dayChartLabel) els.dayChartLabel.textContent = monthLabel;
    if (els.chartsSub) {
      els.chartsSub.textContent = `Showing ${monthLabel}. Category chart uses ${formatShortDate(viewDate)}.`;
    }

    if (max <= 0) {
      els.dayChart.innerHTML = `<p class="chart-empty">No spending in this month yet.</p>`;
      return;
    }

    const width = 320;
    const height = 170;
    const padL = 8;
    const padR = 8;
    const padT = 12;
    const padB = 28;
    const chartW = width - padL - padR;
    const chartH = height - padT - padB;
    const gap = Math.max(1.5, chartW / totalDays / 4);
    const barW = Math.max(2, chartW / totalDays - gap);

    const bars = [...byDay.entries()]
      .map(([iso, amount], index) => {
        const h = amount <= 0 ? 0 : Math.max(3, (amount / max) * chartH);
        const x = padL + index * (barW + gap);
        const y = padT + chartH - h;
        const active = iso === viewDate;
        const label =
          index === 0 ||
          index === totalDays - 1 ||
          iso === viewDate ||
          (index + 1) % 5 === 0
            ? `<text x="${x + barW / 2}" y="${height - 8}" text-anchor="middle" fill="${
                active ? "#5EC4B5" : "#9bb0b6"
              }" font-size="9">${index + 1}</text>`
            : "";
        return `
          <rect class="day-bar" data-date="${iso}" x="${x}" y="${y}" width="${barW}" height="${h}"
            rx="2" fill="${active ? "#5EC4B5" : "rgba(94,196,181,0.35)"}" style="cursor:pointer"></rect>
          ${label}
        `;
      })
      .join("");

    els.dayChart.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="presentation">
        <line x1="${padL}" y1="${padT + chartH}" x2="${width - padR}" y2="${padT + chartH}"
          stroke="rgba(214,232,236,0.16)" />
        ${bars}
      </svg>
    `;
  }

  function renderCategoryChart() {
    if (!els.categoryChart) return;
    const items = expensesForDate(viewDate);
    if (els.categoryChartLabel) {
      els.categoryChartLabel.textContent =
        viewDate === toISODate() ? "Today" : formatShortDate(viewDate);
    }

    if (!items.length) {
      els.categoryChart.innerHTML = `<p class="chart-empty">No categories for this day.</p>`;
      return;
    }

    const byCat = new Map();
    for (const e of items) {
      byCat.set(e.category, (byCat.get(e.category) || 0) + Number(e.amount || 0));
    }
    const rows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    const max = Math.max(...rows.map(([, v]) => v), 0);
    const total = rows.reduce((acc, [, v]) => acc + v, 0);
    const width = 320;
    const rowH = 28;
    const height = Math.max(120, rows.length * rowH + 16);
    const padL = 78;
    const padR = 58;
    const barMax = width - padL - padR;

    const bars = rows
      .map(([category, amount], index) => {
        const y = 10 + index * rowH;
        const w = max > 0 ? Math.max(4, (amount / max) * barMax) : 0;
        const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
        return `
          <text x="0" y="${y + 12}" fill="#d8c4a4" font-size="11">${escapeHtml(category)}</text>
          <rect x="${padL}" y="${y}" width="${w}" height="16" rx="8" fill="${categoryColor(index)}"></rect>
          <text x="${padL + w + 8}" y="${y + 12}" fill="#eef5f4" font-size="11">${pct}%</text>
        `;
      })
      .join("");

    els.categoryChart.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="presentation">
        ${bars}
      </svg>
    `;
  }

  function renderCharts() {
    renderDayChart();
    renderCategoryChart();
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: TZ,
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderHeader() {
    const today = toISODate();
    els.headerDate.textContent = formatShortDate(today);
    els.monthLabel.textContent = parseISODate(today).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    els.heroSub.textContent = state.name.trim()
      ? `${state.name.trim()}, log today’s spend and watch what’s left.`
      : "Log today’s spend. Stay inside your budget.";
    els.currencyPrefix.textContent = state.currency;
    els.settingsCurrencyPrefix.textContent = state.currency;
  }

  function renderAll() {
    if (!viewDate) viewDate = toISODate();
    if (els.viewDateInput && els.viewDateInput.value !== viewDate) {
      els.viewDateInput.value = viewDate;
    }
    renderHeader();
    renderMeter();
    renderViewDateMeta();
    renderToday();
    renderCharts();
    renderHistory();
  }

  async function addExpense(payload) {
    state.expenses.push({
      id: uid(),
      amount: Number(payload.amount),
      category: payload.category,
      note: payload.note.trim(),
      date: payload.date,
      createdAt: Date.now(),
    });
    viewDate = payload.date || viewDate;
    await saveState();
    renderAll();
    showToast("Expense saved · link updated");
    if (payload.date === toISODate()) fillSummary();
  }

  async function removeExpense(id) {
    state.expenses = state.expenses.filter((e) => e.id !== id);
    await saveState();
    renderAll();
    showToast("Expense removed · link updated");
  }

  function openSettings() {
    els.budgetInput.value = String(state.budget);
    els.currencyInput.value = state.currency;
    els.nameInput.value = state.name;
    openModal("settings");
  }

  els.expenseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = Number(els.amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid amount");
      return;
    }
    addExpense({
      amount,
      category: els.categoryInput.value,
      note: els.noteInput.value,
      date: els.dateInput.value || viewDate || toISODate(),
    });
    els.expenseForm.reset();
    els.dateInput.value = viewDate || toISODate();
    els.categoryInput.value = "Other";
    els.amountInput.focus();
  });

  els.todayList.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-id]");
    if (!btn) return;
    removeExpense(btn.getAttribute("data-id"));
  });

  els.viewDateInput?.addEventListener("change", () => {
    if (!els.viewDateInput.value) return;
    setViewDate(els.viewDateInput.value);
  });

  els.prevDayBtn?.addEventListener("click", () => {
    setViewDate(shiftISODate(viewDate || toISODate(), -1));
  });

  els.nextDayBtn?.addEventListener("click", () => {
    setViewDate(shiftISODate(viewDate || toISODate(), 1));
  });

  els.jumpTodayBtn?.addEventListener("click", () => {
    setViewDate(toISODate());
  });

  els.dayChart?.addEventListener("click", (event) => {
    const bar = event.target.closest("[data-date]");
    if (!bar) return;
    setViewDate(bar.getAttribute("data-date"));
  });

  els.historyList.addEventListener("click", (event) => {
    const row = event.target.closest("[data-date]");
    if (!row) return;
    setViewDate(row.getAttribute("data-date"));
  });

  els.historyList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest("[data-date]");
    if (!row) return;
    event.preventDefault();
    setViewDate(row.getAttribute("data-date"));
  });

  els.settingsBtn.addEventListener("click", openSettings);
  els.showSummaryBtn.addEventListener("click", () => showDailySummary({ force: true }));
  els.copySyncBtn?.addEventListener("click", () => copySyncLink());
  els.bannerCopyBtn?.addEventListener("click", () => copySyncLink());

  els.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const budget = Number(els.budgetInput.value);
    if (!Number.isFinite(budget) || budget < 0) {
      showToast("Enter a valid budget");
      return;
    }
    const wasFirstSetup = !state.lastSummaryDate;
    state.budget = budget;
    state.currency = els.currencyInput.value;
    state.name = els.nameInput.value.trim();
    await saveState();
    closeModal("settings");
    renderAll();
    if (wasFirstSetup) {
      setTimeout(() => showDailySummary(), 280);
    } else {
      showToast("Saved · copy your link for other devices");
    }
  });

  document.querySelectorAll("[data-close]").forEach((node) => {
    node.addEventListener("click", () => closeModal(node.getAttribute("data-close")));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal("summary");
      closeModal("settings");
    }
  });

  async function boot() {
    document.documentElement.style.setProperty("--ring", String(RING));
    viewDate = toISODate();
    els.dateInput.value = viewDate;
    if (els.viewDateInput) els.viewDateInput.value = viewDate;

    const params = new URLSearchParams(location.search);
    const bookFromUrl = params.get("book") || "";
    const packed =
      params.get("d") ||
      (location.hash.startsWith("#d=") ? location.hash.slice(3) : "");
    const local = loadLocal();
    state = local;

    let restored = false;
    if (packed) {
      try {
        const payload = await decompressPayload(packed);
        if (payload) {
          applyPayload(payload, { force: true });
          restored = true;
        }
      } catch {
        // ignore bad packed payloads
      }
    }

    if (!restored && bookFromUrl) {
      state.bookId = bookFromUrl;
      try {
        const remote = await loadFromGithub(bookFromUrl);
        if (remote) {
          applyPayload(remote, { force: !local.updatedAt });
          restored = true;
        }
      } catch {
        // ignore offline / missing remote
      }
      if (!restored && local.bookId === bookFromUrl) {
        restored = true;
      }
    }

    ensureBookId();
    persistLocal();
    await updateAddressBar();
    renderAll();
    booting = false;

    const isFirstRun = !localStorage.getItem(STORAGE_KEY + ".initialized") && !restored;
    if (isFirstRun) {
      localStorage.setItem(STORAGE_KEY + ".initialized", "1");
      await saveState({ quiet: true });
      setTimeout(openSettings, 250);
    } else {
      maybeShowDailyPopup();
      if (restored && !local.updatedAt) {
        showToast("Loaded your Daybook from the link");
      }
    }
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  boot();
})();
