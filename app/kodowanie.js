/**
 * kodowanie.js — ukrywanie paczki pytań przed przypadkowym podglądem.
 *
 * To NIE jest szyfrowanie (ADR 0007, decyzja właściciela 2026-09-05):
 * „proste kodowanie bez klucza — ma być nieczytelne na pierwszy rzut oka przy
 * kopiowaniu, a nie zabezpieczone przed odszyfrowaniem". Przekształcenie jest
 * odwracalne przez każdego, kto przeczyta ten plik, i tak ma być. Chroni przed:
 * zerknięciem przez ramię, przewinięciem wklejonego tekstu, rozpoznaniem JSON-a
 * w schowku albo w pliku. Nie chroni przed zdeterminowanym graczem z devtools.
 *
 * Moduł jest czysty: bez DOM, bez sieci, bez `WebCrypto` (działa też poza
 * secure context), bez zależności (ADR 0001), bez API Node (LESSONS L6).
 */

/** Schemat kontenera (PROTOKOL §3.3). Pole `kodowanie` jest hakiem migracyjnym. */
export const SCHEMAT_KONTENERA = 'TO-paczka/2';

/** Nazwa przekształcenia: XOR ze strumieniem z stałego ziarna + base64url. */
export const KODOWANIE = 'b64x1';

/** Ziarno maski — jawne, stałe, bez sekretu (ADR 0007 pkt 2). */
const ZIARNO_MASKI = 'okolica:maska:b64x1:v2';

/** Rozmiar bloku przy kopiowaniu do base64 (chroni stos przy dużych paczkach). */
const BLOK = 8192;

/**
 * Strumień bajtów maski z ziarna. Celowo ten sam generator, którego używa
 * losowanie stacji (`rngZZiarna` z konfig.js) — jedna implementacja RNG w
 * projekcie, ale **inne ziarno**, więc maska nie ma związku z układem gry.
 * @param {number} dlugosc
 * @returns {Uint8Array}
 */
function strumienMaski(dlugosc) {
  // xmur3 + mulberry32 — przepisane lokalnie, żeby kodowanie.js nie zależało od
  // konfig.js (konfig importuje geo, a ten moduł ma zostać liściem grafu).
  let h = 1779033703 ^ String(ZIARNO_MASKI).length;
  for (let i = 0; i < String(ZIARNO_MASKI).length; i++) {
    h = Math.imul(h ^ String(ZIARNO_MASKI).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const bajty = new Uint8Array(dlugosc);
  for (let i = 0; i < dlugosc; i++) {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    bajty[i] = ((t ^ (t >>> 14)) >>> 0) % 256;
  }
  return bajty;
}

/** Base64url (bez dopełnienia `=`) — bezpieczne w URL, w JSON i w schowku. */
function base64url(bajty) {
  let bin = '';
  for (let i = 0; i < bajty.length; i += BLOK) {
    bin += String.fromCharCode(...bajty.subarray(i, i + BLOK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function zBase64url(tekst) {
  const b64 = String(tekst).trim().replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*$/.test(b64)) throw new Error('to nie jest base64');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bajty = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bajty[i] = bin.charCodeAt(i);
  return bajty;
}

/**
 * Suma kontrolna FNV-1a (32 bity) z bajtów plaintextu.
 * Wykrywa **przypadkowe uszkodzenie** (urwane wklejenie, zgubiony znak), nie
 * celową podmianę — to nie jest funkcja skrótu o własnościach kryptograficznych
 * i tak jest opisana w PROTOKOL §3.3.
 * @param {Uint8Array} bajty
 * @returns {string} 8 znaków szesnastkowych
 */
export function skrotFnv1a(bajty) {
  let h = 0x811c9dc5;
  for (const b of bajty) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Ukryj paczkę: JSON → UTF-8 → XOR ze strumieniem maski → base64url → kontener.
 * @param {object} paczka zwalidowana paczka PYT (PROTOKOL §3.1)
 * @param {string} wersjaProtokolu np. `PYT/1.0` — z `app/protokol.js`
 * @returns {object} kontener `TO-paczka/2`
 */
export function zapakujPaczke(paczka, wersjaProtokolu) {
  if (!paczka || typeof paczka !== 'object') throw new TypeError('paczka musi być obiektem');
  if (!wersjaProtokolu) throw new TypeError('wersjaProtokolu jest wymagana');
  const bajty = new TextEncoder().encode(JSON.stringify(paczka));
  const maska = strumienMaski(bajty.length);
  const zmieszane = new Uint8Array(bajty.length);
  for (let i = 0; i < bajty.length; i++) zmieszane[i] = bajty[i] ^ maska[i];
  return {
    schemat: SCHEMAT_KONTENERA,
    protokol: wersjaProtokolu,
    kodowanie: KODOWANIE,
    skrot: skrotFnv1a(bajty),
    dane: base64url(zmieszane),
  };
}

/**
 * Odsłoń paczkę z kontenera. Zwraca `{ paczka, blad }` — nigdy nie rzuca, bo
 * wklejony tekst bywa śmieciem i UI musi to pokazać komunikatem, nie wyjątkiem.
 * @param {object|string} kontener obiekt `TO-paczka/2` albo surowy tekst
 * @returns {{ paczka: object|null, blad: string|null, zrodlo: 'kontener'|'json'|null }}
 */
export function odpakujPaczke(kontener) {
  let obiekt = kontener;

  // tolerancja wklejenia: cały kontener jako tekst, sam blob base64, albo jawny
  // JSON paczki (protokół dopuszcza obie formy — model zwraca JSON, a aplikacja
  // po przyjęciu paczki zapisuje kontener).
  if (typeof obiekt === 'string') {
    const tekst = obiekt.trim();
    if (!tekst) return { paczka: null, blad: 'Pusty tekst — nie ma czego odczytać.', zrodlo: null };
    if (tekst.startsWith('{') || tekst.startsWith('[')) {
      try {
        obiekt = JSON.parse(tekst);
      } catch (e) {
        return { paczka: null, blad: `To nie jest poprawny JSON (${e.message}).`, zrodlo: null };
      }
    } else {
      obiekt = { schemat: SCHEMAT_KONTENERA, kodowanie: KODOWANIE, dane: tekst };
    }
  }

  if (!obiekt || typeof obiekt !== 'object') {
    return { paczka: null, blad: 'Oczekiwano kontenera paczki albo bloku JSON.', zrodlo: null };
  }

  // jawny JSON paczki (bez kontenera) — przechodzi dalej do walidacji
  if (!obiekt.dane && !obiekt.schemat) {
    return { paczka: obiekt, blad: null, zrodlo: 'json' };
  }

  if (obiekt.schemat !== SCHEMAT_KONTENERA) {
    return {
      paczka: null,
      blad: `Nieznany schemat kontenera „${obiekt.schemat ?? '(brak)'}" — oczekiwano ${SCHEMAT_KONTENERA}.`,
      zrodlo: null,
    };
  }
  if (obiekt.kodowanie !== KODOWANIE) {
    return {
      paczka: null,
      blad: `Nieobsługiwane kodowanie „${obiekt.kodowanie ?? '(brak)'}" — ta wersja aplikacji czyta ${KODOWANIE}.`,
      zrodlo: null,
    };
  }

  let bajty;
  try {
    bajty = zBase64url(obiekt.dane);
  } catch (e) {
    return { paczka: null, blad: `Pole „dane" nie jest base64 (${e.message}).`, zrodlo: null };
  }

  const maska = strumienMaski(bajty.length);
  const czyste = new Uint8Array(bajty.length);
  for (let i = 0; i < bajty.length; i++) czyste[i] = bajty[i] ^ maska[i];

  if (obiekt.skrot && skrotFnv1a(czyste) !== String(obiekt.skrot)) {
    return {
      paczka: null,
      blad: 'Suma kontrolna się nie zgadza — paczka jest urwana albo uszkodzona przy kopiowaniu. Wklej ją jeszcze raz w całości.',
      zrodlo: null,
    };
  }

  let json;
  try {
    json = new TextDecoder('utf-8', { fatal: true }).decode(czyste);
  } catch (e) {
    return { paczka: null, blad: `Nie da się odczytać treści paczki (${e.message}).`, zrodlo: null };
  }

  let paczka;
  try {
    paczka = JSON.parse(json);
  } catch (e) {
    return { paczka: null, blad: `Treść paczki nie jest poprawnym JSON (${e.message}).`, zrodlo: null };
  }

  return { paczka, blad: null, zrodlo: 'kontener' };
}

/**
 * Jednolinijkowy blob do schowka/pliku — sam `dane`, bez kontenera JSON.
 * Używany, gdy organizator chce przekazać paczkę w wiadomości (M9).
 */
export function blobPaczki(paczka, wersjaProtokolu) {
  return zapakujPaczke(paczka, wersjaProtokolu).dane;
}
