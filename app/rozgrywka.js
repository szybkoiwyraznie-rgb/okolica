/**
 * rozgrywka.js — model stanu gry: kolejki graczy, odcinki i czasy, odpowiedzi,
 * punktacja, dziennik zdarzeń, podsumowanie.
 *
 * Same czyste funkcje: bez DOM, bez sieci i **bez `Date.now()` /
 * `performance.now()` w środku** — czas jest parametrem (`czasMs`), więc przebieg
 * gry da się odtworzyć w teście co do milisekundy (AGENTS.md, ADR 0004 pkt 3).
 *
 * Dwie zasady, których ten moduł pilnuje:
 * - **Stan jest niezmiennikowy** — każda funkcja zwraca nowy obiekt (`kopia`),
 *   nigdy nie mutuje argumentu. UI trzyma referencje, a stan gry bywa
 *   odtwarzany z dziennika (ARCHITECTURE „Stan i trwałość").
 * - **Stan nie zawiera treści pytań** (ADR 0007 pkt 6) — tylko identyfikatory,
 *   poprawność i punkty. Dlatego może trafić do `localStorage` i do eksportu.
 *
 * Punktacja: dotarcie + poprawna odpowiedź (Partia 2: koniec premii czasowej,
 * ADR 0014 wycofany). Znaczniki czasu w dzienniku służą tylko kolejności zdarzeń.
 */

import { odlegloscM } from './geo.js?v=m12-49';

/** Schemat stanu — podstawa migracji i jawnej odmowy przy obcej wersji (ADR 0010 pkt 6). */
export const SCHEMAT_ROZGRYWKI = 'rozgrywka/1';

/** Fazy gry. UI rysuje po nich ekrany; logika odmawia akcji poza fazą. */
export const FAZY = {
  przygotowanie: 'przygotowanie',
  odcinek: 'odcinek',
  pytanie: 'pytanie',
  koniec: 'koniec',
};

/** Jak gracz zgłosił dojście (ADR 0004 pkt 5 — tryb ręczny jest częścią gry). */
export const TRYBY_DOJSCIA = { gps: 'gps', reczne: 'reczne' };

/** Stany odcinka. */
export const STANY_ODCINKA = {
  oczekuje: 'oczekuje',
  wTrakcie: 'w-trakcie',
  zakonczony: 'zakonczony',
  pominiety: 'pominiety',
};

/** Kody usterek rozgrywki — trafiają wprost do komunikatów UI. */
export const KODY_ROZGRYWKI = {
  G01: 'Nieznana stacja — nie ma jej w tej rozgrywce.',
  G02: 'Nieznany gracz — nie ma go w tej rozgrywce.',
  G03: 'Ten odcinek jest już rozpoczęty albo zakończony.',
  G04: 'Odcinek nie jest w trakcie — nie ma czego kończyć.',
  G05: 'Do tej stacji nie przypisano pytania w paczce.',
  G06: 'Ten gracz już odpowiedział na pytanie tej stacji.',
  G07: 'Na tę stację odpowiada gracz z kolejki — nie Twoja kolej.',
  G08: 'Odpowiedź musi być jedną z czterech (0–3).',
  G09: 'Czas zakończenia jest wcześniejszy niż start odcinka.',
  G10: 'Gra jest już zakończona — ten ruch nie zmieni wyniku. Zobacz podsumowanie.',
  G11: 'Odcinek nie był rozpoczęty — nie można go pominąć.',
  G12: 'Nieznany albo uszkodzony schemat stanu rozgrywki.',
  G13: 'Gracz już doszedł do tej stacji — pominąć można tylko odcinek w drodze. '
    + 'Odpowiedz na pytanie (nawet błędnie), żeby gra poszła dalej.',
  G14: 'Ta stacja jest już zamknięta albo pominięta — wybierz inną.',
};

function usterka(kod) {
  return { kod, komunikat: KODY_ROZGRYWKI[kod] ?? kod };
}

/** Głęboka kopia stanu — funkcje zwracają nowy obiekt, argument zostaje nietknięty. */
function kopia(stan) {
  return structuredClone(stan);
}

function wymaganie(warunek, komunikat) {
  if (!warunek) throw new TypeError(komunikat);
}

function dodajZdarzenie(stan, czasMs, typ, dane = {}) {
  stan.dziennik.push({ czasMs, typ, ...dane });
}

/**
 * Dystans odcinka: od punktu startu gry (pierwsza stacja) albo od poprzedniej
 * stacji (każda kolejna). Prosta linia (haversine) — od M4 wchodzi dystans
 * sieciowy z ADR 0005 i ta funkcja się nie zmieni w sygnaturze.
 */
export function dystansOdcinkaM(stan, stacjaId) {
  const indeks = stan.stacje.findIndex((s) => s.id === stacjaId);
  if (indeks < 0) return 0;
  const punkt = indeks === 0 ? stan.start : stan.stacje[indeks - 1];
  return Math.round(odlegloscM(punkt, stan.stacje[indeks]));
}

/**
 * Nowa rozgrywka. Kolejka graczy jest cykliczna: `gracz = stacja mod N`
 * (ADR 0009 pkt 2) — dzięki temu przy 3 graczach i 5 stacjach każdy idzie
 * co najmniej raz, a różnica liczby odcinków wynosi najwyżej 1.
 *
 * @param {object} args
 * @param {object} args.konfig   konfiguracja gry (po `walidujSetup`)
 * @param {Array}  args.stacje   stacje z `app/stacje.js` (id, lat, lon)
 * @param {object} args.paczka   paczka PYT — brane są TYLKO `pytania[].stacja` i `pytania[].id`
 * @param {object} args.srodek   punkt startu gry `{lat, lon}`
 * @param {Array}  [args.gracze] `[{id, imie}]`; domyślnie z `konfig.imiona`
 * @param {number} [args.czasMs] znacznik startu z wstrzykniętego zegara
 * @param {string} [args.ziarno] ziarno rozgrywki (odtwarzalność, ADR 0005 pkt 6)
 */
export function nowaRozgrywka({ konfig, stacje, paczka, srodek, gracze = null, czasMs = 0, ziarno = '', dystanseOdcinkowM = null }) {
  wymaganie(konfig && typeof konfig === 'object', 'konfig jest wymagany');
  wymaganie(Array.isArray(stacje) && stacje.length > 0, 'stacje muszą być niepustą listą');
  wymaganie(paczka && Array.isArray(paczka.pytania) && paczka.pytania.length > 0, 'paczka z pytaniami jest wymagana');
  wymaganie(srodek && Number.isFinite(srodek.lat) && Number.isFinite(srodek.lon), 'srodek musi mieć lat i lon');
  wymaganie(Number.isFinite(czasMs), 'czasMs musi być liczbą');
  // Dystanse sieciowe (ADR 0014 pkt 1): tablica długości N z liczbami albo
  // nullami; null na pozycji = fallback do linii prostej dla tego odcinka.
  // Brak parametru (zestawy, multi, stare ścieżki) = w całości prosta kreska.
  wymaganie(dystanseOdcinkowM === null || (Array.isArray(dystanseOdcinkowM) && dystanseOdcinkowM.length === stacje.length),
    'dystanseOdcinkowM muszą być tablicą długości równej liczbie stacji albo null');

  const listaGraczy = (gracze ?? (konfig.imiona ?? []).map((imie, i) => ({ id: i + 1, imie })))
    .map((g, i) => ({ id: g?.id ?? i + 1, imie: String(g?.imie ?? `Gracz ${i + 1}`) }));
  wymaganie(listaGraczy.length > 0, 'rozgrywka wymaga co najmniej jednego gracza');

  const pytania = paczka.pytania.map((p) => ({ stacja: p.stacja, pytanieId: p.id }));

  const stan = {
    schemat: SCHEMAT_ROZGRYWKI,
    ziarno: String(ziarno),
    kodGry: String(konfig.kodGry ?? ''),
    tryb: konfig.tryb,
    start: { lat: srodek.lat, lon: srodek.lon },
    startMs: czasMs,
    gracze: listaGraczy,
    stacje: stacje.map((s) => ({ id: s.id, lat: s.lat, lon: s.lon, opis: s.opis ?? '' })),
    pytania,
    odcinki: stacje.map((s, i) => ({
      stacja: s.id,
      gracz: listaGraczy[i % listaGraczy.length].id,
      stan: STANY_ODCINKA.oczekuje,
      startMs: null,
      koniecMs: null,
      trybDojscia: null,
      accuracyM: null,
      odlegloscKoncowaM: null,
      dystansM: Number.isFinite(dystanseOdcinkowM?.[i]) && dystanseOdcinkowM[i] >= 0
        ? Math.round(dystanseOdcinkowM[i])
        : dystansOdcinkaM({ stacje, start: srodek }, s.id),
      dystansSieciowy: Number.isFinite(dystanseOdcinkowM?.[i]) && dystanseOdcinkowM[i] >= 0,
    })),
    odpowiedzi: [],
    dziennik: [],
    faza: FAZY.przygotowanie,
    biezacaStacja: stacje[0].id,
    // Stacje bez pytania w paczce: gra się nie zatrzymuje (paczka bywa
    // doczytywana później — M5), ale brak ma być widoczny, nie „cichy".
    brakPytan: stacje.map((s) => s.id).filter((id) => !pytania.some((p) => p.stacja === id)),
  };
  dodajZdarzenie(stan, czasMs, 'start', {
    graczy: listaGraczy.length,
    stacji: stacje.length,
    pytan: pytania.length,
  });
  if (stan.brakPytan.length > 0) {
    dodajZdarzenie(stan, czasMs, 'ostrzezenie', {
      kod: 'BRAK-PYTAN',
      stacje: stan.brakPytan,
      komunikat: `Paczka nie ma pytań do stacji: ${stan.brakPytan.join(', ')}. `
        + 'Do takiej stacji da się dojść, ale nie ma czego odpowiedzieć — stacja '
        + 'zamyka się bez punktów. Wgraj paczkę z pełnym pokryciem (protokół §3.2).',
    });
  }
  return stan;
}

function znajdzOdcinek(stan, stacjaId) {
  return stan.odcinki.find((o) => o.stacja === stacjaId) ?? null;
}

function znajdzGracza(stan, graczId) {
  return stan.gracze.find((g) => g.id === graczId) ?? null;
}

/** Gracz z kolejki na daną stację (ADR 0009 pkt 2). */
export function graczNaStacji(stan, stacjaId = stan.biezacaStacja) {
  const odcinek = znajdzOdcinek(stan, stacjaId);
  return odcinek ? odcinek.gracz : null;
}

/**
 * Kto odpowiada na pytanie tej stacji: ZAWSZE gracz z kolejki (ADR 0022 —
 * wybór trybu odpowiadania usunięty z setupu, zastępuje ADR 0009 pkt 4).
 */
export function ktoOdpowiada(stan, stacjaId = stan.biezacaStacja) {
  const zKolejki = graczNaStacji(stan, stacjaId);
  return zKolejki == null ? [] : [zKolejki];
}

/** Pytania przypisane do stacji (bez treści — ADR 0007 pkt 6). */
export function pytaniaStacji(stan, stacjaId) {
  return stan.pytania.filter((p) => p.stacja === stacjaId).map((p) => p.pytanieId);
}

/** Czy ten gracz odpowiedział już na TO pytanie tej stacji (`pytaniaNaStacje` bywa > 1). */
function juzOdpowiedzial(stan, stacjaId, graczId, pytanieId) {
  return stan.odpowiedzi.some((o) => o.stacja === stacjaId && o.gracz === graczId && o.pytanieId === pytanieId);
}

/**
 * Czy stacja jest zamknięta: każdy, kto miał odpowiadać, odpowiedział na każde
 * pytanie przypisane do stacji (protokół §3.2: stacja ma ≥ 1 pytanie, rozkład
 * równy ±1).
 */
function stacjaZamknieta(stan, stacjaId) {
  const odcinek = znajdzOdcinek(stan, stacjaId);
  if (!odcinek || odcinek.stan === STANY_ODCINKA.pominiety) return true;
  if (odcinek.stan !== STANY_ODCINKA.zakonczony) return false;
  const pytania = pytaniaStacji(stan, stacjaId);
  if (pytania.length === 0) return true;
  return ktoOdpowiada(stan, stacjaId).every((id) => pytania.every((pid) => juzOdpowiedzial(stan, stacjaId, id, pid)));
}

function przejdzDalej(stan, czasMs) {
  const nastepna = stan.stacje.find((s) => !stacjaZamknieta(stan, s.id));
  if (!nastepna) {
    stan.biezacaStacja = null;
    stan.faza = FAZY.koniec;
    dodajZdarzenie(stan, czasMs, 'koniec');
    return;
  }
  stan.biezacaStacja = nastepna.id;
  const odcinek = znajdzOdcinek(stan, nastepna.id);
  stan.faza = odcinek && odcinek.stan === STANY_ODCINKA.zakonczony ? FAZY.pytanie : FAZY.przygotowanie;
}

/**
 * Wolna kolejność stacji (ADR 0027 część B pkt 2): w grze sieciowej bez tur
 * gracz wybiera DOWOLNĄ stację, do której jeszcze nie doszedł, zamiast iść po
 * kolei. Wybór jest jawny (kliknięcie), a odcinek zaczyna się osobno — przez
 * `startOdcinka`, które i tak przyjmuje `stacjaId`.
 *
 * Silnik nie zgaduje trasy i nie blokuje: jedyna reguła to „nie ta sama stacja
 * drugi raz" (G14) i „nie po końcu gry" (G10). Kto pierwszy zamknie wszystkie
 * stacje, dostaje premię (ADR 0027 pkt 5) — liczy ją most, nie ten moduł.
 */
export function skierujDoStacji(stan, { stacjaId, czasMs } = {}) {
  wymaganie(Number.isFinite(czasMs), 'czasMs jest wymagany');
  const nowy = kopia(stan);
  const odcinek = znajdzOdcinek(nowy, stacjaId);
  if (!odcinek) return { stan: nowy, usterki: [usterka('G01')] };
  if (nowy.faza === FAZY.koniec) return { stan: nowy, usterki: [usterka('G10')] };
  if (odcinek.stan !== STANY_ODCINKA.oczekuje) return { stan: nowy, usterki: [usterka('G14')] };
  nowy.biezacaStacja = stacjaId;
  nowy.faza = FAZY.przygotowanie;
  dodajZdarzenie(nowy, czasMs, 'wybor-stacji', { stacja: stacjaId });
  return { stan: nowy, usterki: [] };
}

/** Stacje, które ten gracz może jeszcze wybrać (wolna kolejność). */
export function stacjeDoWyboru(stan) {
  return stan.odcinki
    .filter((o) => o.stan === STANY_ODCINKA.oczekuje)
    .map((o) => o.stacja);
}

/**
 * Start odcinka — **na jawnej akcji użytkownika**, nie automatycznie
 * (ADR 0004 pkt 3). `czasMs` pochodzi z `performance.now()` w warstwie UI.
 */
export function startOdcinka(stan, { stacjaId = stan.biezacaStacja, czasMs } = {}) {
  wymaganie(Number.isFinite(czasMs), 'czasMs jest wymagany');
  const nowy = kopia(stan);
  const odcinek = znajdzOdcinek(nowy, stacjaId);
  if (!odcinek) return { stan: nowy, usterki: [usterka('G01')] };
  if (nowy.faza === FAZY.koniec) return { stan: nowy, usterki: [usterka('G10')] };
  if (odcinek.stan !== STANY_ODCINKA.oczekuje) return { stan: nowy, usterki: [usterka('G03')] };

  odcinek.stan = STANY_ODCINKA.wTrakcie;
  odcinek.startMs = czasMs;
  odcinek.dystansM = dystansOdcinkaM(nowy, stacjaId);
  nowy.biezacaStacja = stacjaId;
  nowy.faza = FAZY.odcinek;
  dodajZdarzenie(nowy, czasMs, 'start-odcinka', { stacja: stacjaId, gracz: odcinek.gracz, dystansM: odcinek.dystansM });
  return { stan: nowy, usterki: [] };
}

/**
 * Zakończenie odcinka: dojście z GPS (`trybDojscia: 'gps'`) albo ręczne
 * zgłoszenie (`'reczne'`), odnotowane w dzienniku bez kary (Partia 2: zero
 * presji czasowej — tryb ręczny jest pełnoprawny, ADR 0004 pkt 5).
 *
 * @param {object} [args.fix] ostatni fix GPS `{lat, lon, accuracy}` — do dziennika
 */
export function zakonczOdcinek(stan, { stacjaId = stan.biezacaStacja, czasMs, trybDojscia = TRYBY_DOJSCIA.gps, fix = null } = {}) {
  wymaganie(Number.isFinite(czasMs), 'czasMs jest wymagany');
  wymaganie(Object.values(TRYBY_DOJSCIA).includes(trybDojscia), `nieznany tryb dojścia „${trybDojscia}"`);
  const nowy = kopia(stan);
  const odcinek = znajdzOdcinek(nowy, stacjaId);
  if (!odcinek) return { stan: nowy, usterki: [usterka('G01')] };
  if (odcinek.stan === STANY_ODCINKA.oczekuje || odcinek.stan === STANY_ODCINKA.pominiety) {
    return { stan: nowy, usterki: [usterka('G04')] };
  }
  if (odcinek.stan === STANY_ODCINKA.zakonczony) return { stan: nowy, usterki: [usterka('G03')] };
  if (czasMs < odcinek.startMs) return { stan: nowy, usterki: [usterka('G09')] };

  odcinek.stan = STANY_ODCINKA.zakonczony;
  odcinek.koniecMs = czasMs;
  odcinek.trybDojscia = trybDojscia;
  odcinek.accuracyM = fix && Number.isFinite(fix.accuracy) ? Math.round(fix.accuracy) : null;
  odcinek.odlegloscKoncowaM = fix ? Math.round(odlegloscM(fix, nowy.stacje.find((s) => s.id === stacjaId))) : null;
  nowy.faza = FAZY.pytanie;
  nowy.biezacaStacja = stacjaId;
  dodajZdarzenie(nowy, czasMs, 'dojscie', {
    stacja: stacjaId,
    gracz: odcinek.gracz,
    trybDojscia,
    accuracyM: odcinek.accuracyM,
  });
  // Stacja bez pytania w paczce (`brakPytan`) zamyka się samym dojściem: bez tego
  // gra stanęłaby w fazie `pytanie` z pustym ekranem i bez akcji, która ruszyłaby
  // ją dalej. Jawne ostrzeżenie o braku jest w dzienniku od `nowaRozgrywka`.
  if (stacjaZamknieta(nowy, stacjaId)) przejdzDalej(nowy, czasMs);
  return { stan: nowy, usterki: [] };
}

/**
 * Pominięcie stacji (w terenie bywa nieosiągalna: remont, zamknięty park,
 * ślepy zaułek bez przejścia). Działa **tylko w drodze** — po dojściu gracz
 * odpowiada na pytanie, nawet błędnie (`G13`), żeby nie kasować faktu dojścia.
 *
 * Odcinek dostaje stan `pominiety`, punkty przepadają. Zdarzenie z powodem
 * idzie do dziennika: wynik ma być wyjaśnialny, nie „magicznie" krótszy.
 */
export function pominStacje(stan, { stacjaId = stan.biezacaStacja, czasMs, powod = '' } = {}) {
  wymaganie(Number.isFinite(czasMs), 'czasMs jest wymagany');
  const nowy = kopia(stan);
  const odcinek = znajdzOdcinek(nowy, stacjaId);
  if (!odcinek) return { stan: nowy, usterki: [usterka('G01')] };
  if (odcinek.stan === STANY_ODCINKA.oczekuje) return { stan: nowy, usterki: [usterka('G11')] };
  if (odcinek.stan === STANY_ODCINKA.zakonczony) return { stan: nowy, usterki: [usterka('G13')] };
  if (odcinek.stan === STANY_ODCINKA.pominiety) return { stan: nowy, usterki: [usterka('G03')] };

  odcinek.stan = STANY_ODCINKA.pominiety;
  odcinek.koniecMs = czasMs;
  dodajZdarzenie(nowy, czasMs, 'pominiecie', { stacja: stacjaId, gracz: odcinek.gracz, powod: String(powod) });
  przejdzDalej(nowy, czasMs);
  return { stan: nowy, usterki: [] };
}

/**
 * Zapis odpowiedzi. Treść pytania NIE wchodzi do stanu (ADR 0007 pkt 6) —
 * wywołujący podaje `{ id, poprawna, punkty }` z odsłoniętej paczki.
 *
 * @param {object} args.pytanie `{ id, poprawna, punkty }`
 * @param {number} args.wybrana indeks odpowiedzi 0–3
 * @param {number} [args.graczId] domyślnie gracz z kolejki (albo pierwszy z listy przy `wszyscy`)
 */
export function zapiszOdpowiedz(stan, { stacjaId = stan.biezacaStacja, graczId = null, pytanie, wybrana, czasMs } = {}) {
  wymaganie(pytanie && pytanie.id != null, 'pytanie {id, poprawna, punkty} jest wymagane');
  wymaganie(Number.isFinite(czasMs), 'czasMs jest wymagany');
  const nowy = kopia(stan);
  const odcinek = znajdzOdcinek(nowy, stacjaId);
  if (!odcinek) return { stan: nowy, usterki: [usterka('G01')] };
  if (nowy.faza === FAZY.koniec) return { stan: nowy, usterki: [usterka('G10')] };
  if (!nowy.pytania.some((p) => p.stacja === stacjaId && p.pytanieId === pytanie.id)) {
    return { stan: nowy, usterki: [usterka('G05')] };
  }
  if (![0, 1, 2, 3].includes(wybrana)) return { stan: nowy, usterki: [usterka('G08')] };

  const dozwoleni = ktoOdpowiada(nowy, stacjaId);
  const gracz = graczId ?? dozwoleni[0] ?? null;
  if (!znajdzGracza(nowy, gracz)) return { stan: nowy, usterki: [usterka('G02')] };
  if (!dozwoleni.includes(gracz)) return { stan: nowy, usterki: [usterka('G07')] };
  if (juzOdpowiedzial(nowy, stacjaId, gracz, pytanie.id)) return { stan: nowy, usterki: [usterka('G06')] };

  const poprawna = wybrana === pytanie.poprawna;
  const punktyPodstawowe = poprawna ? 1 : 0; // rev2: każde pytanie daje 1 pkt, bez wagi z paczki
  const wpis = {
    stacja: stacjaId,
    gracz,
    pytanieId: pytanie.id,
    wybrana,
    poprawna,
    punktyPodstawowe,
    punktyRazem: punktyPodstawowe,
  };
  nowy.odpowiedzi.push(wpis);
  dodajZdarzenie(nowy, czasMs, 'odpowiedz', {
    stacja: stacjaId,
    gracz,
    pytanieId: pytanie.id,
    poprawna,
    punkty: wpis.punktyRazem,
  });
  if (stacjaZamknieta(nowy, stacjaId)) przejdzDalej(nowy, czasMs);
  return { stan: nowy, usterki: [] };
}

/** Czy gra się skończyła (wszystkie stacje zamknięte albo pominięte). */
export function czyKoniec(stan) {
  return stan.faza === FAZY.koniec;
}

/**
 * Podsumowanie: punkty per gracz, przebieg per stacja, ranking.
 * Liczone ze stanu, więc da się je odtworzyć z dziennika (ARCHITECTURE).
 * Remisy rozstrzyga kolejność zgłoszeń — stabilny sort, bez dogrywki czasem.
 */
export function podsumowanie(stan) {
  const gracze = stan.gracze.map((g) => {
    const odpowiedzi = stan.odpowiedzi.filter((o) => o.gracz === g.id);
    const odcinki = stan.odcinki.filter((o) => o.gracz === g.id);
    const dystansM = odcinki.reduce((suma, o) => suma + (o.dystansM || 0), 0);
    return {
      id: g.id,
      imie: g.imie,
      punkty: odpowiedzi.reduce((suma, o) => suma + o.punktyRazem, 0),
      punktyOdpowiedzi: odpowiedzi.reduce((suma, o) => suma + o.punktyPodstawowe, 0),
      poprawne: odpowiedzi.filter((o) => o.poprawna).length,
      bledne: odpowiedzi.filter((o) => !o.poprawna).length,
      odcinki: odcinki.length,
      dystansM,
      reczneDojscia: odcinki.filter((o) => o.trybDojscia === TRYBY_DOJSCIA.reczne).length,
    };
  });
  const ranking = [...gracze].sort((a, b) => b.punkty - a.punkty).map((g) => g.id);
  const stacje = stan.stacje.map((s) => {
    const odcinek = znajdzOdcinek(stan, s.id);
    const odpowiedzi = stan.odpowiedzi.filter((o) => o.stacja === s.id);
    return {
      id: s.id,
      gracz: odcinek?.gracz ?? null,
      stan: odcinek?.stan ?? STANY_ODCINKA.oczekuje,
      dystansM: odcinek?.dystansM ?? 0,
      trybDojscia: odcinek?.trybDojscia ?? null,
      poprawne: odpowiedzi.filter((o) => o.poprawna).length,
      punkty: odpowiedzi.reduce((suma, o) => suma + o.punktyRazem, 0),
    };
  });
  return {
    schemat: stan.schemat,
    faza: stan.faza,
    zwyciezca: ranking.length ? ranking[0] : null,
    ranking,
    gracze,
    stacje,
    punktyRazem: gracze.reduce((suma, g) => suma + g.punkty, 0),
    zaliczoneStacje: stacje.filter((s) => s.stan === STANY_ODCINKA.zakonczony).length,
    pominietaStacje: stacje.filter((s) => s.stan === STANY_ODCINKA.pominiety).length,
    stacjeBezPytan: stan.stacje.filter((s) => pytaniaStacji(stan, s.id).length === 0).map((s) => s.id),
    zdarzen: stan.dziennik.length,
  };
}

/** Krótki podgląd dla UI: czyja kolejka, która stacja, ile zostało (cienka warstwa DOM). */
export function podglad(stan) {
  const stacja = stan.stacje.find((s) => s.id === stan.biezacaStacja) ?? null;
  const graczId = stacja ? graczNaStacji(stan, stacja.id) : null;
  const gracz = graczId != null ? znajdzGracza(stan, graczId) : null;
  // Liczniki tak samo jak w `podsumowanie()` — inaczej pasek postępu w trakcie
  // gry i tabela wyników na końcu pokazywałyby różne liczby tych samych stacji.
  const zaliczone = stan.odcinki.filter((o) => o.stan === STANY_ODCINKA.zakonczony).length;
  const pominieta = stan.odcinki.filter((o) => o.stan === STANY_ODCINKA.pominiety).length;
  return {
    faza: stan.faza,
    stacja: stacja ? { id: stacja.id, lat: stacja.lat, lon: stacja.lon, opis: stacja.opis } : null,
    gracz: gracz ? { id: gracz.id, imie: gracz.imie } : null,
    odpowiadaja: stacja ? ktoOdpowiada(stan, stacja.id) : [],
    dystansM: stacja ? (znajdzOdcinek(stan, stacja.id)?.dystansM ?? dystansOdcinkaM(stan, stacja.id)) : 0,
    dystansSieciowy: stacja ? Boolean(znajdzOdcinek(stan, stacja.id)?.dystansSieciowy) : false,
    zaliczoneStacje: zaliczone,
    pominietaStacje: pominieta,
    pozostaloStacje: stan.stacje.length - zaliczone - pominieta,
    pytanie: stacja ? pytaniaStacji(stan, stacja.id)[0] ?? null : null,
    pytan: stacja ? pytaniaStacji(stan, stacja.id).length : 0,
  };
}

/**
 * Wczytanie stanu (z `localStorage` albo z pliku). Nieznany schemat = jawna
 * odmowa z komunikatem, nigdy ciche odrzucenie (ADR 0010 pkt 6, LESSONS z AME:
 * funkcja, która ukrywa dane, jest usterką).
 */
export function wczytajStan(surowe) {
  let stan = surowe;
  if (typeof stan === 'string') {
    try {
      stan = JSON.parse(stan);
    } catch (e) {
      return { stan: null, usterki: [{ kod: 'G12', komunikat: `${KODY_ROZGRYWKI.G12} (JSON: ${e.message})` }] };
    }
  }
  if (!stan || typeof stan !== 'object') return { stan: null, usterki: [usterka('G12')] };
  if (stan.schemat !== SCHEMAT_ROZGRYWKI) {
    return {
      stan: null,
      usterki: [{ kod: 'G12', komunikat: `${KODY_ROZGRYWKI.G12} Oczekiwano „${SCHEMAT_ROZGRYWKI}", jest „${stan.schemat ?? '(brak)'}" — potrzebna migracja.` }],
    };
  }
  for (const pole of ['gracze', 'stacje', 'odcinki', 'odpowiedzi', 'dziennik', 'pytania']) {
    if (!Array.isArray(stan[pole])) return { stan: null, usterki: [usterka('G12')] };
  }
  if (stan.brakPytan !== undefined && !Array.isArray(stan.brakPytan)) {
    return { stan: null, usterki: [usterka('G12')] };
  }
  if (!Object.values(FAZY).includes(stan.faza)) return { stan: null, usterki: [usterka('G12')] };
  return { stan: kopia(stan), usterki: [] };
}
