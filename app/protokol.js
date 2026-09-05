/**
 * protokol.js — protokół PYT v1.0 w kodzie: szablon promptu, budowa promptu,
 * parsowanie odpowiedzi modelu i walidacja paczki pytań.
 *
 * Źródło prawdy: `docs/PROTOKOL.md`. Szablon promptu jest PRZEPISYWANY z tego
 * dokumentu przez `tools/synchronizuj-szablon.mjs` (`npm run build`) — nie
 * edytuj go tutaj. Kanon tematów i kategorii wiekowych żyje w `app/konfig.js`
 * i jest porównywany z protokołem przez `test/kontrakt.test.js`.
 *
 * Moduł jest czysty: bez DOM, bez sieci, bez API Node (LESSONS L6). Daty
 * przyjmuje jako parametr (`teraz`), żeby testy były deterministyczne.
 */

import { TEMATY, WIEK, TRYBY, liczbaPytan } from './konfig.js';
import { czyWspolrzedneOk, formatujWspolrzedne, odlegloscM } from './geo.js';

/** Wersja protokołu — musi zgadzać się z `docs/PROTOKOL.md` i ze stopką aplikacji. */
export const WERSJA_PROTOKOLU = 'PYT/1.0';

/** Wersja łatki szablonu promptu (kosmetyka szablonu bez zmiany schematu). */
export const SZABLON_WERSJA = 'PYT/1.0.0';

/** Schemat kontenera zaszyfrowanego (ADR 0007 pkt 3). */
export const SCHEMAT_KONTENERA = 'TO-paczka/1';

/* SZABLON-START
 * Treść generowana z docs/PROTOKOL.md §2 przez tools/synchronizuj-szablon.mjs.
 * NIE EDYTUJ RĘCZNIE — zmień dokument i uruchom `npm run build`.
 */
export const SZABLON_PROMPTU = "Jesteś autorem pytań do terenowej gry quizowej „Tajemnicza Okolica\". Gracze idą od stacji do stacji w okolicy opisanej niżej i przy każdej stacji dostają pytania o tę okolicę.\n\nZASADY TWARDE (naruszenie którejkolwiek unieważnia odpowiedź):\n1. ZANIM napiszesz jakikolwiek fakt, wykonaj kwerendę w internecie (wyszukiwarka albo przeglądanie stron) dla KAŻDEJ informacji użytej w pytaniu, w odpowiedziach i w wyjaśnieniu. Nie opieraj się na pamięci modelu.\n2. Każde pytanie ma pole \"zrodla\" z co najmniej jednym prawdziwym, działającym adresem URL, z którego pochodzi fakt, oraz tytułem źródła i datą sprawdzenia. Faktu, którego nie potrafisz potwierdzić źródłem, NIE UŻYWASZ.\n3. Nie wymyślaj nazw, dat, liczb, cytatów, autorów ani adresów. Nie zgaduj i nie uogólniaj. Jeśli w jakimś temacie brakuje potwierdzonych faktów, zrób mniej pytań w tym temacie i opisz brak w polu \"uwagi\".\n4. Wszystkie pytania dotyczą OKOLICY podanej niżej (miejsca, dzielnicy, miasta, regionu, państwa) albo konkretnych stacji z listy. Zakazane są pytania z wiedzy ogólnej o świecie, niezwiązane z tą okolicą.\n5. Trudność pytań dostosuj ściśle do kategorii wiekowej i wymagań trudności podanych niżej.\n6. Odpowiedź zwróć WYŁĄCZNIE jako jeden blok kodu json ze schematem podanym niżej. Bez komentarzy, bez wstępu, bez podsumowania, bez drugiego bloku.\n7. Treść pytania nie może zdradzać odpowiedzi (na przykład roku w pytaniu o rok).\n\nOKOLICA GRY:\n- środek gry (szerokość geograficzna, długość geograficzna): {LAT}, {LON}\n- miejsce: {MIEJSCE}\n- promień gry: {PROMIEN_M} m\n- sposób poruszania się: {TRYB}\n\nSTACJE (kolejność = kolejność w grze; każde pytanie przypisz do jednej stacji):\n{LISTA_STACJI}\n\nGRACZE I TRUDNOŚĆ:\n- liczba graczy: {LICZBA_GRACZY}\n- kategoria wiekowa: {WIEK}\n- wymagania trudności: {OPIS_TRUDNOSCI}\n- tematy pytań (wyłącznie z tej listy): {TEMATY}\n- liczba pytań łącznie: {LICZBA_PYTAN}\n- język pytań: {JEZYK}\n- data przygotowania: {DATA}\n\nSCHEMAT ODPOWIEDZI (PYT/1.0) — dokładnie te pola:\n{\n  \"protokol\": \"PYT/1.0\",\n  \"okolica\": { \"lat\": {LAT}, \"lon\": {LON}, \"promienM\": {PROMIEN_M}, \"miejsce\": \"{MIEJSCE}\" },\n  \"wiek\": \"{WIEK}\",\n  \"tematy\": [{TEMATY_JSON}],\n  \"jezyk\": \"{JEZYK}\",\n  \"utworzono\": \"{DATA}\",\n  \"pytania\": [\n    {\n      \"id\": \"s1p1\",\n      \"stacja\": 1,\n      \"temat\": \"historia\",\n      \"tresc\": \"Treść pytania zakończona znakiem zapytania?\",\n      \"odpowiedzi\": [\"pierwsza\", \"druga\", \"trzecia\", \"czwarta\"],\n      \"poprawna\": 0,\n      \"wyjasnienie\": \"Dwa albo trzy zdania: dlaczego ta odpowiedź jest poprawna i co z tego wynika dla okolicy.\",\n      \"zrodla\": [{ \"url\": \"https://przyklad.org/haslo\", \"tytul\": \"Tytuł źródła\", \"sprawdzono\": \"{DATA_KROTKA}\" }],\n      \"punkty\": 10\n    }\n  ],\n  \"uwagi\": \"\"\n}\n\nWYMAGANIA DODATKOWE:\n- \"id\": \"s<numer stacji>p<kolejny numer>\", na przykład \"s2p1\"; identyfikatory unikalne w całej paczce.\n- \"stacja\": numer stacji z listy powyżej, od 1 do {LICZBA_STACJI}; KAŻDA stacja ma co najmniej jedno pytanie, a rozkład pytań między stacje jest równy albo różni się o jedno.\n- \"odpowiedzi\": dokładnie 4, każda od 1 do 8 słów, bez powtórzeń, bez odpowiedzi w rodzaju „wszystkie powyższe\" albo „żadna z powyższych\"; dokładnie jedna poprawna; pozycja poprawnej odpowiedzi różna między pytaniami.\n- \"poprawna\": indeks poprawnej odpowiedzi, liczba całkowita od 0 do 3.\n- \"temat\": jedna wartość z listy tematów podanej wyżej, małymi literami, z myślnikami.\n- \"punkty\": 10 za pytanie łatwe, 15 za średnie, 20 za trudne — zgodnie z kategorią wiekową.\n- \"wyjasnienie\": napisane tak, żeby gracz po odpowiedzi dowiedział się czegoś o okolicy; bez powtarzania treści pytania.\n- \"uwagi\": czego nie udało się potwierdzić źródłem, które tematy zostały pominięte i dlaczego; pusty tekst, jeśli wszystko potwierdzone.";
/* SZABLON-KONIEC */

/**
 * Tokeny lokalne używane przez heurystykę zakotwiczenia pytania w miejscu
 * (protokół §6, kod E14). Rozszerzanie listy = zmiana kodu z testem, nie
 * decyzja „na oko" w trakcie sesji.
 */
export const TOKENY_MIEJSCA = [
  'ulica', 'ul.', 'aleja', 'al.', 'plac', 'pl.', 'rynek', 'skwer', 'bulwar',
  'park', 'las', 'cmentarz', 'kościół', 'kaplica', 'klasztor', 'synagoga', 'cerkiew',
  'most', 'kładka', 'wiadukt', 'tunel', 'rzeka', 'strumień', 'jezioro', 'staw', 'kanał',
  'wzgórze', 'góra', 'kamieniołom', 'dzielnica', 'osiedle', 'przedmieście', 'sołectwo',
  'kamienica', 'pałac', 'zamek', 'dwór', 'ratusz', 'fort', 'mur', 'brama', 'baszta',
  'pomnik', 'rzeźba', 'mural', 'fabryka', 'zakład', 'elektrownia', 'gazownia', 'wodociągi',
  'dworzec', 'przystanek', 'stacja', 'metro', 'depot', 'szkoła', 'uniwersytet', 'biblioteka',
  'teatr', 'kino', 'muzeum', 'galeria', 'stadion', 'hala', 'basen', 'boisko',
  'szpital', 'apteka', 'targ', 'bazar', 'rynek warzywny', 'poczta', 'straż', 'koszary',
];

/**
 * Słowa, które bywają wielką literą na początku zdania i nie są nazwami
 * własnymi — heurystyka E14 ich nie liczy jako „nazwy własnej".
 */
export const SLOWA_POSPOLITE = new Set([
  'Przy', 'Jakie', 'Jaki', 'Jaka', 'Który', 'Która', 'Które', 'Gdzie', 'Kiedy', 'Kto',
  'Co', 'Czy', 'W', 'We', 'Z', 'Ze', 'Na', 'Nad', 'Pod', 'Przed', 'Za', 'Od', 'Do', 'O',
  'Po', 'Przez', 'Dla', 'Między', 'Pomiędzy', 'Według', 'Wobec', 'Oraz', 'I', 'A', 'Ale',
  'To', 'Ten', 'Ta', 'Te', 'Jest', 'Był', 'Była', 'Było', 'Są', 'Został', 'Została',
  'Polska', 'Polski', 'Polskie', 'Polskiej', 'Wikipedia', 'Wikipedii', 'Internet',
]);

/**
 * Wyrazy pospolite, które wchodzą w skład nazw administracyjnych i nie są
 * kotwicą pytania. Bez tej listy „Stare Miasto" albo „woj. mazowieckie"
 * łapałyby pytania o byle co: rdzeń „woj" trafia w „wojna", „stare" w
 * „stare fotografie". Nazwy regionów („mazowieckie") zostają — pytanie
 * „kto mieszkał na Mazowszu" jest uczciwie zakotwiczone.
 */
export const WYRAZY_POSPOLITE_MIEJSCA = new Set([
  'stare', 'stary', 'stara', 'nowe', 'nowy', 'nowa', 'miasto', 'miasta', 'wieś', 'wies',
  'wioska', 'osiedle', 'dzielnica', 'gmina', 'powiat', 'województwo', 'wojewodztwo',
  'miejscowość', 'miejscowosc', 'okolica', 'region', 'kraj', 'polska', 'polski', 'polskie',
  'polskiej', 'polsce', 'dolne', 'dolny', 'górne', 'gorne', 'górny', 'wielkie', 'wielki',
  'wielka', 'małe', 'male', 'mała', 'północne', 'polnocne', 'południowe', 'poludniowe',
  'wschodnie', 'zachodnie', 'święte',
]);

/**
 * Skróty z kropką, po których wielka litera NIE zaczyna nowego zdania
 * („kościół św. Anny", „ul. Zgoda", „ks. Jerzy"). Bez tej listy podział na
 * zdania ciąłby nazwy własne w pół i heurystyka E14 gubiła kotwicę.
 */
export const SKROTY_Z_KROPKA = new Set([
  'św', 'sw', 'p', 'r', 'nr', 'al', 'ul', 'pl', 'ks', 'dr', 'prof', 'pp', 'tzw', 'np',
  'tj', 'itd', 'w', 'z', 'm', 's', 'nn', 'oo', 'bp', 'abp', 'kard', 'gen', 'płk', 'plk',
  'im', 'pw', 'godz', 'ok', 'zm', 'ur', 'tzn', 'vs', 'rynek',
]);

/**
 * Wyrazy wielką literą wewnątrz pola, które nie są początkiem zdania —
 * kandydaci na nazwy własne (heurystyka E14, krok 4).
 */
function nazwyWlasneKandydaci(tekst) {
  const wyrazy = String(tekst ?? '').trim().split(/\s+/).filter(Boolean);
  const znalezione = [];
  for (let i = 1; i < wyrazy.length; i++) {
    if (!/^[\p{Lu}\p{Lt}]/u.test(wyrazy[i])) continue;
    const poprzedni = wyrazy[i - 1];
    if (/[.!?…]$/.test(poprzedni)) {
      const czysty = normalizujTekst(poprzedni.replace(/[.!?…,]/gu, ''));
      if (!SKROTY_Z_KROPKA.has(czysty)) continue; // nowy akapit zdania, nie nazwa
    }
    znalezione.push(wyrazy[i]);
  }
  return znalezione;
}

/**
 * Rdzeń tokena: pierwsze 5 znaków po normalizacji (albo cały token, gdy krótszy).
 * Dzięki temu heurystyka zakotwiczenia obejmuje polską odmianę: „Warszawa"
 * trafia w „warszawskim", „Warszawy", „Warszawą".
 */
export function rdzenTokena(token) {
  const t = normalizujTekst(token);
  return t.length >= 5 ? t.slice(0, 5) : t;
}

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
 * usterki (K** setupu) pojawiają się, gdy brakuje danych wejściowych; prompt
 * jest wtedy `null`, żeby nie wysłać modelowi dziurawego zadania.
 */
export function zbudujPrompt({ konfig, okolica, stacje, teraz = new Date() }) {
  const usterki = [];
  const dodaj = (kod, pole, komunikat) => usterki.push({ kod, pole, komunikat });

  if (!konfig) dodaj('P01', 'konfig', 'Brak konfiguracji — najpierw ekran ustawień.');
  if (!okolica || !czyWspolrzedneOk(okolica?.lat, okolica?.lon)) {
    dodaj('P02', 'okolica', 'Brak poprawnej pozycji (współrzędnych) — bez niej prompt nie ma okolicy.');
  }
  if (!Array.isArray(stacje) || stacje.length === 0) {
    dodaj('P03', 'stacje', 'Brak stacji — ustaw je (albo użyj trybu uproszczonego), zanim poprosisz model o pytania.');
  }
  if (konfig && !TRYBY[konfig.tryb]) dodaj('P04', 'tryb', `Nieznany tryb „${konfig.tryb}".`);
  if (konfig && !WIEK[konfig.wiek]) dodaj('P05', 'wiek', `Nieznana kategoria wiekowa „${konfig.wiek}".`);
  if (konfig && stacje && stacje.length !== konfig.liczbaStacji) {
    dodaj('P06', 'liczbaStacji', `Liczba stacji (${stacje.length}) nie zgadza się z konfiguracją (${konfig.liczbaStacji}).`);
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
    TEMATY: tematyLista.map((t) => `${t} (${TEMATY[t].opis})`).join(', '),
    TEMATY_JSON: tematyLista.map((t) => JSON.stringify(t)).join(', '),
    LICZBA_PYTAN: String(liczbaPytan(konfig)),
    JEZYK: konfig.jezyk,
    DATA: formatujDate(teraz),
    DATA_KROTKA: formatujDateKrotka(teraz),
  };

  let prompt = SZABLON_PROMPTU;
  for (const [token, wartosc] of Object.entries(podstawienia)) {
    prompt = prompt.split(`{${token}}`).join(wartosc);
  }
  const resztki = [...prompt.matchAll(/\{[A-Z_]+\}/g)].map((m) => m[0]);
  if (resztki.length) {
    dodaj('P07', 'szablon', `W szablonie zostały niepodstawione placeholdery: ${[...new Set(resztki)].join(', ')}. Uruchom \`npm run build\`.`);
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
    return { paczka: null, blad: { kod: 'E02', pole: 'json', komunikat: `Odpowiedź zawiera ${bloki.length} bloki kodu — poproś model o JEDEN blok JSON (poprawka jest gotowa do skopiowania).` } };
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
  return { paczka: null, blad: { kod: 'E02', pole: 'json', komunikat: 'Nie udało się odczytać JSON-a z odpowiedzi. Poproś model o sam blok JSON, bez komentarzy (poprawka gotowa do skopiowania).' } };
}

/** Tokeny nazw własnych z miejsca i z opisów stacji (do heurystyki E14). */
export function tokenyWlasne(okolica, stacje = []) {
  const czesci = [
    ...String(okolica?.miejsce ?? '').split(/[,;]/).flatMap((c) => c.split(/\s+/)),
    ...stacje.flatMap((s) => String(s?.opis ?? '').split(/[,;]/).flatMap((c) => c.split(/\s+/))),
  ];
  const czyste = new Set();
  for (const surowe of czesci) {
    const t = normalizujTekst(surowe);
    // 4 znaki minimum: rdzeń 3-literowy („woj", „las", „mur") daje za dużo
    // fałszywych trafień, a prawdziwe nazwy własne niemal zawsze są dłuższe.
    if (t.length < 4) continue;
    if (TOKENY_MIEJSCA.includes(t)) continue;
    if (WYRAZY_POSPOLITE_MIEJSCA.has(t)) continue;
    if (SLOWA_POSPOLITE.has(surowe) || SLOWA_POSPOLITE.has(surowe.charAt(0).toUpperCase() + surowe.slice(1))) continue;
    if (/^\d+$/.test(t)) continue;
    czyste.add(t);
  }
  return [...czyste];
}

/**
 * Heurystyka zakotwiczenia pytania w okolicy (protokół §6, kod E14):
 * przechodzi, jeśli tekst zawiera nazwę własną z miejsca/stacji ALBO zawiera
 * słowo lokalne + nazwę własną nieznaną jako pospolitą.
 */
export function czyZakotwiczone(pytanie, okolica, stacje = []) {
  const surowy = `${pytanie?.tresc ?? ''} ${pytanie?.wyjasnienie ?? ''}`;
  const tekst = normalizujTekst(surowy);
  if (!tekst) return false;

  // Rdzeń musi trafiać w POCZĄTEK wyrazu, nie w jego środek: „kościół" →
  // „kości" pasuje do „kościoła", ale nie do „ludzkości".
  const slowa = tekst.split(/\s+/).filter(Boolean);
  const trafiaRdzen = (token) => {
    const rdzen = rdzenTokena(token);
    return rdzen.length >= 4 && slowa.some((s) => s.startsWith(rdzen));
  };

  if (tokenyWlasne(okolica, stacje).some(trafiaRdzen)) return true;

  const maSlowoLokalne = TOKENY_MIEJSCA.some((t) => {
    const n = normalizujTekst(t);
    return n.length >= 3 && slowa.some((s) => s.startsWith(n));
  });

  // Nazwa własna = wyraz wielką literą, który NIE zaczyna zdania (po polsku
  // każde zdanie zaczyna się wielką literą, więc bez tego wykluczenia każde
  // pytanie wyglądałoby na zakotwiczone) i nie jest słowem pospolitym.
  // Podział na zdania uwzględnia skróty z kropką („św. Anny" to jedna nazwa).
  const kandydaci = [
    ...nazwyWlasneKandydaci(pytanie?.tresc),
    ...nazwyWlasneKandydaci(pytanie?.wyjasnienie),
  ];
  const maNazweWlasna = kandydaci.some((s) => {
    const t = normalizujTekst(s.replace(/[.,;:!?…"„»«()\[\]]/gu, ''));
    if (t.length < 3) return false;
    if (WYRAZY_POSPOLITE_MIEJSCA.has(t)) return false;
    const zWielkiej = t.charAt(0).toUpperCase() + t.slice(1);
    return !SLOWA_POSPOLITE.has(zWielkiej) && !SLOWA_POSPOLITE.has(t);
  });

  return maSlowoLokalne && maNazweWlasna;
}

function czyLiczbaCalkowita(v) {
  return Number.isInteger(v);
}

/**
 * Walidacja paczki pytań wg protokołu §3 i §6. Zwraca listę usterek
 * `{ kod, pole, komunikat }`; pusta lista = paczka do przyjęcia.
 * `oczekiwane`: `{ liczbaStacji, liczbaPytan, wiek, tematy, promienM, lat, lon, jezyk, teraz, stacje }`.
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
  if (!('protokol' in paczka)) dodaj('E01', 'protokol', `Brak pola "protokol". Oczekiwano "${WERSJA_PROTOKOLU}".`);
  else if (paczka.protokol !== WERSJA_PROTOKOLU) dodaj('E01', 'protokol', `Wersja "${paczka.protokol}" nie jest obsługiwana — oczekiwano "${WERSJA_PROTOKOLU}".`);

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
      if (!TEMATY[t]) dodaj('E12', `tematy[${i}]`, `Temat "${t}" nie należy do kanonu (PROTOKOL §5).`);
    });
    if (new Set(paczka.tematy).size !== paczka.tematy.length) dodaj('E15', 'tematy', 'Tematy powtarzają się na liście.');
    if (Array.isArray(oczekiwane.tematy) && oczekiwane.tematy.length) {
      const brak = oczekiwane.tematy.filter((t) => !paczka.tematy.includes(t));
      const nadmiar = paczka.tematy.filter((t) => !oczekiwane.tematy.includes(t));
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
    dodaj('E03', 'pytania', `Liczba pytań (${paczka.pytania.length}) nie zgadza się z oczekiwaną (${oczekiwane.liczbaPytan} = ${oczekiwane.liczbaStacji} stacji × pytania na stację).`);
  }

  const widoczneTresci = new Map();
  const widoczneId = new Set();
  const pytaniaNaStacje = new Map();
  const punktyDozwolone = new Set([10, 15, 20]);

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

    if (!TEMATY[p.temat]) dodaj('E12', `${pole}.temat`, `Temat "${p.temat}" nie należy do kanonu (PROTOKOL §5).`);

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
      if (!czyLiczbaCalkowita(p.poprawna) || p.poprawna < 0 || p.poprawna > p.odpowiedzi.length - 1) {
        dodaj('E06', `${pole}.poprawna`, `Indeks poprawnej odpowiedzi (${p.poprawna}) jest poza zakresem 0..${p.odpowiedzi.length - 1}.`);
      }
    }

    if (typeof p.wyjasnienie !== 'string' || p.wyjasnienie.trim().length < 60) {
      dodaj('E20', `${pole}.wyjasnienie`, 'Wyjaśnienie musi mieć co najmniej 60 znaków — to moment, w którym gracz dowiaduje się czegoś o okolicy.');
    } else if (typeof p.tresc === 'string' && normalizujTekst(p.wyjasnienie) === normalizujTekst(p.tresc)) {
      dodaj('E20', `${pole}.wyjasnienie`, 'Wyjaśnienie dosłownie powtarza treść pytania.');
    }

    if (!Array.isArray(p.zrodla) || p.zrodla.length === 0) {
      dodaj('E09', `${pole}.zrodla`, 'Pytanie bez źródła: każde pytanie musi mieć co najmniej jeden adres URL, z którego pochodzi fakt (ADR 0008).');
    } else {
      p.zrodla.forEach((z, k) => {
        if (!z || typeof z !== 'object') { dodaj('E15', `${pole}.zrodla[${k}]`, 'Źródło musi być obiektem {url, tytul, sprawdzono}.'); return; }
        const url = String(z.url ?? '').trim();
        if (!WZOR_URL.test(url)) dodaj('E10', `${pole}.zrodla[${k}].url`, `"${url || '(brak)'}" nie jest pełnym adresem http(s).`);
        else {
          const host = url.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
          const zakazany = ZAKAZANE_HOSTY.some((h) => host === h || host.endsWith(`.${h}`)) || ZAKAZANE_TLD.some((tld) => host.endsWith(tld));
          if (zakazany) {
            dodaj('E10', `${pole}.zrodla[${k}].url`, `Adres "${url}" wygląda na przykładowy albo testowy — podaj prawdziwe źródło z kwerendy.`);
          }
        }
        if (typeof z.tytul !== 'string' || !z.tytul.trim()) dodaj('E15', `${pole}.zrodla[${k}].tytul`, 'Źródło musi mieć tytuł.');
        if (typeof z.sprawdzono !== 'string' || !WZOR_DATA.test(z.sprawdzono)) dodaj('E11', `${pole}.zrodla[${k}].sprawdzono`, 'Data sprawdzenia źródła musi mieć format RRRR-MM-DD.');
        else if (new Date(`${z.sprawdzono}T23:59`) < new Date('2000-01-01') || new Date(`${z.sprawdzono}T00:00`) > teraz) dodaj('E11', `${pole}.zrodla[${k}].sprawdzono`, 'Data sprawdzenia źródła jest w przyszłości albo absurdalnie wczesna.');
      });
    }

    if (!punktyDozwolone.has(p.punkty)) dodaj('E18', `${pole}.punkty`, `Punkty muszą wynosić 10, 15 albo 20 (jest ${p.punkty}).`);
    else if (WIEK[paczka.wiek] && p.punkty !== WIEK[paczka.wiek].punkty) {
      dodaj('E18', `${pole}.punkty`, `Dla kategorii wiekowej "${paczka.wiek}" protokół przewiduje ${WIEK[paczka.wiek].punkty} punktów, nie ${p.punkty}.`);
    }

    if (typeof p.tresc === 'string') {
      const klucz = normalizujTekst(p.tresc);
      if (widoczneTresci.has(klucz)) dodaj('E13', `${pole}.tresc`, `Pytanie powtarza treść pytania ${widoczneTresci.get(klucz)}.`);
      else widoczneTresci.set(klucz, p.id ?? `#${i}`);
      if (!czyZakotwiczone(p, okolica, oczekiwane.stacje ?? [])) {
        dodaj('E14', `${pole}.tresc`, 'Pytanie nie odnosi się do okolicy gry (brak nazwy miejsca albo obiektu z okolicy) — to pytanie z wiedzy ogólnej.');
      }
    }
  });

  // --- pokrycie stacji ---
  if (Number.isFinite(liczbaStacji) && liczbaStacji) {
    for (let s = 1; s <= liczbaStacji; s++) {
      if (!pytaniaNaStacje.has(s)) dodaj('E05', `stacja ${s}`, `Stacja ${s} nie ma żadnego pytania.`);
    }
    const licznosci = [...pytaniaNaStacje.values()];
    if (licznosci.length && Math.max(...licznosci) - Math.min(...licznosci) > 1) {
      dodaj('E05', 'pytania', `Rozkład pytań między stacje różni się o więcej niż jedno (${Math.min(...licznosci)}–${Math.max(...licznosci)}).`);
    }
  }

  return u;
}

/**
 * Tekst poprawki do wklejenia modelowi (ADR 0006 pkt 5): lista usterek
 * w języku protokołu, gotowa jako następny prompt.
 */
export function poprawkaDlaModelu(usterki, { liczbaPytan } = {}) {
  const linie = [
    'Twoja poprzednia odpowiedź została odrzucona przez walidator protokołu PYT/1.0.',
    'Popraw WYŁĄCZNIE poniższe usterki i zwróć cały blok JSON jeszcze raz — bez komentarzy poza blokiem.',
    '',
    'USTERKI:',
  ];
  for (const u of usterki) linie.push(`- [${u.kod}] ${u.pole ? `${u.pole}: ` : ''}${u.komunikat}`);
  if (Number.isFinite(liczbaPytan)) linie.push(`- wymagana liczba pytań: ${liczbaPytan}`);
  linie.push('', 'Przypomnienie zasad twardych: kwerenda internetowa dla każdego faktu, prawdziwy URL w "zrodla" przy każdym pytaniu, brak zmyślonych nazw i dat, wszystkie pytania o tę samą okolicę.');
  return linie.join('\n');
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
    punktyRazem: pytania.reduce((n, p) => n + (Number.isFinite(p.punkty) ? p.punkty : 0), 0),
    uwagi: typeof paczka?.uwagi === 'string' ? paczka.uwagi.trim() : '',
  };
}
