const COLORS = {Food:"#f97316",Travel:"#0ea5e9",Shopping:"#ec4899",Bills:"#eab308",Education:"#6366f1",
  Health:"#10b981",Entertainment:"#a855f7",Rent:"#ef4444",Other:"#64748b"};
const colorOf = c => COLORS[c] || "#14b8a6";
const $ = s => document.querySelector(s);
const inr = n => "₹" + Number(n).toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today = () => new Date().toISOString().slice(0, 10);

let meta = {categories: [], payments: []};
let expenses = [];
let debounce;

/* ---------- API ---------- */
async function api(path, options = {}) {
  const res = await fetch("/api" + path, {headers: {"Content-Type": "application/json"}, ...options});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function toast(msg, type = "") {
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ---------- Load + render ---------- */
async function load() {
  const month = $("#month").value;
  const params = new URLSearchParams({month, category: $("#filterCat").value, q: $("#search").value.trim()});
  try {
    const [list, summary] = await Promise.all([api("/expenses?" + params), api("/summary?month=" + month)]);
    expenses = list;
    renderTable();
    renderSummary(summary);
  } catch (e) { toast(e.message, "err"); }
  $("#exportBtn").href = "/api/export.csv?month=" + month;
}

function renderTable() {
  $("#empty").hidden = expenses.length > 0;
  $("#rows").innerHTML = expenses.map(e => `
    <tr>
      <td>${esc(e.date)}</td>
      <td>${esc(e.description) || '<span class="muted">—</span>'}</td>
      <td><span class="chip" style="background:${colorOf(e.category)}22;color:${colorOf(e.category)}">${esc(e.category)}</span></td>
      <td>${esc(e.payment)}</td>
      <td class="num">${inr(e.amount)}</td>
      <td class="num">
        <button class="icon-btn" title="Edit" data-edit="${e.id}">✏️</button>
        <button class="icon-btn" title="Delete" data-del="${e.id}">🗑️</button>
      </td>
    </tr>`).join("");
}

function renderSummary(s) {
  $("#sTotal").textContent = inr(s.total);
  $("#sCount").textContent = s.count;
  $("#sAvg").textContent = inr(s.avg_per_day);
  const top = s.by_category[0];
  $("#sTop").textContent = top ? top.category : "—";
  $("#sTopAmt").textContent = top ? inr(top.total) : "";

  const delta = $("#sDelta");
  if (s.prev_total > 0) {
    const pct = ((s.total - s.prev_total) / s.prev_total) * 100;
    delta.className = pct > 0 ? "up" : "down";
    delta.textContent = `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}% vs last month`;
  } else { delta.className = ""; delta.textContent = "vs last month: no data"; }

  // donut (CSS conic-gradient)
  let acc = 0;
  const stops = s.by_category.map(c => {
    const start = acc; acc += (c.total / s.total) * 100;
    return `${colorOf(c.category)} ${start}% ${acc}%`;
  });
  $("#donut").style.background = stops.length ? `conic-gradient(${stops.join(",")})` : "var(--line)";
  $("#donutTotal").textContent = inr(s.total).replace(/\.00$/, "");
  $("#legend").innerHTML = s.by_category.length ? s.by_category.map(c => `
    <li><span><i class="dot" style="background:${colorOf(c.category)}"></i>${esc(c.category)}</span>
    <b>${((c.total / s.total) * 100).toFixed(0)}%</b></li>`).join("")
    : '<li class="muted">No data this month</li>';

  // trend bars
  const max = Math.max(...s.trend.map(t => t.total), 1);
  $("#trend").innerHTML = s.trend.map(t => `
    <div class="bar ${t.month === s.month ? "current" : ""}">
      <b>${t.total ? "₹" + Math.round(t.total).toLocaleString("en-IN") : ""}</b>
      <div class="fill" style="height:${(t.total / max) * 75}%"></div>
      <span>${new Date(t.month + "-01").toLocaleString("en", {month: "short"})}</span>
    </div>`).join("");

  // budgets
  $("#budgets").innerHTML = s.budgets.length ? s.budgets.map(b => {
    const pct = (b.spent / b.limit) * 100;
    const cls = pct > 100 ? "over" : pct >= 80 ? "warn" : "";
    return `<div class="budget">
      <div class="budget-top"><span><b>${esc(b.category)}</b> ${inr(b.spent)} / ${inr(b.limit)}</span>
      <span>${pct.toFixed(0)}% <button title="Remove" data-delbudget="${esc(b.category)}">✕</button></span></div>
      <div class="progress"><i class="${cls}" style="width:${Math.min(pct, 100)}%"></i></div></div>`;
  }).join("") : '<p class="muted">No budgets yet. Set one to get over-spending alerts.</p>';
}

/* ---------- Expense modal ---------- */
function openExpense(e) {
  $("#modalTitle").textContent = e ? "Edit Expense" : "Add Expense";
  $("#fId").value = e ? e.id : "";
  $("#fAmount").value = e ? e.amount : "";
  $("#fDate").value = e ? e.date : today();
  $("#fCategory").value = e ? e.category : "Food";
  $("#fPayment").value = e ? e.payment : "UPI";
  $("#fDesc").value = e ? e.description : "";
  $("#expenseModal").showModal();
  $("#fAmount").focus();
}

$("#expenseForm").addEventListener("submit", async ev => {
  ev.preventDefault();
  const id = $("#fId").value;
  const body = JSON.stringify({amount: $("#fAmount").value, date: $("#fDate").value,
    category: $("#fCategory").value, payment: $("#fPayment").value, description: $("#fDesc").value});
  try {
    await api(id ? "/expenses/" + id : "/expenses", {method: id ? "PUT" : "POST", body});
    $("#expenseModal").close();
    toast(id ? "Expense updated ✓" : "Expense added ✓");
    await load();
    await budgetAlert($("#fCategory").value, $("#fDate").value.slice(0, 7));
  } catch (e) { toast(e.message, "err"); }
});

async function budgetAlert(category, month) {
  const s = await api("/summary?month=" + month);
  const b = s.budgets.find(x => x.category === category);
  if (!b) return;
  const pct = (b.spent / b.limit) * 100;
  if (pct > 100) toast(`⚠ Over budget! ${category}: ${inr(b.spent)} / ${inr(b.limit)}`, "warn");
  else if (pct >= 80) toast(`Careful: ${category} used ${pct.toFixed(0)}% of budget`, "warn");
}

/* ---------- Events ---------- */
$("#addBtn").onclick = () => openExpense(null);
$("#budgetBtn").onclick = () => $("#budgetModal").showModal();
document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => b.closest("dialog").close());

$("#rows").addEventListener("click", async ev => {
  const edit = ev.target.closest("[data-edit]"), del = ev.target.closest("[data-del]");
  if (edit) openExpense(expenses.find(e => e.id == edit.dataset.edit));
  if (del && confirm("Delete this expense?")) {
    try { await api("/expenses/" + del.dataset.del, {method: "DELETE"}); toast("Expense deleted"); load(); }
    catch (e) { toast(e.message, "err"); }
  }
});

$("#budgetForm").addEventListener("submit", async ev => {
  ev.preventDefault();
  try {
    await api("/budgets", {method: "POST", body: JSON.stringify({category: $("#bCategory").value, limit: $("#bLimit").value})});
    $("#budgetModal").close(); $("#bLimit").value = ""; toast("Budget saved ✓"); load();
  } catch (e) { toast(e.message, "err"); }
});

$("#budgets").addEventListener("click", async ev => {
  const b = ev.target.closest("[data-delbudget]");
  if (b) { await api("/budgets/" + encodeURIComponent(b.dataset.delbudget), {method: "DELETE"}); load(); }
});

$("#month").onchange = load;
$("#filterCat").onchange = load;
$("#search").oninput = () => { clearTimeout(debounce); debounce = setTimeout(load, 250); };

$("#themeBtn").onclick = () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $("#themeBtn").textContent = dark ? "☀️" : "🌙";
  try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (_) {}
};

/* ---------- Init ---------- */
(async function init() {
  try { if (localStorage.getItem("theme") === "dark") { document.documentElement.dataset.theme = "dark"; $("#themeBtn").textContent = "☀️"; } } catch (_) {}
  meta = await api("/meta");
  const opts = meta.categories.map(c => `<option>${c}</option>`).join("");
  $("#fCategory").innerHTML = opts;
  $("#bCategory").innerHTML = opts;
  $("#filterCat").innerHTML = "<option>All</option>" + opts;
  $("#fPayment").innerHTML = meta.payments.map(p => `<option>${p}</option>`).join("");
  $("#month").value = today().slice(0, 7);
  load();
})();
