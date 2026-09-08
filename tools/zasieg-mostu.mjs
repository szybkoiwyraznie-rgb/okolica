/**
 * Ile tekstu `docs/setup/apps-script-repo-paczek.gs` naprawdę wykonują testy.
 *
 * Most jest skryptem Apps Script: nie da się go uruchomić w CI inaczej niż
 * wykonując jego tekst z atrapą Drive (`test/helpers/most.js`). Pokrycie V8
 * takiego skryptu ląduje w profilu jako wpis bez URL, więc c8/node go nie
 * pokażą — to narzędzie przekłada je na numery linii pliku.
 *
 * Użycie: npm run zasieg-mostu [-- --linie]
 *   bez flagi — podsumowanie i lista funkcji, których testy nie dotykają
 *   --linie   — dodatkowo każdy niewykonany wiersz kodu (do celowania w dziury)
 *
 * LESSONS L33: literówka `wZaakceptowanych` dała graczom Z07, bo żadna ścieżka
 * testowa jej nie wykonywała. To narzędzie pokazuje, gdzie takich ścieżek brakuje.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cialoSkryptu, listaFunkcji, tekstWykonywany } from '../test/helpers/most.js';

const pokazujeLinie = process.argv.includes('--linie');
const katalog = mkdtempSync(join(tmpdir(), 'zasieg-mostu-'));

try {
  const testyMostu = readdirSync(join(import.meta.dirname, '..', 'test'))
    .filter((plik) => /^most-.*\.test\.js$/.test(plik))
    .map((plik) => `test/${plik}`);
  if (!testyMostu.length) throw new Error('nie znalazłem testów mostu — pomiar nie ma czego mierzyć');
  execFileSync(process.execPath, ['--test', ...testyMostu], {
    cwd: join(import.meta.dirname, '..'),
    env: { ...process.env, NODE_V8_COVERAGE: katalog },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
} catch (blad) {
  rmSync(katalog, { recursive: true, force: true });
  throw blad;
}

const bezFolder = tekstWykonywany();
const cialo = cialoSkryptu(bezFolder, listaFunkcji(bezFolder));
const poczatek = cialo.indexOf(bezFolder);
if (poczatek < 0) throw new Error('nie znalazłem tekstu .gs w wykonywanym skrypcie — narzędzie rozjechało się z atrapą');

// Pokrycie: offsety w ciele skryptu, scalone ze wszystkich procesów testowych.
const pokryte = new Uint8Array(cialo.length);
let profili = 0;

/**
 * V8 numeruje offsety od początku WYGENEROWANEGO źródła, czyli od
 * `function anonymous(<parametry>\n) {\n`, a nie od naszego ciała. Przesunięcie
 * bierzemy z długości całego skryptu i sprawdzamy na nazwach funkcji — gdyby
 * kalibracja się rozjechała, narzędzie ma się zatrzymać, a nie kłamać.
 */
function przesuniecieWpisu(wpis) {
  const calosc = (wpis.functions ?? []).find((f) => f.functionName === '');
  if (!calosc || !calosc.ranges || !calosc.ranges.length) return null;
  const koniec = calosc.ranges[0].endOffset;
  for (const ogon of [2, 1, 3]) {
    const shift = koniec - cialo.length - ogon;
    if (shift < 0) continue;
    // `folder()` mieszka w przedrostku wrappera, nie w ciele — nie może psuć próby.
    const nazwane = (wpis.functions ?? []).filter((f) => f.functionName && f.functionName !== 'folder');
    if (nazwane.length < 10) continue;
    const trafne = nazwane.filter((f) => {
      const gdzie = f.ranges[0].startOffset - shift;
      if (gdzie < 0) return false;
      // V8 raz stawia początek funkcji na słowie `function`, raz na samej nazwie.
      return cialo.startsWith('function ' + f.functionName, gdzie)
        || cialo.startsWith(f.functionName, gdzie)
        || cialo.startsWith('function ' + f.functionName, gdzie - 9);
    }).length;
    if (trafne / nazwane.length >= 0.9) return shift;
  }
  return null;
}

for (const plik of readdirSync(katalog)) {
  const wynik = JSON.parse(readFileSync(join(katalog, plik), 'utf8'));
  for (const wpis of wynik.result ?? []) {
    if (wpis.url !== '') continue; // interesuje nas tylko skrypt z new Function
    if (!(wpis.functions ?? []).some((f) => f.functionName === 'paczkaPrzezId')) continue;
    const shift = przesuniecieWpisu(wpis);
    if (shift === null) throw new Error('nie udało się skalibrować przesunięcia V8 — pomiary byłyby zmyślone');
    profili += 1;
    // Osobna maska na profil: wewnątrz profilu zakresy V8 są zagnieżdżone
    // (węższy nadpisuje licznik rodzica), ale MIĘDZY profilami pokrywamy się
    // sumą — inaczej proces, który danej funkcji nie dotknął, kasowałby cudze.
    const maska = new Uint8Array(cialo.length);
    for (const fn of wpis.functions) {
      for (const zakres of fn.ranges ?? []) {
        const od = zakres.startOffset - shift;
        const do_ = zakres.endOffset - shift;
        if (od >= cialo.length || do_ <= 0) continue; // poza naszym ciałem (ogon wrappera)
        maska.fill(zakres.count > 0 ? 1 : 0, Math.max(0, od), Math.min(cialo.length, do_));
      }
    }
    for (let i = 0; i < maska.length; i += 1) pokryte[i] = pokryte[i] || maska[i];
  }
}
if (!profili) throw new Error('brak profilu pokrycia dla skryptu mostu — testy nie wykonały .gs?');

// Wiersze .gs → offsety w ciele (tekst jest w ciele dosłownie, więc idziemy kursorem).
const linie = bezFolder.split('\n');
let kursor = poczatek;
const niewykonane = [];
let kodowych = 0;
let wykonanych = 0;
for (let i = 0; i < linie.length; i += 1) {
  const linia = linie[i];
  const gdzie = cialo.indexOf(linia, kursor);
  if (gdzie < 0) continue;
  kursor = gdzie + linia.length;
  const tresc = linia.trim();
  if (!tresc || tresc.startsWith('//') || tresc.startsWith('*') || tresc.startsWith('/*')) continue;
  kodowych += 1;
  const trafione = pokryte.slice(gdzie, gdzie + linia.length).some((b) => b === 1);
  if (trafione) wykonanych += 1;
  else niewykonane.push({ numer: i + 1, tresc });
}

const procent = ((wykonanych / kodowych) * 100).toFixed(1);
console.log(`Most: ${wykonanych}/${kodowych} wierszy kodu wykonanych przez testy (${procent}%), profili: ${profili}`);

const funkcjeBezZasiegu = [];
for (const { numer, tresc } of niewykonane) {
  const m = tresc.match(/^function ([A-Za-z0-9_]+)\s*\(/);
  if (m) funkcjeBezZasiegu.push(`${m[1]} (linia ${numer})`);
}
if (funkcjeBezZasiegu.length) {
  console.log(`\nFunkcje, których testy nie wywołują (${funkcjeBezZasiegu.length}):`);
  for (const f of funkcjeBezZasiegu) console.log(`  - ${f}`);
}

if (pokazujeLinie) {
  console.log(`\nNiewykonane wiersze (${niewykonane.length}):`);
  for (const { numer, tresc } of niewykonane) console.log(`  ${numer}: ${tresc}`);
}

rmSync(katalog, { recursive: true, force: true });
