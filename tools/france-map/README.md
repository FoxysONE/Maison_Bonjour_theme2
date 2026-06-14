# Générateur de la carte « La France »

`sections/france-carte.liquid` est **généré** — ne pas éditer ses `<path>` à la main.

## Régénérer
```
node tools/france-map/build.js
```

- `dep.geojson` : contours simplifiés des départements français (france-geojson, domaine public).
- `build.js` : regroupe les départements en 13 zones culturelles Maison Bonjour, projette en SVG, et écrit `sections/france-carte.liquid` (géométrie + contenu éditorial + CSS + JS).
- Pour changer les regroupements, les textes ou les photos : éditer les objets `ZONES` / `DATA` en haut de `build.js`, puis relancer.

Le dossier `tools/` n'est pas poussé par Shopify CLI (hors répertoires de thème reconnus).
