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
2. **Choose a plan size.** The free plan fits the most-scanned US and UK products (about 12,000 to 20,000). The **Workers Paid** plan (US$5 a month) holds up to 10 GB, which fits the whole
   English-language catalogue.
3. **Download the data:** https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz.
   It is large (several GB) and refreshed daily.
4. **Build the database.** On the free plan, keep the most-scanned US and UK products. D1's free plan
   allows 100,000 writes a day, and each product takes about 4, so stay under about 20,000:
   ```
   python3 server/import/build_db.py openfoodfacts-products.jsonl.gz sourced.sql --countries en:united-states,en:united-kingdom --top 12000
   ```
   On Workers Paid, leave out `--top` to load everything.
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

## Photo sharing (optional)

Users can add a photo to a product that has none. The Worker passes it to Open Food Facts under
Sourced's own Open Food Facts account, so the account password never reaches a phone. Photos on Open
Food Facts are public under CC BY-SA, and the app asks each user once before their first share.

1. Create the account at https://world.openfoodfacts.org/cgi/user.pl (for example the user name
   `sourced-app`), using an email address you check.
2. Give the Worker the account details as secrets. Type them only into the terminal, never into a chat:
   ```
   cd server/worker
   npx wrangler secret put OFF_USER     # the user name
   npx wrangler secret put OFF_PASS     # the password
   npx wrangler deploy
   ```
3. Check https://sourced-search.<you>.workers.dev/ shows `"photos": true`. The app's "Add a photo"
   button appears as soon as it does.

Limits: 20 photos per phone a day and 500 a day in total, JPEG/PNG/WebP under 6 MB.
