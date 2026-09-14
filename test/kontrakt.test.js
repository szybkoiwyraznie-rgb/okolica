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

/**
 * Wiersze KODU ze źródła jako `{ n, l }` — z wyciętymi komentarzami blokowymi
 * i liniowymi. Strażnikom tekstów pozwala odróżnić zdanie, które czyta gracz,
 * od nagrobka w komentarzu (LESSONS L31: komentarz celowo nazywa to, co umarło).
 * Ucięcie komentarza liniowego w środku napisu (np. adresu URL) jest świadome:
 * taki wiersz po prostu nie trafi do sprawdzenia — to tańsze niż liczyć
 * komentarz jako kod.
 */
function wierszeKodu(tekst) {
  let wBloku = false;
  const wynik = [];
  tekst.split('\n').forEach((surowy, i) => {
    let l = surowy;
    if (wBloku) {
      const koniecBloku = l.indexOf('*' + '/');
      if (koniecBloku < 0) return; // cały wiersz siedzi w komentarzu blokowym
      l = l.slice(koniecBloku + 2);
      wBloku = false;
    }
    const startBloku = l.indexOf('/' + '*');
    if (startBloku >= 0) {
      const koniecBloku = l.indexOf('*' + '/', startBloku + 2);
      if (koniecBloku < 0) { l = l.slice(0, startBloku); wBloku = true; } else {
        l = l.slice(0, startBloku) + l.slice(koniecBloku + 2);
      }
    }
    const liniowy = l.indexOf('//');
    if (liniowy >= 0) l = l.slice(0, liniowy);
    l = l.trim();
    if (l) wynik.push({ n: i + 1, l });
  });
  return wynik;
}

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

test('kontrakt ADR 0032: znaczek fact-check ma token złota w obu motywach i klasę', () => {
  assert.match(STYLE, /--zloto: #7d6300;/, 'złoto jasne (kontrast pilnuje brama)');
  assert.match(STYLE, /--zloto: #e3b341;/, 'złoto ciemne');
  assert.match(STYLE, /\.znaczek-factcheck \{ color: var\(--zloto\); font-weight: 700; \}/, 'klasa znaczka');
  const audyt = czytaj('tools/audyt-kontrastu.mjs');
  assert.match(audyt, /tekst: 'zloto', tlo: 'tlo-karta'/, 'brama pilnuje kontrastu na karcie');
  assert.match(audyt, /tekst: 'zloto', tlo: 'tlo'/, 'brama pilnuje kontrastu na tle strony');
});

test('kontrakt ADR 0032/0038/0044: linii wariantu fact-check nie ma już na żadnym ekranie gry', () => {
  // Zgłoszenie właściciela 2026-09-12 (D c): zdanie „Pytania bez wymuszonego
  // fact-checku — model nie musiał sprawdzać faktów w sieci” (i jego mutacja
  // „fact check”) zniknęło z ekranu wyników razem z CAŁĄ linią wariantu.
  assert.ok(!INDEX.includes('id="gra-wynik-factcheck"'), 'ekran wyniku bez linii wariantu (ADR 0038)');
  assert.ok(!APP.includes('gra-wynik-factcheck'), 'pokazWyniki nie wypełnia już tej linii (ADR 0038)');
  // ADR 0044 (uwaga F): ostatni nośnik tej linii — panel multi — też umarł, więc
  // w grze nie ma już żadnej informacji o wariancie. Wariant jedzie w stanie gry
  // (`zestaw.meta`, RO-gra/1) i reguła odczytu `czyWpisFactcheck` zostaje w kodzie
  // dla historii i repozytorium paczek.
  assert.ok(!INDEX.includes('id="multi-factcheck"'), 'linia wariantu zniknęła z ekranu gry (ADR 0044)');
  assert.ok(!APP.includes("$('multi-factcheck')"), 'kod jej nie wypełnia');
  assert.match(APP, /function czyWpisFactcheck\(wpis\) \{\n {2}return wpis\?\.factcheck !== false;/,
    'reguła odczytu wariantu zostaje (ADR 0032 §4: brak pola = zweryfikowana)');
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
  // Zakazane wywołania szukamy w KODZIE BEZ KOMENTARZY (LESSONS L17): zakaz
  // dotyczy wywołań, nie słów — komentarz „watchPosition milczy” w app.js
  // (bug G) jest wyjaśnieniem, nie naruszeniem kontraktu.
  const APP_BEZ_KOMENTARZY = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  assert.ok(/from '\.\/pozycja\.js\?v=/.test(APP), 'app.js musi importować moduł pozycji');
  assert.match(APP, /watchPozycja\(/, 'watcher zakłada osłona z pozycja.js');
  assert.ok(!/watchPosition/.test(APP_BEZ_KOMENTARZY), 'app.js nie woła watchPosition samodzielnie');
  assert.ok(!/clearWatch/.test(APP_BEZ_KOMENTARZY), 'app.js nie woła clearWatch samodzielnie — zamykanie jest w osłonie');
  assert.ok(!/enableHighAccuracy/.test(APP_BEZ_KOMENTARZY), 'opcje watchera mieszkają w pozycja.js, nie w UI');

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
  for (const panel of ['dolacz', 'lobby']) zadane.add(`multi-panel-${panel}`); // m12-74: panelu „zaloz” nie ma
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

  // Ranking wrócił w NOWEJ formie (zgłoszenie właściciela 2026-09-12, ADR 0039):
  // dwie tabele, ikonka pucharu, akcja mostu. STARA forma — zakładki, kategorie
  // i lista „Moje gry" — nie ma prawa wrócić (LESSONS L31); pilnuje tego test
  // „kontrakt ADR 0039" na końcu pliku.
  assert.ok(INDEX.includes('id="ekran-ranking"'), 'warstwa rankingu jest w HTML (ADR 0039)');
  assert.ok(APP.includes('przycisk-ranking'), 'ikonka pucharu jest podpięta w aplikacji');
  assert.ok(STYLE.includes('.warstwa-krzyzyk'), 'krzyżyk warstwy ma styl (używa go Informacje)');
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

test('kontrakt: Overpass ma instancje opisane w ASSETS §2, a Nominatim jest usunięty z kodu (właściciel, 2026-09-11)', () => {
  assert.ok(ASSETS.includes('overpass-api.de/api/interpreter'));
  assert.ok(ASSETS.includes('overpass.private.coffee'));
  // Warstwa zapasowa (odwrotna geokodacja Nominatim) wyleciała cała — kod nie
  // może nawet zbudować żądania do tego endpointu (docelowe rozwiązanie na
  // stałe z ASSETS §3: nazwa miejsca tylko z Overpass).
  for (const plik of readdirSync(join(ROOT, 'app')).filter((f) => f.endsWith('.js'))) {
    const kod = czytaj(`app/${plik}`);
    assert.ok(!kod.includes('nominatim.openstreetmap.org'), `app/${plik}: endpoint Nominatim nie ma prawa wrócić do kodu`);
    assert.ok(!/budujUrlGeokodacji|DOMYSLNY_ENDPOINT_GEOKODACJI|miejsceZOdpowiedziNominatim/.test(kod), `app/${plik}: warstwa zapasowa usunięta`);
  }
  assert.ok(!INDEX.includes('id="geokodacja-zapasowa"'), 'przełącznika zgody na Nominatim nie ma w index.html');
});

/* --------------------------------------------- rejestr ADR i lektura §0 */

test('kontrakt: każdy ADR z rejestru istnieje na dysku i każdy plik ADR jest w rejestrze', () => {
  const rejestr = czytaj('docs/decisions/README.md');
  // Link rejestru może prowadzić do podkatalogu `archive/` — tam lądują ADR-y
  // wycofane w całości (LESSONS L62, AGENTS.md §0). Wiersz w tabeli zostaje.
  const linki = [...rejestr.matchAll(/\(((?:archive\/)?\d{4}-[a-z0-9-]+\.md)\)/g)].map((m) => m[1]);
  assert.ok(linki.length >= 13, `rejestr wymienia ${linki.length} ADR-ów`);
  for (const plik of linki) {
    assert.ok(existsSync(join(ROOT, 'docs/decisions', plik)), `rejestr linkuje ${plik}, którego nie ma`);
  }
  const adry = (katalog, przedrostek = '') => readdirSync(join(ROOT, 'docs/decisions', katalog))
    .filter((f) => /^\d{4}-.*\.md$/.test(f))
    .map((f) => `${przedrostek}${f}`);
  const naDysku = [...adry('.'), ...adry('archive', 'archive/')];
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

test('kontrakt: ekran prywatności NIE wymienia Nominatim — warstwa zapasowa usunięta (właściciel, 2026-09-11)', () => {
  const html = czytaj('index.html');
  assert.ok(!html.includes('id="geokodacja-zapasowa"'), 'przełącznik zgody na Nominatim usunięty z ekranu');
  assert.ok(!/Nominatim/.test(html), 'dostawca zapasowy zniknął z opisów (nie ma już czego ujawniać)');
  const karta = html.split('Co jest pobierane i od kogo')[1].slice(0, 3000);
  assert.match(karta, /Overpass/, 'jedyne źródło nazw miejsc nazwane jawnie');
  assert.match(karta, /domyślnie\s+OpenStreetMap/, 'kafelki: opis przycięty do domyślnego dostawcy');
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
    'gra-dystans-odcinka',
    'gra-pytanie-naglowek', 'gra-pytanie-tresc', 'gra-odpowiedzi',
    'gra-pytanie-detale', 'gra-pytanie-detale-naglowek', 'gra-odpowiedzi-lista',
    'gra-wynik-odpowiedzi', 'gra-odpowiedz-ocena', 'gra-wyjasnienie', 'gra-zrodla', 'przycisk-nastepna-stacja',
    'gra-wyniki', 'gra-wyniki-tbody', 'gra-wynik-zwyciezca', 'przycisk-nowa-gra',
    'ekran-koniec-gry', 'tytul-koniec-gry', 'koniec-gry-potwierdzenie',
    'przycisk-koniec-gry', 'przycisk-zamknij-koniec-gry',
  ];
  for (const id of wymagane) assert.ok(html.includes(`id="${id}"`), `brak elementu #${id}`);
  // ADR 0038 (zgłoszenie właściciela 2026-09-12, D b): ekran wyniku jest MINIMALNY.
  // Ta lista to żelazny kontrakt — elementy usunięte z HTML-a nie mogą wrócić
  // bokiem, bo każdy z nich ciągnął za sobą kod, który właściciel kazał wyrzucić.
  const usuniete = [
    'gra-wynik-statystyki', 'gra-wynik-szczegoly', 'gra-wynik-gracze',
    'gra-wynik-stacje', 'gra-wynik-stacje-tbody',
    'wynik-eksport', 'przycisk-udostepnij-wynik', 'przycisk-kopiuj-wynik', 'przycisk-pobierz-wynik',
    'przycisk-pobierz-obraz', 'przycisk-udostepnij-obraz',
    'gra-wynik-tekst-detale', 'pole-wynik-tekst', 'gra-wynik-factcheck',
    // ADR 0043 (uwaga H1): koniec gry nie jest już węzłem w panelu gry.
    'przycisk-zakoncz-gre', 'przycisk-zakoncz-gre-slot', 'informacje-gra',
  ];
  for (const id of usuniete) assert.ok(!html.includes(`id="${id}"`), `ekran wyniku nie ma już #${id} (ADR 0038)`);
  assert.match(html, /id="bledy-gra" class="bledy" role="alert"/, 'błędy faz mają role="alert" (jak inne ekrany)');
  assert.match(html, /id="gra-komunikat" class="podpowiedz" role="status"/, 'komunikat fazy ma role="status"');
  assert.ok(!html.includes('id="przycisk-pomin-stacje"'), 'przycisk pomijania usunięty z HTML-a (zadanie H)');
  assert.ok(!html.includes('id="przycisk-start-gry"'), 'ręcznego startu nie ma — gra rusza sama po Sprawdź (decyzja 2026-09-07)');
});

test('kontrakt: pasek kroków ma 6 kroków, przyciski ekranu gry mają type=button', () => {
  const html = czytaj('index.html');
  const kroki = html.split('<nav id="kroki"')[1].split('</nav>')[0];
  assert.equal((kroki.match(/<li data-krok=/g) ?? []).length, 6, 'setup, pozycja, stacje, prompt, paczka, gra');
  assert.match(kroki, /data-krok="gra">6 · gra</, 'szósty krok na końcu');
  const ekran = html.split('<section id="ekran-gra"')[1].split('</section>')[0];
  const przyciski = ekran.match(/<button[^>]*>/g) ?? [];
  // ADR 0043 zabrał „■ Zakończ grę", ADR 0044 „⏹ Zakończ grę (host)" i
  // „🏳 Rezygnuję z gry" — próg idzie w dół razem z nimi (L55: pin „element
  // usunięty" przepisujemy na NOWĄ formę, nie trzymamy starej liczby).
  assert.ok(przyciski.length >= 6, `przycisków na ekranie gry: ${przyciski.length}`);
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

test('kontrakt: lokalnej historii gier NIE MA (zgłoszenie terenowe O, 2026-09-13; ADR 0010 aneks)', () => {
  // Właściciel: jedyną drogą powrotu do przerwanej gry jest automatyczne
  // wczytanie zapisu (ADR 0045), a wyniki między grami żyją na wspólnym Drive
  // (ADR 0026 aneks) i stamtąd bierze je ranking (ADR 0039). Karta „Poprzednie
  // gry" na setupie obiecywała drugą drogę — dlatego zniknęła razem z kluczem
  // `okolica:historia`, pomocnikami w `trwalosc.js` i kodami H01–H04.
  for (const id of ['karta-historia', 'historia-detale', 'historia-naglowek', 'historia-usterki', 'historia-lista', 'przycisk-kasuj-historie']) {
    assert.equal(INDEX.includes(`id="${id}"`), false, `index.html nie ma elementu #${id}`);
    assert.equal(APP.includes(`$('${id}')`), false, `app.js nie dotyka #${id}`);
  }
  for (const fn of ['function zapiszGreDoHistorii', 'function renderujHistorieGier', 'function kasujHistorieGry']) {
    assert.equal(APP.includes(fn), false, `${fn.replace('function ', '')}() usunięta — został nagrobek`);
  }
  assert.equal(STYLE.includes('.lista-historii'), false, 'klasa CSS po karcie przemianowana na .lista-prosta');
  const trwalosc = czytaj('app/trwalosc.js');
  for (const symbol of ['KLUCZ_HISTORII', 'SCHEMAT_HISTORII', 'SCHEMAT_WPISU_HISTORII', 'LIMIT_HISTORII', 'skrotGry', 'dodajWpisHistorii', 'nowaHistoria', 'walidujHistorieSurowa', 'H01', 'H04']) {
    assert.equal(trwalosc.includes(symbol), false, `trwalosc.js nie ma ${symbol}`);
  }
  assert.match(APP, /if \(r\.faza === FAZY\.koniec \|\| STAN\.graZakonczonaRecznie\) \{\n {6}void wyslijWynikHotseat\(\);/,
    'koniec gry wysyła wynik na wspólny Drive — bez pośrednictwa lokalnej historii');
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
  assert.match(INDEX, /ruszasz\s+dalej\./, 'zasada: „ruszasz dalej." (HTML zawija wiersz — zgłoszenie E)');
  assert.match(INDEX, /Grać można w pojedynkę, w kilka osób na jednym telefonie albo każdy na swoim urządzeniu\./, 'zdanie o składzie gry (brzmienie z zgłoszenia E, 2026-09-12: „w kilka osób”)');
  // Zgłoszenie E (2026-09-12): intro musi się zmieścić na iPhonie, więc stary,
  // dłuższy opis okolicy („w promieniu spaceru od Twojej pozycji”) zniknął.
  assert.equal(INDEX.includes('w promieniu spaceru'), false, 'stary, dłuższy opis okolicy usunięty z intro (zgłoszenie E)');
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
  assert.ok(INDEX.includes('id="most-stan-repo"'), 'stan mostu jest jawny w #most-stan-repo (LESSONS L6)');
  // m12-75: ekran multi to samo lobby (właściciel, 2026-09-11) — status mostu
  // pokazujemy na setupie przy zakładaniu; osobny badge zniknął razem z panelem.
  assert.ok(!INDEX.includes('id="multi-most-stan"'), '#multi-most-stan usunięty razem z dev-tekstem (m12-75)');
  // Partia 3, pkt 1: akapit o pochodzeniu adresu żyje tylko w trybie testowym
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
  for (const a of ['gra-zaloz', 'gra-dolacz', 'gra-opusc', 'gra-start', 'gra-zdarzenie', 'gra-zakoncz', 'gra-hotseat', 'profil-ustaw', 'profil-sprawdz']) {
    assert.ok(GS.includes(`case '${a}'`), `doPost mostu obsługuje ${a}`);
  }
  for (const a of ['gry', 'gra-stan', 'ranking']) {
    assert.ok(GS.includes(`akcja === '${a}'`), `doGet mostu obsługuje ${a}`);
  }
  for (const s of ['RO-gra/1', 'RO-zdarzenie/1', 'RO-lobby/1', 'RO-profil/1']) {
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
  assert.match(INDEX, /Wspólny Drive: historia gier/, 'sekcja prywatność opisuje zapis wyniku na Drive');
  assert.equal(INDEX.includes('liczone są rankingi'), false, 'karta prywatności nie obiecuje rankingów (usunięte 2026-09-11)');
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
  // Wyjście z lobby jest jawne po stronie mostu (właściciel 2026-09-11:
  // „dołączanie i wychodzenie w dowolnym momencie"). Bez tego wychodzący
  // zostawał w `liczbaGraczy` i lobby obiecywało gracza, którego już nie było.
  assert.ok(APP.includes("akcja: 'gra-opusc'"), 'app.js zgłasza mostowi wyjście z lobby');
  assert.ok(GS.includes("case 'gra-opusc'"), 'most przyjmuje gra-opusc');
  assert.match(GS, /gra\.stan !== 'lobby'[\s\S]{0,200}rezygnacja/, 'po starcie wyjście z lobby jest odmówione');
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

test('kontrakt M11+m12-74: UI gry wieloosobowej — segmenty na setupie, bez kodów i źródeł', () => {
  // ekrany i panele (ADR 0019; m12-74: przepisany flow właściciela)
  for (const id of [
    'ekran-multi', 'karta-multi', 'multi-panel-dolacz', 'multi-panel-lobby',
    // ADR 0044 (uwaga F): po starcie gra wygląda jak hotseat, a start odlicza
    // 2026-09-14 F: wybór stacji usunięty — wyścig wykrywa dotarcie do dowolnej
    'odliczanie', 'odliczanie-cyfra',
    // segmenty na setupie: rodzaj gry, ścieżka multi, tryb + trasa-sekret
    'lista-rodzajow', 'rodzaj-opis', 'multi-sciezka', 'multi-sciezka-opis',
    'pole-multi-tryb', 'multi-tryby', 'multi-tryb-opis', 'pole-trasa-sekret', 'multi-trasa-sekret', 'multi-punktacja',
  ]) {
    assert.ok(INDEX.includes(`id="${id}"`), `index.html ma element #${id}`);
  }
  // usunięte w m12-74 (decyzje właściciela 2026-09-11): panel zakładania na
  // ekranie multi, dołączanie kodem, pole pseudonimu, źródła paczek, kod w lobby
  for (const id of ['multi-panel-zaloz', 'multi-kod', 'przycisk-dolacz-kod', 'multi-pseudonim', 'multi-zrodlo', 'przycisk-zaloz-gre', 'przycisk-multi-zaloz', 'przycisk-multi-dolacz', 'lobby-kod', 'setup-rodzaj', 'setup-jezyk', 'setup-podklad', 'multi-most-stan', 'przycisk-multi-wstecz-dolacz']) {
    assert.ok(!INDEX.includes(`id="${id}"`), `#${id} zniknął z index.html (m12-74)`);
  }
  // ADR 0044 (uwaga F, 2026-09-13): „potworek" — karta doklejona do gry po
  // starcie. Po starcie gra wieloosobowa wygląda DOKŁADNIE jak hotseat.
  for (const id of ['gra-panel-multi', 'gra-multi-tura', 'multi-factcheck', 'gra-multi-tabela',
    'gra-multi-wiersze', 'multi-info', 'multi-info-lista', 'gra-multi-sync',
    'przycisk-multi-zakoncz', 'przycisk-multi-rezygnuj']) {
    assert.ok(!INDEX.includes(`id="${id}"`), `#${id} zniknął z index.html (ADR 0044)`);
    assert.ok(!new RegExp(`\\$\\('${id}'\\)`).test(APP), `app.js nie sięga po #${id} (ADR 0044)`);
  }
  for (const nazwa of ['renderujPanelMulti', 'renderujInfoMulti', 'multiRezygnacjaUzbrojona']) {
    assert.ok(!new RegExp(`function ${nazwa}\\s*\\(|STAN\\.${nazwa}`).test(APP),
      `${nazwa} usunięta z app.js (ADR 0044)`);
  }
  // Etykiet („⏹ Zakończ grę (host)", „🏳 Rezygnuję z gry", „Info z gry") NIE
  // asertujemy po tekście: nagrobki w komentarzach celowo je nazywają (LESSONS
  // L31 — usunięcie i grep w tym samym commitcie). Pilnują ich piny id-ów wyżej.
  // Zgody na wysyłkę NIE pytamy przy każdej grze (właściciel, 2026-09-07):
  // gra na wielu telefonach z natury działa przez Drive, a opis jest w sekcji
  // prywatność — tak samo jak przy wyniku hot-seat.
  assert.ok(!INDEX.includes('id="multi-zgoda"'), 'checkboxa zgody multi nie ma');
  assert.ok(!APP.includes('multi-zgoda'), 'kod nie czyta już pola zgody multi');
  assert.ok(!APP.includes('okolica:multi:zgoda'), 'klucz zgody multi zniknął');
  assert.match(INDEX, /Gra na wielu telefonach/, 'sekcja prywatność opisuje grę wieloosobową');
  // tożsamość = imię+PIN z bloku „Kto gra?” (właściciel, 2026-09-11, odpowiedź 1A)
  assert.match(APP, /Wpisz swoje imię i PIN w bloku/, 'bez potwierdzonego imienia jawna odmowa');
  assert.match(APP, /pseudonimGraczaMulti/, 'tożsamość multi to imię z setupu, nie osobne pole');
  // akcje mostu wołane z aplikacji istnieją w .gs (jedna lista prawdy);
  // gra-zdarzenie wysyła warstwa synchronizacji (app/sync.js), nie app.js wprost
  const SYNC = czytaj('app/sync.js');
  for (const akcja of ['gra-zaloz', 'gra-dolacz', 'gra-start', 'gra-zakoncz']) {
    assert.ok(APP.includes(akcja), `app.js woła akcję ${akcja}`);
  }
  assert.ok(SYNC.includes('gra-zdarzenie'), 'sync.js wysyła zdarzenia akcją gra-zdarzenie');
  // tryby (właściciel, 2026-09-11): Wspólna Trasa i Wyścig na Orientację,
  // punktacja wspólna — zdanie o niej raz, w index.html (bez dublowania)
  assert.match(APP, /Wspólna Trasa/, 'UI nazywa tryb Wspólna Trasa');
  assert.match(APP, /Wyścig na Orientację/, 'UI nazywa tryb Wyścig na Orientację');
  assert.match(INDEX, /Punktacja w obu trybach/, 'wspólne zdanie o punktacji w index.html');
  // Premia za kolejność (ADR 0027 aneks 2026-09-13, uwaga L): pula zależy od
  // liczby grających, którzy dograli — zdanie w UI musi to mówić wprost.
  assert.match(INDEX, /Premia za zaliczenie wszystkich stacji zależy od liczby grających/, 'zdanie o punktacji mówi o zależności premii od liczby grających');
  assert.match(INDEX, /przy 4 i więcej — 3, 2, 1, 0/, 'zdanie podaje sufit 3/2/1/0 dla 4 i więcej grających');
  assert.match(INDEX, /którzy odłączyli się wcześniej, nie liczą się do premii/, 'zdanie mówi, że odłączeni nie wchodzą do puli');
  assert.ok(!INDEX.includes('Na serwer jadą wyłącznie pseudonimy'), 'zdanie o tym, co jedzie na serwer, usunięte (właściciel, 2026-09-11)');
  // m12-74: po wklejeniu paczki otwiera się LOBBY (nie panel „Załóż grę”)
  assert.match(APP, /multiPoPaczce/, 'fork multi po paczce: lobby, nie gra hot-seat');
  assert.ok(!APP.includes('sciezkaAiMulti'), 'ścieżka AI jako osobny panel zniknęła — to zwykły setup');
  assert.ok(!APP.includes('odswiezZrodlaMulti') && !APP.includes('zaladujZrodloMulti'), 'lista źródeł paczek multi usunięta');
  assert.ok(!APP.includes('normalizujKod($'), 'dołączanie kodem usunięte (odpowiedź 4A)');
  assert.ok(!APP.includes('biezacyGraczTury'), 'kolejki tur nie ma w aplikacji (tryb usunięty)');
  assert.ok(!APP.includes('przycisk-pomin-stacje'), 'aplikacja nie zna przycisku pomijania (zadanie H — usunięty z UI i z multi)');
  // ~50 m po geohash8 hosta (właściciel, 2026-09-11)
  assert.match(APP, /geohash8/, 'gra niesie geohash8 (zasięg ~50 m)');
  assert.match(GS, /geohash8/, 'most zna geohash8');
  // m12-75 (właściciel, uwagi terenowe #3, 2026-09-11):
  // opisy segmentów bez „developerskiego bełkotu”
  assert.match(APP, /📱 Multiplayer — każdy ma telefon/, 'etykieta rodzaju multi');
  assert.match(APP, /Każdy gracz ma swój telefon\. Możesz być hostem albo dołączyć do istniejącej gry\./, 'opis rodzaju multi');
  assert.match(APP, /Jesteś hostem nowej rozgrywki\. Zaloguj się, wybierz odpowiednie opcje i przejdź dalej\./, 'opis ścieżki „Zakładam” mówi, że zaczyna się od logowania (właściciel 2026-09-12)');
  assert.match(APP, /Dołączam do istniejącej/, 'etykieta ścieżki „Dołączam” (bez przepisu na kod — kody usunięte w m12-74)');
  assert.match(APP, /Wszyscy pokonują tą samą trasę, każdy na swoim telefonie i we własnym tempie\. Stacje przechodzi się po kolei\./, 'opis Wspólnej Trasy');
  // Układ setupu multi (właściciel, 2026-09-12):
  //  1. „Co robisz?” + opis ścieżki,
  //  2. „Ty w tej grze” ZARAZ POD opisem (slot w karcie multi),
  //  3. lista gier ~50 m jako OSOBNY BOKS i dopiero po zalogowaniu.
  const kartaMulti = INDEX.split('id="karta-multi"')[1].split('id="multi-panel-dolacz"')[0];
  assert.match(kartaMulti, /id="multi-slot-tozsamosc"/, 'slot na „Ty w tej grze” w karcie multi, pod opisem ścieżki');
  assert.ok(kartaMulti.indexOf('multi-sciezka-opis') < kartaMulti.indexOf('multi-slot-tozsamosc'),
    'slot tożsamości jest PO opisie ścieżki, nie przed');
  // Slot jest OSTATNIM elementem karty, a `</div>` po nim ją domyka — czyli boks
  // listy zaczyna się już poza kartą (osobny boks, właściciel 2026-09-12).
  assert.match(kartaMulti, /id="multi-slot-tozsamosc"><\/div>\s*<\/div>/,
    'karta multi domyka się zaraz za slotem — boks z listą gier zaczyna się już poza nią');
  assert.match(INDEX, /<div id="multi-panel-dolacz" class="karta" hidden>/, 'lista gier to osobny boks (class="karta")');
  assert.equal(INDEX.includes('Pokazujemy tylko hosta'), false, 'zdanie „Pokazujemy tylko hosta…” usunięte');
  assert.match(INDEX, /id="slot-tozsamosc-dom"/, 'pole tożsamości ma dokąd wrócić poza multi');
  assert.match(APP, /function umiescTozsamosc/, 'przenoszenie bloku tożsamości jest funkcją');
  const panelDolacz = APP.slice(APP.indexOf('function renderujPanelDolacz'), APP.indexOf('function renderujMultiSciezka'));
  assert.match(panelDolacz, /pseudonimGraczaMulti/, 'boks listy widoczny dopiero po zalogowaniu (bramką jest potwierdzone imię)');
  assert.match(panelDolacz, /multi-panel-dolacz'\)\.hidden = !\(dolacz &&/, 'widoczność = ścieżka „Dołączam” ORAZ zalogowany gracz');
  assert.match(INDEX, /id="multi-lobby-lista"/, 'lista gier ~50 m na setupie');
  assert.match(INDEX, /id="przycisk-odswiez-lobby"/, 'przycisk odświeżenia listy na setupie');
  assert.match(APP, /odswiezListeGierNaSetupie/, 'lista odświeżana na setupie');
  assert.ok(!APP.includes('otworzListeGier'), 'dawny flow „lista gier na ekranie multi” usunięty');
  // przy „Dołączam” chowane są pola parametrów gry, a „Poprzednie gry” nie pokazują się w multi
  assert.match(APP, /renderujPolaTozsamosci/, 'widoczność pól tożsamości sterowana funkcją (multi = sama karta gracza)');
  for (const id of ['pole-tryb', 'pole-parametry', 'pole-wiek', 'pole-tematy', 'pole-tozsamosc-siatka']) {
    assert.ok(INDEX.includes(`id="${id}"`), `#${id} ma id do chowania przy „Dołączam”`);
  }
  // „Ty w tej grze” w multi: dokładnie jedna osoba na telefon, pola znikają
  assert.match(APP, /W multiplayerze gra z tego telefonu tylko jedna osoba/, 'twardy limit multi = 1 osoba na telefon');
  // trasa-sekret: checkbox w JEDNYM wierszu z opisem (CSS flex)
  assert.match(STYLE, /#pole-trasa-sekret:not\(\[hidden\]\)\s*\{\s*display: flex;/, 'wiersz trasa-sekret: opis i checkbox obok siebie');
  // tematy: kanon z markerem — „Ciekawostki” i kolejne nowe tematy nie zgubią się w zapisach
  const KONFIG_JS = czytaj('app/konfig.js');
  assert.match(KONFIG_JS, /export const KANON_SETUPU = '\d{4}-\d{2}-\d{2}'/, 'marker kanonu tematów w konfig.js');
  assert.match(KONFIG_JS, /TEMATY_DOPELNIANE_PRZY_MIGRACJI = \['ciekawostki'\]/, 'ciekawostki na liście dopełnień migracyjnych');
  assert.match(KONFIG_JS, /export function dopelnijNoweTematySetupu/, 'jednorazowa migracja tematów setupu');
  assert.match(APP, /kanon: KANON_SETUPU/, 'zapis konfigu niesie marker kanonu');
  // m12-84 (audyt PR #13 pkt 3): dopełnienia są PER-WERSJA, a odczyt PORÓWNUJE
  // marker z bieżącym kanonem (`if (!kanon)` przepuszczał zapisy ze starym markerem).
  assert.match(KONFIG_JS, /export const ZMIANY_KANONU_SETUPU = Object\.freeze\(\{/, 'dziennik zmian kanonu (wersja → nowe tematy domyślne)');
  assert.match(KONFIG_JS, /export function tematyDopelnianeOdKanou/, 'dopełnienia liczone od wersji markera');
  assert.match(APP, /dopelnijKonfiguracjeDoKanou\(STAN\.konfig, kanon\)/, 'odczyt porównuje wartość markera, nie tylko jego obecność');
  // pozostałości trybu developerskiego i warstwy zapasowej nie wracają do treści startowych
  assert.ok(!APP.includes('M0 — fundament'), 'dev-status informacji startowej usunięty');
  // Zgłoszenie właściciela E (2026-09-12): akapit przepisany („sam rozpoznaje,
  // gdy jesteś na miejscu — wtedy odsłania pytanie” → „rozpoznaje, gdy jesteś
  // na miejscu i odsłania pytanie”). Regex toleruje zawinięcie wiersza w HTML.
  assert.match(INDEX, /Przemieszczasz się od stacji do stacji, a telefon rozpoznaje, gdy jesteś\s+na miejscu i odsłania pytanie\./, 'intro: brzmienie właściciela (HTML zawija wiersze)');
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
  // Uwaga właściciela z testów (2026-09-13, A; ADR 0036 aneks): pytanie i
  // warianty siedzą w <details>, a łapki zostają NA WIERZCHU — tuż przed wynikiem
  // odpowiedzi. Stary pin („panel przed odpowiedziami”) przepisał się na nową
  // kolejność (LESSONS L55), bo odpowiedzi zjechały do zwijanego elementu.
  const detale = INDEX.indexOf('id="gra-pytanie-detale"');
  const odpowiedzi = INDEX.indexOf('id="gra-odpowiedzi"');
  const listaWariantow = INDEX.indexOf('id="gra-odpowiedzi-lista"');
  const oceny = INDEX.indexOf('id="gra-oceny"');
  const wynik = INDEX.indexOf('id="gra-wynik-odpowiedzi"');
  for (const para of [['details pytania', detale], ['odpowiedzi', odpowiedzi], ['listy wariantów', listaWariantow], ['panelu łapek', oceny], ['wyniku odpowiedzi', wynik]]) {
    assert.ok(para[1] >= 0, `w index.html nie ma: ${para[0]}`);
  }
  assert.ok(detale < odpowiedzi && odpowiedzi < listaWariantow, 'pytanie, warianty-klikalne i warianty-statyczne są WEWNĄTRZ <details>, w tej kolejności');
  assert.ok(listaWariantow < oceny && oceny < wynik, 'łapki zostają na wierzchu: po <details>, przed wynikiem odpowiedzi');
  assert.match(INDEX, /<details id="gra-pytanie-detale" open>/, 'element w fazie odpowiedzi startuje OTWARTY (gracz musi widzieć pytanie)');
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
  assert.match(GS, /return nazwa === FOLDERY\.zaakceptowane;/,
    'most przyjmuje głosy dla paczek w zaakceptowanych (od 2026-09-11 bez katalogu przeglądu)');
  assert.match(GS, /status: 'zaakceptowana', nazwa, id: utworzony\.getId\(\)/,
    'most oddaje id przyjętej paczki — bez niego telefon nie wie, co ocenia');
});

/**
 * Decyzja właściciela 2026-09-11 (po fixie linku przeglądu z tego samego dnia):
 * „W ogóle rezygnujemy z akceptowania paczek. Paczki od razu trafiają do
 * zaakceptowane. O ich jakości decydują łapki w górę i w dół, nie jest
 * potrzebna ta sesja sprawdzania właścicielskiego — to nic nie wnosi a tylko
 * zajmuje czas. Usuwamy całą procedurę akceptacji. Usuwamy maile do
 * właściciela o nowych paczkach."
 */
test('kontrakt decyzji 2026-09-11: akceptacja paczek zniknęła z mostu, paczki żyją od razu', () => {
  assert.equal(GS.includes('MailApp'), false, 'most nie wysyła maili o paczkach');
  assert.equal(GS.includes('stronaPrzegladu'), false, 'strona przeglądu zniknęła');
  assert.equal(GS.includes('zatwierdz'), false, 'akcja zatwierdzania zniknęła');
  assert.equal(GS.includes("przeglad: 'okolica-paczki-do-przegladu'"), false, 'katalog przeglądu zniknął z FOLDERY');
  assert.equal(GS.includes('REVIEW_SECRET'), false, 'token przeglądu nie jest już potrzebny');
  assert.equal(GS.includes('URL_SERWISU'), false, 'właściwość URL_SERWISU nie jest już potrzebna (link przeglądu zniknął)');
  assert.match(GS, /folder\(FOLDERY\.zaakceptowane\)\.createFile/, 'paczka zapisuje się OD RAZU w zaakceptowanych');
  // Aplikacja mówi prawdę o tym, co się stało z paczką.
  assert.ok(APP.includes("wynik.status === 'zaakceptowana'"), 'aplikacja rozpoznaje status bezpośredniej akceptacji');
  assert.ok(APP.includes('dostępna od razu w zestawach — jakość rozstrzygną łapki graczy'),
    'status mówi o łapkach, nie o przeglądzie właściciela');
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
  // Zgłoszenie właściciela E (2026-09-12): „treść nie mieści się na layerze na
  // iPhonie” — tytuł jest o trochę mniejszy niż w uwadze A1 (był 28/8vw/40).
  assert.match(STYLE, /\.warstwa-start h1 \{[^}]*font-size: clamp\(25px, 7vw, 36px\)/s, 'tytuł skaluje się z ekranem (mniejszy — zgłoszenie E)');
  assert.match(STYLE, /\.warstwa-start h1 \{[^}]*text-align: center/s, 'tytuł jest wyśrodkowany');
  assert.match(STYLE, /\.podtytul-start \{[^}]*text-align: center/s, 'podtytuł też');
  // Intro ma być dłuższe niż jedno zdanie — pinujemy liczbę akapitów, nie treść.
  // Uwagi terenowe #2 (2026-09-11): akapit o zgodzie na lokalizację skrócony
  // do wzmianki w podtytule („gdziekolwiek jesteś") — nie asertujemy go tu.
  const intro = INDEX.slice(INDEX.indexOf('warstwa-start-karta'), INDEX.indexOf('przycisk-start-zacznij'));
  assert.ok((intro.match(/<p[ >]/g) ?? []).length >= 4, 'intro ma co najmniej cztery akapity');
});

test('zgłoszenie E: warstwa startowa dostaje o wiersz więcej (po pół wiersza w górę i w dół)', () => {
  // „można rozpocząć go o pół wiersza wyżej i skończyć o pół wiersza niżej
  // (licząc czcionką, którą jest tekst na tym layerze)” — wiersz to 17 px × 1,45,
  // a panel jest wyśrodkowany, więc wyższa `max-height` przesuwa obie krawędzie
  // symetrycznie. Test pinuje SPOSÓB (zmienna + dodanie jej do max-height),
  // nie konkretną liczbę pikseli.
  assert.match(STYLE, /--wiersz-warstwy: 25px/, 'wiersz warstwy jako zmienna (17 px × 1,45)');
  assert.match(STYLE, /\.panel-centralny:not\(\[hidden\]\) \{[^}]*max-height: calc\([^}]*\+ var\(--wiersz-warstwy/s,
    'warstwa liczy wysokość z wierszem warstwy (zgłoszenie E)');
});

test('ADR 0034: wspólny panel mieści się pod mierzoną belką i przewija samodzielnie', () => {
  assert.match(STYLE, /\.panel-centralny:not\(\[hidden\]\) \{[^}]*var\(--wysokosc-belki/s);
  assert.match(STYLE, /\.panel-centralny:not\(\[hidden\]\) \{[^}]*overflow-y: auto/s);
  assert.ok(APP.includes('function ustawWysokoscBelki'));
  for (const ekran of ['setup', 'pozycja', 'stacje', 'prompt', 'paczka', 'gra', 'informacje', 'koniec-gry']) {
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

test('kontrakt: Informacje niosą kontakt i zgłaszanie błędów mapy (polityka kafelków OSM)', () => {
  // Polityka kafelków OSM zaleca dwie rzeczy, których nam brakowało:
  // link „Report a map issue" i opublikowany adres kontaktowy. Bez adresu OSM
  // nie ma jak uprzedzić o blokadzie — a blokuje „bez uprzedzenia".
  const blok = INDEX.slice(INDEX.indexOf('id="ekran-informacje"'), INDEX.indexOf('id="przygaszenie-mapy"'));
  assert.ok(blok.includes('id="ekran-informacje"'), 'znaleziono ekran Informacje');

  const zglos = blok.match(/<a[^>]*id="link-zglos-mape"[^>]*>/)?.[0];
  assert.ok(zglos, 'link „Zgłoś błąd na mapie" jest w Informacjach');
  assert.match(zglos, /href="https:\/\/www\.openstreetmap\.org\/fixthemap"/,
    'prowadzi do oficjalnego formularza OSM');
  assert.match(zglos, /rel="[^"]*noopener/, 'target=_blank z noopener');

  const kontakt = blok.match(/<a[^>]*id="link-kontakt"[^>]*>/)?.[0];
  assert.ok(kontakt, 'link kontaktowy jest w Informacjach');
  assert.match(kontakt, /href="mailto:szybkoiwyraznie@gmail\.com"/, 'adres kontaktowy podany');
  assert.match(blok, /szybkoiwyraznie@gmail\.com/, 'adres widoczny jako tekst, nie tylko w href');

  // Kontrast: link dziedziczy kolor, więc nie wprowadza nowej pary do audytu
  // WCAG; od tła odróżnia go podkreślenie, nie barwa.
  assert.match(STYLE, /\.informacje-link \{[^}]*color: inherit/s, 'link dziedziczy kolor');
  assert.match(STYLE, /\.informacje-link \{[^}]*text-decoration: underline/s, 'odróżniony podkreśleniem');
  assert.match(STYLE, /\.informacje-link \{[^}]*min-height: var\(--cel\)/s, 'cel dotykowy ≥ 44 px');
  assert.match(STYLE, /\.informacje-link \{[^}]*overflow-wrap: anywhere/s, 'długi adres nie rozepcha panelu 360 px');
});

test('kontrakt: szablon kafelków da się podmienić bez wdrażania wersji', () => {
  // Zalecenie polityki OSM: „avoid hard-coding the tile URL; allow switching
  // without needing a software update". Serwer kafelków jest wolontariacki
  // i bez SLA — przełącznik musi istnieć w terenie.
  assert.match(MAPA, /export const KLUCZ_URL_KAFELKOW = 'okolica:kafelki:url';/,
    'klucz operatorski wyeksportowany z mapa.js');
  assert.match(MAPA, /export function walidujSzablonKafelkow\(/, 'walidacja szablonu wyeksportowana');
  assert.match(MAPA, /export function ustawSzablonKafelkow\(/, 'setter wyeksportowany');
  // Walidacja musi wymagać https i wszystkich trzech podstawień — inaczej
  // błędna wartość dałaby jeden adres dla całej siatki.
  const walidacja = MAPA.slice(MAPA.indexOf('export function walidujSzablonKafelkow'),
    MAPA.indexOf('export function ustawSzablonKafelkow'));
  assert.match(walidacja, /url\.protocol !== 'https:'/, 'tylko https');
  for (const z of ['{z}', '{x}', '{y}']) {
    assert.ok(walidacja.includes(z), `walidacja wymaga ${z}`);
  }
  // Nadpisanie dotyczy wyłącznie OSM — pozostali dostawcy mają własne licencje.
  assert.match(MAPA, /podklad === 'osm' && nadpisanySzablonOsm/, 'nadpisanie tylko dla osm');
  // Odczyt localStorage siedzi w app.js, nie w czystym module mapy.
  assert.match(APP, /function wczytajNadpisanieKafelkow\(/, 'odczyt klucza w app.js');
  assert.match(APP, /localStorage\.getItem\(KLUCZ_URL_KAFELKOW\)/, 'czytany z localStorage');
  // Mapa.js ma zostać modułem czystym: sprawdzamy WYWOŁANIE, nie samo słowo —
  // w komentarzach wolno o localStorage pisać (i piszemy, dlaczego go tu nie ma).
  assert.equal(/localStorage\s*[.[]/.test(MAPA), false,
    'mapa.js zostaje czysty — żadnego dostępu do localStorage');
});

test('kontrakt: martwa flaga wymusPierscien usunięta z silnika', () => {
  // Przycisk „Tryb uproszczony" wyleciał w m12-66, a stan został — zawsze
  // `false`, więc `!STAN.wymusPierscien` było wiecznie prawdziwe i tylko
  // udawało gałąź decyzyjną. Przycisk ma NIE wracać (patrz asercja wyżej),
  // więc poprawnym domknięciem było usunięcie stanu, nie dorobienie UI.
  assert.equal(APP.includes('wymusPierscien'), false, 'flaga zniknęła z app.js');
  assert.equal(MAPA.includes('wymusPierscien'), false, 'flagi nie ma też w mapa.js');
});

/**
 * Zgłoszenie właściciela 2026-09-12 („Mam nowy pomysł na podstronę Ranking”):
 * warstwa z DOKŁADNIE dwiema tabelami i niczym więcej. Ten test spina trzy
 * warstwy naraz — HTML (co widzi gracz), aplikację (skąd bierze dane) i most
 * (skąd dane przychodzą) — bo ranking jest pierwszym miejscem, w którym reguła
 * „kto wchodzi do tabeli” mieszka w skrypcie Apps Script, a nie w telefonie.
 */
test('kontrakt ADR 0039: ranking — dwie tabele, akcja mostu i wspólny schemat', async () => {
  const { LIMIT_RANKINGU, MINIMUM_PYTAN_ODPOWIEDZI, SCHEMAT_RANKINGU } = await import('../app/ranking.js');

  // 1. HTML: warstwa i dwie tabele, bez śladu starej formy.
  assert.match(INDEX, /id="przycisk-ranking"[^>]*aria-controls="ekran-ranking"/, 'puchar steruje warstwą rankingu');
  assert.match(INDEX, /id="przycisk-ranking"[^>]*aria-expanded="false"/, 'ikona startuje zgaszona (F3: drugi klik zamyka)');
  for (const id of ['ranking-punkty', 'ranking-punkty-wiersze', 'ranking-mistrzowie', 'ranking-mistrzowie-wiersze', 'ranking-status']) {
    assert.ok(INDEX.includes(`id="${id}"`), `ranking ma #${id}`);
  }
  assert.ok(INDEX.includes('Ranking Punktowy Graczy'), 'pierwsza tabela: Ranking Punktowy Graczy');
  assert.ok(INDEX.includes('Mistrzowie Zagadek'), 'druga tabela: Mistrzowie Zagadek');
  // Uwaga właściciela z testów (2026-09-12, aneks ADR 0039): wiersz wyjaśnień
  // („Graczy z potwierdzonym profilem: N…”, „Mistrzowie Zagadek liczą się od 10
  // zadanych pytań…”) jest NA KOŃCU warstwy, pod obiema tabelami — najpierw
  // dane, potem zdanie o tym, jak je czytać. Element niesie też stany
  // przejściowe i awarie, więc musi zostać w warstwie i zachować role="status".
  const kolejnosc = ['id="ranking-punkty"', 'id="ranking-mistrzowie"', 'id="ranking-status"']
    .map((znacznik) => INDEX.indexOf(znacznik));
  for (const [i, znacznik] of kolejnosc.entries()) {
    assert.ok(kolejnosc[i] >= 0, `w index.html nie ma ${znacznik}`);
  }
  assert.ok(kolejnosc[0] < kolejnosc[1] && kolejnosc[1] < kolejnosc[2],
    'kolejność w warstwie: tabela punktowa → Mistrzowie Zagadek → wiersz wyjaśnień');
  assert.match(INDEX, /<p id="ranking-status" class="podpowiedz" role="status">/,
    'wiersz wyjaśnień zachowuje role="status" (aria-live) po przeprowadzce');
  for (const obcy of ['ranking-zakladki', 'ranking-kategorie', 'ranking-tabela', 'ranking-moje-gry', 'ranking-wiersze']) {
    assert.equal(INDEX.includes(obcy), false, `stara forma rankingu (${obcy}) nie wróciła`);
  }

  // 2. Aplikacja: warstwa i pobranie z mostu tą samą drogą co resztą (ADR 0020).
  assert.match(APP, /urlGet\(url, 'ranking'\)/, 'adres rankingu buduje `urlGet` z sync.js');
  assert.match(APP, /zamknijRankingi/, 'warstwę da się zamknąć (✕/Escape), jak Informacje');
  // 3. Most: akcja i schemat. Reguła „tylko gracze z profilem” MUSI być w skrypcie.
  assert.ok(GS.includes("akcja === 'ranking'"), 'doGet mostu obsługuje akcję ranking');
  assert.ok(GS.includes(SCHEMAT_RANKINGU), `most oddaje schemat ${SCHEMAT_RANKINGU}`);
  assert.match(GS, /function rankingi\(\)/, 'most ma funkcję rankingi()');
  assert.match(GS, /zarejestrowani\[klucz\]/, 'most filtruje ranking po profilach (ADR 0021 + decyzja 2026-09-12)');
  assert.match(GS, /FOLDERY\.gryZakonczone/, 'ranking sumuje gry zakończone — wszystkie rodzaje gier');

  // 4. Liczby z decyzji właściciela są w JEDNYM miejscu: w module.
  assert.equal(LIMIT_RANKINGU, 5, 'max 5 pozycji w każdej tabeli');
  assert.equal(MINIMUM_PYTAN_ODPOWIEDZI, 10, 'Mistrzowie Zagadek liczą się od 10 zadanych pytań');
  assert.equal(APP.includes('MINIMUM_PYTAN_ODPOWIEDZI'), false, 'progu nie ma w app.js — trzyma go app/ranking.js');
  assert.match(APP, /mistrzowieZagadek\(ranking\)/, 'aplikacja używa funkcji modułu, nie własnej kopii reguły');
});

test('I+J: paczki tylko z repo, START GRY gaśnie w trakcie gry', () => {
  // I.b: sekcja „📱 z tego telefonu:” nie istnieje w UI ani w tekstach stanu.
  assert.equal(APP.includes('📱 z tego telefonu'), false, 'etykieta sekcji paczek z telefonu nie wróciła (I.b)');
  assert.equal(czytaj('app/most.js').includes('paczki z tego telefonu'), false, 'stan mostu nie obiecuje paczek z telefonu (I.b)');
  // I.a: opis paczki z repo nie pokazuje licencji.
  assert.equal(APP.includes('${meta.licencja}'), false, 'opis propozycji bez licencji (I.a)');
  // J: belka ikon zna stan gry — przycisk gaśnie, CSS to pokazuje.
  assert.match(APP, /odswiezStanIkonBelki/, 'belka odświeża stan ikon (J)');
  assert.match(STYLE, /\.przycisk-ikona\[disabled\]/, 'zgaszony przycisk ma styl (J)');
});
test('K: teksty UI nie odsyłają do ścieżek, których nie ma (O1/O2/O11)', () => {
  // O1: moderacja wstępna zniesiona 2026-09-11 (ADR 0017 aneks) — przyjęta
  // paczka ląduje OD RAZU w katalogu zaakceptowanych, bez maila i bez strony
  // przeglądu. Tekst ekranu nie może obiecywać procesu, którego nie ma.
  assert.equal(INDEX.includes('do przeglądu właściciela'), false,
    'ekran wklejania nie obiecuje sesji przeglądu (ADR 0017 aneks 2026-09-11)');
  assert.match(INDEX, /od razu do wspólnego repozytorium okolicy/,
    'ekran wklejania mówi, dokąd naprawdę leci paczka');

  // O2: eksportu pliku nie ma w UI — eksport zestawu zniknął 2026-09-07,
  // eksporty wyniku zdjęła decyzja ADR 0038. Komunikat nie może wskazywać
  // wyjścia, którego nie da się wykonać (ADR 0011 pkt 8, LESSONS L6).
  assert.equal(APP.includes('Eksport plikiem'), false,
    'status pełnej pamięci paczek nie odsyła do eksportu plikiem');
  assert.equal(APP.includes('modelu albo pliku'), false,
    'status braku miejsca nie odsyła do wczytania pliku');
  assert.equal(APP.includes('zapisz plik i wnieść go ręcznie'), false,
    'awaria wysyłki na Drive nie obiecuje ręcznego wnoszenia pliku');

  // O11: karta prywatności mówiła w jednym punkcie, że pytania jadą na Drive
  // (repozytorium zestawów), a w sąsiednim — że pytania i paczka zostają
  // na telefonie (zapis gry). Oba fakty są prawdziwe, ale w innych kontekstach:
  // zapis GRY ma `zestaw: null` (PROTOKOL §9.6), a zestaw w repozytorium niesie
  // pytania (ADR 0017 pkt 1). Tekst rozdziela je jawnie.
  assert.equal(INDEX.includes('pytania i paczka <strong>zostają na telefonie</strong>'), false,
    'karta prywatności bez sprzeczności o pytaniach na Drive');
  assert.match(INDEX, /Zapis GRY nie niesie pytań/,
    'karta prywatności rozdziela repozytorium paczek od zapisu gry');
});
test('K: komentarze w kodzie nie obiecują koła dokładności (ADR 0034 pkt 2)', () => {
  // `accuracy` nie bierze udziału w decyzji, komunikatach ani rysunku koła —
  // mapa dostaje `{lat, lon}` bez dokładności, więc komentarz nie może twierdzić
  // czego innego (dryf O12 z audytu PR #18: kod zgodny z ADR, opis nie).
  assert.match(APP, /const fix = p \? \{ lat: p\.lat, lon: p\.lon \} : null;/,
    'warstwy mapy dostają pozycję bez `accuracy`');
  assert.equal(APP.includes('z kołem dokładności'), false, 'komentarz nie obiecuje koła dokładności');
  assert.equal(APP.includes('badge dokładności'), false, 'badge dokładności nie istnieje w UI');
  assert.equal(APP.includes('filtr dokładności'), false, 'ocenFix nie filtruje po dokładności');
  assert.match(APP, /BEZ koła dokładności/, 'komentarz `odswiezWarstwy` mówi wprost, czego na mapie nie ma');
  // Dev-tekst karty paczek nie obiecuje sesji przeglądania paczek.
  assert.equal(INDEX.includes('zaakceptowane przez właściciela'), false,
    'karta paczek: katalog zaakceptowanych, nie przegląd właściciela (ADR 0017 aneks 2026-09-11)');
});

/* --------------------- ADR 0040: gra bez pauzy, zawsze włączona */

test('kontrakt ADR 0040: systemu pauzy nie ma, a powrót z tła wznawia sam (uwaga B, 2026-09-13)', () => {
  const POZYCJA = czytaj('app/pozycja.js');

  // 1. UI: przycisk i komunikat pauzy zniknęły. Slotu zakończenia gry też już
  //     nie ma — grę kończy warstwa za ikoną ⚙ START GRY (ADR 0043, uwaga H1).
  for (const id of ['przycisk-pauza', 'gra-pauza-komunikat']) {
    assert.equal(INDEX.includes(`id="${id}"`), false, `#${id} nie może wrócić do index.html (ADR 0040 pkt 1)`);
  }
  for (const etykieta of ['⏸ Pauza', 'Zegar gry zatrzymany', 'wznowcie, gdy wszyscy gotowi']) {
    assert.equal(INDEX.includes(etykieta), false, `index.html nie może nieść „${etykieta}"`);
    assert.equal(APP.includes(etykieta), false, `app.js nie może wstawiać „${etykieta}"`);
  }
  assert.equal(INDEX.includes('id="przycisk-zakoncz-gre-slot"'), false,
    'slotu zakończenia gry nie ma — grę kończy ikona ⚙ START GRY (ADR 0043)');

  // 2. Silnik: funkcje i stan pauzy wycofane. Asertujemy WYWOŁANIA, nie słowa —
  //    komentarze o wycofaniu zostają w kodzie jako pamięć decyzji (L58).
  for (const wzor of [/function przelaczPauzeGry\s*\(/, /function dostosujProfilGps\s*\(/,
    /STAN\.graPauza/, /STAN\.pauzaWTle/, /STAN\.pauzaSkumulowanaMs/, /STAN\.profilGps/]) {
    assert.equal(wzor.test(APP), false, `app.js nie może mieć ${wzor}`);
  }
  for (const wzor of [/export function profilBaterii/, /export const PROG_BATERII_M/,
    /export function komunikatPauzy/, /export function komunikatWznowienia/, /oszczedny:/]) {
    assert.equal(wzor.test(POZYCJA), false, `pozycja.js nie może mieć ${wzor}`);
  }
  assert.match(POZYCJA, /export const PROFILE_GPS = Object\.freeze\(\{\n {2}dokladny:/,
    'jeden profil watchera: zawsze dokładny (ADR 0040 pkt 2)');
  assert.equal(POZYCJA.includes('P07:'), false, 'kod P07 wycofany — numer nie wraca do puli');
  assert.equal(POZYCJA.includes('P09:'), false, 'kod P09 wycofany — numer nie wraca do puli');

  // 3. Zegar gry płynie cały czas; powrót z tła nie wymaga kliku.
  assert.match(APP, /function zegarGry\(\) \{[\s\S]{0,300}return teraz - \(STAN\.przerwaSkumulowanaMs \+ wTrakciePrzerwy\);/,
    'zegar gry nie zna PAUZ — koryguje go tylko przerwa po 15 min bezczynności (ADR 0040 pkt 1 i 5)');
  assert.match(APP, /const wTrakciePrzerwy = STAN\.przerwaBezczynnosci && STAN\.przerwaStartMs > 0 \? teraz - STAN\.przerwaStartMs : 0;/,
    'korekta zegara to wyłącznie bezczynność, nie pauza gracza');
  // pkt 4: Wake Lock na czas gry (moduł `aktywnosc.js` jest czysty, DOM pilnuje app.js)
  assert.match(APP, /from '\.\/aktywnosc\.js\?v=/, 'app.js bierze decyzje o blokadzie i przerwie z aktywnosc.js');
  assert.match(APP, /import \{ PRZERWA_BEZCZYNNOSCI_MS, SPRAWDZANIE_BEZCZYNNOSCI_MS, czyPrzerwaBezczynnosci, czyTrzymacEkran \}/,
    'import aktywnosc.js ma pełny kształt (ADR 0040 pkt 4–5)');
  assert.match(APP, /navigator\.wakeLock\?\.request/, 'Wake Lock tylko z `navigator.wakeLock` — bez niego cichy no-op');
  assert.match(APP, /await navigator\.wakeLock\.request\('screen'\)/, 'żądanie blokady dotyczy ekranu');
  assert.match(APP, /function odswiezWakeLock\(\) \{[\s\S]{0,300}fazaKoniec: FAZY\.koniec[\s\S]{0,200}\}/,
    'blokada ekranu idzie za fazą gry — po końcu gry ekran może gasnąć');
  assert.match(APP, /odswiezWakeLock\(\); \/\/ ADR 0040 pkt 4/, 'render gry odświeża blokadę ekranu');
  assert.match(APP, /if \(typeof blokada\?\.addEventListener === 'function'\) \{[\s\S]{0,200}'release'/,
    'zwolnienie blokady przez przeglądarkę (zejście w tło) zeruje uchwyt');
  // pkt 5: przerwa po 15 minutach bezczynności, wznawiana dowolnym klikiem
  assert.match(APP, /STAN\.zegarAktywnosci = setInterval\(sprawdzBezczynnosc, SPRAWDZANIE_BEZCZYNNOSCI_MS\);/,
    'watchdog bezczynności tyka co 30 s (progu pilnuje test/aktywnosc.test.js)');
  assert.match(APP, /document\.addEventListener\('click', zaznaczAktywnosc, true\);/,
    'każdy klik znaczy aktywność — także ten, którego nikt nie obsłużył');
  assert.match(APP, /document\.addEventListener\('keydown', zaznaczAktywnosc, true\);/,
    'klawisz też jest akcją gracza');
  assert.match(APP, /function zaznaczAktywnosc\(\) \{\n {2}STAN\.ostatniaAkcjaMs = performance\.now\(\);\n {2}if \(STAN\.przerwaBezczynnosci\) wznowPoBezczynnosci\(\);\n\}/,
    'powrót po przerwie jest samoczynny — bez przycisku i bez pytania');
  assert.match(APP, /function wznowPoBezczynnosci\(\) \{[\s\S]{0,500}STAN\.historiaFixow = \[\];[\s\S]{0,200}wlaczGps\(\);/,
    'po przerwie nasłuch startuje od nowa, a kryterium dojścia liczy się z nowych pomiarów');
  assert.match(APP, /function sprawdzBezczynnosc\(\) \{[\s\S]{0,500}zatrzymajSymulacje\(\);\n {2}zatrzymajGps\(\);/,
    'przerwa po bezczynności zatrzymuje symulację i nasłuch GPS');
  assert.match(APP, /if \(!STAN\.watcher\?\.czyAktywny\(\)\) return; \/\/ nie ma czego zatrzymywać/,
    'watchdog nie rusza przerwy, gdy nasłuch i tak nie działa');
  assert.match(APP, /document\.addEventListener\('visibilitychange'/,
    'app.js nasłuchuje visibilitychange — powrót z tła wznawia sam');
  assert.match(APP, /const czekamyNaFixa = STAN\.ekran === 'pozycja'/,
    'powrót z tła odświeża nasłuch tylko tam, gdzie czekamy na fixa (ADR 0040 pkt 3)');
  assert.match(APP, /if \(!STAN\.watcher\?\.czyAktywny\(\) \|\| !STAN\.ostatniFix\) wlaczGps\(\);/,
    'martwy albo niemy nasłuch jest zakładany od nowa bez kliku (bug G + ADR 0040 pkt 3)');

  // 4. W drodze nad mapą zostaje sam pasek — Informacje nie niosą nic z gry
  //    (ADR 0036 aneks 2026-09-13 zawęził to do węzła zakończenia, a ADR 0043
  //    zabrał i ten węzeł).
  assert.match(APP, /\$\('gra-sterowanie'\)\.hidden = droga && !STAN\.trybTestowy;/,
    'panel gry jest w drodze schowany (nad mapą zostaje pasek), a w trybie testowym zostaje — trzyma symulację dojścia (ADR 0036 aneks m12-102 pkt 2)');
  // Asertujemy REGUŁĘ, nie sam tekst: komentarz w styles.css celowo nazywa
  // selektor, który umarł (L31 — usunięcie i grep w tym samym commitcie).
  assert.equal(/#informacje-gra\s*\{/.test(STYLE), false,
    'reguła `#informacje-gra` umarła razem z węzłem (L31)');
  assert.equal(/#informacje-gra h2\s*\{/.test(STYLE), false,
    'reguła na nagłówek „Gra" w Informacjach umarła z przenoszeniem sterowania (L31)');
});

/* ------- ADR 0044: odliczanie po starcie gry wieloosobowej, potem jak hotseat */

test('kontrakt ADR 0044: start gry wieloosobowej odlicza 5-4-3-2-1-START, a potem gra wygląda jak hotseat', () => {
  // 1. Warstwa odliczania: WIELKA cyfra na środku, tło PRZEZROCZYSTE, bez karty.
  assert.match(INDEX, /<div id="odliczanie" hidden role="status" aria-live="assertive" aria-atomic="true"><span id="odliczanie-cyfra"><\/span><\/div>/,
    'odliczanie jest warstwą statusu (screen reader czyta każdy krok)');
  assert.match(STYLE, /#odliczanie \{[^}]*position: fixed; inset: 0; z-index: 40;[^}]*background: transparent; pointer-events: none;/s,
    'warstwa nad wszystkim, przezroczysta i nie przechwytuje dotyku — mapa zostaje widoczna');
  assert.match(STYLE, /#odliczanie\[hidden\] \{ display: none; \}/,
    'jawne gaszenie `display` — `display: grid` z identyfikatora wygrałby z globalnym [hidden]');
  assert.match(STYLE, /#odliczanie-cyfra \{[^}]*font-size: clamp\(96px, 42vw, 220px\);[^}]*font-variant-numeric: tabular-nums;/s,
    'cyfra jest największym elementem ekranu i nie skacze (ADR 0011)');
  assert.equal(STYLE.includes('#ekran-informacje, #ekran-ranking { z-index: 20; }'), true,
    'warstwy Informacji i rankingu zostają pod odliczaniem (20 < 40)');

  // 2. Kroki i sygnały: każdy krok ma dźwięk i wibrację (ADR 0041), o ile 🔔 gra.
  assert.match(APP, /const ODLICZANIE_KROKI = Object\.freeze\(\[5, 4, 3, 2, 1, 'START'\]\);/,
    'kolejność kroków z decyzji właściciela: 5, 4, 3, 2, 1, START');
  assert.match(APP, /const ODLICZANIE_KROK_MS = 1000;\nconst ODLICZANIE_KROK_TEST_MS = 20;/,
    'krok 1 s w terenie; krótszy w trybie testowym, żeby brama nie czekała minuty');
  assert.match(APP, /for \(const krok of ODLICZANIE_KROKI\) \{\n {6}cyfra\.textContent = String\(krok\);\n {6}odegrajSygnal\(krok === 'START' \? 'startGry' : 'odliczanie'\);/,
    'każdy krok gra sygnał — ostatni inny niż tykanie (plan w app/sygnaly.js)');
  assert.match(APP, /if \(STAN\.odliczanieAktywne\) return; \/\/ jeden start = jedno odliczanie/,
    'odliczanie się nie nakłada (polling może przynieść stan kilka razy)');
  assert.match(APP, /\} finally \{\n {4}warstwa\.hidden = true;\n {4}cyfra\.textContent = '';/,
    'warstwa znika po STARcie także wtedy, gdy krok się wywróci');

  // 3. Odliczają WSZYSTCY — host od swojego kliku, goście od stanu z mostu.
  assert.match(APP, /if \(odliczanie\) void odliczStartGry\(\);/,
    'wejście do gry wieloosobowej uruchamia odliczanie (host i gość tą samą drogą)');
  assert.match(APP, /function uruchomGreMulti\(gra, \{ odliczanie = true \} = \{\}\) \{/,
    'odliczanie jest opcjonalne — powrót do gry go nie chce');
  assert.match(APP, /STAN\.wznawiamMulti = true; \/\/ powrót do gry NIE jest startem — bez odliczania \(ADR 0044\)/,
    '„↩ Wróć do gry" po odświeżeniu telefonu nie odlicza');
  assert.match(APP, /uruchomGreMulti\(gra, \{ odliczanie: !STAN\.wznawiamMulti \}\);/,
    'decyzja o odliczaniu zapada w jednym miejscu (stan z mostu)');

  // 4. Wybór stacji w Wyścigu USUNIĘTY (2026-09-14 F): gracz sam decyduje,
  //    app wykrywa dotarcie do dowolnej niezaliczonej — warstwa #multi-wybor-stacji
  //    nie istnieje, a pasek dolny pokazuje „Jacek. Stacja 3/5".
  assert.ok(!INDEX.includes('id="multi-wybor-stacji"'), 'warstwa wyboru stacji usunięta (F)');
  assert.ok(!INDEX.includes('id="multi-wybor-przyciski"'), 'przyciski wyboru stacji usunięte (F)');
  assert.match(APP, /function renderujWyborStacji\(\) \{\n {2}\/\/ no-op — wybór stacji usunięty/,
    'renderujWyborStacji to no-op po usunięciu warstwy');
  assert.match(APP, /Jacek\. Stacja 3\/5/,
    'pasek dolny w wyścigu: „Jacek. Stacja 3/5" zamiast dystansu (F)');

  // 5. Pasek synchronizacji został TYLKO w lobby.
  assert.match(APP, /\$\('multi-sync-pasek'\)\.textContent = tekst;\n\}/,
    '„Ostatni stan / następne odświeżenie" żyje tylko w lobby — w grze go nie ma');

  // 6. Koniec gry wieloosobowej pokazuje WSPÓLNE liczby na ekranie hotseat.
  assert.match(APP, /const wynik = wynikiMultiKonca\(\) \?\? podsumowanie\(r\);/,
    'ekran wyniku bierze punktację z mostu, gdy gra sieciowa jest zamknięta');
  assert.match(APP, /function wynikiMultiKonca\(\) \{\n {2}const gra = STAN\.multi\?\.gra;\n {2}if \(!gra \|\| \(gra\.stan !== 'zakonczona' && gra\.stan !== 'archiwum'\)\) return null;/,
    'poza zamkniętą grą sieciową wynik liczy się lokalnie (hotseat bez zmian)');
  assert.match(APP, /pokazWyniki\(\);\n {4}renderujGre\(\);/,
    'zamknięcie gry w moście odświeża ekran wyniku ZAWSZE — także u gracza, który skończył wcześniej');
});

/* ------------- ADR 0043: koniec gry za ikoną ⚙ START GRY, z wpisaniem TAK */

test('kontrakt ADR 0043: grę kończy ikona ⚙ START GRY z wpisaniem TAK (uwagi H1 i I)', () => {
  // 1. Przycisku „■ Zakończ grę" i węzła gry w Informacjach NIE MA — właściciel:
  //    „Proszę usunąć z Informacji przycisk ZAKOŃCZ GRĘ. Rozwiążemy to inaczej".
  for (const id of ['przycisk-zakoncz-gre', 'przycisk-zakoncz-gre-slot', 'informacje-gra']) {
    assert.equal(INDEX.includes(`id="${id}"`), false, `#${id} nie może wrócić do index.html (ADR 0043)`);
    assert.equal(new RegExp(`\\$\\('${id}'\\)`).test(APP), false, `app.js nie sięga po #${id}`);
  }
  assert.equal(/STAN\.graZakonczonaUzbrojone/.test(APP), false,
    'dwustopniowego uzbrajania klikiem nie ma — potwierdzeniem jest wpisanie TAK');
  assert.equal(APP.includes('Kliknij ponownie, aby zakończyć'), false,
    'etykieta „⚠ Kliknij ponownie, aby zakończyć" odeszła z uzbrajaniem');
  assert.match(APP, /\/\/ Potwierdzeniem jest wpisanie TAK w warstwie `#ekran-koniec-gry`/,
    'komentarz pamięta, czym zastąpiono drugi klik (L58)');

  // 2. Warstwa: MAŁA, na środku, z krzyżykiem, polem na TAK i przyciskiem.
  const warstwa = INDEX.match(/<section id="ekran-koniec-gry"[\s\S]*?<\/section>/)?.[0];
  assert.ok(warstwa, 'warstwa końca gry jest w index.html');
  assert.match(warstwa, /^<section id="ekran-koniec-gry" class="ekran panel-centralny" hidden role="dialog"/,
    'to panel centralny ukryty na starcie (ADR 0034)');
  assert.match(warstwa, /Czy na pewno chcesz zakończyć aktualną grę\?/, 'pytanie z decyzji właściciela');
  assert.match(warstwa, /Wpisz w okienko poniżej <strong>TAK<\/strong>/, 'instrukcja wpisania TAK');
  assert.match(warstwa, /<button id="przycisk-zamknij-koniec-gry" class="warstwa-krzyzyk"[^>]*aria-label=/,
    'krzyżyk zamyka warstwę i ma nazwę dostępną (ADR 0011)');
  assert.match(warstwa, /<input id="koniec-gry-potwierdzenie" type="text"[^>]*aria-label=/,
    'pole TAK ma etykietę — bez niej audyt WCAG zgłosi pole bez nazwy');
  assert.match(warstwa, /<button id="przycisk-koniec-gry"[^>]*disabled>/,
    'przycisk zakończenia startuje ZABLOKOWANY');
  assert.match(warstwa, /id="przycisk-koniec-gry" class="przycisk" type="button"/,
    'przycisk ma type=button i klasę `.przycisk` (cel dotykowy ≥ --cel, ADR 0011)');
  assert.match(STYLE, /#ekran-koniec-gry \{ z-index: 30; max-width: 340px; \}/,
    'warstwa jest mała i leży NAD Informacjami oraz rankingiem (te mają z-index 20)');

  // 3. Ikona ⚙ START GRY: bez wyszarzenia, w trakcie gry jest przełącznikiem.
  assert.match(APP, /setup\.disabled = false;/, 'wyszarzenia ikony NIE MA (uwaga I odwraca zgłoszenie J)');
  assert.equal(/niedostępne w trakcie gry/.test(APP), false,
    'stary title o niedostępnej ikonie zniknął razem z blokadą');
  assert.match(APP, /if \(czyGraToczySie\(\)\) \{ przelaczKoniecGry\(\); return; \}/,
    'w trakcie gry klik ⚙ otwiera warstwę, poza grą idzie stary tor (setup → mapa)');
  assert.match(APP, /function czyGraToczySie\(\) \{\n {2}return Boolean\(STAN\.rozgrywka\) && STAN\.rozgrywka\.faza !== FAZY\.koniec && !STAN\.graZakonczonaRecznie;\n\}/,
    'jedna reguła „gra się toczy" dla ikony i dla warstwy — nie mogą się rozjechać');
  assert.match(APP, /ustaw\('przycisk-setup', EKRANY\.includes\(STAN\.ekran\) \|\| koniecOtwarty\);/,
    'otwarta warstwa też zapala ikonę (aria-pressed przełącznika)');

  // 4. Przycisk odblokowuje DOPIERO wpisane TAK — bez względu na wielkość liter.
  assert.match(APP, /const wpis = String\(\$\('koniec-gry-potwierdzenie'\)\.value \?\? ''\)\.trim\(\)\.toLowerCase\(\);\n {2}\$\('przycisk-koniec-gry'\)\.disabled = wpis !== 'tak';/,
    '„TAK", „tak", „ Tak " odblokowują; cokolwiek innego nie');
  assert.match(APP, /\$\('koniec-gry-potwierdzenie'\)\.addEventListener\('input', \(\) => odswiezKoniecGry\(\)\);/,
    'blokada idzie za każdym wpisanym znakiem');
  assert.match(APP, /\$\('przycisk-koniec-gry'\)\.addEventListener\('click', \(\) => zakonczGreZPotwierdzenia\(\)\);/,
    'klik wykonuje koniec gry');
  assert.match(APP, /\$\('koniec-gry-potwierdzenie'\)\.value = '';/,
    'pole jest czyszczone — każde otwarcie warstwy zaczyna od zera');

  // 5. Potwierdzony koniec: hotseat kończy grę lokalnie, a w multi KAŻDY —
  //    także organizator — tylko WYCHODZI z gry (uwaga G, ADR 0019 aneks).
  assert.match(APP, /function zakonczGreZPotwierdzenia\(\) \{\n {2}zamknijKoniecGry\(\{ bezFokusu: true \}\);\n {2}if \(STAN\.multi\) \{[\s\S]{0,600}rezygnujZGryMulti\(\);\n {4}return;\n {2}\}\n {2}zakonczGreRecznie\(\);/,
    'w multi potwierdzony koniec to wyjście z gry dla każdej roli; hotseat kończy się lokalnie');
  assert.equal(/if \(STAN\.multi\.rola === 'organizator'\)[\s\S]{0,200}zakonczGreMulti\(\);/.test(APP), false,
    'gałąź kończąca grę w moście z telefonu hosta zniknęła (uwaga G)');
  assert.match(APP, /STAN\.graZakonczonaRecznie = true;/, 'znacznik ręcznego końca zostaje (zapis gry i wysyłka wyniku na Drive)');

  // 6. Warstwa zachowuje się jak każdy panel: krzyżyk, Escape, krok gry, inert.
  assert.match(APP, /'start', 'informacje', 'koniec-gry'\];/, 'warstwa należy do PANELE');
  assert.match(APP, /\|\| \(koniecGry && nazwa !== 'koniec-gry'\)/,
    'otwarta warstwa usztywnia resztę paneli — jak Informacje i ranking');
  assert.match(APP, /if \(!\$\('ekran-koniec-gry'\)\.hidden\) zamknijKoniecGry\(\);\n {4}else if \(STAN\.podgladMapy\)/,
    'Escape zamyka najpierw warstwę końca gry');
  assert.match(APP, /zamknijRankingi\(\{ bezFokusu: true \}\);\n {2}zamknijKoniecGry\(\{ bezFokusu: true \}\);/,
    'każdy krok gry gasi warstwę (jak Informacje i ranking)');
  assert.match(APP, /if \(!bezFokusu\) \$\('przycisk-setup'\)\.focus\(\);/,
    'zamknięcie oddaje fokus na ikonę, którą warstwa została otwarta');

  // 7. Warstwy NIE świecą równocześnie: otwarcie potwierdzenia gasi podgląd mapy,
  //    Informacje i ranking — inaczej `visibility: hidden` z cudzej klasy
  //    pokazałoby pustą kartę (reguły `body.*-otwarte` w styles.css).
  assert.match(APP, /function otworzKoniecGry\(\) \{\n {2}STAN\.podgladMapy = false;\n {2}zamknijInformacje\(\);\n {2}zamknijRankingi\(\{ bezFokusu: true \}\);/,
    'otwarcie warstwy końca gry gasi podgląd mapy i obie pozostałe warstwy');
  assert.match(APP, /document\.body\.classList\.toggle\('koniec-gry-otwarte', koniecGry\);/,
    'jedno miejsce liczy klasę warstwy (jak `informacje-otwarte`)');
  assert.match(APP, /zamknijKoniecGry\(\{ bezFokusu: true \}\); \/\/ warstwy nie świecą równocześnie/,
    'otwarcie Informacji zamywa potwierdzenie końca gry');
  assert.match(APP, /zamknijInformacje\(\); \/\/ warstwy nie świecą równocześnie\n {2}zamknijKoniecGry\(\{ bezFokusu: true \}\);/,
    'otwarcie rankingu też je zamyka');
  assert.match(STYLE, /body\.koniec-gry-otwarte \.panel-centralny:not\(#ekran-koniec-gry\) \{ visibility: hidden; \}/,
    'otwarta warstwa końca gry wygasza pozostałe panele');
  assert.match(STYLE, /#ekran-informacje, #ekran-ranking \{ z-index: 20; \}/,
    'Informacje i ranking zostają na z-index 20 — warstwa końca gry ma 30');
});

test('kontrakt ADR 0043: zdania dla gracza o końcu gry nazywają ikonę ⚙ START GRY', () => {
  // L27/L58/L63: usunięcie przycisku-ujścia musi w TEJ samej fali przestawić
  // zdania, które na niego wskazywały. Sprawdzamy WIERSZE KODU, nie komentarze —
  // komentarz może cytować martwą etykietę jako nagrobek (L31), zdanie dla gracza
  // nie może, bo gracz idzie za nim w terenie.
  const zdania = wierszeKodu(APP).filter(({ l }) => /zakończ grę/i.test(l));
  assert.ok(zdania.length >= 4, `app.js ma ${zdania.length} zdań dla gracza o kończeniu gry`);
  for (const { l, n } of zdania) {
    assert.ok(l.includes('⚙ START GRY'),
      `app.js:${n} odsyła gracza do końca gry, nie nazywając ikony ⚙ START GRY (ADR 0043 pkt 2)`);
  }
  // W drodze panel gry jest schowany (ADR 0036 aneks m12-102 pkt 2), więc zdanie
  // o niedającym się rozstrzygnąć dojściu musi mieć DRUGI nośnik: `status()`
  // trafia do `#status` w Informacjach i jest czytane przez `aria-live`.
  assert.match(APP, /if \(d\.kod\) \{\n {4}\$\('gra-komunikat'\)\.textContent = d\.komunikat;[\s\S]{0,500}?status\(d\.komunikat\);/,
    'kod dojścia ląduje też w statusie — w drodze `#gra-komunikat` jest schowany z całym panelem');
});

test('kontrakt ADR 0042: Informacje jedną, małą czcionką Courier New', () => {
  // Właściciel 2026-09-13 (uwaga H2): cała treść warstwy — ten sam krój
  // i ten sam rozmiar, bez wyróżniania nagłówka.
  assert.match(STYLE, /#ekran-informacje,\n#ekran-informacje h2[^{]*\{[^}]*font-family: 'Courier New', Courier, monospace;[^}]*font-size: 13px;[^}]*font-weight: 400;[^}]*\}/s,
    'zapis ADR 0042 obejmuje warstwę i jej elementy tekstowe');
  assert.match(STYLE, /#ekran-informacje button:not\(\.warstwa-krzyzyk\)/,
    'przyciski w treści mają ten sam krój, a krzyżyk zamknięcia zostaje ikoną-celem');
  assert.match(STYLE, /#ekran-informacje h2 \{ margin: 4px 0 10px; \}/,
    'nagłówek nie jest już większy od reszty — wyróżnia go miejsce, nie rozmiar');
  assert.equal(/#ekran-informacje[^{]*\{[^}]*font-size: 2\dpx/.test(STYLE), false,
    'żaden zapis nie wraca do dużego nagłówka w Informacjach');
});

test('kontrakt ADR 0030 aneks: ekran obraca się sam, a po obrocie ◎ klika się samo', () => {
  // Właściciel 2026-09-13 (uwaga D z testów terenowych): najpierw prośba
  // o zablokowanie ekranu w pionie z przełącznikiem poziomu w górnym menu,
  // potem WYCOFANA — zostaje autoobrót jak dotąd i jedno „autokliknięcie" ◎.

  // 1. NIE MA blokady orientacji ani przełącznika w menu.
  assert.equal(/orientation\.lock|lockOrientation/.test(APP), false,
    'aplikacja nie blokuje orientacji ekranu (uwaga D wycofana)');
  assert.equal(/id="(przycisk|przelacznik)-orientacja/.test(INDEX), false,
    'w górnym menu nie ma przełącznika pion/poziom');
  const manifest = JSON.parse(czytaj('assets/manifest.json'));
  assert.equal('orientation' in manifest, false,
    'manifest nie zamyka aplikacji w jednej orientacji');

  // 2. Decyzje bierze czysty moduł, a warstwa DOM nasłuchuje obu zdarzeń.
  assert.match(APP, /from '\.\/orientacja\.js\?v=/, 'app.js bierze decyzje o obrocie z orientacja.js');
  assert.match(APP, /import \{ OPOZNIENIE_OBROTU_MS, czyObrotEkranu, kierunekEkranu \}/,
    'import orientacja.js ma pełny kształt (ADR 0030 aneks)');
  assert.match(APP, /naZmianeRozmiaruOkna\(\); \/\/ ADR 0030 aneks: po obrocie ◎ klika się samo/,
    'resize uruchamia sprawdzenie obrotu');
  assert.match(APP, /window\.addEventListener\('orientationchange', naZmianeRozmiaruOkna\);/,
    'obrót zgłoszony osobnym zdarzeniem (iOS) idzie tym samym torem');
  assert.match(APP, /STAN\.obrotOpoznienie = setTimeout\(sprawdzObrotEkranu, OPOZNIENIE_OBROTU_MS\);/,
    'czekamy, aż wymiary osiądą — animacja obrotu melduje wartości pośrednie');
  assert.match(APP, /STAN\.kierunekEkranu = kierunekEkranu\(rozmiarOkna\(\)\);/,
    'start mierzy punkt odniesienia, żeby pierwszy obrót był obrotem');

  // 3. Skutek: tylko zmiana KIERUNKU i tylko na widocznej mapie.
  assert.match(APP, /const po = kierunekEkranu\(rozmiarOkna\(\)\);\n {2}if \(!czyObrotEkranu\(\{ przed: STAN\.kierunekEkranu, po \}\)\) return;/,
    'zmiana rozmiaru bez obrotu widoku nie rusza — mapę prowadzi palec gracza (ADR 0011)');
  assert.match(APP, /const mapa = STAN\.mapy\[nazwaWidocznejMapy\(\)\];\n {2}if \(!mapa\) return;\n {2}mapa\.odswiez\(\);[^\n]*\n {2}mapa\.centrujNaPozycji\(\);/,
    'po obrocie widoczna mapa jest przeliczana i centrowana na graczu');
  assert.match(MAPA, /centrujNaPozycji: \(\) => naPrzycisk\('centruj'\)/,
    '„autokliknięcie" idzie tym samym kodem, który uruchamia przycisk ◎');
  assert.match(APP, /document\.body\.dataset\.mapa = nazwaWidocznejMapy\(\);/,
    'CSS (ADR 0030 pkt 1) i centrowanie czytają tę samą regułę widocznej mapy');
});
test('kontrakt ADR 0041: sygnał zdarzenia to dźwięk I wibracja', () => {
  // Właściciel 2026-09-13 (uwaga M): „Sygnały dźwiękowe powinny, jeśli to
  // możliwe dawać także sygnał wibracyjny (chyba, że się tego nie da zrobić)."
  // Kod był dwukanałowy od M10/T4 — ten pin pilnuje, żeby żaden sygnał nie
  // został odchudzony do samego dźwięku (ani warstwa DOM nie zgubiła wibracji).
  const SYGN = czytaj('app/sygnaly.js');
  const wibracje = (SYGN.match(/wibracjaMs:/g) ?? []).length;
  const dzwieki = (SYGN.match(/dzwiek:/g) ?? []).length;
  assert.ok(wibracje >= 4, `SYGNALY ma ${wibracje} wzorców wibracji — zdarzeń jest co najmniej cztery`);
  assert.equal(wibracje, dzwieki, 'każdy plan ma OBA kanały: wzorzec wibracji i nuty');
  assert.match(APP, /if \(plan\.wibracjaMs && typeof navigator !== 'undefined' && typeof navigator\.vibrate === 'function'\) navigator\.vibrate\(plan\.wibracjaMs\);/,
    'warstwa DOM wykonuje wzorzec wibracji z planu');
  assert.match(APP, /if \(plan\.dzwiek\?\.length\) odegrajDzwieki\(plan\.dzwiek\);/, 'ten sam plan gra nuty');
  assert.match(APP, /function odegrajSygnal\(zdarzenie\) \{\n {2}const plan = planSygnalu\(zdarzenie, \{ wlaczone: sygnalyWlaczone\(\) \}\);\n {2}if \(!plan\) return;/,
    'przełącznik „🔔 sygnały" wyłącza oba kanały naraz (ADR 0041 pkt 4)');
  assert.match(APP, /catch \{ \/\* brak wibracji \(desktop, iOS\) jest normalny \*\/ \}/,
    'brak wibracji jest cichym no-opem i nie przerywa gry (LESSONS L6)');
});
test('kontrakt ADR 0027 aneks 2026-09-13: pula premii = min(3, grający − 1)', () => {
  // Właściciel 2026-09-13 (uwaga L): punktacja zależy od liczby grających
  // w momencie zakończenia gry, a odłączeni wcześniej nie liczą się do puli.
  const WIELO = czytaj('app/wieloosobowa.js');
  assert.match(WIELO, /export const MAKS_PREMIA_KOLEJNOSCI = 3;/, 'sufit premii jest nazwaną stałą');
  assert.match(WIELO, /const dograli = postepy\.filter\(\(w\) => !w\.postep\.zrezygnowal\);/,
    'do puli wchodzą tylko gracze bez rezygnacji');
  assert.match(WIELO, /const pula = Math\.min\(MAKS_PREMIA_KOLEJNOSCI, Math\.max\(0, dograli\.length - 1\)\);/,
    'aplikacja liczy pulę z grających, którzy dograli (1 grający → 0 pkt)');
  assert.match(WIELO, /const ile = pula - i;/, 'miejsca schodzą od puli w dół, nie od stałej 3/2/1');
  assert.match(GS, /const grajacy = gracze\.filter\(\(g\) => !rezygnacje\[g\.id\]\)\.length;/,
    'most liczy grających tak samo (bez zrezygnowanych)');
  assert.match(GS, /const pula = Math\.min\(maksPremia, Math\.max\(0, grajacy - 1\)\);/,
    'most liczy tę samą pulę — kopię pilnuje test parity w most-gra.test.js');
  assert.equal(/\[3, 2, 1\]\[i\]/.test(WIELO + GS), false,
    'stała tabela 3/2/1 umarła po obu stronach (LESSONS L31: usunięcie i grep w tym samym commitcie)');
});

test('kontrakt ADR 0019 aneks 2026-09-13b: koniec gry hosta nie kończy gry pozostałym (uwaga G)', () => {
  // 1. Aplikacja nie kończy gry w moście: koniec na telefonie = zdarzenie `rezygnacja`.
  assert.equal(/akcja: 'gra-zakoncz'/.test(APP + czytaj('app/sync.js') + czytaj('app/wieloosobowa.js')), false,
    'żaden moduł aplikacji nie woła akcji gra-zakoncz');
  assert.equal(/function zakonczGreMulti/.test(APP), false,
    'funkcja kończąca grę globalnie usunięta — w jej miejscu został nagrobek');
  assert.match(APP, /`zakonczGreMulti\(\)` USUNIĘTA \(właściciel 2026-09-13, uwaga G/,
    'nagrobek mówi, dlaczego funkcji nie ma (LESSONS: martwy kod kasujemy z wyjaśnieniem)');
  assert.match(APP, /const organizator = m\.rola === 'organizator';\n {2}void wyslijZdarzenieMulti\('rezygnacja', null, \{\n {4}powod: organizator \? 'organizator zakończył grę na swoim telefonie' : 'rezygnacja z telefonu',\n {2}\}\);/,
    'zdarzenie rezygnacji niesie powód zależny od roli');
  assert.match(APP, /Gra zakończona na tym telefonie — pozostali gracze grają dalej/,
    'status organizatora jest uczciwy: inni grają dalej');
  assert.match(APP, /\$\('przycisk-koniec-gry'\)\.addEventListener\('click', \(\) => zakonczGreZPotwierdzenia\(\)\);/,
    'ścieżka ⚙ START GRY → TAK → koniec na tym telefonie zostaje (ADR 0043)');

  // 2. Most domyka grę także po rezygnacji — inaczej wisiałaby otwarta, gdy
  //    wychodzi ostatni aktywny gracz.
  assert.match(GS, /if \(z\.typ !== 'koniec' && czyKompletna\(gra\)\) \{/,
    'rezygnacja może domknąć grę (czyKompletna liczy rezygnującego za domkniętego)');
  assert.equal(/z\.typ !== 'rezygnacja' && z\.typ !== 'koniec'/.test(GS), false,
    'stare wyłączenie rezygnacji ze sprawdzania kompletności zniknęło');
  assert.match(GS, /gra\.stan = 'zakonczona'; \/\/ stan PRZED wynikami/,
    'domknięcie liczy wyniki i premie tak jak dotąd');

  // 3. Akcja `gra-zakoncz` ZOSTAJE w moście (starsze telefony z offline'ową
  //    skorupą z SW, ręczne porządkowanie gier na Drive) — ale poza flow gry.
  assert.match(GS, /case 'gra-zakoncz':/, 'most nadal obsługuje akcję gra-zakoncz');
  assert.match(GS, /aplikacja NIE woła już tej akcji/,
    'most pamięta, że flow gry jej nie używa (komentarz przy akcji)');

  // 4. Atrapa mostu w testach UI jest lustrem reguły z .gs (wzór: parity premii).
  assert.match(czytaj('test/wieloosobowa-ui.test.js'), /if \(z\.typ !== 'koniec' && czyKompletna\(gra\)\) \{/,
    'atrapa w test/wieloosobowa-ui.test.js ma tę samą regułę domykania co .gs');

  // 5. Dokumentacja mówi to samo co kod.
  assert.match(PROTOKOL, /host NIE kończy gry\npozostałym/, 'PROTOKOL §9.1 ma regułę właściciela');
  assert.match(PROTOKOL, /rezygnacja też jest sprawdzana pod kątem domknięcia/,
    'PROTOKOL §9.1 tłumaczy, dlaczego most domyka grę po rezygnacji');
  assert.match(czytaj('docs/ARCHITECTURE.md'), /i host, i gość wysyłają wtedy `rezygnacja`/,
    'ARCHITECTURE nie mówi już, że organizator woła gra-zakoncz');
  assert.match(README, /kończy ją TYLKO na tym telefonie/, 'README ma regułę dla gracza');
  // Aneks G jest od m12-114 treścią historyczną: dosłownie ten sam tekst leży
  // w archiwum ADR 0019 (budżet lektury startowej, AGENTS.md §0; LESSONS L62),
  // a plik macierzysty niesie wskaźnik z datami — cytowania „ADR 0019 aneks
  // 2026-09-13b" mają pokrycie w dokumentach, tylko poza lekturą startową.
  assert.match(czytaj('docs/decisions/archive/aneksy-0019-2026-09-12f-do-13b.md'),
    /## Aneks 2026-09-13b \(m12-109, uwaga G\)/, 'aneks G jest udokumentowany (archiwum ADR 0019)');
  assert.match(czytaj('docs/decisions/0019-gra-wieloosobowa-multi-device.md'),
    /## Aneksy 2026-09-12f … 2026-09-13b są w archiwum/, 'ADR 0019 odsyła do archiwum aneksów');
  assert.match(czytaj('docs/decisions/0044-odliczanie-po-starcie-gry-wieloosobowej.md'),
    /aneks 2026-09-13b \(uwaga G\)/, 'ADR 0044 odsyła do aneksu, który zmienił jego pkt 8');
  assert.match(czytaj('docs/WORKFLOW.md'), /gra kończy\n   się TYLKO na telefonie A/,
    'scenariusz testu terenowego w WORKFLOW §6 jest zgodny z nowym zachowaniem');
});

test('kontrakt ADR 0045: setup nie szuka gier, a otwarcie aplikacji wraca do zapamiętanej gry (uwagi J i K)', () => {
  // 1. J: kart wznowienia i ich przycisków nie ma w HTML ani w aplikacji.
  for (const id of [
    'karta-wznowienie', 'wznowienie-opis', 'przycisk-wznow-gre', 'przycisk-kasuj-zapis',
    'multi-wznowienie', 'multi-wznowienie-opis', 'przycisk-multi-wroc', 'przycisk-multi-porzuc',
  ]) {
    assert.equal(INDEX.includes(`id="${id}"`), false, `index.html nie ma elementu #${id}`);
    assert.equal(APP.includes(`$('${id}')`), false, `app.js nie dotyka #${id}`);
  }
  assert.equal(STYLE.includes('.karta-wznowienie {'), false, 'klasa CSS po kartach wznowienia usunięta');
  for (const fn of ['function sprawdzZapisGry', 'function kasujZapisGry', 'function renderujWznowienieMulti']) {
    assert.equal(APP.includes(fn), false, `${fn.replace('function ', '')}() usunięta — został nagrobek`);
  }
  assert.equal(APP.includes('czyszczenieZapisuUzbrojone'), false,
    'uzbrajania kasowania zapisu nie ma');
  assert.equal(APP.includes('historiaKasowanieUzbrojone'), false,
    'dwustopniowego kasowania historii też nie ma — lokalna historia gier zniknęła (zgłoszenie O, ADR 0010 aneks)');

  // 2. K: start wraca do zapamiętanej gry — multi z mostu, hotseat z zapisu.
  assert.match(APP, /if \(czytajSesjeMulti\(\)\) void przywrocGreMulti\(\)\.then\(\(\) => \{ if \(!STAN\.multi\) przywrocGreHotseat\(\); \}\);\n {2}else przywrocGreHotseat\(\);/,
    'boot wybiera grę wieloosobową, a gdy ta się nie podniosła — zapis hotseat');
  assert.match(APP, /ukryjStart\(\); \/\/ powrót do gry pomija okno startowe/,
    'powrót do gry nie zostawia gracza na oknie startowym');
  assert.match(APP, /window\.addEventListener\('pagehide', \(\) => zapiszGre\(\)\);/,
    'zamknięcie karty zapisuje stan gry (uwaga K)');
  assert.match(APP, /if \(document\.hidden\) \{\n {6}zapiszGre\(\);/,
    'zwinięcie telefonu też zapisuje stan');
  assert.match(APP, /if \(stan\.rozgrywka\?\.faza === FAZY\.koniec\) \{\n {4}localStorage\.removeItem\(kluczStanu\(aktywna\)\);\n {4}localStorage\.removeItem\(KLUCZ_AKTYWNEJ\);/,
    'zakończonej gry start nie podnosi — kasuje zapis (wynik jest na wspólnym Drive)');
  assert.match(APP, /Zapamiętany zapis gry był zepsuty \(\$\{usterki\.map\(\(u\) => u\.kod\)\.join\(', '\)\}\)/,
    'zepsuty zapis jest kasowany jawnie, z kodami usterek T**');

  // 3. K: sesję multi kasują cztery drogi, a awaria sieci jej nie kasuje.
  assert.match(APP, /      usunSesjeMulti\(\);\n {6}status\(`Nie ma już tamtej gry wieloosobowej/,
    'jawna odmowa mostu kasuje sesję — telefon nie próbuje przy każdym starcie');
  assert.match(APP, /status\(`Nie udało się wrócić do gry: \$\{powod\}\. Telefon ją pamięta/,
    'awaria sieci sesji NIE kasuje (LESSONS L6: komunikat nazywa przyczynę)');
  assert.match(APP, /  usunSesjeMulti\(\);\n {2}zatrzymajSymulacje\(\);/,
    'rezygnacja kasuje sesję — po odświeżeniu telefon nie wraca do gry, z której wyszedł');

  // 4. Dokumentacja żywa mówi to samo co kod.
  assert.ok(existsSync(join(ROOT, 'docs/decisions/0045-telefon-wraca-do-zapamietanej-gry.md')), 'ADR 0045 istnieje');
  assert.match(czytaj('docs/ARCHITECTURE.md'), /Banera wznowienia na setupie NIE MA \(ADR 0045/,
    'ARCHITECTURE opisuje brak banera i automatyczny powrót');
  assert.match(czytaj('docs/ARCHITECTURE.md'), /`przywrocGreHotseat\(\)` → `wznowGre\(\)`/,
    'ARCHITECTURE nazywa funkcje powrotu');
  assert.match(README, /wraca do ostatniego zapisu samo, bez banera i bez kliku/, 'README mówi o powrocie po odświeżeniu');
  assert.match(czytaj('docs/WORKFLOW.md'), /aplikacja wraca do tej\n   gry SAMA/, 'WORKFLOW ma krok terenowy o powrocie w hotseacie');
  assert.match(czytaj('docs/WORKFLOW.md'), /aplikacja wraca do\n   gry SAMA, bez banera i bez kliku/, 'WORKFLOW ma krok terenowy o powrocie w multi');
});

test('kontrakt: archiwum LESSONS jest lustrem rejestru i nie wchodzi w budżet lektury', async () => {
  const rejestr = czytaj('docs/LESSONS.md');
  const archiwum = czytaj('docs/LESSONS_ARCHIVE.md');
  const numeryR = [...rejestr.matchAll(/^## L(\d+) /gm)].map((m) => Number(m[1]));
  const numeryA = [...archiwum.matchAll(/^## L(\d+) /gm)].map((m) => Number(m[1]));
  assert.ok(numeryR.length >= 61, `rejestr ma ${numeryR.length} lekcji`);
  assert.deepEqual(numeryA, numeryR, 'archiwum ma dokładnie te same lekcje, w tej samej kolejności');
  // Każda lekcja w rejestrze mówi, gdzie leży jej pełny opis — inaczej podział
  // rozjedzie się cicho (LESSONS L31/L58: nośnik, który obiecuje, musi istnieć).
  const odsylacze = [...rejestr.matchAll(/`docs\/LESSONS_ARCHIVE\.md` → `## L(\d+)`/g)].map((m) => Number(m[1]));
  assert.deepEqual(odsylacze, numeryR, 'każda lekcja ma odnośnik do swojego wpisu w archiwum');
  assert.match(rejestr, /Objaw i przyczyna są tu\njednym zdaniem/, 'rejestr mówi, że jest skrótem');
  assert.ok(AGENTS.includes('docs/LESSONS_ARCHIVE.md'),
    'AGENTS.md §0 wymienia archiwum (pozycja 4 i lista „czego NIE czytasz na start")');
  const { plikiLektury } = await import('../tools/budzet-lektury.mjs');
  const pliki = plikiLektury(ROOT);
  assert.equal(pliki.includes('docs/LESSONS_ARCHIVE.md'), false,
    'archiwum NIE wchodzi w budżet lektury startowej — po to powstało');
  assert.equal(pliki.includes('docs/LESSONS.md'), true, 'rejestr zostaje w budżecie');
});

test('kontrakt: archiwum ADR-ów jest poza budżetem lektury, a wiersze zostają w rejestrze', async () => {
  // L62: największym zjadaczem budżetu są ADR-y (~65 tys. z 100 tys.), więc gdy
  // próg pęka, wycofane w całości idą do `docs/decisions/archive/`. Rejestr
  // traci tylko ścieżkę linku, nie wiersz — inaczej pin „ADR na dysku ↔ rejestr”
  // przestałby pilnować przeniesionych plików.
  const archiwum = readdirSync(join(ROOT, 'docs/decisions/archive')).filter((f) => /^\d{4}-.*\.md$/.test(f));
  assert.ok(archiwum.length >= 2, `w archiwum są ${archiwum.length} ADR-y wycofane w całości`);
  const { plikiLektury } = await import('../tools/budzet-lektury.mjs');
  const pliki = plikiLektury(ROOT);
  for (const plik of archiwum) {
    assert.equal(pliki.includes(`docs/decisions/archive/${plik}`), false,
      `${plik} NIE może wchodzić w lekturę startową — po to jest archiwum`);
    assert.equal(pliki.includes(`docs/decisions/${plik}`), false,
      `${plik} wyszedł z katalogu głównego razem z przeniesieniem`);
  }
  assert.match(czytaj('docs/decisions/README.md'), /docs\/decisions\/archive\//,
    'rejestr mówi, gdzie leżą ADR-y przeniesione do archiwum');
  assert.ok(AGENTS.includes('docs/decisions/archive/*'),
    'AGENTS.md §0 wypisuje archiwum ADR-ów wśród plików, których nie czytasz na start');
  // Wycofanie nie kasuje śladu: przeniesiony ADR nadal ma status i tytuł, a rejestr
  // nadal go wymienia (pin „status w rejestrze ↔ status w pliku” czyta obie ścieżki).
  for (const plik of archiwum) {
    const tresc = czytaj(`docs/decisions/archive/${plik}`);
    assert.match(tresc, /^- Status: Wycofana/m, `${plik}: w archiwum leżą wyłącznie ADR-y wycofane`);
  }
});

test('kontrakt: pinezki zaliczone biorą id stacji, nie indeks tablicy odcinków (uwaga G)', () => {
  // `odcinki` jest tablicą (`nowaRozgrywka`: stacje.map). Object.entries dawał
  // klucze 0,1,2… i stacja 1 nigdy nie dostawała szarości.
  assert.match(APP, /zaliczoneStacjeIds/, 'app.js liczy zaliczone przez helper z rozgrywki');
  assert.equal(APP.includes('Object.entries(r.odcinki'), false,
    'app.js nie może brać Object.entries z tablicy odcinków — to indeks, nie id');
  const roz = czytaj('app/rozgrywka.js');
  assert.match(roz, /export function zaliczoneStacjeIds/, 'helper jest eksportowany');
  assert.match(roz, /o\.stacja/, 'helper czyta pole stacja');
});
