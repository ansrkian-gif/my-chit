(() => {
  "use strict";

  const STORAGE_KEY = "daybook.v1";
  const RING = 2 * Math.PI * 52;
  const TZ = "Asia/Kuwait";

  const defaultState = () => ({
    budget: 300,
    currency: "KWD",
    name: "",
    expenses: [],
    lastSummaryDate: "",
  });

  const els = {
    headerDate: document.getElementById("headerDate"),
    monthLabel: document.getElementById("monthLabel"),
    heroSub: document.getElementById("heroSub"),
    remainingAmount: document.getElementById("remainingAmount"),
    remainingMeta: document.getElementById("remainingMeta"),
    spentToday: document.getElementById("spentToday"),
    spentMonth: document.getElementById("spentMonth"),
    meterRing: document.getElementById("meterRing"),
    meterValue: document.getElementById("meterValue"),
    expenseForm: document.getElementById("expenseForm"),
    amountInput: document.getElementById("amountInput"),
    categoryInput: document.getElementById("categoryInput"),
    noteInput: document.getElementById("noteInput"),
    dateInput: document.getElementById("dateInput"),
    todayList: document.getElementById("todayList"),
    todayCount: document.getElementById("todayCount"),
    historyList: document.getElementById("historyList"),
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
    toast: document.getElementById("toast"),
  };

  let state = loadState();
  let toastTimer = null;

  function loadState() {
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

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function nowInTz(date = new Date()) {
    return new Date(date.toLocaleString("en-US", { timeZone: TZ }));
  }

  function toISODate(date = new Date()) {
    const d = nowInTz(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseISODate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
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
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
    }, 2200);
  }

  function openModal(which) {
    const modal = which === "summary" ? els.summaryModal : els.settingsModal;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal(which) {
    const modal = which === "summary" ? els.summaryModal : els.settingsModal;
    modal.hidden = true;
    if (els.summaryModal.hidden && els.settingsModal.hidden) {
      document.body.style.overflow = "";
    }
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
      saveState();
    }
  }

  function maybeShowDailyPopup() {
    const today = toISODate();
    if (state.lastSummaryDate !== today) {
      // Slight delay so the first paint feels settled on mobile.
      setTimeout(() => showDailySummary(), 450);
    }
  }

  function renderMeter() {
    const { todaySpend, monthSpend, remaining, usedRatio } = getTotals();
    const leftRatio = 1 - usedRatio;
    els.meterValue.style.strokeDasharray = String(RING);
    els.meterValue.style.strokeDashoffset = String(RING * usedRatio);
    els.meterRing.classList.toggle("is-warning", leftRatio < 0.35 && leftRatio >= 0.15);
    els.meterRing.classList.toggle("is-danger", leftRatio < 0.15 || remaining < 0);
    els.remainingAmount.textContent = formatMoney(remaining, false);
    els.remainingMeta.textContent = `of ${formatMoney(state.budget)}`;
    els.spentToday.textContent = formatMoney(todaySpend, false);
    els.spentMonth.textContent = formatMoney(monthSpend, false);
  }

  function renderToday() {
    const today = toISODate();
    const items = expensesForDate(today);
    els.todayCount.textContent = items.length
      ? `${items.length} entr${items.length === 1 ? "y" : "ies"}`
      : "No entries yet";

    if (!items.length) {
      els.todayList.innerHTML = `<li class="empty">Add your first expense for today.</li>`;
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
    const ym = monthKey();
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
      <li class="history-item">
        <span class="title">${escapeHtml(formatShortDate(date))}</span>
        <span class="amount">${formatMoney(total)}</span>
        <span class="meta">${date === toISODate() ? "Today" : "This month"}</span>
      </li>`
      )
      .join("");
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
    renderHeader();
    renderMeter();
    renderToday();
    renderHistory();
  }

  function addExpense(payload) {
    state.expenses.push({
      id: uid(),
      amount: Number(payload.amount),
      category: payload.category,
      note: payload.note.trim(),
      date: payload.date,
      createdAt: Date.now(),
    });
    saveState();
    renderAll();
    showToast("Expense saved");
    if (payload.date === toISODate()) {
      fillSummary();
    }
  }

  function removeExpense(id) {
    state.expenses = state.expenses.filter((e) => e.id !== id);
    saveState();
    renderAll();
    showToast("Expense removed");
  }

  function openSettings() {
    els.budgetInput.value = String(state.budget);
    els.currencyInput.value = state.currency;
    els.nameInput.value = state.name;
    openModal("settings");
  }

  // Events
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
      date: els.dateInput.value || toISODate(),
    });
    els.expenseForm.reset();
    els.dateInput.value = toISODate();
    els.categoryInput.value = "Other";
    els.amountInput.focus();
  });

  els.todayList.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-id]");
    if (!btn) return;
    removeExpense(btn.getAttribute("data-id"));
  });

  els.settingsBtn.addEventListener("click", openSettings);
  els.showSummaryBtn.addEventListener("click", () => showDailySummary({ force: true }));

  els.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const budget = Number(els.budgetInput.value);
    if (!Number.isFinite(budget) || budget < 0) {
      showToast("Enter a valid budget");
      return;
    }
    state.budget = budget;
    state.currency = els.currencyInput.value;
    state.name = els.nameInput.value.trim();
    saveState();
    closeModal("settings");
    renderAll();
    showToast("Budget updated");
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

  // Boot
  document.documentElement.style.setProperty("--ring", String(RING));
  els.dateInput.value = toISODate();
  renderAll();

  const isFirstRun = !localStorage.getItem(STORAGE_KEY + ".initialized");
  if (isFirstRun) {
    localStorage.setItem(STORAGE_KEY + ".initialized", "1");
    saveState();
    setTimeout(openSettings, 200);
    setTimeout(() => showDailySummary(), 700);
  } else {
    maybeShowDailyPopup();
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
