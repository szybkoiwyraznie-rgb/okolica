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

import { TEMATY, WIEK, TRYBY, kanonicznyTemat, liczbaPytan } from './konfig.js?v=m12-153';
import { czyWspolrzedneOk, formatujWspolrzedne, odlegloscM } from './geo.js?v=m12-153';

/** Wersja protokołu — musi zgadzać się z `docs/PROTOKOL.md` i ze stopką aplikacji. */
export const WERSJA_PROTOKOLU = 'PYT/1.1';

/**
 * Wersje historyczne (REV1..REV5) i cała ich obsługa zostały USUNIĘTE
 * 2026-09-15e (ADR 0050). Powód właściciela: „to tylko obciążenie dla AI” —
 * model nie pisze żadnego markera, bo o profilu źródeł wie aplikacja
 * z ptaszka w setupie, a nie z pola w JSON-ie. Kod czyta JEDNĄ postać paczki.
 */

/** Wersja łatki szablonu promptu (kosmetyka szablonu bez zmiany schematu). */
export const SZABLON_WERSJA = 'PYT/1.1.2'; // 1.1.2: „tę samą liczbę pytań" (gramatyka); 1.1.1: trzy zdania po uwagach właściciela 2026-09-15f

/** Wersja szablonu bez weryfikacji (§2.2) — wersjonowana niezależnie od §2. */
export const SZABLON_WERSJA_BEZ_WERYFIKACJI = 'PYT/1.1-nofc.2'; // jak 1.1.2 — te same zdania w wariancie bez weryfikacji

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
export const SZABLON_PROMPTU = "Jesteś autorem pytań do terenowej gry quizowej „Tajemnicza Okolica\". Gracze idą od stacji do stacji w okolicy opisanej niżej i przy każdej stacji dostają pytania z wybranych dziedzin.\n\nZASADY TWARDE (naruszenie którejkolwiek unieważnia odpowiedź):\n1. ZANIM napiszesz jakikolwiek fakt, wykonaj kwerendę w internecie (wyszukiwarka albo przeglądanie stron) dla KAŻDEJ informacji użytej w pytaniu, w odpowiedziach i w wyjaśnieniu, i oprzyj ten fakt na wyniku kwerendy.\n2. Każde pytanie ma pole \"zrodla\" z co najmniej jednym prawdziwym, działającym adresem URL, z którego pochodzi fakt, oraz tytułem źródła i datą sprawdzenia. Używaj faktów potwierdzonych takim źródłem.\n3. Nazwy, daty, liczby, cytaty, autorów i adresy podawaj dokładnie w postaci potwierdzonej źródłem. Jeśli w jakimś temacie brakuje potwierdzonych faktów, zrób mniej pytań w tym temacie i opisz brak w polu \"uwagi\".\n4. Kotwicz pytanie możliwie blisko okolicy: stacja albo punkt trasy → ulica → dzielnica → miejscowość → powiat → województwo → kraj → kontynent → świat. Schodź na najniższy poziom, na którym masz sensowny potwierdzony fakt. Gdy temat nie ma lokalnego zaczepienia (dotyczy zwłaszcza tematu własnego i dziedzin ogólnych), pytanie z wiedzy ogólnej jest w porządku — lepsze niż naciągana kotwica.\n5. Trudność pytań dostosuj ściśle do kategorii wiekowej i wymagań trudności podanych niżej.\n6. Cała odpowiedź to jeden blok kodu json ze schematem podanym niżej.\n7. Formułuj treść pytania tak, żeby odpowiedź nie zawierała się w pytaniu.\nOKOLICA GRY:\n- środek gry (szerokość geograficzna, długość geograficzna): {LAT}, {LON}\n- miejsce: {MIEJSCE}\n- promień gry: {PROMIEN_M} m\n- sposób poruszania się: {TRYB}\n\nSTACJE (kolejność = kolejność w grze; każde pytanie przypisz do jednej stacji):\n{LISTA_STACJI}\n\nGRACZE I TRUDNOŚĆ:\n- liczba graczy: {LICZBA_GRACZY}\n- kategoria wiekowa: {WIEK}\n- wymagania trudności: {OPIS_TRUDNOSCI}\n- tematy pytań (wyłącznie z tej listy): {TEMATY}\n- liczba pytań łącznie: {LICZBA_PYTAN}\n- język pytań: {JEZYK}\n- data przygotowania: {DATA}\n\nSCHEMAT ODPOWIEDZI — dokładnie te pola:\n{\n  \"okolica\": { \"lat\": {LAT}, \"lon\": {LON}, \"promienM\": {PROMIEN_M}, \"miejsce\": \"{MIEJSCE}\" },\n  \"wiek\": \"{WIEK}\",\n  \"tematy\": [{TEMATY_JSON}],\n  \"jezyk\": \"{JEZYK}\",\n  \"utworzono\": \"{DATA}\",\n  \"pytania\": [\n    {\n      \"id\": \"s1p1\",\n      \"stacja\": 1,\n      \"temat\": \"historia\",\n      \"tresc\": \"Treść pytania zakończona znakiem zapytania?\",\n      \"odpowiedzi\": [\"pierwsza\", \"druga\", \"trzecia\", \"czwarta\"],\n      \"poprawna\": 2,\n      \"wyjasnienie\": \"Dwa albo trzy zdania: dlaczego ta odpowiedź jest poprawna i co z tego wynika dla okolicy.\",\n      \"zrodla\": [{ \"url\": \"https://przyklad.org/haslo\", \"tytul\": \"Tytuł źródła\", \"sprawdzono\": \"{DATA_KROTKA}\" }]\n    }\n  ],\n  \"uwagi\": \"\"\n}\n\nWYMAGANIA DODATKOWE:\n- \"id\": \"s<numer stacji>p<kolejny numer>\", na przykład \"s2p1\"; identyfikatory unikalne w całej paczce.\n- \"stacja\": numer stacji z listy powyżej, od 1 do {LICZBA_STACJI}; KAŻDA stacja ma co najmniej jedno pytanie, wszystkie stacje mają tę samą liczbę pytań.\n- \"odpowiedzi\": dokładnie 4, każda od 1 do 8 słów; cztery różne, samodzielne odpowiedzi; dokładnie jedna poprawna; pozycja poprawnej odpowiedzi różna między pytaniami.\n- \"poprawna\": numer poprawnej odpowiedzi od 1 do 4 (1 = pierwsza odpowiedź na liście \"odpowiedzi\").\n- \"temat\": jedna wartość z listy tematów podanej wyżej, małymi literami, z myślnikami.\n- \"wyjasnienie\": dwa albo trzy zdania o tym, dlaczego ta odpowiedź jest poprawna i co z tego wynika dla okolicy.\n- \"uwagi\": tematy pominięte i powód pominięcia; pusty tekst, gdy wszystkie fakty są potwierdzone.";
/* SZABLON-KONIEC */

/* SZABLON-BEZ-START
 * Treść generowana z docs/PROTOKOL.md §2.2 przez tools/synchronizuj-szablon.mjs.
 * NIE EDYTUJ RĘCZNIE — zmień dokument i uruchom `npm run build`.
 */
export const SZABLON_PROMPTU_BEZ_WERYFIKACJI = "Jesteś autorem pytań do terenowej gry quizowej „Tajemnicza Okolica\". Gracze idą od stacji do stacji w okolicy opisanej niżej i przy każdej stacji dostają pytania z wybranych dziedzin.\n\nZASADY TWARDE (naruszenie którejkolwiek unieważnia odpowiedź):\n1. Podawaj wyłącznie fakty, których jesteś pewien. Sposób ich ustalenia zostawiamy Tobie. Przy braku pewności upraszczaj pytanie, a pominięte tematy opisuj w polu \"uwagi\".\n2. Pole \"zrodla\" jest OPCJONALNE: podaj adres potwierdzający fakt, a przy braku pewności zostaw pole puste albo je pomiń.\n3. Nazwy, daty, liczby, cytaty i autorów podawaj w postaci, której jesteś pewien; przy braku takiej pewności wybierz łatwiejszy fakt z tego samego tematu. Jeśli w jakimś temacie brakuje pewnych faktów, zrób mniej pytań w tym temacie i opisz brak w polu \"uwagi\".\n4. Kotwicz pytanie możliwie blisko okolicy: stacja albo punkt trasy → ulica → dzielnica → miejscowość → powiat → województwo → kraj → kontynent → świat. Schodź na najniższy poziom, na którym masz sensowny pewny fakt. Gdy temat nie ma lokalnego zaczepienia (dotyczy zwłaszcza tematu własnego i dziedzin ogólnych), pytanie z wiedzy ogólnej jest w porządku — lepsze niż naciągana kotwica.\n5. Trudność pytań dostosuj ściśle do kategorii wiekowej i wymagań trudności podanych niżej.\n6. Cała odpowiedź to jeden blok kodu json ze schematem podanym niżej.\n7. Formułuj treść pytania tak, żeby odpowiedź nie zawierała się w pytaniu.\nOKOLICA GRY:\n- środek gry (szerokość geograficzna, długość geograficzna): {LAT}, {LON}\n- miejsce: {MIEJSCE}\n- promień gry: {PROMIEN_M} m\n- sposób poruszania się: {TRYB}\n\nSTACJE (kolejność = kolejność w grze; każde pytanie przypisz do jednej stacji):\n{LISTA_STACJI}\n\nGRACZE I TRUDNOŚĆ:\n- liczba graczy: {LICZBA_GRACZY}\n- kategoria wiekowa: {WIEK}\n- wymagania trudności: {OPIS_TRUDNOSCI}\n- tematy pytań (wyłącznie z tej listy): {TEMATY}\n- liczba pytań łącznie: {LICZBA_PYTAN}\n- język pytań: {JEZYK}\n- data przygotowania: {DATA}\n\nSCHEMAT ODPOWIEDZI — dokładnie te pola:\n{\n  \"okolica\": { \"lat\": {LAT}, \"lon\": {LON}, \"promienM\": {PROMIEN_M}, \"miejsce\": \"{MIEJSCE}\" },\n  \"wiek\": \"{WIEK}\",\n  \"tematy\": [{TEMATY_JSON}],\n  \"jezyk\": \"{JEZYK}\",\n  \"utworzono\": \"{DATA}\",\n  \"pytania\": [\n    {\n      \"id\": \"s1p1\",\n      \"stacja\": 1,\n      \"temat\": \"historia\",\n      \"tresc\": \"Treść pytania zakończona znakiem zapytania?\",\n      \"odpowiedzi\": [\"pierwsza\", \"druga\", \"trzecia\", \"czwarta\"],\n      \"poprawna\": 2,\n      \"wyjasnienie\": \"Dwa albo trzy zdania: dlaczego ta odpowiedź jest poprawna i co z tego wynika dla okolicy.\",\n      \"zrodla\": [{ \"url\": \"https://przyklad.org/haslo\", \"tytul\": \"Tytuł źródła\", \"sprawdzono\": \"{DATA_KROTKA}\" }]\n    }\n  ],\n  \"uwagi\": \"\"\n}\n\nWYMAGANIA DODATKOWE:\n- \"id\": \"s<numer stacji>p<kolejny numer>\", na przykład \"s2p1\"; identyfikatory unikalne w całej paczce.\n- \"stacja\": numer stacji z listy powyżej, od 1 do {LICZBA_STACJI}; KAŻDA stacja ma co najmniej jedno pytanie, wszystkie stacje mają tę samą liczbę pytań.\n- \"odpowiedzi\": dokładnie 4, każda od 1 do 8 słów; cztery różne, samodzielne odpowiedzi; dokładnie jedna poprawna; pozycja poprawnej odpowiedzi różna między pytaniami.\n- \"poprawna\": numer poprawnej odpowiedzi od 1 do 4 (1 = pierwsza odpowiedź na liście \"odpowiedzi\").\n- \"temat\": jedna wartość z listy tematów podanej wyżej, małymi literami, z myślnikami.\n- \"wyjasnienie\": dwa albo trzy zdania o tym, dlaczego ta odpowiedź jest poprawna i co z tego wynika dla okolicy.\n- \"zrodla\": pusta lista ALBO lista źródeł w kształcie jak w schemacie; każdy adres w pełnej, prawdziwej i działającej postaci (https://), z tytułem i datą sprawdzenia RRRR-MM-DD; pytanie z adresem przykładowym traci ważność.\n- \"uwagi\": tematy pominięte i powód pominięcia; pusty tekst, gdy wszystkie fakty są pewne.";
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

const WZOR_DATA = /^\d{4}-\d{2}-\d{2}$/;
const WZOR_DATA_CZAS = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const WZOR_ID = /^s[0-9]+p[0-9]+$/;
const WZOR_URL = /^https?:\/\/[^\s/]+\.[^\s]+$/i;
const ZAKAZANE_HOSTY = ['example.com', 'example.org', 'example.net', 'przyklad.org', 'przyklad.pl', 'przyklad.com', 'localhost', 'test.com', 'twojastrona.pl', 'domain.com'];
/** Zarezerwowane TLD (RFC 2606) i domeny testowe — nie są prawdziwym źródłem. */
const ZAKAZANE_TLD = ['.invalid', '.test', '.localhost', '.example', '.local'];

/** Linie listy stacji do placeholdera `{LISTA_STACJI}`. */
export function opisListyStacji(stacje, srodek) {
  return stacje
    .map((s, i) => {
      const [lat, lon] = formatujWspolrzedne(s.lat, s.lon).split(', ');
      const dystans = srodek ? Math.round(odlegloscM(srodek, s)) : null;
      const opis = s.opis && s.opis.trim() ? s.opis.trim() : 'punkt w terenie (bez nazwy)';
      return `- stacja ${i + 1}: ${lat}, ${lon} — ${opis}${dystans != null ? ` (${dystans} m od środka gry)` : ''}`;
    })
    .join('\n');
}

/**
 * Buduje prompt z szablonu §2 protokołu. Zwraca `{ prompt, usterki }` —
 * usterki (kody WE**, prefiks własny domeny wejścia promptu — ADR 0015 pkt 6)
 * pojawiają się, gdy brakuje danych wejściowych; prompt jest wtedy `null`,
 * żeby nie wysłać modelowi dziurawego zadania.
 */
export function zbudujPrompt({ konfig, okolica, stacje, teraz = new Date(), factcheck = false }) {
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
  if (konfig && !WIEK[konfig.wiek]) dodaj('WE05', 'wiek', `Nieznana kategoria wiekowa „${konfig.wiek}".`);
  if (konfig && stacje && stacje.length !== konfig.liczbaStacji) {
    dodaj('WE06', 'liczbaStacji', `Liczba stacji (${stacje.length}) nie zgadza się z konfiguracją (${konfig.liczbaStacji}).`);
  }
  if (usterki.length) return { prompt: null, usterki };

  const tematyLista = konfig.tematy.filter((t) => TEMATY[t]);
  const podstawienia = {
    LAT: okolica.lat.toFixed(5),
    LON: okolica.lon.toFixed(5),
    MIEJSCE: okolica.miejsce && okolica.miejsce.trim() ? okolica.miejsce.trim() : 'brak odczytu (tylko współrzędne)',
    PROMIEN_M: String(Math.round(konfig.promienM)),
    TRYB: TRYBY[konfig.tryb].etykieta,
    LISTA_STACJI: opisListyStacji(stacje, okolica),
    LICZBA_GRACZY: String(konfig.liczbaGraczy),
    LICZBA_STACJI: String(stacje.length),
    WIEK: konfig.wiek,
    OPIS_TRUDNOSCI: WIEK[konfig.wiek].opisTrudnosci,
    TEMATY: tematyLista.map((t) => (t === 'wlasny' && konfig.tematWlasny ? `wlasny (${konfig.tematWlasny.trim().slice(0, 40)})` : `${t} (${TEMATY[t].opis})`)).join(', '),
    TEMATY_JSON: tematyLista.map((t) => JSON.stringify(t)).join(', '),
    LICZBA_PYTAN: String(liczbaPytan(konfig)),
    JEZYK: konfig.jezyk,
    DATA: formatujDate(teraz),
    DATA_KROTKA: formatujDateKrotka(teraz),
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
export function normalizujTematyPaczki(paczka) {
  if (Array.isArray(paczka.tematy)) paczka.tematy = [...new Set(paczka.tematy.map(kanonicznyTemat))];
  if (Array.isArray(paczka.pytania)) {
    for (const p of paczka.pytania) {
      if (typeof p.temat === 'string') p.temat = kanonicznyTemat(p.temat);
    }
  }
  return paczka;
}

/**
 * Walidacja paczki pytań wg protokołu §3 i §6. Zwraca listę usterek
 * `{ kod, pole, komunikat }`; pusta lista = paczka do przyjęcia.
 * `oczekiwane`: `{ liczbaStacji, liczbaPytan, wiek, tematy, promienM, lat, lon, jezyk, teraz, stacje }`.
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
  // dotyczy. O profilu źródeł decyduje ptaszek „fact check” w setupie, nie
  // marker w JSON-ie: aplikacja wie, który prompt wysłała.
  const wymagaZrodel = oczekiwane.factcheck !== false;

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

  if (!WIEK[paczka.wiek]) dodaj('E15', 'wiek', `Nieznana kategoria wiekowa "${paczka.wiek}" (dopuszczone: ${Object.keys(WIEK).join(', ')}).`);
  else if (oczekiwane.wiek && paczka.wiek !== oczekiwane.wiek) dodaj('E16', 'wiek', `Kategoria wiekowa paczki (${paczka.wiek}) nie zgadza się z konfiguracją (${oczekiwane.wiek}).`);

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

  if (typeof paczka.utworzono !== 'string' || !WZOR_DATA_CZAS.test(paczka.utworzono)) {
    dodaj('E11', 'utworzono', 'Pole "utworzono" musi mieć format "RRRR-MM-DD GG:MM".');
  } else if (new Date(paczka.utworzono.replace(' ', 'T')) > teraz) {
    dodaj('E11', 'utworzono', 'Data utworzenia paczki jest w przyszłości.');
  }

  if (typeof paczka.uwagi !== 'string') dodaj('E15', 'uwagi', 'Pole "uwagi" musi istnieć (może być pustym tekstem) — tam model opisuje, czego nie potwierdził źródłem.');

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

    if (!Array.isArray(p.zrodla) || p.zrodla.length === 0) {
      if (wymagaZrodel) dodaj('E09', `${pole}.zrodla`, 'Pytanie bez źródła: każde pytanie musi mieć co najmniej jeden adres URL, z którego pochodzi fakt (ADR 0008).');
    } else {
      p.zrodla.forEach((z, k) => {
        if (!z || typeof z !== 'object') { dodaj('E15', `${pole}.zrodla[${k}]`, 'Źródło musi być obiektem {url, tytul, sprawdzono}.'); return; }
        const url = String(z.url ?? '').trim();
        if (!WZOR_URL.test(url)) dodaj('E10', `${pole}.zrodla[${k}].url`, `"${url || '(brak)'}" nie jest pełnym adresem http(s).`);
        else {
          const host = url.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
          const zakazany = ZAKAZANE_HOSTY.some((h) => host === h || host.endsWith(`.${h}`)) || ZAKAZANE_TLD.some((tld) => host.endsWith(tld));
          if (zakazany) {
            dodaj('E10', `${pole}.zrodla[${k}].url`, wymagaZrodel
              ? `Adres "${url}" wygląda na przykładowy albo testowy — podaj prawdziwe źródło z kwerendy.`
              : `Adres "${url}" wygląda na przykładowy albo testowy — podaj prawdziwy adres albo usuń to źródło (w tym wariancie źródła są opcjonalne).`);
          }
        }
        if (typeof z.tytul !== 'string' || !z.tytul.trim()) dodaj('E15', `${pole}.zrodla[${k}].tytul`, 'Źródło musi mieć tytuł.');
        if (typeof z.sprawdzono !== 'string' || !WZOR_DATA.test(z.sprawdzono)) dodaj('E11', `${pole}.zrodla[${k}].sprawdzono`, 'Data sprawdzenia źródła musi mieć format RRRR-MM-DD.');
        else if (new Date(`${z.sprawdzono}T23:59`) < new Date('2000-01-01') || new Date(`${z.sprawdzono}T00:00`) > teraz) dodaj('E11', `${pole}.zrodla[${k}].sprawdzono`, 'Data sprawdzenia źródła jest w przyszłości albo absurdalnie wczesna.');
      });
    }


    if (typeof p.tresc === 'string') {
      const klucz = normalizujTekst(p.tresc);
      if (widoczneTresci.has(klucz)) dodaj('E13', `${pole}.tresc`, `Pytanie powtarza treść pytania ${widoczneTresci.get(klucz)}.`);
      else widoczneTresci.set(klucz, p.id ?? `#${i}`);
    }
  });

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
