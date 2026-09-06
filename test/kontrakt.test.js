/**
 * Testy kontraktowe — pilnują, żeby dokumentacja i kod nie rozeszły się.
 *
 * To najtańsze ubezpieczenie projektu wielosesyjnego: agent, który zmieni
 * kanon tematów w kodzie i zapomni o protokole (albo odwrotnie), dostaje
 * czerwoną bramę zamiast cichej rozbieżności. Wzorzec z AME (ich lekcja:
 * „wersja standardu rozjeżdża się między nośnikami").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SZABLON_PROMPTU, WERSJA_PROTOKOLU } from '../app/protokol.js';
import { PODKLADY, TEMATY, WIEK } from '../app/konfig.js';
import { KODOWANIE, SCHEMAT_KONTENERA } from '../app/kodowanie.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const czytaj = (sciezka) => readFileSync(join(ROOT, sciezka), 'utf8');

const PROTOKOL = czytaj('docs/PROTOKOL.md');
const INDEX = czytaj('index.html');
const APP = czytaj('app/app.js');
const README = czytaj('README.md');
const ASSETS = czytaj('docs/ASSETS.md');
const AGENTS = czytaj('AGENTS.md');
const PACKAGE = JSON.parse(czytaj('package.json'));
const MAPA = czytaj('app/mapa.js');
const STYLE = czytaj('app/styles.css');

/** Wiersze tabeli markdowna w sekcji zaczynającej się od `naglowek`. */
function tabelaSekcji(dokument, naglowek) {
  const start = dokument.indexOf(naglowek);
  assert.ok(start >= 0, `w dokumencie nie ma sekcji „${naglowek}"`);
  const dalej = dokument.slice(start + naglowek.length);
  const nastepna = dalej.search(/\n## /);
  const sekcja = nastepna < 0 ? dalej : dalej.slice(0, nastepna);
  return sekcja
    .split('\n')
    .filter((l) => l.trim().startsWith('|'))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((komorki) => komorki.length > 1 && !/^[-: ]+$/.test(komorki[0]))
    .slice(1); // bez wiersza nagłówkowego
}

function bezOgrodzenia(tekst) {
  return tekst.replace(/^`|`$/g, '').trim();
}

/* ------------------------------------------------- szablon promptu: doc ↔ kod */

test('kontrakt: szablon promptu w docs/PROTOKOL.md jest identyczny z SZABLON_PROMPTU', () => {
  const start = PROTOKOL.indexOf('<!-- szablon-promptu:start -->');
  const koniec = PROTOKOL.indexOf('<!-- szablon-promptu:koniec -->');
  assert.ok(start >= 0 && koniec > start, 'brak znaczników szablonu w protokole');
  const linie = PROTOKOL.slice(start, koniec).split('\n');
  const otwarcie = linie.findIndex((l) => l.trim().startsWith('```'));
  const zamkniecie = linie.map((l) => l.trim()).lastIndexOf('```');
  assert.ok(otwarcie >= 0 && zamkniecie > otwarcie, 'szablon w protokole nie jest w ogrodzeniu');
  const zDokumentu = linie.slice(otwarcie + 1, zamkniecie).join('\n').trim();
  assert.equal(SZABLON_PROMPTU, zDokumentu, 'uruchom `npm run build` (tools/synchronizuj-szablon.mjs) i wcommituj kod razem z dokumentem');
});

/* ------------------------------------------------- kanony treści: doc ↔ kod */

test('kontrakt: kategorie wiekowe w protokole §4 = WIEK w app/konfig.js', () => {
  const wiersze = tabelaSekcji(PROTOKOL, '## 4. Kategorie wiekowe i wymagania trudności');
  assert.equal(wiersze.length, Object.keys(WIEK).length, `w dokumencie ${wiersze.length} kategorii, w kodzie ${Object.keys(WIEK).length}`);
  for (const [klucz, etykieta, opis, punkty] of wiersze) {
    const k = bezOgrodzenia(klucz);
    assert.ok(WIEK[k], `kategoria „${k}" jest w protokole, a nie ma jej w kodzie`);
    assert.equal(WIEK[k].etykieta, etykieta, `etykieta kategorii ${k}`);
    assert.equal(WIEK[k].opisTrudnosci, opis, `opis trudności kategorii ${k} trafia dosłownie do promptu`);
    assert.equal(WIEK[k].punkty, Number(punkty), `punkty kategorii ${k}`);
  }
});

test('kontrakt: kanon tematów w protokole §5 = TEMATY w app/konfig.js', () => {
  const wiersze = tabelaSekcji(PROTOKOL, '## 5. Kanon tematów');
  assert.equal(wiersze.length, Object.keys(TEMATY).length);
  for (const [klucz, etykieta, opis] of wiersze) {
    const k = bezOgrodzenia(klucz);
    assert.ok(TEMATY[k], `temat „${k}" jest w protokole, a nie ma go w kodzie`);
    assert.equal(TEMATY[k].etykieta, etykieta, `etykieta tematu ${k}`);
    assert.equal(TEMATY[k].opis, opis, `opis tematu ${k} trafia dosłownie do promptu`);
  }
});

test('kontrakt: każdy temat z kodu ma wiersz w protokole (i odwrotnie)', () => {
  const zDokumentu = new Set(tabelaSekcji(PROTOKOL, '## 5. Kanon tematów').map((w) => bezOgrodzenia(w[0])));
  assert.deepEqual([...zDokumentu].sort(), Object.keys(TEMATY).sort());
});

/* ------------------------------------------------------------- wersjonowanie */

test('kontrakt: wersja protokołu jest jedna w dokumencie, w kodzie, w stopce i w README', () => {
  const tytul = PROTOKOL.split('\n')[0];
  const m = tytul.match(/PYT v(\d+)\.(\d+)/);
  assert.ok(m, `tytuł protokołu nie deklaruje wersji („${tytul}")`);
  const wersja = `PYT/${m[1]}.${m[2]}`;
  assert.equal(WERSJA_PROTOKOLU, wersja, 'WERSJA_PROTOKOLU w app/protokol.js');
  const stopka = INDEX.match(/<span id="stopka-protokol">([^<]+)<\/span>/);
  assert.ok(stopka, 'w index.html brakuje <span id="stopka-protokol">');
  assert.equal(stopka[1], wersja, 'stopka aplikacji pokazuje inną wersję protokołu');
  assert.ok(README.includes(`protokół PYT v${m[1]}.${m[2]}`), 'README nie podaje obowiązującej wersji protokołu');
});

/* ------------------------------------------------------------ cache-busting */

test('kontrakt: wersja cache-bustingu jest identyczna w index.html i w importach', () => {
  const wersje = [...INDEX.matchAll(/\?v=([A-Za-z0-9.\-]+)/g)].map((m) => m[1]);
  assert.ok(wersje.length >= 2, 'index.html powinien wersjonować CSS i moduł JS');
  assert.equal(new Set(wersje).size, 1, `rozjechane wersje w index.html: ${wersje.join(', ')}`);
  const wersja = wersje[0];
  const importy = [...APP.matchAll(/from '\.\/([a-z]+)\.js\?v=([A-Za-z0-9.\-]+)'/g)].map((m) => ({ modul: m[1], wersja: m[2] }));
  assert.ok(importy.length >= 3, 'app.js powinien importować moduły z wersją cache-bustingu');
  for (const i of importy) assert.equal(i.wersja, wersja, `import ./​${i.modul}.js ma inną wersję niż index.html`);
});

/* ------------------------------------------------- granice ADR 0001 i 0002 */

test('kontrakt: zero zależności w package.json (ADR 0001)', () => {
  assert.equal(PACKAGE.dependencies, undefined, 'package.json nie może mieć dependencies');
  assert.equal(PACKAGE.devDependencies, undefined, 'package.json nie może mieć devDependencies');
  assert.equal(PACKAGE.type, 'module');
  assert.equal(PACKAGE.scripts.test, 'node --test');
});

test('kontrakt: w app/ nie ma API Node ani require (LESSONS L6)', () => {
  for (const plik of readdirSync(join(ROOT, 'app')).filter((f) => f.endsWith('.js'))) {
    const kod = czytaj(`app/${plik}`);
    assert.ok(!/from ['"]node:/.test(kod), `app/${plik}: import z node: — kod przeglądarkowy`);
    assert.ok(!/\brequire\s*\(/.test(kod), `app/${plik}: require() — kod przeglądarkowy`);
    assert.ok(!/\bprocess\./.test(kod), `app/${plik}: process.* — API Node`);
  }
});

test('kontrakt: geolokalizacja w app.js idzie przez pozycja.js (ADR 0004 pkt 1)', () => {
  // Jeden watcher na rozgrywkę, reguły i komunikaty w module testowalnym bez DOM.
  assert.ok(/from '\.\/pozycja\.js\?v=/.test(APP), 'app.js musi importować moduł pozycji');
  assert.match(APP, /watchPozycja\(/, 'watcher zakłada osłona z pozycja.js');
  assert.ok(!/watchPosition/.test(APP), 'app.js nie woła watchPosition samodzielnie');
  assert.ok(!/clearWatch/.test(APP), 'app.js nie woła clearWatch samodzielnie — zamykanie jest w osłonie');
  assert.ok(!/enableHighAccuracy/.test(APP), 'opcje watchera mieszkają w pozycja.js, nie w UI');

  const POZYCJA = czytaj('app/pozycja.js');
  assert.match(POZYCJA, /enableHighAccuracy: true, maximumAge: 2000, timeout: 20000/, 'opcje dokładnie jak w ADR 0004 pkt 1');
  assert.match(POZYCJA, /navigator/, 'osłona przyjmuje `geolocation` jako parametr — dzięki temu jest testowalna');
});

test('kontrakt: index.html nie używa ścieżek od korzenia (ADR 0002 pkt 3)', () => {
  assert.ok(!/(?:href|src)="\//.test(INDEX), 'ścieżka zaczynająca się od "/" złamie się pod /okolica/ na GitHub Pages');
  assert.ok(INDEX.includes('href="app/styles.css?v='), 'CSS powinien być podpięty ścieżką względną');
  assert.ok(INDEX.includes('src="app/app.js?v='), 'moduł JS powinien być podpięty ścieżką względną');
});

test('kontrakt: w drzewie nie ma katalogu .github/workflows zadanego przez agenta (LESSONS L4)', () => {
  assert.ok(!existsSync(join(ROOT, '.github/workflows')), 'lustro receptury CI ma leżeć w docs/setup/ci-workflow.yml — token agenta nie zapisze workflow');
  assert.ok(existsSync(join(ROOT, 'docs/setup/ci-workflow.yml')));
});

/* --------------------------------------------------------- UI: DOM ↔ index */

test('kontrakt: wszystkie identyfikatory wołane z app.js istnieją w index.html', () => {
  const zadane = new Set([...APP.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]));
  const dolaczone = [...APP.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]);
  for (const id of dolaczone) zadane.add(id);
  // ekrany budowane z listy EKRANY: `ekran-${e}` — sprawdzamy wszystkie warianty
  for (const ekran of ['setup', 'pozycja', 'stacje', 'prompt', 'paczka']) zadane.add(`ekran-${ekran}`);
  assert.ok(zadane.size > 25, `znaleziono tylko ${zadane.size} identyfikatorów — test pewnie nie widzi kodu`);
  for (const id of zadane) {
    assert.ok(INDEX.includes(`id="${id}"`), `app.js woła #${id}, którego nie ma w index.html`);
  }
});

test('kontrakt: przycisk trybu testowego ma w HTML stan początkowy aria-pressed="false"', () => {
  // Atrapa DOM nie parsuje atrybutów, więc `test/aplikacja.test.js` sprawdza tylko
  // przełączenie; stan startowy pilnuje ten kontrakt.
  assert.match(INDEX, /id="przycisk-test"[^>]*aria-pressed="false"/);

  const symulacja = INDEX.match(/<button id="przycisk-symulacja"[^>]*>/)?.[0];
  assert.ok(symulacja, 'brak przycisku symulacji dojścia (M3)');
  assert.match(symulacja, /aria-pressed="false"/, 'symulacja startuje wyłączona');
  assert.match(symulacja, /\bhidden\b/, 'symulacja tylko w trybie testowym');

  const pierscien = INDEX.match(/<button id="przycisk-pierścien"[^>]*>/)?.[0];
  assert.ok(pierscien, 'brak przycisku wymuszania trybu uproszczonego (M4)');
  assert.match(pierscien, /aria-pressed="false"/, 'tryb uproszczony startuje niewymuszony');
  assert.match(pierscien, /\bhidden\b/, 'widoczny dopiero gdy sieć jest pobrana');

  const reczne = INDEX.match(/<button id="przycisk-reczne"[^>]*>/)?.[0];
  assert.ok(reczne, 'brak przycisku trybu ręcznego (ADR 0005 pkt 8b)');
  assert.match(reczne, /aria-pressed="false"/, 'tryb ręczny startuje wyłączony');
  assert.match(reczne, /\bhidden\b/, 'widoczny dopiero na ekranie stacji bez sieci');

  assert.match(INDEX, /id="bledy-stacje"[^>]*role="alert"/, 'błędy sieci drogowej w polu role=alert (nie alert())');

  const eksportPaczki = INDEX.match(/<button id="przycisk-eksport-paczki"[^>]*>/)?.[0];
  assert.ok(eksportPaczki, 'brak eksportu paczki do pliku (ADR 0010 pkt 3)');
  assert.match(eksportPaczki, /type="button"/);
  assert.match(eksportPaczki, /\bhidden\b/, 'eksport dopiero z przyjętą paczką');

  const podglad = INDEX.match(/<div id="podglad-organizatora"[^>]*>/)?.[0];
  assert.ok(podglad, 'brak podglądu organizatora (ADR 0006 pkt 8)');
  assert.match(podglad, /\bhidden\b/, 'podgląd domyślnie schowany — otwiera się dopiero z przyjętą paczką');
  assert.match(INDEX, /Tylko dla organizatora/, 'podgląd ma jawne ostrzeżenie, że to treści nie dla graczy');
  assert.match(INDEX, /id="bledy-stacje"[^>]*\bhidden\b/, 'pole błędów stacji domyślnie schowane');
});

test('kontrakt: kroki w pasku nawigacji pokrywają się z ekranami', () => {
  for (const ekran of ['setup', 'pozycja', 'stacje', 'prompt', 'paczka']) {
    assert.ok(INDEX.includes(`data-krok="${ekran}"`), `brak kroku ${ekran} w pasku nawigacji`);
  }
});

/* ------------------------------------------------- dostawcy: kod ↔ ASSETS */

test('kontrakt: podkłady mapy z kodu mają wpis w docs/ASSETS.md', () => {
  for (const klucz of Object.keys(PODKLADY)) {
    if (klucz === 'brak') continue;
    assert.ok(ASSETS.includes(`\`${klucz}\``), `podkład „${klucz}" nie ma wpisu w ASSETS §1 (polityka i atrybucja)`);
  }
});

test('kontrakt: CARTO nie wróciło do kodu (wymaga klucza API — ASSETS §1.1)', () => {
  for (const plik of readdirSync(join(ROOT, 'app')).filter((f) => f.endsWith('.js') || f.endsWith('.css'))) {
    const kod = czytaj(`app/${plik}`);
    assert.ok(!/cartocdn|carto/i.test(kod), `app/${plik}: CARTO wymaga klucza API — niedozwolone (ADR 0001, ASSETS §1.1)`);
  }
});

test('kontrakt: Overpass ma instancje opisane w ASSETS §2, a Nominatim jest wyłączony domyślnie', () => {
  assert.ok(ASSETS.includes('overpass-api.de/api/interpreter'));
  assert.ok(ASSETS.includes('overpass.private.coffee'));
  assert.ok(ASSETS.includes('nominatim.openstreetmap.org') && ASSETS.includes('Nominatim Usage Policy'));
  const konfig = czytaj('app/konfig.js');
  assert.ok(!/nominatim/i.test(konfig), 'geokodacja Nominatim nie jest włączona w kanonie konfiguracji (ADR 0013 pkt 3)');
});

/* --------------------------------------------- rejestr ADR i lektura §0 */

test('kontrakt: każdy ADR z rejestru istnieje na dysku i każdy plik ADR jest w rejestrze', () => {
  const rejestr = czytaj('docs/decisions/README.md');
  const linki = [...rejestr.matchAll(/\((\d{4}-[a-z0-9-]+\.md)\)/g)].map((m) => m[1]);
  assert.ok(linki.length >= 13, `rejestr wymienia ${linki.length} ADR-ów`);
  for (const plik of linki) {
    assert.ok(existsSync(join(ROOT, 'docs/decisions', plik)), `rejestr linkuje ${plik}, którego nie ma`);
  }
  const naDysku = readdirSync(join(ROOT, 'docs/decisions')).filter((f) => /^\d{4}-.*\.md$/.test(f));
  for (const plik of naDysku) {
    assert.ok(linki.includes(plik), `ADR ${plik} istnieje, ale nie ma go w rejestrze`);
  }
});

test('kontrakt: pliki lektury startowej z AGENTS.md §0 istnieją', () => {
  for (const sciezka of ['docs/PROTOKOL.md', 'docs/decisions/README.md', 'docs/LESSONS.md', 'docs/setup/ENVIRONMENT.md', 'docs/ROADMAP.md', 'docs/ARCHITECTURE.md', 'docs/WORKFLOW.md', 'docs/ASSETS.md', 'docs/BACKLOG.md', 'docs/PROJECT_HISTORY.md']) {
    assert.ok(existsSync(join(ROOT, sciezka)), `AGENTS.md każe czytać ${sciezka}, a pliku nie ma`);
  }
  const handoffy = readdirSync(join(ROOT, 'docs/setup')).filter((f) => /^HANDOFF_\d{4}-\d{2}-\d{2}/.test(f));
  assert.ok(handoffy.length >= 1, 'brak handoffu w docs/setup/');
});

test('kontrakt: LESSONS ma ciągłą numerację i wymagany format', () => {
  const lessons = czytaj('docs/LESSONS.md');
  const numery = [...lessons.matchAll(/^## L(\d+) /gm)].map((m) => Number(m[1]));
  assert.ok(numery.length >= 6, `rejestr ma ${numery.length} lekcji`);
  numery.forEach((n, i) => assert.equal(n, i + 1, `numeracja lekcji się rwie na ${n}`));
  for (const n of numery) {
    const sekcja = lessons.split(`## L${n} `)[1].split('\n## L')[0];
    assert.ok(sekcja.includes('**Objaw:**'), `L${n} bez objawu`);
    assert.ok(sekcja.includes('**Przyczyna:**'), `L${n} bez przyczyny`);
    assert.ok(sekcja.includes('**Reguła:**'), `L${n} bez reguły`);
  }
});

test('kontrakt: AGENTS.md nie obiecuje lektury pliku, którego nie ma w §0', () => {
  assert.ok(AGENTS.includes('docs/PROTOKOL.md') && AGENTS.includes('docs/setup/ENVIRONMENT.md'));
  assert.ok(AGENTS.includes('40 tys. tokenów'), 'budżet lektury startowej musi być jawny');
});

/* ------------------------------- decyzje: ADR ↔ rejestr ↔ kod */

test('kontrakt: status w rejestrze ADR jest zgodny ze statusem w pliku ADR', () => {
  const rejestr = czytaj('docs/decisions/README.md');
  const wiersze = [...rejestr.matchAll(/^\| \[(\d{4})\]\(([^)]+)\) \| ([^|]+) \| ([^|]+) \|$/gm)];
  assert.ok(wiersze.length >= 13, `rejestr ma ${wiersze.length} wierszy`);
  for (const [, numer, plik, tytul, statusRejestru] of wiersze) {
    const tresc = czytaj(`docs/decisions/${plik}`);
    const m = tresc.match(/^- Status: (\w+)/m);
    assert.ok(m, `${plik}: brak linii „- Status:"`);
    assert.equal(m[1], statusRejestru.trim(), `ADR ${numer}: status w pliku („${m[1]}") ≠ status w rejestrze („${statusRejestru.trim()}")`);
    assert.ok(tresc.split('\n')[0].startsWith(`# ${numer} —`), `${plik}: tytuł nie zaczyna się od numeru ADR`);
  }
});

test('kontrakt: kontener paczki jest opisany w PROTOKOL §3.3 tak jak w app/kodowanie.js', () => {
  assert.ok(PROTOKOL.includes(`"${SCHEMAT_KONTENERA}"`), 'w protokole nie ma schematu kontenera z kodu');
  assert.ok(PROTOKOL.includes(`"${KODOWANIE}"`), 'w protokole nie ma nazwy kodowania z kodu');
  const sekcja = PROTOKOL.slice(PROTOKOL.indexOf('### 3.3'), PROTOKOL.indexOf('## 4.'));
  for (const pole of ['schemat', 'protokol', 'kodowanie', 'skrot', 'dane']) {
    assert.ok(sekcja.includes(pole), `§3.3 nie opisuje pola „${pole}"`);
  }
  assert.ok(sekcja.includes('To nie jest szyfrowanie'), '§3.3 musi mówić wprost, że to nie szyfrowanie (ADR 0007 pkt 5)');
  for (const poleZSzyfrowania of ['"sol"', '"iv"', '"iteracje"']) {
    assert.ok(!sekcja.includes(poleZSzyfrowania), `§3.3 wciąż opisuje pole ${poleZSzyfrowania} z odrzuconego wariantu AES-GCM`);
  }
});

test('kontrakt: dokumentacja nie obiecuje szyfrowania (ADR 0007 pkt 5)', () => {
  assert.ok(!existsSync(join(ROOT, 'app/krypto.js')), 'moduł krypto.js nie istnieje po decyzji z ADR 0007');
  for (const plik of ['docs/ARCHITECTURE.md', 'docs/ROADMAP.md', 'docs/setup/ENVIRONMENT.md', 'AGENTS.md', 'README.md']) {
    const tresc = czytaj(plik);
    assert.ok(!/app\/krypto\.js|krypto\.zaszyfruj|krypto\.odszyfruj/.test(tresc), `${plik}: odniesienie do nieistniejącego modułu krypto.js`);
    assert.ok(!/PBKDF2|AES-GCM/.test(tresc), `${plik}: obiecuje szyfrowanie, którego w kodzie nie ma (BACKLOG B16)`);
  }
  assert.ok(README.includes('nie\nzaszyfrowana') || README.includes('nie zaszyfrowana'), 'README musi mówić wprost, że paczka nie jest zaszyfrowana');
  assert.ok(INDEX.includes('nie jest zaszyfrowany'), 'ekran wklejania musi mówić wprost, że tekst nie jest zaszyfrowany');
  assert.ok(INDEX.includes('identyfikator rozgrywki'), 'kod gry musi być opisany jako identyfikator, nie klucz (ADR 0007 pkt 4)');
});

test('kontrakt: AME-main.zip nie wrócił do korzenia (decyzja właściciela 2026-09-05)', () => {
  assert.ok(!existsSync(join(ROOT, 'AME-main.zip')), 'wzorce organizacyjne są przeniesione — archiwum AME zostaje w historii git');
});

/* ------------------------------------------------------------------ mapa (M2) */

const PANELE_MAPY = ['pozycja', 'stacje'];
const CZESCI_MAPY = ['', '-svg', '-kafelki', '-okregi', '-pinezki', '-marker', '-przybliz', '-oddal', '-centruj', '-skala', '-atrybucja'];

test('kontrakt: szkielet obu paneli mapy jest w index.html kompletny', () => {
  for (const panel of PANELE_MAPY) {
    for (const czesc of CZESCI_MAPY) {
      const id = `mapa-${panel}${czesc}`;
      assert.ok(INDEX.includes(`id="${id}"`), `w index.html brakuje #${id} — mapa by się nie wpięła`);
    }
  }
});

test('kontrakt: panel mapy jest dostępny — svg ma rolę i etykietę, przyciski mają typ i aria-label', () => {
  for (const panel of PANELE_MAPY) {
    const znacznikSvg = INDEX.match(new RegExp(`<svg id="mapa-${panel}-svg"[^>]*>`))?.[0];
    assert.ok(znacznikSvg, `brak <svg id="mapa-${panel}-svg">`);
    assert.match(znacznikSvg, /role="img"/);
    assert.match(znacznikSvg, /aria-label="/);
    for (const akcja of ['przybliz', 'oddal', 'centruj']) {
      const przycisk = INDEX.match(new RegExp(`<button id="mapa-${panel}-${akcja}"[^>]*>`))?.[0];
      assert.ok(przycisk, `brak przycisku #mapa-${panel}-${akcja}`);
      assert.match(przycisk, /type="button"/);
      assert.match(przycisk, /aria-label="/);
    }
  }
});

test('kontrakt: atrybucja dostawcy nie jest domyślnie chowana w CSS (ADR 0003 pkt 3)', () => {
  assert.ok(STYLE.includes('.mapa-atrybucja'), 'brak stylów atrybucji');
  // chować wolno tylko pustą (podkład wyłączony) — nigdy samej atrybucji
  assert.ok(!/\.mapa-atrybucja\s*\{[^}]*display:\s*none/.test(STYLE), 'atrybucja nie może być domyślnie display:none');
  assert.ok(STYLE.includes('.mapa-atrybucja:empty'), 'pusta atrybucja (podkład „brak") może zniknąć');
  assert.ok(/\.mapa\s*\{[^}]*touch-action:\s*none/.test(STYLE), 'gest mapy wymaga touch-action: none na panelu');
});

test('kontrakt: mapa.js nie woła sieci, geolokalizacji ani alertów — rysuje to, co dostał', () => {
  assert.ok(!/\bfetch\s*\(/.test(MAPA), 'mapa.js nie może sam pobierać danych (kafelki ładuje <image>)');
  assert.ok(!/navigator\.geolocation|watchPosition/.test(MAPA), 'pozycja wchodzi do mapy przez app.js, nie z API');
  assert.ok(!/\balert\s*\(|\bconfirm\s*\(|\bprompt\s*\(/.test(MAPA), 'komunikaty idą do warstwy aplikacji (ADR 0015 pkt 6)');
  assert.ok(!/\brequire\s*\(|node:/.test(MAPA), 'zero zależności i zero API Node (ADR 0001, LESSONS L6)');
});

test('kontrakt: szablony URL kafelków są dokładnie te z docs/ASSETS.md §1', async () => {
  const { SZABLONY_KAFELKOW } = await import('../app/mapa.js');
  for (const [klucz, szablon] of Object.entries(SZABLONY_KAFELKOW)) {
    if (szablon === null) {
      assert.equal(klucz, 'brak', 'tylko podkład „brak" nie ma URL-a');
      continue;
    }
    // ASSETS zapisuje rotację poddomen jako `{a,b,c}`, kod jako `{s}` z listą
    // `PODDOMENY = ['a','b','c']` — porównujemy po ujednoliceniu zapisu
    const wDokumentacji = szablon.replace('{s}', '{a,b,c}');
    assert.ok(
      ASSETS.includes(wDokumentacji),
      `szablon ${klucz} (${wDokumentacji}) nie ma wiersza w ASSETS §1`,
    );
  }
  assert.match(SZABLONY_KAFELKOW['esri-satelita'], /\{z\}\/\{y\}\/\{x\}$/, 'Esri ma odwrotną kolejność y/x (ASSETS §1)');
});

test('kontrakt: ekran „dane i prywatność" ma cztery karty z ADR 0013 pkt 7 i przycisk kasowania', () => {
  for (const id of ['ekran-prywatnosc', 'przycisk-prywatnosc', 'przycisk-prywatnosc-stopka', 'przycisk-wrocz-prywatnosc', 'przycisk-czysc-dane', 'czysc-dane-status']) {
    assert.ok(INDEX.includes(`id="${id}"`), `brak #${id} w index.html`);
  }
  const sekcja = INDEX.slice(INDEX.indexOf('id="ekran-prywatnosc"'), INDEX.indexOf('</section>', INDEX.indexOf('id="ekran-prywatnosc"')));
  for (const temat of ['Co jest pobierane', 'Dokąd trafia Twoja pozycja', 'Co zostaje na telefonie', 'Jak to skasować']) {
    assert.ok(sekcja.includes(temat), `ekran prywatności nie mówi: ${temat} (ADR 0013 pkt 7)`);
  }
  assert.match(sekcja, /nie\s+zaszyfrowana/, 'paczka opisana uczciwie: ukryta, nie zaszyfrowana (ADR 0007)');
  assert.ok(!/jest zaszyfrowana/.test(sekcja), 'ekran nie może obiecywać szyfrowania');
});

test('kontrakt: warstwa aplikacji nie pyta przez confirm()/alert() (ADR 0015 pkt 6)', () => {
  // komentarze mogą NAZYWAĆ te funkcje (tłumaczą, czemu ich nie ma) — reguła
  // dotyczy wywołań, więc komentarze wycinamy przed sprawdzeniem
  const kod = APP.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/\bconfirm\s*\(/.test(kod), 'kasowanie danych jest dwustopniowe w UI, nie przez confirm()');
  assert.ok(!/\balert\s*\(/.test(kod), 'komunikaty idą do paska stanu i pól z role=alert/status');
});

test('kontrakt: ekran prywatności ujawnia warstwę zapasową Nominatim z przełącznikiem (ASSETS §3)', () => {
  const html = czytaj('index.html');
  assert.match(html, /id="geokodacja-zapasowa" type="checkbox"/, 'przełącznik zgody na Nominatim');
  const karta = html.split('Co jest pobierane i od kogo')[1].slice(0, 3000);
  assert.match(karta, /Nominatim/, 'dostawca nazwany jawnie');
  assert.match(karta, /domyślnie <strong>wyłączone<\/strong>/, 'domyślnie wyłączone — jak w ADR 0013 pkt 2');
  assert.match(karta, /okolica:geokodacja-endpoint/, 'przełączalność endpointu bez aktualizacji (wymóg OSMF)');
  assert.match(karta, /ODbL/, 'atrybucja licencji');
});

test('kontrakt: instrukcja promptu to cztery kroki jako inline SVG (ADR 0001 pkt 1, ADR 0011 pkt 6)', () => {
  const html = czytaj('index.html');
  const ekran = html.split('id="ekran-prompt"')[1].split('</section>')[0];
  const instrukcja = ekran.split('id="instrukcja-promptu"')[1].split('</ol>')[0];
  assert.equal((instrukcja.match(/<svg /g) ?? []).length, 4, 'cztery ikony, po jednej na krok');
  assert.equal((instrukcja.match(/<li>/g) ?? []).length, 4, 'kolejność DOM = kolejność kroków');
  // kolejność treści: kopiuj → model z internetem → odpowiedź → z powrotem
  const kroki = ['Kopiuj prompt', 'wyszukiwaniem', 'Kopiuj odpowiedź', 'wklej z powrotem'];
  let poprzedni = -1;
  for (const krok of kroki) {
    const i = instrukcja.indexOf(krok);
    assert.ok(i > poprzedni, `krok „${krok}" obecny i w kolejności`);
    poprzedni = i;
  }
  assert.match(instrukcja, /włączonym wyszukiwaniem\s*\n?\s*w internecie/, 'krok 2 podkreśla wymóg szukania w sieci (ADR 0008)');
  assert.equal((html.match(/<img /g) ?? []).length, 0, 'zero <img> — grafika wyłącznie inline (zero plików zewnętrznych)');
  assert.equal((html.match(/xlink:href="http|href="http[^"]*\.(png|jpg|svg)/g) ?? []).length, 0, 'SVG nie ciągnie nic z sieci');
});

test('kontrakt: cache-busting m5-1 spójny w index.html i importach app.js', () => {
  const html = czytaj('index.html');
  const app = czytaj('app/app.js');
  assert.equal((html.match(/\?v=m5-1/g) ?? []).length, 2, 'styles.css i app.js z nową wersją');
  assert.equal(html.includes('?v=m4-1'), false, 'bez sierot po starej wersji');
  assert.equal((app.match(/\?v=m5-1/g) ?? []).length, 8, 'wszystkie importy modułów z tą samą wersją');
  assert.equal(app.includes('?v=m4-1'), false);
});
