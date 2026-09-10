/**
 * pozycja.js — wszystko, co dotyczy ustalenia, gdzie jest gracz: walidacja
 * współrzędnych, kryterium dojścia do stacji, komunikaty błędów GPS,
 * symulacja trasy dla trybu testowego i cienka osłona `watchPosition`.
 *
 * Podział ról (ARCHITECTURE „Czyste funkcje vs warstwa DOM"):
 * - `geo.js` daje geometrię (`odlegloscM`, `progDojsciaM`, `czyDotarl`),
 * - ten moduł dokłada **reguły gry i komunikaty** — też jako czyste funkcje,
 * - `app.js` tylko wiesza osłonę na `navigator.geolocation` i rysuje wynik.
 *
 * Dlatego `navigator` nie pojawia się tu nigdzie poza parametrem
 * `watchPozycja({ geolocation })` — w testach podstawiamy atrapę, a reguły
 * (próg, debounce, filtr) działają na fixture'ach fixów (ADR 0004, konsekwencje).
 *
 * Czas jest parametrem (`czasMs`), nigdy `Date.now()` ani `performance.now()`
 * w środku — tak samo jak w `rozgrywka.js` (ADR 0004 pkt 3).
 */

import { bearingStopnie, czyDotarl, czyWspolrzedneOk, ogranicz, odlegloscM, przesunPunkt, progDojsciaM } from './geo.js?v=m12-56';

/** Opcje watchera — dokładnie jak w ADR 0004 pkt 1 (jedne na całą rozgrywkę). */
export const OPCJE_WATCH = Object.freeze({ enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });

/**
 * M10/T3: dwa profile watchera — „budzenie przy zbliżaniu" (bateria).
 * W trasie (daleko od stacji) GPS może pracować oszczędnie: bez wysokiej
 * dokładności i z rzadszym odświeżaniem (`maximumAge` 20 s); przy stacji
 * wraca profil dokładny, bo kryterium dojścia (ADR 0004 pkt 2) liczy się
 * z metrów. Profile wstrzykuje się do `watchPozycja({ opcje })`.
 */
export const PROFILE_GPS = Object.freeze({
  dokladny: Object.freeze({ enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }),
  oszczedny: Object.freeze({ enableHighAccuracy: false, maximumAge: 20000, timeout: 45000 }),
});

/** Progi histerezy [m]: oszczędny POWYŻEJ 250, powrót do dokładnego PONIŻEJ 150. */
export const PROG_BATERII_M = Object.freeze({ oszczednyPowyzej: 250, dokladnyPonizej: 150 });

/**
 * Czysta decyzja profilu GPS na podstawie dystansu do bieżącej stacji.
 * Histereza zapobiega oscylacji na granicy progów; brak dystansu (null/NaN —
 * np. fix jeszcze nie policzony) NIE zmienia profilu.
 *
 * @param {{poprzedni?: string, dystansM?: number|null}} args
 * @returns {'dokladny'|'oszczedny'}
 */
export function profilBaterii({ poprzedni = 'dokladny', dystansM = null } = {}) {
  const baza = poprzedni === 'oszczedny' ? 'oszczedny' : 'dokladny';
  if (!Number.isFinite(dystansM)) return baza;
  if (baza === 'oszczedny') return dystansM < PROG_BATERII_M.dokladnyPonizej ? 'dokladny' : 'oszczedny';
  return dystansM > PROG_BATERII_M.oszczednyPowyzej ? 'oszczedny' : 'dokladny';
}

/** Granice reguł pozycji. Zmiana = zmiana kodu i testu, nie decyzja sesji. */
export const GRANICE = Object.freeze({
  /** ADR 0034: pojedynczy fix w promieniu 50 m zapala stację. */
  wymaganeTrafnienia: 1,
  /** Ile fixów trzymamy w pamięci (historia dojścia + rysowanie śladu na mapie, M2). */
  historiaFixow: 40,
  /** Domyślny rozrzut symulowanego GPS — tyle, ile realnie daje telefon w otwartym terenie. */
  szumSymulacjiM: 6,
});

/** Skąd pochodzi fix — trafia do dziennika rozgrywki (ADR 0004 pkt 5). */
export const ZRODLA_FIXA = Object.freeze({ gps: 'gps', reczne: 'reczne', symulacja: 'symulacja' });

/** Wynik oceny fixu. */
export const STANY_FIXA = Object.freeze({
  ok: 'ok',
  niepoprawny: 'niepoprawny',
});

/**
 * Kody i komunikaty pozycji — pełne zdania gotowe do wyświetlenia, zawsze
 * z wyjściem awaryjnym (ADR 0004 pkt 7: zero „białego ekranu", wyjaśniamy,
 * co zrobić). Przedrostek `P` jest osobny od `G` z `rozgrywka.js`, żeby
 * „G01" nie znaczyło dwóch różnych rzeczy w jednym interfejsie.
 */
export const KODY_POZYCJI = {
  P01: 'Ta przeglądarka nie udostępnia położenia (brak `navigator.geolocation`). Otwórz stronę przez HTTPS albo wpisz współrzędne przyciskiem „✎ Wpisz ręcznie". Bez strumienia pozycji gra nie rozstrzygnie dojścia do stacji — odcinek można za to pominąć.',
  P02: 'Brak zgody na dostęp do położenia. W Chrome dotknij ikony lokalizacji przy adresie i wybierz „Zawsze zezwalaj", a potem odśwież stronę. Współrzędne możesz też wpisać ręcznie („✎ Wpisz ręcznie") i iść dalej — ale bez strumienia pozycji gra nie rozstrzygnie dojścia do stacji. Do rozegrania partii bez GPS potrzebny jest tryb testowy z symulacją: otwórz aplikację z parametrem ?test=true.',
  P03: 'Położenie jest teraz niedostępne (brak sygnału GPS, tryb samolotowy, głębokie wnętrze budynku). Wyjdź na otwartą przestrzeń — gra czeka na sygnał. Jeśli stacja jest nieosiągalna, pomiń odcinek (ADR 0029: dojście zalicza tylko GPS).',
  P04: 'Telefon nie ustalił położenia w ciągu 20 sekund. Poczekaj chwilę z ekranem włączonym na otwartej przestrzeni — gra czeka na sygnał. Jeśli stacja jest nieosiągalna, pomiń odcinek.',
  P06: 'Otrzymano współrzędne spoza zakresu — ten pomiar został odrzucony. Jeśli powtarza się, wyjdź na otwartą przestrzeń albo wpisz współrzędne ręcznie („✎ Wpisz ręcznie").',
  P07: 'Śledzenie położenia jest wstrzymane, bo aplikacja działa w tle — oszczędzamy baterię. Wróć na kartę, żeby je wznowić (ADR 0004 pkt 1).',
  P08: 'Nieznany błąd położenia: {message}. Wyjdź na otwartą przestrzeń, a jeśli to nie pomoże — wpisz współrzędne ręcznie („✎ Wpisz ręcznie") albo pomiń odcinek.',
  P09: 'Wznowiono śledzenie położenia — pierwszy pomiar po powrocie potrafi trwać kilka sekund.',
};

/** `GeolocationPositionError.code` → nasz kod komunikatu. */
export const BLEDY_API = Object.freeze({ 1: 'P02', 2: 'P03', 3: 'P04' });

/** Podstawienie `{accuracy}` / `{message}` w treści komunikatu. */
function wypelnij(tekst, dane) {
  return tekst.replace(/\{(\w+)\}/g, (_, klucz) => (dane[klucz] == null ? '' : String(dane[klucz])));
}

function komunikat(kod, dane = {}) {
  return wypelnij(KODY_POZYCJI[kod] ?? kod, dane);
}

/**
 * Fix z obiektu `GeolocationPosition` na nasz prosty rekord. Tolerancyjny:
 * przeglądarki potrafią nie podać `accuracy` ani `heading`, a gra nie może
 * się wywrócić na brak pola — oceną zajmuje się `ocenFix`.
 *
 * @param {GeolocationPosition|object} pozycja obiekt z `coords` (albo gotowy fix)
 * @param {number} czasMs znacznik z wstrzykniętego zegara (`performance.now()` w UI)
 * @returns {{lat:number, lon:number, accuracy:number|null, czasMs:number, zrodlo:string}}
 */
export function fixZPozycji(pozycja, czasMs, zrodlo = ZRODLA_FIXA.gps) {
  const coords = pozycja?.coords ?? pozycja ?? {};
  const lat = Number(coords.latitude ?? coords.lat);
  const lon = Number(coords.longitude ?? coords.lon);
  const accuracy = Number.isFinite(Number(coords.accuracy)) ? Number(coords.accuracy) : null;
  return { lat, lon, accuracy, czasMs: Number(czasMs), zrodlo };
}

/** ADR 0034: walidujemy współrzędne, nie szacunek accuracy telefonu. */
export function ocenFix(fix) {
  if (!fix || !czyWspolrzedneOk(fix.lat, fix.lon)) {
    return { stan: STANY_FIXA.niepoprawny, akceptowany: false, kod: 'P06', komunikat: komunikat('P06'), progM: 0 };
  }
  return { stan: STANY_FIXA.ok, akceptowany: true, kod: null, komunikat: '', progM: progDojsciaM() };
}

/**
 * Dołożenie fixu do historii. Zwraca **nową tablicę** (stan jest
 * niezmiennikowy — tak samo jak w `rozgrywka.js`), przyciętą do `limit`
 * ostatnich pomiarów, bo gra trwa godzinę, a debounce potrzebuje kilku.
 *
 * Fixy niepoprawne (NaN, poza zakresem) nie wchodzą do historii: nie da się
 * ich narysować ani policzyć z nich odległości.
 */
export function dodajFix(historia, fix, { limit = GRANICE.historiaFixow } = {}) {
  const baza = Array.isArray(historia) ? historia : [];
  const ocena = ocenFix(fix);
  if (!ocena.akceptowany) return [...baza].slice(-limit);
  return [...baza, fix].slice(-limit);
}

/**
 * Stan dojścia do stacji: rozstrzygnięcie z `geo.czyDotarl` (próg + dwa
 * kolejne fixy, ADR 0004 pkt 2) plus zdanie dla gracza, które mówi, **ile
 * zostało** i **dlaczego** stacja się nie zapala (ADR 0004 pkt 4: jawność
 * niedokładności).
 */
export function stanDojscia(historia, stacja, { wymaganeTrafnienia = GRANICE.wymaganeTrafnienia } = {}) {
  // Filtr na wejściu: `odlegloscM` rzuca wyjątkiem dla współrzędnych bez sensu,
  // a gra w terenie nie może się wywrócić na jednym zepsutym fixie (ADR 0004
  // pkt 7: zero „białego ekranu"). `dodajFix` i tak ich nie wpuszcza.
  const czysta = (Array.isArray(historia) ? historia : []).filter((f) => ocenFix(f).akceptowany);
  if (!stacja || !czyWspolrzedneOk(stacja.lat, stacja.lon)) {
    return {
      dotarl: false, trafienia: 0, wymagane: wymaganeTrafnienia, progM: 0, dystansM: null,
      stanFixa: czysta.at(-1) ? ocenFix(czysta.at(-1)).stan : null,
      kod: 'P06',
      komunikat: 'Brak poprawnych współrzędnych stacji — nie ma czego rozstrzygać. Odśwież układ stacji albo pomiń ten odcinek.',
    };
  }
  const wynik = czyDotarl(czysta, stacja, { wymaganeTrafnienia });
  const ostatni = czysta.length ? czysta[czysta.length - 1] : null;
  const ocena = ostatni ? ocenFix(ostatni) : null;
  const base = {
    dotarl: wynik.dotarl,
    trafienia: wynik.trafienia,
    wymagane: wymaganeTrafnienia,
    progM: Math.round(wynik.progM),
    dystansM: Number.isFinite(wynik.dystansM) ? Math.round(wynik.dystansM) : null,
    stanFixa: ocena?.stan ?? null,
    kod: ocena?.kod ?? null,
  };

  if (!ostatni) return { ...base, komunikat: 'Czekam na pierwszy pomiar położenia — potrafi trwać kilkanaście sekund.' };
  return { ...base, komunikat: wynik.dotarl
    ? `Jesteś na miejscu: ${base.dystansM} m od stacji.`
    : `${base.dystansM} m do stacji.` };

}

/**
 * Błąd `watchPosition` na komunikat dla gracza (ADR 0004 pkt 7): zawsze
 * z wyjściem awaryjnym, nigdy surowym `message` z przeglądarki jako jedyną
 * treścią.
 */
export function bladGeolokalizacji(blad) {
  const kod = BLEDY_API[blad?.code] ?? 'P08';
  return {
    kod,
    komunikat: komunikat(kod, { message: blad?.message ?? 'brak szczegółów' }),
    powod: blad?.message ?? '',
    trybAwaryjny: 'reczny',
  };
}

/* ------------------------------------------------------------ tryb testowy */

/**
 * Deterministyczny „szum" z czasu — zastępuje `Math.random()`, żeby symulacja
 * była odtwarzalna w teście i w trybie `?tryb=test` (ADR 0004 pkt 6).
 * @returns {number} 0..1
 */
function szum(tMs, os = 0) {
  const x = Math.sin((Number(tMs) + os * 7919) * 0.0137) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Trasa symulacji: lista punktów (co najmniej 2), czas przejścia i dokładność.
 * Walidacja jest jawna — tryb testowy ma mówić, co jest nie tak z wpisem.
 * @returns {{usterki: Array<{kod:string, komunikat:string}>}}
 */
export function sprawdzTrase(trasa) {
  const usterki = [];
  if (!trasa || typeof trasa !== 'object') usterki.push({ kod: 'P06', komunikat: 'Trasa symulacji musi być obiektem z listą punktów.' });
  else {
    if (!Array.isArray(trasa.punkty) || trasa.punkty.length < 2) {
      usterki.push({ kod: 'P06', komunikat: 'Trasa symulacji potrzebuje co najmniej dwóch punktów (start i cel).' });
    } else if (trasa.punkty.some((p) => !czyWspolrzedneOk(p?.lat, p?.lon))) {
      usterki.push({ kod: 'P06', komunikat: komunikat('P06') });
    }
    if (!(trasa.czasMs > 0)) usterki.push({ kod: 'P06', komunikat: 'Czas przejścia trasy musi być liczbą większą od zera.' });
  }
  return { usterki };
}

/**
 * Trasa „po linii prostej" z punktu do celu, z `przystanki` punktami pośrednimi
 * — wygoda dla trybu testowego i dla testów (nie trzeba ręcznie liczyć
 * współrzędnych).
 */
export function trasaProsta({ start, cel, czasMs = 600_000, accuracyM = 12, szumM = GRANICE.szumSymulacjiM, przystanki = 0 }) {
  if (!czyWspolrzedneOk(start?.lat, start?.lon) || !czyWspolrzedneOk(cel?.lat, cel?.lon)) {
    throw new TypeError('trasaProsta: start i cel muszą mieć poprawne lat i lon');
  }
  if (!(czasMs > 0)) throw new TypeError('trasaProsta: czasMs > 0');
  const odcinki = Math.max(1, Math.round(przystanki) + 1);
  const bearing = bearingStopnie(start, cel);
  const calosc = odlegloscM(start, cel);
  const punkty = Array.from({ length: odcinki + 1 }, (_, i) => {
    const udzial = i / odcinki;
    return udzial === 0 ? { lat: start.lat, lon: start.lon } : przesunPunkt(start, bearing, calosc * udzial);
  });
  punkty[punkty.length - 1] = { lat: cel.lat, lon: cel.lon }; // ostatni punkt dokładnie w celu
  return { punkty, czasMs, accuracyM, szumM, zrodlo: ZRODLA_FIXA.symulacja };
}

/**
 * Położenie na trasie w chwili `tMs` (0..czasMs; po czasie — cel). Interpolacja
 * po łamanej z punktów trasy, z deterministycznym rozrzutem `szumM`.
 * Czysta funkcja: ten sam `tMs` daje zawsze ten sam fix.
 */
export function punktNaTrasie(trasa, tMs) {
  const { usterki } = sprawdzTrase(trasa);
  if (usterki.length) throw new TypeError(`punktNaTrasie: ${usterki[0].komunikat}`);
  const odcinki = [];
  let calosc = 0;
  for (let i = 1; i < trasa.punkty.length; i++) {
    const dlugosc = odlegloscM(trasa.punkty[i - 1], trasa.punkty[i]);
    odcinki.push({ od: trasa.punkty[i - 1], do: trasa.punkty[i], dlugosc });
    calosc += dlugosc;
  }
  if (calosc <= 0) return { lat: trasa.punkty[0].lat, lon: trasa.punkty[0].lon };
  const postep = ogranicz(Number(tMs) / trasa.czasMs, 0, 1);
  let cel = postep * calosc;
  for (const odcinek of odcinki) {
    if (cel <= odcinek.dlugosc || odcinek === odcinki[odcinki.length - 1]) {
      const udzial = odcinek.dlugosc > 0 ? ogranicz(cel / odcinek.dlugosc, 0, 1) : 1;
      return przesunPunkt(odcinek.od, bearingStopnie(odcinek.od, odcinek.do), odcinek.dlugosc * udzial);
    }
    cel -= odcinek.dlugosc;
  }
  return { lat: trasa.punkty.at(-1).lat, lon: trasa.punkty.at(-1).lon };
}

/**
 * Symulowany fix w chwili `tMs` (ADR 0004 pkt 6): pozycja z `punktNaTrasie`
 * plus deterministyczny rozrzut i zmienna dokładność — tak, żeby debounce
 * i filtr dokładności miały co robić również bez GPS.
 *
 * Ostatni fix (i każdy po czasie trasy) leży dokładnie w celu z rozrzutem
 * `szumM`, więc symulacja **kończy się dojściem** — to kryterium testu.
 */
export function fixSymulowany(trasa, tMs) {
  const { usterki } = sprawdzTrase(trasa);
  if (usterki.length) throw new TypeError(`fixSymulowany: ${usterki[0].komunikat}`);
  const punkt = punktNaTrasie(trasa, tMs);
  const szumM = Number.isFinite(trasa.szumM) ? Math.max(0, trasa.szumM) : GRANICE.szumSymulacjiM;
  const dokladnosc = Number.isFinite(trasa.accuracyM) ? trasa.accuracyM : 12;
  // rozrzut w dwóch osiach: -szumM..+szumM, deterministycznie z czasu
  const lat = punkt.lat + ((szum(tMs, 0) - 0.5) * 2 * szumM) / 111320;
  const lon = punkt.lon + ((szum(tMs, 1) - 0.5) * 2 * szumM) / (111320 * Math.cos((punkt.lat * Math.PI) / 180) || 1);
  const zmiennaDokladnosc = dokladnosc * (0.8 + 0.4 * szum(tMs, 2));
  return {
    lat,
    lon,
    accuracy: Math.round(zmiennaDokladnosc * 10) / 10,
    czasMs: Number(tMs),
    zrodlo: trasa.zrodlo ?? ZRODLA_FIXA.symulacja,
  };
}

/**
 * Sekwencja fixów z zadaną częstotliwością (`coMs`) od 0 do `doMs` włącznie —
 * „odtwarzanie trasy" z ADR 0004 pkt 6 i materiał na testy reguły dojścia.
 *
 * `postoj` to liczba dodatkowych fixów **po dojściu** (gracz stoi przy stacji):
 * bez nich debounce z ADR 0004 pkt 2 (dwa kolejne trafienia) nigdy by się nie
 * spełnił i symulacja kończyłaby się „prawie dojściem".
 */
export function sekwencjaSymulowana(trasa, { coMs = 5000, doMs = null, postoj = GRANICE.wymaganeTrafnienia } = {}) {
  const { usterki } = sprawdzTrase(trasa);
  if (usterki.length) throw new TypeError(`sekwencjaSymulowana: ${usterki[0].komunikat}`);
  if (!(coMs > 0)) throw new TypeError('sekwencjaSymulowana: coMs > 0');
  if (!(postoj >= 0)) throw new TypeError('sekwencjaSymulowana: postoj >= 0');
  const koniec = doMs == null ? trasa.czasMs : doMs;
  const fixy = [];
  for (let t = 0; t <= koniec; t += coMs) fixy.push(fixSymulowany(trasa, t));
  if (fixy.at(-1)?.czasMs !== koniec) fixy.push(fixSymulowany(trasa, koniec)); // domknięcie do celu
  for (let k = 1; k <= postoj; k++) fixy.push(fixSymulowany(trasa, koniec + k * coMs));
  return fixy;
}

/* ------------------------------------------------------------- osłona API */

/**
 * Cienka osłona `watchPosition`. Jedyny kontakt modułu z przeglądarką:
 * `geolocation` jest parametrem, więc w teście podstawiamy atrapę, a w `app.js`
 * — `navigator.geolocation`.
 *
 * @param {object} args
 * @param {object} args.geolocation obiekt z `watchPosition` i `clearWatch`
 * @param {Function} args.onFix     `(fix, ocena) => void` — fix już spłaszczony
 * @param {Function} [args.onBlad]  `({kod, komunikat, powod, trybAwaryjny}) => void`
 * @param {object}   [args.opcje]   domyślnie `OPCJE_WATCH` (ADR 0004 pkt 1)
 * @param {Function} [args.zegar]   `() => number` — znacznik czasu fixa (UI podaje `performance.now`)
 * @returns {{zamknij: Function, czyAktywny: Function}}
 */
export function watchPozycja({ geolocation, onFix, onBlad = null, opcje = OPCJE_WATCH, zegar = null }) {
  if (typeof onFix !== 'function') throw new TypeError('watchPozycja: onFix jest wymagany');
  if (!geolocation || typeof geolocation.watchPosition !== 'function' || typeof geolocation.clearWatch !== 'function') {
    onBlad?.({ kod: 'P01', komunikat: komunikat('P01'), powod: '', trybAwaryjny: 'test' });
    return { zamknij: () => {}, czyAktywny: () => false };
  }
  let aktywny = true;
  const id = geolocation.watchPosition(
    (pozycja) => {
      if (!aktywny) return;
      const fix = fixZPozycji(pozycja, typeof zegar === 'function' ? zegar() : Number(pozycja?.timestamp) || 0);
      onFix(fix, ocenFix(fix));
    },
    (blad) => {
      if (!aktywny) return;
      onBlad?.(bladGeolokalizacji(blad));
    },
    { ...OPCJE_WATCH, ...opcje },
  );
  return {
    zamknij: () => {
      if (!aktywny) return;
      aktywny = false;
      geolocation.clearWatch(id);
    },
    czyAktywny: () => aktywny,
  };
}

/** Komunikat pauzy w tle (ADR 0004 pkt 1: oszczędność baterii). */
export function komunikatPauzy() {
  return { kod: 'P07', komunikat: komunikat('P07'), trybAwaryjny: null };
}

/** Komunikat wznowienia śledzenia po powrocie na kartę (ADR 0004 pkt 1). */
export function komunikatWznowienia() {
  return { kod: 'P09', komunikat: komunikat('P09'), trybAwaryjny: null };
}
