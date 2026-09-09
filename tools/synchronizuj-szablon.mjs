#!/usr/bin/env node
/**
 * synchronizuj-szablon.mjs — szablony promptu: dokument → kod (jedno źródło prawdy)
 *
 * Szablony promptu żyją w `docs/PROTOKOL.md`: §2 (wariant z fact-check) i §2.2
 * (wariant bez weryfikacji, ADR 0032), każdy między własną parą znaczników
 * w ogrodzeniu ```tekst. Stamtąd są przepisywane do stałych `SZABLON_PROMPTU`
 * i `SZABLON_PROMPTU_BEZ_WERYFIKACJI` w `app/protokol.js`, w bloki ograniczone
 * parami znaczników SZABLON-START / SZABLON-KONIEC (konfiguracja w `SZABLONY`
 * niżej). Ręczna edycja stałych w kodzie jest bezcelowa: najbliższe uruchomienie
 * narzędzia je nadpisze. Zgodność pilnuje `npm run check` i `test/kontrakt.test.js`.
 *
 * Użycie:
 *   node tools/synchronizuj-szablon.mjs          # przepisz szablony do app/protokol.js
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

const SZABLONY = [
  {
    dokStart: '<!-- szablon-promptu:start -->',
    dokKoniec: '<!-- szablon-promptu:koniec -->',
    kodStart: '/* SZABLON-START',
    kodKoniec: 'SZABLON-KONIEC */',
    stala: 'SZABLON_PROMPTU',
    sekcja: '§2',
    wymagane: ['{LAT}', '{LON}', '{LISTA_STACJI}', '{OPIS_TRUDNOSCI}', 'ZASADY TWARDE', 'PYT/1.0-rev4'],
  },
  {
    dokStart: '<!-- szablon-promptu-bez:start -->',
    dokKoniec: '<!-- szablon-promptu-bez:koniec -->',
    kodStart: '/* SZABLON-BEZ-START',
    kodKoniec: 'SZABLON-BEZ-KONIEC */',
    stala: 'SZABLON_PROMPTU_BEZ_WERYFIKACJI',
    sekcja: '§2.2',
    wymagane: ['{LAT}', '{LON}', '{LISTA_STACJI}', '{OPIS_TRUDNOSCI}', 'ZASADY TWARDE', 'PYT/1.0-rev5', 'OPCJONALNE'],
  },
];

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
function szablonZDokumentu(dok, cfg) {
  const blok = miedzyZnacznikami(dok, cfg.dokStart, cfg.dokKoniec, 'docs/PROTOKOL.md');
  const linie = blok.split('\n');
  const otwarcie = linie.findIndex((l) => l.trim().startsWith('```'));
  if (otwarcie < 0) blad(`w bloku szablonu ${cfg.sekcja} nie ma ogrodzenia \`\`\`tekst.`);
  let zamkniecie = -1;
  for (let i = linie.length - 1; i > otwarcie; i--) {
    if (linie[i].trim() === '```') { zamkniecie = i; break; }
  }
  if (zamkniecie < 0) blad(`ogrodzenie szablonu ${cfg.sekcja} nie jest zamknięte.`);
  const szablon = linie.slice(otwarcie + 1, zamkniecie).join('\n').trim();
  for (const wymagany of cfg.wymagane) {
    if (!szablon.includes(wymagany)) blad(`szablon ${cfg.sekcja} w dokumencie nie zawiera ${wymagany}.`);
  }
  if (szablon.includes('\u0060\u0060\u0060')) blad(`szablon ${cfg.sekcja} nie może zawierać ogrodzenia z trzech odwrotnych apostrofów (łamie stałą w kodzie).`);
  return szablon;
}

/** Blok kodu wstawiany do `app/protokol.js` (ze znacznikami). */
function blokKodu(szablon, cfg) {
  return [
    cfg.kodStart,
    ` * Treść generowana z docs/PROTOKOL.md ${cfg.sekcja} przez tools/synchronizuj-szablon.mjs.`,
    ' * NIE EDYTUJ RĘCZNIE — zmień dokument i uruchom `npm run build`.',
    ' */',
    `export const ${cfg.stala} = ${JSON.stringify(szablon)};`,
    `/* ${cfg.kodKoniec}`,
  ].join('\n');
}

const dok = readFileSync(DOKUMENT, 'utf8');
let kod = readFileSync(MODUL, 'utf8');
const sprawdzanie = process.argv.includes('--check');
let zapisano = false;

for (const cfg of SZABLONY) {
  const szablon = szablonZDokumentu(dok, cfg);
  const oczekiwany = blokKodu(szablon, cfg);
  dokladnieJeden(kod, cfg.kodStart, 'app/protokol.js');
  dokladnieJeden(kod, cfg.kodKoniec, 'app/protokol.js');
  const start = kod.indexOf(cfg.kodStart);
  const koniec = kod.indexOf(cfg.kodKoniec) + cfg.kodKoniec.length;
  const obecny = kod.slice(start, koniec);
  const info = `${cfg.stala} ${cfg.sekcja} (${szablon.length} znaków, ${szablon.split('\n').length} linii)`;
  if (sprawdzanie) {
    if (obecny !== oczekiwany) {
      console.error(`NIEZGODNOŚĆ: ${cfg.stala} w app/protokol.js różni się od docs/PROTOKOL.md ${cfg.sekcja}.`);
      console.error('Uruchom `npm run build`, a potem wcommituj dokument i kod razem.');
      process.exit(1);
    }
    console.log(`OK: szablon zgodny — ${info}.`);
  } else if (obecny !== oczekiwany) {
    kod = kod.slice(0, start) + oczekiwany + kod.slice(koniec);
    zapisano = true;
    console.log(`Zapisano ${info}.`);
  } else {
    console.log(`Bez zmian: ${info} już zgodny.`);
  }
}

if (!sprawdzanie && zapisano) writeFileSync(MODUL, kod, 'utf8');
