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
    promienM: 1000,
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
    promienM: 3000,
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
    promienM: 10000,
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
 * jako `{OPIS_TRUDNOSCI}`; `punkty` to bazowa waga pytania.
 */
export const WIEK = {
  7: {
    etykieta: '7 lat',
    punkty: 10,
    opisTrudnosci:
      'Zdania krótkie, do 15 słów. Słownictwo codzienne, bez terminów specjalistycznych. Jedno pytanie = jeden fakt. Odpowiedzi rzeczowe i nazwy, bez dat i liczb wielocyfrowych. Preferowane pytania o rzeczy, które dziecko może zobaczyć albo zna z spaceru.',
  },
  10: {
    etykieta: '10 lat',
    punkty: 10,
    opisTrudnosci:
      'Zdania do 20 słów. Pojęcia proste, jedno pojęcie specjalistyczne na pytanie dopuszczalne, jeśli wyjaśnienie je tłumaczy. Jedna data albo jedna liczba w pytaniu dopuszczalna.',
  },
  12: {
    etykieta: '12 lat',
    punkty: 15,
    opisTrudnosci:
      'Pełne zdania, terminy z objaśnieniem w wyjaśnieniu. Daty, liczby i porównania dopuszczalne. Pytanie może wymagać dwóch kroków rozumowania.',
  },
  15: {
    etykieta: '15 lat',
    punkty: 15,
    opisTrudnosci:
      'Jak dla dorosłych, ale bez żargonu akademickiego i bez pytań wymagających wiedzy specjalistycznej z poziomu studiów.',
  },
  dorosli: {
    etykieta: 'dorośli',
    punkty: 20,
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

/** Kto odpowiada na pytanie przy stacji (ADR 0009 pkt 4). */
export const WSPOLPRACA = {
  solo: { etykieta: 'Sam gracz z kolejki', opis: 'Pozostali nie podpowiadają' },
  zespol: { etykieta: 'Zespół', opis: 'Dowolny gracz odpowiada, punkty na konto gracza z kolejki' },
  wszyscy: { etykieta: 'Każdy osobno', opis: 'Wszyscy odpowiadają na tym samym telefonie, punkty osobno' },
};

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
  pytaniaNaStacje: { min: 1, max: 3 },
  promienM: { min: 200, max: 50000 },
  karaRecznaS: { min: 0, max: 600 },
  dlugoscKoduGry: { min: 4, max: 8 },
  dlugoscImienia: { min: 1, max: 20 },
};

/** Wartości domyślne ekranu setup (brief właściciela z 2026-09-05; liczba graczy: decyzja z 2026-09-07 — hot-seat startuje od 1). */
export const DOMYSLNE = {
  tryb: 'piesza',
  liczbaGraczy: 1,
  liczbaStacji: 5,
  pytaniaNaStacje: 1,
  tematy: ['historia', 'przyroda', 'architektura', 'kultura', 'legendy', 'ludzie', 'nauka', 'sport', 'jedzenie', 'geografia'],
  wiek: 'dorosli',
  jezyk: 'polski',
  wspolpraca: 'zespol',
  karaRecznaS: 60,
  podklad: 'osm',
  geokodacja: false,
  limitCzasuOdcinkaS: 0, // 0 = bez limitu
};

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
  return {
    ...DOMYSLNE,
    liczbaGraczy: n,
    promienM: TRYBY[DOMYSLNE.tryb].promienM,
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

/**
 * Proponowany `kod gry` (ADR 0007 pkt 2): 6 znaków z alfabetu bez znaków
 * mylonych wzrokowo (0/O, 1/l/I). RNG wstrzykiwany — testowalne.
 */
export function proponujKodGry(losuj = Math.random, dlugosc = 6) {
  const alfabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  return Array.from({ length: dlugosc }, () => alfabet[Math.floor(losuj() * alfabet.length)]).join('');
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
  const kanony = { tryb: TRYBY, wiek: WIEK, podklad: PODKLADY, wspolpraca: WSPOLPRACA, jezyk: JEZYKI };
  for (const [pole, kanon] of Object.entries(kanony)) {
    if (Object.hasOwn(kanon, zrodlo[pole])) konfig[pole] = zrodlo[pole];
  }

  // liczby: skończone i w widełkach (poza widełkami zostawiamy walidujSetup —
  // tu chodzi tylko o wartości, które rozsadziłyby renderowanie)
  const liczby = {
    liczbaGraczy: OGRANICZENIA.liczbaGraczy,
    liczbaStacji: OGRANICZENIA.liczbaStacji,
    pytaniaNaStacje: OGRANICZENIA.pytaniaNaStacje,
    promienM: OGRANICZENIA.promienM,
    karaRecznaS: OGRANICZENIA.karaRecznaS,
    limitCzasuOdcinkaS: { min: 0, max: 86400 },
  };
  for (const [pole, zakres] of Object.entries(liczby)) {
    const v = Number(zrodlo[pole]);
    if (!Number.isFinite(v)) continue;
    konfig[pole] = Math.min(Math.max(Math.round(v), zakres.min), zakres.max);
  }
  if (TRYBY[konfig.tryb] && konfig.promienM === domyslne.promienM && zrodlo.promienM === undefined) {
    konfig.promienM = TRYBY[konfig.tryb].promienM;
  }

  // listy i teksty
  konfig.tematy = Array.isArray(zrodlo.tematy) ? [...new Set(zrodlo.tematy.map(kanonicznyTemat))].filter((t) => Object.hasOwn(TEMATY, t)) : [];
  if (konfig.tematy.length === 0) konfig.tematy = [...domyslne.tematy];
  konfig.imiona = Array.isArray(zrodlo.imiona)
    ? zrodlo.imiona.slice(0, konfig.liczbaGraczy).map((imie, i) => (typeof imie === 'string' && imie.trim() ? imie.trim().slice(0, OGRANICZENIA.dlugoscImienia.max) : `Gracz ${i + 1}`))
    : [...domyslne.imiona];
  while (konfig.imiona.length < konfig.liczbaGraczy) konfig.imiona.push(`Gracz ${konfig.imiona.length + 1}`);
  konfig.geokodacja = zrodlo.geokodacja === true;
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
  if (!WSPOLPRACA[konfig.wspolpraca]) dodaj('K05', 'wspolpraca', `Nieznany tryb odpowiadania „${konfig.wspolpraca}".`);
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

  const { min: minK, max: maxK } = OGRANICZENIA.karaRecznaS;
  if (!Number.isFinite(konfig.karaRecznaS) || konfig.karaRecznaS < minK || konfig.karaRecznaS > maxK) {
    dodaj('K17', 'karaRecznaS', `Kara za ręczne zgłoszenie dojścia: 0–${maxK} sekund.`);
  }

  if (konfig.kodGry !== '' && konfig.kodGry != null) {
    const kod = String(konfig.kodGry).trim();
    const { min: minD, max: maxD } = OGRANICZENIA.dlugoscKoduGry;
    if (kod.length < minD || kod.length > maxD) {
      dodaj('K18', 'kodGry', `Kod gry musi mieć od ${minD} do ${maxD} znaków (albo zostaw puste; pytań nie chroni kod, tylko ukrycie paczki).`);
    }
  }

  if (!Number.isFinite(konfig.limitCzasuOdcinkaS) || konfig.limitCzasuOdcinkaS < 0) {
    dodaj('K19', 'limitCzasuOdcinkaS', 'Limit czasu odcinka musi być liczbą sekund ≥ 0 (0 = bez limitu).');
  }
  if (typeof konfig.geokodacja !== 'boolean') {
    dodaj('K20', 'geokodacja', 'Pobieranie nazwy miejsca musi być włączone albo wyłączone.');
  }

  return u;
}
