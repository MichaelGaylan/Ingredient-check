# Sourced search server

A small search service that holds Sourced's own copy of Open Food Facts, so Explore and the
alternatives aren't limited to Open Food Facts' 10 searches a minute.

- `import/build_db.py` turns the Open Food Facts data export into a slim database. It keeps only
  products with a name and an English ingredient list.
- `worker/` is a Cloudflare Worker that answers `GET /search?q=…&cat=…&store=…&country=…`, using
  Cloudflare's D1 database. Its answers have the same shape as Open Food Facts' own search.
- The app uses it as soon as `SOURCED_API` in `index.html` is set to the Worker's address. Until
  then nothing changes.

## Licence (must keep)

Open Food Facts data is under the **Open Database License (ODbL)**. To use it we must:

1. Credit Open Food Facts wherever the data is shown. The app already says "From Open Food Facts"
   under results, and the server sends the credit with every answer.
2. Keep our derived database open under the ODbL. Anyone who asks can have it, and the build
   script in this folder is the recipe for making it.

The app's own code is not affected.

## Setting it up (one time, about 30 minutes)

You need a free Cloudflare account and a computer with Node.js and Python 3.

1. **Create the account.** Sign up at https://dash.cloudflare.com/sign-up.
2. **Choose a plan size.** Free D1 databases hold up to 500 MB, which fits about the US and UK
   products. The **Workers Paid** plan (US$5 a month) holds up to 10 GB, which fits the whole
   English-language catalogue.
3. **Download the data:** https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz.
   It is large (several GB) and refreshed daily.
4. **Build the database.** For the free plan, keep the US and UK only:
   ```
   python3 server/import/build_db.py openfoodfacts-products.jsonl.gz sourced.sql --countries en:united-states,en:united-kingdom
   ```
5. **Create and load D1:**
   ```
   cd server/worker
   npx wrangler login
   npx wrangler d1 create sourced-search        # paste the database_id it prints into wrangler.toml
   npx wrangler d1 execute sourced-search --remote --file ../../sourced.sql
   npx wrangler deploy                           # prints the address, e.g. https://sourced-search.<you>.workers.dev
   ```
6. **Connect the app.** Tell Claude the address. It goes into `SOURCED_API` in `index.html`.

To refresh the data later, repeat steps 3, 4 and the `d1 execute` line. A monthly refresh is plenty.

## Testing locally

```
python3 server/import/build_db.py sample.jsonl.gz sample.sql --sqlite sample.db
```

`worker/src/index.js` exports `search(db, params)`, so it can be tested against the SQLite copy.
