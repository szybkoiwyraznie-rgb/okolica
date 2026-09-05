/**
 * sieci.js — warstwa sieci drogowej (kamień M4, ADR 0005).
 *
 * Z odpowiedzi Overpass API buduje w pamięci dane, na których `stacje.js`
 * wybiera punkty docelowe: drogi (graf), poligony wykluczeń (budynki, teren
 * kolejowy), POI, bariery i obszary administracyjne (nazwa miejsca do promptu
 * `{MIEJSCE}` — bez wołania Nominatim, ASSETS §3).
 *
 * Moduł czysty: bez `fetch`, bez DOM, bez `Math.random()`. Pobieranie
 * (łańcuch instancji, timeout, cache `okolica:sieci:*`) organizuje warstwa
 * aplikacji w `app.js` (I7) — tu leżą tylko polityka i przekształcenia danych.
 *
 * Świadome uproszczenia względem dosłownego ADR 0005 pkt 1:
 * - ograniczenia dostępu (`access`, `foot`, `tunnel`) nie mają OSOBNYCH
 *   selektorów w zapytaniu — są tagami way'ów, które i tak pobieramy, więc
 *   osobne zapytanie tylko powiększyłoby odpowiedź;
 * - POI-budynek (np. muzeum) trafia JEDNOCZEŚNIE do wykluczeń i do POI:
 *   poligon wyklucza stawianie stacji w środku, a kandydat „przy wejściu"
 *   powstaje przez przyciągnięcie do najbliższego węzła sieci (I5).
 */

import { czyWspolrzedneOk } from './geo.js';
import { TRYBY } from './konfig.js';

/* ------------------------------------- instancje i polityka (ASSETS §2) */

/** Łańcuch instancji Overpass w kolejności prób — dokładnie jak ASSETS §2. */
export const INSTANCJE_OVERPASS = [
  { nazwa: 'FOSSGIS (główna)', url: 'https://overpass-api.de/api/interpreter' },
  { nazwa: 'private.coffee', url: 'https://overpass.private.coffee/api/interpreter' },
  { nazwa: 'VK Maps', url: 'https://maps.mail.ru/osm/tools/overpass/api/interpreter' },
];

export const POLITYKA = {
  /** Timeout `fetch` po naszej stronie (ADR 0005, konsekwencje). */
  timeoutMs: 20_000,
  /** `[timeout:25]` w nagłówku zapytania Overpass QL. */
  timeoutZapytaniaS: 25,
  /** Pauza między próbami i po `429`/`406` (ASSETS §2 pkt 3). */
  odstepMs: 30_000,
  /** Promień zapytania = R gry × 1.15 (ADR 0005 pkt 1). */
  mnoznikPromienia: 1.15,
  /** Odpowiedź większa niż tyle nie trafia do cache (budżet ADR 0010 pkt 1). */
  maxRozmiarCacheBajtow: 2 * 1024 * 1024,
  /** TTL cache sieci w dniach (ADR 0005 pkt 7, ADR 0010 pkt 1). */
  ttlCacheDni: 30,
};

/** Kody usterek warstwy sieci — rodzina „S" (jak K/P/G/E w pozostałych). */
export const KODY_SIECI = {
  S01: 'Odpowiedź Overpass nie jest obiektem z listą `elements` — instancja zwróciła coś, czego nie rozumiemy.',
  S02: 'Brak danych sieci drogowej w tej okolicy — Overpass nie zwrócił żadnych dróg. Ustaw stacje ręcznie albo zmień okolicę.',
  S03: 'Wszystkie instancje Overpass odmówiły albo są przeciążone. Spróbuj później albo ustaw stacje ręcznie.',
  S04: 'Dane sieci są za duże na pamięć przeglądarki — gramy bez cache (następna gra w tej okolicy znów pobierze sieć).',
  S05: 'Brak poprawnego środka zapytania (współrzędne pozycji startowej).',
  S06: 'Promień zapytania musi być dodatnią liczbą metrów.',
  S07: 'Nieznany tryb poruszania — zapytanie budujemy tylko dla piesza/rower/samochód.',
  S08: 'Część dróg przyszła bez geometrii (tylko numery węzłów) — zostały pominięte.',
};

/** Błąd warstwy sieci: `Error` z polami `kod` i `komunikat` (jak w pozycja.js). */
export function usterka(kod, powod = null) {
  const komunikat = KODY_SIECI[kod] ?? 'Nieznana usterka warstwy sieci.';
  const blad = new Error(powod ? `${kod}: ${komunikat} (${powod})` : `${kod}: ${komunikat}`);
  blad.kod = kod;
  blad.komunikat = komunikat;
  blad.powod = powod;
  return blad;
}

/**
 * Czy po takiej odpowiedzi przełączamy na następną instancję (ASSETS §2):
 * `406`/`429`/`5xx`, timeout albo błąd sieci. `4xx` inne niż 406/429 to błąd
 * ZAPYTANIA — następna instancja odpowie tak samo, więc nie przełączamy.
 */
export function czyPrzelaczycInstancje({ status = null, timeout = false, bladSieci = false } = {}) {
  if (timeout || bladSieci) return true;
  if (!Number.isFinite(status)) return false;
  return status === 406 || status === 429 || status >= 500;
}

/* --------------------------------------------------- zapytanie Overpass */

/** Zaokrąglenie pozycji do siatki ~6 m przed wysłaniem (ADR 0013 pkt 3) —
 * ta sama siatka co ziarno rozgrywki (`konfig.ziarnoRozgrywki`). */
export function pozycjaDoZapytania(punkt) {
  return {
    lat: Math.round(punkt.lat * 20000) / 20000,
    lon: Math.round(punkt.lon * 20000) / 20000,
  };
}

/**
 * Jedno zapytanie na grę (ADR 0005 pkt 1, ASSETS §2 pkt 1): drogi klasami
 * trybu, POI, budynki (poligony wykluczeń), teren kolejowy, bariery oraz
 * obszary administracyjne przez `is_in` (nazwa miejsca do promptu).
 * Deterministyczne: te same dane wejściowe → identyczny tekst.
 */
export function budujZapytanieOverpass({ srodek, promienM, tryb = 'piesza' }) {
  if (!srodek || !czyWspolrzedneOk(srodek.lat, srodek.lon)) throw usterka('S05');
  if (!Number.isFinite(promienM) || promienM <= 0) throw usterka('S06');
  const trybKonfig = TRYBY[tryb];
  if (!trybKonfig) throw usterka('S07', String(tryb));

  const { lat, lon } = pozycjaDoZapytania(srodek);
  const promien = Math.round(promienM * POLITYKA.mnoznikPromienia);
  const klasy = `^(${trybKonfig.klasyDrog.join('|')})$`;
  const around = `around:${promien},${lat},${lon}`;

  return [
    `[out:json][timeout:${POLITYKA.timeoutZapytaniaS}];`,
    '(',
    `  way["highway"~"${klasy}"](${around});`,
    `  node["amenity"](${around});`,
    `  way["amenity"](${around});`,
    `  node["tourism"](${around});`,
    `  way["tourism"](${around});`,
    `  node["historic"](${around});`,
    `  way["historic"](${around});`,
    `  node["shop"~"^(convenience|supermarket|bakery|kiosk)$"](${around});`,
    `  node["leisure"~"^(park|playground|garden|picnic_site)$"](${around});`,
    `  way["leisure"~"^(park|playground|garden)$"](${around});`,
    `  node["place"="square"](${around});`,
    `  node["natural"~"^(peak|waterfall|tree)$"](${around});`,
    `  way["building"](${around});`,
    `  way["landuse"="railway"](${around});`,
    `  node["barrier"](${around});`,
    ');',
    `is_in(${lat},${lon})->.obszary;`,
    'area(.obszary)["boundary"="administrative"];',
    'out geom;',
    '',
  ].join('\n');
}

/* ------------------------------------------------- parsowanie odpowiedzi */

const POI_KLUCZE_PROSTE = ['amenity', 'tourism', 'historic', 'shop'];
const POI_LEISURE = new Set(['park', 'playground', 'garden', 'picnic_site']);
const POI_NATURAL = new Set(['peak', 'waterfall', 'tree']);

/** Czy tagi opisują POI (kandydat na stację „przy obiekcie"). */
export function czyPoi(tags) {
  if (!tags) return false;
  if (POI_KLUCZE_PROSTE.some((k) => tags[k])) return true;
  if (tags.place === 'square') return true;
  if (tags.leisure && POI_LEISURE.has(tags.leisure)) return true;
  if (tags.natural && POI_NATURAL.has(tags.natural)) return true;
  return false;
}

function czyPunktOk(p) {
  return Number.isFinite(p?.lat) && Number.isFinite(p?.lon);
}

function bbox(punkty) {
  let minLat = Infinity; let maxLat = -Infinity; let minLon = Infinity; let maxLon = -Infinity;
  for (const p of punkty) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return { minLat, maxLat, minLon, maxLon };
}

function srodekMasy(punkty) {
  let lat = 0; let lon = 0;
  for (const p of punkty) { lat += p.lat; lon += p.lon; }
  return { lat: lat / punkty.length, lon: lon / punkty.length };
}

function zamknij(punkty) {
  const p = [...punkty];
  const a = p[0]; const b = p.at(-1);
  if (a.lat !== b.lat || a.lon !== b.lon) p.push({ lat: a.lat, lon: a.lon });
  return p;
}

/**
 * Normalizacja odpowiedzi Overpass do postaci, której potrzebuje graf i wybór
 * stacji. Tolerancyjna: elementy bez sensu są liczone (`odrzucone`), way bez
 * geometrii dostaje miękką usterkę `S08` — twardy błąd tylko gdy nie da się
 * zbudować ŻADNEJ sieci (`S01`/`S02`).
 *
 * @returns {{drogi, budynki, wykluczeniaObszarowe, poi, bariery, obszary, usterki, odrzucone}}
 */
export function parsujOdpowiedz(odpowiedz) {
  if (!odpowiedz || typeof odpowiedz !== 'object' || !Array.isArray(odpowiedz.elements)) {
    throw usterka('S01');
  }
  const drogi = [];
  const budynki = [];
  const wykluczeniaObszarowe = [];
  const poi = [];
  const bariery = [];
  const obszary = [];
  const usterki = [];
  let odrzucone = 0;

  for (const el of odpowiedz.elements) {
    if (!el || typeof el !== 'object') { odrzucone++; continue; }

    if (el.type === 'area') {
      const tags = el.tags ?? {};
      if (tags.boundary === 'administrative' && tags.name && Number.isFinite(Number(tags.admin_level))) {
        obszary.push({ id: el.id, name: String(tags.name), adminLevel: Number(tags.admin_level) });
      } else {
        odrzucone++;
      }
      continue;
    }

    if (el.type === 'node') {
      if (!czyPunktOk(el) || !el.tags) { odrzucone++; continue; }
      const tags = el.tags;
      const punkt = { lat: el.lat, lon: el.lon };
      if (tags.barrier) bariery.push({ id: el.id, punkt, tags });
      if (czyPoi(tags)) poi.push({ id: el.id, punkt, tags, rodzaj: 'node' });
      continue;
    }

    if (el.type === 'way') {
      const tags = el.tags ?? {};
      const geometria = Array.isArray(el.geometry) ? el.geometry.filter(czyPunktOk) : null;
      if (!geometria || geometria.length < 2) {
        if (Array.isArray(el.nodes)) usterki.push({ kod: 'S08', id: el.id });
        else odrzucone++;
        continue;
      }
      const ramka = bbox(geometria);
      if (tags.building) {
        // Poligon wykluczeń; POI-budynek (muzeum, szkoła) dodatkowo zostaje
        // kandydatem „przy wejściu" — patrz nagłówek modułu.
        budynki.push({ id: el.id, punkty: zamknij(geometria), bbox: ramka, tags });
        if (czyPoi(tags)) poi.push({ id: el.id, punkt: srodekMasy(geometria), bbox: ramka, tags, rodzaj: 'way-budynek' });
        continue;
      }
      if (tags.landuse === 'railway') {
        wykluczeniaObszarowe.push({ id: el.id, punkty: zamknij(geometria), bbox: ramka, tags });
        continue;
      }
      if (tags.highway) {
        drogi.push({ id: el.id, punkty: geometria, tags });
        continue;
      }
      if (czyPoi(tags)) {
        poi.push({ id: el.id, punkt: srodekMasy(geometria), bbox: ramka, tags, rodzaj: 'way' });
        continue;
      }
      odrzucone++; // np. landuse=forest — kontekst mapy, nie materiał na stację
      continue;
    }

    odrzucone++; // relation/rele bez geometrii — nie obsługujemy
  }

  if (drogi.length === 0) throw usterka('S02');

  obszary.sort((a, b) => a.adminLevel - b.adminLevel); // od grubego do drobnego
  return { drogi, budynki, wykluczeniaObszarowe, poi, bariery, obszary, usterki, odrzucone };
}

/**
 * Nazwa miejsca do promptu (`{MIEJSCE}`, ADR 0005 pkt 1): najdrobniejszy
 * obszar administracyjny z nazwą — zwykle dzielnica/gmina. Bez Nominatim.
 */
export function nazwaMiejsca(sparsowane) {
  return sparsowane?.obszary?.at(-1)?.name ?? null;
}
