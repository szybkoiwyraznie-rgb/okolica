/**
 * M9/R2 — repozytorium paczek pytań: czyste funkcje nad zestawami (ADR 0017).
 *
 * Zakres modułu: schematy i walidacje surowe (lokalny wpis, rejestr, plik
 * publiczny TO-zestaw/1, indeks), dopasowanie okolicy (geohash5 + promień +
 * tematy + wiek) oraz LRU rejestru z budżetem (wzorzec cache sieci, ADR 0010
 * pkt 1). NIC tu nie dotyka `localStorage` ani `fetch` — nośnik i sieć
 * wstrzykuje warstwa DOM (`app/app.js`, M9/R3 i R6), dzięki czemu całość
 * testuje się bez przeglądarki (LESSONS: czysta funkcja + atrapa).
 *
 * Schematy:
 * - `TO-zestaw-lokalny/1` — wpis w `localStorage`: stacje + kontener
 *   TO-paczka/2 + metadane dopasowania (geohash5, promienM, tematy, wiek);
 * - `TO-zestaw/1` — plik publiczny: meta (w tym licencja i przegląd źródeł)
 *   + jawne stacje + kontener TO-paczka/2 (ADR 0017 pkt 1);
 * - indeks publiczny — lista SAMYCH meta (ADR 0017 pkt 2), bez treści.
 */

import { geohash } from './geo.js?v=m12-1';
import { SCHEMAT_KONTENERA } from './kodowanie.js?v=m12-1';
import { WERSJA_PROTOKOLU } from './protokol.js?v=m12-1';

export const SCHEMAT_ZESTAWU = 'TO-zestaw/1';
export const SCHEMAT_LOKALNY = 'TO-zestaw-lokalny/1';
export const SCHEMAT_INDEKSU = 'TO-indeks/1';

export const KLUCZ_REJESTRU = 'okolica:zestawy';
export const KLUCZ_URL_REPO = 'okolica:repo-zestawow:url';

/** Budżet rejestru zestawów: 1,5 MB (ADR 0017 pkt 7) — osobno od 2 MB gry. */
export const BUDZET_ZESTAWOW_BAJTY = 1_500_000;
/** Maksymalna liczba wpisów rejestru (LRU, ADR 0017 pkt 7). */
export const MAKS_ZESTAWOW = 8;

export const KODY_ZESTAWOW = {
  Z01: 'To nie jest poprawny JSON zestawu.',
  Z02: `Zapis ma inny schemat niż „${SCHEMAT_LOKALNY}” — pochodzi z innej wersji aplikacji.`,
  Z03: 'Zestaw lokalny nie ma listy stacji ({id, lat, lon}) — nie da się odtworzyć trasy.',
  Z04: `Ukryta paczka zestawu jest uszkodzona (oczekiwano kontenera ${SCHEMAT_KONTENERA}).`,
  Z05: 'Metadane dopasowania zestawu są niekompletne (geohash5, promienM, tematy, wiek).',
  Z06: 'Rejestr zestawów ma inny schemat niż oczekiwany — zaczynamy pustą listę.',
  Z07: `Plik publiczny ma inny schemat niż „${SCHEMAT_ZESTAWU}”.`,
  Z08: 'Plik publiczny nie ma jawnych stacji ani meta z licencją i przeglądem źródeł (ADR 0017 pkt 1/4).',
  Z09: 'Indeks repozytorium ma inny schemat niż oczekiwany — brak propozycji paczek.',
  Z10: 'Wpis indeksu jest niekompletny (meta bez geohash5/licencji) — pominięty.',
};

function usterka(kod) {
  return { kod, komunikat: KODY_ZESTAWOW[kod] ?? kod };
}

function wymaganie(warunek, komunikat) {
  if (!warunek) throw new TypeError(komunikat);
}

/** Klucz `localStorage` pełnego wpisu zestawu lokalnego. */
export function kluczZestawu(skrot) {
  const czysty = String(skrot ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
  return `okolica:zestaw:${czysty || 'brak'}`;
}

function czyStacjaOk(s) {
  return !!s && typeof s === 'object'
    && Number.isFinite(s.lat) && Math.abs(s.lat) <= 90
    && Number.isFinite(s.lon) && Math.abs(s.lon) <= 180;
}

function czyKontenerOk(k) {
  return !!k && typeof k === 'object' && k.schemat === SCHEMAT_KONTENERA
    && typeof k.dane === 'string' && k.dane.length > 0
    && typeof k.skrot === 'string' && k.skrot.length > 0;
}

function czyMetaDopasowaniaOk(m) {
  return !!m && typeof m === 'object'
    && typeof m.geohash5 === 'string' && m.geohash5.length === 5
    && Number.isFinite(m.promienM) && m.promienM > 0
    && Array.isArray(m.tematy) && m.tematy.length > 0 && m.tematy.every((t) => typeof t === 'string')
    && typeof m.wiek === 'string' && m.wiek.length > 0
    && Number.isInteger(m.liczbaStacji) && m.liczbaStacji > 0
    && Number.isInteger(m.pytaniaNaStacje) && m.pytaniaNaStacje > 0;
}

/** Rozmiar wpisu w bajtach (UTF-8 JSON) — pod budżet LRU. */
export function rozmiarBajty(obiekt) {
  return new TextEncoder().encode(JSON.stringify(obiekt)).length;
}

/**
 * Walidacja surowego tekstu wpisu lokalnego: `{ zestaw, usterki }`.
 * Nigdy nie rzuca — śmieć z `localStorage` to fakt życia, nie wyjątek.
 */
export function walidujZestawLokalnySurowy(tekst) {
  let surowy;
  try {
    surowy = JSON.parse(tekst);
  } catch {
    return { zestaw: null, usterki: [usterka('Z01')] };
  }
  const usterki = [];
  if (!surowy || typeof surowy !== 'object' || surowy.schemat !== SCHEMAT_LOKALNY) {
    return { zestaw: null, usterki: [usterka('Z02')] };
  }
  if (!Array.isArray(surowy.stacje) || surowy.stacje.length === 0 || !surowy.stacje.every(czyStacjaOk)) {
    usterki.push(usterka('Z03'));
  }
  if (!czyKontenerOk(surowy.kontener)) usterki.push(usterka('Z04'));
  if (!czyMetaDopasowaniaOk(surowy)) usterki.push(usterka('Z05'));
  return { zestaw: usterki.length ? null : surowy, usterki };
}

/** Walidacja surowego tekstu rejestru: `{ rejestr, usterki }` (pusty przy błędzie). */
export function walidujRejestrSurowy(tekst) {
  let surowy;
  try {
    surowy = JSON.parse(tekst);
  } catch {
    return { rejestr: [], usterki: [usterka('Z01')] };
  }
  if (!surowy || typeof surowy !== 'object' || surowy.schemat !== SCHEMAT_INDEKSU
    || !Array.isArray(surowy.wpisy)) {
    return { rejestr: [], usterki: [usterka('Z06')] };
  }
  const wpisy = surowy.wpisy.filter((w) => czyMetaDopasowaniaOk(w) && typeof w.skrot === 'string');
  return { rejestr: wpisy, usterki: wpisy.length === surowy.wpisy.length ? [] : [usterka('Z10')] };
}

/** Pusty rejestr — punkt startu zapisu. */
export function nowyRejestr() {
  return { schemat: SCHEMAT_INDEKSU, wpisy: [] };
}

/**
 * Dokłada wpis do rejestru i przycina LRU: najstarsze (`data`) wpisy wypadają
 * ponad `MAKS_ZESTAWOW` albo budżet bajtowy. Zwraca `{ rejestr, usuniete }` —
 * listę skrotów, których KLUCZE warstwa DOM ma usunąć z `localStorage`
 * (nigdy cicho: usunięcie jest widoczne w wyniku, LESSONS L6).
 */
export function dolozWpisRejestru(rejestr, wpis, { bajty, teraz } = {}) {
  wymaganie(czyMetaDopasowaniaOk(wpis) && typeof wpis.skrot === 'string',
    'dolozWpisRejestru: wpis musi nieść geohash5, promienM, tematy, wiek i skrot');
  wymaganie(Number.isFinite(bajty) && bajty >= 0, 'dolozWpisRejestru: bajty muszą być liczbą ≥ 0');
  const wpisy = (rejestr?.wpisy ?? []).filter((w) => w.skrot !== wpis.skrot);
  wpisy.push({ ...wpis, bajty, data: wpis.data ?? (typeof teraz === 'string' ? teraz : new Date().toISOString()) });
  const suma = () => wpisy.reduce((acc, w) => acc + (Number.isFinite(w.bajty) ? w.bajty : 0), 0);
  const usuniete = [];
  wpisy.sort((a, b) => String(a.data).localeCompare(String(b.data)));
  while (wpisy.length > MAKS_ZESTAWOW || suma() > BUDZET_ZESTAWOW_BAJTY) {
    const najstarszy = wpisy.shift();
    usuniete.push(najstarszy.skrot);
    if (wpisy.length === 0) break; // pojedynczy wpis większy niż budżet: nie zapisujemy nic
  }
  return { rejestr: { schemat: SCHEMAT_INDEKSU, wpisy }, usuniete };
}

const zbiorTematow = (tematy) => new Set(tematy);

/**
 * Dopasowanie okolicy: ten sam geohash5, ten sam promień, ten sam wiek i ten
 * sam zestaw tematów (reguły z ADR 0017 pkt 7 — ściśle i przewidywalnie; UI
 * pokazuje metadane, więc organizator widzi, dlaczego propozycja pasuje).
 */
export function dopasujZestawy(rejestr, { geohash5, promienM, liczbaStacji, pytaniaNaStacje, tematy, wiek } = {}) {
  wymaganie(typeof geohash5 === 'string' && geohash5.length === 5, 'dopasujZestawy: geohash5 musi mieć 5 znaków');
  wymaganie(Number.isFinite(promienM) && promienM > 0, 'dopasujZestawy: promienM musi być liczbą > 0');
  wymaganie(Number.isInteger(liczbaStacji) && liczbaStacji > 0, 'dopasujZestawy: liczbaStacji musi być dodatnią liczbą całkowitą');
  wymaganie(Number.isInteger(pytaniaNaStacje) && pytaniaNaStacje > 0, 'dopasujZestawy: pytaniaNaStacje musi być dodatnią liczbą całkowitą');
  wymaganie(Array.isArray(tematy) && tematy.length > 0, 'dopasujZestawy: tematy muszą być niepustą listą');
  wymaganie(typeof wiek === 'string' && wiek.length > 0, 'dopasujZestawy: wiek musi być nazwą');
  const szukany = zbiorTematow(tematy);
  // tolerujemy obie konwencje: surowa lista wpisów (walidacje surowe) i obiekt
  // rejestru `{ schemat, wpisy }` (zapis) — jedno wejście, zero niespodzianek
  const lista = Array.isArray(rejestr) ? rejestr : (rejestr?.wpisy ?? []);
  // Kryteria właściciela (2026-09-06): ta sama okolica (geohash5), ta sama
  // liczba stacji i pytań na stację, ten sam poziom (wiek), tematy paczki
  // NIE SZERSZE niż w setupie oraz promień paczki ≤ promienia z setupu
  // (stacje bliżej niż oczekiwano są uczciwe, dalej — nie).
  return lista
    .filter((w) => w.geohash5 === geohash5 && w.promienM <= promienM
      && w.liczbaStacji === liczbaStacji && w.pytaniaNaStacje === pytaniaNaStacje
      && w.wiek === wiek && w.tematy.every((temat) => szukany.has(temat)))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
}

/**
 * Walidacja surowego tekstu pliku publicznego TO-zestaw/1: `{ zestaw, usterki }`.
 * Meta musi nieść licencję i przegląd źródeł (ADR 0017 pkt 4) — bez nich plik
 * nie jest paczką publiczną, tylko śmieciem do odrzucenia z komunikatem.
 */
export function walidujZestawPublicznySurowy(tekst) {
  let surowy;
  try {
    surowy = JSON.parse(tekst);
  } catch {
    return { zestaw: null, usterki: [usterka('Z01')] };
  }
  const usterki = [];
  if (!surowy || typeof surowy !== 'object' || surowy.schemat !== SCHEMAT_ZESTAWU) {
    return { zestaw: null, usterki: [usterka('Z07')] };
  }
  const meta = surowy.meta;
  const metaOk = czyMetaDopasowaniaOk(meta)
    && typeof meta.miejsce === 'string' && meta.miejsce.length > 0
    && typeof meta.licencja === 'string' && meta.licencja.length > 0
    && typeof meta.przegladZrodel === 'string' && meta.przegladZrodel.length > 0
    && typeof meta.data === 'string' && meta.data.length > 0;
  if (!metaOk) usterki.push(usterka('Z08'));
  if (!Array.isArray(surowy.stacje) || surowy.stacje.length === 0 || !surowy.stacje.every(czyStacjaOk)) {
    usterki.push(usterka('Z08'));
  }
  if (!czyKontenerOk(surowy.kontener)) usterki.push(usterka('Z04'));
  return { zestaw: usterki.length ? null : surowy, usterki };
}

/**
 * Walidacja surowego tekstu indeksu publicznego: `{ indeks, usterki }`.
 * Indeks niesie wyłącznie meta (ADR 0017 pkt 2); wpisy niekompletne wypadają
 * z listy i są policzone jako usterka Z10 (status dla organizatora).
 */
export function walidujIndeksSurowy(tekst) {
  let surowy;
  try {
    surowy = JSON.parse(tekst);
  } catch {
    return { indeks: [], usterki: [usterka('Z01')] };
  }
  if (!surowy || typeof surowy !== 'object' || surowy.schemat !== SCHEMAT_INDEKSU
    || !Array.isArray(surowy.wpisy)) {
    return { indeks: [], usterki: [usterka('Z09')] };
  }
  // Wpis wskazuje paczkę ALBO względną ścieżką `plik` (własny hosting),
  // ALBO `id` pliku Drive (most Apps Script: `?akcja=paczka&id=…`, M9b/D4).
  const wpisy = surowy.wpisy.filter((w) => czyMetaDopasowaniaOk(w)
    && typeof w.licencja === 'string' && w.licencja.length > 0
    && ((typeof w.plik === 'string' && w.plik.length > 0)
      || (typeof w.id === 'string' && w.id.length > 0)));
  return { indeks: wpisy, usterki: wpisy.length === surowy.wpisy.length ? [] : [usterka('Z10')] };
}

/**
 * Adres paczki z wpisu indeksu (M9b/D4).
 * - wpis z `id` (most Drive): baza = URL repozytorium BEZ query/hash
 *   + `?akcja=paczka&id=…` (kontrakt doGet Apps Script);
 * - wpis z `plik`: URL absolutny przechodzi jak stoi, względny skleja się
 *   z katalogiem adresu indeksu (goły Node nie ma document.baseURI).
 * Czysta funkcja — testowalna bez DOM i bez sieci.
 */
export function urlPaczkiZRepo(urlRepo, wpis) {
  if (wpis?.id) {
    const baza = String(urlRepo).split(/[?#]/)[0];
    return `${baza}?akcja=paczka&id=${encodeURIComponent(wpis.id)}`;
  }
  const plik = String(wpis?.plik ?? '');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(plik)) return plik;
  const baza = String(urlRepo).slice(0, String(urlRepo).lastIndexOf('/') + 1);
  return baza + plik;
}

/** Dopasowanie wpisu indeksu publicznego — te same reguły co lokalnie. */
export function dopasujMetaIndeksu(indeks, kryteria) {
  return dopasujZestawy({ wpisy: indeks }, kryteria);
}

/**
 * Meta dopasowania z bieżącej konfiguracji i pozycji (geohash5 z `geo.js`).
 * Czysta funkcja: warstwa DOM podaje wyłącznie fakty (ADR 0017 pkt 3).
 */
export function zbierzMetaZestawu({ lat, lon, promienM, tematy, wiek, jezyk, miejsce, data, liczbaStacji, pytaniaNaStacje } = {}) {
  wymaganie(Number.isFinite(lat) && Number.isFinite(lon), 'zbierzMetaZestawu: pozycja musi być liczbami');
  wymaganie(Number.isFinite(promienM) && promienM > 0, 'zbierzMetaZestawu: promienM musi być liczbą > 0');
  wymaganie(Number.isInteger(liczbaStacji) && liczbaStacji > 0, 'zbierzMetaZestawu: liczbaStacji musi być dodatnią liczbą całkowitą');
  wymaganie(Number.isInteger(pytaniaNaStacje) && pytaniaNaStacje > 0, 'zbierzMetaZestawu: pytaniaNaStacje musi być dodatnią liczbą całkowitą');
  wymaganie(Array.isArray(tematy) && tematy.length > 0, 'zbierzMetaZestawu: tematy muszą być niepustą listą');
  wymaganie(typeof wiek === 'string' && wiek.length > 0, 'zbierzMetaZestawu: wiek musi być nazwą');
  return {
    miejsce: typeof miejsce === 'string' && miejsce ? miejsce : 'nazwa nieustalona',
    geohash5: geohash(lat, lon, 5),
    promienM,
    tematy: [...tematy],
    wiek,
    jezyk: typeof jezyk === 'string' && jezyk ? jezyk : 'polski',
    data: typeof data === 'string' && data ? data : new Date().toISOString().slice(0, 16).replace('T', ' '),
    liczbaStacji,
    pytaniaNaStacje,
  };
}

/**
 * Plik publiczny TO-zestaw/1: meta + jawne stacje + kontener (ADR 0017 pkt 1).
 * `przegladZrodel` wychodzi jako „oczekuje przeglądu" — publikacja (akceptacja
 * przez właściciela na moście Drive, ADR 0018) wymaga przeglądu źródeł (pkt 5).
 */
export function zbudujPlikZestawu({ stacje, kontener, meta, autor = 'organizator' } = {}) {
  wymaganie(Array.isArray(stacje) && stacje.length > 0 && stacje.every(czyStacjaOk),
    'zbudujPlikZestawu: stacje muszą być niepustą listą punktów {lat, lon}');
  wymaganie(czyKontenerOk(kontener), `zbudujPlikZestawu: kontener musi być ${SCHEMAT_KONTENERA}`);
  wymaganie(czyMetaDopasowaniaOk(meta) && typeof meta.miejsce === 'string',
    'zbudujPlikZestawu: meta musi być kompletna (zbierzMetaZestawu)');
  return {
    schemat: SCHEMAT_ZESTAWU,
    protokol: WERSJA_PROTOKOLU,
    meta: {
      ...meta,
      autor: String(autor),
      licencja: 'CC BY-SA 4.0',
      przegladZrodel: 'oczekuje przeglądu właściciela (ADR 0008 pkt 6)',
    },
    stacje: stacje.map((s) => ({ lat: s.lat, lon: s.lon, opis: typeof s.opis === 'string' ? s.opis : '' })),
    kontener,
  };
}
