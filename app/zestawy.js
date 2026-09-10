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

import { geohash, odlegloscDoKomorkiM } from './geo.js?v=m12-53';
import { kanonicznyTemat } from './konfig.js?v=m12-53';
import { SCHEMAT_KONTENERA } from './kodowanie.js?v=m12-53';
import { WERSJA_PROTOKOLU } from './protokol.js?v=m12-53';

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
  Z11: 'Most Drive nie wydał paczki (powód w komunikacie — np. paczka niezaakceptowana albo błąd skryptu).',
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
 * Tolerancja dopasowania okolicy w metrach (ADR 0024): komórka geohash paczki
 * powiększona o ten margines. Kilka metrów różnicy w miejscu startu — albo
 * przejście przez granicę komórki — NIE zmienia listy propozycji, co przy
 * regule „ten sam geohash5 albo nic" gubiło paczki (zgłoszenie właściciela
 * z 2026-09-07: zatwierdzona paczka dla Podkowy Leśnej nie pojawia się na
 * ekranie pozycji).
 */
export const TOLERANCJA_OKOLICY_M = 200;

/**
 * Dopasowanie okolicy (ADR 0024): paczka pasuje, gdy jej komórka geohash jest
 * w zasięgu `TOLERANCJA_OKOLICY_M` od pozycji gracza; reszta kryteriów bez
 * zmian (promień, wiek, liczba stacji i pytań, tematy nie szersze — ADR 0017
 * pkt 7). Bez podanej pozycji (`lat`/`lon`) działa dawna reguła „ten sam
 * geohash5" — kryteria muszą wtedy wystarczyć (rejestr lokalny, testy).
 */
/** Komórka geohash wpisu: `geohash6` gdy jest, inaczej `geohash5` (ADR 0024 pkt 4). */
function komorkaWpisu(w) {
  return typeof w?.geohash6 === 'string' && w.geohash6.length === 6 ? w.geohash6 : w?.geohash5;
}

/**
 * Tolerancja okolicy dla wpisu: `TOLERANCJA_OKOLICY_M`, a dla kotwicy
 * SZACOWANEJ (B19 — most dopisał geohash6 starej paczce ze środka ciężkości jej
 * stacji) dodatkowo promień paczki: start leży w promieniu od KAŻDEJ stacji,
 * więc ten zapas gwarantuje brak regresji dla plików sprzed B19.
 */
function tolerancjaWpisu(w) {
  return w?.geohash6Szacowany === true && Number.isFinite(w?.promienM) && w.promienM > 0
    ? TOLERANCJA_OKOLICY_M + w.promienM
    : TOLERANCJA_OKOLICY_M;
}

/**
 * Czy paczka powstała w tej samej okolicy co gracz (± tolerancja). Bez pozycji
 * (`lat`/`lon`) działa dawna reguła „ten sam geohash5" (rejestr lokalny, testy).
 */
export function czyWOkolicy(w, { geohash5, lat, lon } = {}) {
  if (!(Number.isFinite(lat) && Number.isFinite(lon))) return w?.geohash5 === geohash5;
  const d = odlegloscDoKomorkiM(komorkaWpisu(w), lat, lon);
  return d !== null && d <= tolerancjaWpisu(w);
}

/** Odległość wpisu od gracza w metrach (null, gdy nie da się policzyć). */
export function odlegloscWpisuM(w, { lat, lon } = {}) {
  if (!(Number.isFinite(lat) && Number.isFinite(lon))) return null;
  return odlegloscDoKomorkiM(komorkaWpisu(w), lat, lon);
}

/** Łączna liczba pytań wpisu (stacje × pytania na stację) albo null, gdy wpis nie ma tych danych. */
export function sumaPytanWpisu(w) {
  const stacje = Number(w?.liczbaStacji);
  const naStacje = Number(w?.pytaniaNaStacje);
  return Number.isFinite(stacje) && Number.isFinite(naStacje) ? stacje * naStacje : null;
}

/**
 * Powody, dla których wpis NIE pasuje do setupu — pusta lista znaczy „pasuje".
 * JEDNO źródło prawdy: `dopasujZestawy` filtruje po tym, a UI cytuje powody
 * wprost (decyzja właściciela 2026-09-07: komunikat ma mówić, CO nie pasuje,
 * a nie wymieniać cały setup).
 *
 * Kryteria (właściciel, 2026-09-07): okolica ±`TOLERANCJA_OKOLICY_M`, wiek,
 * ŁĄCZNA liczba pytań (paczka może mieć więcej — nadmiar nie przeszkadza)
 * i tematy nie szersze niż w setupie.
 *
 * NIE są kryteriami: promień (nie wpływa na pytania, trasę wyznaczają stacje),
 * liczba stacji i pytania na stację z osobna („jak gra ma mieć 20 pytań, to
 * musi być paczka, która ma 20 pytań — nieważne, czy 5 stacji po 4, czy 2 po 10")
 * oraz środek transportu (właściciel wycofał: „olej, nie bierz pod uwagę").
 */
export function powodyNiedopasowania(w, { geohash5, lat, lon, wiek, liczbaStacji, pytaniaNaStacje, tematy, tematWlasny = '' } = {}) {
  const powody = [];
  if (!czyWOkolicy(w, { geohash5, lat, lon })) {
    const d = odlegloscWpisuM(w, { lat, lon });
    powody.push(d == null
      ? 'inna okolica'
      : `inna okolica — paczka powstała ${d >= 1000 ? `${Math.round(d / 100) / 10} km` : `${Math.round(d)} m`} stąd`);
  }
  if (w?.wiek !== wiek) powody.push(`wiek: paczka „${w?.wiek ?? 'brak'}", setup „${wiek}"`);
  const chce = Number(liczbaStacji) * Number(pytaniaNaStacje);
  const ma = sumaPytanWpisu(w);
  if (ma == null) {
    powody.push('brak danych o liczbie pytań w paczce');
  } else if (ma < chce) {
    powody.push(`za mało pytań: paczka ma ${ma} (${w.liczbaStacji} stacji × ${w.pytaniaNaStacje}), a setup chce ${chce}`);
  }
  const szukany = zbiorTematow((tematy ?? []).map(kanonicznyTemat));
  const obce = (w?.tematy ?? []).map(kanonicznyTemat).filter((t) => !szukany.has(t));
  if (obce.length) powody.push(`tematy spoza setupu: ${obce.join(', ')}`);
  if ((w?.tematy ?? []).map(kanonicznyTemat).includes('wlasny')) {
    const moj = String(tematWlasny ?? '').trim().toLowerCase();
    const paczki = String(w?.tematWlasny ?? '').trim().toLowerCase();
    if (moj === '' || paczki !== moj) powody.push(`temat własny: paczka „${w?.tematWlasny ?? 'brak'}", setup „${moj || 'brak'}"`);
  }
  return powody;
}

export function dopasujZestawy(rejestr, { geohash5, lat, lon, promienM, liczbaStacji, pytaniaNaStacje, tematy, wiek, tematWlasny = '' } = {}) {
  wymaganie(typeof geohash5 === 'string' && geohash5.length === 5, 'dopasujZestawy: geohash5 musi mieć 5 znaków');
  wymaganie(Number.isInteger(liczbaStacji) && liczbaStacji > 0, 'dopasujZestawy: liczbaStacji musi być dodatnią liczbą całkowitą');
  wymaganie(Number.isInteger(pytaniaNaStacje) && pytaniaNaStacje > 0, 'dopasujZestawy: pytaniaNaStacje musi być dodatnią liczbą całkowitą');
  wymaganie(Array.isArray(tematy) && tematy.length > 0, 'dopasujZestawy: tematy muszą być niepustą listą');
  wymaganie(typeof wiek === 'string' && wiek.length > 0, 'dopasujZestawy: wiek musi być nazwą');
  // tolerujemy obie konwencje: surowa lista wpisów (walidacje surowe) i obiekt
  // rejestru `{ schemat, wpisy }` (zapis) — jedno wejście, zero niespodzianek
  const lista = Array.isArray(rejestr) ? rejestr : (rejestr?.wpisy ?? []);
  // Kryteria (właściciel, 2026-09-07): ta sama okolica (±200 m od miejsca
  // wygenerowania), wiek, ŁĄCZNA liczba pytań (paczka może mieć więcej) oraz
  // tematy paczki NIE SZERSZE niż w setupie. Promień, liczba stacji i środek
  // transportu NIE są kryteriami (aneks ADR 0024).
  const kryteria = { geohash5, lat, lon, wiek, liczbaStacji, pytaniaNaStacje, tematy, tematWlasny };
  return lista
    .filter((w) => !powodyNiedopasowania(w, kryteria).length)
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
    // Most odpowiada `{blad: …}` zamiast pliku — albo paczka nie jest
    // zaakceptowana, albo skrypt w Apps Script się wysypał (np. ReferenceError
    // złapany przez doGet). Gracz ma zobaczyć PRAWDZIWY powód, a nie „inny
    // schemat", które brzmi jak uszkodzony plik (Z07).
    const bladMostu = surowy && typeof surowy.blad === 'string' ? surowy.blad.trim() : '';
    if (bladMostu) return { zestaw: null, usterki: [{ kod: 'Z11', komunikat: `Most Drive nie wydał paczki: ${bladMostu}` }] };
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
export function zbierzMetaZestawu({ lat, lon, promienM, tematy, wiek, jezyk, miejsce, data, liczbaStacji, pytaniaNaStacje, tematWlasny = '', factcheck = true } = {}) {
  wymaganie(Number.isFinite(lat) && Number.isFinite(lon), 'zbierzMetaZestawu: pozycja musi być liczbami');
  wymaganie(Number.isFinite(promienM) && promienM > 0, 'zbierzMetaZestawu: promienM musi być liczbą > 0');
  wymaganie(Number.isInteger(liczbaStacji) && liczbaStacji > 0, 'zbierzMetaZestawu: liczbaStacji musi być dodatnią liczbą całkowitą');
  wymaganie(Number.isInteger(pytaniaNaStacje) && pytaniaNaStacje > 0, 'zbierzMetaZestawu: pytaniaNaStacje musi być dodatnią liczbą całkowitą');
  wymaganie(Array.isArray(tematy) && tematy.length > 0, 'zbierzMetaZestawu: tematy muszą być niepustą listą');
  wymaganie(typeof wiek === 'string' && wiek.length > 0, 'zbierzMetaZestawu: wiek musi być nazwą');
  return {
    miejsce: typeof miejsce === 'string' && miejsce ? miejsce : 'nazwa nieustalona',
    geohash5: geohash(lat, lon, 5),
    // Dokładniejsza kotwica dopasowania (ADR 0024): ~1,2 × 0,6 km. Pole
    // addytywne — stare pliki bez niego czytają się dalej (dopasowanie zgrubne).
    // Wymiary na 52°N: geohash6 ≈ 0,75 × 0,61 km (0,46 km²); geohash5 ≈ 3,0 × 4,9 km.
    geohash6: geohash(lat, lon, 6),
    promienM,
    tematy: [...tematy],
    wiek,
    jezyk: typeof jezyk === 'string' && jezyk ? jezyk : 'polski',
    data: typeof data === 'string' && data ? data : new Date().toISOString().slice(0, 16).replace('T', ' '),
    liczbaStacji,
    pytaniaNaStacje,
    tematWlasny: typeof tematWlasny === 'string' ? tematWlasny.trim().slice(0, 40) : '',
    // ADR 0032: false = pytania z pamięci modelu; brak pola w starych
    // zapisach czytamy jak true (reguła `!== false`, jak geohash6 z ADR 0024).
    factcheck: Boolean(factcheck),
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
