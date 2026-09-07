/**
 * Trwałość (M6/M7) — czyste funkcje: snapshot stanu gry, walidacja, klucze,
 * historia gier. Bez DOM i bez zegara: `terazMs` podaje warstwa DOM
 * (ADR 0004 pkt 3).
 *
 * Zasady twarde:
 * - snapshot niesie UKRYTY kontener paczki (`TO-paczka/2`) i stan
 *   `rozgrywka/1` (referencje pytań `{stacja, pytanieId}`) — NIGDY treści
 *   pytań (ADR 0007 pkt 4, ADR 0010 pkt 3); strzeże tego test-strażnik;
 * - budżet 2 MB na zapis (jak cache sieci) — przekroczenie to jawny kod T07;
 * - wszystkie klucze mają przedrostek `okolica:` — dwustopniowe czyszczenie
 *   danych z ekranu prywatności (M3) kasuje zapis gry automatycznie;
 * - zepsuty zapis = jawna odmowa z kodem T, nigdy cichy start od zera.
 */
import { WERSJA_PROTOKOLU } from './protokol.js?v=m12-13';
import { FAZY, SCHEMAT_ROZGRYWKI } from './rozgrywka.js?v=m12-13';
import { SCHEMAT_KONTENERA } from './kodowanie.js?v=m12-13';
import { geohash } from './geo.js?v=m12-13';

export const SCHEMAT_STANU = 'stan-gry/1';

/** Wskaźnik aktywnej gry — po niego sięga start aplikacji (baner wznowienia). */
export const KLUCZ_AKTYWNEJ = 'okolica:gra-aktywna';

/** Budżet zapisu (bajty≈znaki JSON) — ten sam rząd co budżet cache sieci. */
export const BUDZET_STANU_BAJTY = 2_000_000;

export const KODY_TRWALOSCI = {
  T01: 'To nie jest poprawny JSON zapisu gry.',
  T02: `Zapis ma inny schemat niż „${SCHEMAT_STANU}" — pochodzi z innej wersji aplikacji.`,
  T03: 'Zapis dotyczy innej wersji protokołu pytań — nie da się go bezpiecznie wznowić.',
  T04: 'Stan rozgrywki w zapisie jest uszkodzony albo niekompletny.',
  T05: `Ukryta paczka w zapisie jest uszkodzona (oczekiwano kontenera ${SCHEMAT_KONTENERA}).`,
  T06: 'Konfiguracja gry w zapisie jest uszkodzona.',
  T07: 'Zapis gry przekracza budżet 2 MB — zakończ grę i zacznij nową.',
  T08: 'Zapis nie ma poprawnych czasów (zapisanoMs ścienne albo zegarMs sesji).',
  T09: 'Lista stacji w zapisie jest uszkodzona.',
  T10: 'Pozycja w zapisie jest uszkodzona (oczekiwano null albo {lat, lon}).',
  T11: 'Zapis nie zawiera nazwy ekranu (oczekiwano niepustego tekstu).',
  H01: 'To nie jest poprawny JSON historii gier.',
  H02: 'Historia ma inny schemat niż „historia/1" — pochodzi z innej wersji aplikacji.',
  H03: 'Lista wpisów historii jest uszkodzona (oczekiwano tablicy maks. 50 wpisów).',
  H04: 'Wpis historii jest uszkodzony albo niekompletny.',
};

function usterka(kod) {
  return { kod, komunikat: KODY_TRWALOSCI[kod] ?? kod };
}

function wymaganie(warunek, komunikat) {
  if (!warunek) throw new TypeError(komunikat);
}

const FAZY_ZNANE = new Set(Object.values(FAZY));

/** Kod gry do klucza: `[a-z0-9-]`, maks. 24 znaki — jak nazwa pliku z M5/J4. */
export function oczyscKodGry(kodGry) {
  const oczyszczony = String(kodGry ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
  return oczyszczony || 'gra';
}

/** Klucz localStorage zapisu konkretnej gry. */
export function kluczStanu(kodGry) {
  return `okolica:gra:${oczyscKodGry(kodGry)}`;
}

function czyStacjaOk(s) {
  return !!s && typeof s === 'object' && s.id != null
    && Number.isFinite(s.lat) && Number.isFinite(s.lon);
}

function czyRozgrywkaOk(r) {
  return !!r && typeof r === 'object'
    && r.schemat === SCHEMAT_ROZGRYWKI
    && FAZY_ZNANE.has(r.faza)
    && Array.isArray(r.stacje) && r.stacje.length > 0 && r.stacje.every(czyStacjaOk)
    && Array.isArray(r.odcinki) && r.odcinki.length > 0
    && Array.isArray(r.gracze) && r.gracze.length > 0
    && Array.isArray(r.pytania) && Array.isArray(r.odpowiedzi) && Array.isArray(r.dziennik);
}

function czyKontenerOk(k) {
  return !!k && typeof k === 'object'
    && k.schemat === SCHEMAT_KONTENERA
    && k.protokol === WERSJA_PROTOKOLU
    && typeof k.kodowanie === 'string' && k.kodowanie.length > 0
    && typeof k.skrot === 'string' && k.skrot.length > 0
    && typeof k.dane === 'string' && k.dane.length > 0;
}

function czyKonfigOk(k) {
  return !!k && typeof k === 'object'
    && typeof k.tryb === 'string' && k.tryb.length > 0
    && typeof k.kodGry === 'string';
}

function czyPozycjaOk(p) {
  return p === null || p === undefined
    || (!!p && typeof p === 'object' && Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

/**
 * Snapshot stanu gry. `kontenerPaczki` MUSI być kontenerem `TO-paczka/2`
 * (plaintext paczki nie ma prawa wejść do zapisu — ADR 0007 pkt 4);
 * `rozgrywka` — stanem `rozgrywka/1` z `nowaRozgrywka` i tranzycji;
 * `pozycja` — OSTATNIM fixem (historia fixów zostaje w pamięci pozycji,
 * do wznowienia wystarczy punkt startowy odcinka) albo null;
 * `zegarMs` — wskazaniem zegara gry (`performance.now()` minus pauzy) w chwili
 * zapisu: po restarcie przeglądarki zegar sesji startuje od zera, więc czasy
 * rozgrywki są przy wznowieniu rebazowane o różnicę — czas zamknięcia karty
 * nie wlicza się w odcinek (uczciwy pomiar, ADR 0004 pkt 3).
 */
export function zbierajStan({ konfig, stacje, kontenerPaczki, rozgrywka, pozycja = null, ekran = 'gra', terazMs, zegarMs } = {}) {
  wymaganie(czyKonfigOk(konfig), 'zbierajStan: konfig z tryb i kodGry jest wymagany');
  wymaganie(Array.isArray(stacje) && stacje.length > 0 && stacje.every(czyStacjaOk),
    'zbierajStan: stacje muszą być niepustą listą punktów {id, lat, lon}');
  wymaganie(czyKontenerOk(kontenerPaczki), `zbierajStan: kontenerPaczki musi być kontenerem ${SCHEMAT_KONTENERA}`);
  wymaganie(czyRozgrywkaOk(rozgrywka), `zbierajStan: rozgrywka musi być stanem ${SCHEMAT_ROZGRYWKI}`);
  wymaganie(czyPozycjaOk(pozycja), 'zbierajStan: pozycja to null albo {lat, lon}');
  wymaganie(typeof ekran === 'string' && ekran.length > 0, 'zbierajStan: ekran musi być nazwą');
  wymaganie(Number.isFinite(terazMs), 'zbierajStan: terazMs musi być liczbą (czas podaje warstwa DOM)');
  wymaganie(Number.isFinite(zegarMs), 'zbierajStan: zegarMs musi być liczbą (kotwica rebazy po wznowieniu)');

  return {
    schemat: SCHEMAT_STANU,
    wersjaProtokolu: WERSJA_PROTOKOLU,
    zapisanoMs: terazMs,
    zegarMs,
    konfig,
    stacje,
    kontenerPaczki,
    rozgrywka,
    pozycja: pozycja
      ? { lat: pozycja.lat, lon: pozycja.lon, dokladnoscM: Number.isFinite(pozycja.dokladnoscM) ? pozycja.dokladnoscM : null, zrodlo: typeof pozycja.zrodlo === 'string' ? pozycja.zrodlo : null }
      : null,
    ekran,
  };
}

/**
 * Serializacja z budżetem. Rzuca Error z `kod = 'T07'` przy przekroczeniu —
 * warstwa DOM komunikuje to użytkownikowi, zapis nie ląduje w localStorage
 * w kawałkach (localStorage.setItem i tak by się wysypał na quotę).
 */
export function serializujStan(snapshot) {
  wymaganie(snapshot && typeof snapshot === 'object' && snapshot.schemat === SCHEMAT_STANU,
    `serializujStan: oczekiwano snapshotu ${SCHEMAT_STANU}`);
  const tekst = JSON.stringify(snapshot);
  if (tekst.length > BUDZET_STANU_BAJTY) {
    const blad = new Error(`serializujStan: zapis ${tekst.length} znaków przekracza budżet ${BUDZET_STANU_BAJTY}`);
    blad.kod = 'T07';
    throw blad;
  }
  return tekst;
}

/**
 * Walidacja surowego tekstu z localStorage: `{ stan, usterki }` — jak
 * `walidujPaczke`: stan ALBO kompletny i poprawny, ALBO null z listą kodów.
 * Nigdy nie rzuca — zepsuty zapis jest stanem faktycznym, nie wyjątkiem.
 */
export function walidujStanSurowy(tekst) {
  if (typeof tekst !== 'string' || tekst.length === 0) return { stan: null, usterki: [usterka('T01')] };
  if (tekst.length > BUDZET_STANU_BAJTY) return { stan: null, usterki: [usterka('T07')] };
  let surowy;
  try {
    surowy = JSON.parse(tekst);
  } catch {
    return { stan: null, usterki: [usterka('T01')] };
  }
  if (!surowy || typeof surowy !== 'object' || Array.isArray(surowy)) {
    return { stan: null, usterki: [usterka('T01')] };
  }
  if (surowy.schemat !== SCHEMAT_STANU) return { stan: null, usterki: [usterka('T02')] };

  const usterki = [];
  if (surowy.wersjaProtokolu !== WERSJA_PROTOKOLU) usterki.push(usterka('T03'));
  if (!Number.isFinite(surowy.zapisanoMs) || !Number.isFinite(surowy.zegarMs)) usterki.push(usterka('T08'));
  if (!czyKonfigOk(surowy.konfig)) usterki.push(usterka('T06'));
  if (!Array.isArray(surowy.stacje) || surowy.stacje.length === 0 || !surowy.stacje.every(czyStacjaOk)) {
    usterki.push(usterka('T09'));
  }
  if (!czyKontenerOk(surowy.kontenerPaczki)) usterki.push(usterka('T05'));
  if (!czyRozgrywkaOk(surowy.rozgrywka)) usterki.push(usterka('T04'));
  if (!czyPozycjaOk(surowy.pozycja)) usterki.push(usterka('T10'));
  if (typeof surowy.ekran !== 'string' || surowy.ekran.length === 0) usterki.push(usterka('T11'));

  return { stan: usterki.length === 0 ? surowy : null, usterki };
}

/* ------------------------------------------------------------ historia gier */

/**
 * Historia gier (M7, ADR 0010 pkt 1): lista SKRÓTÓW ukończonych gier —
 * „skrót, nie treść". Wpis nie niesie pytań ani współrzędnych (ADR 0013):
 * miejsce jako nazwa (jeśli była pobrana) i `geohash6` środka (ten sam rząd
 * wielkości co klucz cache sieci — lokalny). Idempotencja po `klucz`:
 * wznowienie i dokończenie przerwanej gry ZASTĘPUJE wpis, nie duplikuje go.
 */
export const KLUCZ_HISTORII = 'okolica:historia';
export const SCHEMAT_HISTORII = 'historia/1';
export const SCHEMAT_WPISU_HISTORII = 'historia-gra/1';

/** Jawny limit listy: najstarsze wpisy wypadają (LRU jak w cache sieci). */
export const LIMIT_HISTORII = 50;

/** Pusta historia — punkt startu i kształt zapisu w `localStorage`. */
export function nowaHistoria() {
  return { schemat: SCHEMAT_HISTORII, wpisy: [] };
}

function czyPodsumowanieOk(p) {
  return !!p && typeof p === 'object'
    && Array.isArray(p.ranking)
    && Number.isFinite(p.punktyRazem)
    && Number.isFinite(p.zaliczoneStacje)
    && Number.isFinite(p.pominietaStacje);
}

function czyWpisHistoriiOk(w) {
  return !!w && typeof w === 'object'
    && w.schemat === SCHEMAT_WPISU_HISTORII
    && typeof w.klucz === 'string' && w.klucz.length > 0
    && typeof w.data === 'string' && !Number.isNaN(Date.parse(w.data))
    && (w.miejsce === null || typeof w.miejsce === 'string')
    && (w.geohash6 === null || typeof w.geohash6 === 'string')
    && typeof w.tryb === 'string' && w.tryb.length > 0
    && (w.wiek === null || typeof w.wiek === 'string')
    && Array.isArray(w.tematy)
    && Number.isFinite(w.liczbaGraczy) && Number.isFinite(w.liczbaStacji)
    && (w.zwyciezca === null || typeof w.zwyciezca === 'string')
    && Number.isFinite(w.punktyRazem)
    && Number.isFinite(w.zaliczoneStacje) && Number.isFinite(w.pominietaStacje)
    && typeof w.przerwana === 'boolean';
}

/**
 * Skrót gry do historii. `podsumowanie` — wynikiem z `rozgrywka.podsumowanie()`
 * (M7 nie liczy własnej matematyki); `terazMs` podaje warstwa DOM (zegar
 * wstrzykiwany, ADR 0004 pkt 3); `przerwana: true` dla ręcznego zakończenia —
 * dokończenie gry zastąpi wpis pełnym (ta sama `klucz`).
 */
export function skrotGry({ rozgrywka, konfig, stacje, podsumowanie, miejsce = null, terazMs, przerwana = false } = {}) {
  wymaganie(czyRozgrywkaOk(rozgrywka), `skrotGry: rozgrywka musi być stanem ${SCHEMAT_ROZGRYWKI}`);
  wymaganie(czyKonfigOk(konfig), 'skrotGry: konfig z tryb i kodGry jest wymagany');
  wymaganie(Array.isArray(stacje) && stacje.length > 0 && stacje.every(czyStacjaOk),
    'skrotGry: stacje muszą być niepustą listą punktów {id, lat, lon}');
  wymaganie(czyPodsumowanieOk(podsumowanie), 'skrotGry: podsumowanie musi być wynikiem rozgrywka.podsumowanie()');
  wymaganie(miejsce === null || typeof miejsce === 'string', 'skrotGry: miejsce to nazwa albo null');
  wymaganie(Number.isFinite(terazMs), 'skrotGry: terazMs musi być liczbą (czas podaje warstwa DOM)');

  const zwyciezca = rozgrywka.gracze.find((g) => g.id === podsumowanie.zwyciezca)?.imie ?? null;
  const srodek = Number.isFinite(rozgrywka.start?.lat) && Number.isFinite(rozgrywka.start?.lon)
    ? rozgrywka.start
    : null;
  return {
    schemat: SCHEMAT_WPISU_HISTORII,
    klucz: oczyscKodGry(konfig.kodGry),
    data: new Date(terazMs).toISOString(),
    miejsce: miejsce && miejsce.trim() ? miejsce.trim().slice(0, 80) : null,
    geohash6: srodek ? geohash(srodek.lat, srodek.lon, 6) : null,
    tryb: konfig.tryb,
    wiek: typeof konfig.wiek === 'string' && konfig.wiek ? konfig.wiek : null,
    tematy: Array.isArray(konfig.tematy) ? [...konfig.tematy] : [],
    liczbaGraczy: rozgrywka.gracze.length,
    liczbaStacji: stacje.length,
    zwyciezca,
    punktyRazem: podsumowanie.punktyRazem,
    zaliczoneStacje: podsumowanie.zaliczoneStacje,
    pominietaStacje: podsumowanie.pominietaStacje,
    przerwana: Boolean(przerwana),
  };
}

/**
 * Dołożenie wpisu: niezmiennikowo (zwraca nową historię), ZASTĘPUJE wpis
 * o tym samym `klucz` (idempotencja — dokończenie przerwanej gry nie robi
 * dubla), dokłada na koniec (najnowszy ostatni) i trzyma limit `LIMIT_HISTORII`
 * (najstarsze wypadają).
 */
export function dodajWpisHistorii(historia, wpis) {
  wymaganie(historia && typeof historia === 'object' && historia.schemat === SCHEMAT_HISTORII && Array.isArray(historia.wpisy),
    `dodajWpisHistorii: oczekiwano historii ${SCHEMAT_HISTORII}`);
  wymaganie(czyWpisHistoriiOk(wpis), `dodajWpisHistorii: wpis musi być skrótem ${SCHEMAT_WPISU_HISTORII}`);
  const wpisy = [...historia.wpisy.filter((w) => w?.klucz !== wpis.klucz), wpis];
  const przyciete = wpisy.length > LIMIT_HISTORII ? wpisy.slice(wpisy.length - LIMIT_HISTORII) : wpisy;
  return { schemat: SCHEMAT_HISTORII, wpisy: przyciete };
}

/**
 * Walidacja surowego tekstu historii z `localStorage`: `{ historia, usterki }`
 * — atomowa jak `walidujStanSurowy`: całość przechodzi ALBO null z kodami H
 * (nigdy częściowo oczyszczona lista po cichu — ADR 0010 pkt 6: zepsuty zapis
 * to jawny komunikat z ofertą kasowania, nie ciche odrzucenie).
 */
export function walidujHistorieSurowa(tekst) {
  if (typeof tekst !== 'string' || tekst.length === 0) return { historia: null, usterki: [usterka('H01')] };
  let surowy;
  try {
    surowy = JSON.parse(tekst);
  } catch {
    return { historia: null, usterki: [usterka('H01')] };
  }
  if (!surowy || typeof surowy !== 'object' || Array.isArray(surowy)) {
    return { historia: null, usterki: [usterka('H01')] };
  }
  if (surowy.schemat !== SCHEMAT_HISTORII) return { historia: null, usterki: [usterka('H02')] };

  const usterki = [];
  if (!Array.isArray(surowy.wpisy) || surowy.wpisy.length > LIMIT_HISTORII) {
    usterki.push(usterka('H03'));
  } else if (!surowy.wpisy.every(czyWpisHistoriiOk)) {
    usterki.push(usterka('H04'));
  }
  return { historia: usterki.length === 0 ? surowy : null, usterki };
}
