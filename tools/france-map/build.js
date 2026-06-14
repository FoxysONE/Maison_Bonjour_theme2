/* Generates sections/france-carte.liquid from real département geometry.
   Departments are grouped into Maison Bonjour's 13 cultural zones, projected
   to an SVG viewBox, and each zone becomes a clip-path so a region photo can be
   revealed INSIDE its exact contour on hover. Heavy path data stays in the file
   (never streamed back to the model). */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const geo = JSON.parse(fs.readFileSync(path.join(__dirname, 'dep.geojson'), 'utf8'));

// slug -> department codes (mainland + Corsica). Cultural zones, no overlap.
const ZONES = {
  'bretagne':         ['22','29','35','56'],
  'provence':         ['13','84','04','05'],
  'cote-d-azur':      ['06','83'],
  'perigord':         ['24'],
  'bourgogne':        ['21','71','89','58'],
  'alsace':           ['67','68'],
  'normandie':        ['14','27','50','61','76'],
  'pays-basque':      ['64'],
  'corse':            ['2A','2B'],
  'val-de-loire':     ['37','41','45','18','36','28'],
  'auvergne':         ['03','15','43','63'],
  'champagne':        ['51','10','52','08'],
};

// Editorial content per zone (order = display order).
const DATA = {
  'provence':         { name:'Provence',        img:'paysage-region-provence-01.jpeg',    state:'confirmed', status:'Édition confirmée', month:'Août 2026',      phrase:'Une lumière chaude, des ateliers anciens, la lavande qui reste sur les mains.', d:['Lavande','Céramique','Calissons d’Aix'] },
  'bretagne':         { name:'Bretagne',        img:'paysage-region-bretagne-01.jpeg',    state:'planned',   status:'Planifiée',        month:'Juillet 2026',   phrase:'Le granit, le lin, le sel dans l’air. Une France plus minérale, plus silencieuse.', d:['Sel','Lin naturel','Granit clair'] },
  'cote-d-azur':      { name:'Côte d’Azur',     img:'paysage-region-cote-d-azur-01.jpeg', state:'soon',      status:'À venir',          month:'Une prochaine escale Maison Bonjour.',      phrase:'La lumière franche du sud, les agrumes, les gestes simples d’un été français.', d:['Agrumes','Soleil','Rituel d’été'] },
  'bourgogne':        { name:'Bourgogne',       img:'paysage-region-bourgogne-01.jpeg',   state:'planned',   status:'Planifiée',        month:'Septembre 2026', phrase:'Une région profonde, gourmande, patiente. Ici, le temps travaille avec les mains.', d:['Moutarde','Vigne','Tradition'] },
  'perigord':         { name:'Périgord',        img:'paysage-region-perigord-02.jpeg',    state:'soon',      status:'À venir',          month:'Une prochaine escale Maison Bonjour.',   phrase:'Des pierres dorées, des tables généreuses, une France de maison et de marché.', d:['Noix','Truffe','Marché'] },
  'alsace':           { name:'Alsace',          img:'paysage-region-alsace-02.jpeg',      state:'soon',      status:'À venir',          month:'Une prochaine escale Maison Bonjour.', phrase:'Entre deux langues, une seule identité.', d:['Riesling','Colombages','Vosges'] },
  'normandie':        { name:'Normandie',       img:'paysage-region-normandie-01.jpeg',   state:'soon',      status:'À venir',          month:'Une prochaine escale Maison Bonjour.', phrase:'Sous le ciel bas, la terre donne tout ce qu’elle a.', d:['Pommeraies','Falaises de craie','Bocage'] },
  'pays-basque':      { name:'Pays Basque',     img:'paysage-region-pays-basque-01.jpeg', state:'soon',      status:'À venir',          month:'Une prochaine escale Maison Bonjour.', phrase:'Une langue avant les frontières. Une cuisine avant les écoles.', d:['Piment d’Espelette','Euskara','Côte basque'] },
  'corse':            { name:'Corse',           img:'paysage-region-corse-01.jpeg',       state:'soon',      status:'À venir',          month:'Une prochaine escale Maison Bonjour.', phrase:'L’île arrive dans les narines avant d’apparaître à l’horizon.', d:['Maquis','Châtaignier','Granit'] },
  'val-de-loire':     { name:'Val de Loire',    img:'paysage-region-val-de-loire-01.jpeg',state:'soon',      status:'À venir',          month:'Une prochaine escale Maison Bonjour.', phrase:'Entre châteaux et vignes, la France a posé son idéal de beauté.', d:['Tuffeau','Châteaux royaux','Vouvray'] },
  'auvergne':         { name:'Auvergne',        img:'paysage-region-auvergne-01.jpeg',    state:'soon',      status:'À venir',          month:'Une prochaine escale Maison Bonjour.', phrase:'Les volcans sont éteints. L’intensité, non.', d:['Volcans','Lentilles du Puy','Fromages d’altitude'] },
  'champagne':        { name:'Champagne',       img:'paysage-region-champagne-01.jpeg',   state:'soon',      status:'À venir',          month:'Une prochaine escale Maison Bonjour.', phrase:'La craie garde tout. La bulle révèle tout.', d:['Craie','Vignes de Marne','Cathédrale de Reims'] },
};

const ORDER = Object.keys(DATA);
const codeToZone = {};
for (const [slug, codes] of Object.entries(ZONES)) for (const c of codes) codeToZone[c] = slug;

// Metropolitan only (drop overseas 97x/98x).
const feats = geo.features.filter(f => !/^9[78]/.test(f.properties.code));

// Bounding box across metropolitan France.
let lonMin=180, lonMax=-180, latMin=90, latMax=-90;
function scanRing(r){ for(const [x,y] of r){ if(x<lonMin)lonMin=x; if(x>lonMax)lonMax=x; if(y<latMin)latMin=y; if(y>latMax)latMax=y; } }
function eachRing(geom, fn){
  if(geom.type==='Polygon') geom.coordinates.forEach(fn);
  else if(geom.type==='MultiPolygon') geom.coordinates.forEach(poly=>poly.forEach(fn));
}
feats.forEach(f=>eachRing(f.geometry, scanRing));

const W = 1000;
const latMid = (latMin+latMax)/2;
const k = Math.cos(latMid*Math.PI/180);
const scale = W / ((lonMax-lonMin)*k);
const H = Math.round((latMax-latMin)*scale);
const px = lon => Math.round((lon-lonMin)*k*scale);
const py = lat => Math.round((latMax-lat)*scale);

// Integer coords + thinning: drop points within THIN px of the last kept one.
const THIN = 1.4;
function ringToPath(r){
  var pts = [];
  var lastX=null, lastY=null;
  for(let i=0;i<r.length;i++){
    var x=px(r[i][0]), y=py(r[i][1]);
    if(lastX!==null && i!==r.length-1){
      var dx=x-lastX, dy=y-lastY;
      if(dx*dx+dy*dy < THIN*THIN) continue; // too close — skip
    }
    pts.push([x,y]); lastX=x; lastY=y;
  }
  if(pts.length<3) { // keep tiny islands intact
    pts = r.map(p=>[px(p[0]),py(p[1])]);
  }
  let s='';
  for(let i=0;i<pts.length;i++){ s += (i===0?'M':'L') + pts[i][0] + ' ' + pts[i][1]; }
  return s+'Z';
}
function geomToPath(geom){
  let s='';
  eachRing(geom, r => { s += ringToPath(r); });
  return s;
}

// ---- Full partition : every metropolitan department belongs to a zone -------
// Pour que SURVOLER N'IMPORTE OÙ sur la carte révèle une région (et que les
// photos s'affichent plus grandes / plus proprement), on n'a plus de « fond
// inerte » : chaque département non-graine est rattaché à la zone culturelle la
// plus proche (par centroïde). La Corse n'absorbe jamais le continent.
function centroidOf(geom){ let sx=0, sy=0, n=0; eachRing(geom, r=>{ for(const [x,y] of r){ sx+=x; sy+=y; n++; } }); return [sx/n, sy/n]; }
const featByCode = {}; feats.forEach(f=>featByCode[f.properties.code]=f);
const seedCentroid = {};
for(const [slug, codes] of Object.entries(ZONES)){
  let sx=0, sy=0, n=0;
  codes.forEach(c=>{ if(featByCode[c]){ const [cx,cy]=centroidOf(featByCode[c].geometry); sx+=cx; sy+=cy; n++; } });
  seedCentroid[slug] = [sx/n, sy/n];
}
const assign = {};
feats.forEach(f=>{
  const code = f.properties.code;
  if(codeToZone[code]){ assign[code] = codeToZone[code]; return; }
  const [cx,cy] = centroidOf(f.geometry);
  let best=null, bd=Infinity;
  for(const slug of Object.keys(ZONES)){
    if(slug === 'corse') continue;               // jamais le continent dans la Corse
    const [sx,sy] = seedCentroid[slug];
    const dx=(cx-sx)*k, dy=cy-sy;                 // k : correction est-ouest
    const d = dx*dx + dy*dy;
    if(d < bd){ bd=d; best=slug; }
  }
  assign[code] = best;
});

// Build combined path per zone (full coverage, no inert base).
const zonePaths = {};
let basePath = '';
feats.forEach(f=>{
  const z = assign[f.properties.code];
  const d = geomToPath(f.geometry);
  if(z){ zonePaths[z] = (zonePaths[z]||'') + d; }
  else { basePath += d; }
});

// ---- Assemble SVG markup ----
// La géométrie de chaque zone n'est écrite QU'UNE FOIS, dans <defs>, sous forme
// de <path id="fcPath-slug">. Le clip-path, le remplissage et le contour la
// réutilisent via <use> : on évite ainsi de tripler les données de tracé (ce qui
// faisait dépasser la limite Shopify de 256 Ko par fichier).
const defs = ORDER.map(slug =>
  `        <path id="fcPath-${slug}" d="${zonePaths[slug]}"/>\n` +
  `        <clipPath id="fcClip-${slug}"><use href="#fcPath-${slug}" xlink:href="#fcPath-${slug}"/></clipPath>`
).join('\n');

const zonesSvg = ORDER.map(slug=>{
  const z = DATA[slug];
  // Textes injectés via clés de traduction (rendu serveur par Liquid `| t`, puis
  // lus par le JS). FR + RO vivent dans locales/*.json sous map.regions.<slug>.*
  const key     = `map.regions.${slug}`;
  const tName   = `{{ '${key}.name' | t }}`;
  const tStatus = `{{ '${key}.status' | t }}`;
  const tMonth  = `{{ '${key}.month' | t }}`;
  const tPhrase = `{{ '${key}.phrase' | t }}`;
  const tKeys   = `{{ '${key}.keywords' | t }}`;
  const aria = z.state!=='soon'
    ? `${tName} — ${tStatus} · ${tMonth}`
    : `${tName} — ${tStatus}`;
  return `        <g class="fc-zone" data-region="${slug}" data-state="${z.state}"
           data-name="${tName}" data-status="${tStatus}" data-month="${tMonth}"
           data-phrase="${tPhrase}" data-keywords="${tKeys}"
           role="button" tabindex="0" aria-label="${aria}">
          <use class="fc-zone__fill" href="#fcPath-${slug}" xlink:href="#fcPath-${slug}"/>
          <image class="fc-zone__img" clip-path="url(#fcClip-${slug})" preserveAspectRatio="xMidYMid slice"
                 x="0" y="0" width="${W}" height="${H}"
                 href="{{ '${z.img}' | asset_url }}" xlink:href="{{ '${z.img}' | asset_url }}"></image>
          <use class="fc-zone__line" href="#fcPath-${slug}" xlink:href="#fcPath-${slug}"/>
        </g>`;
}).join('\n');

// Mobile/complementary list (sober rows).
const listItems = ORDER.map(slug=>{
  const z = DATA[slug];
  const key = `map.regions.${slug}`;
  const sub = z.state==='soon'
    ? `{{ 'map.soon' | t }}`
    : `{{ '${key}.status' | t }} · {{ '${key}.month' | t }}`;
  return `      <li><button type="button" class="fc-list__row" data-jump="${slug}" data-state="${z.state}">
        <span class="fc-list__name">{{ '${key}.name' | t }}</span>
        <span class="fc-list__sub">${sub}</span>
      </button></li>`;
}).join('\n');

const liquid = `{%- comment -%}
  ============================================================================
  LA FRANCE — carte interactive éditoriale « Les escales Maison Bonjour »
  ----------------------------------------------------------------------------
  Section inline (pas une modale). Géométrie : vrais contours des départements
  français (france-geojson, domaine public) regroupés en 13 zones culturelles
  Maison Bonjour, projetés en viewBox ${W}×${H}.

  Effet principal : au survol/tap d'une zone, une photo d'ambiance se révèle
  À L'INTÉRIEUR du contour exact de la région (clip-path), les autres zones
  s'estompent, le panneau éditorial de droite se met à jour.

  ⚠️ FICHIER GÉNÉRÉ par tools/france-map/build.js — ne pas éditer les <path> à la main.
     Pour changer les contours/regroupements : modifier build.js puis relancer.
     Le contenu éditorial (textes/photos) est aussi défini dans build.js.
  ============================================================================
{%- endcomment -%}

<section class="fc section" data-france-carte aria-labelledby="fcHeading">
  <div class="fc__intro">
    <p class="fc__eyebrow">{{ section.settings.eyebrow }}</p>
    <h2 class="fc__title" id="fcHeading">{{ section.settings.title }}</h2>
    {%- if section.settings.lede != blank -%}<p class="fc__lede">{{ section.settings.lede }}</p>{%- endif -%}
  </div>

  <div class="fc__grid">
    <div class="fc__stage">
      <svg class="fc-svg" viewBox="0 0 ${W} ${H}" role="group" aria-label="Carte des escales Maison Bonjour" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs>
${defs}
        </defs>
        <path class="fc-base" d="${basePath}" aria-hidden="true"/>
        <g class="fc-zones">
${zonesSvg}
        </g>
      </svg>
    </div>

    <aside class="fc__panel" data-fc-panel aria-live="polite">
      <div class="fc__panel-rest" data-fc-rest>
        <p class="fc__rest-title">{{ section.settings.rest_title }}</p>
        <p class="fc__rest-body">{{ section.settings.rest_body }}</p>
      </div>
      <div class="fc__panel-active" data-fc-active hidden>
        <p class="fc__label">{{ 'map.region_label' | t }}</p>
        <h3 class="fc__name" data-fc-name></h3>
        <p class="fc__status" data-fc-status></p>
        <span class="fc__rule" aria-hidden="true"></span>
        <p class="fc__phrase" data-fc-phrase></p>
        <ul class="fc__details" data-fc-details role="list"></ul>
      </div>
    </aside>
  </div>

  <ol class="fc-list" aria-label="Les escales par région">
${listItems}
  </ol>
</section>

{% stylesheet %}
  .fc {
    background: #F5F0E8;
    color: var(--marine, #1C2B4A);
    padding: clamp(64px, 9vh, 130px) clamp(20px, 5vw, 80px);
  }

  .fc__intro {
    max-width: 760px;
    margin: 0 auto clamp(40px, 6vh, 80px);
    text-align: center;
  }
  .fc__eyebrow {
    margin: 0 0 18px;
    font-family: var(--font-sans, sans-serif);
    font-size: 10px; font-weight: 600;
    letter-spacing: 0.34em; text-transform: uppercase;
    color: var(--gold, #B8965A);
  }
  .fc__title {
    margin: 0;
    font-family: var(--font-serif, serif);
    font-style: italic; font-weight: 400;
    font-size: clamp(2rem, 1.6vw + 1.5rem, 3.4rem);
    line-height: 1.08; letter-spacing: -0.01em;
    color: var(--marine, #1C2B4A);
  }
  .fc__lede {
    margin: 20px auto 0; max-width: 56ch;
    font-family: var(--font-sans, sans-serif);
    font-weight: 300; font-size: 15px; line-height: 1.75;
    color: #5A4E3A;
  }

  .fc__grid {
    max-width: 1200px; margin: 0 auto;
    display: grid; grid-template-columns: 1fr;
    gap: clamp(32px, 5vw, 72px); align-items: center;
  }
  @media (min-width: 900px) {
    .fc__grid { grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.9fr); }
  }

  .fc__stage { position: relative; }
  .fc-svg { width: 100%; height: auto; display: block; overflow: visible; }

  /* Reste de la France : silhouette calme en arrière-plan. */
  .fc-base { fill: rgba(28, 43, 74, 0.05); stroke: rgba(28, 43, 74, 0.10); stroke-width: 0.6; vector-effect: non-scaling-stroke; }

  /* Zones racontées — toute la carte est partitionnée en régions : survoler
     n'importe où révèle une région. */
  .fc-zone { cursor: pointer; transition: opacity 0.55s var(--ease-out, cubic-bezier(0.22,1,0.36,1)); }
  .fc-zone__fill { fill: rgba(28, 43, 74, 0.10); transition: fill 0.55s ease; }
  .fc-zone__line {
    fill: none;
    stroke: rgba(28, 43, 74, 0.14); stroke-width: 0.8; vector-effect: non-scaling-stroke;
    opacity: 1; transition: opacity 0.45s ease;
  }
  .fc-zone__img { opacity: 0; transition: opacity 0.7s var(--ease-out, cubic-bezier(0.22,1,0.36,1)); }

  /* États au repos : « racontées » un peu plus présentes que « à venir ». */
  .fc-zone[data-state="soon"] .fc-zone__fill { fill: rgba(28, 43, 74, 0.06); }
  .fc-zone[data-state="confirmed"] .fc-zone__fill,
  .fc-zone[data-state="planned"]   .fc-zone__fill { fill: rgba(28, 43, 74, 0.13); }

  /* Survol : les autres s'estompent (composition par soustraction). */
  .fc-svg:hover .fc-zone:not(:hover) { opacity: 0.4; }
  .fc-zone:hover, .fc-zone.is-active { opacity: 1 !important; }

  /* Révélation : la photo remplit toute la région, contours internes effacés
     pour un rendu net et propre. La séparation vient de l'estompage des voisines. */
  .fc-zone:hover .fc-zone__img,
  .fc-zone.is-active .fc-zone__img { opacity: 1; }
  .fc-zone:hover .fc-zone__fill,
  .fc-zone.is-active .fc-zone__fill { fill: rgba(28, 43, 74, 0); }
  .fc-zone:hover .fc-zone__line,
  .fc-zone.is-active .fc-zone__line { opacity: 0; }

  .fc-zone:focus { outline: none; }
  .fc-zone:focus-visible .fc-zone__line { opacity: 1; stroke: var(--gold, #B8965A); stroke-width: 1.4; }
  .fc-zone:focus-visible { outline: none; }

  /* ---- Panneau éditorial (pas de card : texte intégré) ---- */
  .fc__panel { align-self: center; }
  .fc__panel-rest, .fc__panel-active { animation: fcFade 0.6s var(--ease-out, ease) both; }
  @keyframes fcFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  .fc__rest-title {
    margin: 0 0 16px;
    font-family: var(--font-serif, serif); font-style: italic;
    font-size: clamp(1.4rem, 1vw + 1rem, 1.9rem); line-height: 1.2;
    color: var(--marine, #1C2B4A);
  }
  .fc__rest-body {
    margin: 0; max-width: 42ch;
    font-family: var(--font-sans, sans-serif); font-weight: 300;
    font-size: 14.5px; line-height: 1.75; color: #5A4E3A;
  }

  .fc__label {
    margin: 0 0 14px;
    font-family: var(--font-sans, sans-serif);
    font-size: 10px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase;
    color: var(--gold, #B8965A);
  }
  .fc__name {
    margin: 0;
    font-family: "TAN Pearl", var(--font-serif, serif); font-weight: 700;
    font-size: clamp(2.1rem, 2.4vw, 3rem); line-height: 1; letter-spacing: -0.01em;
    color: var(--marine, #1C2B4A);
  }
  .fc__status {
    margin: 14px 0 0;
    font-family: var(--font-sans, sans-serif);
    font-size: 11px; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase;
    color: #5A4E3A;
  }
  .fc__panel-active[data-state="soon"] .fc__status { text-transform: none; letter-spacing: 0.02em; font-style: italic; font-weight: 300; opacity: 0.8; }
  .fc__rule { display: block; width: 44px; height: 1px; margin: 22px 0; background: var(--gold, #B8965A); opacity: 0.6; }
  .fc__phrase {
    margin: 0;
    font-family: var(--font-serif, serif); font-style: italic;
    font-size: clamp(1.2rem, 0.8vw + 0.9rem, 1.5rem); line-height: 1.34;
    color: var(--marine, #1C2B4A);
  }
  .fc__details {
    margin: 22px 0 0; padding: 0; list-style: none;
    display: flex; flex-wrap: wrap; gap: 8px 14px;
    font-family: var(--font-sans, sans-serif);
    font-size: 11px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--gold, #B8965A);
  }
  .fc__details li { position: relative; }
  .fc__details li + li::before { content: "·"; position: absolute; left: -9px; color: rgba(28,43,74,0.3); }

  /* ---- Liste complémentaire (mobile surtout) ---- */
  .fc-list {
    max-width: 1200px; margin: clamp(36px, 5vh, 56px) auto 0; padding: 0; list-style: none;
    border-top: 1px solid rgba(28, 43, 74, 0.12);
  }
  .fc-list__row {
    width: 100%; display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
    padding: 16px 4px; background: none; border: 0; border-bottom: 1px solid rgba(28, 43, 74, 0.10);
    cursor: pointer; text-align: left; color: inherit;
    transition: padding-left 0.35s var(--ease-out, ease), color 0.3s ease;
  }
  .fc-list__row:hover, .fc-list__row:focus-visible { padding-left: 12px; outline: none; }
  .fc-list__row:hover .fc-list__name { color: var(--gold, #B8965A); }
  .fc-list__name { font-family: var(--font-serif, serif); font-size: 1.15rem; color: var(--marine, #1C2B4A); }
  .fc-list__sub {
    font-family: var(--font-sans, sans-serif); font-size: 10px; font-weight: 500;
    letter-spacing: 0.18em; text-transform: uppercase; color: #5A4E3A; white-space: nowrap;
  }
  .fc-list__row[data-state="soon"] .fc-list__sub { text-transform: none; letter-spacing: 0.02em; font-style: italic; opacity: 0.7; }
  .fc-list__row[data-state="confirmed"] .fc-list__sub { color: var(--gold, #B8965A); }

  /* La liste fait double emploi avec la carte sur grand écran : on la garde mais
     discrète ; sur mobile elle devient le mode d'interaction principal. */
  @media (min-width: 900px) {
    .fc-list { columns: 2; column-gap: 56px; }
    .fc-list li { break-inside: avoid; }
  }

  @media (prefers-reduced-motion: reduce) {
    .fc-zone, .fc-zone__img, .fc-zone__fill, .fc-zone__line,
    .fc__panel-rest, .fc__panel-active, .fc-list__row { transition: none; animation: none; }
  }
{% endstylesheet %}

{% javascript %}
  (function () {
    var root = document.querySelector('[data-france-carte]');
    if (!root) return;
    var zones = root.querySelectorAll('.fc-zone');
    var rows  = root.querySelectorAll('[data-jump]');
    var rest  = root.querySelector('[data-fc-rest]');
    var act   = root.querySelector('[data-fc-active]');
    var elName = root.querySelector('[data-fc-name]');
    var elStat = root.querySelector('[data-fc-status]');
    var elPhr  = root.querySelector('[data-fc-phrase]');
    var elDet  = root.querySelector('[data-fc-details]');
    var activeSlug = null;

    function showRest() {
      if (rest) rest.hidden = false;
      if (act) act.hidden = true;
    }
    function fill(g) {
      var soon = g.getAttribute('data-state') === 'soon';
      elName.textContent = g.getAttribute('data-name');
      elStat.textContent = soon
        ? g.getAttribute('data-month')
        : g.getAttribute('data-status') + ' · ' + g.getAttribute('data-month');
      elPhr.textContent = g.getAttribute('data-phrase');
      elDet.innerHTML = '';
      (g.getAttribute('data-keywords') || '').split(' · ').forEach(function (v) {
        v = v.trim(); if (!v) return;
        var li = document.createElement('li'); li.textContent = v; elDet.appendChild(li);
      });
      act.setAttribute('data-state', g.getAttribute('data-state'));
      if (rest) rest.hidden = true;
      act.hidden = false;
    }
    function setActive(slug) {
      activeSlug = slug;
      zones.forEach(function (z) { z.classList.toggle('is-active', z.getAttribute('data-region') === slug); });
      var g = root.querySelector('.fc-zone[data-region="' + slug + '"]');
      if (g) fill(g);
    }

    zones.forEach(function (g) {
      g.addEventListener('mouseenter', function () { fill(g); });
      g.addEventListener('mouseleave', function () {
        if (activeSlug) setActive(activeSlug); else showRest();
      });
      g.addEventListener('focus', function () { fill(g); });
      g.addEventListener('blur', function () {
        if (activeSlug) setActive(activeSlug); else showRest();
      });
      g.addEventListener('click', function () { setActive(g.getAttribute('data-region')); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); setActive(g.getAttribute('data-region')); }
      });
    });

    rows.forEach(function (b) {
      b.addEventListener('click', function () {
        var slug = b.getAttribute('data-jump');
        setActive(slug);
        if (window.matchMedia('(max-width: 899px)').matches && act) {
          act.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });

    showRest();
  })();
{% endjavascript %}

{% schema %}
{
  "name": "La France — Carte",
  "settings": [
    { "type": "text",     "id": "eyebrow",   "label": "Sur-titre",   "default": "Les escales" },
    { "type": "text",     "id": "title",     "label": "Titre",       "default": "La France, par fragments." },
    { "type": "textarea", "id": "lede",      "label": "Introduction","default": "Chaque région raconte une manière de vivre. Maison Bonjour les approche lentement, par les gestes, les maisons, les ateliers et les saveurs." },
    { "type": "text",     "id": "rest_title","label": "Panneau — titre au repos", "default": "Chaque mois commence quelque part." },
    { "type": "textarea", "id": "rest_body", "label": "Panneau — texte au repos", "default": "Une région, un geste, une lumière. Maison Bonjour raconte la France par ses maisons, ses ateliers et ses saveurs." }
  ],
  "presets": [{ "name": "La France — Carte" }]
}
{% endschema %}
`;

fs.writeFileSync(path.join(ROOT, 'sections', 'france-carte.liquid'), liquid, 'utf8');

// Zone + panel CSS shared by the modal snippet (raw <style>). Mirrors the
// inline section's {% stylesheet %} rules for .fc-* so the map looks identical.
const SHARED_ZONE_CSS = `  .fc-base { fill: rgba(28, 43, 74, 0.05); stroke: rgba(28, 43, 74, 0.10); stroke-width: 0.6; vector-effect: non-scaling-stroke; }
  .fc-zone { cursor: pointer; transition: opacity 0.55s var(--ease-out, cubic-bezier(0.22,1,0.36,1)); }
  .fc-zone__fill { fill: rgba(28, 43, 74, 0.10); transition: fill 0.55s ease; }
  .fc-zone__line { fill: none; stroke: rgba(28, 43, 74, 0.14); stroke-width: 0.8; vector-effect: non-scaling-stroke; opacity: 1; transition: opacity 0.45s ease; }
  .fc-zone__img { opacity: 0; transition: opacity 0.7s var(--ease-out, cubic-bezier(0.22,1,0.36,1)); }
  .fc-zone[data-state="soon"] .fc-zone__fill { fill: rgba(28, 43, 74, 0.06); }
  .fc-zone[data-state="confirmed"] .fc-zone__fill,
  .fc-zone[data-state="planned"]   .fc-zone__fill { fill: rgba(28, 43, 74, 0.13); }
  .fc-svg:hover .fc-zone:not(:hover) { opacity: 0.4; }
  .fc-zone:hover, .fc-zone.is-active { opacity: 1 !important; }
  .fc-zone:hover .fc-zone__img, .fc-zone.is-active .fc-zone__img { opacity: 1; }
  .fc-zone:hover .fc-zone__fill, .fc-zone.is-active .fc-zone__fill { fill: rgba(28, 43, 74, 0); }
  .fc-zone:hover .fc-zone__line, .fc-zone.is-active .fc-zone__line { opacity: 0; }
  .fc-zone:focus { outline: none; }
  .fc-zone:focus-visible .fc-zone__line { opacity: 1; stroke: var(--gold, #B8965A); stroke-width: 1.4; }

  .fc__panel-rest, .fc__panel-active { animation: fcFade 0.6s var(--ease-out, ease) both; }
  @keyframes fcFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .fc__rest-title { margin: 0 0 16px; font-family: var(--font-serif, serif); font-style: italic; font-size: clamp(1.4rem, 1vw + 1rem, 1.9rem); line-height: 1.2; color: var(--marine, #1C2B4A); }
  .fc__rest-body { margin: 0; max-width: 42ch; font-family: var(--font-sans, sans-serif); font-weight: 300; font-size: 14.5px; line-height: 1.75; color: #5A4E3A; }
  .fc__label { margin: 0 0 14px; font-family: var(--font-sans, sans-serif); font-size: 10px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: var(--gold, #B8965A); }
  .fc__name { margin: 0; font-family: "TAN Pearl", var(--font-serif, serif); font-weight: 700; font-size: clamp(2.1rem, 2.4vw, 3rem); line-height: 1; letter-spacing: -0.01em; color: var(--marine, #1C2B4A); }
  .fc__status { margin: 14px 0 0; font-family: var(--font-sans, sans-serif); font-size: 11px; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: #5A4E3A; }
  .fc__panel-active[data-state="soon"] .fc__status { text-transform: none; letter-spacing: 0.02em; font-style: italic; font-weight: 300; opacity: 0.8; }
  .fc__rule { display: block; width: 44px; height: 1px; margin: 22px 0; background: var(--gold, #B8965A); opacity: 0.6; }
  .fc__phrase { margin: 0; font-family: var(--font-serif, serif); font-style: italic; font-size: clamp(1.2rem, 0.8vw + 0.9rem, 1.5rem); line-height: 1.34; color: var(--marine, #1C2B4A); }
  .fc__details { margin: 22px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 8px 14px; font-family: var(--font-sans, sans-serif); font-size: 11px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold, #B8965A); }
  .fc__details li { position: relative; }
  .fc__details li + li::before { content: "·"; position: absolute; left: -9px; color: rgba(28,43,74,0.3); }
  @media (prefers-reduced-motion: reduce) { .fc-zone, .fc-zone__img, .fc-zone__fill, .fc-zone__line, .fc__panel-rest, .fc__panel-active { transition: none; animation: none; } }`;

// ============================================================================
// MODALE — snippets/france-map.liquid (ouverte depuis le Passeport).
// Réutilise EXACTEMENT la même géométrie clippée que la section inline, dans la
// coquille modale existante (.fmap). Remplace l'ancienne carte à cercles.
// ============================================================================
const modal = `{%- comment -%}
  ============================================================================
  CARTE INTERACTIVE (MODALE) — « Les escales Maison Bonjour »
  ----------------------------------------------------------------------------
  Ouverte depuis le Passeport (bouton [data-map-open]). MÊME carte que la
  section « La France » (sections/france-carte.liquid) : photo révélée dans le
  contour exact de chaque région au survol/tap.

  ⚠️ FICHIER GÉNÉRÉ par tools/france-map/build.js — ne pas éditer les <path>.
  ============================================================================
{%- endcomment -%}

<div class="fmap" data-france-map data-fm-skip aria-hidden="true">
  <div class="fmap__overlay" data-map-close></div>

  <div class="fmap__dialog" role="dialog" aria-modal="true" aria-labelledby="fmapTitle" tabindex="-1">
    <button class="fmap__close" type="button" data-map-close aria-label="{{ 'map.close' | t }}">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>

    <aside class="fmap__intro">
      <p class="fmap__eyebrow">{{ 'map.eyebrow' | t }}</p>
      <h2 class="fmap__title" id="fmapTitle">{{ 'map.title' | t }}</h2>
      <p class="fmap__subtitle">{{ 'map.subtitle' | t }}</p>
    </aside>

    <div class="fmap__stage">
      <svg class="fc-svg fmap__svg" viewBox="0 0 ${W} ${H}" role="group" aria-label="Carte des escales Maison Bonjour" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs>
${defs}
        </defs>
        <path class="fc-base" d="${basePath}" aria-hidden="true"/>
        <g class="fc-zones">
${zonesSvg}
        </g>
      </svg>
    </div>

    <aside class="fmap__panel fc__panel" data-fc-panel aria-live="polite">
      <div class="fc__panel-rest" data-fc-rest>
        <p class="fc__rest-title">{{ 'map.rest_title' | t }}</p>
        <p class="fc__rest-body">{{ 'map.rest_body' | t }}</p>
      </div>
      <div class="fc__panel-active" data-fc-active hidden>
        <p class="fc__label">{{ 'map.region_label' | t }}</p>
        <h3 class="fc__name" data-fc-name></h3>
        <p class="fc__status" data-fc-status></p>
        <span class="fc__rule" aria-hidden="true"></span>
        <p class="fc__phrase" data-fc-phrase></p>
        <ul class="fc__details" data-fc-details role="list"></ul>
      </div>
    </aside>

    <p class="fmap__footnote">{{ 'map.footnote' | t }}</p>
  </div>
</div>

<style>
  .fmap { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: clamp(12px,3vw,40px); opacity: 0; visibility: hidden; transition: opacity 0.45s var(--ease-out, ease), visibility 0s linear 0.45s; }
  .fmap.is-open { opacity: 1; visibility: visible; transition: opacity 0.45s var(--ease-out, ease); }
  .fmap__overlay { position: absolute; inset: 0; background: rgba(15,26,46,0.92); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
  .fmap__dialog {
    position: relative; width: min(1180px, 100%); max-height: calc(100dvh - clamp(24px,6vw,80px)); overflow: auto;
    background: var(--cream, #FEF9F3); border: 1px solid var(--gold, #B8965A);
    box-shadow: 0 40px 120px rgba(15,26,46,0.5);
    padding: clamp(24px,3.5vw,52px); display: grid; grid-template-columns: 1fr; gap: clamp(20px,3vw,40px);
    transform: scale(0.96) translateY(12px); opacity: 0; transition: transform 0.5s cubic-bezier(0.19,1,0.22,1), opacity 0.5s ease;
  }
  .fmap.is-open .fmap__dialog { transform: none; opacity: 1; }
  .fmap__close { position: absolute; top: clamp(12px,1.5vw,20px); right: clamp(12px,1.5vw,20px); z-index: 3; width: 42px; height: 42px; display: inline-flex; align-items: center; justify-content: center; color: var(--marine, #1C2B4A); background: transparent; border: 1px solid rgba(184,150,90,0.4); cursor: pointer; transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease; }
  .fmap__close:hover { background: var(--marine, #1C2B4A); color: var(--cream, #FEF9F3); border-color: var(--marine, #1C2B4A); }
  .fmap__close:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }

  .fmap__eyebrow { margin: 0 0 14px; font-family: var(--font-sans, sans-serif); font-size: 10px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: var(--gold, #B8965A); }
  .fmap__title { margin: 0; font-family: var(--font-serif, serif); font-style: italic; font-weight: 400; font-size: clamp(1.8rem,2.4vw + 1rem,2.6rem); line-height: 1.05; color: var(--marine, #1C2B4A); }
  .fmap__subtitle { margin: 14px 0 0; font-family: var(--font-sans, sans-serif); font-weight: 300; font-size: 14px; line-height: 1.6; color: #5A4E3A; max-width: 42ch; }

  .fmap__stage { display: flex; align-items: center; justify-content: center; }
  .fmap__svg { width: 100%; max-width: 560px; height: auto; display: block; overflow: visible; }
  .fmap__footnote { margin: 0; text-align: center; font-family: var(--font-sans, sans-serif); font-size: 10px; font-weight: 500; letter-spacing: 0.3em; text-transform: uppercase; color: #5A4E3A; opacity: 0.7; }

  @media (min-width: 1024px) {
    .fmap__dialog { grid-template-columns: minmax(220px,1fr) minmax(0,1.4fr) minmax(240px,1fr); grid-template-areas: "intro stage panel" "foot foot foot"; align-items: center; }
    .fmap__intro { grid-area: intro; } .fmap__stage { grid-area: stage; } .fmap__panel { grid-area: panel; align-self: center; } .fmap__footnote { grid-area: foot; }
  }
  @media (max-width: 1023px) { .fmap__svg { max-width: 420px; margin-inline: auto; } }
  @media (max-width: 767px) { .fmap { padding: 0; } .fmap__dialog { width: 100%; max-height: 100dvh; height: 100dvh; border: 0; } }

${SHARED_ZONE_CSS}

  @media (prefers-reduced-motion: reduce) {
    .fmap, .fmap__dialog { transition: none !important; }
    .fmap__dialog { transform: none; }
  }
</style>

<script>
  (function () {
    var map = document.querySelector('[data-france-map]');
    if (!map) return;
    var dialog = map.querySelector('.fmap__dialog');
    var zones  = map.querySelectorAll('.fc-zone');
    var rest   = map.querySelector('[data-fc-rest]');
    var act    = map.querySelector('[data-fc-active]');
    var elName = map.querySelector('[data-fc-name]');
    var elStat = map.querySelector('[data-fc-status]');
    var elPhr  = map.querySelector('[data-fc-phrase]');
    var elDet  = map.querySelector('[data-fc-details]');
    var activeSlug = null, lastTrigger = null;

    function showRest(){ if (rest) rest.hidden = false; if (act) act.hidden = true; }
    function fill(g){
      var soon = g.getAttribute('data-state') === 'soon';
      elName.textContent = g.getAttribute('data-name');
      elStat.textContent = soon ? g.getAttribute('data-month') : g.getAttribute('data-status') + ' · ' + g.getAttribute('data-month');
      elPhr.textContent = g.getAttribute('data-phrase');
      elDet.innerHTML = '';
      (g.getAttribute('data-keywords') || '').split(' · ').forEach(function (v){ v=v.trim(); if(!v) return; var li=document.createElement('li'); li.textContent=v; elDet.appendChild(li); });
      act.setAttribute('data-state', g.getAttribute('data-state'));
      if (rest) rest.hidden = true; act.hidden = false;
    }
    function setActive(slug){
      activeSlug = slug;
      zones.forEach(function (z){ z.classList.toggle('is-active', z.getAttribute('data-region') === slug); });
      var g = map.querySelector('.fc-zone[data-region="' + slug + '"]'); if (g) fill(g);
    }
    zones.forEach(function (g){
      g.addEventListener('mouseenter', function (){ fill(g); });
      g.addEventListener('mouseleave', function (){ if (activeSlug) setActive(activeSlug); else showRest(); });
      g.addEventListener('focus', function (){ fill(g); });
      g.addEventListener('blur', function (){ if (activeSlug) setActive(activeSlug); else showRest(); });
      g.addEventListener('click', function (){ setActive(g.getAttribute('data-region')); });
      g.addEventListener('keydown', function (e){ if (e.key==='Enter'||e.key===' '||e.key==='Spacebar'){ e.preventDefault(); setActive(g.getAttribute('data-region')); } });
    });
    showRest();

    function lockScroll(on){ document.body.classList.toggle('no-scroll', on); var l = window.__mbLenis; if (l){ if (on && l.stop) l.stop(); if (!on && l.start) l.start(); } }
    function open(t){ lastTrigger = t || null; map.setAttribute('aria-hidden','false'); map.classList.add('is-open'); lockScroll(true); window.setTimeout(function (){ if (dialog) dialog.focus(); }, 60); }
    function close(){ map.classList.remove('is-open'); map.setAttribute('aria-hidden','true'); lockScroll(false); if (lastTrigger && lastTrigger.focus) lastTrigger.focus(); }
    var triggers = document.querySelectorAll('[data-map-open]');
    for (var t=0;t<triggers.length;t++) triggers[t].addEventListener('click', function (e){ e.preventDefault(); open(this); });
    var closers = map.querySelectorAll('[data-map-close]');
    for (var c=0;c<closers.length;c++) closers[c].addEventListener('click', close);
    document.addEventListener('keydown', function (e){ if (e.key === 'Escape' && map.classList.contains('is-open')) close(); });
  })();
</script>
`;

fs.writeFileSync(path.join(ROOT, 'snippets', 'france-map.liquid'), modal, 'utf8');

// Report (no geometry dumped).
const report = {
  viewBox: W + 'x' + H,
  zones: ORDER.length,
  order: ORDER,
  missingGeom: ORDER.filter(s => !zonePaths[s]),
  sectionKB: +(liquid.length/1024).toFixed(1),
  modalKB: +(modal.length/1024).toFixed(1),
};
console.log(JSON.stringify(report, null, 2));
