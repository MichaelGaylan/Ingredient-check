/* Sourced search API (Cloudflare Worker + D1).
   GET /search?q=tortillas&cat=en:flatbreads&store=walmart&country=en:united-states&page=1
   Answers in the same shape as Open Food Facts' search ({products:[...]}) so the app can use either.
   Data: Open Food Facts (https://world.openfoodfacts.org), Open Database License. */

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS" };
const ATTR = "Product data from Open Food Facts (https://world.openfoodfacts.org), available under the Open Database License (ODbL).";
const PAGE = 40;

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "x-data-attribution": ATTR, ...CORS, ...extra } });

// Turn free text into a safe FTS5 query: each word as a quoted prefix term, all required.
export function ftsQuery(q) {
  const words = String(q || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) || [];
  return words.slice(0, 8).map(w => `"${w}"*`).join(" ");
}
const tagOk = t => /^[a-z]{2}:[a-z0-9-]+$|^[a-z0-9-]+$/.test(t || "");

export async function search(db, params) {
  const q = ftsQuery(params.get("q")), cat = params.get("cat"), store = params.get("store"), country = params.get("country");
  const page = Math.max(1, Math.min(20, parseInt(params.get("page") || "1", 10) || 1));
  const where = [], binds = [];
  if (cat && tagOk(cat)) { where.push("p.categories LIKE ?"); binds.push(`% ${cat} %`); }
  if (store && tagOk(store)) { where.push("p.stores LIKE ?"); binds.push(`% ${store} %`); }
  if (country && tagOk(country)) { where.push("p.countries LIKE ?"); binds.push(`% ${country} %`); }
  let sql;
  if (q) {
    sql = `SELECT p.* FROM products_fts f JOIN products p ON p.rowid = f.rowid WHERE products_fts MATCH ?${where.length ? " AND " + where.join(" AND ") : ""}
           ORDER BY p.scans DESC, f.rank LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`;
    binds.unshift(q);
  } else if (where.length) {
    sql = `SELECT p.* FROM products p WHERE ${where.join(" AND ")} ORDER BY p.scans DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`;
  } else {
    return { products: [], error: "Give q, cat, store or country." };
  }
  const { results } = await db.prepare(sql).bind(...binds).all();
  const split = s => (s || "").trim().split(/\s+/).filter(Boolean);
  return { products: results.map(r => {
    const n = JSON.parse(r.nutr || "{}");
    return { code: r.code, product_name: r.name, brands: r.brands, lang: "en", ingredients_text_en: r.ingredients,
      image_front_small_url: r.img, categories_tags: split(r.categories), stores_tags: split(r.stores), countries_tags: split(r.countries),
      allergens_tags: split(r.allergens), traces_tags: split(r.traces), additives_tags: split(r.additives), nutriments: n, unique_scans_n: r.scans };
  }), page, attribution: ATTR };
}

/* POST /photo  (multipart form: code, image)
   A user's front-of-pack photo for a product that has none. Forwarded to Open Food Facts under Sourced's own
   Open Food Facts account (secrets OFF_USER and OFF_PASS, never sent to phones). Photos on Open Food Facts are
   public under CC BY-SA. Limits: JPEG/PNG/WebP under 6 MB, 20 uploads per phone (IP) a day, 500 a day in total. */
const PHOTO_MAX = 6 * 1024 * 1024, PER_IP_DAY = 20, ALL_DAY = 500;
export async function photo(req, env, fetchImpl = fetch) {
  if (!env.OFF_USER || !env.OFF_PASS) return json({ error: "Photo sharing isn't set up yet." }, 503);
  let form;
  try { form = await req.formData(); } catch (_) { return json({ error: "Send a form with code and image." }, 400); }
  const code = String(form.get("code") || "").replace(/\D/g, ""), img = form.get("image");
  if (code.length < 8 || code.length > 14) return json({ error: "Bad barcode." }, 400);
  if (!img || typeof img === "string" || !/^image\/(jpeg|png|webp)$/.test(img.type) || img.size > PHOTO_MAX || img.size < 2000) return json({ error: "Send a JPEG, PNG or WebP photo under 6 MB." }, 400);
  // Simple daily limits kept in D1.
  const ip = req.headers.get("cf-connecting-ip") || "unknown", day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS photo_log(day TEXT, ip TEXT, code TEXT)").run();
  const mine = await env.DB.prepare("SELECT COUNT(*) AS n FROM photo_log WHERE day = ? AND ip = ?").bind(day, ip).first();
  const all = await env.DB.prepare("SELECT COUNT(*) AS n FROM photo_log WHERE day = ?").bind(day).first();
  if ((mine?.n || 0) >= PER_IP_DAY || (all?.n || 0) >= ALL_DAY) return json({ error: "Too many photos today. Please try again tomorrow." }, 429);
  const up = new FormData();
  up.set("code", code); up.set("imagefield", "front_en"); up.set("imgupload_front_en", img, `front_${code}.jpg`);
  up.set("user_id", env.OFF_USER); up.set("password", env.OFF_PASS);
  const r = await fetchImpl("https://world.openfoodfacts.org/cgi/product_image_upload.pl", { method: "POST", body: up, headers: { "user-agent": "Sourced/1.0 (food scanner app; photos added by Sourced users)" } });
  let j = {}; try { j = await r.json(); } catch (_) {}
  if (!r.ok || (j.status && !/^status ok$/i.test(j.status))) return json({ error: "Open Food Facts didn't accept the photo.", detail: j.error || j.status || r.status }, 502);
  await env.DB.prepare("INSERT INTO photo_log(day, ip, code) VALUES (?, ?, ?)").bind(day, ip, code).run();
  return json({ ok: true, code, imgid: j.image?.imgid || null });
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    if (url.pathname === "/") return json({ name: "Sourced search", attribution: ATTR, licence: "https://opendatacommons.org/licenses/odbl/1-0/", photos: !!(env.OFF_USER && env.OFF_PASS) });
    if (url.pathname === "/photo"){
      if (req.method !== "POST") return json({ error: "POST a photo" }, 405);
      try { return await photo(req, env); } catch (e) { return json({ error: "photo upload failed" }, 500); }
    }
    if (url.pathname !== "/search") return json({ error: "not found" }, 404);
    // Results change only when the database is rebuilt, so let Cloudflare's edge cache answer repeats.
    const cache = caches.default, hit = await cache.match(req);
    if (hit) return hit;
    try {
      const res = json(await search(env.DB, url.searchParams), 200, { "cache-control": "public, max-age=86400" });
      await cache.put(req, res.clone());
      return res;
    } catch (e) {
      return json({ error: "search failed" }, 500);
    }
  }
};
