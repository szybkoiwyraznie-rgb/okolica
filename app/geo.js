/**
 * geo.js — geodezja i projekcja: czyste funkcje, bez DOM i bez sieci.
 *
 * Wszystko, co liczy odległości, kąty i współrzędne ekranowe gry. Moduł jest
 * testowalny w Node (`test/geo.test.js`) i nie wolno w nim używać API Node
 * (LESSONS L6). Jednostki: metry, stopnie, piksele — jawnie w nazwach.
 *
 * Model Ziemi: kula o promieniu średnim WGS84. Dla skali gry (25 m – 50 km)
 * błąd modelu kulistego jest wielokrotnie mniejszy od dokładności GPS, więc
 * Vincenty/ellipsoid nie jest potrzebny (ADR 0004, ARCHITECTURE §algorytmy).
 */

/** Promień średni Ziemi (WGS84) w metrach — do odległości (haversine). */
export const PROMIEN_ZIEMI_M = 6371008.8;

/**
 * Półoś wielka WGS84 w metrach — tej wartości używa Web Mercator (EPSG:3857)
 * i standard kafelków XYZ. Dwie stałe są celowe: odległości liczymy na kuli
 * o promieniu średnim (mniejszy błąd dystansu), a projekcję i zoom — na
 * sferze Mercatora (zgodność z kafelkami dostawców, ADR 0003).
 */
export const POLOS_WGS84_M = 6378137;

/** Rozmiar świata w jednostkach wewnętrznych renderera (jak w AME: 3600). */
export const SZEROKOSC_SWIATA = 3600;

/** Granica Web Mercatora (stopnie): dalej projekcja się rozjeżdża. */
export const GRANICA_MERCATORA = 85.05112878;

/** Rozmiar kafelka podkładu w pikselach (standard XYZ, ADR 0003). */
export const ROZMIAR_KAFELKA = 256;

/** Metry na piksel dla z=0 na równiku: 156543.03392 = 2π·a / 256 (Web Mercator). */
export const MPP_Z0 = (2 * Math.PI * POLOS_WGS84_M) / ROZMIAR_KAFELKA;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Ogranicza wartość do przedziału (odpowiednik AME `ogranicz`). */
export function ogranicz(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Sprawdza, czy współrzędne mają sens (protokół PYT §3.1, kod E17). */
export function czyWspolrzedneOk(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/**
 * Odległość w metrach między dwoma punktami `{lat, lon}` (haversine).
 * Zwraca 0 dla punktów identycznych; rzuca dla współrzędnych bez sensu.
 */
export function odlegloscM(a, b) {
  if (!czyWspolrzedneOk(a?.lat, a?.lon) || !czyWspolrzedneOk(b?.lat, b?.lon)) {
    throw new TypeError('odlegloscM: współrzędne poza zakresem');
  }
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * PROMIEN_ZIEMI_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Kąt (azymut) w stopniach 0–360 z `a` do `b`; 0 = północ, 90 = wschód. */
export function bearingStopnie(a, b) {
  const lat1 = a.lat * RAD;
  const lat2 = b.lat * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * DEG + 360) % 360;
}

/** Punkt odległy o `dystansM` od `p` w kierunku `bearing` (destination point). */
export function przesunPunkt(p, bearing, dystansM) {
  const d = dystansM / PROMIEN_ZIEMI_M;
  const brg = bearing * RAD;
  const lat1 = p.lat * RAD;
  const lon1 = p.lon * RAD;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg));
  const lon2 =
    lon1 +
    Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: lat2 * DEG, lon: ((lon2 * DEG + 540) % 360) - 180 };
}

/**
 * `ile` punktów równomiernie na okręgu o promieniu `promienM` wokół `srodek`,
 * z opcjonalnym obrotem `offsetStopnie` (0 = północ). Deterministyczne.
 * Używane m.in. przez tryb uproszczony stacji (ADR 0005 pkt 8).
 */
export function punktyNaOkregu(srodek, promienM, ile, offsetStopnie = 0) {
  if (!Number.isInteger(ile) || ile < 1) throw new TypeError('punktyNaOkregu: ile >= 1');
  const krok = 360 / ile;
  return Array.from({ length: ile }, (_, i) =>
    przesunPunkt(srodek, (offsetStopnie + i * krok) % 360, promienM),
  );
}

/** Projekcja Web Mercator: `{lat, lon}` → `{x, y}` w jednostkach świata. */
export function projektuj(lat, lon) {
  const latOgr = ogranicz(lat, -GRANICA_MERCATORA, GRANICA_MERCATORA);
  const x = ((lon + 180) / 360) * SZEROKOSC_SWIATA;
  const y =
    ((180 - (Math.log(Math.tan(Math.PI / 4 + (latOgr * RAD) / 2)) * DEG)) / 360) * SZEROKOSC_SWIATA;
  return { x, y };
}

/** Odwrotność `projektuj`: jednostki świata → `{lat, lon}`. */
export function odwroc(x, y) {
  const lon = (x / SZEROKOSC_SWIATA) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (y / SZEROKOSC_SWIATA);
  const lat = DEG * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lon };
}

/** Metry na piksel ekranowy dla danego zoomu i szerokości geograficznej. */
export function metryNaPiksel(lat, z) {
  return (MPP_Z0 * Math.cos(ogranicz(lat, -GRANICA_MERCATORA, GRANICA_MERCATORA) * RAD)) / 2 ** z;
}

/**
 * Zoom, przy którym promień gry zajmuje `udzialEkranu` szerokości widoku.
 * Czysta funkcja: `dopasujZoomDoPromienia(1000, 360, 52.23)` → 17 (±1).
 */
export function dopasujZoomDoPromienia(promienM, szerokoscPx, lat, { udzialEkranu = 0.4, min = 1, max = 19 } = {}) {
  if (!(promienM > 0) || !(szerokoscPx > 0)) throw new TypeError('dopasujZoomDoPromienia: dodatnie argumenty');
  const mppDocelowe = promienM / (udzialEkranu * szerokoscPx);
  const cosLat = Math.cos(ogranicz(lat, -GRANICA_MERCATORA, GRANICA_MERCATORA) * RAD) || 1e-6;
  const z = Math.log2((MPP_Z0 * cosLat) / mppDocelowe);
  return ogranicz(Math.round(z), min, max);
}

/** Współrzędne → `{x, y}` kafelka dla zoomu `z` (schemat XYZ). */
export function wspolrzedneDoKafelka(lat, lon, z) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const latR = ogranicz(lat, -GRANICA_MERCATORA, GRANICA_MERCATORA) * RAD;
  const y = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
  return { x, y };
}

/**
 * Zakres kafelków do narysowania: z widoku (środek świata + skala) i rozmiaru
 * kontenera w pikselach. Zwraca `{z, tx0, ty0, tx1, ty1}` ograniczone do
 * poprawnych indeksów. Mechanizm jak w AME `rysujPodkladOnline()` (ADR 0003).
 */
export function siatkaKafelkow({ widok, rozmiar, maxZoom = 19 }) {
  const z = ogranicz(Math.round(Math.log2((widok.skala * SZEROKOSC_SWIATA) / ROZMIAR_KAFELKA)), 0, maxZoom);
  const rozmiarKafelkaSwiat = SZEROKOSC_SWIATA / 2 ** z;
  const wx0 = (0 - widok.x) / widok.skala;
  const wy0 = (0 - widok.y) / widok.skala;
  const wx1 = (rozmiar.szerokosc - widok.x) / widok.skala;
  const wy1 = (rozmiar.wysokosc - widok.y) / widok.skala;
  const n = 2 ** z;
  return {
    z,
    tx0: ogranicz(Math.floor(wx0 / rozmiarKafelkaSwiat), 0, n - 1),
    ty0: ogranicz(Math.floor(wy0 / rozmiarKafelkaSwiat), 0, n - 1),
    tx1: ogranicz(Math.floor(wx1 / rozmiarKafelkaSwiat), 0, n - 1),
    ty1: ogranicz(Math.floor(wy1 / rozmiarKafelkaSwiat), 0, n - 1),
  };
}

export const ALFABET_GEOHASH = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Geohash o zadanej precyzji (1–12). Precyzja 6 ≈ 1,2 × 0,61 km — klucz cache
 * sieci drogowej (ADR 0010); precyzja 5 ≈ 4,9 × 4,9 km — paczki publiczne
 * (ADR 0013 pkt 6). Deterministyczny, bez zaokrągleń zależnych od locale.
 */
export function geohash(lat, lon, precyzja = 6) {
  if (!czyWspolrzedneOk(lat, lon)) throw new TypeError('geohash: współrzędne poza zakresem');
  if (!Number.isInteger(precyzja) || precyzja < 1 || precyzja > 12) throw new TypeError('geohash: precyzja 1–12');
  let przedzialLat = [-90, 90];
  let przedzialLon = [-180, 180];
  let wynik = '';
  let bit = 0;
  let znak = 0;
  let nawet = true; // nawet = dzielimy długość, nieparzyste = szerokość
  while (wynik.length < precyzja) {
    if (nawet) {
      const srodek = (przedzialLon[0] + przedzialLon[1]) / 2;
      if (lon >= srodek) { znak = znak * 2 + 1; przedzialLon = [srodek, przedzialLon[1]]; }
      else { znak *= 2; przedzialLon = [przedzialLon[0], srodek]; }
    } else {
      const srodek = (przedzialLat[0] + przedzialLat[1]) / 2;
      if (lat >= srodek) { znak = znak * 2 + 1; przedzialLat = [srodek, przedzialLat[1]]; }
      else { znak *= 2; przedzialLat = [przedzialLat[0], srodek]; }
    }
    nawet = !nawet;
    if (++bit === 5) {
      wynik += ALFABET_GEOHASH[znak];
      bit = 0;
      znak = 0;
    }
  }
  return wynik;
}

/** Formatowanie współrzędnych do promptu i do URL-i (5 miejsc ≈ 1 m). */
export function formatujWspolrzedne(lat, lon, miejsca = 5) {
  return `${lat.toFixed(miejsca)}, ${lon.toFixed(miejsca)}`;
}

/* --- parsowanie współrzędnych z pól tekstowych (zadanie właściciela D2) --- */

/** Komunikaty parsera — trafiają wprost pod pola współrzędnych (rola=alert). */
export const KOMUNIKATY_WSPOLRZEDNYCH = {
  puste: 'Wpisz obie współrzędne: szerokość i długość (stopnie dziesiętne, np. 52.23178 i 21.01234) albo wklej parę z Google Maps: 52°07\'22.9"N 20°44\'46.1"E.',
  'brak-lat': 'Brak szerokości geograficznej — wpisz ją w pierwszym polu (albo wklej obie współrzędne w jedno pole).',
  'brak-lon': 'Brak długości geograficznej — wpisz ją w drugim polu albo wklej obie współrzędne w pierwsze, np. 52°07\'22.9"N 20°44\'46.1"E (Google Maps) lub 52.123028, 20.746139.',
  format: 'Nie rozpoznano formatu współrzędnych. Przykłady: 52.23178 (dziesiętnie), 52°07\'22.9"N (stopnie-minuty-sekundy), para w jednym polu: 52°07\'22.9"N 20°44\'46.1"E albo 52.123028, 20.746139.',
  minuty: 'Minuty i sekundy muszą być mniejsze niż 60 — poprawny zapis to np. 52°07\'22.9"N (52°75\'... nie istnieje).',
  os: 'Szerokość geograficzną poznaję po literze N lub S, długość po E albo W — i potrzebuję dokładnie jednej z każdej osi.',
  konflikt: 'Pierwsze pole zawiera już parę współrzędnych — drugie pole zostaw puste.',
};

/**
 * Składnik współrzędnej: liczba dziesiętna (`52.123`, `52,123`) albo zapis
 * stopnie-minuty-sekundy z opcjonalną literą (`52°07'22.9"N`, `52°7′22.9″N`,
 * `52 7 22.9 N`). Stopnie z ułamkiem TYLKO bez minut (inaczej zapis jest
 * niejednoznaczny); minuty i sekundy < 60 (jawna odmowa, nie ciche
 * „przeliczenie"). `S`/`W` dają znak ujemny.
 *
 * @param {string} tekst pojedyncze pole (już znormalizowane białe znaki)
 * @param {string} dozwoloneLitery np. `'NS'` dla szerokości — litera spoza
 *   zestawu to jawny błąd osi (użytkownik pomylił pola), nie zgadywanie
 * @returns {{ ok: true, wartosc: number, litera: string } | { ok: false, powod: string }}
 */
function sprobujSkladnik(tekst, dozwoloneLitery) {
  const zNorm = tekst.replace(/,/g, '.');
  const re = /^(-?)(\d{1,3})(?:\.(\d+))?\s*°?\s*(?:(\d{1,2})(?:\.(\d+))?\s*['′’]?\s*(?:(\d{1,2})(?:\.(\d+))?\s*["″”]?\s*)?)?([NSWE])?$/i;
  const m = re.exec(zNorm);
  if (!m) return { ok: false, powod: 'format' };
  const [, minus, degS, degFracS, minS, minFracS, secS, secFracS, literaSurowa] = m;
  const litera = (literaSurowa ?? '').toUpperCase();
  if (litera && !dozwoloneLitery.includes(litera)) return { ok: false, powod: 'os' };
  if (degFracS !== undefined && minS !== undefined) return { ok: false, powod: 'format' };
  const min = minS === undefined ? 0 : Number(minS + (minFracS ? `.${minFracS}` : ''));
  const sec = secS === undefined ? 0 : Number(secS + (secFracS ? `.${secFracS}` : ''));
  if (!(min < 60)) return { ok: false, powod: 'minuty' };
  if (!(sec < 60)) return { ok: false, powod: 'minuty' };
  let wartosc = Number(degS + (degFracS ? `.${degFracS}` : '')) + min / 60 + sec / 3600;
  if (minus === '-' || litera === 'S' || litera === 'W') wartosc = -wartosc;
  return { ok: true, wartosc, litera };
}

/**
 * Para współrzędnych w JEDNYM polu (wklejenie z Google Maps): DMS z literami
 * osi w dowolnej kolejności (`52°07'22.9"N 20°44'46.1"E`, też E-przed-N)
 * albo dziesiętna (`52.123028, 20.746139` / `52.123 20.746`).
 *
 * Separator dziesiętny: przecinek ZE spacją, spacja albo średnik — sam
 * przecinek NIE jest separatorem, bo `52,123` to po polsku jedna liczba
 * (52.123), a nie para (52; 123). Wieloznaczny `52.123,20.746` (przecinek
 * bez spacji) jest jawnie odrzucony niżej w `sprobujSkladnik`.
 */
function sprobujPare(tekst) {
  const niePara = { ok: false, powod: 'to-nie-para' };
  const skl = String.raw`-?\d{1,3}(?:[.,]\d+)?\s*°?\s*(?:\d{1,2}(?:[.,]\d+)?\s*['′’]?\s*(?:\d{1,2}(?:[.,]\d+)?\s*["″”]?\s*)?)?[NSWE]`;
  const mDms = new RegExp(`^(${skl})[\\s,;]+(${skl})$`, 'i').exec(tekst);
  if (mDms) {
    const pierwszy = sprobujSkladnik(mDms[1], 'NSWE');
    const drugi = sprobujSkladnik(mDms[2], 'NSWE');
    if (!pierwszy.ok) return { ok: false, powod: pierwszy.powod };
    if (!drugi.ok) return { ok: false, powod: drugi.powod };
    const jestLat = (s) => s.litera === 'N' || s.litera === 'S';
    if (jestLat(pierwszy) === jestLat(drugi)) return { ok: false, powod: 'os' };
    const lat = jestLat(pierwszy) ? pierwszy.wartosc : drugi.wartosc;
    const lon = jestLat(pierwszy) ? drugi.wartosc : pierwszy.wartosc;
    return { ok: true, lat, lon, format: 'para-dms' };
  }
  const mDz = /^(-?\d+(?:[.,]\d+)?)(?:,\s+|\s+|;)\s*(-?\d+(?:[.,]\d+)?)$/.exec(tekst);
  if (mDz) {
    return {
      ok: true,
      lat: Number(mDz[1].replace(',', '.')),
      lon: Number(mDz[2].replace(',', '.')),
      format: 'para-dziesietna',
    };
  }
  return niePara;
}

/**
 * Parser współrzędnych z pól tekstowych ekranu pozycji (zadanie właściciela
 * z 2026-09-06): dziesiętne (kropka albo polski przecinek), DMS z Google Maps
 * i pełna para w jednym polu. Czysta funkcja, bez wyjątków — odmowa wraca
 * jako `{ ok: false, powod, komunikat }` i UI pokazuje ją JAWNIE pod polami
 * (nigdy cicho, ADR 0010 pkt 6). Zakres dziesiętny (-90..90 / -180..180)
 * sprawdza dalej `ocenFix` — parser pilnuje tylko formatu i minut/sekund.
 *
 * Round-trip z `formatujWspolrzedne`: wynik sformatowany tą funkcją daje się
 * sparsować z powrotem (test).
 *
 * @param {string} surowyLat zawartość pierwszego pola (lat albo para)
 * @param {string} [surowyLon] zawartość drugiego pola (lon; puste przy parze)
 * @returns {{ ok: true, lat: number, lon: number, zPary: boolean, format: string }
 *          | { ok: false, powod: string, komunikat: string }}
 */
export function parsujWspolrzedne(surowyLat, surowyLon = '') {
  const tekstLat = String(surowyLat ?? '').replace(/\s+/g, ' ').trim();
  const tekstLon = String(surowyLon ?? '').replace(/\s+/g, ' ').trim();
  const odmowa = (powod) => ({ ok: false, powod, komunikat: KOMUNIKATY_WSPOLRZEDNYCH[powod] ?? KOMUNIKATY_WSPOLRZEDNYCH.format });
  if (!tekstLat && !tekstLon) return odmowa('puste');
  if (!tekstLat) return odmowa('brak-lat');
  const para = sprobujPare(tekstLat);
  if (para.ok) {
    if (tekstLon) return odmowa('konflikt');
    return { ok: true, lat: para.lat, lon: para.lon, zPary: true, format: para.format };
  }
  if (para.powod !== 'to-nie-para') return odmowa(para.powod);
  const lat = sprobujSkladnik(tekstLat, 'NS');
  if (!lat.ok) return odmowa(lat.powod);
  if (!tekstLon) return odmowa('brak-lon');
  const lon = sprobujSkladnik(tekstLon, 'EW');
  if (!lon.ok) return odmowa(lon.powod);
  const dms = Boolean(lat.litera || lon.litera) || /\d\s*°/.test(tekstLat) || /\d\s*°/.test(tekstLon);
  return { ok: true, lat: lat.wartosc, lon: lon.wartosc, zPary: false, format: dms ? 'dms' : 'dziesietne' };
}

/** ADR 0034: stały dystans dojścia, niezależny od accuracy. */
export function progDojsciaM() { return 50; }

/** Pojedynczy najnowszy fix w promieniu 50 m wystarcza. */
export function czyDotarl(historia, stacja, { wymaganeTrafnienia = 1 } = {}) {
  if (!Array.isArray(historia) || historia.length === 0) return { dotarl: false, trafienia: 0, progM: 0, dystansM: Infinity };
  const ostatni = historia[historia.length - 1];
  const progM = progDojsciaM();
  const dystansM = odlegloscM(ostatni, stacja);
  let trafienia = 0;
  for (let i = historia.length - 1; i >= 0 && trafienia < wymaganeTrafnienia; i--) {
    if (odlegloscM(historia[i], stacja) <= progDojsciaM()) trafienia++;
    else break;
  }
  return { dotarl: trafienia >= wymaganeTrafnienia, trafienia, progM, dystansM };
}

/* ------------------------------------- komórki geohash: ramka, sąsiedzi, odległość */

/**
 * Ramka bounding-box geohasha (dekoder do pary z `geohash`).
 *
 * Przeniesione z `app/wieloosobowa.js` (2026-09-07): to geodezja, nie gra
 * wieloosobowa, a potrzebują jej dwie dziedziny — lobby (ADR 0019 pkt 1)
 * i dopasowanie zestawów pytań (ADR 0024).
 */
export function ramkaGeohash(gh) {
  const tekst = String(gh ?? '').toLowerCase();
  if (!tekst.length) return null;
  let latMin = -90; let latMax = 90; let lonMin = -180; let lonMax = 180;
  let nawetLon = true;
  for (const znak of tekst) {
    const v = ALFABET_GEOHASH.indexOf(znak);
    if (v < 0) return null;
    for (let bit = 4; bit >= 0; bit -= 1) {
      const b = (v >> bit) & 1;
      if (nawetLon) {
        const srodek = (lonMin + lonMax) / 2;
        if (b) lonMin = srodek; else lonMax = srodek;
      } else {
        const srodek = (latMin + latMax) / 2;
        if (b) latMin = srodek; else latMax = srodek;
      }
      nawetLon = !nawetLon;
    }
  }
  return { latMin, latMax, lonMin, lonMax };
}

/**
 * Osiem komórek sąsiadujących z geohashem (ta sama precyzja) — lobby gier
 * „w najbliższej okolicy" = własna komórka + sąsiedzi (ADR 0019 pkt 1).
 * Geometrycznie: środek komórki przesunięty o jej rozmiar w 8 kierunkach,
 * zakodowany z powrotem tym samym `geohash` (jedno źródło prawdy).
 */
export function sasiednieGeohash(gh) {
  const r = ramkaGeohash(gh);
  if (!r) return [];
  const dLat = r.latMax - r.latMin;
  const dLon = r.lonMax - r.lonMin;
  const sLat = (r.latMin + r.latMax) / 2;
  const sLon = (r.lonMin + r.lonMax) / 2;
  const precyzja = String(gh).length;
  const kierunki = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const wynik = [];
  for (const [dx, dy] of kierunki) {
    const lat = ogranicz(sLat + dy * dLat, -89.9999, 89.9999);
    let lon = sLon + dx * dLon;
    while (lon > 180) lon -= 360;
    while (lon < -180) lon += 360;
    let sasiad;
    try {
      sasiad = geohash(lat, lon, precyzja);
    } catch {
      continue; // skrajne szerokości: sąsiada nie ma — lista krótsza, nie wyjątek
    }
    if (sasiad !== String(gh).toLowerCase() && !wynik.includes(sasiad)) wynik.push(sasiad);
  }
  return wynik;
}

/**
 * Odległość punktu od komórki geohash w metrach: **0, gdy punkt leży
 * w komórce** (ADR 0024 — dopasowanie okolicy z tolerancją, a nie „ten sam
 * geohash albo nic"). `null` dla śmieciowego geohasha albo złych współrzędnych
 * — odmowa jest jawna, nie cicha (LESSONS L6).
 */
export function odlegloscDoKomorkiM(gh, lat, lon) {
  const r = ramkaGeohash(gh);
  if (!r || !czyWspolrzedneOk(lat, lon)) return null;
  const najblizszaLat = ogranicz(lat, r.latMin, r.latMax);
  const najblizszyLon = ogranicz(lon, r.lonMin, r.lonMax);
  return odlegloscM({ lat, lon }, { lat: najblizszaLat, lon: najblizszyLon });
}
