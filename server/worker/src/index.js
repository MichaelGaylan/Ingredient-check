/* Sourced search API (Cloudflare Worker + D1).
   GET /search?q=tortillas&cat=en:flatbreads&store=walmart&country=en:united-states&page=1
   Answers in the same shape as Open Food Facts' search ({products:[...]}) so the app can use either.
   Data: Open Food Facts (https://world.openfoodfacts.org), Open Database License. */

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS" };
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

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    if (url.pathname === "/") return json({ name: "Sourced search", attribution: ATTR, licence: "https://opendatacommons.org/licenses/odbl/1-0/" });
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
