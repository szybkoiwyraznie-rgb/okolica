/**
 * `wieloosobowa.js` — M11/P2: gra wieloosobowa na wielu urządzeniach (ADR 0019).
 *
 * Moduł CZYSTY: schematy `RO-gra/1`, `RO-zdarzenie/1`, `RO-lobby/1`,
 * `RO-profil/1`, walidacje surowe (kody R01–R20), kody gier, sąsiedztwo
 * geohash5 (lobby „w najbliższej okolicy") i przeliczanie wyników.
 * Zero DOM, zero sieci, zero `node:` — warstwa DOM
 * (`app.js`) i synchronizacja (`sync.js`, P3) podają wyłącznie fakty.
 *
 * Zasada prywatności (ADR 0013/0019 pkt 3): współrzędne gracza NIGDY nie
 * wychodzą na Drive — `zbudujZdarzenie` przepuszcza `dane` przez BIAŁĄ listę
 * pól, a most kasuje zakazane pola dodatkowo po swojej stronie.
 */


export const SCHEMAT_GRY = 'RO-gra/1';
export const SCHEMAT_ZDARZENIA = 'RO-zdarzenie/1';
export const SCHEMAT_LOBBY = 'RO-lobby/1';
export const SCHEMAT_PROFILU = 'RO-profil/1'; // Partia 1 (3): PIN-profil pseudonimu (ADR 0021)

/** Alfabet kodu gry: bez 0/O/1/I — kod dyktuje się przez telefon (ADR 0019 pkt 1). */
export const ALFABET_KODU = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const DLUGOSC_KODU = 6;
export const MAKS_GRACZY = 8;

/** Tryby gry wieloosobowej (właściciel, 2026-09-11): „trasa” = Wspólna Trasa
 * (wszyscy TE SAME stacje PO KOLEI, każdy we własnym tempie), „wyscig” =
 * Wyścig na Orientację (dowolna kolejność stacji). Punktacja wspólna: 1 pkt
 * za dobrą odpowiedź + premia za kolejność ukończenia (ADR 0027 B). */
export const TRYBY_GRY = Object.freeze({ trasa: 'trasa', wyscig: 'wyscig' });
/**
 * Trzeci tryb: gra na jednym telefonie (hot-seat). Nie ma lobby ani zdarzeń na
 * żywo — wynik leci na Drive JEDNYM poleceniem po zakończeniu (ADR 0026 aneks).
 */
export const TRYB_HOTSEAT = 'hotseat';
export const STANY_GRY = Object.freeze(['lobby', 'trwa', 'zakonczona', 'archiwum']);
export const TYPY_ZDARZEN = Object.freeze(['start', 'dojscie', 'odpowiedz', 'rezygnacja', 'koniec']);

/** Biała lista pól `dane` zdarzenia — zero presji czasowej (Partia 2): czasów nie ma, cokolwiek innego NIE jedzie na Drive. */
export const POLA_DANYCH_ZDARZENIA = Object.freeze([
  'trybDojscia', 'poprawna', 'punktyRazem', 'powod',
]);

export const KODY_WIELOOSOBOWE = {
  R01: 'Stan gry nie jest poprawnym JSON-em.',
  R02: `To nie jest gra schematu „${SCHEMAT_GRY}" — pochodzi z innej wersji aplikacji.`,
  R03: 'Kod gry jest niepoprawny (oczekiwano 6 znaków z alfabetu bez 0, O, 1, I).',
  R04: 'Tryb gry jest nieznany (oczekiwano „trasa" albo „wyscig").',
  R05: 'Stan gry jest nieznany (oczekiwano lobby, trwa, zakonczona albo archiwum).',
  R06: 'Gra nie ma graczy — stan jest uszkodzony.',
  R07: 'Konfiguracja gry jest niekompletna (liczbaStacji, pytaniaNaStacje, wiek, tematy, miejsce, geohash5).',
  R08: 'Zestaw gry jest uszkodzony (stacje, kontener TO-paczka/2, meta).',
  R09: 'Zdarzenia gry są uszkodzone (kolejność, gracz, typ, czas serwera).',
  R10: 'Zdarzenie nie jest poprawnym JSON-em.',
  R11: `To nie jest zdarzenie schematu „${SCHEMAT_ZDARZENIA}".`,
  R12: 'Typ zdarzenia jest nieznany (start, dojscie, odpowiedz, rezygnacja, koniec).',
  R13: 'Zdarzenie nie wskazuje gry (kod albo idGry) albo gracza.',
  R14: 'Stacja zdarzenia jest poza zakresem gry albo ma zły typ.',
  R15: `Lista lobby nie jest poprawnym JSON-em albo ma inny schemat niż „${SCHEMAT_LOBBY}".`,
  R16: 'Część wpisów lobby jest uszkodzona — zostały odfiltrowane.',
  // R17 i R18 (błędy odpowiedzi RO-ranking/1) są WYCOFANE razem z rankingami
  // (właściciel, 2026-09-11). Numery zostają zajęte na stałe i nie dostaną
  // nowego znaczenia — inaczej starszy klient odczytałby cudzy błąd jako swój
  // (ten sam powód, dla którego E14 i E18 w pakietach są wycofane).
  R19: 'Nie mamy takiego pseudonimu — sprawdź pisownię albo zapisz go przyciskiem „Zapisz nowy".',
  R20: 'PIN jest niepoprawny albo nie pasuje do tego pseudonimu (4–8 cyfr).',
};

function usterka(kod) {
  return { kod, komunikat: KODY_WIELOOSOBOWE[kod] ?? kod };
}

/** Pseudonim do pliku profilu: przycięty, pojedyncze spacje, maks. 20 znaków. */
export function normalizujPseudonim(wartosc) {
  return String(wartosc ?? '').trim().replace(/\s+/g, ' ').slice(0, 20);
}

/** PIN-prosty (ADR 0021): 4–8 cyfr, bez spacji. */
export function czyPinPoprawny(pin) {
  return /^\d{4,8}$/.test(String(pin ?? '').trim());
}

/**
 * Profil zweryfikowany na tym telefonie (`okolica:profil`, ADR 0026): tylko
 * pseudonim i znacznik weryfikacji — PIN NIGDY nie jest zapisywany lokalnie
 * (ADR 0013: na telefonie zostaje minimum). `null` dla śmieci.
 */
export function walidujProfilLokalny(surowy) {
  if (!surowy || typeof surowy !== 'object') return null;
  if (surowy.schemat !== 'profil-lokalny/1') return null;
  const pseudonim = normalizujPseudonim(surowy.pseudonim);
  if (!pseudonim) return null;
  return { schemat: surowy.schemat, pseudonim, zweryfikowany: surowy.zweryfikowany === true, kiedy: surowy.kiedy ?? null };
}

/**
 * Lista graczy zapamiętana na tym telefonie (`okolica:gracze`, ADR 0026 aneks):
 * imiona + znacznik potwierdzenia na moście. PIN NIGDY nie jest zapisywany
 * lokalnie (ADR 0013) — dlatego zweryfikowany gracz wraca do gry bez pytania
 * o PIN (decyzja właściciela 2026-09-07). `null` dla śmieci.
 */
export function walidujGraczyLokalnych(surowy) {
  if (!surowy || typeof surowy !== 'object') return null;
  if (surowy.schemat !== 'gracze-lokalni/1') return null;
  if (!Array.isArray(surowy.gracze)) return null;
  const gracze = surowy.gracze
    .map((g) => (g && typeof g === 'object' ? { pseudonim: normalizujPseudonim(g.pseudonim), zweryfikowany: g.zweryfikowany === true } : null))
    .filter((g) => g && g.pseudonim)
    .slice(0, MAKS_GRACZY);
  if (!gracze.length) return null;
  return { schemat: surowy.schemat, gracze };
}

/** Jawna odmowa mostu przy profilu: kod R19/R20 → zdanie dla gracza. */
export function komunikatBleduProfilu(blad) {
  const kod = String(blad ?? '').trim();
  return KODY_WIELOOSOBOWE[kod] ?? `Most odmówił: ${kod || 'nieznany błąd'}.`;
}

/* ------------------------------------------------------------- kody gier */

/**
 * Generator kodu gry (6 znaków, alfabet bez mylących znaków).
 * `losuj` wstrzykiwalne — testy bez losowości (wzorzec: ziarno w stacjach).
 */
export function generujKod(losuj = Math.random) {
  let kod = '';
  for (let i = 0; i < DLUGOSC_KODU; i += 1) {
    kod += ALFABET_KODU[Math.floor(losuj() * ALFABET_KODU.length) % ALFABET_KODU.length];
  }
  return kod;
}

/** Normalizacja wpisanego kodu: wielkie litery, bez myślników/spacji. */
export function normalizujKod(tekst) {
  return String(tekst ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Kod poprawny = 6 znaków wyłącznie z alfabetu (0/O/1/I odrzucone jawnie). */
export function kodPoprawny(tekst) {
  const k = normalizujKod(tekst);
  return k.length === DLUGOSC_KODU && [...k].every((znak) => ALFABET_KODU.includes(znak));
}

// Ramka i sąsiedzi geohasha żyją w `geo.js` (geodezja, ADR 0024). Import, bo
// `filtrujLobby` używa ich w tym module, plus re-eksport, żeby importerzy
// (app.js, testy) nie zmieniały ścieżki.
import { ramkaGeohash, sasiednieGeohash } from './geo.js?v=m12-81';

export { ramkaGeohash, sasiednieGeohash };

/**
 * Zasięg ~50 m od hosta (właściciel, 2026-09-11): komórka geohash8 (~40 m)
 * + sąsiedzi; pozycja hosta z chwili założenia gry. Starsze mosty (przed
 * m12-74) nie zwracają geohash8 — wtedy fallback na geohash5 jak dotąd.
 */
export function filtrujLobby(wpisy, { geohash5, geohash8 } = {}) {
  if (!Array.isArray(wpisy)) return [];
  if (geohash8) {
    const dozwolone8 = new Set([String(geohash8).toLowerCase(), ...sasiednieGeohash(geohash8)]);
    return wpisy.filter((w) => dozwolone8.has(String(w?.geohash8 ?? '').toLowerCase()));
  }
  if (!geohash5) return [];
  const dozwolone = new Set([String(geohash5).toLowerCase(), ...sasiednieGeohash(geohash5)]);
  return wpisy.filter((w) => dozwolone.has(String(w?.geohash5 ?? '').toLowerCase()));
}

/* --------------------------------------------------- walidacje surowe */

function graczOk(g) {
  return g && typeof g.id === 'string' && /^g-\d+$/.test(g.id)
    && typeof g.pseudonim === 'string' && g.pseudonim.length > 0;
}

function konfiguracjaOk(k) {
  return k && k.liczbaStacji > 0 && k.pytaniaNaStacje > 0
    && typeof k.wiek === 'string' && Array.isArray(k.tematy) && k.tematy.length > 0
    && typeof k.miejsce === 'string' && typeof k.geohash5 === 'string' && k.geohash5.length === 5;
}

function zestawGryOk(z, liczbaStacji) {
  return z && Array.isArray(z.stacje) && z.stacje.length === liczbaStacji
    && z.stacje.every((s) => s && Number.isFinite(s.lat) && Number.isFinite(s.lon))
    && z.kontener && z.kontener.schemat === 'TO-paczka/2'
    && z.meta && typeof z.meta === 'object';
}

function zdarzenieWGrzeOk(z) {
  return z && Number.isInteger(z.kolejnosc) && z.kolejnosc >= 1
    && typeof z.graczId === 'string' && TYPY_ZDARZEN.includes(z.typ)
    && typeof z.tSerwera === 'string';
}

/** Stan gry z mostu → {gra, usterki}. Odmowa przy obcym schemacie (R02). */
export function walidujGreSurowa(tekst) {
  let surowa;
  try {
    surowa = JSON.parse(tekst);
  } catch {
    return { gra: null, usterki: [usterka('R01')] };
  }
  if (!surowa || typeof surowa !== 'object' || surowa.schemat !== SCHEMAT_GRY) {
    return { gra: null, usterki: [usterka('R02')] };
  }
  const usterki = [];
  if (!kodPoprawny(surowa.kod)) usterki.push(usterka('R03'));
  if (!Object.values(TRYBY_GRY).includes(surowa.tryb)) usterki.push(usterka('R04'));
  if (!STANY_GRY.includes(surowa.stan)) usterki.push(usterka('R05'));
  if (!Array.isArray(surowa.gracze) || !surowa.gracze.length || !surowa.gracze.every(graczOk)) usterki.push(usterka('R06'));
  if (!konfiguracjaOk(surowa.konfiguracja)) usterki.push(usterka('R07'));
  if (!zestawGryOk(surowa.zestaw, surowa.konfiguracja?.liczbaStacji)) usterki.push(usterka('R08'));
  if (!Array.isArray(surowa.zdarzenia) || !surowa.zdarzenia.every(zdarzenieWGrzeOk)) usterki.push(usterka('R09'));
  // trasaSekret (m12-74): top-level Boolean, opcjonalne — gry sprzed m12-74
  // nie mają tego pola i app traktuje brak przy trybie „trasa” jak sekret.
  if (surowa.trasaSekret !== undefined && typeof surowa.trasaSekret !== 'boolean') usterki.push(usterka('R04'));
  return { gra: usterki.length ? null : surowa, usterki };
}

/** Zdarzenie wychodzące/przychodzące → {zdarzenie, usterki}. */
export function walidujZdarzenieSurowe(tekst) {
  let surowe;
  try {
    surowe = JSON.parse(tekst);
  } catch {
    return { zdarzenie: null, usterki: [usterka('R10')] };
  }
  if (!surowe || typeof surowe !== 'object' || surowe.schemat !== SCHEMAT_ZDARZENIA) {
    return { zdarzenie: null, usterki: [usterka('R11')] };
  }
  const usterki = [];
  if (!TYPY_ZDARZEN.includes(surowe.typ)) usterki.push(usterka('R12'));
  if (typeof surowe.graczId !== 'string' || !surowe.graczId) usterki.push(usterka('R13'));
  if (!(typeof surowe.kod === 'string' && surowe.kod) && !(typeof surowe.idGry === 'string' && surowe.idGry)) usterki.push(usterka('R13'));
  if ((surowe.typ === 'dojscie' || surowe.typ === 'odpowiedz')
    && !(Number.isInteger(surowe.stacjaId) && surowe.stacjaId >= 1)) usterki.push(usterka('R14'));
  return { zdarzenie: usterki.length ? null : surowe, usterki };
}

function wpisLobbyOk(w) {
  return w && typeof w.idGry === 'string' && w.idGry.length > 0
    && Object.values(TRYBY_GRY).includes(w.tryb)
    && typeof w.geohash5 === 'string' && w.geohash5.length === 5
    && typeof w.miejsce === 'string' && w.liczbaGraczy > 0
    && (w.geohash8 === undefined || (typeof w.geohash8 === 'string' && w.geohash8.length === 8));
}

/** Lista lobby z mostu → {wpisy, usterki} (uszkodzone wpisy przefiltrowane, R16). */
export function walidujLobbySurowe(tekst) {
  let surowe;
  try {
    surowe = JSON.parse(tekst);
  } catch {
    return { wpisy: [], usterki: [usterka('R15')] };
  }
  if (!surowe || typeof surowe !== 'object' || surowe.schemat !== SCHEMAT_LOBBY || !Array.isArray(surowe.wpisy)) {
    return { wpisy: [], usterki: [usterka('R15')] };
  }
  const wpisy = surowe.wpisy.filter(wpisLobbyOk);
  return { wpisy, usterki: wpisy.length === surowe.wpisy.length ? [] : [usterka('R16')] };
}

/* ------------------------------------------------- zdarzenia (wysyłka) */

/** `dane` zdarzenia przez BIAŁĄ listę — jedyne miejsce, które decyduje, co jedzie na Drive. */
export function czyscDaneZdarzenia(dane = {}) {
  const czyste = {};
  for (const pole of POLA_DANYCH_ZDARZENIA) {
    if (dane?.[pole] !== undefined) czyste[pole] = dane[pole];
  }
  return czyste;
}

/**
 * Budowa zdarzenia RO-zdarzenie/1: `dane` przechodzą przez BIAŁĄ listę pól —
 * współrzędne i wszystko nieprzewidziane zostaje na telefonie (ADR 0019 pkt 3).
 */
export function zbudujZdarzenie({ kod, idGry, graczId, typ, stacjaId = null, dane = {}, tUrzadzenia = null } = {}) {
  if (!TYPY_ZDARZEN.includes(typ)) throw new TypeError(`zbudujZdarzenie: nieznany typ „${typ}"`);
  if (!graczId || !(kod || idGry)) throw new TypeError('zbudujZdarzenie: graczId i kod/idGry są wymagane');
  const czyste = czyscDaneZdarzenia(dane);
  const zdarzenie = { schemat: SCHEMAT_ZDARZENIA, graczId, typ, dane: czyste };
  if (kod) zdarzenie.kod = kod;
  if (idGry) zdarzenie.idGry = idGry;
  if (stacjaId != null) zdarzenie.stacjaId = Number(stacjaId);
  // tUrzadzenia: TYLKO skończona liczba ms (np. Date.now()) — ISO-tekst dałby
  // Number()=NaN, a JSON.stringify(NaN) to null, czyli śmieć w protokole.
  if (tUrzadzenia != null && Number.isFinite(Number(tUrzadzenia))) zdarzenie.tUrzadzenia = Number(tUrzadzenia);
  return zdarzenie;
}

/* ------------------------------ maszynka gry (lustra logiki mostu) */

/** Czy gra domknęła się zdarzeniami (oba tryby; rezygnacje zaliczone). */
export function czyKompletna(gra) {
  if (!gra) return false;
  const N = gra.konfiguracja?.liczbaStacji ?? 0;
  const rezygnacje = new Set((gra.zdarzenia ?? []).filter((z) => z.typ === 'rezygnacja').map((z) => z.graczId));
  // Wspólna Trasa i Wyścig domykają się tak samo: KAŻDY gracz zamyka wszystkie
  // stacje (w trasie po kolei, w wyścigu w dowolnej kolejności) albo rezygnuje.
  return (gra.gracze ?? []).every((g) => {
    if (rezygnacje.has(g.id)) return true;
    const stacje = new Set((gra.zdarzenia ?? []).filter((z) => z.graczId === g.id && z.typ === 'odpowiedz' && z.stacjaId != null).map((z) => Number(z.stacjaId)));
    return stacje.size >= N;
  });
}

/**
 * Postęp jednego gracza (żywa tabela w obu trybach). Pola i reguły
 * są IDENTYCZNE z `przeliczWyniki` w moście Drive — pilnuje tego
 * `test/most-gra.test.js`, więc telefon pokazuje to samo co Drive.
 */
export function postepGracza(gra, graczId) {
  const postep = { stacjeZamkniete: 0, punkty: 0, poprawne: 0, bledne: 0, czasOdcinkowMs: 0, zrezygnowal: false };
  for (const z of gra?.zdarzenia ?? []) {
    if (z.graczId !== graczId) continue;
    if (z.typ === 'dojscie') postep.czasOdcinkowMs += Number(z.dane?.czasOdcinkaMs) || 0;
    if (z.typ === 'odpowiedz') {
      postep.stacjeZamkniete += 1;
      postep.punkty += Number(z.dane?.punktyRazem) || 0;
      if (z.dane?.poprawna) postep.poprawne += 1; else postep.bledne += 1;
    }
    if (z.typ === 'rezygnacja') postep.zrezygnowal = true;
  }
  return postep;
}

/**
 * Premia za kolejność ukończenia (ADR 0027 część B pkt 5): pierwszy gracz, który
 * zamknął wszystkie stacje, dostaje (G − 1) punktów, drugi (G − 2), …, ostatni 0.
 *
 * - kolejność bierze się z `kolejnosc` zdarzeń nadawanej przez most, NIE z zegara
 *   urządzenia (ADR 0027 pkt 4) — dwa telefony nie mają wspólnego czasu;
 * - gracz, który zrezygnował albo nie zamknął wszystkich stacji (host
 *   zakończył grę wcześniej), premii nie dostaje — choć ukończenie przed
 *   końcem gry liczy się jak zwykle (właściciel, 2026-09-11);
 * - premia jest STAŁA: 3/2/1 pkt za 1./2./3. miejsce (4. i dalej: 0),
 *   niezależnie od liczby graczy (właściciel, 2026-09-11 — aneks ADR 0027);
 * - remis kolejności jest niemożliwy: `kolejnosc` jest nadawana sekwencyjnie
 *   w blokadzie zapisu mostu (`zBlokada`), więc każdy ma inną.
 *
 * Zwraca mapę `graczId → premia` (brak klucza = 0).
 */
export function premiaZaKolejnosc(gra) {
  const premia = {};
  const gracze = gra?.gracze ?? [];
  const N = Number(gra?.konfiguracja?.liczbaStacji) || 0;
  if (gracze.length < 2 || N < 1) return premia; // jeden gracz: premia zawsze 0
  // Hot-seat (jedna gra na jednym telefonie, ADR 0026 aneks): gracze idą razem,
  // więc „kto pierwszy skończył" jest artefaktem kolejności klikania — premii 0.
  if (gra?.tryb === TRYB_HOTSEAT) return premia;
  const rezygnacje = new Set((gra.zdarzenia ?? []).filter((z) => z.typ === 'rezygnacja').map((z) => z.graczId));
  const ostatnia = new Map();
  for (const z of gra.zdarzenia ?? []) {
    if (z.typ === 'odpowiedz' && z.stacjaId != null) ostatnia.set(z.graczId, Number(z.kolejnosc) || 0);
  }
  const skonczeni = gracze
    .map((g) => ({ id: g.id, postep: postepGracza(gra, g.id), koniec: ostatnia.get(g.id) ?? 0 }))
    .filter((w) => !w.postep.zrezygnowal && !rezygnacje.has(w.id) && w.postep.stacjeZamkniete >= N)
    .sort((a, b) => a.koniec - b.koniec);
  skonczeni.forEach((w, i) => {
    const ile = [3, 2, 1][i] ?? 0;
    if (ile > 0) premia[w.id] = ile;
  });
  return premia;
}

/**
 * Wyniki zbiorcze (to samo co `przeliczWyniki` w moście — aplikacja liczy
 * podgląd). Premia za kolejność jest liczona zawsze, ale do `punkty` wchodzi
 * DOPIERO w grze zakończonej (ADR 0027 pkt 5): częściowy wynik nie sugeruje
 * premii, której jeszcze nie ma.
 */
export function przeliczWyniki(gra) {
  const premia = premiaZaKolejnosc(gra);
  const koniec = gra?.stan === 'zakonczona' || gra?.stan === 'archiwum';
  const wyniki = {};
  for (const g of gra?.gracze ?? []) {
    const postep = postepGracza(gra, g.id);
    const ile = premia[g.id] ?? 0;
    wyniki[g.id] = {
      pseudonim: g.pseudonim,
      ...postep,
      premia: ile,
      punkty: postep.punkty + (koniec ? ile : 0),
    };
  }
  return wyniki;
}

/* ------- hot-seat: wynik gry z jednego telefonu na Drive (ADR 0026 aneks) ---- */

/**
 * Dziennik lokalnej gry (`app/rozgrywka.js`) → zdarzenia protokołu mostu.
 * Z dziennika bierzemy TYLKO dojścia i odpowiedzi — reszta (start, wybór
 * stacji, ostrzeżenia, pominięcia) jest lokalna. Pola `dane` idą przez tę samą
 * BIAŁĄ listę co w grze wieloosobowej, więc współrzędne, dokładność GPS i id
 * pytań zostają na telefonie (ADR 0019 pkt 3, ADR 0013).
 *
 * Punktacja liczy się na moście tym samym `przeliczWyniki` co w multi — telefon
 * nie wysyła gotowych punktów, tylko fakty, więc historia obu trybów jest spójna.
 */
export function zdarzeniaHotseatu(dziennik) {
  const zdarzenia = [];
  for (const wpis of Array.isArray(dziennik) ? dziennik : []) {
    if (wpis?.typ !== 'dojscie' && wpis?.typ !== 'odpowiedz') continue;
    const stacjaId = Number.isFinite(Number(wpis.stacja)) ? Number(wpis.stacja) : null;
    const dane = wpis.typ === 'dojscie'
      ? czyscDaneZdarzenia({ trybDojscia: wpis.trybDojscia })
      : czyscDaneZdarzenia({ poprawna: wpis.poprawna, punktyRazem: wpis.punkty });
    zdarzenia.push({ schemat: SCHEMAT_ZDARZENIA, graczId: wpis.gracz, typ: wpis.typ, stacjaId, dane });
  }
  return zdarzenia;
}

/**
 * Odcisk gry hot-seat (FNV-1a, 8 znaków hex) — klucz idempotencji wysyłki.
 *
 * Zgłoszenie właściciela (2026-09-09): na Drive przybywały pliki `gra-hotseat-*`
 * mimo braku nowych rozgrywek. Powód: kolejka wysyłana przy KAŻDYM starcie
 * aplikacji, a most zakładał nowy plik przy każdym żądaniu. Odcisk jedzie
 * w poleceniu i pozwala mostowi rozpoznać tę samą grę (nazwa pliku).
 *
 * Liczony z tekstu, bez `TextEncoder`: klucz jest zbudowany z kodu gry, czasu
 * startu i imion, więc znaki spoza ASCII kodujemy przez `charCodeAt` bajtowo
 * (ten sam wynik po obu stronach nie jest potrzebny — most klucza nie liczy).
 */
export function odciskHotseat(tekst) {
  let h = 0x811c9dc5;
  const s = String(tekst ?? '');
  for (let i = 0; i < s.length; i += 1) {
    const kod = s.charCodeAt(i);
    h ^= kod & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
    if (kod > 0xff) {
      h ^= (kod >> 8) & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Polecenie `gra-hotseat` — cała zakończona gra w jednym żądaniu. Walidacja jest
 * lokalnym lustrem `bledyGryHotseat` z mostu (Apps Script nie może importować
 * modułów, więc reguły są po dwóch stronach; zgodność pilnuje test kontraktu).
 *
 * Zwraca `{ ok: false, usterki }` zamiast rzucać: brak wyniku na Drive nigdy nie
 * może zepsuć gry, która właśnie się skończyła (ADR 0016 pkt 5).
 */
export function graHotseatDoWysylki({ miejsce, geohash5, wiek, tematy, liczbaStacji, pytaniaNaStacje, gracze, dziennik, kluczGry = '' } = {}) {
  const usterki = [];
  if (typeof miejsce !== 'string' || !miejsce.trim()) usterki.push('brak nazwy miejsca');
  if (!/^[0-9b-z]{5}$/.test(String(geohash5 ?? ''))) usterki.push('geohash5 musi mieć 5 znaków (przybliżenie okolicy, ADR 0024 pkt 4)');
  if (typeof wiek !== 'string' || !wiek.trim()) usterki.push('brak kategorii wieku');
  if (!Array.isArray(tematy) || !tematy.length) usterki.push('brak tematów');
  if (!(Number(liczbaStacji) > 0)) usterki.push('liczbaStacji musi być dodatnia');
  if (!(Number(pytaniaNaStacje) > 0)) usterki.push('pytaniaNaStacje musi być dodatnia');
  const lista = (Array.isArray(gracze) ? gracze : []).filter((g) => typeof g?.pseudonim === 'string' && g.pseudonim.trim());
  if (!lista.length) usterki.push('gra bez graczy nie ma wyniku');
  else if (lista.length > MAKS_GRACZY) usterki.push(`maksymalnie ${MAKS_GRACZY} graczy w jednej grze`);
  const zdarzenia = zdarzeniaHotseatu(dziennik);
  if (!zdarzenia.length) usterki.push('gra bez dojść i odpowiedzi — nie ma czego zapisywać');
  if (usterki.length) return { ok: false, usterki };
  return {
    ok: true,
    usterki: [],
    polecenie: {
      akcja: 'gra-hotseat',
      tryb: TRYB_HOTSEAT,
      konfiguracja: {
        miejsce: miejsce.trim(),
        geohash5,
        wiek: wiek.trim(),
        tematy: [...tematy],
        liczbaStacji: Number(liczbaStacji),
        pytaniaNaStacje: Number(pytaniaNaStacje),
      },
      gracze: lista.map((g) => ({ id: g.id, pseudonim: g.pseudonim.trim().slice(0, 24) })),
      zdarzenia,
      // Klucz idempotencji: most po nim rozpoznaje, że ta sama gra już u niego
      // jest, i NIE zakłada drugiego pliku (zgłoszenie właściciela 2026-09-09).
      odcisk: odciskHotseat(kluczGry || [miejsce, geohash5, lista.map((g) => g.pseudonim).join(','), zdarzenia.length].join('|')),
    },
  };
}

export const SCHEMAT_KOLEJKI_HOTSEAT = 'hotseat-kolejka/1';
export const SCHEMAT_WYSLANYCH_HOTSEAT = 'hotseat-wyslane/1';

/**
 * Kolejka wyników, które nie doszły na Drive (ADR 0016 pkt 5: awaria sieci nie
 * blokuje gry). Śmieciowy albo stary zapis daje pustą listę, nigdy wyjątku.
 */
export function walidujKolejkeHotseat(surowy) {
  if (surowy?.schemat !== SCHEMAT_KOLEJKI_HOTSEAT || !Array.isArray(surowy.gry)) return [];
  return surowy.gry.filter((g) => g?.akcja === 'gra-hotseat' && g?.tryb === TRYB_HOTSEAT
    && g?.konfiguracja && Array.isArray(g.gracze) && Array.isArray(g.zdarzenia));
}

/** Klucze gier już wysłanych — wynik jednej gry nie może wejść do historii dwa razy. */
export function walidujWyslaneHotseat(surowy) {
  if (surowy?.schemat !== SCHEMAT_WYSLANYCH_HOTSEAT || !Array.isArray(surowy.klucze)) return [];
  return surowy.klucze.filter((k) => typeof k === 'string' && k);
}
