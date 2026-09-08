/**
 * app/mapa.js — mapa: renderer SVG z podkładem rastrowym i warstwami własnymi.
 *
 * Podział jak w reszcie projektu: **część czysta** (matematyka widoku, adresy
 * kafelków, plan rysowania) jest testowalna w Node bez DOM i bez sieci, a
 * **warstwa DOM** (`utworzMape`) tylko wykonuje plan i obsługuje gesty.
 * Dzięki temu „ile kafelków i skąd" da się sprawdzić testem, a w przeglądarce
 * zostaje do obejrzenia jedynie wygląd (LESSONS L3/L6, `docs/ROADMAP.md` M2).
 *
 * Zasady: zero zależności (ADR 0001), podkład rastrowy bez klucza API
 * (ADR 0003, `docs/ASSETS.md` §1), atrybucja zawsze obecna, mobile-first —
 * drag jednym palcem i pinch dwoma przez Pointer Events (ADR 0011).
 *
 * Model widoku dziedziczy jednostki świata z `geo.js`:
 * `ekranPx = jednostkaSwiata * skala + przesuniecie`, a
 * `zoom = log2(skala * SZEROKOSC_SWIATA / ROZMIAR_KAFELKA)`.
 */
import { PODKLADY } from './konfig.js?v=m12-31';
import {
  ROZMIAR_KAFELKA,
  SZEROKOSC_SWIATA,
  czyWspolrzedneOk,
  formatujWspolrzedne,
  metryNaPiksel,
  ogranicz,
  odwroc,
  projektuj,
  siatkaKafelkow,
} from './geo.js?v=m12-31';

/** Przestrzeń nazw SVG (elementy SVG tworzy się przez `createElementNS`). */
export const PRZESTRZEN_SVG = 'http://www.w3.org/2000/svg';

/** Kafelki zapasu wokół widocznego zakresu: pan nie odsłania pustych miejsc. */
export const MARGINES_KAFELKOW = 1;

/**
 * Twardy sufit liczby kafelków na jeden plan. Polityka OSM Tile Usage
 * (`ASSETS` §1) dopuszcza „lekkie" użycie — kilkanaście kafelków na ekran —
 * więc przy bardzo małym zoomie i dużym panelu plan jest przycinany, a nie
 * rozciągany w nieskończoność.
 */
export const MAX_KAFELEK = 48;

/** Najmniejsze powiększenie widoku (zoom 0 to cały świat w jednym kafelku). */
export const ZOOM_MIN = 1;

/** Szablony URL kafelków — dokładnie te z `docs/ASSETS.md` §1. */
export const SZABLONY_KAFELKOW = {
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  opentopo: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  'esri-satelita':
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  brak: null,
};

/** Poddomeny OpenTopoMap; wybór deterministyczny, żeby cache przeglądarki działał. */
export const PODDOMENY = ['a', 'b', 'c'];

/** Kroki paska skali — od podwórka po kontynent. */
export const KROKI_SKALI_M = [
  5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000,
  100_000, 200_000, 500_000,
];

/** Pasek skali: dążymy do `celPx`, ale krótszy niż `minPx` nie jest rysowany. */
export const PASEK_SKALI = { celPx: 80, minPx: 14 };

/* ------------------------------------------------------------------ *
 * Część czysta: widok
 * ------------------------------------------------------------------ */

/** Skala widoku dla zadanego zoomu (jednostki świata → piksele). */
export function skalaZZoomu(zoom) {
  if (!Number.isFinite(zoom)) throw new TypeError('skalaZZoomu: zoom musi być liczbą');
  return (ROZMIAR_KAFELKA * 2 ** zoom) / SZEROKOSC_SWIATA;
}

/** Zoom (ułamkowy) widoku — odwrotność `skalaZZoomu`. */
export function zoomWidoku(widok) {
  sprawdzWidok(widok);
  return Math.log2((widok.skala * SZEROKOSC_SWIATA) / ROZMIAR_KAFELKA);
}

/**
 * Widok o środku w danym miejscu i zadanym zoomie.
 * `widokNaSrodek({lat: 52.23, lon: 21.01, zoom: 17, rozmiar})` → `{x, y, skala}`.
 */
export function widokNaSrodek({ lat, lon, zoom, rozmiar }) {
  sprawdzWspolrzedne(lat, lon);
  sprawdzRozmiar(rozmiar);
  if (!Number.isFinite(zoom)) throw new TypeError('widokNaSrodek: zoom musi być liczbą');
  const srodek = projektuj(lat, lon);
  const skala = skalaZZoomu(zoom);
  return {
    x: rozmiar.szerokosc / 2 - srodek.x * skala,
    y: rozmiar.wysokosc / 2 - srodek.y * skala,
    skala,
  };
}

/** Współrzędne środka widoku — round-trip z `widokNaSrodek`. */
export function srodekWidoku(widok, rozmiar) {
  sprawdzWidok(widok);
  sprawdzRozmiar(rozmiar);
  return odwroc(
    (rozmiar.szerokosc / 2 - widok.x) / widok.skala,
    (rozmiar.wysokosc / 2 - widok.y) / widok.skala,
  );
}

/** Punkt geograficzny → piksele ekranu w danym widoku. */
export function punktNaEkranie(lat, lon, widok) {
  sprawdzWspolrzedne(lat, lon);
  sprawdzWidok(widok);
  const s = projektuj(lat, lon);
  return { x: s.x * widok.skala + widok.x, y: s.y * widok.skala + widok.y };
}

/**
 * Piksele ekranu → współrzędne geograficzne (odwrotność `punktNaEkranie`).
 * Podstawa przeciągania pinezek w trybie ręcznym (ADR 0005 pkt 8b).
 */
export function wspolrzedneZEkranu(xPx, yPx, widok) {
  sprawdzWidok(widok);
  if (!Number.isFinite(xPx) || !Number.isFinite(yPx)) {
    throw new TypeError('wspolrzedneZEkranu: współrzędne ekranowe muszą być liczbami');
  }
  return odwroc((xPx - widok.x) / widok.skala, (yPx - widok.y) / widok.skala);
}

/** Przesunięcie widoku o piksele (drag palcem). */
export function przesunWidok(widok, dxPx, dyPx) {
  sprawdzWidok(widok);
  if (!Number.isFinite(dxPx) || !Number.isFinite(dyPx)) {
    throw new TypeError('przesunWidok: przesunięcie musi być liczbą');
  }
  return { ...widok, x: widok.x + dxPx, y: widok.y + dyPx };
}

/**
 * Zmiana skali z zachowaniem punktu zaczepienia (środek dwupalcowego gestu,
 * kursor, środek panelu). Zoom jest ograniczany do `[minZoom, maxZoom]`,
 * więc „zoom poza podkład" nie prosi dostawcy o nieistniejące kafelki.
 */
export function zmienSkale(widok, mnoznik, { punkt = null, minZoom = ZOOM_MIN, maxZoom = 19 } = {}) {
  sprawdzWidok(widok);
  if (!(mnoznik > 0)) throw new TypeError('zmienSkale: mnożnik musi być dodatni');
  const zoom = ogranicz(zoomWidoku(widok) + Math.log2(mnoznik), minZoom, maxZoom);
  const skala = skalaZZoomu(zoom);
  if (skala === widok.skala) return { ...widok };
  const zaczep = punkt ?? { x: 0, y: 0 };
  const swiatX = (zaczep.x - widok.x) / widok.skala;
  const swiatY = (zaczep.y - widok.y) / widok.skala;
  return { x: zaczep.x - swiatX * skala, y: zaczep.y - swiatY * skala, skala };
}

/** Największy zoom, jaki ma sens dla podkładu (`brak` nie ma kafelków). */
export function maxZoomPodkladu(podklad) {
  sprawdzPodklad(podklad);
  return PODKLADY[podklad].maxZoom;
}

/* ------------------------------------------------------------------ *
 * Część czysta: kafelki
 * ------------------------------------------------------------------ */

/**
 * Adres kafelka. Rotacja poddomen jest **deterministyczna** (`(x + y) % 3`),
 * bo losowa poddomena psułaby cache przeglądarki i testy. Esri ma odwrotną
 * kolejność `{z}/{y}/{x}` (`ASSETS` §1) — podstawiamy po nazwach, nie po kolei.
 *
 * @returns {string|null} URL albo `null`, gdy podkład jest wyłączony
 */
export function urlKafelka(podklad, z, x, y) {
  sprawdzPodklad(podklad);
  const szablon = SZABLONY_KAFELKOW[podklad];
  if (szablon === null) return null;
  for (const v of [z, x, y]) {
    if (!Number.isInteger(v) || v < 0) throw new TypeError('urlKafelka: z/x/y to liczby całkowite ≥ 0');
  }
  const poddomena = PODDOMENY[(x + y) % PODDOMENY.length];
  return szablon
    .replace('{s}', poddomena)
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

/**
 * Lista kafelków do narysowania: widoczny zakres z `geo.siatkaKafelkow()`
 * plus margines, w **jednostkach świata** (warstwa kafelków dostaje jeden
 * `transform`, więc pan nie przebudowuje listy — tylko go przesuwa).
 *
 * @returns {{kafelki: Array, przyciete: boolean, z: number, rozmiarKafelkaSwiat: number}}
 */
export function planKafelkow(widok, rozmiar, podklad = 'osm') {
  sprawdzWidok(widok);
  sprawdzRozmiar(rozmiar);
  sprawdzPodklad(podklad);
  const maxZoom = maxZoomPodkladu(podklad);
  const puste = { kafelki: [], przyciete: false, z: 0, rozmiarKafelkaSwiat: 0 };
  if (rozmiar.szerokosc <= 0 || rozmiar.wysokosc <= 0) return puste;

  const siatka = siatkaKafelkow({ widok, rozmiar, maxZoom });
  const n = 2 ** siatka.z;
  const tx0 = Math.max(0, siatka.tx0 - MARGINES_KAFELKOW);
  const ty0 = Math.max(0, siatka.ty0 - MARGINES_KAFELKOW);
  const tx1 = Math.min(n - 1, siatka.tx1 + MARGINES_KAFELKOW);
  const ty1 = Math.min(n - 1, siatka.ty1 + MARGINES_KAFELKOW);
  const rozmiarKafelkaSwiat = SZEROKOSC_SWIATA / n;

  const kafelki = [];
  let przyciete = false;
  for (let ty = ty0; ty <= ty1; ty += 1) {
    for (let tx = tx0; tx <= tx1; tx += 1) {
      if (kafelki.length >= MAX_KAFELEK) {
        przyciete = true;
        break;
      }
      const url = urlKafelka(podklad, siatka.z, tx, ty);
      if (url === null) return { ...puste, z: siatka.z, rozmiarKafelkaSwiat };
      kafelki.push({
        url,
        z: siatka.z,
        tx,
        ty,
        x: tx * rozmiarKafelkaSwiat,
        y: ty * rozmiarKafelkaSwiat,
        rozmiar: rozmiarKafelkaSwiat,
      });
    }
    if (przyciete) break;
  }
  return { kafelki, przyciete, z: siatka.z, rozmiarKafelkaSwiat };
}

/* ------------------------------------------------------------------ *
 * Część czysta: metry na ekranie
 * ------------------------------------------------------------------ */

/**
 * Ile metrów odpowiada jednej jednostce świata w tym widoku. Jedna jednostka
 * świata to `skala` pikseli, a `metryNaPiksel` daje metry na piksel — więc
 * mnożymy (dzielenie dałoby promienie większe niż cały świat).
 */
export function metryNaJednostkeSwiata(lat, widok) {
  sprawdzWidok(widok);
  return metryNaPiksel(lat, zoomWidoku(widok)) * widok.skala;
}

/** Promień w pikselach ekranu (marker, pasek skali). */
export function promienWpikselach(metry, lat, widok) {
  sprawdzWidok(widok);
  const mpp = metryNaPiksel(lat, zoomWidoku(widok));
  return mpp > 0 ? metry / mpp : 0;
}

/** Promień w jednostkach świata (warstwy z `transform` widoku). */
export function promienWSwiecie(metry, lat, widok) {
  const mjs = metryNaJednostkeSwiata(lat, widok);
  return mjs > 0 ? metry / mjs : 0;
}

/**
 * Pasek skali: największy „ładny" krok, który mieści się w `celPx`.
 * Zwraca `null`, gdy nawet najmniejszy krok byłby krótszy niż `minPx`
 * (przy widoku na całą Ziemię pasek nie mówi nic użytecznego).
 */
export function skalaBar(widok, lat, { celPx = PASEK_SKALI.celPx, minPx = PASEK_SKALI.minPx } = {}) {
  const mpp = metryNaPiksel(lat, zoomWidoku(widok));
  if (!(mpp > 0)) return null;
  let wybrany = null;
  for (const krok of KROKI_SKALI_M) {
    if (krok / mpp <= celPx) wybrany = krok;
  }
  if (wybrany === null) return null;
  const px = wybrany / mpp;
  if (px < minPx) return null;
  return {
    metry: wybrany,
    px,
    etykieta: wybrany >= 1000 ? `${wybrany / 1000} km` : `${wybrany} m`,
  };
}

/** Opis widoku dla czytnika ekranu (dane, nie treść z JS — ADR 0015 pkt 6). */
export function etykietaWidoku(widok, rozmiar, { podklad = 'osm' } = {}) {
  const srodek = srodekWidoku(widok, rozmiar);
  const z = Math.round(zoomWidoku(widok));
  return `Mapa ${PODKLADY[podklad].etykieta}: środek ${formatujWspolrzedne(srodek.lat, srodek.lon)}, powiększenie ${z}.`;
}

/* ------------------------------------------------------------------ *
 * Część czysta: plan rysowania
 * ------------------------------------------------------------------ */

/**
 * Wszystko, co warstwa DOM ma narysować — jako zwykły obiekt.
 *
 * Warstwy `kafelki` i `okregi` dostają jeden `transform` (`przesuniecie` +
 * `skala`) i pracują w jednostkach świata, więc pan/zoom nie przebudowuje ich
 * zawartości. Warstwy `pinezki` i `marker` mają stały rozmiar na ekranie, więc
 * są liczone w pikselach i przebudowywane przy każdej zmianie widoku.
 */
export function planMapy({
  widok,
  rozmiar,
  podklad = 'osm',
  pozycja = null,
  stacje = [],
  promienM = null,
  aktywnaStacja = null,
}) {
  sprawdzWidok(widok);
  sprawdzRozmiar(rozmiar);
  sprawdzPodklad(podklad);
  if (!Array.isArray(stacje)) throw new TypeError('planMapy: stacje muszą być tablicą');

  const srodek = srodekWidoku(widok, rozmiar);
  const zoom = zoomWidoku(widok);
  const pusty = rozmiar.szerokosc <= 0 || rozmiar.wysokosc <= 0;
  const plan = planKafelkow(widok, rozmiar, podklad);
  const mjs = metryNaJednostkeSwiata(srodek.lat, widok);

  const okregi = [];
  if (!pusty && pozycja) {
    const p = projektuj(pozycja.lat, pozycja.lon);
    if (Number.isFinite(pozycja.accuracy) && pozycja.accuracy > 0) {
      okregi.push({
        typ: 'dokladnosc',
        cx: p.x,
        cy: p.y,
        r: mjs > 0 ? pozycja.accuracy / mjs : 0,
        metry: pozycja.accuracy,
      });
    }
    if (Number.isFinite(promienM) && promienM > 0) {
      okregi.push({
        typ: 'promien',
        cx: p.x,
        cy: p.y,
        r: mjs > 0 ? promienM / mjs : 0,
        metry: promienM,
      });
    }
  }

  const pinezki = pusty
    ? []
    : stacje.map((stacja, i) => {
        const ekran = punktNaEkranie(stacja.lat, stacja.lon, widok);
        return {
          id: stacja.id,
          numer: i + 1,
          x: ekran.x,
          y: ekran.y,
          dystansM: stacja.dystansM ?? stacja.odlegloscM ?? null,
          aktywna: aktywnaStacja !== null && stacja.id === aktywnaStacja,
        };
      });

  const marker =
    !pusty && pozycja
      ? {
          ...punktNaEkranie(pozycja.lat, pozycja.lon, widok),
          dokladnoscM: Number.isFinite(pozycja.accuracy) ? pozycja.accuracy : null,
        }
      : null;

  return {
    pusty,
    podklad,
    etykietaPodkladu: PODKLADY[podklad].etykieta,
    atrybucja: PODKLADY[podklad].atrybucja,
    zoom,
    srodek,
    rozmiar: { szerokosc: rozmiar.szerokosc, wysokosc: rozmiar.wysokosc },
    przesuniecie: { x: widok.x, y: widok.y },
    skala: widok.skala,
    kafelki: plan.kafelki,
    przyciete: plan.przyciete,
    z: plan.z,
    okregi,
    pinezki,
    marker,
    pasekSkali: pusty ? null : skalaBar(widok, srodek.lat),
    etykietaWidoku: pusty ? '' : etykietaWidoku(widok, rozmiar, { podklad }),
  };
}

/* ------------------------------------------------------------------ *
 * Warstwa DOM
 * ------------------------------------------------------------------ */

/**
 * Mapa wpięta w istniejący szkielet z `index.html`. Statyczne elementy
 * (svg, warstwy `<g>`, przyciski z etykietami, miejsce na atrybucję) są
 * w HTML — ten moduł nie wymyśla treści (ADR 0015 pkt 6), tylko je wypełnia.
 *
 * Oczekiwane identyfikatory dla `id = 'mapa-pozycja'`:
 * `mapa-pozycja` (panel), `-svg`, `-kafelki`, `-okregi`, `-pinezki`,
 * `-marker`, `-przybliz`, `-oddal`, `-centruj`, `-atrybucja`, `-skala`.
 * Brak panelu albo svg → `null` (aplikacja działa dalej bez mapy).
 *
 * @returns {object|null} API mapy
 */
/**
 * Próg stuknięcia (zadanie właściciela D3): ruch palca poniżej tej wartości
 * w pikselach to tap, powyżej — pan. 10 px jest z zapasem na „drżenie" palca,
 * a dość ciasne, żeby krótkie przesunięcie mapy nie przestawiało pozycji;
 * do dostrojenia po teście terenowym (rękawiczka, folia).
 */
const PROG_STUKNIECIA_PX = 10;

export function utworzMape({ id = 'mapa', podklad = 'osm', zoom = 16, srodek = null, doc = document } = {}) {
  const kontener = doc.getElementById(id);
  const svg = doc.getElementById(`${id}-svg`);
  if (!kontener || !svg) return null;

  const warstwy = {
    kafelki: doc.getElementById(`${id}-kafelki`),
    okregi: doc.getElementById(`${id}-okregi`),
    pinezki: doc.getElementById(`${id}-pinezki`),
    marker: doc.getElementById(`${id}-marker`),
  };
  const pola = {
    atrybucja: doc.getElementById(`${id}-atrybucja`),
    skala: doc.getElementById(`${id}-skala`),
  };
  const przyciski = {
    przybliz: doc.getElementById(`${id}-przybliz`),
    oddal: doc.getElementById(`${id}-oddal`),
    centruj: doc.getElementById(`${id}-centruj`),
  };

  const stan = {
    podklad,
    widok: null,
    rozmiar: rozmiarPanelu(kontener),
    pozycja: null,
    stacje: [],
    promienM: null,
    aktywnaStacja: null,
    plan: null,
    sygnaturaKafelkow: '',
    /** Środek zadany przy schowanym panelu — do zastosowania przy pierwszym rysowaniu (T2). */
    oczekujacySrodek: null,
    /** Tryb ręczny (ADR 0005 pkt 8b): pinezki-stacje można przeciągać. */
    trybReczny: false,
    onStacjaPrzesunieta: null,
    onStukniecie: null,
  };

  /** Pinezka trzymana palcem: `{ index, pointerId, lat, lon }` albo null. */
  let przeciegana = null;

  // start bez środka: Warszawa (jak w `domyslnaKonfiguracja`), a zoom nigdy
  // ponad to, co podkład naprawdę ma — inaczej prosilibyśmy o nieistniejące kafelki
  const start = srodek ?? { lat: 52.23, lon: 21.01 };
  stan.widok = widokNaSrodek({
    ...start,
    zoom: Math.min(zoom, maxZoomPodkladu(podklad)),
    rozmiar: stan.rozmiar,
  });

  /* --- rysowanie --- */

  function transformGrupy(plan) {
    return `translate(${plan.przesuniecie.x} ${plan.przesuniecie.y}) scale(${plan.skala})`;
  }

  function rysujKafelki(plan) {
    const warstwa = warstwy.kafelki;
    if (!warstwa) return;
    warstwa.setAttribute('transform', transformGrupy(plan));
    const sygnatura = plan.kafelki
      .map((k) => `${k.z}/${k.tx}/${k.ty}`)
      .join(',');
    // pan nie przebudowuje listy; pusta sygnatura (podkład wyłączony, schowany
    // panel) musi przejść dalej, inaczej warstwa zostałaby z poprzednimi kafelkami
    if (sygnatura !== '' && sygnatura === stan.sygnaturaKafelkow) return;
    stan.sygnaturaKafelkow = sygnatura;
    const elementy = plan.kafelki.map((k) => {
      const obraz = doc.createElementNS(PRZESTRZEN_SVG, 'image');
      obraz.setAttribute('href', k.url);
      obraz.setAttribute('x', k.x);
      obraz.setAttribute('y', k.y);
      obraz.setAttribute('width', k.rozmiar);
      obraz.setAttribute('height', k.rozmiar);
      obraz.setAttribute('class', 'kafelek');
      return obraz;
    });
    warstwa.replaceChildren(...elementy);
  }

  function rysujOkregi(plan) {
    const warstwa = warstwy.okregi;
    if (!warstwa) return;
    warstwa.setAttribute('transform', transformGrupy(plan));
    warstwa.replaceChildren(
      ...plan.okregi.map((o) => {
        const kolo = doc.createElementNS(PRZESTRZEN_SVG, 'circle');
        kolo.setAttribute('cx', o.cx);
        kolo.setAttribute('cy', o.cy);
        kolo.setAttribute('r', o.r);
        kolo.setAttribute('class', `okrag-${o.typ}`);
        // obrys nie może tyć wraz z zoomem — stała grubość na ekranie
        kolo.setAttribute('vector-effect', 'non-scaling-stroke');
        return kolo;
      }),
    );
  }

  function rysujPinezki(plan) {
    const warstwa = warstwy.pinezki;
    if (!warstwa) return;
    warstwa.replaceChildren(
      ...plan.pinezki.map((p, i) => {
        const klasy = ['pinezka'];
        if (p.aktywna) klasy.push('pinezka-aktywna');
        if (stan.trybReczny) klasy.push('pinezka-reczna');
        const grupa = doc.createElementNS(PRZESTRZEN_SVG, 'g');
        grupa.setAttribute('class', klasy.join(' '));
        grupa.setAttribute('transform', `translate(${p.x} ${p.y})`);
        grupa.setAttribute('data-stacja', p.id);
        if (stan.trybReczny) {
          // cel dotykowy ≥ 44 px (ADR 0011): przezroczyste koło pod pinezką
          const dotyk = doc.createElementNS(PRZESTRZEN_SVG, 'circle');
          dotyk.setAttribute('r', 24);
          dotyk.setAttribute('class', 'pinezka-dotyk');
          grupa.appendChild(dotyk);
          grupa.addEventListener('pointerdown', (z) => naPinezkaDown(z, i));
        }
        const kolo = doc.createElementNS(PRZESTRZEN_SVG, 'circle');
        kolo.setAttribute('r', 13);
        const numer = doc.createElementNS(PRZESTRZEN_SVG, 'text');
        numer.setAttribute('text-anchor', 'middle');
        numer.setAttribute('dy', '0.35em');
        numer.textContent = String(p.numer);
        grupa.appendChild(kolo);
        grupa.appendChild(numer);
        return grupa;
      }),
    );
  }

  /** Palec na pinezce w trybie ręcznym: przechwytujemy gest — pan nie startuje. */
  function naPinezkaDown(zdarzenie, index) {
    if (!stan.trybReczny || zdarzenie.pointerId === undefined) return;
    if (typeof zdarzenie.stopPropagation === 'function') zdarzenie.stopPropagation();
    przeciegana = { index, pointerId: zdarzenie.pointerId, lat: null, lon: null };
    // capture na SVG, nie na pinezce: ruch i puszczenie obsłużą istniejące
    // nasłuchy warstwy (jedno miejsce logiki gestów)
    if (typeof svg.setPointerCapture === 'function') {
      try {
        svg.setPointerCapture(zdarzenie.pointerId);
      } catch {
        /* wskaźnik poza elementem — przeciąganie i tak działa do puszczenia */
      }
    }
  }

  function rysujMarker(plan) {
    const warstwa = warstwy.marker;
    if (!warstwa) return;
    if (!plan.marker) {
      warstwa.replaceChildren();
      return;
    }
    const grupa = doc.createElementNS(PRZESTRZEN_SVG, 'g');
    grupa.setAttribute('class', 'marker');
    grupa.setAttribute('transform', `translate(${plan.marker.x} ${plan.marker.y})`);
    const kolo = doc.createElementNS(PRZESTRZEN_SVG, 'circle');
    kolo.setAttribute('r', 8);
    grupa.appendChild(kolo);
    warstwa.replaceChildren(grupa);
  }

  function rysujOpisy(plan) {
    if (pola.atrybucja) pola.atrybucja.textContent = plan.atrybucja;
    if (pola.skala) pola.skala.textContent = plan.pasekSkali ? plan.pasekSkali.etykieta : '';
    svg.setAttribute('aria-label', plan.etykietaWidoku);
    svg.setAttribute('width', plan.rozmiar.szerokosc);
    svg.setAttribute('height', plan.rozmiar.wysokosc);
    svg.setAttribute('viewBox', `0 0 ${plan.rozmiar.szerokosc} ${plan.rozmiar.wysokosc}`);
  }

  function rysuj() {
    stan.rozmiar = rozmiarPanelu(kontener);
    if (stan.oczekujacySrodek && stan.rozmiar.szerokosc > 0 && stan.rozmiar.wysokosc > 0) {
      const o = stan.oczekujacySrodek;
      stan.oczekujacySrodek = null;
      stan.widok = widokNaSrodek({ lat: o.lat, lon: o.lon, zoom: o.zoom, rozmiar: stan.rozmiar });
    }
    const plan = planMapy({
      widok: stan.widok,
      rozmiar: stan.rozmiar,
      podklad: stan.podklad,
      pozycja: stan.pozycja,
      stacje: stan.stacje,
      promienM: stan.promienM,
      aktywnaStacja: stan.aktywnaStacja,
    });
    stan.plan = plan;
    if (plan.pusty) {
      // panel jest schowany (display:none) — nie ma czego liczyć ani rysować;
      // sygnatura musi wylecieć, inaczej po pokazaniu ekranu `rysujKafelki`
      // uzna listę za aktualną i zostawi pustą warstwę
      stan.sygnaturaKafelkow = '';
      for (const warstwa of Object.values(warstwy)) if (warstwa) warstwa.replaceChildren();
      return plan;
    }
    rysujKafelki(plan);
    rysujOkregi(plan);
    rysujPinezki(plan);
    rysujMarker(plan);
    rysujOpisy(plan);
    return plan;
  }

  /* --- gesty --- */

  const aktywne = new Map();
  let ostatniaOdleglosc = null;
  /** Ślad gestu na potrzeby tap-a: `{ ruch, palce, x, y }` (D3). */
  let gest = null;

  function srodekDwochPalcow() {
    const [a, b] = [...aktywne.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function naPointerDown(zdarzenie) {
    if (zdarzenie.pointerId === undefined) return;
    if (przeciegana) return; // palec trzyma pinezkę — widok stoi w miejscu
    aktywne.set(zdarzenie.pointerId, { x: zdarzenie.clientX, y: zdarzenie.clientY });
    if (typeof svg.setPointerCapture === 'function') {
      try {
        svg.setPointerCapture(zdarzenie.pointerId);
      } catch {
        /* palec poza elementem — nic nie szkodzi, pan i tak działa */
      }
    }
    if (aktywne.size === 1) {
      gest = { ruch: 0, palce: 1, x: zdarzenie.clientX, y: zdarzenie.clientY };
    }
    if (aktywne.size === 2) {
      ostatniaOdleglosc = odlegloscPalcow();
      if (gest) gest.palce = 2; // pinch dyskwalifikuje tap
    }
  }

  function odlegloscPalcow() {
    const [a, b] = [...aktywne.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function naPointerMove(zdarzenie) {
    if (przeciegana && zdarzenie.pointerId === przeciegana.pointerId) {
      const rect = rozmiarPanelu(kontener);
      const geo = wspolrzedneZEkranu(
        zdarzenie.clientX - (rect.lewa ?? 0),
        zdarzenie.clientY - (rect.gorna ?? 0),
        stan.widok,
      );
      // siatka ~0.1 m: bez drżenia liczb na liście stacji
      przeciegana.lat = Math.round(geo.lat * 1e6) / 1e6;
      przeciegana.lon = Math.round(geo.lon * 1e6) / 1e6;
      stan.stacje = stan.stacje.map((s, i) => (
        i === przeciegana.index ? { ...s, lat: przeciegana.lat, lon: przeciegana.lon } : s
      ));
      rysuj();
      return;
    }
    const punkt = aktywne.get(zdarzenie.pointerId);
    if (!punkt) return;
    const poprzedni = { x: punkt.x, y: punkt.y };
    punkt.x = zdarzenie.clientX;
    punkt.y = zdarzenie.clientY;

    if (aktywne.size === 1) {
      if (gest) gest.ruch += Math.abs(zdarzenie.clientX - poprzedni.x) + Math.abs(zdarzenie.clientY - poprzedni.y);
      stan.widok = przesunWidok(stan.widok, zdarzenie.clientX - poprzedni.x, zdarzenie.clientY - poprzedni.y);
      rysuj();
      return;
    }
    if (aktywne.size === 2) {
      const teraz = odlegloscPalcow();
      if (ostatniaOdleglosc && teraz > 0) {
        stan.widok = zmienSkale(stan.widok, teraz / ostatniaOdleglosc, {
          punkt: srodekDwochPalcow(),
          maxZoom: maxZoomPodkladu(stan.podklad),
        });
        rysuj();
      }
      ostatniaOdleglosc = teraz;
    }
  }

  function naPointerUp(zdarzenie) {
    if (przeciegana && zdarzenie.pointerId === przeciegana.pointerId) {
      const { index, lat, lon } = przeciegana;
      przeciegana = null;
      if (typeof svg.releasePointerCapture === 'function') {
        try {
          svg.releasePointerCapture(zdarzenie.pointerId);
        } catch {
          /* już zwolniony */
        }
      }
      // bez ruchu palca lat/lon są null — pinezka zostaje, gdzie była
      if (lat !== null && stan.onStacjaPrzesunieta) stan.onStacjaPrzesunieta(index, { lat, lon });
      return;
    }
    aktywne.delete(zdarzenie.pointerId);
    if (aktywne.size < 2) ostatniaOdleglosc = null;
    if (typeof svg.releasePointerCapture === 'function') {
      try {
        svg.releasePointerCapture(zdarzenie.pointerId);
      } catch {
        /* wskaźnik już zwolniony */
      }
    }
    // Tap (zadanie D3): jeden palec, ruch poniżej progu, bez pinch-a w trakcie
    // i wyłącznie na prawdziwy `pointerup` (pointercancel = gest przerwany,
    // np. przez przewijanie — pozycji nie przestawiamy).
    if (aktywne.size === 0) {
      if (gest && gest.palce === 1 && gest.ruch < PROG_STUKNIECIA_PX
        && zdarzenie.type === 'pointerup' && typeof stan.onStukniecie === 'function') {
        const rect = rozmiarPanelu(kontener);
        const geo = wspolrzedneZEkranu(gest.x - (rect.lewa ?? 0), gest.y - (rect.gorna ?? 0), stan.widok);
        // siatka ~0.1 m jak przy przeciąganiu pinezek — bez drżenia liczb
        stan.onStukniecie({
          lat: Math.round(geo.lat * 1e6) / 1e6,
          lon: Math.round(geo.lon * 1e6) / 1e6,
        });
      }
      gest = null;
    }
  }

  function naKolo(zdarzenie) {
    // kółko myszy na pulpicie; na telefonie i tak jest pinch
    if (typeof zdarzenie.preventDefault === 'function') zdarzenie.preventDefault();
    const rect = rozmiarPanelu(kontener);
    const punkt = {
      x: (zdarzenie.clientX ?? rect.szerokosc / 2) - (rect.lewa ?? 0),
      y: (zdarzenie.clientY ?? rect.wysokosc / 2) - (rect.gorna ?? 0),
    };
    const mnoznik = zdarzenie.deltaY > 0 ? 0.8 : 1.25;
    stan.widok = zmienSkale(stan.widok, mnoznik, {
      punkt,
      maxZoom: maxZoomPodkladu(stan.podklad),
    });
    rysuj();
  }

  const nasluchy = [
    [svg, 'pointerdown', naPointerDown],
    [svg, 'pointermove', naPointerMove],
    [svg, 'pointerup', naPointerUp],
    [svg, 'pointercancel', naPointerUp],
    [svg, 'wheel', naKolo, { passive: false }],
  ];

  function naPrzycisk(akcja) {
    const rect = rozmiarPanelu(kontener);
    const centrum = { x: rect.szerokosc / 2, y: rect.wysokosc / 2 };
    if (akcja === 'przybliz') {
      stan.widok = zmienSkale(stan.widok, 2, { punkt: centrum, maxZoom: maxZoomPodkladu(stan.podklad) });
    } else if (akcja === 'oddal') {
      stan.widok = zmienSkale(stan.widok, 0.5, { punkt: centrum, maxZoom: maxZoomPodkladu(stan.podklad) });
    } else if (akcja === 'centruj') {
      if (!stan.pozycja) return;
      stan.widok = widokNaSrodek({
        lat: stan.pozycja.lat,
        lon: stan.pozycja.lon,
        zoom: zoomWidoku(stan.widok),
        rozmiar: rect,
      });
    }
    rysuj();
  }

  for (const [akcja, przycisk] of Object.entries(przyciski)) {
    if (!przycisk) continue;
    nasluchy.push([przycisk, 'click', () => naPrzycisk(akcja)]);
  }

  for (const [el, typ, fn, opcje] of nasluchy) {
    if (!el) continue;
    el.addEventListener(typ, fn, opcje);
  }

  rysuj();

  return {
    id,
    /** Ostatni plan (dla testów i dla warstwy aplikacji). */
    plan: () => stan.plan,
    widok: () => ({ ...stan.widok }),
    rozmiar: () => ({ ...stan.rozmiar }),
    /** Ustawia środek i (opcjonalnie) zoom, potem przerysowuje. */
    ustawSrodek({ lat, lon, zoom: z = null }) {
      const zoomDocelowy = Math.min(z ?? zoomWidoku(stan.widok), maxZoomPodkladu(stan.podklad));
      const rozmiar = rozmiarPanelu(kontener);
      if (rozmiar.szerokosc <= 0 || rozmiar.wysokosc <= 0) {
        // Schowany panel: widok policzony teraz kotwiczyłby środek w lewym
        // górnym rogu, a po pokazaniu mapa byłaby przesunięta o pół ekranu
        // na wschód i południe (T2/Partia 2). Odkładamy do pierwszego rysowania.
        stan.oczekujacySrodek = { lat, lon, zoom: zoomDocelowy };
        return rysuj();
      }
      stan.oczekujacySrodek = null;
      stan.widok = widokNaSrodek({ lat, lon, zoom: zoomDocelowy, rozmiar });
      return rysuj();
    },
    ustawPodklad(klucz) {
      sprawdzPodklad(klucz);
      stan.podklad = klucz;
      stan.sygnaturaKafelkow = ''; // inne URL-e — lista musi powstać od nowa
      const rect = rozmiarPanelu(kontener);
      stan.widok = zmienSkale(stan.widok, 1, {
        punkt: { x: rect.szerokosc / 2, y: rect.wysokosc / 2 },
        maxZoom: maxZoomPodkladu(klucz),
      });
      return rysuj();
    },
    /** Fix z `pozycja.js` (`{lat, lon, accuracy}`) → marker i koło dokładności. */
    pokazPozycje(pozycja) {
      stan.pozycja = pozycja ?? null;
      return rysuj();
    },
    /** Stacje z `stacje.js` + okrąg promienia gry. */
    zaznaczStacje(stacje, { promienM = null, aktywna = null } = {}) {
      stan.stacje = Array.isArray(stacje) ? stacje : [];
      stan.promienM = promienM;
      stan.aktywnaStacja = aktywna;
      return rysuj();
    },
    /**
     * Tryb ręczny (ADR 0005 pkt 8b): pinezki-stacje można przeciągać.
     * `onZmiana(indexStacji, {lat, lon})` wołane raz, po puszczeniu palca.
     */
    ustawTrybReczny(aktywny, onZmiana = null) {
      stan.trybReczny = Boolean(aktywny);
      stan.onStacjaPrzesunieta = typeof onZmiana === 'function' ? onZmiana : null;
      if (!stan.trybReczny) przeciegana = null;
      return rysuj();
    },
    /**
     * Nasłuch krótkiego stuknięcia (zadanie właściciela D3): `fn({lat, lon})`
     * wołane po czystym tap-ie (jeden palec, ruch < 10 px, bez pinch-a).
     * Bramkowanie sensu (tryb testowy, ekran) zostaje po stronie aplikacji.
     */
    ustawNasluchStukniecia(fn) {
      stan.onStukniecie = typeof fn === 'function' ? fn : null;
    },
    przybliz: () => naPrzycisk('przybliz'),
    oddal: () => naPrzycisk('oddal'),
    centrujNaPozycji: () => naPrzycisk('centruj'),
    /** Przelicza rozmiar panelu (ekran był schowany → pokazał się). */
    odswiez: () => rysuj(),
    zniszcz() {
      for (const [el, typ, fn] of nasluchy) {
        if (el && typeof el.removeEventListener === 'function') el.removeEventListener(typ, fn);
      }
      nasluchy.length = 0;
      for (const warstwa of Object.values(warstwy)) if (warstwa) warstwa.replaceChildren();
      aktywne.clear();
      przeciegana = null;
      stan.plan = null;
    },
  };
}

/** Rozmiar panelu w pikselach; dla panelu schowanego zwraca zera. */
export function rozmiarPanelu(kontener) {
  if (!kontener || typeof kontener.getBoundingClientRect !== 'function') {
    return { szerokosc: 0, wysokosc: 0, lewa: 0, gorna: 0 };
  }
  const rect = kontener.getBoundingClientRect();
  return {
    szerokosc: Number.isFinite(rect.width) ? rect.width : 0,
    wysokosc: Number.isFinite(rect.height) ? rect.height : 0,
    lewa: Number.isFinite(rect.left) ? rect.left : 0,
    gorna: Number.isFinite(rect.top) ? rect.top : 0,
  };
}

/* ------------------------------------------------------------------ *
 * Walidacja argumentów (spójne kody błędów jak w `geo.js`)
 * ------------------------------------------------------------------ */

function sprawdzWidok(widok) {
  if (!widok || !Number.isFinite(widok.x) || !Number.isFinite(widok.y) || !(widok.skala > 0)) {
    throw new TypeError('widok musi mieć postaci {x, y, skala > 0}');
  }
}

function sprawdzRozmiar(rozmiar) {
  if (
    !rozmiar ||
    !Number.isFinite(rozmiar.szerokosc) ||
    !Number.isFinite(rozmiar.wysokosc) ||
    rozmiar.szerokosc < 0 ||
    rozmiar.wysokosc < 0
  ) {
    throw new TypeError('rozmiar musi mieć postaci {szerokosc ≥ 0, wysokosc ≥ 0}');
  }
}

/** Współrzędne muszą być liczbami w zakresie — `projektuj` z NaN nie rzuca. */
function sprawdzWspolrzedne(lat, lon) {
  if (!czyWspolrzedneOk(lat, lon)) {
    throw new TypeError(`współrzędne poza zakresem: ${lat}, ${lon}`);
  }
}

function sprawdzPodklad(podklad) {
  if (!Object.prototype.hasOwnProperty.call(PODKLADY, podklad)) {
    throw new TypeError(`nieznany podkład: ${podklad}`);
  }
}
