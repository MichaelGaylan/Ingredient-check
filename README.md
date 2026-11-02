# Sourced

A food ingredient checker where every finding is graded by the strength of the evidence behind it and linked to a checked source (EFSA, WHO, IARC, peer-reviewed journals).

- Scan a barcode with the phone camera, type the barcode number, or paste an ingredient list.
- Product data comes from [Open Food Facts](https://world.openfoodfacts.org).
- Grades: A Established, B Probable, C Possible, D Preliminary, plus Reassuring and Not yet reviewed. See the Method tab in the app.

The whole app is one file, `index.html`, served with GitHub Pages. The evidence library lives in the `CITES` and `ENTRIES` objects near the top of its script.

Sourced gives general information from published science. It is not medical advice.
