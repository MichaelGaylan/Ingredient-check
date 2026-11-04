# Sourced: revision history

Major changes to the app, oldest first. Versions 1.0 to 1.3 were numbered afterwards; numbering inside the app started at 1.4. Each line lists the date and the git commit(s) it came from.

## 1.0 — 2 Nov 2026: first version
- Evidence-graded food scanner web app: barcode scan, 0–100 score, every ingredient claim linked to a checked source (peer-reviewed papers, EFSA, FDA, WHO, IARC). Grades: A Established, B Probable, C Possible, D Preliminary, Reassuring, Not yet reviewed. (`bcbabe6`)
- Read an ingredient list from a photo of the label (on-phone text recognition). No score is shown when there are no ingredients. (`77d0827`)
- USDA FoodData Central as a second product database after Open Food Facts. (`e709280`)
- Ingredient lists you type in are remembered for that barcode; SmartLabel and web search links for missing products. (`c5212fb`)
- New library entries for additives flagged by EWG, added only after their sources were verified. (`2eadf59`)

## 1.1 — 2 Nov 2026: automatic checks and nutrition
- Unreviewed ingredients are looked up in FDA, WHO/JECFA and IARC records (via PubChem). (`ec349c7`)
- That lookup runs automatically, and IARC cancer classifications count toward the score. (`7b49b0c`)
- The "Check ingredients" button is removed; lists are checked as soon as they're entered. (`fd755ba`)
- "No concerns found" rating when nothing derogatory is found. (`89fb253`)
- The "not reviewed" count opens a dropdown of those ingredients. (`9bab2cd`)
- Nutrition (sugar, salt, fat, saturated fat) counts toward the score using UK "high" thresholds; BHA added. (`98dba5b`)

## 1.2 — 2 Nov 2026: readability and settings
- Negative findings made prominent and coloured by evidence grade; EU/US regulatory restrictions in bold red. (`05b3f87`, `f50e9ef`, `39cac32`)
- Dark mode toggle in the header. (`aa27bc7`)
- Settings: appearance (automatic/light/dark) and product-text language, with automatic translation of foreign labels. (`7c15c87`)

## 1.3 — 3 Nov 2026: allergens, history and installable app
- Each not-yet-reviewed ingredient links to a web search. (`5cc139d`)
- Look up button turns green while a barcode is typed. (`5858244`, `ca13d3d`)
- Camera icon on the "Read label from photo" buttons. (`ebbef98`)
- Allergen warnings: "My allergens" in Settings (14 US/EU allergens), red banner for yours, allergen words highlighted. Allergens never change the score. (`f9901b5`)
- "OK for me" per product, and a Lactose (intolerance) choice that skips lactose-free products. (`755c876`)
- History tab with favourites, delete and clear all; "What a scan can't tell you" section; better-scoring alternatives for low scores; "Add it to Open Food Facts" link. (`93dba53`)
- USDA API key field in Settings, to avoid the shared demo limit. (`23356fd`)
- Fixed the × delete button in History on touch screens. (`7e8e6d8`)
- "Keep in my allergens" from a product, then "Keep as allergen" per product with Undo, a darker red kept state, and fewer buttons once kept. (`4681495`, `54a3548`, `76259c7`, `383b619`)
- Installable on the Home Screen: app icon, full-screen mode, works offline. (`597a3b3`)

## 1.4 — 4 Nov 2026: simpler controls
- One button: "Scan barcode" becomes a dark "Look up barcode" when a number is typed. (`0ce68cd`)
- Label photo moved to a camera icon inside the ingredient box; Help and About sections in Settings with version number. (`56bfb92`, `0339567`)

## 1.5 – 1.8 — 4 Nov 2026: findings layout
- 1.5: Findings shown as folder tabs, most serious first (Established → Probable → Possible → Preliminary → Reassuring → Not yet reviewed). (`a10dabd`)
- 1.6: Findings collapsed by default; opening one closes the others. (`6cf182f`)
- 1.7: Collapsed findings are exactly three lines tall. (`f8804b9`)
- 1.8: Bigger, bolder expand arrow. (`e2d5f99`)

## 1.9 – 2.3 — 4 Nov 2026: verdict colour and allergen box
- 1.9: Allergen box offers lactose alongside milk, plus "Remove … from my allergens". (`e0724e4`)
- 2.0: Product name takes the colour of the most serious ingredient. (`b1a0242`)
- 2.1: Score ring and verdict match that colour; an Established finding means at least "Several concerns", Probable at least "Some concerns". (`a57f76c`)
- 2.2: "+ Add … to my allergens" wording; pastel red box right after adding. (`f806a78`)
- 2.3: Add buttons moved below the allergen box. (`b27e677`)

## Planned before public release
- Small server to hold the USDA key and translation service, with caching.
- Privacy policy page; app store packaging (Google Play first, then Apple).
