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

import { SZABLON_PROMPTU, SZABLON_PROMPTU_BEZ_WERYFIKACJI, WERSJA_PROTOKOLU } from '../app/protokol.js';
import { PODKLADY, TEMATY, WIEK } from '../app/konfig.js';
import { KODOWANIE, SCHEMAT_KONTENERA } from '../app/kodowanie.js';
import { KODY_POZYCJI } from '../app/pozycja.js';
import { KODY_WIELOOSOBOWE } from '../app/wieloosobowa.js';

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
const SW = czytaj('sw.js');
const GS = czytaj('docs/setup/apps-script-repo-paczek.gs');

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

test('kontrakt: szablon bez weryfikacji w docs/PROTOKOL.md §2.2 jest identyczny z SZABLON_PROMPTU_BEZ_WERYFIKACJI', () => {
  const start = PROTOKOL.indexOf('<!-- szablon-promptu-bez:start -->');
  const koniec = PROTOKOL.indexOf('<!-- szablon-promptu-bez:koniec -->');
  assert.ok(start >= 0 && koniec > start, 'brak znaczników szablonu §2.2 w protokole');
  const linie = PROTOKOL.slice(start, koniec).split('\n');
  const otwarcie = linie.findIndex((l) => l.trim().startsWith('```'));
  const zamkniecie = linie.map((l) => l.trim()).lastIndexOf('```');
  assert.ok(otwarcie >= 0 && zamkniecie > otwarcie, 'szablon §2.2 w protokole nie jest w ogrodzeniu');
  const zDokumentu = linie.slice(otwarcie + 1, zamkniecie).join('\n').trim();
  assert.equal(SZABLON_PROMPTU_BEZ_WERYFIKACJI, zDokumentu, 'uruchom `npm run build` (tools/synchronizuj-szablon.mjs) i wcommituj kod razem z dokumentem');
});

test('kontrakt ADR 0032: ekran promptu ma checkbox fact-check (domyślnie pusty, po prawej od Kopiuj)', () => {
  const ekran = INDEX.split('id="ekran-prompt"')[1].split('</section>')[0];
  assert.match(ekran, /id="prompt-factcheck" type="checkbox"/, 'checkbox wariantu');
  assert.ok(!/id="prompt-factcheck" type="checkbox"[^>]*checked/.test(ekran), 'domyślnie pusty — wariant bez weryfikacji');
  assert.match(ekran, /Pytania z fact check/, 'etykieta jak w zleceniu');
  assert.ok(ekran.indexOf('id="przycisk-kopiuj-prompt"') < ekran.indexOf('id="prompt-factcheck"'),
    'checkbox po prawej od „Kopiuj prompt"');
  assert.ok(!/id="przycisk-pobierz-prompt"/.test(ekran),
    'przycisku „Zapisz jako plik" nie ma (właściciel, 2026-09-09)');
  assert.match(ekran, /id="prompt-tryb-opis"/, 'opis trybu pod przyciskiem');
  assert.match(ekran, /id="prompt-podglad-naglowek"/, 'nagłówek podglądu mówi, który wariant widać');
});

test('kontrakt ADR 0032: znaczek Q ma token złota w obu motywach i klasę', () => {
  assert.match(STYLE, /--zloto: #7d6300;/, 'złoto jasne (kontrast pilnuje brama)');
  assert.match(STYLE, /--zloto: #e3b341;/, 'złoto ciemne');
  assert.match(STYLE, /\.znaczek-factcheck \{ color: var\(--zloto\); font-weight: 700; \}/, 'klasa znaczka');
  const audyt = czytaj('tools/audyt-kontrastu.mjs');
  assert.match(audyt, /tekst: 'zloto', tlo: 'tlo-karta'/, 'brama pilnuje kontrastu na karcie');
  assert.match(audyt, /tekst: 'zloto', tlo: 'tlo'/, 'brama pilnuje kontrastu na tle strony');
});

test('kontrakt ADR 0032: wynik i panel multi mają linię wariantu', () => {
  assert.match(INDEX, /id="gra-wynik-factcheck"/, 'linia wariantu na ekranie wyniku');
  assert.match(INDEX, /id="multi-factcheck"/, 'linia wariantu w panelu multi');
  assert.match(APP, /\$\('gra-wynik-factcheck'\)/, 'pokazWyniki ją wypełnia');
  assert.match(APP, /\$\('multi-factcheck'\)/, 'renderujPanelMulti ją wypełnia');
});

test('kontrakt 2026-09-09: opis trybu promptu mówi teksty właściciela, słowo w słowo', () => {
  assert.match(APP, /Tryb: pytania z fact check — model sprawdza każdy fakt w sieci ale generowanie pytań trwa dłużej\./,
    'tekst trybu z fact check (zlecenie 2026-09-09)');
  assert.match(APP, /Tryb: pytania bez fact-check — model AI korzysta z własnej wiedzy, generowanie pytań trwa krócej\./,
    'tekst trybu bez fact-check (zlecenie 2026-09-09)');
  assert.ok(!/szablon \$\{SZABLON_WERSJA/.test(APP),
    'opis trybu nie miesza już wersji szablonu (właściciel, 2026-09-09)');
});

/* ------------------------------------------------- kanony treści: doc ↔ kod */

test('kontrakt: kategorie wiekowe w protokole §4 = WIEK w app/konfig.js', () => {
  const wiersze = tabelaSekcji(PROTOKOL, '## 4. Kategorie wiekowe i wymagania trudności');
  assert.equal(wiersze.length, Object.keys(WIEK).length, `w dokumencie ${wiersze.length} kategorii, w kodzie ${Object.keys(WIEK).length}`);
  for (const wiersz of wiersze) {
    assert.equal(wiersz.length, 3, 'tabela §4 ma 3 kolumny (koniec kolumny Punkty w rev2)');
    const [klucz, etykieta, opis] = wiersz;
    const k = bezOgrodzenia(klucz);
    assert.ok(WIEK[k], `kategoria „${k}" jest w protokole, a nie ma jej w kodzie`);
    assert.equal(WIEK[k].etykieta, etykieta, `etykieta kategorii ${k}`);
    assert.equal(WIEK[k].opisTrudnosci, opis, `opis trudności kategorii ${k} trafia dosłownie do promptu`);
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

test('kontrakt: live CI jest identyczny z lustrem receptury (LESSONS L4, aktualizacja 2026-09-06)', () => {
  // L4 mówiło „agent nie zapisze workflow" (403) — po odświeżeniu tokena push
  // przeszedł, więc kontrakt pilnuje teraz SYNC: live == receptura z lustra.
  assert.ok(existsSync(join(ROOT, '.github/workflows/ci.yml')), 'brak live workflow — CI musi biegać na PR-ach i pushach do main');
  const live = czytaj('.github/workflows/ci.yml');
  const lustro = czytaj('docs/setup/ci-workflow.yml');
  const receptura = lustro.slice(lustro.indexOf('name: CI'));
  assert.ok(receptura.startsWith('name: CI'), 'lustro w docs/setup straciło recepturę');
  assert.equal(live, receptura, 'live workflow rozjechał się z lustrem — edytuj oba naraz');
  assert.match(live, /run: npm test/, 'brama testowa jest w CI');
  assert.match(live, /run: npm run check/, 'sprawdzenie szablonu jest w CI');
});

test('kontrakt: live workflow Pages jest identyczny z lustrem receptury (ADR 0002)', () => {
  // Pages z `Source: GitHub Actions` nie buduje strony sam — czeka na ten
  // workflow (wgranie artefaktu + `deploy-pages`). Lustro jak dla CI (L4).
  assert.ok(existsSync(join(ROOT, '.github/workflows/pages.yml')), 'brak live workflow Pages — strona się nie opublikuje');
  const live = czytaj('.github/workflows/pages.yml');
  const lustro = czytaj('docs/setup/pages-workflow.yml');
  const receptura = lustro.slice(lustro.indexOf('name: Pages'));
  assert.ok(receptura.startsWith('name: Pages'), 'lustro w docs/setup straciło recepturę Pages');
  assert.equal(live, receptura, 'live workflow Pages rozjechał się z lustrem — edytuj oba naraz');
  assert.match(live, /pages: write/, 'workflow potrzebuje uprawnienia pages: write');
  assert.match(live, /id-token: write/, 'deploy-pages wymaga id-token: write');
  assert.match(live, /name: github-pages/, 'środowisko github-pages jest wymagane przez deploy-pages');
  assert.match(live, /uses: actions\/upload-pages-artifact@v3/, 'artefakt strony');
  assert.match(live, /uses: actions\/deploy-pages@v4/, 'wdrożenie na Pages');
  assert.match(live, /path: \.\//, 'publikacja z korzenia repozytorium (ADR 0002)');
  assert.match(live, /run: npm test/, 'na Pages trafia tylko zielony kod');
});

/* --------------------------------------------------------- UI: DOM ↔ index */

test('kontrakt: wszystkie identyfikatory wołane z app.js istnieją w index.html', () => {
  const zadane = new Set([...APP.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]));
  const dolaczone = [...APP.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]);
  for (const id of dolaczone) zadane.add(id);
  // ekrany budowane z listy EKRANY: `ekran-${e}` — sprawdzamy wszystkie warianty
  for (const ekran of ['setup', 'multi', 'pozycja', 'stacje', 'prompt', 'paczka']) zadane.add(`ekran-${ekran}`);
  for (const panel of ['zaloz', 'dolacz', 'lobby']) zadane.add(`multi-panel-${panel}`); // M11: panele budowane z listy
  assert.ok(zadane.size > 25, `znaleziono tylko ${zadane.size} identyfikatorów — test pewnie nie widzi kodu`);
  // ADR 0029: ręcznego zgłaszania dojścia nie ma nigdzie — ani w index.html,
  // ani w app.js. Wyjątków od tej reguły nie ma: każdy id wołany z aplikacji
  // musi istnieć w interfejsie.
  for (const id of zadane) {
    assert.ok(INDEX.includes(`id="${id}"`), `app.js woła #${id}, którego nie ma w index.html`);
  }
});

// Atrapa DOM nie liczy pikseli, więc układu „mapa na spodzie" nie da się
// przetestować zachowaniem — pilnujemy przynajmniej struktury i reguł CSS.
// Dwa mignięcia z podglądu (2026-09-08). Atrapa nie renderuje, więc pilnujemy
// przyczyn wprost: stanu początkowego w HTML i `position` w regule panelu.
test('kontrakt: <body> ma data-ekran w HTML — inaczej strona miga przed startem JS', () => {
  // `pokazEkran()`/`pokazMapeStartowa()` ustawiają `data-ekran` dopiero po
  // wczytaniu modułu. Bez atrybutu w HTML reguły `body[data-ekran=…]` nie
  // łapią: mapa startowa jest schowana, a po chwili wszystko przeskakuje.
  assert.match(INDEX, /<body data-ekran="mapa">/, 'stan początkowy ekranu jest w HTML, nie tylko z JS');
});







test('kontrakt: stopka pokazuje numer budowy — inaczej nie poznać wersji z cache', () => {
  assert.ok(INDEX.includes('id="stopka-wersja"'), 'w stopce brakuje znacznika wersji');
  assert.ok(APP.includes("searchParams.get('v')"), 'app.js nie bierze wersji z ?v= własnego modułu');
});



// Ekran stacji: mapa i lista obok siebie, nie jedna nad drugą (właściciel:
// „te stacje odnoszą się właśnie do mapy"). Atrapa nie liczy pikseli, więc
// pilnujemy struktury i tego, że reguły istnieją dla obu orientacji.


test('kontrakt: przycisku trybu testowego NIE MA — wejście tylko przez ?test=true', () => {
  // Decyzja właściciela 2026-09-08: przełącznik w nagłówku kusił do grania bez
  // GPS, a wyniki i tak szły na Drive i do rankingów (ADR 0029). Pilnujemy, żeby
  // nie wrócił — LESSONS L31: usunięty element ma zostać usunięty.
  assert.equal(/id="przycisk-test"/.test(INDEX), false, 'przycisk trybu testowego zniknął z HTML');
  // W nagłówku nie ma żadnego przełącznika trybu. Słowo „tryb testowy" zostaje
  // w etykiecie symulacji dojścia i na stronie prywatności — tam opisuje stan,
  // a nie przełącza go, więc jest prawdziwe.
  const naglowek = INDEX.match(/<div class="akcje">[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.equal(/test/i.test(naglowek), false, `w akcjach nagłówka nie ma trybu testowego: ${naglowek}`);
  assert.ok(APP.includes('czyTrybTestowyWUrl'), 'tryb testowy czyta się z parametru adresu');

  // Rankingi są warstwą z dwoma wyjściami (decyzja właściciela 2026-09-08) —
  // z poprzedniego układu „ekran" nie dało się na telefonie wyjść.
  assert.match(INDEX, /<section id="ekran-ranking" class="ekran warstwa panel-centralny" hidden role="dialog" aria-modal="false"/);
  assert.match(INDEX, /<button id="przycisk-ranking-krzyzyk"[^>]*aria-label="Zamknij rankingi">✕<\/button>/, 'krzyżyk w rogu warstwy');
  assert.match(INDEX, /<button id="przycisk-wrocz-ranking"[^>]*>Zamknij rankingi<\/button>/, 'klawisz zamknięcia zamiast „← wróć"');
  assert.ok(APP.includes("$('przycisk-ranking-krzyzyk').addEventListener('click', wrocZRankingu)"), 'krzyżyk jest podpięty');
  assert.ok(STYLE.includes('.warstwa-krzyzyk'), 'krzyżyk ma styl');
  assert.match(APP, /'true', '1', 'tak'/, 'przyjmowane formy parametru ?test=');

  const symulacja = INDEX.match(/<button id="przycisk-symulacja-gra"[^>]*>/)?.[0];
  assert.ok(symulacja, 'brak przycisku symulacji dojścia (M3)');
  assert.match(symulacja, /\bhidden\b/, 'symulacja tylko w trybie testowym');

  // Właściciel 2026-09-11: przycisk „Tryb uproszczony" usunięty z UI —
  // degradacja do pierścienia jest automatyczna i jawska (S03), a ręczne
  // wymuszanie z nikim się nie konsultowało w terenie.
  assert.equal(INDEX.includes('id="przycisk-pierścien"'), false, 'przycisk „Tryb uproszczony" usunięty z ekranu stacji');

  const reczne = INDEX.match(/<button id="przycisk-reczne"[^>]*>/)?.[0];
  assert.ok(reczne, 'brak przycisku trybu ręcznego (ADR 0005 pkt 8b)');
  assert.match(reczne, /aria-pressed="false"/, 'tryb ręczny startuje wyłączony');
  assert.match(reczne, /\bhidden\b/, 'widoczny dopiero na ekranie stacji bez sieci');

  assert.match(INDEX, /id="bledy-stacje"[^>]*role="alert"/, 'błędy sieci drogowej w polu role=alert (nie alert())');

  // Decyzja właściciela 2026-09-07: poprawna paczka od razu zaczyna grę —
  // podgląd, ściąganie i edycja zniknęły z ekranu (zadania właściciela na Drive).
  for (const id of ['przycisk-ukryj', 'przycisk-eksport-paczki', 'przycisk-eksport-zestawu', 'przycisk-start-gry', 'podglad-organizatora', 'podglad-pytania', 'wynik-podsumowanie', 'zgoda-drive']) {
    assert.ok(!INDEX.includes(`id="${id}"`), `ekran paczki nie ma #${id} — usunięty decyzją 2026-09-07`);
  }
  assert.ok(!INDEX.includes('Tylko dla organizatora'), 'ostrzeżenie podglądu zniknęło razem z podglądem');
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
  assert.ok(AGENTS.includes('100 tys. tokenów'), 'budżet lektury startowej musi być jawny');
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

test('kontrakt: żadne app/*.js nie woła gołego fetch( — tylko window.fetch (D19, LESSONS L18)', () => {
  const GOLY_FETCH = /(?<![\w$.])fetch\s*\(/;
  const pliki = readdirSync(join(ROOT, 'app')).filter((n) => n.endsWith('.js'));
  assert.ok(pliki.length > 5, 'strażnik bez plików to atrapa');
  for (const nazwa of pliki) {
    const kod = czytaj(`app/${nazwa}`)
      .replace(/\/\*[\s\S]*?\*\//g, '') // komentarze blokowe
      .replace(/(^|[^:])\/\/.*$/gm, '$1'); // komentarze liniowe (nie :// w URL-ach)
    assert.ok(!GOLY_FETCH.test(kod), `${nazwa}: gołe fetch( — użyj fetchPrzegladarki()/window.fetch (L18)`);
  }
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
  for (const id of ['ekran-prywatnosc', 'przycisk-prywatnosc-stopka', 'przycisk-wrocz-prywatnosc', 'przycisk-czysc-dane', 'czysc-dane-status']) {
    assert.ok(INDEX.includes(`id="${id}"`), `brak #${id} w index.html`);
  }
  assert.ok(!/id="przycisk-prywatnosc"/.test(INDEX),
    'przycisku „Dane i prywatność" na ekranie setupu nie ma (właściciel, 2026-09-09) — dostęp tylko ze stopki');
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
  const kroki = ['Kopiuj prompt', 'czatów AI', 'Kopiuj odpowiedź', 'wklej z powrotem'];
  let poprzedni = -1;
  for (const krok of kroki) {
    const i = instrukcja.indexOf(krok);
    assert.ok(i > poprzedni, `krok „${krok}" obecny i w kolejności`);
    poprzedni = i;
  }
  assert.equal((html.match(/<img /g) ?? []).length, 0, 'zero <img> — grafika wyłącznie inline (zero plików zewnętrznych)');
  assert.equal((html.match(/xlink:href="http|href="http[^"]*\.(png|jpg|svg)/g) ?? []).length, 0, 'SVG nie ciągnie nic z sieci');
});

test('kontrakt: cache-busting spójny — jedna wersja w index.html i we wszystkich importach app.js', () => {
  const html = czytaj('index.html');
  const app = czytaj('app/app.js');
  const wersjeHtml = [...html.matchAll(/\?v=([\w-]+)/g)].map((m) => m[1]);
  const wersjeApp = [...app.matchAll(/\?v=([\w-]+)/g)].map((m) => m[1]);
  assert.equal(wersjeHtml.length, 2, 'styles.css i app.js wersjonowane w HTML');
  assert.ok(wersjeApp.length >= 8, 'każdy import modułu w app.js wersjonowany');
  assert.equal(new Set([...wersjeHtml, ...wersjeApp]).size, 1, 'dokładnie jedna wersja w całej aplikacji — brak sierot po starych ?v=');
});

/* ============================ M6/R3: szkielet ekranu gry */

test('kontrakt: ekran gry — jeden ekran, cztery panele faz w kolejności DOM (plan M6, decyzja 1)', () => {
  const html = czytaj('index.html');
  const ekran = html.split('<section id="ekran-gra"')[1].split('</section>')[0];
  const panele = ['gra-panel-oczekuje', 'gra-panel-odcinek', 'gra-panel-pytanie', 'gra-panel-koniec'];
  let poprzedni = -1;
  for (const panel of panele) {
    const i = ekran.indexOf(`id="${panel}"`);
    assert.ok(i > poprzedni, `panel ${panel} obecny i w kolejności faz`);
    poprzedni = i;
  }
  // stan początkowy: tylko panel A widoczny, B/C/D hidden (faza przygotowanie)
  assert.ok(!/id="gra-panel-oczekuje"[^>]*hidden/.test(ekran), 'panel A widoczny na starcie');
  for (const panel of panele.slice(1)) {
    assert.match(ekran.split(`id="${panel}"`)[1].slice(0, 80), /hidden/, `panel ${panel} domyślnie ukryty`);
  }
});

test('kontrakt: ekran gry — pełna lista id-ów potrzebnych wiringowi R4–R6 i M7', () => {
  const html = czytaj('index.html');
  const wymagane = [
    'gra-kolejka', 'gra-dystans', 'gra-postep',
    'mapa-gra', 'mapa-gra-svg', 'mapa-gra-kafelki', 'mapa-gra-okregi', 'mapa-gra-pinezki', 'mapa-gra-marker',
    'bledy-gra', 'gra-komunikat',
    'gra-kto-idzie', 'gra-cel-stacji', 'przycisk-start-odcinka',
    'gra-dystans-odcinka', 'przycisk-pauza', 'gra-pauza-komunikat',
    'gra-pytanie-naglowek', 'gra-pytanie-tresc', 'gra-odpowiedzi',
    'gra-wynik-odpowiedzi', 'gra-odpowiedz-ocena', 'gra-wyjasnienie', 'gra-zrodla', 'przycisk-nastepna-stacja',
    'gra-wyniki', 'gra-wyniki-tbody',
    'gra-wynik-zwyciezca', 'gra-wynik-statystyki',
    'gra-wynik-szczegoly', 'gra-wynik-gracze',
    'gra-wynik-stacje', 'gra-wynik-stacje-tbody',
    'wynik-eksport', 'przycisk-udostepnij-wynik', 'przycisk-kopiuj-wynik', 'przycisk-pobierz-wynik',
    'przycisk-pobierz-obraz', 'przycisk-udostepnij-obraz',
    'gra-wynik-tekst-detale', 'pole-wynik-tekst',
    'przycisk-pomin-stacje', 'przycisk-zakoncz-gre',
  ];
  for (const id of wymagane) assert.ok(html.includes(`id="${id}"`), `brak elementu #${id}`);
  assert.match(html, /id="bledy-gra" class="bledy" role="alert"/, 'błędy faz mają role="alert" (jak inne ekrany)');
  assert.match(html, /id="gra-komunikat" class="podpowiedz" role="status"/, 'komunikat fazy ma role="status"');
  assert.match(html, /id="przycisk-pomin-stacje"[^>]*disabled/, 'pominięcie domyślnie wyłączone (tylko w drodze, ADR 0015)');
  assert.ok(!html.includes('id="przycisk-start-gry"'), 'ręcznego startu nie ma — gra rusza sama po Sprawdź (decyzja 2026-09-07)');
  assert.match(html, /id="przycisk-udostepnij-wynik"[^>]*hidden/, 'share tylko z navigator.share (M7, decyzja 8)');
  assert.match(html, /id="przycisk-kopiuj-wynik"[^>]*hidden/, 'kopiowanie tylko z navigator.clipboard (M7, decyzja 8)');
  assert.match(html, /id="przycisk-udostepnij-obraz"[^>]*hidden/, 'udostępnianie obrazu tylko z navigator.canShare+File (M7/P5)');
});

test('kontrakt: pasek kroków ma 6 kroków, przyciski ekranu gry mają type=button', () => {
  const html = czytaj('index.html');
  const kroki = html.split('<nav id="kroki"')[1].split('</nav>')[0];
  assert.equal((kroki.match(/<li data-krok=/g) ?? []).length, 6, 'setup, pozycja, stacje, prompt, paczka, gra');
  assert.match(kroki, /data-krok="gra">6 · gra</, 'szósty krok na końcu');
  const ekran = html.split('<section id="ekran-gra"')[1].split('</section>')[0];
  const przyciski = ekran.match(/<button[^>]*>/g) ?? [];
  assert.ok(przyciski.length >= 8, `przycisków na ekranie gry: ${przyciski.length}`);
  for (const p of przyciski) assert.match(p, /type="button"/, `przycisk bez type=button: ${p.slice(0, 60)}`);
});

test('kontrakt: style ekranu gry — cele dotykowe i czytelność w słońcu (ADR 0011)', () => {
  const css = czytaj('app/styles.css');
  assert.match(css, /\.przycisk-odpowiedz \{[^}]*min-height: var\(--cel\)/s, 'odpowiedzi ≥ 44 px (--cel)');
  assert.match(css, /\.przycisk-odpowiedz \{[^}]*text-align: left/s, 'długie odpowiedzi wyrównane do lewej');
  assert.match(css, /\.przycisk-fazy \{[^}]*min-height: 56px/s, 'główny przycisk fazy większy niż zwykły cel');
  assert.match(css, /\.duzy-dystans \{[^}]*font-size: 34px/s, 'dystans to największa liczba na ekranie');
  assert.match(css, /\.duzy-dystans \{[^}]*tabular-nums/s, 'cyfry o stałej szerokości — dystans nie skacze');
  assert.match(css, /\.badge-dystans \{[^}]*background: var\(--akcent\)/s, 'badge dystansu na akcencie (kontrast)');
});

test('kontrakt: karta historii gier na setupie (M7/P6)', () => {
  const html = czytaj('index.html');
  for (const id of ['karta-historia', 'historia-detale', 'historia-naglowek', 'historia-usterki', 'historia-lista', 'przycisk-kasuj-historie']) {
    assert.ok(html.includes(`id="${id}"`), `brak elementu #${id}`);
  }
  assert.match(html, /id="karta-historia" class="karta" hidden/, 'karta historii domyślnie ukryta — staje tylko z zapisem');
  assert.match(html, /id="historia-usterki" class="bledy" role="alert" hidden/, 'usterki historii mają role="alert" (jak inne ekrany)');
  assert.match(html, /id="przycisk-kasuj-historie"[^>]*type="button"/, 'kasowanie historii to type=button');
});



test('kontrakt M8: manifest, ikony i ścieżki względne pod Pages (ADR 0002)', () => {
  assert.ok(existsSync(join(ROOT, '.nojekyll')), '.nojekyll musi istnieć — Pages bez przetwarzania Jekyll');
  const manifest = JSON.parse(czytaj('assets/manifest.json'));
  assert.equal(manifest.start_url, './', 'start_url WZGLĘDNY — Pages serwuje z podkatalogu /okolica/');
  assert.equal(manifest.scope, './', 'scope względny z tego samego powodu');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.lang, 'pl');
  assert.equal(manifest.theme_color, '#f6f2e9', 'theme_color = token --tlo motywu jasnego');
  assert.equal(manifest.background_color, '#f6f2e9');
  assert.ok(manifest.icons.length >= 4, 'zestaw: svg any + png any + maskable');
  for (const ikona of manifest.icons) {
    assert.ok(ikona.src.startsWith('./'), `ścieżka ikony względna: ${ikona.src}`);
    assert.ok(existsSync(join(ROOT, 'assets', ikona.src.slice(2))), `plik ikony istnieje: ${ikona.src}`);
    if (ikona.type === 'image/png') {
      const bajty = readFileSync(join(ROOT, 'assets', ikona.src.slice(2)));
      assert.deepEqual(
        [...bajty.subarray(0, 8)],
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
        `sygnatura PNG: ${ikona.src}`,
      );
      const szer = bajty.readUInt32BE(16);
      const wys = bajty.readUInt32BE(20);
      assert.equal(ikona.sizes, `${szer}x${wys}`, `deklarowane sizes == IHDR (bajty, nie nazwa): ${ikona.src}`);
    }
  }
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'), 'ikona maskable obecna (Android adaptive)');
  assert.ok(manifest.icons.some((i) => i.sizes === '180x180'), 'ikona 180 dla apple-touch-icon (iOS)');
  assert.match(INDEX, /<link rel="manifest" href="assets\/manifest.json">/, 'manifest podpięty ścieżką względną');
  assert.match(INDEX, /<link rel="apple-touch-icon" href="assets\/ikony\/ikona-180.png">/, 'apple-touch-icon podpięty');
  // Pages serwuje z PODKATALOGU — ścieżka root-absolute („/app/...") uciekłaby
  // do domeny głównej i dała 404; względne i data: są dozwolone
  assert.ok(!/(?:href|src)="\/[^/"]/.test(INDEX), 'zero ścieżek root-absolute w index.html');
});

test('kontrakt M9b: wysyłka Drive jest domyślna — ekran wklejania nie pyta o zgodę', () => {
  // Decyzja właściciela (2026-09-07): prywatna aplikacja — zestaw leci na
  // Drive zawsze, bez checkboxa i bez przypominajki (checkbox z 2026-09-06
  // usunięty z ekranu i z kodu).
  assert.ok(!INDEX.includes('id="zgoda-drive"'), 'checkbox zgody Drive usunięty z ekranu wklejania');
  assert.match(INDEX, /od razu zaczyna grę/, 'ekran mówi wprost: poprawna paczka = natychmiastowy start');
});

test('kontrakt UI 2026-09-11: usunięte ozdobniki właściciela z testów terenowych', () => {
  // (1a) wiersz o HTTPS na ekranie pozycji
  assert.equal(INDEX.includes('Geolokalizacja działa tylko przez HTTPS'), false, 'wiersz o HTTPS/usługach usunięty');
  // (1b) przycisk próby połączenia
  assert.equal(INDEX.includes('id="przycisk-test-polaczenia"'), false, 'przycisk „Sprawdź połączenie" usunięty');
  // (2'b) techniczny badge sprawiedliwości stacji
  assert.equal(INDEX.includes('id="stacje-sprawiedliwosc"'), false, 'wiersz „sieciowo: pierścień … odstęp" usunięty');
  // (3) szacunek rozmiaru odpowiedzi
  assert.equal(INDEX.includes('id="prompt-rozmiar"'), false, 'linia „Odpowiedź modelu będzie miała około…" usunięta');
  // (6) intro: nowe brzmienia i usunięte zdania
  assert.match(INDEX, /gra terenowa gdziekolwiek jesteś/, 'podtytuł: „gra terenowa gdziekolwiek jesteś"');
  assert.match(INDEX, /ruszasz dalej\./, 'zasada: „ruszasz dalej."');
  assert.match(INDEX, /Grać można w pojedynkę, z rodziną i znajomymi na jednym telefonie albo każdy na swoim urządzeniu\./, 'zdanie o składzie gry (doprecyzowane 2026-09-11: też tryb hasełkowy na jednym telefonie)');
  assert.equal(INDEX.includes('Potrzebujesz tylko zgody na dostęp do lokalizacji.'), false, 'zdanie o zgodzie usunięte z intro');
  assert.equal(INDEX.includes('Przycisk wyżej otwiera ustawienia gry'), false, 'zdanie o przycisku/⚙ usunięte z intro');
});

test('kontrakt ADR 0020: adres mostu jest wpisany w kod, a UI nie ma pola do wpisywania', () => {
  const MOST = czytaj('app/most.js');
  assert.match(MOST, /export const DOMYSLNY_URL_MOSTU = /, 'stała wdrożeniowa adresu mostu żyje w app/most.js');
  assert.match(MOST, /export function adresMostu/, 'reguła wyboru adresu jest funkcją modułu');
  assert.match(APP, /from '\.\/most\.js\?v=/, 'app.js bierze adres z modułu mostu');
  // ADR 0020 pkt 2: pola i przyciski zapisu adresu zniknęły z interfejsu
  for (const id of ['pole-url-repo', 'multi-url-mostu', 'przycisk-zapisz-url-repo', 'przycisk-multi-zapisz-url']) {
    assert.ok(!INDEX.includes(`id="${id}"`), `#${id} nie istnieje w index.html — adresu nie wpisuje się ręcznie`);
  }
  for (const id of ['most-stan-repo', 'multi-most-stan']) {
    assert.ok(INDEX.includes(`id="${id}"`), `stan mostu jest jawny w #${id} (LESSONS L6)`);
  }
  // Partia 3, pkt 1: akapity o pochodzeniu adresu i web appie żyją tylko w trybie testowym
  assert.match(INDEX, /<p class="podpowiedz tylko-test">Adres mostu jest wpisany/, 'akapit mostu w karcie multi: tylko test');
  assert.match(INDEX, /<p class="podpowiedz tylko-test">Adres wspólnego repozytorium jest wpisany/, 'akapit repozytorium: tylko test');
  assert.match(STYLE, /body:not\(\.tryb-testowy\) \.tylko-test\s*\{\s*display: none;/, 'CSS gasi .tylko-test poza trybem testowym');
  // komunikaty nie mogą odsyłać do pola, którego już nie ma
  assert.ok(!/wklej adres|wpisz adres|wpisz go w ustawieniach/i.test(APP), 'żaden komunikat nie każe wpisywać adresu mostu');
  assert.ok(!APP.includes('KLUCZ_URL_REPO'), 'app.js nie sięga po klucz adresu wprost — wszystko przez adresMostu()');
});

test('kontrakt M10: sw.js bez API Node, a WERSJA_SW == wersja cache-bust aplikacji', () => {
  assert.ok(!/from 'node:|require\(/.test(SW), 'sw.js: zero zależności od Node');
  const wersjaApp = /\?v=([\w.-]+)/.exec(APP)[1];
  assert.ok(
    SW.includes(`const WERSJA_SW = '${wersjaApp}';`),
    `WERSJA_SW musi być równa ?v= aplikacji (${wersjaApp}) — inaczej cache skorupy rozjedzie się z kodem`,
  );
  assert.match(APP, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/, 'rejestracja SW w app.js');
  assert.match(SW, /addEventListener\('fetch'/, 'SW obsługuje zdarzenie fetch');
});

test('kontrakt M10: przełącznik sygnałów w nagłówku, domyślnie włączony', () => {
  assert.match(INDEX, /<button id="przycisk-sygnaly"[^>]*aria-pressed="true"/, 'przycisk 🔔 obecny i domyślnie „wciśnięty"');
  assert.match(APP, /odegrajSygnal\('dotarcie'\)/, 'dojście do stacji gra sygnał');
});

test('kontrakt M10: brama obejmuje audyt kontrastu WCAG (T6)', () => {
  assert.match(PACKAGE.scripts.brama, /audyt-kontrastu\.mjs/, 'npm run brama musi gonić audyt kontrastu');
  assert.equal(PACKAGE.scripts.audyt, 'node tools/audyt-kontrastu.mjs', 'osobny skrót npm run audyt');
});

test('kontrakt M11: most Apps Script i `wieloosobowa.js` mówią jednym językiem', () => {
  for (const a of ['gra-zaloz', 'gra-dolacz', 'gra-start', 'gra-zdarzenie', 'gra-zakoncz', 'gra-hotseat', 'profil-ustaw', 'profil-sprawdz']) {
    assert.ok(GS.includes(`case '${a}'`), `doPost mostu obsługuje ${a}`);
  }
  for (const a of ['gry', 'gra-stan', 'ranking']) {
    assert.ok(GS.includes(`akcja === '${a}'`), `doGet mostu obsługuje ${a}`);
  }
  for (const s of ['RO-gra/1', 'RO-zdarzenie/1', 'RO-lobby/1', 'RO-ranking/1', 'RO-profil/1']) {
    assert.ok(GS.includes(s), `most zna schemat ${s}`);
  }
  assert.ok(GS.includes("'23456789ABCDEFGHJKLMNPQRSTUVWXYZ'"), 'alfabet kodu gry identyczny w moście i w module');
  assert.match(GS, /POLA_ZAKAZANE_W_ZDARZENIU/, 'most kasuje współrzędne ze zdarzeń (ADR 0019 pkt 3)');
  assert.ok(GS.includes('okolica-gry-otwarte') && GS.includes('okolica-gry-zakonczone'), 'katalogi gier w setup()');
  assert.ok(GS.includes('okolica-profile'), 'katalog profili PIN (ADR 0021)');
});

test('kontrakt Partia 1 (3): PIN-profil — UI, kody R19/R20, dokumentacja §9', () => {
  // bez osobnego przycisku sprawdzania: brama siedzi w „Dalej" (mniej klikania,
  // a setup ma się mieścić na 360 px — WORKFLOW §4.2)
  for (const id of ['pole-tozsamosc', 'profil-pseudonim', 'profil-pin', 'profil-stan', 'bledy-profil']) {
    assert.ok(INDEX.includes(`id="${id}"`), `index.html ma element #${id}`);
  }
  for (const k of ['R19', 'R20']) {
    assert.ok(KODY_WIELOOSOBOWE[k], `KODY_WIELOOSOBOWE zna ${k}`);
    assert.ok(PROTOKOL.includes(`| ${k} |`), `PROTOKOL §9.4 dokumentuje ${k}`);
  }
  // ADR 0026: jedno wołanie `profil-ustaw` zakłada profil ALBO potwierdza PIN
  assert.ok(APP.includes("akcja: 'profil-ustaw'"), 'app.js woła profil-ustaw (jedna akcja na bramę)');
  assert.ok(!APP.includes("'profil-sprawdz'"), 'profil-sprawdz nie jest już potrzebne w UI');
});

test('kontrakt ADR 0026: przejście z ekranu 1 przechodzi przez bramę tożsamości', () => {
  const start = APP.indexOf("$('przycisk-dalej-pozycja').addEventListener");
  assert.ok(start > 0, 'nasłuch „Dalej" z ekranu 1 istnieje');
  const handler = APP.slice(start, APP.indexOf("$('przycisk-gps')", start));
  assert.ok(handler.includes('await bramkaTozsamosci()'), '„Dalej" czeka na bramę tożsamości');
  assert.ok(
    handler.indexOf('bramkaTozsamosci') < handler.indexOf("pokazEkran('pozycja')"),
    'brama jest PRZED przejściem na ekran pozycji (inaczej imię nie jest wymagane)',
  );
  assert.ok(handler.includes('return;'), 'odmowa bramy zatrzymuje przejście');
});

test('kontrakt ADR 0026 aneks: lista graczy zamiast pola liczby, wynik hot-seat na Drive', () => {
  const WIELOOSOBOWA = czytaj('app/wieloosobowa.js');
  // blok tożsamości JEST listą graczy (decyzja właściciela 2026-09-07)
  for (const id of ['przycisk-dodaj-gracza', 'lista-graczy', 'lista-zapamietanych', 'wynik-drive']) {
    assert.ok(INDEX.includes(`id="${id}"`), `index.html ma element #${id}`);
  }
  // Zapis wyniku jest DOMYŚLNY: bez checkboxa przy każdej grze (właściciel,
  // 2026-09-07), a co i dokąd trafia — opisuje sekcja „Dane i prywatność".
  assert.ok(!INDEX.includes('id="hotseat-zgoda"'), 'zgody na zapis wyniku nie pytamy przy każdej grze');
  assert.match(INDEX, /Wspólny Drive: historia i rankingi/, 'sekcja prywatność opisuje zapis wyniku na Drive');
  assert.match(INDEX, /Wynik gry idzie na wspólne konto Google Drive/, 'sekcja prywatność mówi, że to domyślne');
  assert.ok(!INDEX.includes('id="setup-gracze"'), 'pola „Liczba graczy" nie ma — liczbą jest długość listy');
  assert.ok(!INDEX.includes('id="lista-imion"'), 'ręczne pola imion zastąpiła lista graczy');
  assert.match(INDEX, /Kto gra\?/, 'blok tożsamości pyta „Kto gra?"');
  assert.ok(APP.includes("'okolica:gracze'"), 'lista graczy utrwalana pod ustalonym kluczem');
  assert.ok(APP.includes('gracze-lokalni/1'), 'schemat zapamiętanej listy graczy');
  assert.ok(!APP.includes("'okolica:profil'"), 'stary klucz jednego profilu nie wraca');
  // PIN nigdy nie zostaje na telefonie — zapisuje się imię i znacznik potwierdzenia
  const zapis = APP.slice(APP.indexOf('function zapamietajGracza'), APP.indexOf('function przywrocGraczy'));
  assert.match(zapis, /\{ pseudonim: imie, zweryfikowany \}/, 'zapamietajGracza zapisuje imię i potwierdzenie, nie PIN');
  // hot-seat: wynik gry z jednego telefonu jedzie na Drive jednym poleceniem
  assert.ok(APP.includes('graHotseatDoWysylki'), 'app.js buduje polecenie gra-hotseat');
  assert.ok(WIELOOSOBOWA.includes("akcja: 'gra-hotseat'"), 'moduł wieloosobowa buduje tę akcję');
  assert.ok(GS.includes("case 'gra-hotseat'"), 'most przyjmuje gra-hotseat');
  assert.ok(PROTOKOL.includes('gra-hotseat'), 'PROTOKOL §9 dokumentuje gra-hotseat');
  // punkty liczy most, premia hot-seat = 0 — po obu stronach tak samo
  assert.match(WIELOOSOBOWA, /if \(gra\?\.tryb === TRYB_HOTSEAT\) return premia;/, 'aplikacja nie daje premii w hot-seat');
  assert.match(GS, /if \(gra\.tryb === 'hotseat'\) return premia;/, 'most nie daje premii w hot-seat (kopia pilnowana testem)');
  // awaria sieci nie gubi wyniku: kolejka i jej opróżnianie przy starcie
  assert.ok(APP.includes('okolica:hotseat-kolejka') && APP.includes('oproznijKolejkeHotseat()'), 'wynik czeka w kolejce i dojeżdża później (ADR 0016 pkt 5)');
});

test('kontrakt ADR 0024 aneks: promień nie jest kryterium, a komunikat nazywa powód', () => {
  const ZESTAWY = czytaj('app/zestawy.js');
  assert.match(ZESTAWY, /export function powodyNiedopasowania/, 'zestawy.js umie nazwać powód niedopasowania');
  assert.match(ZESTAWY, /export function czyWOkolicy/, 'okolica jest osobnym, jawnym kryterium');
  assert.equal(/w\.promienM <= promienM/.test(ZESTAWY), false, 'promień paczki nie jest już kryterium dopasowania');
  assert.match(ZESTAWY, /NIE są kryteriami: promień/, 'reguła jest zapisana przy kodzie, nie tylko w ADR');
  assert.match(ZESTAWY, /export function sumaPytanWpisu/, 'kryterium jest ŁĄCZNA liczba pytań, nie stacje × pytania');
  assert.match(ZESTAWY, /środek transportu \(właściciel wycofał/, 'środek transportu jawnie NIE jest kryterium');
  assert.match(ZESTAWY, /za mało pytań: paczka ma/, 'komunikat podaje liczby: ile ma paczka, ile chce setup');
  // komunikat karty paczek cytuje powody, a nie cały setup
  assert.match(APP, /powodyNiedopasowania\(m, kryteria\)/, 'app.js cytuje powody wprost w komunikacie');
  assert.equal(/ale żadna nie pasuje do tego setupu/.test(APP), false, 'stary komunikat z całym setupem zniknął');
  assert.match(APP, /czyWOkolicy\(m, kryteria\)/, 'paczki z innych okolic nie są nawet liczone');
});

test('kontrakt M11: UI gry wieloosobowej — ekrany, pseudonim, bramki', () => {
  // ekrany i panele (ADR 0019, plan M11/P4)
  for (const id of ['ekran-multi', 'karta-multi', 'multi-panel-zaloz', 'multi-panel-dolacz', 'multi-panel-lobby', 'gra-panel-multi', 'setup-rodzaj', 'multi-pseudonim', 'multi-most-stan']) {
    assert.ok(INDEX.includes(`id="${id}"`), `index.html ma element #${id}`);
  }
  // Zgody na wysyłkę NIE pytamy przy każdej grze (właściciel, 2026-09-07):
  // gra na wielu telefonach z natury działa przez Drive, a opis jest w sekcji
  // prywatność — tak samo jak przy wyniku hot-seat.
  assert.ok(!INDEX.includes('id="multi-zgoda"'), 'checkboxa zgody multi nie ma');
  assert.ok(!APP.includes('multi-zgoda'), 'kod nie czyta już pola zgody multi');
  assert.ok(!APP.includes('okolica:multi:zgoda'), 'klucz zgody multi zniknął');
  assert.match(INDEX, /Gra na wielu telefonach/, 'sekcja prywatność opisuje grę wieloosobową');
  assert.match(APP, /Wpisz pseudonim/, 'bez pseudonimu jawna odmowa wysyłki (plan P4)');
  assert.ok(APP.includes("'okolica:pseudonim'"), 'pseudonim utrwalany pod ustalonym kluczem (M12)');
  // akcje mostu wołane z aplikacji istnieją w .gs (jedna lista prawdy);
  // gra-zdarzenie wysyła warstwa synchronizacji (app/sync.js), nie app.js wprost
  const SYNC = czytaj('app/sync.js');
  for (const akcja of ['gra-zaloz', 'gra-dolacz', 'gra-start']) {
    assert.ok(APP.includes(akcja), `app.js woła akcję ${akcja}`);
  }
  assert.ok(SYNC.includes('gra-zdarzenie'), 'sync.js wysyła zdarzenia akcją gra-zdarzenie');
  // tury: lokalna bramka „nie Twoja tura" + serwer odmawia (R08 po obu stronach)
  assert.match(APP, /Teraz idzie:/, 'komunikat czyjej tury w UI');
  assert.match(APP, /przycisk-pomin-stacje'\)\.hidden = true/, 'w multi nie ma pomijania stacji (serwer zna tylko dojście/odpowiedź/rezygnację)');
});

test('kontrakt M12: rankingi liczy telefon, serwer oddaje surowe wiersze', () => {
  assert.ok(INDEX.includes('id="ekran-ranking"'), 'ekran rankingów w index.html');
  assert.ok(INDEX.includes('id="przycisk-ranking"'), 'przycisk 🏆 w nagłówku');
  assert.match(APP, /urlGet\(url, 'ranking'\)/, 'dane z GET akcja=ranking (RO-ranking/1)');
  assert.match(APP, /agregujRanking\(wiersze, filtr\)/, 'agregacje po stronie telefonu (ADR 0019 pkt 7)');
  assert.match(APP, /kategorieRankingu\(wiersze\)/, 'zakładki kategorii z dostępnych wierszy');
  assert.ok(GS.includes("akcja === 'ranking'"), 'most obsługuje akcję ranking');
});

test('ADR 0015 pkt 6: kody usterek wejścia promptu (WE**) nie kolidują z kodami pozycji (P**)', () => {
  const PROTOKOL_JS = czytaj('app/protokol.js');
  const start = PROTOKOL_JS.indexOf('export function zbudujPrompt(');
  assert.ok(start >= 0, 'zbudujPrompt istnieje w app/protokol.js');
  const cialo = PROTOKOL_JS.slice(start, PROTOKOL_JS.indexOf('export function parsujOdpowiedzModela', start));
  const kodyPromptu = [...cialo.matchAll(/dodaj\('([A-Z]+\d+)'/g)].map((m) => m[1]);
  assert.ok(kodyPromptu.length >= 7, `zbudujPrompt zgłasza co najmniej 7 kodów (jest ${kodyPromptu.length})`);
  for (const kod of kodyPromptu) {
    assert.match(kod, /^WE\d+$/, `${kod}: domena wejścia promptu ma własny prefiks WE (nie P jak pozycja)`);
    assert.ok(!(kod in KODY_POZYCJI), `${kod} nie istnieje w KODY_POZYCJI`);
  }
});

test('kontrakt: cache-busting w CAŁYM grafie — każdy import w app/*.js ma ?v= jak index.html', () => {
  const wersja = [...INDEX.matchAll(/\?v=([\w-]+)/g)].map((m) => m[1])[0];
  assert.ok(wersja, 'index.html wersjonuje zasoby przez ?v=');
  const pliki = readdirSync(join(ROOT, 'app')).filter((f) => f.endsWith('.js'));
  assert.ok(pliki.length >= 10, 'katalog app/ ma moduły do sprawdzenia');
  for (const plik of pliki) {
    const tresc = czytaj(`app/${plik}`);
    const gole = [...tresc.matchAll(/from '\.\/[a-z]+\.js'/g)].map((m) => m[0]);
    assert.deepEqual(gole, [], `${plik}: gołe importy bez ?v= tworzą drugą instancję modułu w przeglądarce (split cache)`);
    for (const m of tresc.matchAll(/from '\.\/[a-z]+\.js\?v=([\w-]+)'/g)) {
      assert.equal(m[1], wersja, `${plik}: znacznik ${m[1]} różny od index.html (${wersja})`);
    }
  }
});

/* ------------------------------- ADR 0006 aneks 2026-09-07: koniec edycji paczki */

test('kontrakt: ręczna edycja paczki nie istnieje w kodzie (ADR 0006 aneks 2026-09-07)', () => {
  const protokol = czytaj('app/protokol.js');
  // Podgląd i edycja organizatora zniknęły z ekranu decyzją właściciela
  // (2026-09-07), więc funkcja je obsługująca była martwa — a przy tym
  // walidowała `poprawna` jako 0..3, czyli sprzed rev2 (kod pozycyjny).
  assert.ok(!protokol.includes('zastosujEdycjePaczki'), 'martwa funkcja edycji usunięta z app/protokol.js');
  assert.ok(!protokol.includes('EDYTOWALNE_POLA'), 'lista pól edytowalnych usunięta razem z funkcją');
  assert.ok(!INDEX.includes('podglad-pytania'), 'ekran paczki nie ma podglądu pytania');
  assert.match(czytaj('app/protokol.js'), /export function poprawkaDlaModelu/, 'ścieżka usterek (poprawka do modelu) zostaje');
});

test('kontrakt: SZABLON_WERSJA ma konsumenta w UI (PROTOKOL §7 — łatka szablonu)', () => {
  // Audyt PR #3: PROTOKOL §7 każe podbijać łatkę szablonu w `SZABLON_WERSJA`,
  // a stałej nie czytał ani kod, ani test — podbicie byłoby niewidoczne.
  assert.match(INDEX, /<span id="stopka-szablon">PYT\/1\.0\.\d+<\/span>/, 'stopka ma miejsce na wersję szablonu');
  const app = czytaj('app/app.js');
  assert.match(app, /SZABLON_WERSJA/, 'app.js importuje stałą');
  assert.match(app, /\$\('stopka-szablon'\)\.textContent = SZABLON_WERSJA/, 'app.js ją renderuje');
  const stala = czytaj('app/protokol.js').match(/export const SZABLON_WERSJA = '([^']+)'/);
  assert.ok(stala, 'stała jest eksportowana z app/protokol.js');
  assert.match(stala[1], /^PYT\/1\.0\.\d+$/, 'łatka protokołu ma kształt PYT/1.0.N');
});

test('kontrakt ADR 0028: panel oceny pytania jest w interfejsie i podpięty', () => {
  for (const id of ['gra-oceny', 'gra-oceny-etykieta', 'gra-ocena-plus', 'gra-ocena-minus']) {
    assert.ok(INDEX.includes(`id="${id}"`), `index.html ma element #${id}`);
  }
  assert.match(INDEX, /Oceń pytanie/, 'panel jest nazwany po ludzku');
  assert.ok(INDEX.indexOf('id="gra-oceny"') < INDEX.indexOf('id="gra-odpowiedzi"'), 'panel stoi przy pytaniu, przed odpowiedziami');
  assert.ok(APP.includes('kliknijOcene(OCENA_PLUS)') && APP.includes('kliknijOcene(OCENA_MINUS)'), 'oba kciuki są podpięte');
  assert.ok(APP.includes('wyslijOceneWTle'), 'głos jedzie w tle, nie blokuje gry');
  assert.ok(APP.includes('oproznijKolejkeOcen()'), 'kolejka głosów jest opróżniana przy starcie');
  assert.ok(APP.includes('opisOcenTekst(walidujStatystykiOcen(meta.oceny))'), 'ekran 2 pokazuje statystyki paczki');
  assert.ok(APP.includes('STAN.paczkaRepoId'), 'oceny dotyczą paczek z repozytorium');
});

/**
 * Aneks ADR 0028 (właściciel, 2026-09-09): „Nie ma paczek, które nie istnieją
 * na Drive. Każda powinna móc być oceniona” — także wygenerowana przed chwilą
 * i ta wzięta z pamięci telefonu.
 */
test('kontrakt ADR 0028 aneks: ocenić można każdą paczkę, bo każda jest na Drive', () => {
  assert.ok(!APP.includes("STAN.paczkaRepoId = ''; // ADR 0028: paczka z telefonu nie zbiera ocen"),
    'paczka z telefonu nie jest już wykluczona z oceniania');
  assert.ok(APP.includes('idPaczkiDlaZestawu('), 'aplikacja odzyskuje identyfikator paczki z pamięci telefonu');
  assert.ok(APP.includes('zapamietajIdPaczkiDlaZestawu('), 'identyfikator jest zapamiętywany przy skrócie kontenera');
  assert.ok(APP.includes('okolica:paczki-drive'), 'mapa skrót → id paczki ma własny klucz w localStorage');
  assert.match(GS, /nazwa === FOLDERY\.zaakceptowane \|\| nazwa === FOLDERY\.przeglad/,
    'most przyjmuje głosy również dla paczek czekających na przegląd');
  assert.match(GS, /status: 'przyjeta-do-przegladu', nazwa, id: utworzony\.getId\(\)/,
    'most oddaje id przyjętej paczki — bez niego telefon nie wie, co ocenia');
});

test('kontrakt ADR 0029: ręcznego dojścia nie ma w interfejsie, a z gry da się wyjść', () => {
  assert.ok(!INDEX.includes('przycisk-reczne-dojscie'), 'przycisku „Jestem na miejscu" nie ma w index.html');
  assert.ok(!INDEX.includes('Jestem na miejscu'), 'ręczne zgłoszenie dojścia zniknęło z interfejsu');
  assert.ok(!APP.includes("$('przycisk-reczne-dojscie').disabled"), 'kod nie dotyka usuniętego przycisku');
  assert.match(czytaj('app/pozycja.js'), /ADR 0029/, 'komunikat P03 nie odsyła do usuniętego przycisku');
  assert.ok(INDEX.includes('id="przycisk-nowa-gra"'), 'na ekranie wyniku jest wyjście do nowej gry');
  assert.ok(APP.includes('function wrocNaPoczatek'), 'przycisk ma podpiętą funkcję');
  assert.ok(APP.includes('pokazMapeStartowa()'), 'wyjście wraca na mapę startową (decyzja 2026-09-09, zgłoszenie (3))');
  // LESSONS L31: gdy funkcja znika z interfejsu, jej opis zostaje w komunikatach.
  // Sześć kodów `P` i jeden komunikat `stanDojscia` kazały „zgłosić dojście
  // ręcznie" jeszcze po usunięciu przycisku — gracz czytał instrukcję, której
  // nie dało się wykonać.
  for (const [gdzie, tekst] of [['app/pozycja.js', czytaj('app/pozycja.js')], ['app/app.js', APP], ['index.html', INDEX]]) {
    assert.ok(!/zgłoś dojście ręcznie|zgłaszać ręcznie|w trybie ręcznym/i.test(tekst), `${gdzie} nadal odsyła do ręcznego zgłaszania dojścia`);
  }
});



/**
 * Uwagi właściciela 2026-09-09 (A1, A2, A3) do warstw nad mapą:
 * intro ma być większe i wyśrodkowane, rankingi nie mogą chować się pod belką,
 * a każda warstwa ma przyciemniać mapę tak jak rankingi.
 */
test('uwaga A1: ekran startowy ma duży, wyśrodkowany tytuł i rozwinięte intro', () => {
  assert.ok(INDEX.includes('class="warstwa-start-karta"'), 'treść intro siedzi w karcie wewnątrz warstwy');
  assert.match(STYLE, /\.warstwa-start h1 \{[^}]*font-size: clamp\(28px, 8vw, 40px\)/s, 'tytuł skaluje się z ekranem');
  assert.match(STYLE, /\.warstwa-start h1 \{[^}]*text-align: center/s, 'tytuł jest wyśrodkowany');
  assert.match(STYLE, /\.podtytul-start \{[^}]*text-align: center/s, 'podtytuł też');
  // Intro ma być dłuższe niż jedno zdanie — pinujemy liczbę akapitów, nie treść.
  // Uwagi terenowe #2 (2026-09-11): akapit o zgodzie na lokalizację skrócony
  // do wzmianki w podtytule („gdziekolwiek jesteś") — nie asertujemy go tu.
  const intro = INDEX.slice(INDEX.indexOf('warstwa-start-karta'), INDEX.indexOf('przycisk-start-zacznij'));
  assert.ok((intro.match(/<p[ >]/g) ?? []).length >= 4, 'intro ma co najmniej cztery akapity');
});

test('ADR 0034: wspólny panel mieści się pod mierzoną belką i przewija samodzielnie', () => {
  assert.match(STYLE, /\.panel-centralny:not\(\[hidden\]\) \{[^}]*var\(--wysokosc-belki/s);
  assert.match(STYLE, /\.panel-centralny:not\(\[hidden\]\) \{[^}]*overflow-y: auto/s);
  assert.ok(APP.includes('function ustawWysokoscBelki'));
  for (const ekran of ['setup', 'pozycja', 'stacje', 'prompt', 'paczka', 'gra', 'ranking', 'informacje']) {
    const sekcja = INDEX.match(new RegExp(`<section id="ekran-${ekran}"[\\s\\S]*?</section>`))?.[0];
    assert.ok(sekcja?.includes('panel-centralny'), ekran);
    assert.ok(!/id="mapa-(pozycja|stacje|gra)"/.test(sekcja), 'mapa poza panelem: ' + ekran);
  }
  assert.match(STYLE, /body\.podglad-mapy \.panel-centralny \{[^}]*visibility: hidden/s);
  assert.match(STYLE, /#przygaszenie-mapy \{[^}]*pointer-events: none/s);
});



/**
 * Zgłoszenie właściciela (2026-09-09): etykieta „Planowany czas gry (min)”
 * łamała się na dwa wiersze, bo `.siatka` miała na szerokim ekranie sztywne
 * `repeat(4, 1fr)` — czwarta kolumna zostawała pusta (pole „liczba graczy”
 * zniknęło w 2026-09-07), a trzy realne pola dostawały po ~145 px w karcie
 * setupu ograniczonej do 640 px.
 */
test('siatka pól setupu dopasowuje liczbę kolumn do liczby pól (bez pustej kolumny)', () => {
  const start = STYLE.indexOf('.siatka {');
  assert.ok(start >= 0, 'reguła .siatka istnieje');
  const blok = STYLE.slice(start, STYLE.indexOf('}', start));

  assert.match(blok, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*175px\),\s*1fr\)\)/,
    'auto-fit liczy kolumny z dostępnego miejsca; 175 px trzyma progi zwijania tam, gdzie były');
  assert.doesNotMatch(STYLE, /\.siatka \{[^}]*repeat\(4, 1fr\)/s,
    'żadna reguła nie wymusza czterech kolumn — przy trzech polach zostawała pusta');
  assert.doesNotMatch(STYLE, /@media[^{]*\{\s*\.siatka \{/,
    'siatka nie potrzebuje już zapytań @media: auto-fit zwija ją sam');

  // `min(100%, …)` jest tu istotne: samo `minmax(190px, 1fr)` przepełnia rząd
  // na ekranie 360 px zamiast zwinąć siatkę do jednej kolumny.
  assert.ok(blok.includes('min(100%, 175px)'),
    'minimum przycięte do szerokości kontenera — inaczej wąski telefon dostaje poziomy scroll');
});

/**
 * Zgłoszenie właściciela (2026-09-09): pole PIN przy imieniu gracza było
 * wyraźnie mniejsze od pola „Imię (pseudonim)” obok. Przyczyna: wspólna reguła
 * pól wymienia typy `input` jawnie (musi — inaczej złapałaby ~70 przycisków
 * `type="button"`), a `password` z tej listy wypadł, więc PIN dostawał domyślny
 * wygląd przeglądarki zamiast wysokości `--cel` i `font-size: 17px`.
 */
test('pola tekstowe: PIN wygląda jak zwykłe pole (wspólna reguła obejmuje password)', () => {
  const start = STYLE.indexOf("input[type='number']");
  assert.ok(start >= 0, 'reguła wspólna dla pól istnieje');
  const selektor = STYLE.slice(start, STYLE.indexOf('{', start));

  for (const typ of ['text', 'password', 'number']) {
    assert.ok(selektor.includes(`input[type='${typ}']`), `typ ${typ} korzysta ze wspólnej reguły pól`);
  }

  // Reguła nadaje wysokość celu dotykowego i rozmiar tekstu — to one decydują
  // o tym, czy dwa pola w jednej siatce wyglądają tak samo (ADR 0011: ≥44 px).
  const blok = STYLE.slice(start, STYLE.indexOf('}', start));
  assert.match(blok, /min-height: var\(--cel\)/, 'wspólna wysokość pól');
  assert.match(blok, /width: 100%/, 'pole wypełnia kolumnę siatki');
  assert.match(blok, /font-size: 17px/, 'wspólny rozmiar tekstu');

  // PIN i pseudonim stoją w tej samej siatce, więc różnicę widać od razu —
  // pinujemy, że oba są zwykłymi polami tekstowymi bez klas modyfikujących.
  assert.match(INDEX, /<input id="profil-pseudonim" type="text"[^>]*>/, 'pseudonim: pole tekstowe bez klasy');
  assert.match(INDEX, /<input id="profil-pin" type="password"[^>]*>/, 'PIN: pole hasłowe bez klasy');
});

/**
 * Zgłoszenie właściciela (2026-09-09): „Wyjaśnienie po odpowiedzi na pytanie
 * pisz taką samą dużą czcionką jak pytanie bo inaczej trudno ją odczytać na
 * urządzeniu bo jest maczkiem." Wyjaśnienie było klasą `.podpowiedz` (14 px,
 * kolor przygaszony) — a to tekst czytany w terenie, często dłuższy od pytania.
 */
test('gra: wyjaśnienie po odpowiedzi jest czytelne jak pytanie, nie jak podpowiedź', () => {
  assert.match(INDEX, /<p id="gra-wyjasnienie" class="gra-wyjasnienie">/,
    'wyjaśnienie ma własną klasę, nie .podpowiedz');

  const start = STYLE.indexOf('.gra-wyjasnienie {');
  assert.ok(start >= 0, 'reguła .gra-wyjasnienie istnieje');
  const blok = STYLE.slice(start, STYLE.indexOf('}', start));

  // Rozmiar pytania (`.karta .duzy`) jest źródłem prawdy — czytamy go z pliku,
  // zamiast wpisywać liczbę drugi raz (L12/L20: asercje kopiowane z kodu).
  const duzy = STYLE.slice(STYLE.indexOf('.karta .duzy'), STYLE.indexOf('}', STYLE.indexOf('.karta .duzy')));
  const rozmiarPytania = /font-size:\s*(\d+)px/.exec(duzy)?.[1];
  assert.ok(rozmiarPytania, 'da się odczytać rozmiar czcionki pytania');
  assert.match(blok, new RegExp(`font-size:\\s*${rozmiarPytania}px`),
    `wyjaśnienie ma ten sam rozmiar co pytanie (${rozmiarPytania}px)`);
  assert.match(blok, /color: var\(--tekst\)/,
    'pełny kolor tekstu, nie przygaszony --tekst-slaby');
});
