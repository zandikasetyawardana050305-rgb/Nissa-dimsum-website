const $ = id => document.getElementById(id);
const rp = n => "Rp" + n.toLocaleString("id-ID");
const esc = t => { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; };
const KEY = "nissa_orders";
let qty = {};

document.title = TOKO.nama;
$("namaToko").textContent =  TOKO.nama + " – " + TOKO.lokasi;
$("tagline").textContent = TOKO.tagline;
$("qrisImg").src = TOKO.qris;

const loadLocal = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const saveLocal = o => localStorage.setItem(KEY, JSON.stringify(o));
// Panggil API Vercel. Jika tidak tersedia (mis. file dibuka langsung), kembalikan null -> mode lokal.
async function api(method, body, admin) {
  try {
    const h = { "Content-Type": "application/json" };
    if (admin) h["x-admin-password"] = sessionStorage.getItem("adminpw") || "";
    const r = await fetch("/api/orders", { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("json")) return null;
    return { status: r.status, data: await r.json() };
  } catch { return null; }
}

function show(v) {
  ["menuView","checkoutView","resultView","ordersView"].forEach(x => $(x).classList.toggle("hide", x !== v));
  $("tMenu").classList.toggle("on", v !== "ordersView");
  $("tOrd").classList.toggle("on", v === "ordersView");
  if (v === "ordersView") renderOrders();
  scrollTo(0, 0);
}
const items = () => MENU.filter(m => qty[m.id] > 0).map(m => ({ ...m, q: qty[m.id] }));
const total = () => items().reduce((s, i) => s + i.harga * i.q, 0);
const lines = () => items().map(i => `<div class="row"><span>${esc(i.nama)} ×${i.q}</span><span>${rp(i.harga * i.q)}</span></div>`).join("") + `<div class="row total"><span>Total</span><span>${rp(total())}</span></div>`;

function renderMenu() {
  $("grid").innerHTML = MENU.map(m => `<div class="card"><img src="${m.gambar}" alt="${esc(m.nama)}"><div class="info"><b>${esc(m.nama)}</b><small>${esc(m.deskripsi || "")}</small><span class="price">${rp(m.harga)}</span><div class="qty"><button data-a="-" data-id="${m.id}">−</button><span id="q${m.id}">${qty[m.id] || 0}</span><button data-a="+" data-id="${m.id}">+</button></div></div></div>`).join("");
}
function renderCart() {
  const t = total();
  $("cart").innerHTML = t ? lines() : "Belum ada pesanan.";
  $("checkoutBtn").disabled = !t;
}
function drawOrders(orders) {
  $("ordList").innerHTML = orders.length ? orders.slice().sort((a, b) => b.no - a.no).map(o => `<div class="ord"><h3><span>Pesanan #${o.no} — ${esc(o.nama)}</span><span class="badge ${o.status === "Selesai" ? "done" : ""}">${o.status}</span></h3><div class="note">${esc(o.waktu)} • ${o.pay === "Cash" ? "💵 Cash" : "📱 QRIS"}</div>${o.items.map(i => `<div class="row"><span>${esc(i.nama)} ×${i.q}</span><span>${rp(i.harga * i.q)}</span></div>`).join("")}<div class="row total"><span>Total</span><span>${rp(o.total)}</span></div>${o.status === "Selesai" ? "" : `<button class="btn sm" data-done="${o.no}">Tandai selesai</button>`}</div>`).join("") : "Belum ada pesanan.";
}
let online = false;
async function renderOrders() {
  if (!sessionStorage.getItem("adminpw")) {
    const pw = prompt("Password admin:");
    if (pw) sessionStorage.setItem("adminpw", pw);
  }
  const r = await api("GET", null, true);
  if (r && r.status === 200) { online = true; $("modeNote").textContent = "Terhubung ke database (semua pesanan pelanggan)."; drawOrders(r.data); return; }
  if (r && r.status === 401) { sessionStorage.removeItem("adminpw"); $("ordList").textContent = "Password admin salah. Klik 'Muat ulang' untuk coba lagi."; return; }
  if (r && r.status >= 400) { $("ordList").textContent = r.data.error || "Terjadi kesalahan."; return; }
  online = false; $("modeNote").textContent = "Mode lokal: pesanan hanya tersimpan di browser ini.";
  drawOrders(loadLocal());
}

$("grid").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const id = +b.dataset.id;
  qty[id] = Math.max(0, (qty[id] || 0) + (b.dataset.a === "+" ? 1 : -1));
  $("q" + id).textContent = qty[id]; renderCart();
});
$("checkoutBtn").onclick = () => { $("summary").innerHTML = lines(); $("qrisTotal").textContent = rp(total()); show("checkoutView"); };
$("backBtn").onclick = () => show("menuView");
document.querySelectorAll("input[name=pay]").forEach(r => r.onchange = () => $("qrisBox").classList.toggle("hide", r.value !== "QRIS" || !r.checked));

$("payBtn").onclick = async () => {
  const nama = $("nama").value.trim();
  if (!nama) { alert("Isi nama pembeli dulu ya."); $("nama").focus(); return; }
  $("payBtn").disabled = true;
  const pay = document.querySelector("input[name=pay]:checked").value;
  const payload = { nama, pay, items: items().map(i => ({ nama: i.nama, harga: i.harga, q: i.q })) };
  let order, r = await api("POST", payload, false);
  if (r && r.status === 201) order = r.data;
  else if (r && r.status >= 400) { alert(r.data.error || "Gagal mengirim pesanan."); $("payBtn").disabled = false; return; }
  else {                                     // mode lokal (tanpa server)
    const list = loadLocal();
    order = { ...payload, no: list.reduce((m, o) => Math.max(m, o.no), 0) + 1, status: "Baru", waktu: new Date().toLocaleString("id-ID"), total: total() };
    list.push(order); saveLocal(list);
  }
  $("receipt").innerHTML = `<div class="row"><span>No. Pesanan</span><b>#${order.no}</b></div><div class="row"><span>Pembeli</span><b>${esc(nama)}</b></div><div class="row"><span>Waktu</span><span>${order.waktu}</span></div><hr>${lines()}<div class="row"><span>Pembayaran</span><b>${pay === "Cash" ? "💵 Cash (bayar di kasir)" : "📱 QRIS"}</b></div><p class="note center">${pay === "Cash" ? "Silakan siapkan uang tunai saat pesanan diambil." : "Terima kasih! Tunjukkan bukti bayar QRIS ke penjual."}</p>`;
  $("payBtn").disabled = false;
  show("resultView");
};
$("newBtn").onclick = () => { qty = {}; $("nama").value = ""; renderMenu(); renderCart(); show("menuView"); };
$("tMenu").onclick = () => show("menuView");
$("tOrd").onclick = () => show("ordersView");
$("ordList").addEventListener("click", async e => {
  const n = e.target.dataset.done; if (!n) return;
  if (online) await api("PATCH", { no: +n }, true);
  else { const l = loadLocal(); l.find(o => o.no == n).status = "Selesai"; saveLocal(l); }
  renderOrders();
});
$("refreshBtn").onclick = renderOrders;
$("resetBtn").onclick = async () => {
  if (!confirm("Hapus SEMUA pesanan?")) return;
  if (online) await api("DELETE", null, true); else saveLocal([]);
  renderOrders();
};

renderMenu(); renderCart();
