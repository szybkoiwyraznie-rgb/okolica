/**
 * protokol.js — protokół PYT v1.0 w kodzie: szablon promptu, budowa promptu,
 * parsowanie odpowiedzi modelu i walidacja paczki pytań.
 *
 * Źródło prawdy: `docs/PROTOKOL.md`. Szablony promptu (§2 z fact-check
 * i §2.2 bez weryfikacji) są PRZEPISYWANE z tego dokumentu przez
 * `tools/synchronizuj-szablon.mjs` (`npm run build`) — nie edytuj ich tutaj.
 * Kanon tematów i kategorii wiekowych żyje w `app/konfig.js`
 * i jest porównywany z protokołem przez `test/kontrakt.test.js`.
 *
 * Moduł jest czysty: bez DOM, bez sieci, bez API Node (LESSONS L6). Daty
 * przyjmuje jako parametr (`teraz`), żeby testy były deterministyczne.
 */

import { TEMATY, WIEK, TRYBY, KLUCZE_POZIOMOW, POZIOMY, POZIOM_DORMYSLNY, kanonicznyTemat } from './konfig.js?v=m12-161';
import { czyWspolrzedneOk, formatujWspolrzedne, odlegloscM } from './geo.js?v=m12-161';

/** Wersja protokołu — musi zgadzać się z `docs/PROTOKOL.md` i ze stopką aplikacji. */
export const WERSJA_PROTOKOLU = 'PYT/1.3';

/**
 * Wersje historyczne (REV1..REV5) i cała ich obsługa zostały USUNIĘTE
 * 2026-09-15e (ADR 0050). Powód właściciela: „to tylko obciążenie dla AI” —
 * model nie pisze żadnego markera, bo o profilu źródeł wie aplikacja
 * z ptaszka w setupie, a nie z pola w JSON-ie. Kod czyta JEDNĄ postać paczki.
 */

/** Wersja łatki szablonu promptu (kosmetyka szablonu bez zmiany schematu). */
export const SZABLON_WERSJA = 'PYT/1.3.1'; // 1.3.1: krótki prompt — zestawienie pod stacjami, bez imion i daty, bez źródeł (ADR 0057/0058); 1.2.1: sekcja GRACZE — POZIOMY PYTAŃ (ADR 0055); 1.1.2: „tę samą liczbę pytań" (gramatyka)

/** Wersja szablonu bez weryfikacji (§2.2) — wersjonowana niezależnie od §2. */
export const SZABLON_WERSJA_BEZ_WERYFIKACJI = 'PYT/1.3-nofc.1'; // jak 1.3.1 — te same zdania w wariancie bez weryfikacji

/**
 * Ukrytego kontenera `TO-paczka/2` NIE MA (właściciel 2026-09-15, ADR 0050):
 * paczka jedzie przez telefon i na Drive jawnym JSON-em, a plik `app/kodowanie.js`
 * został usunięty. Wszystko, co czytało `skrot` kontenera, liczy odtąd
 * `skrotPaczki()` z `app/zestawy.js` — odcisk treści paczki, nie obfuskacja.
 */

/* SZABLON-START
 * Treść generowana z docs/PROTOKOL.md §2 przez tools/synchronizuj-szablon.mjs.
 * NIE EDYTUJ RĘCZNIE — zmień dokument i uruchom `npm run build`.
 */
export const SZABLON_PROMPTU = "Jesteś autorem pytań do terenowej gry quizowej „Tajemnicza Okolica\". Gracze idą od stacji do stacji w okolicy opisanej niżej i przy każdej stacji dostają pytania z wybranych dziedzin.\n\nZASADY TWARDE (naruszenie którejkolwiek unieważnia odpowiedź):\n1. ZANIM napiszesz jakikolwiek fakt, wykonaj kwerendę w internecie (wyszukiwarka albo przeglądanie stron) dla KAŻDEJ informacji użytej w pytaniu, w odpowiedziach i w wyjaśnieniu, i oprzyj ten fakt na wyniku kwerendy.\n2. Nazwy, daty, liczby, cytaty i autorów podawaj dokładnie w postaci potwierdzonej kwerendą. Jeśli w jakimś temacie brakuje potwierdzonych faktów, zrób mniej pytań w tym temacie i opisz brak w polu \"uwagi\".\n3. Kotwicz pytanie możliwie blisko okolicy: stacja albo punkt trasy → ulica → dzielnica → miejscowość → powiat → województwo → kraj → kontynent → świat. Schodź na najniższy poziom, na którym masz sensowny potwierdzony fakt. Gdy temat nie ma lokalnego zaczepienia (dotyczy zwłaszcza tematu własnego i dziedzin ogólnych), pytanie z wiedzy ogólnej jest w porządku — lepsze niż naciągana kotwica.\n4. Trudność KAŻDEGO pytania dostosuj ściśle do POZIOMU pytania i do wymagań trudności poziomów podanych niżej; liczba pytań każdego poziomu przy każdej stacji musi się zgadzać z zestawieniem podanym pod stacją.\n5. Cała odpowiedź to jeden blok kodu json ze schematem podanym niżej.\n6. Formułuj treść pytania tak, żeby odpowiedź nie zawierała się w pytaniu.\nOKOLICA GRY:\n- środek gry (szerokość geograficzna, długość geograficzna): {LAT}, {LON}\n- miejsce: {MIEJSCE}\n- promień gry: {PROMIEN_M} m\n- sposób poruszania się: {TRYB}\n\nSTACJE (kolejność = kolejność w grze; każde pytanie przypisz do jednej stacji; przy każdej stacji DOKŁADNIE tyle pytań każdego poziomu, ile podano pod stacją):\n{LISTA_STACJI}\n\n{POZIOMY_BLOK}\n- tematy pytań (wyłącznie z tej listy): {TEMATY}\n- liczba pytań łącznie: {LICZBA_PYTAN}\n- język pytań: {JEZYK}\n\nSCHEMAT ODPOWIEDZI — dokładnie te pola:\n{\n  \"okolica\": { \"lat\": {LAT}, \"lon\": {LON}, \"promienM\": {PROMIEN_M}, \"miejsce\": \"{MIEJSCE}\" },\n  \"tematy\": [{TEMATY_JSON}],\n  \"jezyk\": \"{JEZYK}\",\n  \"pytania\": [\n    {\n      \"id\": \"s1p1\",\n      \"stacja\": 1,\n      \"poziom\": \"dzieci\",\n      \"temat\": \"historia\",\n      \"tresc\": \"Treść pytania zakończona znakiem zapytania?\",\n      \"odpowiedzi\": [\"pierwsza\", \"druga\", \"trzecia\", \"czwarta\"],\n      \"poprawna\": 2,\n      \"wyjasnienie\": \"Dwa albo trzy zdania: dlaczego ta odpowiedź jest poprawna i co z tego wynika dla okolicy.\"\n    }\n  ],\n  \"uwagi\": \"\"\n}\n\nWYMAGANIA DODATKOWE:\n- \"id\": \"s<numer stacji>p<kolejny numer>\", na przykład \"s2p1\"; identyfikatory unikalne w całej paczce.\n- \"stacja\": numer stacji z listy powyżej, od 1 do {LICZBA_STACJI}; KAŻDA stacja ma co najmniej jedno pytanie, wszystkie stacje mają tę samą liczbę pytań.\n- \"odpowiedzi\": dokładnie 4, każda od 1 do 8 słów; cztery różne, samodzielne odpowiedzi; dokładnie jedna poprawna; pozycja poprawnej odpowiedzi różna między pytaniami.\n- \"poprawna\": numer poprawnej odpowiedzi od 1 do 4 (1 = pierwsza odpowiedź na liście \"odpowiedzi\").\n- \"temat\": jedna wartość z listy tematów podanej wyżej, małymi literami, z myślnikami.\n- \"poziom\": dokładnie \"dzieci\" albo \"dorosli\" — poziom trudności pytania zgodny z zestawieniem podanym przy stacji. Pytanie bez tego pola unieważnia całą paczkę.\n- \"wyjasnienie\": dwa albo trzy zdania o tym, dlaczego ta odpowiedź jest poprawna i co z tego wynika dla okolicy.\n- \"uwagi\": tematy pominięte i powód pominięcia; pusty tekst, gdy wszystkie fakty są potwierdzone.";
/* SZABLON-KONIEC */

/* SZABLON-BEZ-START
 * Treść generowana z docs/PROTOKOL.md §2.2 przez tools/synchronizuj-szablon.mjs.
 * NIE EDYTUJ RĘCZNIE — zmień dokument i uruchom `npm run build`.
 */
export const SZABLON_PROMPTU_BEZ_WERYFIKACJI = "Jesteś autorem pytań do terenowej gry quizowej „Tajemnicza Okolica\". Gracze idą od stacji do stacji w okolicy opisanej niżej i przy każdej stacji dostają pytania z wybranych dziedzin.\n\nZASADY TWARDE (naruszenie którejkolwiek unieważnia odpowiedź):\n1. Podawaj wyłącznie fakty, których jesteś pewien. Sposób ich ustalenia zostawiamy Tobie. Przy braku pewności upraszczaj pytanie, a pominięte tematy opisuj w polu \"uwagi\".\n2. Nazwy, daty, liczby, cytaty i autorów podawaj w postaci, której jesteś pewien; przy braku takiej pewności wybierz łatwiejszy fakt z tego samego tematu. Jeśli w jakimś temacie brakuje pewnych faktów, zrób mniej pytań w tym temacie i opisz brak w polu \"uwagi\".\n3. Kotwicz pytanie możliwie blisko okolicy: stacja albo punkt trasy → ulica → dzielnica → miejscowość → powiat → województwo → kraj → kontynent → świat. Schodź na najniższy poziom, na którym masz sensowny pewny fakt. Gdy temat nie ma lokalnego zaczepienia (dotyczy zwłaszcza tematu własnego i dziedzin ogólnych), pytanie z wiedzy ogólnej jest w porządku — lepsze niż naciągana kotwica.\n4. Trudność KAŻDEGO pytania dostosuj ściśle do POZIOMU pytania i do wymagań trudności poziomów podanych niżej; liczba pytań każdego poziomu przy każdej stacji musi się zgadzać z zestawieniem podanym pod stacją.\n5. Cała odpowiedź to jeden blok kodu json ze schematem podanym niżej.\n6. Formułuj treść pytania tak, żeby odpowiedź nie zawierała się w pytaniu.\nOKOLICA GRY:\n- środek gry (szerokość geograficzna, długość geograficzna): {LAT}, {LON}\n- miejsce: {MIEJSCE}\n- promień gry: {PROMIEN_M} m\n- sposób poruszania się: {TRYB}\n\nSTACJE (kolejność = kolejność w grze; każde pytanie przypisz do jednej stacji; przy każdej stacji DOKŁADNIE tyle pytań każdego poziomu, ile podano pod stacją):\n{LISTA_STACJI}\n\n{POZIOMY_BLOK}\n- tematy pytań (wyłącznie z tej listy): {TEMATY}\n- liczba pytań łącznie: {LICZBA_PYTAN}\n- język pytań: {JEZYK}\n\nSCHEMAT ODPOWIEDZI — dokładnie te pola:\n{\n  \"okolica\": { \"lat\": {LAT}, \"lon\": {LON}, \"promienM\": {PROMIEN_M}, \"miejsce\": \"{MIEJSCE}\" },\n  \"tematy\": [{TEMATY_JSON}],\n  \"jezyk\": \"{JEZYK}\",\n  \"pytania\": [\n    {\n      \"id\": \"s1p1\",\n      \"stacja\": 1,\n      \"poziom\": \"dzieci\",\n      \"temat\": \"historia\",\n      \"tresc\": \"Treść pytania zakończona znakiem zapytania?\",\n      \"odpowiedzi\": [\"pierwsza\", \"druga\", \"trzecia\", \"czwarta\"],\n      \"poprawna\": 2,\n      \"wyjasnienie\": \"Dwa albo trzy zdania: dlaczego ta odpowiedź jest poprawna i co z tego wynika dla okolicy.\"\n    }\n  ],\n  \"uwagi\": \"\"\n}\n\nWYMAGANIA DODATKOWE:\n- \"id\": \"s<numer stacji>p<kolejny numer>\", na przykład \"s2p1\"; identyfikatory unikalne w całej paczce.\n- \"stacja\": numer stacji z listy powyżej, od 1 do {LICZBA_STACJI}; KAŻDA stacja ma co najmniej jedno pytanie, wszystkie stacje mają tę samą liczbę pytań.\n- \"odpowiedzi\": dokładnie 4, każda od 1 do 8 słów; cztery różne, samodzielne odpowiedzi; dokładnie jedna poprawna; pozycja poprawnej odpowiedzi różna między pytaniami.\n- \"poprawna\": numer poprawnej odpowiedzi od 1 do 4 (1 = pierwsza odpowiedź na liście \"odpowiedzi\").\n- \"temat\": jedna wartość z listy tematów podanej wyżej, małymi literami, z myślnikami.\n- \"poziom\": dokładnie \"dzieci\" albo \"dorosli\" — poziom trudności pytania zgodny z zestawieniem podanym przy stacji. Pytanie bez tego pola unieważnia całą paczkę.\n- \"wyjasnienie\": dwa albo trzy zdania o tym, dlaczego ta odpowiedź jest poprawna i co z tego wynika dla okolicy.\n- \"uwagi\": tematy pominięte i powód pominięcia; pusty tekst, gdy wszystkie fakty są pewne.";
/* SZABLON-BEZ-KONIEC */

/**
 * Zgłoszenie właściciela 2026-09-09: heurystyka zakotwiczenia (kod `E14`)
 * została USUNIĘTA razem z listami słów, które ją zasilały (`TOKENY_MIEJSCA`,
 * `SLOWA_POSPOLITE`, `WYRAZY_POSPOLITE_MIEJSCA`, `SKROTY_Z_KROPKA`).
 *
 * Powód: „przy niektórych kategoriach (szczególnie tych custom) nigdy nie
 * będzie nawiązania do miejsca i będą pytania z wiedzy ogólnej. To jak
 * najbardziej dopuszczalne i pożądane". Walidator odrzucał więc paczki, które
 * są poprawne — a fałszywe odrzucenie kosztuje organizatora całą rundę z
 * modelem. Zakotwiczenie zostaje PROŚBĄ w prompcie (§2 i §2.2 zasada 4), nie
 * bramką: model ma schodzić na najniższy poziom, na którym ma fakt, ale pytanie
 * ogólne przechodzi.
 */

/** Normalizacja do porównań: małe litery, bez interpunkcji, pojedyncze spacje. */
export function normalizujTekst(tekst) {
  return String(tekst ?? '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** `RRRR-MM-DD GG:MM` — format daty w paczce (protokół §3.1). */
export function formatujDate(data) {
  const p = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())} ${p(data.getHours())}:${p(data.getMinutes())}`;
}

/** `RRRR-MM-DD` — format daty krótkiej (`sprawdzono`). */
export function formatujDateKrotka(data) {
  const p = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

const WZOR_ID = /^s[0-9]+p[0-9]+$/;

/** Linia z zestawieniem pytań poziomów pod stacją (ADR 0057, właściciel
 * 2026-09-17e): „2 pytania dla dorosłych, 1 pytanie dla dzieci". */
export function liniaZestawieniaPytan(zestawienie) {
  const czesci = [];
  if (zestawienie?.dorosli) czesci.push(`${zestawienie.dorosli} ${formaPytan(zestawienie.dorosli)} dla dorosłych`);
  if (zestawienie?.dzieci) czesci.push(`${zestawienie.dzieci} ${formaPytan(zestawienie.dzieci)} dla dzieci`);
  return czesci.join(', ');
}

/** Linie listy stacji do placeholdera `{LISTA_STACJI}` (ADR 0057: pod KAŻDĄ
 * stacją linia z zestawieniem pytań poziomów — właściciel: „krócej i prościej,
 * bez opowiadania, jak kto ma odpowiadać"). */
export function opisListyStacji(stacje, srodek, { liniaPoziomow = '' } = {}) {
  return stacje
    .map((s, i) => {
      const [lat, lon] = formatujWspolrzedne(s.lat, s.lon).split(', ');
      const dystans = srodek ? Math.round(odlegloscM(srodek, s)) : null;
      const opis = s.opis && s.opis.trim() ? s.opis.trim() : 'punkt w terenie (bez nazwy)';
      const linia = `- stacja ${i + 1}: ${lat}, ${lon} — ${opis}${dystans != null ? ` (${dystans} m od środka gry)` : ''}`;
      return liniaPoziomow ? `${linia}
${liniaPoziomow}` : linia;
    })
    .join('\n');
}

/** Etykieta poziomu w tekście promptu (wielkie litery — to jest nakaz). */
function etykietaPoziomuWskazowki(poziom) {
  return POZIOMY[poziom] ? String(POZIOMY[poziom].etykieta).toUpperCase() : String(poziom).toUpperCase();
}

/**
 * Zestawienie pytań poziomów przy KAŻDEJ stacji (ADR 0055): liczba graczy per
 * poziom → „DOKŁADNIE 1× POZIOM DZIECKO + DOKŁADNIE 2× POZIOM DOROŚLI”.
 * Multi (gracze nieznani w chwili generowania): stałe `1 + 1`.
 */
/* ADR 0055 (właściciel, 2026-09-17): w multi (trasa/wyścig) NIE ma różnicowania
 * poziomów — jeden poziom hosta dla całej gry, jedno wspólne pytanie na stację.
 * `multiPoziom` jest podawany tylko dla multi; hot-seat liczy z listy graczy. */
export function zestawieniePytanZGraczy(gracze, { multi = false, multiPoziom = POZIOM_DORMYSLNY } = {}) {
  const liczby = { dzieci: 0, dorosli: 0 };
  if (multi) {
    liczby[KLUCZE_POZIOMOW.includes(multiPoziom) ? multiPoziom : POZIOM_DORMYSLNY] = 1;
  } else {
    for (const g of Array.isArray(gracze) ? gracze : []) {
      const poziom = KLUCZE_POZIOMOW.includes(g?.poziom) ? g.poziom : POZIOM_DORMYSLNY;
      liczby[poziom] += 1;
    }
  }
  return liczby;
}

/** "pytanie/pytania/pytań" zgodnie z polszczyzną (1 → pytanie, 2–4 →
 * pytania, reszta włącznie z 0 i 12–14 → pytań). */
function formaPytan(n) {
  const m = Number(n) || 0;
  if (m === 1) return 'pytanie';
  const ostatnia = m % 10;
  const dwieOstatnie = m % 100;
  if (ostatnia >= 2 && ostatnia <= 4 && !(dwieOstatnie >= 12 && dwieOstatnie <= 14)) return 'pytania';
  return 'pytań';
}

/**
 * Blok `{POZIOMY_BLOK}` (ADR 0057, właściciel 2026-09-17e): wymagania
 * trudności poziomów obecnych w grze. BEZ imion graczy i bez opisu kolejności
 * odpowiadania — to sprawa gry, nie modelu piszącego pytania; zestawienie
 * pytań na stację jest podane pod każdą stacją w `{LISTA_STACJI}`.
 */
export function blokPoziomow(gracze, { multi = false, multiPoziom = POZIOM_DORMYSLNY } = {}) {
  const liczby = zestawieniePytanZGraczy(gracze, { multi, multiPoziom });
  const linie = [];
  if (multi) {
    // ADR 0055 (właściciel, 2026-09-17): w multi JEDEN poziom (wybór hosta) —
    // wszystkie pytania tej gry mają ten poziom i są WSPÓLNE dla graczy.
    const poziomGry = KLUCZE_POZIOMOW.includes(multiPoziom) ? multiPoziom : POZIOM_DORMYSLNY;
    linie.push(`- POZIOM WSZYSTKICH PYTAŃ W TEJ GRZE (wybór organizatora): ${etykietaPoziomuWskazowki(poziomGry)} — wszystkie pytania mają wyłącznie ten poziom.`);
  }
  for (const poziom of KLUCZE_POZIOMOW) {
    if (liczby[poziom] > 0) {
      linie.push(`- WYMAGANIA POZIOMU ${etykietaPoziomuWskazowki(poziom)}: ${POZIOMY[poziom].opisTrudnosci}`);
    }
  }
  return linie.join('\n');
}

/**
 * Buduje prompt z szablonu §2 protokołu. Zwraca `{ prompt, usterki }` —
 * usterki (kody WE**, prefiks własny domeny wejścia promptu — ADR 0015 pkt 6)
 * pojawiają się, gdy brakuje danych wejściowych; prompt jest wtedy `null`,
 * żeby nie wysłać modelowi dziurawego zadania.
 *
 * ADR 0055 (decyzja właściciela 2026-09-17): `rodzajGry: 'multi'` +
 * `multiPoziom` — multi to JEDEN poziom organizatora, jedno wspólne pytanie
 * na stację. ADR 0057 (właściciel, 2026-09-17e): prompt krótki — pod każdą
 * stacją zestawienie pytań poziomów, blok poziomów bez imion i bez opisu
 * kolejności odpowiadania, bez daty.
 */
export function zbudujPrompt({ konfig, okolica, stacje, teraz = new Date(), factcheck = false, rodzajGry = 'hotseat', multiPoziom = POZIOM_DORMYSLNY } = {}) {
  const usterki = [];
  const dodaj = (kod, pole, komunikat) => usterki.push({ kod, pole, komunikat });

  if (!konfig) dodaj('WE01', 'konfig', 'Brak konfiguracji — najpierw ekran ustawień.');
  if (!okolica || !czyWspolrzedneOk(okolica?.lat, okolica?.lon)) {
    dodaj('WE02', 'okolica', 'Brak poprawnej pozycji (współrzędnych) — bez niej prompt nie ma okolicy.');
  }
  if (!Array.isArray(stacje) || stacje.length === 0) {
    dodaj('WE03', 'stacje', 'Brak stacji — ustaw je (albo użyj trybu uproszczonego), zanim poprosisz model o pytania.');
  }
  if (konfig && !TRYBY[konfig.tryb]) dodaj('WE04', 'tryb', `Nieznany tryb „${konfig.tryb}".`);
  // WE05 od ADR 0055: w hot-seacie każdy gracz musi nieść WALIDNY poziom
  // (globalnego `wiek` nie ma). Stary schemat `konfig.imiona` (string[]) jest
  // migrowany: każdy gracz dostaje poziom domyślny.
  const graczeZKonfigu = Array.isArray(konfig?.gracze) && konfig.gracze.length
    ? konfig.gracze
    : (konfig && Array.isArray(konfig.imiona) ? konfig.imiona.map((imie) => ({ imie, poziom: POZIOM_DORMYSLNY })) : []);
  if (konfig && rodzajGry !== 'multi' && graczeZKonfigu.length === 0) {
    dodaj('WE05', 'gracze', 'Brak graczy — dodaj graczy w bloku „Kto gra?” (imię, PIN i poziom przy imieniu).');
  }
  if (konfig && rodzajGry !== 'multi') {
    graczeZKonfigu.forEach((g, i) => {
      if (!KLUCZE_POZIOMOW.includes(g?.poziom)) dodaj('WE05', `gracze[${i}].poziom`, `Nieznany poziom trudności gracza ${i + 1} („${g?.poziom}”).`);
    });
  }
  if (konfig && stacje && stacje.length !== konfig.liczbaStacji) {
    dodaj('WE06', 'liczbaStacji', `Liczba stacji (${stacje.length}) nie zgadza się z konfiguracją (${konfig.liczbaStacji}).`);
  }
  if (usterki.length) return { prompt: null, usterki };

  const multi = rodzajGry === 'multi';
  const tematyLista = konfig.tematy.filter((t) => TEMATY[t]);
  // ADR 0055: multi = JEDNO wspólne pytanie na stację (poziom hosta);
  // hot-seat = po jednym pytaniu na gracza (poziom gracza z listy).
  const pytaniaNaStacje = multi
    ? Object.values(zestawieniePytanZGraczy([], { multi: true, multiPoziom })).reduce((a, b) => a + b, 0)
    : graczeZKonfigu.length;
  const podstawienia = {
    LAT: okolica.lat.toFixed(5),
    LON: okolica.lon.toFixed(5),
    MIEJSCE: okolica.miejsce && okolica.miejsce.trim() ? okolica.miejsce.trim() : 'brak odczytu (tylko współrzędne)',
    PROMIEN_M: String(Math.round(konfig.promienM)),
    TRYB: TRYBY[konfig.tryb].etykieta,
    // ADR 0057: pod każdą stacją zestawienie pytań poziomów (właściciel:
    // „krócej i prościej”); hot-seat z listy graczy, multi = poziom hosta.
    LISTA_STACJI: opisListyStacji(stacje, okolica, {
      liniaPoziomow: liniaZestawieniaPytan(zestawieniePytanZGraczy(graczeZKonfigu, { multi, multiPoziom })),
    }),
    LICZBA_STACJI: String(stacje.length),
    POZIOMY_BLOK: blokPoziomow(graczeZKonfigu, { multi, multiPoziom }),
    TEMATY: tematyLista.map((t) => (t === 'wlasny' && konfig.tematWlasny ? `wlasny (${konfig.tematWlasny.trim().slice(0, 40)})` : `${t} (${TEMATY[t].opis})`)).join(', '),
    TEMATY_JSON: tematyLista.map((t) => JSON.stringify(t)).join(', '),
    LICZBA_PYTAN: String(stacje.length * pytaniaNaStacje),
    JEZYK: konfig.jezyk,
  };

  // Domyślnie wariant bez weryfikacji (ADR 0032): szybszy, bez wymuszonej kwerendy.
  let prompt = factcheck ? SZABLON_PROMPTU : SZABLON_PROMPTU_BEZ_WERYFIKACJI;
  for (const [token, wartosc] of Object.entries(podstawienia)) {
    prompt = prompt.split(`{${token}}`).join(wartosc);
  }
  const resztki = [...prompt.matchAll(/\{[A-Z_]+\}/g)].map((m) => m[0]);
  if (resztki.length) {
    dodaj('WE07', 'szablon', `W szablonie zostały niepodstawione placeholdery: ${[...new Set(resztki)].join(', ')}. Uruchom \`npm run build\`.`);
    return { prompt: null, usterki };
  }
  return { prompt, usterki };
}

/**
 * Wyciąga JSON z odpowiedzi modelu: blok ```json …```, blok ``` …``` albo
 * surowy JSON z tekstem wokół (parser tolerancyjny, walidator nie — ADR 0006
 * pkt 4). Zwraca `{ paczka, blad }`.
 */
export function parsujOdpowiedzModela(tekst) {
  const zrodlo = String(tekst ?? '').trim();
  if (!zrodlo) return { paczka: null, blad: { kod: 'E02', pole: 'json', komunikat: 'Puste pole wklejenia — wklej odpowiedź modelu (blok JSON).' } };

  const bloki = [...zrodlo.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)].map((m) => m[1].trim());
  if (bloki.length > 1) {
    return { paczka: null, blad: { kod: 'E02', pole: 'json', komunikat: `Odpowiedź zawiera ${bloki.length} bloki kodu — poproś model o JEDEN blok JSON (napisz modelowi, czego brakuje, i poproś o cały blok jeszcze raz).` } };
  }
  const kandydaci = bloki.length ? [bloki[0]] : [zrodlo];
  if (!bloki.length) {
    const poczatek = zrodlo.indexOf('{');
    const koniec = zrodlo.lastIndexOf('}');
    if (poczatek >= 0 && koniec > poczatek) kandydaci.push(zrodlo.slice(poczatek, koniec + 1));
  }
  for (const kandydat of kandydaci) {
    try {
      const dane = JSON.parse(kandydat);
      if (dane && typeof dane === 'object') return { paczka: dane, blad: null };
    } catch (e) {
      void e;
    }
  }
  return { paczka: null, blad: { kod: 'E02', pole: 'json', komunikat: 'Nie udało się odczytać JSON-a z odpowiedzi. Poproś model o sam blok JSON, bez komentarzy (poproś model o sam blok JSON jeszcze raz).' } };
}

function czyLiczbaCalkowita(v) {
  return Number.isInteger(v);
}

/**
 * Mapuje tematy paczki na klucze kanoniczne (aliasy historyczne → nowe klucze).
 * Wołane raz, przy przyjęciu paczki — w dół (kontener, zestaw, dopasowanie)
 * płynie już jeden słownik.
 */
/** Warianty poziomu, które model bywa w stanie napisać, → kanon (ADR 0055). */
const ALIASY_POZIOMOW = {
  dziecko: 'dzieci',
  children: 'dzieci',
  child: 'dzieci',
  dziesciec: null,
  '8-10': 'dzieci',
  '8–10': 'dzieci',
  dorosly: 'dorosli',
  dorosły: 'dorosli',
  adult: 'dorosli',
  adults: 'dorosli',
};

function normalizujPoziom(p) {
  if (typeof p !== 'string') return null;
  const c = p.trim().toLowerCase();
  if (KLUCZE_POZIOMOW.includes(c)) return c;
  return ALIASY_POZIOMOW[c] ?? null;
}

export function normalizujTematyPaczki(paczka) {
  if (Array.isArray(paczka.tematy)) paczka.tematy = [...new Set(paczka.tematy.map(kanonicznyTemat))];
  if (Array.isArray(paczka.pytania)) {
    for (const p of paczka.pytania) {
      if (typeof p.temat === 'string') p.temat = kanonicznyTemat(p.temat);
      // ADR 0055: poziom pytania normalizujemy JEDNORAZOWO przy przyjęciu —
      // w dół (rozgrywka, zapis, most) płynie kanon `dzieci`/`dorosli`.
      if (p && typeof p === 'object' && 'poziom' in p) {
        const poziom = normalizujPoziom(p.poziom);
        if (poziom) p.poziom = poziom;
      }
    }
  }
  return paczka;
}

/**
 * Walidacja paczki pytań wg protokołu §3 i §6. Zwraca listę usterek
 * `{ kod, pole, komunikat }`; pusta lista = paczka do przyjęcia.
 * `oczekiwane`: `{ liczbaStacji, liczbaPytan, poziomyPytan, tematy, promienM, lat, lon, jezyk, teraz, stacje }`
 * — `poziomyPytan` (ADR 0055): `{ dzieci, dorosli }` = ile pytań danego poziomu
 * ma być przy KAŻDEJ stacji (z listy graczy); bez niego E21/E22 są wyłączone
 * (stare paczki bez `poziomu` przechodzą).
 */
/**
 * Uwaga o historii zapisu (2026-09-15e, ADR 0050): ten plik miał kiedyś trzy
 * dekodery — odwracanie znaków (`rev1`), kod pozycyjny numeru poprawnej
 * odpowiedzi (`rev2`/`rev3`) i normalizację markerów (`rev4`/`rev5`). Wszystkie
 * zostały usunięte razem z wariantami: paczka ma jedną postać, a numer poprawnej
 * odpowiedzi jest tym numerem, który widzi człowiek i model (`1..4`).
 */

export function walidujPaczke(paczka, oczekiwane = {}) {
  const u = [];
  const dodaj = (kod, pole, komunikat) => u.push({ kod, pole, komunikat });
  const teraz = oczekiwane.teraz instanceof Date ? oczekiwane.teraz : new Date();

  if (!paczka || typeof paczka !== 'object' || Array.isArray(paczka)) {
    dodaj('E15', 'paczka', 'Wklejona odpowiedź nie jest obiektem JSON ze schematem PYT.');
    return u;
  }

  // --- nagłówek paczki ---
  // Pola `protokol` NIE ma: marker zniknął z paczki (ADR 0050), a gdyby model je
  // mimo wszystko dopisał (stary nawyk), jest ignorowane — walidacja go nie
  // dotyczy. Profil sprawdzania (fact-check) decyduje ptaszek w setupie —
  // aplikacja wie, który prompt wysłała; paczka go nie niesie (ADR 0058).

  const okolica = paczka.okolica;
  if (!okolica || typeof okolica !== 'object') {
    dodaj('E15', 'okolica', 'Brak obiektu "okolica" z lat, lon, promienM i miejsce.');
  } else {
    if (!czyWspolrzedneOk(okolica.lat, okolica.lon)) {
      dodaj('E17', 'okolica', `Współrzędne poza zakresem: lat=${okolica.lat}, lon=${okolica.lon}.`);
    }
    if (!Number.isFinite(okolica.promienM) || okolica.promienM < 100 || okolica.promienM > 50000) {
      dodaj('E15', 'okolica.promienM', 'Promień musi być liczbą metrów od 100 do 50000.');
    }
    if (typeof okolica.miejsce !== 'string' || !okolica.miejsce.trim()) {
      dodaj('E15', 'okolica.miejsce', 'Pole "miejsce" nie może być puste (albo wpisz wprost, że odczytu nie było).');
    }
    if (Number.isFinite(oczekiwane.promienM) && Number.isFinite(okolica.promienM) && okolica.promienM !== oczekiwane.promienM) {
      dodaj('E16', 'okolica.promienM', `Promień w paczce (${okolica.promienM} m) nie zgadza się z konfiguracją gry (${oczekiwane.promienM} m).`);
    }
    if (czyWspolrzedneOk(okolica.lat, okolica.lon) && czyWspolrzedneOk(oczekiwane.lat, oczekiwane.lon)) {
      const dystans = odlegloscM({ lat: okolica.lat, lon: okolica.lon }, { lat: oczekiwane.lat, lon: oczekiwane.lon });
      if (dystans > 500) {
        dodaj('E16', 'okolica', `Środek paczki jest ${Math.round(dystans)} m od środka gry — to pytania o inną okolicę.`);
      }
    }
  }

  // ADR 0055: globalnego `paczka.wiek` NIE walidujemy — pole jest wycofane
  // (PYT/1.2), stare paczki je niosą, nowe nie. Trudność pilnuje `poziom`
  // pytania + per-stacyjne zestawienie (E21/E22 niżej).

  if (!Array.isArray(paczka.tematy) || paczka.tematy.length === 0) dodaj('E15', 'tematy', 'Brak listy tematów albo lista jest pusta.');
  else {
    paczka.tematy.forEach((t, i) => {
      if (!TEMATY[kanonicznyTemat(t)]) dodaj('E12', `tematy[${i}]`, `Temat "${t}" nie należy do kanonu (PROTOKOL §5).`);
    });
    if (new Set(paczka.tematy).size !== paczka.tematy.length) dodaj('E15', 'tematy', 'Tematy powtarzają się na liście.');
    if (Array.isArray(oczekiwane.tematy) && oczekiwane.tematy.length) {
      const spodz = oczekiwane.tematy.map(kanonicznyTemat);
      const sa = paczka.tematy.map(kanonicznyTemat);
      const brak = oczekiwane.tematy.filter((t) => !sa.includes(kanonicznyTemat(t)));
      const nadmiar = paczka.tematy.filter((t) => !spodz.includes(kanonicznyTemat(t)));
      if (brak.length || nadmiar.length) {
        dodaj('E16', 'tematy', `Tematy paczki nie pokrywają się z konfiguracją (brak: ${brak.join(', ') || '—'}; nadmiar: ${nadmiar.join(', ') || '—'}).`);
      }
    }
  }

  if (typeof paczka.jezyk !== 'string' || !paczka.jezyk.trim()) dodaj('E15', 'jezyk', 'Brak pola "jezyk".');
  else if (oczekiwane.jezyk && paczka.jezyk !== oczekiwane.jezyk) dodaj('E16', 'jezyk', `Język paczki (${paczka.jezyk}) nie zgadza się z konfiguracją (${oczekiwane.jezyk}).`);

  // ADR 0058 (PYT/1.3): `utworzono` wycofane — daty nie ma w prompcie, więc
  // pola model nie wypełni; aplikacja generuje datę paczki sama. Stare
  // paczki z polem są czytane, pole jest ignorowane (E11 wycofany).

  if (typeof paczka.uwagi !== 'string') dodaj('E15', 'uwagi', 'Pole "uwagi" musi istnieć (może być pustym tekstem) — tam model opisuje pominięte tematy i powody.');

  // --- pytania ---
  if (!Array.isArray(paczka.pytania) || paczka.pytania.length === 0) {
    dodaj('E15', 'pytania', 'Brak listy pytań albo lista jest pusta.');
    return u;
  }

  const liczbaStacji = oczekiwane.liczbaStacji ?? null;
  if (Number.isFinite(oczekiwane.liczbaPytan) && paczka.pytania.length !== oczekiwane.liczbaPytan) {
    dodaj('E03', 'pytania', `Liczba pytań (${paczka.pytania.length}) nie zgadza się z oczekiwaną (${oczekiwane.liczbaPytan}).`);
  }

  const widoczneTresci = new Map();
  const widoczneId = new Set();
  const pytaniaNaStacje = new Map();
  // ADR 0055: per-stacyjne zestawienie poziomów (E22) — tylko gdy oczekiwane
  // niesie `poziomyPytan` (stare ścieżki walidacji bez oczekiwanych poziomów
  // nie dostają E21/E22: paczka sprzed PYT/1.2 nie ma pól do sprawdzenia).
  const poziomyPytanOczekiwane = oczekiwane.poziomyPytan
    && typeof oczekiwane.poziomyPytan === 'object'
    && Number.isInteger(oczekiwane.poziomyPytan.dzieci) && oczekiwane.poziomyPytan.dzieci >= 0
    && Number.isInteger(oczekiwane.poziomyPytan.dorosli) && oczekiwane.poziomyPytan.dorosli >= 0
    ? { dzieci: oczekiwane.poziomyPytan.dzieci, dorosli: oczekiwane.poziomyPytan.dorosli }
    : null;
  const poziomyNaStacji = {};

  paczka.pytania.forEach((p, i) => {
    const pole = `pytania[${i}]`;
    if (!p || typeof p !== 'object') {
      dodaj('E15', pole, 'Pozycja nie jest obiektem pytania.');
      return;
    }
    if (typeof p.id !== 'string' || !WZOR_ID.test(p.id)) dodaj('E19', `${pole}.id`, `Identyfikator "${p.id}" nie pasuje do wzorca "s<stacja>p<numer>" (np. s2p1).`);
    else if (widoczneId.has(p.id)) dodaj('E19', `${pole}.id`, `Identyfikator "${p.id}" powtarza się w paczce.`);
    else widoczneId.add(p.id);

    if (!czyLiczbaCalkowita(p.stacja)) dodaj('E04', `${pole}.stacja`, 'Pole "stacja" musi być liczbą całkowitą.');
    else if (Number.isFinite(liczbaStacji) && (p.stacja < 1 || p.stacja > liczbaStacji)) {
      dodaj('E04', `${pole}.stacja`, `Stacja ${p.stacja} jest poza zakresem 1..${liczbaStacji}.`);
    } else {
      pytaniaNaStacje.set(p.stacja, (pytaniaNaStacje.get(p.stacja) ?? 0) + 1);
    }

    if (!TEMATY[kanonicznyTemat(p.temat)]) dodaj('E12', `${pole}.temat`, `Temat "${p.temat}" nie należy do kanonu (PROTOKOL §5).`);

    if (typeof p.tresc !== 'string' || p.tresc.trim().length < 20 || p.tresc.trim().length > 400) {
      dodaj('E15', `${pole}.tresc`, 'Treść pytania musi mieć od 20 do 400 znaków.');
    } else if (!p.tresc.trim().endsWith('?')) {
      dodaj('E15', `${pole}.tresc`, 'Treść pytania musi kończyć się znakiem zapytania.');
    }

    if (!Array.isArray(p.odpowiedzi) || p.odpowiedzi.length !== 4) {
      dodaj('E07', `${pole}.odpowiedzi`, `Odpowiedzi musi być dokładnie 4 (jest ${Array.isArray(p.odpowiedzi) ? p.odpowiedzi.length : 0}).`);
    } else {
      const normalizowane = p.odpowiedzi.map((o) => normalizujTekst(o));
      p.odpowiedzi.forEach((o, k) => {
        if (typeof o !== 'string' || !o.trim() || o.trim().length > 80) dodaj('E07', `${pole}.odpowiedzi[${k}]`, 'Każda odpowiedź musi być niepustym tekstem do 80 znaków.');
        if (/(wszystkie\s+(powyższe|powyzej)|żadna\s+z\s+powyższych|none of the above|all of the above)/i.test(String(o))) {
          dodaj('E15', `${pole}.odpowiedzi[${k}]`, 'Odpowiedź w rodzaju „wszystkie/żadna z powyższych" jest zakazana (PROTOKOL §3.2).');
        }
      });
      if (new Set(normalizowane.filter((n) => n)).size !== normalizowane.filter((n) => n).length) {
        dodaj('E08', `${pole}.odpowiedzi`, 'Odpowiedzi powtarzają się (po normalizacji wielkości liter i interpunkcji).');
      }
      // Numer odpowiedzi, nie indeks (ADR 0050): 1 = pierwsza odpowiedź.
      if (!czyLiczbaCalkowita(p.poprawna) || p.poprawna < 1 || p.poprawna > p.odpowiedzi.length) {
        dodaj('E06', `${pole}.poprawna`, `Numer poprawnej odpowiedzi (${p.poprawna}) jest poza zakresem 1..${p.odpowiedzi.length} — podaj numer odpowiedzi, nie indeks.`);
      }
    }

    if (typeof p.wyjasnienie !== 'string' || p.wyjasnienie.trim().length < 60) {
      dodaj('E20', `${pole}.wyjasnienie`, 'Wyjaśnienie musi mieć co najmniej 60 znaków — to moment, w którym gracz dowiaduje się czegoś o okolicy.');
    } else if (typeof p.tresc === 'string' && normalizujTekst(p.wyjasnienie) === normalizujTekst(p.tresc)) {
      dodaj('E20', `${pole}.wyjasnienie`, 'Wyjaśnienie dosłownie powtarza treść pytania.');
    }

    // ADR 0058 (PYT/1.3): pole `zrodla` wycofane — model nie wpisuje
    // źródeł (właściciel: „nikt tego nie czyta”), walidacja E09/E10 wycofana;
    // stare paczki z polem są czytane, pole jest ignorowane.


    if (typeof p.tresc === 'string') {
      const klucz = normalizujTekst(p.tresc);
      if (widoczneTresci.has(klucz)) dodaj('E13', `${pole}.tresc`, `Pytanie powtarza treść pytania ${widoczneTresci.get(klucz)}.`);
      else widoczneTresci.set(klucz, p.id ?? `#${i}`);
    }

    // ADR 0055 (PYT/1.2): gdy setup niesie `poziomyPytan`, każde pytanie musi
    // nieść WŁASCIWY `poziom` (E21) — pytania bez poziomu albo z poziomem
    // spoza kanonu nie da się przypisać do gracza bez mieszania.
    if (poziomyPytanOczekiwane) {
      const poziom = normalizujPoziom(p.poziom);
      if (!poziom) {
        dodaj('E21', `${pole}.poziom`, `Pytanie nie ma pola "poziom" (albo ma wartość spoza kanonu: „${p.poziom}"). Każdy poziom trudności gracza wymaga pytania z polem "poziom" — dodaj je i poproś model o całość jeszcze raz.`);
      } else {
        poziomyNaStacji[p.stacja] = poziomyNaStacji[p.stacja] ?? { dzieci: 0, dorosli: 0 };
        poziomyNaStacji[p.stacja][poziom] += 1;
      }
    }
  });

  // --- zestawienie pytań poziomów przy każdej stacji (ADR 0055, E22) ---
  if (poziomyPytanOczekiwane) {
    const stacjeDoSprawdzenia = Number.isFinite(liczbaStacji) && liczbaStacji
      ? Array.from({ length: liczbaStacji }, (_, i) => i + 1)
      : [...new Set(paczka.pytania.map((p) => p.stacja).filter(Number.isInteger))].sort((a, b) => a - b);
    for (const st of stacjeDoSprawdzenia) {
      const ma = poziomyNaStacji[st] ?? { dzieci: 0, dorosli: 0 };
      if (ma.dzieci !== poziomyPytanOczekiwane.dzieci || ma.dorosli !== poziomyPytanOczekiwane.dorosli) {
        const opis = (l) => `dzieci: ${l.dzieci}, dorośli: ${l.dorosli}`;
        dodaj('E22', `stacja ${st}.poziomy`, `Stacja ${st} ma pytania (${opis(ma)}), a lista graczy wymaga (${opis(poziomyPytanOczekiwane)}). Setuj poziomy przy imionach graczy i poproś model o całość jeszcze raz.`);
      }
    }
  }

  // --- pokrycie stacji ---
  // Rozkładu pytań MIĘDZY stacjami nie sprawdzamy (właściciel 2026-09-15f,
  // BACKLOG B25): liczba pytań na stację nie jest polem setupu, tylko wynika
  // z rodzaju gry — hot-seat: `stacje × gracze`, multi: jedno pytanie na stację
  // (`pytaniaNaStacjeDla` w app/konfig.js) — a sumę pilnuje E03. Tolerancja
  // „różni się o więcej niż jedno" była lustrem zdania z promptu, którego już
  // nie ma (od PYT/1.1.2 prompt żąda równej liczby), więc pilnowała przypadku,
  // który nie występuje. Zostaje jedna usterka: stacja bez żadnego pytania.
  if (Number.isFinite(liczbaStacji) && liczbaStacji) {
    for (let s = 1; s <= liczbaStacji; s++) {
      if (!pytaniaNaStacje.has(s)) dodaj('E05', `stacja ${s}`, `Stacja ${s} nie ma żadnego pytania.`);
    }
  }

  return u;
}

/** Zwięzłe podsumowanie przyjętej paczki — dla ekranu organizatora. */
export function podsumowaniePaczki(paczka) {
  const pytania = Array.isArray(paczka?.pytania) ? paczka.pytania : [];
  const tematy = new Set(pytania.map((p) => p.temat));
  const zrodla = pytania.reduce((n, p) => n + (Array.isArray(p.zrodla) ? p.zrodla.length : 0), 0);
  return {
    liczbaPytan: pytania.length,
    stacje: [...new Set(pytania.map((p) => p.stacja))].sort((a, b) => a - b),
    tematy: [...tematy].sort(),
    liczbaZrodel: zrodla,
    punktyRazem: pytania.length, // rev2: każde pytanie daje 1 pkt — „razem" to liczba pytań
    uwagi: typeof paczka?.uwagi === 'string' ? paczka.uwagi.trim() : '',
  };
}
