/**
 * `wieloosobowa.js` — M11/P2: gra wieloosobowa na wielu urządzeniach (ADR 0019).
 *
 * Moduł CZYSTY: schematy `RO-gra/1`, `RO-zdarzenie/1`, `RO-lobby/1`,
 * `RO-ranking/1`, `RO-profil/1`, walidacje surowe (kody R01–R20), kody gier, sąsiedztwo
 * geohash5 (lobby „w najbliższej okolicy"), maszynka tur, przeliczanie wyników
 * i agregacje rankingów. Zero DOM, zero sieci, zero `node:` — warstwa DOM
 * (`app.js`) i synchronizacja (`sync.js`, P3) podają wyłącznie fakty.
 *
 * Zasada prywatności (ADR 0013/0019 pkt 3): współrzędne gracza NIGDY nie
 * wychodzą na Drive — `zbudujZdarzenie` przepuszcza `dane` przez BIAŁĄ listę
 * pól, a most kasuje zakazane pola dodatkowo po swojej stronie.
 */


export const SCHEMAT_GRY = 'RO-gra/1';
export const SCHEMAT_ZDARZENIA = 'RO-zdarzenie/1';
export const SCHEMAT_LOBBY = 'RO-lobby/1';
export const SCHEMAT_RANKINGU = 'RO-ranking/1';
export const SCHEMAT_PROFILU = 'RO-profil/1'; // Partia 1 (3): PIN-profil pseudonimu (ADR 0021)

/** Alfabet kodu gry: bez 0/O/1/I — kod dyktuje się przez telefon (ADR 0019 pkt 1). */
export const ALFABET_KODU = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const DLUGOSC_KODU = 6;
export const MAKS_GRACZY = 8;

export const TRYBY_GRY = Object.freeze({ wyscig: 'wyscig', tury: 'tury' });
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
  R04: 'Tryb gry jest nieznany (oczekiwano „wyscig" albo „tury").',
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
  R17: `Ranking nie jest poprawnym JSON-em albo ma inny schemat niż „${SCHEMAT_RANKINGU}".`,
  R18: 'Część wierszy rankingu jest uszkodzona — zostały odfiltrowane.',
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
import { ramkaGeohash, sasiednieGeohash } from './geo.js?v=m12-8';

export { ramkaGeohash, sasiednieGeohash };

export function filtrujLobby(wpisy, { geohash5 } = {}) {
  if (!Array.isArray(wpisy)) return [];
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
    && typeof w.miejsce === 'string' && w.liczbaGraczy > 0;
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

function wierszRankinguOk(w) {
  return w && typeof w.pseudonim === 'string' && w.pseudonim.length > 0
    && Number.isFinite(w.punkty) && Number.isFinite(w.poprawne) && Number.isFinite(w.bledne)
    && typeof w.geohash5 === 'string' && typeof w.wiek === 'string' && Array.isArray(w.tematy);
}

/** Ranking z mostu → {wiersze, usterki} (uszkodzone wiersze przefiltrowane, R18). */
export function walidujRankingSurowy(tekst) {
  let surowy;
  try {
    surowy = JSON.parse(tekst);
  } catch {
    return { wiersze: [], usterki: [usterka('R17')] };
  }
  if (!surowy || typeof surowy !== 'object' || surowy.schemat !== SCHEMAT_RANKINGU || !Array.isArray(surowy.wiersze)) {
    return { wiersze: [], usterki: [usterka('R17')] };
  }
  const wiersze = surowy.wiersze.filter(wierszRankinguOk);
  return { wiersze, usterki: wiersze.length === surowy.wiersze.length ? [] : [usterka('R18')] };
}

/* ------------------------------------------------- zdarzenia (wysyłka) */

/**
 * Budowa zdarzenia RO-zdarzenie/1: `dane` przechodzą przez BIAŁĄ listę pól —
 * współrzędne i wszystko nieprzewidziane zostaje na telefonie (ADR 0019 pkt 3).
 */
export function zbudujZdarzenie({ kod, idGry, graczId, typ, stacjaId = null, dane = {}, tUrzadzenia = null } = {}) {
  if (!TYPY_ZDARZEN.includes(typ)) throw new TypeError(`zbudujZdarzenie: nieznany typ „${typ}"`);
  if (!graczId || !(kod || idGry)) throw new TypeError('zbudujZdarzenie: graczId i kod/idGry są wymagane');
  const czyste = {};
  for (const pole of POLA_DANYCH_ZDARZENIA) {
    if (dane[pole] !== undefined) czyste[pole] = dane[pole];
  }
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

/**
 * Tury: stacja i (1-based) należy do gracza gracze[(i-1) % N] — kolejka jest
 * USTALONA przy starcie i nie przesuwa się; rezygnacja gracza POMIJA jego
 * stacje. Lustro `biezacyGraczTury` z mostu Apps Script (kontrakt pilnuje).
 */
export function biezacyGraczTury(gra) {
  if (!gra || gra.tryb !== TRYBY_GRY.tury) return null;
  const zamkniete = new Set();
  const rezygnacje = new Set();
  for (const z of gra.zdarzenia ?? []) {
    if (z.typ === 'odpowiedz' && z.stacjaId != null) zamkniete.add(Number(z.stacjaId));
    if (z.typ === 'rezygnacja') rezygnacje.add(z.graczId);
  }
  const N = (gra.gracze ?? []).length;
  if (!N) return null;
  // Uszkodzony stan z mostu (brak konfiguracji) to null, nie TypeError —
  // pętla pollingu nie może paść na cudzych danych (lustro .gs zakłada
  // poprawny stan, bo most go sam zapisał; telefon nie ma tej gwarancji).
  const liczbaStacji = gra.konfiguracja?.liczbaStacji ?? 0;
  if (!(liczbaStacji >= 1)) return null;
  for (let i = 1; i <= liczbaStacji; i += 1) {
    if (zamkniete.has(i)) continue;
    const wlasciciel = gra.gracze[(i - 1) % N];
    if (rezygnacje.has(wlasciciel.id)) continue; // stacje rezygnującego pominięte
    return wlasciciel.id;
  }
  return null; // wszystkie stacje zamknięte albo pominięte
}

/** Czy gra domknęła się zdarzeniami (oba tryby; rezygnacje zaliczone). */
export function czyKompletna(gra) {
  if (!gra) return false;
  const N = gra.konfiguracja?.liczbaStacji ?? 0;
  const rezygnacje = new Set((gra.zdarzenia ?? []).filter((z) => z.typ === 'rezygnacja').map((z) => z.graczId));
  if (gra.tryb === TRYBY_GRY.tury) {
    const zamkniete = new Set((gra.zdarzenia ?? []).filter((z) => z.typ === 'odpowiedz' && z.stacjaId != null).map((z) => Number(z.stacjaId)));
    const liczbaGraczy = (gra.gracze ?? []).length;
    if (!liczbaGraczy) return true;
    for (let i = 1; i <= N; i += 1) {
      const wlasciciel = gra.gracze[(i - 1) % liczbaGraczy];
      if (!zamkniete.has(i) && !rezygnacje.has(wlasciciel.id)) return false; // stacja czeka na właściciela
    }
    return true;
  }
  return (gra.gracze ?? []).every((g) => {
    if (rezygnacje.has(g.id)) return true;
    const stacje = new Set((gra.zdarzenia ?? []).filter((z) => z.graczId === g.id && z.typ === 'odpowiedz' && z.stacjaId != null).map((z) => Number(z.stacjaId)));
    return stacje.size >= N;
  });
}

/** Postęp jednego gracza (żywa tabela w wyścigu, resume w turach). */
export function postepGracza(gra, graczId) {
  const postep = { stacjeZamkniete: 0, punkty: 0, poprawne: 0, bledne: 0, zrezygnowal: false };
  for (const z of gra?.zdarzenia ?? []) {
    if (z.graczId !== graczId) continue;
    if (z.typ === 'odpowiedz') {
      postep.stacjeZamkniete += 1;
      postep.punkty += Number(z.dane?.punktyRazem) || 0;
      if (z.dane?.poprawna) postep.poprawne += 1; else postep.bledne += 1;
    }
    if (z.typ === 'rezygnacja') postep.zrezygnowal = true;
  }
  return postep;
}

/** Wyniki zbiorcze (to samo co `przeliczWyniki` w moście — aplikacja liczy podgląd). */
export function przeliczWyniki(gra) {
  const wyniki = {};
  for (const g of gra?.gracze ?? []) {
    wyniki[g.id] = { pseudonim: g.pseudonim, ...postepGracza(gra, g.id) };
  }
  return wyniki;
}

/* --------------------------------------------------- rankingi (M12/P6) */

/**
 * Agregacja wierszy rankingu per pseudonim z opcjonalnym filtrem kategorii:
 * `wiek`, `temat`, `geohash5` (ADR 0019 pkt 5 — „najlepsi w Podkowie Leśnej").
 * Sort: punkty malejąco → poprawne malejąco → pseudonim (stabilny remis).
 */
export function agregujRanking(wiersze, { wiek = null, temat = null, geohash5 = null } = {}) {
  const przefiltrowane = (Array.isArray(wiersze) ? wiersze : []).filter((w) => {
    if (wiek && w.wiek !== wiek) return false;
    if (temat && !(w.tematy ?? []).includes(temat)) return false;
    if (geohash5 && w.geohash5 !== geohash5) return false;
    return true;
  });
  const suma = new Map();
  for (const w of przefiltrowane) {
    const klucz = w.pseudonim;
    if (!suma.has(klucz)) suma.set(klucz, { pseudonim: klucz, punkty: 0, gry: 0, poprawne: 0, bledne: 0 });
    const s = suma.get(klucz);
    s.punkty += Number(w.punkty) || 0;
    s.gry += 1;
    s.poprawne += Number(w.poprawne) || 0;
    s.bledne += Number(w.bledne) || 0;
  }
  return [...suma.values()].sort((a, b) => b.punkty - a.punkty || b.poprawne - a.poprawne || a.pseudonim.localeCompare(b.pseudonim, 'pl'));
}

/** Dostępne kategorie z wierszy rankingu (do zakładek UI w P6). */
export function kategorieRankingu(wiersze) {
  const wieki = new Set();
  const tematy = new Set();
  const lokalizacje = new Map();
  for (const w of Array.isArray(wiersze) ? wiersze : []) {
    if (typeof w.wiek === 'string') wieki.add(w.wiek);
    for (const t of w.tematy ?? []) tematy.add(t);
    if (typeof w.geohash5 === 'string' && w.geohash5) {
      if (!lokalizacje.has(w.geohash5)) lokalizacje.set(w.geohash5, { geohash5: w.geohash5, miejsce: w.miejsce ?? w.geohash5 });
    }
  }
  return { wieki: [...wieki].sort(), tematy: [...tematy].sort(), lokalizacje: [...lokalizacje.values()] };
}
