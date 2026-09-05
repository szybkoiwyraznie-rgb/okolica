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

const ALFABET_GEOHASH = '0123456789bcdefghjkmnpqrstuvwxyz';

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

/**
 * Próg dojścia do stacji w metrach z dokładności fixu (ADR 0004 pkt 2):
 * `max(25 m, 1.2 × accuracy)`, ograniczony do 100 m.
 */
export function progDojsciaM(accuracyM, { min = 25, max = 100, mnoznik = 1.2 } = {}) {
  const a = Number.isFinite(accuracyM) && accuracyM > 0 ? accuracyM : max;
  return ogranicz(mnoznik * a, min, max);
}

/**
 * Rozstrzygnięcie dojścia: dystans do stacji vs próg + wymóg dwóch kolejnych
 * trafień (debounce). Czysta funkcja — przyjmuje historię fixów, nie `navigator`.
 * `trafieniaZRzedu` liczy się od końca `historia` (najnowszy fix ostatni).
 */
export function czyDotarl(historia, stacja, { wymaganeTrafnienia = 2 } = {}) {
  if (!Array.isArray(historia) || historia.length === 0) return { dotarl: false, trafienia: 0, progM: 0, dystansM: Infinity };
  const ostatni = historia[historia.length - 1];
  const progM = progDojsciaM(ostatni?.accuracy);
  const dystansM = odlegloscM(ostatni, stacja);
  let trafienia = 0;
  for (let i = historia.length - 1; i >= 0 && trafienia < wymaganeTrafnienia; i--) {
    if (odlegloscM(historia[i], stacja) <= progDojsciaM(historia[i]?.accuracy)) trafienia++;
    else break;
  }
  return { dotarl: trafienia >= wymaganeTrafnienia, trafienia, progM, dystansM };
}
