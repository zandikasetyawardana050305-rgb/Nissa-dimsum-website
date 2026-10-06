// Serverless function Vercel: simpan & baca pesanan di Upstash Redis.
// Env yang dibutuhkan: KV_REST_API_URL + KV_REST_API_TOKEN (atau UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN), ADMIN_PASSWORD
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

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

const isAdmin = req => !!process.env.ADMIN_PASSWORD && req.headers["x-admin-password"] === process.env.ADMIN_PASSWORD;
const clean = s => String(s || "").slice(0, 80);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_ || !TOKEN) return res.status(500).json({ error: "Database belum dihubungkan (lihat README)." });
  try {
    if (req.method === "POST") {              // pelanggan membuat pesanan (publik)
      const b = req.body || {};
      const items = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
      if (!clean(b.nama) || !items.length) return res.status(400).json({ error: "Data pesanan tidak lengkap." });
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
      return res.status(201).json(order);
    }
    if (!isAdmin(req)) return res.status(401).json({ error: "Password admin salah." });
    if (req.method === "GET") {
      const list = (await redis(["HVALS", "orders"])).map(x => JSON.parse(x));
      return res.status(200).json(list.sort((a, b) => b.no - a.no));
    }
    if (req.method === "PATCH") {
      const no = String((req.body || {}).no);
      const cur = await redis(["HGET", "orders", no]);
      if (!cur) return res.status(404).json({ error: "Pesanan tidak ditemukan." });
      const o = JSON.parse(cur); o.status = "Selesai";
      await redis(["HSET", "orders", no, JSON.stringify(o)]);
      return res.status(200).json(o);
    }
    if (req.method === "DELETE") {
      await redis(["DEL", "orders"]);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Method tidak didukung." });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
