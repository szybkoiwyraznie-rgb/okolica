/**
 * konfig.js — kanon konfiguracji rozgrywki: czyste dane + walidacja setupu.
 *
 * Źródło prawdy treści: `docs/PROTOKOL.md` §4 (kategorie wiekowe) i §5 (kanon
 * tematów). Opisy trudności i tematów trafiają DOSŁOWNIE do promptu, więc
 * `test/kontrakt.test.js` porównuje je z tabelami w protokole. Zmiana tutaj bez
 * zmiany w dokumencie (albo odwrotnie) = czerwona brama.
 */

export const WERSJA_KONFIG = 'konfig/1';

/**
 * Tryby poruszania się. Promień domyślny i zoom docelowy wg ADR 0003 pkt 5
 * i ADR 0005 pkt 3; `klasyDrog` to wartości tagu `highway` brane pod uwagę
 * przy wyborze stacji, a `punktowanie` — klasy, przy których stacja jest
 * sensowna (parking zamiast punktu na jezdni).
 */
export const TRYBY = {
  piesza: {
    etykieta: 'piesza',
    ikona: '🚶',
    opis: 'Pieszo — stacje w zasięgu spaceru, chodniki, ścieżki i place',
    zoom: 17,
    predkoscKmh: 4.5,
    klasyDrog: [
      'footway', 'path', 'pedestrian', 'steps', 'living_street', 'residential',
      'service', 'track', 'cycleway',
    ],
  },
  rower: {
    etykieta: 'rowerowa',
    ikona: '🚴',
    opis: 'Rowerem — drogi rowerowe i spokojne ulice, bez schodów',
    zoom: 15,
    predkoscKmh: 15,
    klasyDrog: [
      'cycleway', 'path', 'pedestrian', 'living_street', 'residential',
      'service', 'track', 'tertiary', 'unclassified',
    ],
    wykluczoneKlasy: ['steps', 'motorway', 'trunk'],
  },
  samochodowa: {
    etykieta: 'samochodowa',
    ikona: '🚗',
    opis: 'Samochodem — stacje przy parkingu albo obiekcie z dojazdem',
    zoom: 13,
    predkoscKmh: 40,
    klasyDrog: [
      'residential', 'tertiary', 'secondary', 'primary', 'unclassified', 'service',
    ],
    wykluczoneKlasy: ['motorway', 'trunk', 'footway', 'path', 'steps', 'pedestrian'],
    wymagaParkingu: true,
  },
};

/**
 * Kategorie wiekowe (protokół PYT §4). `opisTrudnosci` jest wklejany do promptu
 * jako `{OPIS_TRUDNOSCI}`; wagi punktowej nie ma (rev2: każde pytanie 1 pkt).
 */
export const WIEK = {
  7: {
    etykieta: '7 lat',
    opisTrudnosci:
      'Zdania krótkie, do 15 słów. Słownictwo codzienne, bez terminów specjalistycznych. Jedno pytanie = jeden fakt. Odpowiedzi rzeczowe i nazwy, bez dat i liczb wielocyfrowych. Preferowane pytania o rzeczy, które dziecko może zobaczyć albo zna z spaceru.',
  },
  10: {
    etykieta: '10 lat',
    opisTrudnosci:
      'Zdania do 20 słów. Pojęcia proste, jedno pojęcie specjalistyczne na pytanie dopuszczalne, jeśli wyjaśnienie je tłumaczy. Jedna data albo jedna liczba w pytaniu dopuszczalna.',
  },
  12: {
    etykieta: '12 lat',
    opisTrudnosci:
      'Pełne zdania, terminy z objaśnieniem w wyjaśnieniu. Daty, liczby i porównania dopuszczalne. Pytanie może wymagać dwóch kroków rozumowania.',
  },
  15: {
    etykieta: '15 lat',
    opisTrudnosci:
      'Jak dla dorosłych, ale bez żargonu akademickiego i bez pytań wymagających wiedzy specjalistycznej z poziomu studiów.',
  },
  dorosli: {
    etykieta: 'dorośli',
    opisTrudnosci:
      'Bez ograniczeń długości i słownictwa. Dopuszczalne pytania porównawcze, przyczynowo-skutkowe i o szczegóły (daty dzienne, nazwiska, liczby).',
  },
};

/** Kanon tematów (protokół PYT §5). Klucze: małe litery, myślniki, bez spacji. */
export const TEMATY = {
  historia: {
    etykieta: 'Historia',
    opis: 'dzieje miejsca, daty, wydarzenia, dawne nazwy, ślady historii w terenie',
  },
  przyroda: {
    etykieta: 'Przyroda',
    opis: 'drzewa, rośliny, zwierzęta, wody, parki, formy terenu, ochrona przyrody',
  },
  architektura: {
    etykieta: 'Architektura',
    opis: 'budynki, style, autorzy projektów, detale, układ ulic i zabudowy',
  },
  kultura: {
    etykieta: 'Kultura',
    opis: 'instytucje kultury, pomniki sztuki, murale, festiwale, twórcy związani z miejscem',
  },
  legendy: {
    etykieta: 'Legendy',
    opis: 'podania miejskie, legendy, zwyczaje, przesądy, opowieści o miejscu',
  },
  ludzie: {
    etykieta: 'Ludzie',
    opis: 'mieszkańcy, patroni ulic, postaci historyczne związane z okolicą',
  },
  nauka: {
    etykieta: 'Nauka',
    opis: 'wynalazki, zakłady, infrastruktura, badania, obiekty inżynieryjne',
  },
  sport: {
    etykieta: 'Sport',
    opis: 'kluby, obiekty sportowe, trasy, wydarzenia sportowe, miejsca wypoczynku',
  },
  jedzenie: {
    etykieta: 'Jedzenie',
    opis: 'targi, lokale, rzemiosło, dawni i obecni kupcy, produkty lokalne',
  },
  geografia: {
    etykieta: 'Geografia',
    opis: 'rzeki, jeziora, wzgórza, granice administracyjne, nazwy geograficzne, mosty',
  },
  wlasny: {
    etykieta: 'Dopisz sam',
    opis: 'dziedzina wpisana przez organizatora w setupie',
  },
};

/**
 * Stare klucze kanonu (sprzed decyzji właściciela z 2026-09-07 o nazwach
 * jednoczłonowych) → klucze kanoniczne. Paczki i konfiguracje zapisane
 * starymi kluczami są przyjmowane i normalizowane, nie odrzucane.
 */
export const ALIASY_TEMATOW = {
  'kultura-i-sztuka': 'kultura',
  'legendy-i-folklor': 'legendy',
  'ludzie-i-postacie': 'ludzie',
  'nauka-i-technika': 'nauka',
  'sport-i-rekreacja': 'sport',
  'jedzenie-i-handel': 'jedzenie',
  'geografia-i-woda': 'geografia',
};

/** Klucz kanoniczny tematu (aliasy historyczne mapowane na nowe klucze). */
export function kanonicznyTemat(temat) {
  return ALIASY_TEMATOW[temat] ?? temat;
}

/** Języki treści pytań (interfejs jest zawsze po polsku — ADR 0011 pkt 8). */
export const JEZYKI = { polski: 'polski', angielski: 'angielski', niemiecki: 'niemiecki', ukrainski: 'ukraiński' };

/** Podkłady mapy — klucze muszą się zgadzać z `docs/ASSETS.md` §1 (ADR 0003). */
export const PODKLADY = {
  osm: { etykieta: 'OpenStreetMap', maxZoom: 19, atrybucja: '© OpenStreetMap contributors (ODbL)' },
  opentopo: { etykieta: 'OpenTopoMap', maxZoom: 17, atrybucja: '© OpenStreetMap contributors · © OpenTopoMap (CC-BY-SA)' },
  'esri-satelita': { etykieta: 'Esri World Imagery', maxZoom: 19, atrybucja: 'Powered by Esri · © Esri, Maxar, Earthstar Geographics' },
  brak: { etykieta: 'Wyłączony (offline)', maxZoom: 19, atrybucja: '' },
};

/** Twarde granice parametrów setupu. */
export const OGRANICZENIA = {
  liczbaGraczy: { min: 1, max: 8 },
  liczbaStacji: { min: 3, max: 12 },
  // max = maks. liczba graczy: w hot-seacie każdy gracz może odpowiadać przy
  // każdej stacji (ADR 0027), a pytania mają się dzielić równo między graczy.
  pytaniaNaStacje: { min: 1, max: 8 },
  promienM: { min: 200, max: 50000 },
  czasGryMin: { min: 10, max: 480 },
  dlugoscKoduGry: { min: 4, max: 40 },
  dlugoscImienia: { min: 1, max: 20 },
};

/** Wartości domyślne ekranu setup (brief właściciela z 2026-09-05; liczba graczy: decyzja z 2026-09-07 — hot-seat startuje od 1). */
export const DOMYSLNE = {
  tryb: 'piesza',
  liczbaGraczy: 1,
  liczbaStacji: 5,
  pytaniaNaStacje: 1,
  czasGryMin: 60, // planowany czas gry; promień jest z niego liczony (ADR 0025)
  tematy: ['historia', 'przyroda', 'architektura', 'kultura', 'legendy', 'ludzie', 'nauka', 'sport', 'jedzenie', 'geografia'],
  tematWlasny: '', // tekst organizatora dla tematu `wlasny` (niezaznaczony domyślnie)
  wiek: 'dorosli',
  jezyk: 'polski',
  podklad: 'osm',
};

/**
 * Parametry przeliczenia planowanego czasu gry na promień (ADR 0025).
 *
 * - `sekundyNaPytanie`: przeczytanie pytania, narada i odpowiedź przy stacji.
 * - `udzialDrogi`: z czasu, który zostaje po pytaniach, tylko ta część realnie
 *   idzie na przemieszczanie się (reszta: czytanie tablic, rozmowa, czekanie
 *   na grupę, światła, zapas).
 * - `wspolczynnikTrasy`: trasa przez N stacji rozmieszczonych w kole o
 *   promieniu R ma długość ≈ 1,4·√N·R (klasyczne przybliżenie TSP daje
 *   0,71·√(N·πR²) ≈ 1,26·√N·R; 1,4 dokłada ~10% na kręte chodniki).
 * - `krokM`: zaokrąglenie — mapa i tak nie rozróżnia dziesiątek metrów.
 */
export const PARAMETRY_CZASU = {
  sekundyNaPytanie: 90,
  udzialDrogi: 0.4,
  wspolczynnikTrasy: 1.4,
  krokM: 50,
};

/**
 * Przeliczenie planowanego czasu gry na promień wyszukiwania stacji (ADR 0025)
 * wraz ze składowymi — UI pokazuje je jako uzasadnienie liczby.
 *
 * Kalibracja właściciela (2026-09-07): 60 min, pieszo (4,5 km/h), 5 stacji
 * × 1 pytanie → **500 m**. Wzór: odpowiedzi 5 × 90 s = 7,5 min; na drogę
 * (60 − 7,5) × 0,4 = 21 min = 1575 m przy 4,5 km/h; promień = 1575 / (1,4·√5)
 * ≈ 503 m → 500 m po zaokrągleniu.
 *
 * Wynik jest zawsze w widełkach `OGRANICZENIA.promienM`: gdy pytania zjadają
 * cały czas, zostaje minimum (200 m), nie zero i nie NaN.
 */
export function przeliczenieCzasu({ czasGryMin, tryb, liczbaStacji, pytaniaNaStacje } = {}) {
  const minuty = Number.isFinite(czasGryMin) ? czasGryMin : 0;
  const predkoscKmh = TRYBY[tryb]?.predkoscKmh ?? TRYBY[DOMYSLNE.tryb].predkoscKmh;
  const stacje = Number.isInteger(liczbaStacji) && liczbaStacji > 0 ? liczbaStacji : 1;
  const pytania = stacje * (Number.isInteger(pytaniaNaStacje) && pytaniaNaStacje > 0 ? pytaniaNaStacje : 1);
  const czasOdpowiedziS = pytania * PARAMETRY_CZASU.sekundyNaPytanie;
  const czasDrogiS = Math.max(0, minuty * 60 - czasOdpowiedziS) * PARAMETRY_CZASU.udzialDrogi;
  const trasaM = czasDrogiS * ((predkoscKmh * 1000) / 3600);
  const surowyM = trasaM / (PARAMETRY_CZASU.wspolczynnikTrasy * Math.sqrt(stacje));
  const { min, max } = OGRANICZENIA.promienM;
  const zaokraglony = Math.round(surowyM / PARAMETRY_CZASU.krokM) * PARAMETRY_CZASU.krokM;
  return {
    pytania,
    czasOdpowiedziMin: czasOdpowiedziS / 60,
    czasDrogiMin: czasDrogiS / 60,
    trasaM: Math.round(trasaM),
    promienM: Math.min(max, Math.max(min, zaokraglony)),
  };
}

/** Sam promień (liczba) — tam, gdzie składowe nie są potrzebne. */
export function promienZCzasuGry(kryteria) {
  return przeliczenieCzasu(kryteria).promienM;
}

/** Konfiguracja startowa dla `liczbaGraczy` graczy (imiona domyślne). */
export function domyslnaKonfiguracja(liczbaGraczy = DOMYSLNE.liczbaGraczy) {
  // Argument bywa śmieciem (ręczna edycja `localStorage`, stary schemat,
  // `liczbaGraczy: "dużo"`): `Math.max(1, NaN)` daje NaN, a NaN w liczbie
  // graczy wchodzi do formularza, do listy imion i do stanu rozgrywki.
  // Wartość nienumeryczna = wartość z briefu, nie przepuszczony NaN.
  const surowe = liczbaGraczy == null || liczbaGraczy === '' ? NaN : Number(liczbaGraczy);
  const n = Number.isFinite(surowe)
    ? Math.min(Math.max(1, Math.round(surowe)), OGRANICZENIA.liczbaGraczy.max)
    : DOMYSLNE.liczbaGraczy;
  // Hot-seat (ADR 0027): domyślnie każdy gracz odpowiada raz przy każdej
  // stacji, więc pytań na stację jest tyle, ilu jest graczy — wtedy łączna
  // liczba pytań (stacje × gracze) dzieli się między nich bez reszty.
  const pytania = Math.min(n, OGRANICZENIA.pytaniaNaStacje.max);
  return {
    ...DOMYSLNE,
    liczbaGraczy: n,
    pytaniaNaStacje: pytania,
    czasGryMin: DOMYSLNE.czasGryMin,
    promienM: promienZCzasuGry({
      czasGryMin: DOMYSLNE.czasGryMin,
      tryb: DOMYSLNE.tryb,
      liczbaStacji: DOMYSLNE.liczbaStacji,
      pytaniaNaStacje: pytania,
    }),
    imiona: Array.from({ length: n }, (_, i) => `Gracz ${i + 1}`),
  };
}

/** Liczba pytań w paczce = stacje × pytania na stację (protokół §3.1). */
export function liczbaPytan(konfig) {
  return konfig.liczbaStacji * konfig.pytaniaNaStacje;
}

/**
 * Ziarno rozgrywki (ADR 0005 pkt 6): deterministyczne z położenia, promienia,
 * liczby stacji i daty. Pozwala odtworzyć ten sam układ stacji i przetestować
 * algorytm bez `Math.random()`.
 */
export function ziarnoRozgrywki({ lat, lon, promienM, liczbaStacji, data }) {
  const latZ = (Math.round(lat * 20000) / 20000).toFixed(5); // siatka ~6 m
  const lonZ = (Math.round(lon * 20000) / 20000).toFixed(5);
  return `okolica:${latZ}:${lonZ}:${promienM}:${liczbaStacji}:${data}`;
}

/**
 * RNG deterministyczny (mulberry32) z ziarna tekstowego. Zamiast
 * `Math.random()` wszędzie tam, gdzie potrzebna losowość powtarzalna.
 */
export function rngZZiarna(ziarno) {
  let h = 1779033703 ^ String(ziarno).length;
  for (let i = 0; i < String(ziarno).length; i++) {
    h = Math.imul(h ^ String(ziarno).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function losuj() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Polskie znaki → ASCII (kod gry ląduje w nazwach plików i kluczach). */
function ascii(czlon) {
  return String(czlon ?? '').toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
    .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ź|ż/g, 'z')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Domyślny `kod gry` (Partia 2, pkt 7): identyfikator z imion, miejsca i daty
 * z godziną (`ala-ewa-podkowa-0709-1432`) — czytelny w plikach i unikalny
 * między grami tego samego dnia. Kod niczego nie chroni (ADR 0007 pkt 2:
 * pytań chroni ukrycie paczki), więc nie ma go w setupie.
 */
export function domyslnyKodGry({ imiona = [], miejsce = '', teraz = new Date() } = {}) {
  const kto = imiona.filter((i) => String(i ?? '').trim()).slice(0, 2).map(ascii).filter(Boolean).join('-') || 'gra';
  const gdzie = ascii(String(miejsce).split(',')[0].split(' ').slice(0, 2).join(' ')) || 'teren';
  const d = teraz instanceof Date ? teraz : new Date(teraz);
  const nr = (n) => String(n).padStart(2, '0');
  return `${kto}-${gdzie}-${nr(d.getDate())}${nr(d.getMonth() + 1)}-${nr(d.getHours())}${nr(d.getMinutes())}`.slice(0, 40);
}

/**
 * Walidacja konfiguracji z ekranu setup. Zwraca listę usterek
 * `{ kod, pole, komunikat }`; pusta = konfiguracja poprawna.
 * Kody K** są wewnętrzne (nie mylić z E** protokołu PYT).
 */
/**
 * Sanitizacja konfiguracji z zewnątrz: `localStorage`, import, stary schemat.
 * Pole spoza kanonu wraca do wartości domyślnej zamiast wysypywać UI (radio bez
 * pasującego `value` to `null.checked` — LESSONS L9 pokazuje, jak drobiazg
 * kładzie cały ekran). Liczby muszą być skończone i w zakresie z OGRANICZENIA.
 * Czysta funkcja — testowalna w Node (`test/konfig.test.js`).
 */
export function oczyscKonfiguracje(surowa) {
  const zrodlo = surowa && typeof surowa === 'object' ? surowa : {};
  const domyslne = domyslnaKonfiguracja(zrodlo.liczbaGraczy);
  const konfig = { ...domyslne };

  // pola wybierane z kanonu: klucz musi istnieć, inaczej default
  const kanony = { tryb: TRYBY, wiek: WIEK, podklad: PODKLADY, jezyk: JEZYKI };
  for (const [pole, kanon] of Object.entries(kanony)) {
    if (Object.hasOwn(kanon, zrodlo[pole])) konfig[pole] = zrodlo[pole];
  }

  // liczby: skończone i w widełkach (poza widełkami zostawiamy walidujSetup —
  // tu chodzi tylko o wartości, które rozsadziłyby renderowanie)
  const liczby = {
    liczbaGraczy: OGRANICZENIA.liczbaGraczy,
    liczbaStacji: OGRANICZENIA.liczbaStacji,
    pytaniaNaStacje: OGRANICZENIA.pytaniaNaStacje,
    czasGryMin: OGRANICZENIA.czasGryMin,
  };
  for (const [pole, zakres] of Object.entries(liczby)) {
    const v = Number(zrodlo[pole]);
    if (!Number.isFinite(v)) continue;
    konfig[pole] = Math.min(Math.max(Math.round(v), zakres.min), zakres.max);
  }
  // Liczba graczy bez podanych pytań na stację: domyślnie każdy gracz
  // odpowiada raz przy każdej stacji (ADR 0027). Jawne `pytaniaNaStacje`
  // w źródle ma pierwszeństwo — nawet gdy nie dzieli się równo (to zgłosi K22).
  if (zrodlo.pytaniaNaStacje === undefined) {
    konfig.pytaniaNaStacje = Math.min(konfig.liczbaGraczy, OGRANICZENIA.pytaniaNaStacje.max);
  }

  // Promień jest WYNIKIEM, nie wejściem (ADR 0025): liczy się z czasu, trybu
  // i liczby pytań — także dla starych zapisów, które niosły własny `promienM`
  // (migracja: brak `czasGryMin` = domyślne 60 min).
  konfig.promienM = promienZCzasuGry({
    czasGryMin: konfig.czasGryMin,
    tryb: konfig.tryb,
    liczbaStacji: konfig.liczbaStacji,
    pytaniaNaStacje: konfig.pytaniaNaStacje,
  });

  // listy i teksty
  konfig.tematy = Array.isArray(zrodlo.tematy) ? [...new Set(zrodlo.tematy.map(kanonicznyTemat))].filter((t) => Object.hasOwn(TEMATY, t)) : [];
  konfig.tematWlasny = typeof zrodlo.tematWlasny === 'string' ? zrodlo.tematWlasny.trim().slice(0, 40) : '';
  if (konfig.tematy.length === 0) konfig.tematy = [...domyslne.tematy];
  konfig.imiona = Array.isArray(zrodlo.imiona)
    ? zrodlo.imiona.slice(0, konfig.liczbaGraczy).map((imie, i) => (typeof imie === 'string' && imie.trim() ? imie.trim().slice(0, OGRANICZENIA.dlugoscImienia.max) : `Gracz ${i + 1}`))
    : [...domyslne.imiona];
  while (konfig.imiona.length < konfig.liczbaGraczy) konfig.imiona.push(`Gracz ${konfig.imiona.length + 1}`);
  if (typeof zrodlo.kodGry === 'string') {
    konfig.kodGry = zrodlo.kodGry.trim().slice(0, OGRANICZENIA.dlugoscKoduGry.max);
  }
  return konfig;
}

export function walidujSetup(konfig) {
  const u = [];
  const dodaj = (kod, pole, komunikat) => u.push({ kod, pole, komunikat });
  if (!konfig || typeof konfig !== 'object') {
    dodaj('K01', 'konfig', 'Brak konfiguracji — zacznij od ekranu ustawień.');
    return u;
  }

  if (!TRYBY[konfig.tryb]) dodaj('K02', 'tryb', `Nieznany tryb „${konfig.tryb}". Wybierz pieszą, rowerową albo samochodową.`);
  if (!WIEK[konfig.wiek]) dodaj('K03', 'wiek', `Nieznana kategoria wiekowa „${konfig.wiek}".`);
  if (!JEZYKI[konfig.jezyk]) dodaj('K04', 'jezyk', `Nieznany język pytań „${konfig.jezyk}".`);
  if (!PODKLADY[konfig.podklad]) dodaj('K06', 'podklad', `Nieznany podkład mapy „${konfig.podklad}".`);

  const { min: minG, max: maxG } = OGRANICZENIA.liczbaGraczy;
  if (!Number.isInteger(konfig.liczbaGraczy) || konfig.liczbaGraczy < minG || konfig.liczbaGraczy > maxG) {
    dodaj('K07', 'liczbaGraczy', `Liczba graczy musi być liczbą całkowitą od ${minG} do ${maxG}.`);
  }
  if (!Array.isArray(konfig.imiona) || konfig.imiona.length !== konfig.liczbaGraczy) {
    dodaj('K08', 'imiona', `Lista imion musi mieć dokładnie ${konfig.liczbaGraczy} pozycji.`);
  } else {
    konfig.imiona.forEach((imie, i) => {
      if (typeof imie !== 'string' || imie.trim().length < OGRANICZENIA.dlugoscImienia.min || imie.trim().length > OGRANICZENIA.dlugoscImienia.max) {
        dodaj('K08', `imiona[${i}]`, `Imię gracza ${i + 1} musi mieć od 1 do 20 znaków.`);
      }
    });
    const poNormalizacji = konfig.imiona.map((i) => String(i).trim().toLowerCase());
    if (new Set(poNormalizacji).size !== poNormalizacji.length) {
      dodaj('K09', 'imiona', 'Imiona graczy muszą się różnić — inaczej nie widać, czyja jest kolejka.');
    }
  }

  const { min: minS, max: maxS } = OGRANICZENIA.liczbaStacji;
  if (!Number.isInteger(konfig.liczbaStacji) || konfig.liczbaStacji < minS || konfig.liczbaStacji > maxS) {
    dodaj('K10', 'liczbaStacji', `Liczba stacji musi być liczbą całkowitą od ${minS} do ${maxS}.`);
  }
  const { min: minP, max: maxP } = OGRANICZENIA.pytaniaNaStacje;
  if (!Number.isInteger(konfig.pytaniaNaStacje) || konfig.pytaniaNaStacje < minP || konfig.pytaniaNaStacje > maxP) {
    dodaj('K11', 'pytaniaNaStacje', `Liczba pytań na stację musi być liczbą od ${minP} do ${maxP}.`);
  }

  // Hot-seat: pytania po równo na gracza (ADR 0027). Minimum „tyle pytań co
  // stacji" wynika z K11 (pytaniaNaStacje ≥ 1); tu chodzi o równy podział.
  if (Number.isInteger(konfig.liczbaGraczy) && konfig.liczbaGraczy > 1
    && Number.isInteger(konfig.liczbaStacji) && Number.isInteger(konfig.pytaniaNaStacje)
    && (konfig.liczbaStacji * konfig.pytaniaNaStacje) % konfig.liczbaGraczy !== 0) {
    dodaj('K22', 'pytaniaNaStacje',
      `Pytania muszą dzielić się równo między graczy: ${konfig.liczbaStacji} stacji × ${konfig.pytaniaNaStacje} pytania = ${konfig.liczbaStacji * konfig.pytaniaNaStacje} pytań dla ${konfig.liczbaGraczy} graczy. Zmień liczbę graczy, stacji albo pytań na stację.`);
  }

  const { min: minC, max: maxC } = OGRANICZENIA.czasGryMin;
  if (!Number.isFinite(konfig.czasGryMin) || konfig.czasGryMin < minC || konfig.czasGryMin > maxC) {
    dodaj('K19', 'czasGryMin', `Planowany czas gry musi mieścić się w zakresie ${minC}–${maxC} minut.`);
  }

  const { min: minR, max: maxR } = OGRANICZENIA.promienM;
  if (!Number.isFinite(konfig.promienM) || konfig.promienM < minR || konfig.promienM > maxR) {
    dodaj('K12', 'promienM', `Promień gry musi mieścić się w zakresie ${minR}–${maxR} m.`);
  } else if (TRYBY[konfig.tryb] && konfig.promienM > maxR / 2 && konfig.tryb === 'piesza') {
    dodaj('K13', 'promienM', 'Promień powyżej 25 km pieszo? Sprawdź, czy na pewno nie chodzi o inny tryb.');
  }

  if (!Array.isArray(konfig.tematy) || konfig.tematy.length === 0) {
    dodaj('K14', 'tematy', 'Wybierz co najmniej jeden temat pytań.');
  } else {
    konfig.tematy.forEach((temat) => {
      if (!TEMATY[temat]) dodaj('K15', 'tematy', `Temat „${temat}" nie należy do kanonu (PROTOKOL §5).`);
    });
    if (new Set(konfig.tematy).size !== konfig.tematy.length) {
      dodaj('K16', 'tematy', 'Tematy nie mogą się powtarzać.');
    }
  }


  if (konfig.kodGry !== '' && konfig.kodGry != null) {
    const kod = String(konfig.kodGry).trim();
    const { min: minD, max: maxD } = OGRANICZENIA.dlugoscKoduGry;
    if (kod.length < minD || kod.length > maxD) {
      dodaj('K18', 'kodGry', `Kod gry musi mieć od ${minD} do ${maxD} znaków (albo zostaw puste; pytań nie chroni kod, tylko ukrycie paczki).`);
    }
  }

  if (Array.isArray(konfig.tematy) && konfig.tematy.includes('wlasny')
    && (typeof konfig.tematWlasny !== 'string' || !konfig.tematWlasny.trim())) {
    dodaj('K21', 'tematWlasny', 'Zaznaczyłeś temat „Dopisz sam" — wpisz dziedzinę (np. kinematografia).');
  }

  return u;
}
