/**
 * oceny.js — model ocen pytań: kciuk w górę / w dół (ADR 0028).
 *
 * Gracz ocenia pytanie jednym kliknięciem przy treści pytania albo po
 * odsłonięciu odpowiedzi — ten sam panel, ten sam slot. Jeden gracz ma jeden
 * głos na pytanie, także między sesjami i grami, więc głosy są pamiętane
 * lokalnie (`okolica:oceny`) i pilnowane drugi raz przez most.
 *
 * Tożsamość głosującego: pseudonim zweryfikowanego profilu (ADR 0026) albo
 * identyfikator urządzenia, gdy profilu nie ma (host hot-seat, gracz bez PIN-u).
 * Slug jest liczony DOKŁADNIE tak jak `idProfilu()` w moście — parzystość pilnuje
 * test wykonujący obie implementacje (`test/oceny.test.js`).
 *
 * Moduł nie dotyka DOM ani `fetch`: pamięć można wstrzyknąć (wzorzec projektu —
 * czysta funkcja + atrapa, `docs/LESSONS.md`).
 */

/* ------------------------------------------------------------- schematy/kody */

/** Plik ocen jednej paczki na Drive (pisze go most, czyta `budujIndeks`). */
export const SCHEMAT_OCENY = 'RO-oceny/1';

/** Pojedynczy głos w drodze na most (`akcja:'ocena'`). */
export const SCHEMAT_OCENA = 'RO-ocena/1';

/** Głosy zapamiętane na tym telefonie (`okolica:oceny`). */
export const SCHEMAT_OCENY_LOKALNE = 'oceny-lokalne/1';

/** Głosy czekające na wysyłkę (`okolica:oceny-kolejka`). */
export const SCHEMAT_KOLEJKI_OCEN = 'oceny-kolejka/1';

export const KLUCZ_OCEN = 'okolica:oceny';
export const KLUCZ_KOLEJKI_OCEN = 'okolica:oceny-kolejka';
export const KLUCZ_GLOSUJACEGO = 'okolica:glosujacy';

/** Ile głosów trzymamy lokalnie — reguła „już ocenione" musi przeżyć wiele gier. */
export const MAKS_OCEN_LOKALNIE = 600;

/** Ile głosów może czekać na wysyłkę (wzorzec kolejki hot-seat, ADR 0028 pkt 3). */
export const MAKS_KOLEJKI_OCEN = 50;

/** Kciuk w górę / w dół — innych wartości nie ma (ADR 0028: decyzja jednoklikowa). */
export const OCENA_PLUS = 1;
export const OCENA_MINUS = -1;

/**
 * Kody usterek ocen. Osobna rodzina, żeby komunikat w UI mówił wprost, co się
 * stało, a nie „nie udało się" (zasada partii 6: nazywaj kryterium, które zawiodło).
 */
export const KODY_OCEN = Object.freeze({
  O01: 'Odpowiedź mostu nie jest JSON-em — ocena czeka w kolejce.',
  O02: 'Most Drive odmówił przyjęcia oceny',
  O03: 'To pytanie jest już przez Ciebie ocenione.',
  O04: 'Ocena musi być kciukiem w górę albo w dół.',
  O05: 'Brak danych o ocenach w odpowiedzi repozytorium.',
});

/* ------------------------------------------------------------ tożsamość */

/**
 * Slug głosującego — LUSTRO `idProfilu()` z mostu (`docs/setup/apps-script-repo-paczek.gs`).
 * Idempotentny: `slugGlosujacego(slugGlosujacego(x)) === slugGlosujacego(x)`,
 * dzięki czemu most może przepuścić wartość przez własny slug bez zmiany.
 *
 * @param {string} wartosc pseudonim albo dowolny identyfikator
 * @returns {string} slug (pusty dla śmieci)
 */
export function slugGlosujacego(wartosc) {
  return String(wartosc ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Nowy identyfikator urządzenia — losowy, bez danych osobowych (ADR 0013/0028 pkt 7).
 * Losowanie jest wstrzykiwalne, żeby testy były deterministyczne (AGENTS §7).
 *
 * @param {{losuj?:Function}} [opcje] `losuj()` zwraca liczbę 0–1 (domyślnie `Math.random`)
 * @returns {string} identyfikator w postaci `urz-…`
 */
export function nowyIdUrzadzenia({ losuj } = {}) {
  const zrodlo = typeof losuj === 'function' ? losuj : Math.random;
  let id = '';
  for (let i = 0; i < 4; i += 1) {
    id += Math.floor(zrodlo() * 16 ** 6).toString(16).padStart(6, '0');
  }
  return `urz-${id}`;
}

/** Czyta wartość klucza z pamięci: obsługuje `localStorage` i gołą `Map` (testy). */
function czytajPamiec(pamiec, klucz) {
  if (!pamiec) return '';
  let surowa = null;
  if (typeof pamiec.getItem === 'function') surowa = pamiec.getItem(klucz);
  else if (typeof pamiec.get === 'function') surowa = pamiec.get(klucz);
  return typeof surowa === 'string' ? surowa.trim() : '';
}

function piszPamiec(pamiec, klucz, wartosc) {
  if (!pamiec) return;
  if (typeof pamiec.setItem === 'function') pamiec.setItem(klucz, wartosc);
  else if (typeof pamiec.set === 'function') pamiec.set(klucz, wartosc);
}

/** Identyfikator urządzenia z pamięci (tworzony raz, zapisany na stałe). */
function idUrzadzenia(pamiec, losuj) {
  const zapamietany = slugGlosujacego(czytajPamiec(pamiec, KLUCZ_GLOSUJACEGO));
  if (zapamietany) return zapamietany;
  const nowy = nowyIdUrzadzenia({ losuj });
  piszPamiec(pamiec, KLUCZ_GLOSUJACEGO, nowy);
  return nowy;
}

/**
 * Tożsamość głosującego (ADR 0028 pkt 2).
 *
 * - **Zweryfikowany profil (PIN)** → slug pseudonimu: ten sam człowiek na dwóch
 *   telefonach ma jeden głos na pytanie.
 * - **Bez weryfikacji** → urządzenie + imię odpowiadającego gracza. To ważne
 *   w hot-seat: na jednym telefonie gra kilka osób i KAŻDA musi móc ocenić to
 *   samo pytanie, więc sam identyfikator urządzenia byłby za gruby.
 *
 * @param {{pseudonim?:string, zweryfikowany?:boolean, imie?:string, pamiec?:{getItem?:Function}|Map, losuj?:Function}} [opcje]
 * @returns {{id:string, zrodlo:'profil'|'urzadzenie'}}
 */
export function idGlosujacego({ pseudonim = '', zweryfikowany = false, imie = '', pamiec = null, losuj } = {}) {
  const slug = slugGlosujacego(pseudonim);
  if (zweryfikowany && slug) return { id: slug, zrodlo: 'profil' };
  const urzadzenie = idUrzadzenia(pamiec, losuj);
  const kto = slugGlosujacego(imie);
  if (!kto) return { id: urzadzenie, zrodlo: 'urzadzenie' };
  // Krótki kawałek id urządzenia + imię: mieści się w 40 znakach slugu.
  return { id: slugGlosujacego(`${urzadzenie.slice(0, 12)}-${kto}`), zrodlo: 'urzadzenie' };
}

/* ---------------------------------------------------------- głosy lokalne */

/** Pusty stan głosów tego telefonu. */
export function noweOceny() {
  return { schemat: SCHEMAT_OCENY_LOKALNE, glosy: [] };
}

/**
 * Walidacja głosów z pamięci: `null` dla śmieci (uszkodzony wpis nie może
 * wywrócić rozgrywki — LESSONS L6: mów wprost, nie udawaj).
 */
export function walidujOcenyLokalne(surowy) {
  if (!surowy || typeof surowy !== 'object') return null;
  if (surowy.schemat !== SCHEMAT_OCENY_LOKALNE) return null;
  if (!Array.isArray(surowy.glosy)) return null;
  const glosy = surowy.glosy
    .filter((g) => g && typeof g === 'object'
      && typeof g.paczkaId === 'string' && g.paczkaId
      && typeof g.pytanieId === 'string' && g.pytanieId
      && (g.ocena === OCENA_PLUS || g.ocena === OCENA_MINUS))
    .slice(-MAKS_OCEN_LOKALNIE);
  return { schemat: SCHEMAT_OCENY_LOKALNE, glosy };
}

/**
 * Walidacja głosów z surowego tekstu (localStorage) — wzorzec projektu:
 * `waliduj…Surowy(tekst)` zwraca stan albo pusty stan z usterką, nigdy wyjątek.
 */
export function walidujOcenyLokalneTekst(tekst) {
  if (typeof tekst !== 'string' || !tekst.trim()) return { oceny: noweOceny(), usterki: [] };
  let surowy = null;
  try {
    surowy = JSON.parse(tekst);
  } catch {
    surowy = null;
  }
  const oceny = walidujOcenyLokalne(surowy);
  if (!oceny) {
    return { oceny: noweOceny(), usterki: [{ kod: 'O05', pole: KLUCZ_OCEN, komunikat: 'Zapamiętane oceny były nieczytelne — zaczynam od pustej listy.' }] };
  }
  return { oceny, usterki: [] };
}

/** Klucz „już ocenione": jedna para (głosujący, pytanie) w jednej paczce. */
export function kluczGlosu({ paczkaId, pytanieId }) {
  return `${paczkaId}::${pytanieId}`;
}

/** Czy ten gracz już ocenił to pytanie (na tym telefonie). */
export function juzOcenione(oceny, { paczkaId, pytanieId }) {
  const klucz = kluczGlosu({ paczkaId, pytanieId });
  return (oceny?.glosy ?? []).some((g) => kluczGlosu(g) === klucz);
}

/**
 * Zapis głosu. Czysta funkcja: zwraca nowy stan, ewentualną usterkę i zadanie
 * do wysłania. Głos już zapisany NIE jest wysyłany drugi raz (ADR 0028 pkt 2) —
 * nawet gdy gracz kliknie tę samą ikonę w innej grze albo po restarcie.
 *
 * @param {object} oceny stan z `walidujOcenyLokalne`/`noweOceny`
 * @param {{paczkaId:string, pytanieId:string, ocena:number, graczId:string, gra?:string, kiedy?:string}} glos
 * @returns {{oceny:object, usterki:Array, doWysylki:object|null}}
 */
export function ocenPytanie(oceny, { paczkaId, pytanieId, ocena, graczId, gra = '', kiedy = '' }) {
  const stan = walidujOcenyLokalne(oceny) ?? noweOceny();
  if (ocena !== OCENA_PLUS && ocena !== OCENA_MINUS) {
    return { oceny: stan, usterki: [{ kod: 'O04', pole: 'ocena', komunikat: KODY_OCEN.O04 }], doWysylki: null };
  }
  if (!paczkaId || !pytanieId) {
    return { oceny: stan, usterki: [{ kod: 'O05', pole: 'pytanieId', komunikat: 'Nie wiadomo, które pytanie oceniasz — paczka nie ma identyfikatora repozytorium.' }], doWysylki: null };
  }
  if (!graczId) {
    return { oceny: stan, usterki: [{ kod: 'O05', pole: 'graczId', komunikat: 'Brak tożsamości głosującego — ocena nie może być policzona.' }], doWysylki: null };
  }
  if (juzOcenione(stan, { paczkaId, pytanieId })) {
    return { oceny: stan, usterki: [{ kod: 'O03', pole: 'pytanieId', komunikat: KODY_OCEN.O03 }], doWysylki: null };
  }
  const glosy = [...stan.glosy, { paczkaId, pytanieId, ocena }].slice(-MAKS_OCEN_LOKALNIE);
  const nowy = { schemat: SCHEMAT_OCENY_LOKALNE, glosy };
  return {
    oceny: nowy,
    usterki: [],
    doWysylki: budujZadanieOceny({ paczkaId, pytanieId, ocena, gracz: graczId, gra, kiedy }),
  };
}

/* ------------------------------------------------------------- wymiana */

/**
 * Ciało żądania `akcja:'ocena'`. Współrzędnych i PIN-u tu nie ma i być nie może
 * (ADR 0013/0021) — test pilnuje listy pól.
 */
export function budujZadanieOceny({ paczkaId, pytanieId, ocena, gracz, gra = '', kiedy = '' }) {
  return {
    akcja: 'ocena',
    schemat: SCHEMAT_OCENA,
    paczkaId: String(paczkaId),
    pytanieId: String(pytanieId),
    ocena: ocena === OCENA_MINUS ? OCENA_MINUS : OCENA_PLUS,
    gracz: String(gracz),
    gra: String(gra ?? ''),
    kiedy: String(kiedy ?? ''),
  };
}

/** Walidacja kolejki głosów czekających na wysyłkę: `null` dla śmieci. */
export function walidujKolejkeOcen(surowy) {
  if (!surowy || typeof surowy !== 'object') return null;
  if (surowy.schemat !== SCHEMAT_KOLEJKI_OCEN) return null;
  if (!Array.isArray(surowy.zadania)) return null;
  const zadania = surowy.zadania
    .filter((z) => z && z.schemat === SCHEMAT_OCENA && z.paczkaId && z.pytanieId
      && (z.ocena === OCENA_PLUS || z.ocena === OCENA_MINUS) && z.gracz)
    .slice(-MAKS_KOLEJKI_OCEN);
  return { schemat: SCHEMAT_KOLEJKI_OCEN, zadania };
}

/** Walidacja kolejki z surowego tekstu: dla śmieci zwraca pustą kolejkę. */
export function walidujKolejkeOcenTekst(tekst) {
  const pusta = { schemat: SCHEMAT_KOLEJKI_OCEN, zadania: [] };
  if (typeof tekst !== 'string' || !tekst.trim()) return pusta;
  let surowy = null;
  try {
    surowy = JSON.parse(tekst);
  } catch {
    surowy = null;
  }
  return walidujKolejkeOcen(surowy) ?? pusta;
}

/** Usuwa z kolejki głos, który dojechał na most. */
export function usunZKolejkiOcen(kolejka, zadanie) {
  const stan = walidujKolejkeOcen(kolejka) ?? { schemat: SCHEMAT_KOLEJKI_OCEN, zadania: [] };
  if (!zadanie) return stan;
  return {
    schemat: SCHEMAT_KOLEJKI_OCEN,
    zadania: stan.zadania.filter((z) => !(z.paczkaId === zadanie.paczkaId && z.pytanieId === zadanie.pytanieId && z.gracz === zadanie.gracz)),
  };
}

/**
 * Token gry do licznika „użyta w X grach" (ADR 0028 pkt 6). Losowy, bez danych
 * gracza; losowanie wstrzykiwalne, żeby testy były deterministyczne.
 */
export function nowyTokenGry({ losuj } = {}) {
  const zrodlo = typeof losuj === 'function' ? losuj : Math.random;
  let token = '';
  for (let i = 0; i < 2; i += 1) token += Math.floor(zrodlo() * 16 ** 6).toString(16).padStart(6, '0');
  return `gra-${token}`;
}

/**
 * Dokłada głos do kolejki wysyłki. Najstarsze zadania wypadają, gdy kolejka jest
 * pełna — ocena to sygnał pomocniczy, nie dane, o które walczymy (ADR 0028 pkt 3).
 */
export function dodajDoKolejkiOcen(kolejka, zadanie) {
  const stan = walidujKolejkeOcen(kolejka) ?? { schemat: SCHEMAT_KOLEJKI_OCEN, zadania: [] };
  if (!zadanie || zadanie.schemat !== SCHEMAT_OCENA) return stan;
  const bezTegoSamego = stan.zadania.filter((z) => !(z.paczkaId === zadanie.paczkaId && z.pytanieId === zadanie.pytanieId && z.gracz === zadanie.gracz));
  return { schemat: SCHEMAT_KOLEJKI_OCEN, zadania: [...bezTegoSamego, zadanie].slice(-MAKS_KOLEJKI_OCEN) };
}

/**
 * Odpowiedź mostu na głos. Most odpowiada `{ok:true, podsumowanie:{…}}` albo
 * `{ok:false, blad:'…'}` — odmowa jest cytowana w komunikacie (wzorzec Z11),
 * bo „nie udało się" wysyła gracza na poszukiwania nie tam, gdzie wina.
 *
 * @param {string} tekst surowa odpowiedź mostu
 * @returns {{ok:boolean, usterki:Array, podsumowanie:object|null}}
 */
export function walidujOdpowiedzOceny(tekst) {
  let dane = null;
  try {
    dane = typeof tekst === 'string' ? JSON.parse(tekst) : tekst;
  } catch {
    dane = null;
  }
  if (!dane || typeof dane !== 'object') {
    return { ok: false, usterki: [{ kod: 'O01', pole: 'odpowiedź', komunikat: KODY_OCEN.O01 }], podsumowanie: null };
  }
  if (dane.ok !== true) {
    const blad = String(dane.blad ?? 'brak powodu odmowy');
    return { ok: false, usterki: [{ kod: 'O02', pole: 'ocena', komunikat: `${KODY_OCEN.O02}: ${blad}.` }], podsumowanie: null };
  }
  const podsumowanie = walidujStatystykiOcen(dane.podsumowanie);
  if (!podsumowanie) {
    return { ok: false, usterki: [{ kod: 'O05', pole: 'podsumowanie', komunikat: KODY_OCEN.O05 }], podsumowanie: null };
  }
  return { ok: true, usterki: [], podsumowanie };
}

/**
 * Statystyki paczki: z indeksu (`wpis.oceny`) albo z odpowiedzi na głos.
 * `null` dla śmieci — wołający pokazuje wtedy jawny brak danych, nie zera.
 *
 * @param {object} [surowe]
 * @returns {{glosow:number, plus:number, minus:number, uzytaWGrach:number, procentPlus:number, procentMinus:number}|null}
 */
export function walidujStatystykiOcen(surowe) {
  if (!surowe || typeof surowe !== 'object') return null;
  const glosow = Number(surowe.glosow);
  const plus = Number(surowe.plus);
  const minus = Number(surowe.minus);
  const uzytaWGrach = Number(surowe.uzytaWGrach ?? 0);
  if (![glosow, plus, minus, uzytaWGrach].every((n) => Number.isFinite(n) && n >= 0)) return null;
  if (plus + minus !== glosow) return null; // przy dwóch ikonach nie ma głosów neutralnych
  const procentPlus = glosow ? Math.round((plus / glosow) * 100) : 0;
  return { glosow, plus, minus, uzytaWGrach, procentPlus, procentMinus: glosow ? 100 - procentPlus : 0 };
}

/* ------------------------------------------------------------------ teksty */

/** „w 1 grze" / „w 3 grach" — odmiana tylko dla jedynki. */
export function liczbaGierTekst(liczba) {
  const n = Number(liczba);
  return n === 1 ? 'w 1 grze' : `w ${n} grach`;
}

/**
 * Polska odmiana rzeczownika przy liczbie ocen: 1 ocena, 2–4 oceny, 5+ ocen.
 * Nastki 12–14 idą z formą „ocen" (12 ocen, nie „12 oceny") — bez tego
 * reguła „ostatnia cyfra 2–4" daje „12 oceny".
 */
export function liczbaOcenTekst(liczba) {
  const n = Math.abs(Math.round(Number(liczba)));
  const ostatnie = n % 10;
  const nastek = n % 100;
  if (n === 1) return 'ocena';
  if (ostatnie >= 2 && ostatnie <= 4 && (nastek < 12 || nastek > 14)) return 'oceny';
  return 'ocen';
}

/**
 * Zdanie na ekran 2: ile gier użyło paczki i jak gracze ocenili pytania.
 *
 * @param {object|null} statystyki wynik `walidujStatystykiOcen` (null = brak danych)
 * @returns {string}
 */
export function opisOcenTekst(statystyki) {
  if (!statystyki) return 'Brak danych o ocenach — repozytorium nie odpowiedziało.';
  const { glosow, procentPlus, procentMinus, uzytaWGrach } = statystyki;
  const gry = uzytaWGrach > 0 ? `Użyta ${liczbaGierTekst(uzytaWGrach)}` : 'Jeszcze nie użyta w grze';
  if (!glosow) return `${gry}, jeszcze bez ocen graczy.`;
  return `${gry}, ${glosow} ${liczbaOcenTekst(glosow)} (${procentPlus}% 👍, ${procentMinus}% 👎)`;
}
