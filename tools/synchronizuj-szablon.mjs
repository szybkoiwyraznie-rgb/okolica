#!/usr/bin/env node
/**
 * synchronizuj-szablon.mjs — szablon promptu: dokument → kod (jedno źródło prawdy)
 *
 * Szablon promptu żyje w `docs/PROTOKOL.md` §2, między znacznikami
 * `<!-- szablon-promptu:start -->` i `<!-- szablon-promptu:koniec -->`,
 * w ogrodzeniu ```tekst. Stamtąd jest przepisywany do stałej `SZABLON_PROMPTU`
 * w `app/protokol.js`, w blok ograniczony parą znaczników SZABLON-START /
 * SZABLON-KONIEC (nazwy dosłowne w stałych `KOD_START` i `KOD_KONIEC` niżej).
 * Ręczna edycja stałej w kodzie jest bezcelowa: najbliższe uruchomienie
 * narzędzia ją nadpisze. Zgodność pilnuje `npm run check` i `test/kontrakt.test.js`.
 *
 * Użycie:
 *   node tools/synchronizuj-szablon.mjs          # przepisz szablon do app/protokol.js
 *   node tools/synchronizuj-szablon.mjs --check  # tylko porównaj (brama jakości)
 *
 * Zero zależności (ADR 0001). Kod wyjścia 1 przy rozjeździe albo błędzie.
 * Narzędzie celowo NIC nie eksportuje — test kontraktowy czyta oba pliki sam,
 * żeby import nie uruchamiał zapisu.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KATALOG = dirname(dirname(fileURLToPath(import.meta.url)));
const DOKUMENT = join(KATALOG, 'docs', 'PROTOKOL.md');
const MODUL = join(KATALOG, 'app', 'protokol.js');

const DOK_START = '<!-- szablon-promptu:start -->';
const DOK_KONIEC = '<!-- szablon-promptu:koniec -->';
const KOD_START = '/* SZABLON-START';
const KOD_KONIEC = 'SZABLON-KONIEC */';

function blad(tekst) {
  console.error(`BŁĄD: ${tekst}`);
  process.exit(1);
}

function dokladnieJeden(tekst, znacznik, plik) {
  const ile = tekst.split(znacznik).length - 1;
  if (ile === 0) blad(`brak znacznika ${znacznik} w ${plik}.`);
  if (ile > 1) blad(`znacznik ${znacznik} występuje ${ile} razy w ${plik} — musi dokładnie raz.`);
}

/** Wycina tekst między znacznikami (bez samych znaczników). */
function miedzyZnacznikami(tekst, start, koniec, plik) {
  dokladnieJeden(tekst, start, plik);
  dokladnieJeden(tekst, koniec, plik);
  const i = tekst.indexOf(start);
  const j = tekst.indexOf(koniec);
  if (j < i) blad(`znacznik końcowy ${koniec} jest przed początkowym w ${plik}.`);
  return tekst.slice(i + start.length, j);
}

/** Z bloku w dokumencie zostawia sam szablon: bez ogrodzenia ```tekst / ```. */
function szablonZDokumentu(dok) {
  const blok = miedzyZnacznikami(dok, DOK_START, DOK_KONIEC, 'docs/PROTOKOL.md');
  const linie = blok.split('\n');
  const otwarcie = linie.findIndex((l) => l.trim().startsWith('```'));
  if (otwarcie < 0) blad('w bloku szablonu nie ma ogrodzenia ```tekst.');
  let zamkniecie = -1;
  for (let i = linie.length - 1; i > otwarcie; i--) {
    if (linie[i].trim() === '```') { zamkniecie = i; break; }
  }
  if (zamkniecie < 0) blad('ogrodzenie szablonu nie jest zamknięte.');
  const szablon = linie.slice(otwarcie + 1, zamkniecie).join('\n').trim();
  for (const wymagany of ['{LAT}', '{LON}', '{LISTA_STACJI}', '{OPIS_TRUDNOSCI}', 'ZASADY TWARDE', 'PYT/1.0']) {
    if (!szablon.includes(wymagany)) blad(`szablon w dokumencie nie zawiera ${wymagany}.`);
  }
  if (szablon.includes('\u0060\u0060\u0060')) blad('szablon nie może zawierać ogrodzenia z trzech odwrotnych apostrofów (łamie stałą w kodzie).');
  return szablon;
}

/** Blok kodu wstawiany do `app/protokol.js` (ze znacznikami). */
function blokKodu(szablon) {
  return [
    KOD_START,
    ' * Treść generowana z docs/PROTOKOL.md §2 przez tools/synchronizuj-szablon.mjs.',
    ' * NIE EDYTUJ RĘCZNIE — zmień dokument i uruchom `npm run build`.',
    ' */',
    `export const SZABLON_PROMPTU = ${JSON.stringify(szablon)};`,
    `/* ${KOD_KONIEC}`,
  ].join('\n');
}

const szablon = szablonZDokumentu(readFileSync(DOKUMENT, 'utf8'));
const oczekiwany = blokKodu(szablon);

const kod = readFileSync(MODUL, 'utf8');
dokladnieJeden(kod, KOD_START, 'app/protokol.js');
dokladnieJeden(kod, KOD_KONIEC, 'app/protokol.js');
const start = kod.indexOf(KOD_START);
const koniec = kod.indexOf(KOD_KONIEC) + KOD_KONIEC.length;
const obecny = kod.slice(start, koniec);
const info = `(${szablon.length} znaków, ${szablon.split('\n').length} linii)`;

if (process.argv.includes('--check')) {
  if (obecny !== oczekiwany) {
    console.error('NIEZGODNOŚĆ: SZABLON_PROMPTU w app/protokol.js różni się od docs/PROTOKOL.md §2.');
    console.error('Uruchom `npm run build`, a potem wcommituj dokument i kod razem.');
    process.exit(1);
  }
  console.log(`OK: szablon promptu zgodny ${info}.`);
} else if (obecny === oczekiwany) {
  console.log(`Bez zmian: szablon promptu już zgodny ${info}.`);
} else {
  writeFileSync(MODUL, kod.slice(0, start) + oczekiwany + kod.slice(koniec), 'utf8');
  console.log(`Zapisano szablon promptu do app/protokol.js ${info}.`);
}
