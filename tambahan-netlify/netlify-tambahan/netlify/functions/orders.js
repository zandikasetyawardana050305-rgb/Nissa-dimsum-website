// Netlify Function: simpan & baca pesanan di Upstash Redis.
// Env: ADMIN_PASSWORD + (KV_REST_API_URL & KV_REST_API_TOKEN) atau (UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN)
const findEnv = s => { const k = Object.keys(process.env).find(k => k.endsWith(s)); return k ? process.env[k] : undefined; };
const URL_ = findEnv("REST_API_URL") || findEnv("REDIS_REST_URL");
const TOKEN = findEnv("REST_API_TOKEN") || findEnv("REDIS_REST_TOKEN");

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const clean = s => String(s || "").slice(0, 80);
const send = (statusCode, obj) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(obj)
});

exports.handler = async (event) => {
  if (!URL_ || !TOKEN) return send(500, { error: "Database belum dihubungkan (lihat panduan)." });
  const method = event.httpMethod;
  let b = {};
  try { b = event.body ? JSON.parse(event.body) : {}; } catch { return send(400, { error: "Data tidak valid." }); }
  const isAdmin = !!process.env.ADMIN_PASSWORD && event.headers["x-admin-password"] === process.env.ADMIN_PASSWORD;
  try {
    if (method === "POST") {
      const items = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
      if (!clean(b.nama) || !items.length) return send(400, { error: "Data pesanan tidak lengkap." });
      const order = {
        nama: clean(b.nama),
        pay: b.pay === "QRIS" ? "QRIS" : "Cash",
        status: "Baru",
        waktu: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
        items: items.map(i => ({ nama: clean(i.nama), harga: Math.max(0, +i.harga || 0), q: Math.min(99, Math.max(1, +i.q || 1)) }))
      };
      order.total = order.items.reduce((s, i) => s + i.harga * i.q, 0);
      order.no = await redis(["INCR", "order_seq"]);
      await redis(["HSET", "orders", String(order.no), JSON.stringify(order)]);
      return send(201, order);
    }
    if (!isAdmin) return send(401, { error: "Password admin salah." });
    if (method === "GET") {
      const list = (await redis(["HVALS", "orders"])).map(x => JSON.parse(x));
      return send(200, list.sort((a, c) => c.no - a.no));
    }
    if (method === "PATCH") {
      const no = String(b.no);
      const cur = await redis(["HGET", "orders", no]);
      if (!cur) return send(404, { error: "Pesanan tidak ditemukan." });
      const o = JSON.parse(cur); o.status = "Selesai";
      await redis(["HSET", "orders", no, JSON.stringify(o)]);
      return send(200, o);
    }
    if (method === "DELETE") { await redis(["DEL", "orders"]); return send(200, { ok: true }); }
    return send(405, { error: "Method tidak didukung." });
  } catch (e) {
    return send(500, { error: e.message });
  }
};
