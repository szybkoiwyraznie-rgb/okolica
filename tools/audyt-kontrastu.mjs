#!/usr/bin/env node
/**
 * Audyt kontrastu WCAG AA (M10/T6) — brama, nie jednorazowy przegląd.
 *
 * Czyta tokeny palety z `app/styles.css` (motyw jasny z `:root` i ciemny z
 * `html[data-motyw='ciemny']`), liczy kontrast WCAG 2.x dla par ról
 * (tekst → tło) i KOŃCZY BŁĘDEM, gdy para spada poniżej progu:
 * 4.5:1 dla zwykłego tekstu, 3:1 dla dużego tekstu i granic UI.
 * Pary oznaczone `informacyjnie` (dekoracje) są raportowane bez blokowania.
 *
 * Zero zależności (ADR 0001). Uruchamianie: `npm run brama` albo
 * `npm run audyt`. Funkcje czyste są eksportowane — testuje je
 * `test/audyt-kontrastu.test.js` (wartości referencyjne WCAG).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Pary ról do audytu: token tekstu, token tła, próg i opis. */
export const PARY = Object.freeze([
  { tekst: 'tekst', tlo: 'tlo', prog: 4.5, opis: 'tekst główny na tle strony' },
  { tekst: 'tekst', tlo: 'tlo-karta', prog: 4.5, opis: 'tekst główny na karcie' },
  { tekst: 'tekst', tlo: 'tlo-pole', prog: 4.5, opis: 'tekst w polach formularzy' },
  { tekst: 'tekst-slaby', tlo: 'tlo', prog: 4.5, opis: 'podpowiedzi i statusy na tle strony' },
  { tekst: 'tekst-slaby', tlo: 'tlo-karta', prog: 4.5, opis: 'podpowiedzi i statusy na karcie' },
  { tekst: 'tekst-slaby', tlo: 'tlo-pole', prog: 4.5, opis: 'placeholder/tekst w polu' },
  { tekst: 'akcent-tekst', tlo: 'akcent', prog: 4.5, opis: 'napis na przycisku głównym' },
  { tekst: 'akcent', tlo: 'tlo-karta', prog: 4.5, opis: 'linki i wyróżnienia na karcie' },
  { tekst: 'blad', tlo: 'blad-tlo', prog: 4.5, opis: 'komunikat błędu na tle błędu' },
  { tekst: 'ok', tlo: 'ok-tlo', prog: 4.5, opis: 'komunikat powodzenia na tle OK' },
  { tekst: 'ostrzezenie', tlo: 'tlo-karta', prog: 4.5, opis: 'ostrzeżenie na karcie' },
  { tekst: 'linia', tlo: 'tlo-karta', prog: 3.0, opis: 'granica karty (dekoracja)', informacyjnie: true },
]);

/** `#rgb`/`#rrggbb`/`#rrggbbaa` → [r,g,b] 0–255 (alpha ignorowana: tokeny są nieprzezroczyste). */
export function hexNaRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`hexNaRgb: nie-hex „${hex}”`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Luminancja względna WCAG 2.x (0 = czerń, 1 = biel). */
export function luminancja(hex) {
  const [r, g, b] = hexNaRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrast WCAG: (L1 + 0.05) / (L2 + 0.05), zawsze ≥ 1. */
export function kontrast(hexA, hexB) {
  const la = luminancja(hexA);
  const lb = luminancja(hexB);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Tokeny `--nazwa: #hex;` z bloku CSS. */
export function tokenyZBloku(blok) {
  const tokeny = {};
  for (const m of String(blok).matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) tokeny[m[1]] = m[2];
  return tokeny;
}

/** Audyt jednego motywu: lista wyników z ratio, progiem i werdyktem. */
export function audytMotywu(tokeny, pary = PARY) {
  return pary.map((para) => {
    const kolorTekst = tokeny[para.tekst];
    const kolorTlo = tokeny[para.tlo];
    if (!kolorTekst || !kolorTlo) {
      return { ...para, ratio: null, ok: false, brak: true };
    }
    const ratio = kontrast(kolorTekst, kolorTlo);
    return { ...para, kolorTekst, kolorTlo, ratio, ok: ratio >= para.prog };
  });
}

function main() {
  const css = readFileSync(join(ROOT, 'app/styles.css'), 'utf8');
  const jasny = tokenyZBloku(/:root\s*{([^}]*)}/.exec(css)?.[1] ?? '');
  const ciemny = tokenyZBloku(/html\[data-motyw='ciemny'\]\s*{([^}]*)}/.exec(css)?.[1] ?? '');
  let naruszenia = 0;
  for (const [nazwa, tokeny] of [['jasny', jasny], ['ciemny', ciemny]]) {
    if (Object.keys(tokeny).length === 0) {
      console.error(`✗ motyw ${nazwa}: nie znaleziono tokenów palety w app/styles.css`);
      process.exitCode = 1;
      continue;
    }
    console.log(`— motyw ${nazwa} —`);
    for (const w of audytMotywu(tokeny)) {
      const znacznik = w.brak ? '✗ BRAK TOKENU' : w.ok ? '✓' : (w.informacyjnie ? '· info' : '✗ PONIŻEJ PROGU');
      if (!w.ok && !w.informacyjnie) naruszenia += 1;
      console.log(
        `  ${znacznik} ${w.tekst} na ${w.tlo}: ${w.ratio == null ? '—' : w.ratio.toFixed(2)}:1 (próg ${w.prog}:1) — ${w.opis}`,
      );
    }
  }
  if (naruszenia > 0) {
    console.error(`\n✗ Audyt WCAG AA: ${naruszenia} naruszeń — popraw tokeny palety w app/styles.css.`);
    process.exitCode = 1;
  } else {
    console.log('\n✓ Audyt WCAG AA: 0 naruszeń (pary tekstowe obu motywów nad progami).');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
