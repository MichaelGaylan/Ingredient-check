#!/usr/bin/env python3
"""Build Sourced's search database from the Open Food Facts data export.

Reads the full Open Food Facts JSONL export (openfoodfacts-products.jsonl.gz), keeps only products
that have a name and an English ingredient list, and writes a slim SQLite file with a full-text index.
The same file is then loaded into Cloudflare D1 (see ../README.md).

Open Food Facts data is under the Open Database License (ODbL). Sourced must credit Open Food Facts,
and this derived database must stay available under the ODbL (see ../README.md, "Licence").

Usage:
  python3 build_db.py openfoodfacts-products.jsonl.gz sourced.sql [--countries en:united-states,en:united-kingdom]
Writes a SQL file (schema + inserts) for `wrangler d1 execute sourced-search --remote --file sourced.sql`.
Add --sqlite sourced.db to also write a local SQLite copy for testing.
"""
import gzip, json, sqlite3, sys, argparse

FIELDS_TAGS = ("categories_tags", "stores_tags", "countries_tags", "allergens_tags", "traces_tags", "additives_tags")
NUTR = ("sugars_100g", "salt_100g", "fat_100g", "saturated-fat_100g")

SCHEMA = """
CREATE TABLE IF NOT EXISTS products(
  code TEXT PRIMARY KEY, name TEXT, brands TEXT, ingredients TEXT, img TEXT, scans INTEGER,
  categories TEXT, stores TEXT, countries TEXT, allergens TEXT, traces TEXT, additives TEXT, nutr TEXT);
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(name, brands, categories);
CREATE INDEX IF NOT EXISTS idx_scans ON products(scans DESC);
"""

def english_ingredients(p):
    t = (p.get("ingredients_text_en") or "").strip()
    if not t and p.get("lang") == "en":
        t = (p.get("ingredients_text") or "").strip()
    return t

def tags(p, k):
    v = p.get(k) or []
    return " " + " ".join(v) + " " if v else ""   # space-wrapped so LIKE '% en:cheeses %' matches whole tags

def rows(path, countries):
    seen = set()   # the export occasionally repeats a barcode
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                p = json.loads(line)
            except ValueError:
                continue
            code, name, ing = str(p.get("code") or "").strip(), (p.get("product_name_en") or p.get("product_name") or "").strip(), english_ingredients(p)
            if not code or not name or not ing or code in seen:
                continue
            if countries and not set(p.get("countries_tags") or []) & countries:
                continue
            seen.add(code)
            n = p.get("nutriments") or {}
            nutr = {k: n[k] for k in NUTR if isinstance(n.get(k), (int, float))}
            yield (code, name[:200], (p.get("brands") or "")[:120], ing[:4000], p.get("image_front_small_url") or "",
                   int(p.get("unique_scans_n") or 0), *(tags(p, k) for k in FIELDS_TAGS), json.dumps(nutr, separators=(",", ":")))

def q(v):
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dump"); ap.add_argument("out", help="SQL file to write")
    ap.add_argument("--sqlite", default="", help="also write a local SQLite database (for testing)")
    ap.add_argument("--countries", default="", help="comma-separated countries_tags to keep (default: all)")
    a = ap.parse_args()
    countries = {c.strip() for c in a.countries.split(",") if c.strip()}
    db = sqlite3.connect(a.sqlite) if a.sqlite else None
    if db: db.executescript(SCHEMA)
    n = 0
    with open(a.out, "w", encoding="utf-8") as out:
        out.write("DROP TABLE IF EXISTS products_fts;\nDROP TABLE IF EXISTS products;\n" + SCHEMA.strip() + "\n")
        for r in rows(a.dump, countries):
            n += 1
            out.write(f"INSERT INTO products(rowid,code,name,brands,ingredients,img,scans,categories,stores,countries,allergens,traces,additives,nutr) VALUES ({n},{','.join(q(v) for v in r)});\n")
            out.write(f"INSERT INTO products_fts(rowid,name,brands,categories) VALUES ({n},{q(r[1])},{q(r[2])},{q(r[6].replace('en:', '').replace('-', ' '))});\n")
            if db:
                db.execute("INSERT INTO products(rowid,code,name,brands,ingredients,img,scans,categories,stores,countries,allergens,traces,additives,nutr) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (n, *r))
                db.execute("INSERT INTO products_fts(rowid,name,brands,categories) VALUES (?,?,?,?)", (n, r[1], r[2], r[6].replace("en:", "").replace("-", " ")))
            if n % 5000 == 0:
                print(f"\r{n:,} products", end="", file=sys.stderr)
    if db: db.commit()
    print(f"\n{n:,} products written to {a.out}", file=sys.stderr)

if __name__ == "__main__":
    main()
