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

import { czyWspolrzedneOk, geohash, odlegloscM } from './geo.js?v=m12-7';
import { TRYBY } from './konfig.js?v=m12-7';

/* ------------------------------------- instancje i polityka (ASSETS §2) */

/** Łańcuch instancji Overpass w kolejności prób — dokładnie jak ASSETS §2. */
export const INSTANCJE_OVERPASS = [
  { nazwa: 'FOSSGIS (główna)', url: 'https://overpass-api.de/api/interpreter' },
  { nazwa: 'private.coffee', url: 'https://overpass.private.coffee/api/interpreter' },
  { nazwa: 'VK Maps', url: 'https://maps.mail.ru/osm/tools/overpass/api/interpreter' },
];

/**
 * Kolejność prób łańcucha: zapamiętana sprawna instancja pierwsza, reszta
 * bez zmian (ASSETS §2). Nieznany/pusty adres = kolejność domyślna.
 * Pamiętanie DOBREJ instancji to mniej doomed-zapytań, nie więcej ruchu.
 */
export function kolejnoscInstancji(zapamietanyUrl = null) {
  if (typeof zapamietanyUrl !== 'string' || !zapamietanyUrl) return [...INSTANCJE_OVERPASS];
  const znana = INSTANCJE_OVERPASS.find((i) => i.url === zapamietanyUrl);
  if (!znana) return [...INSTANCJE_OVERPASS];
  return [znana, ...INSTANCJE_OVERPASS.filter((i) => i.url !== zapamietanyUrl)];
}

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
  S09: 'W tej okolicy nie ma ANI JEDNEJ drogi dostępnej dla wybranego trybu — ustaw stacje ręcznie albo zmień tryb/okolicę.',
  S10: 'Dijkstra dostała węzeł startowy spoza grafu.',
  S11: 'Graf zbudowano dla innego trybu niż wybór kandydatów — pieszy nie oceni sieci samochodowej.',
  S12: 'Sieć jest za uboga: udało się wybrać mniej stacji, niż prosi konfiguracja.',
  S13: 'Pozycja startowa jest za daleko od dostępnej sieci dróg — zmień pozycję albo ustaw stacje ręcznie.',
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

  // Dwa wydruki, jedno zapytanie: obszary OSOBNO z `out tags` (czytamy
  // tylko tagi — geometria granic, np. całego kraju, to megabajty i minuty),
  // a cała reszta w JEDNEJ unii z `out geom`. Samodzielne zdanie jest
  // legalne TYLKO z natychmiastowym `out`: bez niego nadpisałoby set
  // domyślny `_` i zgubiło unię (LESSONS L30).
  return [
    `[out:json][timeout:${POLITYKA.timeoutZapytaniaS}];`,
    `is_in(${lat},${lon})->.obszary;`,
    'area.obszary["boundary"="administrative"];', // kropka, nie nawias (nawias = HTTP 400)
    'out tags;',
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
 * Miasto z obszarów administracyjnych (do dopisków „ulica, miasto"):
 * najdrobniejszy obszar z poziomem 7–8 (gmina/miasto), a gdy go nie ma —
 * z poziomem 6 (miasto na prawach powiatu, jak Warszawa). Obszary idą od
 * grubego do drobnego (parser je sortuje), więc szukamy od końca.
 */
export function miastoZObszarow(obszary) {
  if (!Array.isArray(obszary)) return null;
  const znajdz = (poziomy) => [...obszary].reverse().find((o) => poziomy.includes(o.adminLevel))?.name ?? null;
  return znajdz([7, 8]) ?? znajdz([6]);
}

/**
 * Nazwa miejsca do promptu (`{MIEJSCE}`, ADR 0005 pkt 1): najdrobniejszy
 * obszar z nazwą plus miasto („Śródmieście, Warszawa" — sama dzielnica
 * powtarza się w stu miastach). Format jak w warstwie zapasowej Nominatim.
 * Bez Nominatim.
 */
export function nazwaMiejsca(sparsowane) {
  const obszary = sparsowane?.obszary;
  const drobny = obszary?.at(-1)?.name ?? null;
  if (!drobny) return null;
  const miasto = miastoZObszarow(obszary);
  return miasto && miasto !== drobny ? `${drobny}, ${miasto}` : drobny;
}

/* ------------------------------------------------- graf sieci i Dijkstra */

/**
 * Budżet grafu (wydajność na telefonie): kandydaci „co ~50 m" (ADR 0005
 * pkt 3) to węzły grafu powstałe z podziału długich segmentów. Gdy sieć jest
 * ogromna (tryb samochodowy, R = 10 km), krok interpolacji rośnie, żeby liczba
 * węzłów została w budżecie — kosztem gęstości kandydatów, nie poprawności.
 */
export const BUDZET_GRAFU = {
  krokM: 50,
  minKrokM: 50,
  maxKrokM: 400,
  maxWezlow: 20_000,
};

/**
 * Czy droga nadaje się do grafu w danym trybie (ADR 0005 pkt 3): klasa
 * z `TRYBY[tryb].klasyDrog` i brak wykluczeń wspólnych — `access=private|no`,
 * `tunnel=yes`, `foot=no` (pieszy/rower). Autostrady i ekspresówki nie wchodzą
 * już przez listę klas (nie ma ich w `klasyDrog` żadnego trybu).
 */
export function czyDrogaDostepna(droga, tryb) {
  const konfigTrybu = TRYBY[tryb];
  if (!konfigTrybu) throw usterka('S07', String(tryb));
  const tags = droga?.tags ?? {};
  if (!tags.highway || !konfigTrybu.klasyDrog.includes(tags.highway)) return false;
  if (konfigTrybu.wykluczoneKlasy?.includes(tags.highway)) return false;
  if (tags.access === 'private' || tags.access === 'no') return false;
  if (tags.tunnel === 'yes') return false;
  if ((tryb === 'piesza' || tryb === 'rower') && tags.foot === 'no') return false;
  return true;
}

/**
 * Graf sieci z parsera: węzły = wierzchołki OSM + punkty interpolowane co
 * ≤ `krokM` wzdłuż DOSTĘPNYCH dróg; krawędzie dwukierunkowe z wagą w metrach.
 * Wierzchołki współdzielone przez way'e poznajemy po współrzędnych
 * (zaokrąglenie do 6 miejsc — `out geom` powtarza te same liczby).
 * Każdy węzeł niesie posortowane `ulice` (nazwy way'ów, które się w nim
 * spotykają — do opisów stacji w UI i w prompcie AI).
 * Deterministyczny: kolejność wejścia → kolejność węzłów i krawędzi.
 */
export function budujGraf(sparsowane, { tryb = 'piesza' } = {}) {
  if (!TRYBY[tryb]) throw usterka('S07', String(tryb));
  const wszystkie = (sparsowane?.drogi ?? []).filter((d) => Array.isArray(d.punkty) && d.punkty.length >= 2);
  const dostepne = [];
  let niedostepne = 0;
  for (const d of wszystkie) {
    if (czyDrogaDostepna(d, tryb)) dostepne.push(d);
    else niedostepne++;
  }

  // krok interpolacji z budżetem: liczba węzłów ≈ sumaDługości/krok + segmenty
  let sumaM = 0;
  let segmentow = 0;
  for (const d of dostepne) {
    for (let i = 1; i < d.punkty.length; i++) {
      sumaM += odlegloscM(d.punkty[i - 1], d.punkty[i]);
      segmentow++;
    }
  }
  if (segmentow === 0) throw usterka('S09', tryb);
  let krok = BUDZET_GRAFU.krokM;
  const { maxWezlow } = BUDZET_GRAFU;
  if (maxWezlow > segmentow && sumaM / krok + segmentow > maxWezlow) {
    krok = Math.ceil(sumaM / (maxWezlow - segmentow));
  }
  krok = Math.min(Math.max(krok, BUDZET_GRAFU.minKrokM), BUDZET_GRAFU.maxKrokM);

  const wezly = [];
  const sasiedztwo = [];
  const indeksKlucza = new Map();
  const nazwyWezlow = []; // równolegle do `wezly`: zbiór nazw ulic (skrzyżowania zbierają)
  function wezel(p, nazwaUlicy = null) {
    const klucz = `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
    let i = indeksKlucza.get(klucz);
    if (i === undefined) {
      i = wezly.length;
      indeksKlucza.set(klucz, i);
      wezly.push({ id: i, lat: p.lat, lon: p.lon, klucz });
      sasiedztwo.push([]);
      nazwyWezlow.push(new Set());
    }
    if (nazwaUlicy) nazwyWezlow[i].add(nazwaUlicy);
    return i;
  }
  function krawedz(a, b, metry) {
    sasiedztwo[a].push({ do: b, metry });
    sasiedztwo[b].push({ do: a, metry });
  }

  for (const d of dostepne) {
    const nazwaUlicy = typeof d.tags?.name === 'string' ? d.tags.name.trim() || null : null;
    for (let s = 1; s < d.punkty.length; s++) {
      const a = d.punkty[s - 1];
      const b = d.punkty[s];
      const dlugosc = odlegloscM(a, b);
      if (!(dlugosc > 0)) continue; // zdegenerowany segment — nic nie wnosi
      const czesci = Math.max(1, Math.ceil(dlugosc / krok));
      let poprz = wezel(a, nazwaUlicy);
      for (let c = 1; c < czesci; c++) {
        const t = c / czesci;
        const idx = wezel({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t }, nazwaUlicy);
        krawedz(poprz, idx, dlugosc / czesci);
        poprz = idx;
      }
      const ostatni = wezel(b, nazwaUlicy);
      krawedz(poprz, ostatni, dlugosc / czesci);
    }
  }
  for (let i = 0; i < wezly.length; i++) {
    // zwykły sort (nie localeCompare — ten zależy od ICU telefonu)
    wezly[i].ulice = [...nazwyWezlow[i]].sort();
  }

  return {
    tryb,
    krokM: krok,
    wezly,
    sasiedztwo,
    indeksKlucza,
    liczniki: {
      drogDostepnych: dostepne.length,
      drogNiedostepnych: niedostepne,
      wezlow: wezly.length,
      krawedzi: sasiedztwo.reduce((suma, s) => suma + s.length, 0) / 2,
    },
  };
}

/* --- kopiec binarny (minimalny) — deterministyczny tie-break po indeksie */

function kopiecMniejszy(a, b) {
  return a.d < b.d || (a.d === b.d && a.i < b.i);
}

function kopiecPush(kopiec, element) {
  kopiec.push(element);
  let c = kopiec.length - 1;
  while (c > 0) {
    const rodzic = (c - 1) >> 1;
    if (!kopiecMniejszy(kopiec[c], kopiec[rodzic])) break;
    [kopiec[c], kopiec[rodzic]] = [kopiec[rodzic], kopiec[c]];
    c = rodzic;
  }
}

function kopiecPop(kopiec) {
  const szczyt = kopiec[0];
  const ostatni = kopiec.pop();
  if (kopiec.length > 0) {
    kopiec[0] = ostatni;
    let rodzic = 0;
    for (;;) {
      const l = 2 * rodzic + 1;
      const p = l + 1;
      let mniejszy = l;
      if (l >= kopiec.length) break;
      if (p < kopiec.length && kopiecMniejszy(kopiec[p], kopiec[l])) mniejszy = p;
      if (!kopiecMniejszy(kopiec[mniejszy], kopiec[rodzic])) break;
      [kopiec[mniejszy], kopiec[rodzic]] = [kopiec[rodzic], kopiec[mniejszy]];
      rodzic = mniejszy;
    }
  }
  return szczyt;
}

/**
 * Dijkstra z jednego węzła (ADR 0005 pkt 4 — odległości SIECIOWE). Zwraca
 * `dystanse` (metry, `Infinity` = nieosiągalne) i `poprzednicy` (do
 * `sciezkaDo`). Kopiec binarny: dla R = 10 km graf ma dziesiątki tysięcy
 * węzłów i skan liniowy O(V²) nie zmieściłby się w budżecie telefonu.
 */
export function dijkstra(graf, start) {
  const n = graf?.wezly?.length ?? 0;
  if (!Number.isInteger(start) || start < 0 || start >= n) throw usterka('S10', String(start));
  const dystanse = new Array(n).fill(Infinity);
  const poprzednicy = new Int32Array(n).fill(-1);
  const odwiedzone = new Uint8Array(n);
  dystanse[start] = 0;
  const kopiec = [{ d: 0, i: start }];
  while (kopiec.length > 0) {
    const { d, i } = kopiecPop(kopiec);
    if (odwiedzone[i]) continue;
    odwiedzone[i] = 1;
    for (const krawedz of graf.sasiedztwo[i]) {
      const j = krawedz.do;
      if (odwiedzone[j]) continue;
      const przez = d + krawedz.metry;
      if (przez < dystanse[j]) {
        dystanse[j] = przez;
        poprzednicy[j] = i;
        kopiecPush(kopiec, { d: przez, i: j });
      }
    }
  }
  return { start, dystanse, poprzednicy };
}

/** Ścieżka (lista indeksów węzłów od startu do celu) albo `null`, gdy cel nieosiągalny. */
export function sciezkaDo(wynik, cel) {
  if (!Number.isInteger(cel) || cel < 0 || cel >= wynik.dystanse.length) return null;
  if (!Number.isFinite(wynik.dystanse[cel])) return null;
  const sciezka = [cel];
  let biezacy = cel;
  while (wynik.poprzednicy[biezacy] !== -1) {
    biezacy = wynik.poprzednicy[biezacy];
    sciezka.push(biezacy);
    if (sciezka.length > wynik.dystanse.length) return null; // pętla — paranoja
  }
  sciezka.reverse();
  return sciezka;
}

/**
 * Najbliższy węzeł grafu dla punktu (start gry, POI „przy wejściu").
 * Metryka płaska z poprawką cos(lat) — przy zasięgu ≤ kilkuset metrów różnica
 * względem haversine jest poniżej metra, a skan jest szybki. `null`, gdy nic
 * w zasięgu `maxM` albo wejście bez sensu.
 */
export function snapujPunkt(graf, punkt, { maxM = 150 } = {}) {
  const wezly = graf?.wezly ?? [];
  if (wezly.length === 0 || !czyWspolrzedneOk(punkt?.lat, punkt?.lon)) return null;
  const cosLat = Math.cos((punkt.lat * Math.PI) / 180) || 1;
  let najlepszy = null;
  let najlepszaD = Infinity;
  for (let i = 0; i < wezly.length; i++) {
    const dx = (wezly[i].lon - punkt.lon) * cosLat * 111320;
    const dy = (wezly[i].lat - punkt.lat) * 111320;
    const d = Math.hypot(dx, dy);
    if (d < najlepszaD) {
      najlepszaD = d;
      najlepszy = i;
    }
  }
  return najlepszaD <= maxM ? najlepszy : null;
}

/* ------------------------------------------------- kandydaci na stacje */

/**
 * Czy punkt leży wewnątrz poligonu (ray casting). `bbox` (z parsera) działa
 * jak prefiltr — na gęstym centrum większość sprawdzeń kończy się zanim
 * promień policzy przecięcia.
 */
export function punktWPolygonie(punkt, poligon) {
  const punkty = poligon?.punkty;
  if (!Array.isArray(punkty) || punkty.length < 3) return false;
  const b = poligon.bbox;
  if (b && (punkt.lat < b.minLat || punkt.lat > b.maxLat || punkt.lon < b.minLon || punkt.lon > b.maxLon)) return false;
  let wewnatrz = false;
  for (let i = 0, j = punkty.length - 1; i < punkty.length; j = i++) {
    const pi = punkty[i];
    const pj = punkty[j];
    if (pi.lat !== pj.lat
      && pi.lat > punkt.lat !== pj.lat > punkt.lat
      && punkt.lon < ((pj.lon - pi.lon) * (punkt.lat - pi.lat)) / (pj.lat - pi.lat) + pi.lon) {
      wewnatrz = !wewnatrz;
    }
  }
  return wewnatrz;
}

function wStrefieWykluczen(punkt, wykluczenia) {
  for (const strefa of wykluczenia) {
    if (punktWPolygonie(punkt, strefa)) return true;
  }
  return false;
}

/**
 * Nazwa kandydata sieciowego do opisów (UI + prompt AI): ulica, na której
 * stoi węzeł, albo „skrzyżowanie: A / B", gdy spotyka się ich kilka.
 * Węzeł przy bezimiennej drodze daje null — opis zastępuje fallback.
 */
function nazwaUlicyWezla(wezel) {
  const ulice = wezel?.ulice ?? [];
  if (ulice.length === 0) return null;
  if (ulice.length === 1) return ulice[0];
  return `skrzyżowanie: ${ulice.join(' / ')}`;
}

/** Dopisek miasta do nazwy stacji („Krucza, Warszawa") — null i duplikat bez zmian. */
function dopiszMiasto(nazwa, miasto) {
  if (!nazwa || !miasto || nazwa === miasto || nazwa.endsWith(`, ${miasto}`)) return nazwa;
  return `${nazwa}, ${miasto}`;
}

/**
 * Kandydaci na stacje (ADR 0005 pkt 3):
 * - **węzły dostępnej sieci** (po interpolacji co ≤ 50 m — „punkty wzdłuż
 *   dróg") dla pieszego i roweru;
 * - **POI**: node'y wprost, a POI-way'e i POI-budynki (muzeum, szkoła) przez
 *   przyciągnięcie do najbliższego węzła sieci w zasięgu `maxSnapM` — stacja
 *   „przy wejściu", nigdy w środku bryły;
 * - tryb samochodowy (`TRYBY.wymagaParkingu`): TYLKO POI (parking albo obiekt
 *   z dojazdem) — punkt na jezdni nie jest stacją;
 * - wykluczenia: wnętrze budynku, teren kolejowy, bariera `access=private|no`.
 *
 * Deterministyczne: kolejność = kolejność węzłów grafu, potem POI z parsera.
 * Ten sam węzeł zajęty przez POI dostaje typ `poi` (POI wygrywa z gołym
 * fragmentem chodnika — ciekawsza stacja).
 */
export function kandydaciNaStacje(sparsowane, graf, { tryb, maxSnapM = 80 } = {}) {
  const konfigTrybu = TRYBY[tryb];
  if (!konfigTrybu) throw usterka('S07', String(tryb));
  if (!graf?.wezly?.length) throw usterka('S09', tryb);
  if (graf.tryb !== tryb) throw usterka('S11', `${graf.tryb} ≠ ${tryb}`);

  const wykluczenia = [...(sparsowane?.budynki ?? []), ...(sparsowane?.wykluczeniaObszarowe ?? [])];
  // bariera z access=private/no blokuje węzeł, przy którym stoi (np. brama
  // na prywatne osiedle) — pozostałe bramy (access=yes, furtki) nie blokują
  const barieryBlokujace = (sparsowane?.bariery ?? []).filter((bariera) => {
    const access = bariera.tags?.access;
    return access === 'private' || access === 'no';
  });

  const kandydaci = [];
  const zajete = new Map(); // indeks węzła → pozycja na liście kandydatów
  const liczniki = { wykluczonychBryla: 0, wykluczonychBariera: 0, poiBezSieci: 0, zdublowanych: 0 };
  const miasto = miastoZObszarow(sparsowane?.obszary);

  function sprobuj(indeksWezla, typ, zrodlo = null) {
    const wezel = graf.wezly[indeksWezla];
    const punkt = { lat: wezel.lat, lon: wezel.lon };
    if (wStrefieWykluczen(punkt, wykluczenia)) {
      liczniki.wykluczonychBryla++;
      return false;
    }
    for (const bariera of barieryBlokujace) {
      if (snapujPunkt({ wezly: [wezel] }, bariera.punkt, { maxM: 5 }) !== null) {
        liczniki.wykluczonychBariera++;
        return false;
      }
    }
    if (zajete.has(indeksWezla)) {
      const stary = kandydaci[zajete.get(indeksWezla)];
      if (typ === 'poi' && stary.typ === 'siec') {
        kandydaci[zajete.get(indeksWezla)] = {
          ...stary,
          typ: 'poi',
          poi: zrodlo,
          nazwa: dopiszMiasto(zrodlo?.tags?.name ?? null, miasto),
        };
      } else {
        liczniki.zdublowanych++;
      }
      return true;
    }
    zajete.set(indeksWezla, kandydaci.length);
    kandydaci.push({
      wezel: indeksWezla,
      lat: wezel.lat,
      lon: wezel.lon,
      typ,
      poi: zrodlo,
      nazwa: typ === 'poi'
        ? dopiszMiasto(zrodlo?.tags?.name ?? null, miasto)
        : dopiszMiasto(nazwaUlicyWezla(wezel), miasto),
    });
    return true;
  }

  if (!konfigTrybu.wymagaParkingu) {
    for (let i = 0; i < graf.wezly.length; i++) sprobuj(i, 'siec');
  }
  for (const p of sparsowane?.poi ?? []) {
    const idx = snapujPunkt(graf, p.punkt, { maxM: maxSnapM });
    if (idx === null) {
      liczniki.poiBezSieci++;
      continue;
    }
    sprobuj(idx, 'poi', p);
  }

  return { kandydaci, liczniki };
}

/* --------------------------------------- cache sieci (ADR 0010 pkt 1) */

export const SCHEMAT_SIECI = 'sieci/1';

/**
 * Klucz cache: geohash-6 + promień gry + TRYB — graf zależy od trybu
 * (klasy dróg piesza/rower/samochód), więc wpis pieszy nie może obsłużyć
 * gry samochodowej (osobny wpis na tryb; stare klucze bez trybu wygasają
 * naturalnie przez TTL — nikt ich już nie odczytuje).
 */
export function kluczCacheSieci({ lat, lon, promienM, tryb }) {
  if (!czyWspolrzedneOk(lat, lon)) throw usterka('S05');
  if (!Number.isFinite(promienM) || promienM <= 0) throw usterka('S06');
  if (!TRYBY[tryb]) throw usterka('S07', String(tryb));
  return `okolica:sieci:${geohash(lat, lon, 6)}-${Math.round(promienM)}-${tryb}`;
}

function okraglijPunkty(punkty) {
  return punkty.map((p) => ({ lat: Number(p.lat.toFixed(6)), lon: Number(p.lon.toFixed(6)) }));
}

/**
 * Wpis cache to SPARSOWANE dane (nie surowa odpowiedź Overpass): mniej bajtów
 * w `localStorage` i zero powtórnej normalizacji. Współrzędne zaokrąglone do
 * 6 miejsc (~0,11 m) — poniżej precyzji, która cokolwiek zmienia w grze.
 */
export function upraszczajDaneDoCache(sparsowane) {
  return {
    schemat: SCHEMAT_SIECI,
    drogi: sparsowane.drogi.map((d) => ({ id: d.id, punkty: okraglijPunkty(d.punkty), tags: d.tags })),
    budynki: sparsowane.budynki.map((b) => ({ id: b.id, punkty: okraglijPunkty(b.punkty), tags: b.tags })),
    wykluczeniaObszarowe: sparsowane.wykluczeniaObszarowe.map((w) => ({ id: w.id, punkty: okraglijPunkty(w.punkty), tags: w.tags })),
    poi: sparsowane.poi.map((p) => ({ id: p.id, punkt: { lat: Number(p.punkt.lat.toFixed(6)), lon: Number(p.punkt.lon.toFixed(6)) }, tags: p.tags })),
    bariery: sparsowane.bariery.map((b) => ({ id: b.id, punkt: { lat: Number(b.punkt.lat.toFixed(6)), lon: Number(b.punkt.lon.toFixed(6)) }, tags: b.tags })),
    obszary: sparsowane.obszary.map((o) => ({ name: o.name, adminLevel: o.adminLevel })),
  };
}

/**
 * Dane z wpisu cache albo `null`: nieznany schemat (migracja/jawny komunikat
 * w UI, nigdy ciche użycie), brak `zapisanoMs`, wpis starszy niż TTL 30 dni
 * albo z przyszłości (przesunięty zegar — tolerancja 1 dnia).
 */
export function wczytajDaneZCache(wpis, { terazMs }) {
  if (!wpis || typeof wpis !== 'object') return null;
  if (wpis.schemat !== SCHEMAT_SIECI) return null;
  if (!Number.isFinite(wpis.zapisanoMs) || !Number.isFinite(terazMs)) return null;
  const wiekDni = (terazMs - wpis.zapisanoMs) / 86_400_000;
  if (wiekDni > POLITYKA.ttlCacheDni || wiekDni < -1) return null;
  if (!wpis.dane || !Array.isArray(wpis.dane.drogi) || wpis.dane.drogi.length === 0) return null;
  return wpis.dane;
}

/**
 * LRU dla cache sieci (ADR 0010 pkt 1: próg 2 MB): zwraca klucze do usunięcia,
 * najstarsze pierwsze, aż suma rozmiarów zmieści się w limicie. `wpisy`:
 * `[{ klucz, rozmiarBajtow, zapisanoMs }]`. Czyste — `localStorage` dotyka
 * dopiero warstwa aplikacji.
 */
export function przycijCacheSieci(wpisy, { limitBajtow = POLITYKA.maxRozmiarCacheBajtow } = {}) {
  const lista = (Array.isArray(wpisy) ? wpisy : [])
    .filter((w) => w && typeof w.klucz === 'string' && Number.isFinite(w.rozmiarBajtow))
    .map((w) => ({ ...w, zapisanoMs: Number.isFinite(w.zapisanoMs) ? w.zapisanoMs : 0 }));
  let suma = lista.reduce((a, w) => a + w.rozmiarBajtow, 0);
  if (suma <= limitBajtow) return [];
  const odNajstarszego = [...lista].sort((a, b) => a.zapisanoMs - b.zapisanoMs);
  const doUsuniecia = [];
  for (const w of odNajstarszego) {
    if (suma <= limitBajtow) break;
    doUsuniecia.push(w.klucz);
    suma -= w.rozmiarBajtow;
  }
  return doUsuniecia;
}

/* ======================= M5/J5: odwrotna geokodacja — warstwa zapasowa */

/**
 * Domyślny endpoint Nominatim (ASSETS §3). Przełączalny BEZ aktualizacji
 * oprogramowania przez klucz `okolica:geokodacja-endpoint` — wymóg polityki
 * OSMF („gotowość do przełączenia usługi na żądanie OSMF").
 */
export const DOMYSLNY_ENDPOINT_GEOKODACJI = 'https://nominatim.openstreetmap.org/reverse';

/**
 * URL odwrotnej geokodacji (warstwa ZAPASOWA — domyślnie wyłączona,
 * ADR 0013 pkt 2/3). Minimalizacja pozycji: współrzędne zaokrąglone do
 * 5 miejsc (~1 m i tak grubiej niż potrzeba nazwie dzielnicy), jedno
 * żądanie na grę, bez identyfikatora użytkownika.
 */
export function budujUrlGeokodacji({ lat, lon, endpoint = DOMYSLNY_ENDPOINT_GEOKODACJI } = {}) {
  if (!czyWspolrzedneOk(lat, lon)) {
    const blad = new Error('budujUrlGeokodacji: współrzędne poza zakresem');
    blad.kod = 'S05';
    throw blad;
  }
  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint)) {
    throw new TypeError('budujUrlGeokodacji: endpoint musi być adresem https');
  }
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: lat.toFixed(5),
    lon: lon.toFixed(5),
    zoom: '14',
    'accept-language': 'pl',
    addressdetails: '1',
  });
  return `${endpoint}?${params.toString()}`;
}

/**
 * Nazwa miejsca z odpowiedzi Nominatim `jsonv2` (addressdetails): dzielnica
 * i miasto — jak w rozwiązaniu podstawowym z Overpass (ASSETS §3). Śmieciowa
 * odpowiedź → null (UI pokaże „brak odczytu", nie wyjątek).
 */
export function miejsceZOdpowiedziNominatim(odpowiedz) {
  const address = odpowiedz?.address;
  if (!address || typeof address !== 'object') return null;
  const dzielnica = ['suburb', 'city_district', 'district', 'quarter']
    .map((klucz) => address[klucz])
    .find((wartosc) => typeof wartosc === 'string' && wartosc.trim());
  const miasto = ['city', 'town', 'village', 'municipality']
    .map((klucz) => address[klucz])
    .find((wartosc) => typeof wartosc === 'string' && wartosc.trim());
  const czesci = [dzielnica, miasto].filter(Boolean).map((s) => s.trim());
  return czesci.length > 0 ? czesci.join(', ') : null;
}
