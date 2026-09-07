/**
 * generuj-ikony.mjs — deterministyczny generator ikon aplikacji (M8, ADR 0011
 * pkt 9: PWA-lite „dodaj do ekranu głównego"; ADR 0001/0011 pkt 6: zero
 * zasobów zewnętrznych — ikony powstają w repo, nie pochodzą z CDN ani
 * z grafik zewnętrznych).
 *
 * Motyw: kompas z istniejącego favicona w `index.html` (zielony dysk
 * `#2f6f4f`, igła `#f6f2e9` (22,10)→(13,14)→(10,23)→(19,19), pivot r=1.8)
 * na pełnym tle `#f6f2e9` (token `--tlo` motywu jasnego) — favicon i ikona
 * na pulpicie są tym samym rysunkiem.
 *
 * Rysowanie: supersampling ×4 → box downscale (antialiasing bez zależności);
 * PNG: własny enkoder (IHDR/IDAT/IEND, CRC32, `node:zlib` deflate level 9) —
 * te same wejścia dają BAJT W BAJT te same pliki (test determinizmu w
 * `test/ikony.test.js`; pliki w git są źródłem prawdy dla Pages).
 *
 * Uruchomienie: `npm run ikony` (zapisuje `assets/ikony/*`).
 * Funkcje są eksportowane dla testów — main() odpala się TYLKO przy
 * uruchomieniu bezpośrednim (wzorzec z `generuj-fixture-overpass.mjs`).
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KATALOG = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Kolory ikony — tokeny motywu jasnego i zieleń dysku z favicona. */
export const KOLORY_ICONY = {
  tlo: [246, 242, 233], // #f6f2e9 — --tlo (styles.css :root)
  zielen: [47, 111, 79], // #2f6f4f — dysk kompasu (favicon)
  igla: [246, 242, 233], // #f6f2e9 — igła (favicon)
};

/** Geometria motywu w jednostkach viewBox 32 (identyczna z faviconem). */
export const MOTYW = {
  srodek: 16,
  promienDysku: 14,
  promienPivotu: 1.8,
  igla: [[22, 10], [13, 14], [10, 23], [19, 19]],
};

/** Współczynnik supersamplingu (antialiasing przez uśrednianie próbek). */
export const SUPERSAMPLING = 4;

/**
 * SVG ikony — ten sam motyw co PNG, viewBox 32, pełne tło (spójność
 * z PNG; system sam zamaskuje kształt na pulpicie).
 */
export const SVG_ICONY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#f6f2e9"/>
  <circle cx="16" cy="16" r="14" fill="#2f6f4f"/>
  <path d="M22 10 L13 14 L10 23 L19 19 Z" fill="#f6f2e9"/>
  <circle cx="16" cy="16" r="1.8" fill="#2f6f4f"/>
</svg>
`;

/**
 * Skalowanie motywu względem środka viewBox — podstawa wariantu maskable
 * (safe zone 80%: dysk 14 × 0,8 = 11,2 → średnica 70% szerokości).
 */
export function przeskalujMotyw(skala) {
  if (!(skala > 0)) throw new TypeError('przeskalujMotyw: skala musi być dodatnia');
  const s = MOTYW.srodek;
  return MOTYW.igla.map(([x, y]) => [s + (x - s) * skala, s + (y - s) * skala]);
}

/** Point-in-polygon (ray casting) — igła kompasu jest prostym czworokątem. */
export function punktWPolygonie(x, y, polygon) {
  let wewnatrz = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) wewnatrz = !wewnatrz;
  }
  return wewnatrz;
}

/**
 * Rasteryzacja ikony: `rozmiar × rozmiar` px, RGBA (Uint8Array).
 * `skalaMotywu < 1` daje wariant maskable (motyw mniejszy, tło pełne).
 */
export function narysujIkone(rozmiar, { skalaMotywu = 1 } = {}) {
  if (!Number.isInteger(rozmiar) || rozmiar < 1) {
    throw new TypeError('narysujIkone: rozmiar musi być liczbą całkowitą ≥ 1');
  }
  const S = SUPERSAMPLING;
  const duzy = rozmiar * S;
  const igla = przeskalujMotyw(skalaMotywu);
  const rDysk = MOTYW.promienDysku * skalaMotywu;
  const rPivot = MOTYW.promienPivotu * skalaMotywu;
  const probki = new Uint8Array(duzy * duzy * 3);
  for (let y = 0; y < duzy; y++) {
    const vy = ((y + 0.5) / duzy) * 32;
    for (let x = 0; x < duzy; x++) {
      const vx = ((x + 0.5) / duzy) * 32;
      const d = Math.hypot(vx - MOTYW.srodek, vy - MOTYW.srodek);
      let kolor = KOLORY_ICONY.tlo;
      if (d <= rDysk) kolor = KOLORY_ICONY.zielen;
      if (punktWPolygonie(vx, vy, igla)) kolor = KOLORY_ICONY.igla;
      if (d <= rPivot) kolor = KOLORY_ICONY.zielen;
      const i = (y * duzy + x) * 3;
      probki[i] = kolor[0];
      probki[i + 1] = kolor[1];
      probki[i + 2] = kolor[2];
    }
  }
  const wynik = new Uint8Array(rozmiar * rozmiar * 4);
  const n = S * S;
  for (let y = 0; y < rozmiar; y++) {
    for (let x = 0; x < rozmiar; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const i = ((y * S + sy) * duzy + (x * S + sx)) * 3;
          r += probki[i];
          g += probki[i + 1];
          b += probki[i + 2];
        }
      }
      const o = (y * rozmiar + x) * 4;
      wynik[o] = Math.round(r / n);
      wynik[o + 1] = Math.round(g / n);
      wynik[o + 2] = Math.round(b / n);
      wynik[o + 3] = 255;
    }
  }
  return wynik;
}

/* --- enkoder PNG (bez zależności; chunki IHDR/IDAT/IEND + CRC32) --- */

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC32 (wielomian PNG/zlib) — potrzebny do checksumów chunków. */
export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunkPng(typ, dane) {
  const daneBuf = Buffer.from(dane);
  const calosc = Buffer.alloc(12 + daneBuf.length);
  calosc.writeUInt32BE(daneBuf.length, 0);
  calosc.write(typ, 4, 'ascii');
  daneBuf.copy(calosc, 8);
  calosc.writeUInt32BE(crc32(calosc.subarray(4, 8 + daneBuf.length)), 8 + daneBuf.length);
  return calosc;
}

/**
 * RGBA (Uint8Array, `szerokosc × wysokosc × 4`) → bufor PNG (8 bitów/kanał,
 * color type 6, filtr None w każdym wierszu, deflate level 9 — ustalony,
 * żeby wynik był deterministyczny).
 */
export function zakodujPng(rgba, szerokosc, wysokosc) {
  if (!(rgba instanceof Uint8Array) || rgba.length !== szerokosc * wysokosc * 4) {
    throw new TypeError('zakodujPng: rgba musi mieć dokładnie szerokosc × wysokosc × 4 bajtów');
  }
  const sygnatura = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(szerokosc, 0);
  ihdr.writeUInt32BE(wysokosc, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // kompresja (deflate)
  ihdr[11] = 0; // filtr
  ihdr[12] = 0; // bez przeplotu
  const krokWiersza = szerokosc * 4 + 1;
  const surowe = Buffer.alloc(krokWiersza * wysokosc);
  for (let y = 0; y < wysokosc; y++) {
    surowe[y * krokWiersza] = 0; // filtr None
    Buffer.from(rgba.buffer, rgba.byteOffset + y * szerokosc * 4, szerokosc * 4)
      .copy(surowe, y * krokWiersza + 1);
  }
  const idat = deflateSync(surowe, { level: 9 });
  return Buffer.concat([sygnatura, chunkPng('IHDR', ihdr), chunkPng('IDAT', idat), chunkPng('IEND', Buffer.alloc(0))]);
}

/** Zestaw plików ikony — kolejność i parametry są kontraktem z manifestem. */
export function zestawIkon() {
  return [
    { nazwa: 'ikona.svg', typ: 'svg' },
    { nazwa: 'ikona-192.png', rozmiar: 192 },
    { nazwa: 'ikona-512.png', rozmiar: 512 },
    { nazwa: 'ikona-maskable-512.png', rozmiar: 512, skalaMotywu: 0.8 },
    { nazwa: 'ikona-180.png', rozmiar: 180 },
  ];
}

function main() {
  const katalogIkon = join(KATALOG, 'assets', 'ikony');
  mkdirSync(katalogIkon, { recursive: true });
  for (const pozycja of zestawIkon()) {
    if (pozycja.typ === 'svg') {
      writeFileSync(join(katalogIkon, pozycja.nazwa), SVG_ICONY);
      console.log(`OK: assets/ikony/${pozycja.nazwa} (${Buffer.byteLength(SVG_ICONY)} B)`);
      continue;
    }
    const png = zakodujPng(
      narysujIkone(pozycja.rozmiar, { skalaMotywu: pozycja.skalaMotywu ?? 1 }),
      pozycja.rozmiar,
      pozycja.rozmiar,
    );
    writeFileSync(join(katalogIkon, pozycja.nazwa), png);
    console.log(`OK: assets/ikony/${pozycja.nazwa} (${png.length} B)`);
  }
}

const czyUruchomiony = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (czyUruchomiony) main();
