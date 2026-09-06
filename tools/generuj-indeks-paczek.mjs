/**
 * M9/R4 — generator indeksu repozytorium paczek (`data/paczki/indeks.json`).
 *
 * Indeks niesie WYŁĄCZNIE meta paczek (ADR 0017 pkt 2) — bez treści pytań i bez
 * dekodowania kontenera po stronie indeksu (tu kontener dekodujemy tylko po to,
 * by sprawdzić, że publikowana paczka jest grywalna i że skrót się zgadza).
 *
 * Brama publikacji (ADR 0017 pkt 4/5, ADR 0008 pkt 6): plik `.zestaw.json`
 * trafi do indeksu TYLKO gdy:
 *  - przechodzi walidację TO-zestaw/1 (meta z licencją i przeglądem źródeł),
 *  - `meta.przegladZrodel` NIE zawiera znacznika „oczekuje przeglądu"
 *    (eksport z aplikacji wychodzi z tym znacznikiem — właściciel edytuje pole
 *    ręcznie po przeglądzie źródeł i dopiero wtedy paczka może być publiczna),
 *  - `meta.licencja` to dokładnie CC BY-SA 4.0,
 *  - kontener się dekoduje, a pytania pokrywają wszystkie stacje paczki.
 *
 * Użycie: `npm run indeks-paczek`. Testy: `test/indeks-paczek.test.js`
 * (funkcja `zbudujIndeks` bez dotykania dysku).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { odpakujPaczke } from '../app/kodowanie.js';
import { SCHEMAT_INDEKSU, SCHEMAT_ZESTAWU, walidujZestawPublicznySurowy } from '../app/zestawy.js';

export const LICENCJA_PUBLICZNA = 'CC BY-SA 4.0';
export const ZNAK_OCZEKUJE_PRZEGLADU = 'oczekuje przeglądu';

const KATALOG = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'paczki');

/**
 * Pełny audyt jednego pliku paczki: `{ wpis, bledy }`. Wpis to meta + liczniki
 * do indeksu; błędy dyskwalifikują plik z publikacji (narzędzie kończy się 1).
 */
export function sprawdzPaczkePubliczna(nazwa, tekst) {
  const bledy = [];
  const { zestaw, usterki } = walidujZestawPublicznySurowy(tekst);
  for (const u of usterki) bledy.push(u.komunikat);
  if (!zestaw) return { wpis: null, bledy };

  const { meta, stacje, kontener } = zestaw;
  if (meta.licencja !== LICENCJA_PUBLICZNA) {
    bledy.push(`licencja musi brzmieć „${LICENCJA_PUBLICZNA}” (ADR 0017 pkt 4), jest: „${meta.licencja}”`);
  }
  if (meta.przegladZrodel.includes(ZNAK_OCZEKUJE_PRZEGLADU)) {
    bledy.push('meta.przegladZrodel wciąż ma znacznik „oczekuje przeglądu” — paczka nie przeszła przeglądu źródeł właściciela (ADR 0008 pkt 6, ADR 0017 pkt 5)');
  }
  let liczbaPytan = 0;
  const { paczka, blad } = odpakujPaczke(kontener);
  if (blad || !paczka) {
    bledy.push(`kontener ${kontener.schemat} nie dekoduje się: ${blad?.komunikat ?? 'błąd odczytu'}`);
  } else {
    const pytania = Array.isArray(paczka.pytania) ? paczka.pytania : [];
    liczbaPytan = pytania.length;
    if (pytania.length === 0) bledy.push('paczka nie ma pytań');
    for (const p of pytania) {
      if (!Number.isInteger(p.stacja) || p.stacja < 1 || p.stacja > stacje.length) {
        bledy.push(`pytanie ${p.id ?? '?'} wskazuje stację poza zakresem 1–${stacje.length}`);
      }
    }
    const obsadzone = new Set(pytania.map((p) => p.stacja));
    for (let i = 1; i <= stacje.length; i += 1) {
      if (!obsadzone.has(i)) bledy.push(`stacja ${i} nie ma żadnego pytania (złamanie PYT/1.0)`);
    }
  }
  if (bledy.length) return { wpis: null, bledy };
  return {
    wpis: {
      skrot: kontener.skrot,
      plik: nazwa,
      ...meta,
      stacji: stacje.length,
      pytan: liczbaPytan,
    },
    bledy: [],
  };
}

/**
 * Indeks z listy plików `[{ nazwa, tekst }]`: `{ indeks, bledy: [{ plik, komunikat }] }`.
 * Kolejność wpisów: miejsce → data → plik (przewidywalny diff w git).
 */
export function zbudujIndeks(pliki) {
  const wpisy = [];
  const bledy = [];
  for (const { nazwa, tekst } of pliki) {
    const { wpis, bledy: b } = sprawdzPaczkePubliczna(nazwa, tekst);
    if (wpis) wpisy.push(wpis);
    for (const komunikat of b) bledy.push({ plik: nazwa, komunikat });
  }
  wpisy.sort((a, b) => `${a.miejsce}|${a.data}|${a.plik}`.localeCompare(`${b.miejsce}|${b.data}|${b.plik}`));
  return { indeks: { schemat: SCHEMAT_INDEKSU, wpisy }, bledy };
}

export function zapiszIndeks(katalog = KATALOG) {
  if (!existsSync(katalog)) mkdirSync(katalog, { recursive: true });
  const nazwy = readdirSync(katalog).filter((n) => n.endsWith('.zestaw.json')).sort();
  const pliki = nazwy.map((nazwa) => ({ nazwa, tekst: readFileSync(join(katalog, nazwa), 'utf8') }));
  const { indeks, bledy } = zbudujIndeks(pliki);
  if (bledy.length) {
    for (const { plik, komunikat } of bledy) console.error(`BŁĄD ${plik}: ${komunikat}`);
    throw new Error(`indeks paczek: ${bledy.length} błędów publikacji — indeks NIE zapisany`);
  }
  const sciezka = join(katalog, 'indeks.json');
  writeFileSync(sciezka, `${JSON.stringify(indeks, null, 2)}\n`, 'utf8');
  return { sciezka, wpisow: indeks.wpisy.length };
}

const czyUruchomiony = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (czyUruchomiony) {
  try {
    const { sciezka, wpisow } = zapiszIndeks();
    console.log(`OK: ${sciezka} (${wpisow} wpisów)`);
  } catch (blad) {
    console.error(blad.message);
    process.exit(1);
  }
}

export { SCHEMAT_ZESTAWU };
