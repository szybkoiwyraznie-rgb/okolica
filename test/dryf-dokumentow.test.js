/**
 * Strażnik dryfu tekstów (LESSONS L58) — dokumenty ŻYWE i teksty UI nie mogą
 * opisywać rzeczy, których nie ma.
 *
 * Skąd ten plik: audyt PR #18 (sesja 2026-09-12K) znalazł jedenaście miejsc,
 * w których ekran, komentarz albo dokument obiecywały funkcję usuniętą kilka
 * fal wcześniej (moderacja paczek, eksport plikiem, badge dokładności, próg
 * 25 m, widmowy moduł `ui.js`). Każde z nich przeszło przez zieloną bramę, bo
 * żaden test nie czytał TEKSTU. L31 każe przeglądać nośniki przy usuwaniu
 * funkcji ręcznie — ten plik jest tym przeglądem zautomatyzowanym.
 *
 * Zasada zakresu: historia (PROJECT_HISTORY, LESSONS, ADR-y, handoffy) jest
 * POZA listą nośników — tam cytowanie martwej frazy jest dowodem zmiany, nie
 * błędem. Testy też są poza listą fraz (asertują nieobecność, więc muszą
 * frazę znać).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const czytaj = (sciezka) => readFileSync(join(ROOT, sciezka), 'utf8');

const PLIKI_APP = readdirSync(join(ROOT, 'app'))
  .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
  .map((f) => `app/${f}`);

/** Dokumenty, za którymi czytelnik idzie DZISIAJ (procedury i opisy stanu). */
const DOKUMENTY = [
  'README.md',
  'AGENTS.md',
  'docs/ROADMAP.md',
  'docs/WORKFLOW.md',
  'docs/ARCHITECTURE.md',
  'docs/ASSETS.md',
  'docs/PROTOKOL.md',
  'docs/decisions/README.md',
];

/** To, co widzi gracz albo czyta następny agent przy zmianie kodu. */
const UI = ['index.html', 'sw.js', ...PLIKI_APP];

const MOST = 'docs/setup/apps-script-repo-paczek.gs';

/**
 * Fraza + dlaczego jest martwa + gdzie nie wolno jej wrócić.
 *
 * Wpisy są celowo DOSŁOWNE (etykieta przycisku, nazwa stałej, zdanie z ekranu):
 * mają łapać powrót funkcji albo opisu, nie dyskusję o niej. Zdania przeczące
 * („eksportów nie ma”) używają innych słów, więc przechodzą.
 */
const MARTWE_FRAZY = [
  {
    fraza: 'do przeglądu właściciela',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'moderacja wstępna zniesiona 2026-09-11 (ADR 0017 aneks): przyjęta paczka ląduje od razu w katalogu zaakceptowanych',
  },
  {
    fraza: 'linkiem przeglądu',
    nosniki: DOKUMENTY,
    powod: 'sesji przeglądu paczek nie ma (2026-09-11) — jakość rozstrzygają łapki (ADR 0028)',
  },
  {
    fraza: 'Eksport plikiem',
    nosniki: UI,
    powod: 'eksportu pliku nie ma w UI (ADR 0038; eksport zestawu zniknął 2026-09-07)',
  },
  {
    fraza: '⬆ Z pliku',
    nosniki: UI,
    powod: 'wczytywania paczki z pliku nie ma (ADR 0006 aneks 3)',
  },
  {
    fraza: 'modelu albo pliku',
    nosniki: UI,
    powod: 'status nie może odsyłać do pliku — paczki są tylko z repozytorium albo z modelu (zadanie I, 2026-09-12)',
  },
  {
    fraza: 'zapisz plik i wnieść go ręcznie',
    nosniki: UI,
    powod: 'ręcznego wnoszenia pliku nie ma (ADR 0006 aneks 3, ADR 0038)',
  },
  {
    fraza: '🛰 Włącz GPS',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'GPS rusza sam, przycisku nie ma (ADR 0034 pkt 5)',
  },
  {
    fraza: '✎ Wpisz ręcznie',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'ręcznych współrzędnych nie ma (ADR 0034 pkt 5)',
  },
  {
    fraza: 'badge dokładności',
    nosniki: [...DOKUMENTY, ...UI],
    powod: '`accuracy` nie jest pokazywana graczowi (ADR 0034 pkt 2)',
  },
  {
    fraza: 'jasne koło dokładności',
    nosniki: DOKUMENTY,
    powod: 'koła dokładności nie ma na mapie — warstwy dostają pozycję bez `accuracy` (ADR 0034 pkt 2)',
  },
  {
    fraza: 'filtr dokładności',
    nosniki: [...DOKUMENTY, ...UI],
    powod: '`ocenFix` waliduje współrzędne, nie dokładność (ADR 0034 pkt 2)',
  },
  {
    fraza: 'pojedynczy fix w promieniu',
    nosniki: UI,
    powod: 'dojście to DWA kolejne pomiary (`GRANICE.wymaganeTrafnienia = 2`, ADR 0034 pkt 2)',
  },
  {
    fraza: 'próg 25 m',
    nosniki: DOKUMENTY,
    powod: 'próg dojścia to 50 m (`geo.progDojsciaM()`, ADR 0034 pkt 2)',
  },
  {
    fraza: 'progDojsciaM() = 25',
    nosniki: DOKUMENTY,
    powod: '`progDojsciaM()` zwraca 50 (ADR 0034 pkt 2)',
  },
  {
    fraza: 'Rankingów między grami nie ma',
    nosniki: DOKUMENTY,
    powod: 'ranking wrócił w nowej formie (ADR 0039, `RO-ranking/2`)',
  },
  {
    fraza: '📱 z tego telefonu',
    nosniki: UI,
    powod: 'paczki są tylko z repozytorium — sekcji paczek z telefonu nie ma (zadanie I, 2026-09-12)',
  },
  {
    fraza: 'zmień „Podkład mapy”',
    nosniki: DOKUMENTY,
    powod: 'przełącznika podkładu w setupie nie ma — język i podkład są zaszyte w kodzie (ADR 0037)',
  },
  {
    fraza: 'język i podkład mapy',
    nosniki: DOKUMENTY,
    powod: 'setup nie pyta o język ani o podkład (ADR 0037)',
  },
  {
    fraza: 'data/przyklady/paczka-',
    nosniki: DOKUMENTY,
    powod: 'plik referencyjny to `data/przyklady/zestaw-*.json` (TO-zestaw/1)',
  },
  {
    fraza: 'scaleniu PR #2',
    nosniki: DOKUMENTY,
    powod: 'Pages jest włączone od 2026-09-06 (kamień M8) — instrukcja nie może czekać na PR #2',
  },
  {
    fraza: 'docelowo `ui.js`',
    nosniki: DOKUMENTY,
    powod: 'modułu `ui.js` nie ma — warstwa DOM siedzi w `app.js`',
  },
  // Fala 2026-09-13 (uwagi właściciela z testów, ADR 0040): system pauzy i
  // wznawiania wycofany razem z profilem oszczędnym GPS. Frazy są dosłowne —
  // komentarze w kodzie mówią o wycofaniu innymi słowami, więc nie łapią się.
  {
    fraza: '⏸ Pauza',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'systemu pauzy i wznawiania nie ma (właściciel 2026-09-13, ADR 0040 pkt 1) — gra i śledzenie idą cały czas',
  },
  {
    fraza: 'Zegar gry zatrzymany',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'zegar gry płynie cały czas (`zegarGry()` = `performance.now()`, ADR 0040 pkt 1)',
  },
  {
    fraza: 'Śledzenie położenia jest wstrzymane',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'kod P07 wycofany 2026-09-13: śledzenia nie zatrzymujemy ani przyciskiem, ani w tle (ADR 0040 pkt 3)',
  },
  {
    fraza: 'Wznowiono śledzenie',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'kod P09 wycofany 2026-09-13: powrót z tła odświeża nasłuch sam i bez komunikatu (ADR 0040 pkt 3)',
  },
  {
    fraza: 'GPS w trybie oszczędnym',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'jeden profil watchera, zawsze dokładny — oszczędzanie baterii wycofane (ADR 0040 pkt 2)',
  },
  {
    fraza: 'bateria odpoczywa',
    nosniki: [...DOKUMENTY, ...UI],
    powod: '„oszczędzanie baterii przy tego typu zabawach nie ma sensu" (właściciel 2026-09-13, ADR 0040 pkt 2)',
  },
  {
    fraza: 'pominięcie stacji',
    nosniki: DOKUMENTY,
    powod: 'akcji pomijania nie ma od zadania H (2026-09-12, ADR 0015 aneks) — wyjściem jest ikona ⚙ START GRY z wpisaniem TAK (ADR 0043)',
  },
  {
    fraza: 'id="karta-wznowienie"',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'baner wznowienia gry usunięty 2026-09-13 (ADR 0045, uwaga J) — otwarcie aplikacji wraca do zapamiętanej gry samo',
  },
  {
    fraza: 'id="multi-wznowienie"',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'karta powrotu do gry wieloosobowej usunięta 2026-09-13 (ADR 0045, uwagi J i K) — powrót jest automatyczny',
  },
  {
    fraza: 'przycisk-wznow-gre',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'przycisku wznowienia gry nie ma (ADR 0045) — telefon wraca do gry bez kliku',
  },
  {
    fraza: 'przycisk-kasuj-zapis',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'dwustopniowego kasowania zapisu gry nie ma (ADR 0045 pkt 3) — start kasuje zapis, którego nie da się podnieść',
  },
  {
    fraza: 'przycisk-multi-wroc',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'przycisku powrotu do gry wieloosobowej nie ma (ADR 0045) — `przywrocGreMulti` woła się przy starcie',
  },
  {
    fraza: 'przycisk-multi-porzuc',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'przycisku porzucenia sesji nie ma (ADR 0045 pkt 5) — sesję kasuje lobby, most, rezygnacja i jawna odmowa mostu',
  },
  {
    fraza: 'Znaleziono niedokończoną grę',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'opisu banera wznowienia nie ma (ADR 0045) — aplikacja wraca do gry sama i mówi to w statusie',
  },
  {
    fraza: '.karta-wznowienie {',
    nosniki: UI,
    powod: 'klasa CSS po obu kartach wznowienia usunięta (ADR 0045)',
  },
  // Fala 2026-09-13 (uwagi H1 i I, ADR 0043): przycisk „■ Zakończ grę” zniknął
  // z panelu gry i z Informacji, a koniec gry przeszedł za ikonę ⚙ START GRY
  // z wpisaniem TAK. Zdania, które wskazywały tamten przycisk, zostały w
  // tabelach komunikatów (`KODY_POZYCJI`, `stanDojscia`, `onBlad` watchera) i
  // przeszły przez zieloną bramę — strażnik L58 nie miał frazy z tej fali.
  {
    fraza: 'zakończ grę przyciskiem',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'przycisku kończenia gry nie ma od ADR 0043 — grę kończy ikona ⚙ START GRY i wpisanie TAK',
  },
  {
    fraza: 'wgraj paczkę ponownie z pliku',
    nosniki: UI,
    powod: 'wczytywania paczki z pliku nie ma od 2026-09-07 (ADR 0006 aneks 3) — paczka przychodzi z repozytorium albo z wklejonej odpowiedzi modelu',
  },
  {
    fraza: 'przyciskiem „Zapisz nowy”',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'bramka tożsamości to imię + PIN i jedno wołanie `profil-ustaw` (ADR 0026) — osobnego przycisku zapisu profilu nie ma',
  },
  {
    fraza: 'Poprzednie gry',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'lokalna historia gier usunięta 2026-09-13 (zgłoszenie terenowe O, ADR 0010 aneks): jedyną drogą powrotu do przerwanej gry jest automatyczne wczytanie zapisu (ADR 0045), a wyniki między grami żyją na wspólnym Drive (ADR 0026 aneks, ranking ADR 0039)',
  },
  {
    fraza: 'Kasuj historię',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'bez lokalnej historii nie ma czego kasować — dwustopniowe kasowanie (ADR 0015 pkt 6) zniknęło razem z kartą na setupie (ADR 0010 aneks)',
  },
  {
    fraza: 'okolica:historia',
    nosniki: [...DOKUMENTY, ...UI],
    powod: 'klucz localStorage lokalnej historii gier usunięty (ADR 0010 aneks) — telefon nie trzyma własnej listy gier',
  },
  // Fala 2026-09-14 (właściciel): mantra „M3–M12 czekają na 360 px / teren /
  // pierwsze wdrożenie mostu” jest nieaktualna. LESSONS L68.
  {
    fraza: 'Kamień czeka na',
    nosniki: DOKUMENTY,
    powod: 'kamienie M0–M12 są zamknięte jako zakres kodu — brak zlecenia = czekaj na uwagi z terenu (L68)',
  },
  {
    fraza: 'najwyższy nieukończony kamień',
    nosniki: DOKUMENTY,
    powod: 'AGENTS §2: bez zlecenia czekasz na uwagi z terenu, nie bierzesz M3 z ROADMAP (L68)',
  },
  {
    fraza: 'najwyższy otwarty kamień milowy',
    nosniki: DOKUMENTY,
    powod: 'WORKFLOW §1.6: brak zlecenia = czekaj, nie bierz kamienia (L68)',
  },
  {
    fraza: 'pełna konfiguracja bez przewijania na 360',
    nosniki: DOKUMENTY,
    powod: 'bramki 360 px na ROADMAP nie ma — właściciel gra na iPhonie (L68)',
  },
  {
    fraza: '≥ start-1 + 1-2',
    nosniki: UI,
    powod: 'fałszywa obietnica w komentarzu (do 2026-09-14): wolne TSP NIE realizuje nierówności właściciela — wejście wpina twardo kolejnoscTrasy (ADR 0005 aneks m12-116)',
  },
  {
    fraza: 'pin(y)',
    nosniki: UI,
    powod: 'komunikat bramy wejścia odmienia rzeczownik po polsku przez odmianaRzeczownika: 1 pin, 2 piny, 5 pinów (audyt D2, m12-119)',
  },
];

test('strażnik dryfu: martwe frazy nie wracają do nośników żywych', () => {
  assert.ok(MARTWE_FRAZY.length >= 15, 'lista martwych fraz nie może stopnieć');
  const trafienia = [];
  for (const { fraza, nosniki, powod } of MARTWE_FRAZY) {
    for (const nosnik of nosniki) {
      assert.ok(existsSync(join(ROOT, nosnik)), `nośnik ${nosnik} zniknął — popraw listę strażnika`);
      const tekst = czytaj(nosnik);
      const indeks = tekst.indexOf(fraza);
      if (indeks >= 0) {
        const wiersz = tekst.slice(0, indeks).split('\n').length;
        trafienia.push(`${nosnik}:${wiersz} — „${fraza}” (${powod})`);
      }
    }
  }
  assert.deepEqual(trafienia, [], 'nośniki żywe opisują rzeczy, których nie ma');
});

/** Wiersze drzewa katalogów w `docs/ARCHITECTURE.md` (sekcja „Struktura”). */
function wpisyDrzewa(dokument, katalog) {
  const linie = dokument.split('\n');
  const start = linie.indexOf(katalog);
  assert.ok(start >= 0, `ARCHITECTURE nie ma w drzewie katalogu ${katalog}`);
  const wpisy = [];
  for (let i = start + 1; i < linie.length; i += 1) {
    if (!linie[i].startsWith('  ')) break;
    const m = linie[i].match(/^ {2}([A-Za-z0-9._*-]+)\s+—/);
    if (m) wpisy.push(m[1]);
  }
  return wpisy;
}

test('strażnik dryfu: drzewo modułów w ARCHITECTURE to pliki, które istnieją', () => {
  const ARCH = czytaj('docs/ARCHITECTURE.md');
  const opisane = wpisyDrzewa(ARCH, 'app/');
  const naDysku = readdirSync(join(ROOT, 'app')).sort();

  assert.ok(opisane.length >= 15, `drzewo app/ wymienia ${opisane.length} wpisów`);
  for (const plik of naDysku) {
    assert.ok(opisane.includes(plik), `app/${plik} nie ma wpisu w drzewie ARCHITECTURE (LESSONS L31)`);
  }
  for (const plik of opisane) {
    assert.ok(existsSync(join(ROOT, 'app', plik)), `ARCHITECTURE opisuje app/${plik}, którego nie ma`);
  }
});

test('strażnik dryfu: eksporty app/wynik.js są wymienione w ARCHITECTURE', async () => {
  const modul = await import('../app/wynik.js');
  const ARCH = czytaj('docs/ARCHITECTURE.md');
  const nazwy = Object.keys(modul);
  assert.ok(nazwy.length >= 3, `wynik.js eksportuje ${nazwy.length} rzeczy`);
  for (const nazwa of nazwy) {
    assert.ok(ARCH.includes(nazwa), `ARCHITECTURE nie wymienia eksportu wynik.js: ${nazwa}`);
  }
});

test('strażnik dryfu: most nie ma sekretów ani bramki moderacyjnej', () => {
  const GS = czytaj(MOST);
  // ADR 0017 aneks 2026-09-11: koniec sesji przeglądu, więc koniec sekretów —
  // `REVIEW_SECRET` i `OWNER_EMAIL` nie mają czego podpisywać ani do kogo pisać.
  for (const fraza of ['REVIEW_SECRET', 'OWNER_EMAIL', 'PropertiesService', 'ScriptProperties']) {
    assert.equal(GS.includes(fraza), false, `most nie może mieć ${fraza} (ADR 0017 aneks 2026-09-11)`);
    for (const nosnik of UI) {
      assert.equal(czytaj(nosnik).includes(fraza), false, `${nosnik} nie może nieść ${fraza}`);
    }
  }
  // Ranking żyje w moście (ADR 0039) — cytowania „ADR 0019 aneks 2026-09-12f”
  // mają pokrycie w kodzie, nie tylko w dokumentach.
  assert.match(GS, /akcja === 'ranking'/, 'most wydaje rankingi (ADR 0039)');
  assert.match(GS, /okolica-paczki-zaakceptowane/, 'katalog zaakceptowanych jest w moście (ADR 0017)');
});

test('strażnik dryfu: cytowane aneksy ADR istnieją w plikach decyzji', () => {
  const katalog = join(ROOT, 'docs/decisions');
  const pliki = readdirSync(katalog).filter((f) => /^\d{4}-.*\.md$/.test(f));
  const testy = readdirSync(join(ROOT, 'test')).filter((f) => f.endsWith('.js')).map((f) => `test/${f}`);
  const nosniki = [...DOKUMENTY, ...UI, ...testy, MOST];
  const wzor = /ADR\s*(\d{4})\s*aneks\s*(\d{4}-\d{2}-\d{2}[a-z]?)/g;

  let sprawdzone = 0;
  for (const nosnik of nosniki) {
    const tekst = czytaj(nosnik);
    for (const m of tekst.matchAll(wzor)) {
      const [, numer, data] = m;
      const plik = pliki.find((f) => f.startsWith(numer));
      assert.ok(plik, `${nosnik} cytuje ADR ${numer}, którego nie ma w rejestrze`);
      const tresc = czytaj(join('docs/decisions', plik));
      const bezLitery = data.replace(/[a-z]+$/, '');
      assert.ok(
        tresc.includes(data) || tresc.includes(bezLitery),
        `${nosnik} cytuje „ADR ${numer} aneks ${data}”, a ADR ${numer} nie ma aneksu z tą datą`,
      );
      sprawdzone += 1;
    }
  }
  assert.ok(sprawdzone >= 5, `strażnik sprawdził ${sprawdzone} cytowań aneksów — za mało, żeby coś pilnować`);
});

test('strażnik D1 (m12-119): stan przebiegu wyboru żyje wyłącznie w zbudujUklad', () => {
  // Po wydzieleniu zbudujUklad (m12-118) w wybierzStacje zostały martwe
  // zewnętrzne deklaracje stanu (wybrane/zajete/katMin/szczebelKatowy);
  // każdy przebieg (także przeliczenia bramy wejścia) ma własny stan.
  const tekst = czytaj('app/stacje.js');
  for (const deklaracja of ['let wybrane = [];', 'let zajete = new Set();', 'let katMin = 0;', 'let szczebelKatowy = 0;']) {
    const ile = tekst.split(deklaracja).length - 1;
    assert.equal(ile, 1, `„${deklaracja}” ma istnieć dokładnie raz — wewnątrz zbudujUklad (jest ${ile})`);
  }
});
