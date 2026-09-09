#!/usr/bin/env node
/**
 * budżet-lektury.mjs — strażnik budżetu lektury startowej (AGENTS.md §0, B14).
 *
 * Pozycje 1–6 lektury obowiązkowej mają się mieścić w 100 tys. tokenów
 * (decyzja właściciela 2026-09-07: 40 tys. było za ciasne na ten projekt — B18).
 * Narzędzie liczy estymowane tokeny per plik, drukuje raport i KOŃCZY
 * BŁĘDEM (exit 1) przy przekroczeniu — przekroczenie czyni skrócenie
 * dokumentów obowiązkowym zadaniem sesji, a nie opcją.
 *
 * Estymator: `ceil(znaki / 4)` — konserwatywne przybliżenie tokenizera
 * modelowego dla tekstu mieszanego (proza PL/EN + markdown + kod); celowo
 * proste i stabilne między wersjami Node (zero zależności, ADR 0001).
 * To MIARA DYSCYPLINY dokumentów, nie dokładny licznik konkretnego modelu.
 *
 * Uruchamianie: `npm run budzet`. Funkcje czyste są eksportowane — testuje
 * je `test/budzet-lektury.test.js`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Limit z AGENTS.md §0 (pozycje 1–6 lektury startowej). */
export const LIMIT_TOKENOW = 100_000;

/** Mianownik estymatora: znaków na token. */
export const ZNAKOW_NA_TOKEN = 4;

/** Estymowane tokeny tekstu (konserwatywne, deterministyczne). */
export function liczTokeny(tekst) {
  return Math.ceil(String(tekst ?? '').length / ZNAKOW_NA_TOKEN);
}

/**
 * Pliki lektury 1–6 w kolejności AGENTS.md §0 (ADR-y: README rejestru,
 * potem każdy NNNN-*.md alfabetycznie — kolejność rejestru).
 */
export function plikiLektury(root = ROOT) {
  const decyzji = join(root, 'docs/decisions');
  const adry = readdirSync(decyzji)
    .filter((f) => /^\d{4}-.*\.md$/.test(f))
    .sort()
    .map((f) => join('docs/decisions', f));
  return [
    'AGENTS.md',
    'docs/PROTOKOL.md',
    join('docs/decisions', 'README.md'),
    ...adry,
    'docs/LESSONS.md',
    join('docs/setup', 'ENVIRONMENT.md'),
    'docs/ROADMAP.md',
  ];
}

/** Wiersz raportu per plik: { plik, linie, znaki, slowa, tokeny }. */
export function mierzPlik(sciezka, root = ROOT) {
  const tekst = readFileSync(join(root, sciezka), 'utf8');
  return {
    plik: sciezka,
    linie: tekst.split('\n').length,
    znaki: tekst.length,
    slowa: tekst.split(/\s+/).filter(Boolean).length,
    tokeny: liczTokeny(tekst),
  };
}

/** Pełny raport: { wiersze, suma, limit, przekroczony }. */
export function raport(root = ROOT) {
  const wiersze = plikiLektury(root).map((p) => mierzPlik(p, root));
  const suma = wiersze.reduce((s, w) => s + w.tokeny, 0);
  return { wiersze, suma, limit: LIMIT_TOKENOW, przekroczony: suma > LIMIT_TOKENOW };
}

function drukuj({ wiersze, suma, limit, przekroczony }) {
  const wiersz = (w) => `${String(w.tokeny).padStart(6)} tok  ${String(w.linie).padStart(5)} linii  ${w.plik}`;
  console.log('Budżet lektury startowej (AGENTS.md §0, pozycje 1–6):\n');
  for (const w of wiersze) console.log(`  ${wiersz(w)}`);
  console.log(`\n  ${'─'.repeat(46)}`);
  console.log(`  ${String(suma).padStart(6)} tok  (limit ${limit.toLocaleString('pl-PL')})`);
  if (przekroczony) {
    console.log(`\nPRZEKROCZENIE o ${(suma - limit).toLocaleString('pl-PL')} tokenów — skrócenie/rozdzielenie dokumentów jest obowiązkowe (AGENTS.md §0).`);
  } else {
    console.log(`\nOK — rezerwa ${(limit - suma).toLocaleString('pl-PL')} tokenów.`);
  }
}

const uruchomioneWprost = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (uruchomioneWprost) {
  const wynik = raport();
  drukuj(wynik);
  process.exit(wynik.przekroczony ? 1 : 0);
}
