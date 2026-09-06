/**
 * app.js — bootstrap: ekrany, stan sesji, spinanie modułów.
 *
 * Zakres: setup → pozycja → stacje (tryb uproszczony) → prompt → wklejenie
 * i walidacja paczki (M0), model rozgrywki i warstwa pozycji jako czyste
 * funkcje (M1) oraz mapa SVG z kafelkami, gestami i warstwami własnymi (M2).
 * Overpass (M4), ekran gry (M6) i publikacja (M8) dochodzą w kolejnych
 * kamieniach — patrz `docs/ROADMAP.md`.
 *
 * Warstwa DOM jest celowo cienka (ARCHITECTURE §podział): logika mieszka
 * w `konfig.js`, `geo.js`, `protokol.js`, `stacje.js`, `pozycja.js` i jest
 * testowana w Node. Geolokalizacja idzie wyłącznie przez osłonę
 * `watchPozycja()` z `pozycja.js` — jeden watcher na rozgrywkę, reguły
 * dokładności i komunikaty błędów tam, gdzie da się je przetestować
 * (ADR 0004 pkt 1, 4, 7).
 */

import { DOMYSLNE, JEZYKI, OGRANICZENIA, PODKLADY, TEMATY, TRYBY, WIEK, WSPOLPRACA, domyslnaKonfiguracja, liczbaPytan, oczyscKonfiguracje, proponujKodGry, rngZZiarna, walidujSetup, ziarnoRozgrywki } from './konfig.js?v=m5-1';
import { dopasujZoomDoPromienia, formatujWspolrzedne, geohash, przesunPunkt } from './geo.js?v=m5-1';
import {
  parsujOdpowiedzModela,
  podsumowaniePaczki,
  poprawkaDlaModelu,
  walidujPaczke,
  zastosujEdycjePaczki,
  zbudujPrompt,
  WERSJA_PROTOKOLU,
} from './protokol.js?v=m5-1';
import { SCHEMAT_KONTENERA, odpakujPaczke, zapakujPaczke } from './kodowanie.js?v=m5-1';
import { ZRODLA_STACJI, miaraSprawiedliwosci, najmniejszyOdstepM, stacjeProste, uzupelnijOdleglosci, wybierzStacje } from './stacje.js?v=m5-1';
import { GRANICE, ZRODLA_FIXA, dodajFix, komunikatPauzy, komunikatWznowienia, ocenFix, fixZPozycji, sekwencjaSymulowana, stanDojscia, trasaProsta, watchPozycja } from './pozycja.js?v=m5-1';
import {
  DOMYSLNY_ENDPOINT_GEOKODACJI,
  INSTANCJE_OVERPASS,
  KODY_SIECI,
  POLITYKA,
  SCHEMAT_SIECI,
  budujGraf,
  budujUrlGeokodacji,
  budujZapytanieOverpass,
  czyPrzelaczycInstancje,
  kandydaciNaStacje,
  kluczCacheSieci,
  miejsceZOdpowiedziNominatim,
  nazwaMiejsca,
  parsujOdpowiedz,
  przycijCacheSieci,
  upraszczajDaneDoCache,
  wczytajDaneZCache,
} from './sieci.js?v=m5-1';
import { utworzMape } from './mapa.js?v=m5-1';

const KLUCZ_KONFIG = 'okolica:konfig';
const KLUCZ_MOTYW = 'okolica:motyw';

const STAN = {
  konfig: domyslnaKonfiguracja(),
  pozycja: null,
  dokladnoscM: null,
  ostatniFix: null,
  ocenaFixa: null,
  pauzaWTle: false,
  miejsce: '',
  stacje: [],
  obrot: 0,
  ziarnoOffset: 0,
  prompt: null,
  paczka: null,
  usterkiPaczki: [],
  trybTestowy: false,
  /** Sterowanie watchera z `watchPozycja()`: `{ zamknij, czyAktywny }`. */
  watcher: null,
  /** Mapy z `mapa.js` (M2): `null`, gdy panelu nie ma w `index.html`. */
  mapy: { pozycja: null, stacje: null },
  /** Który ekran gry jest pokazany (do powrotu z ekranu prywatności). */
  ekran: 'setup',
  /** Odtwarzana symulacja trasy (tryb testowy): `{fixy, indeks, cel, timer}`. */
  symulacja: null,
  /** Historia fixów (limit z `pozycja.js`) — wspólna dla GPS i symulacji. */
  historiaFixow: [],
  /** Stan sieci drogowej (M4): 'brak' → 'gotowa' po pobraniu albo cache. */
  siec: { stan: 'brak', dane: null, klucz: null, trybGrafu: null, graf: null, kandydaci: null, zCache: false },
  /** Wynik `wybierzStacje` (macierz, sprawiedliwość sieciowa) albo null przy pierścieniu. */
  wynikSieci: null,
  /** Wymuszony tryb uproszczony (przycisk „Tryb uproszczony", ADR 0005 pkt 8). */
  wymusPierscien: false,
  /** Tryb ręczny (ADR 0005 pkt 8b): organizator przeciąga pinezki stacji. */
  trybReczny: false,
  /** Skąd nazwa miejsca: 'overpass' | 'nominatim' (atrybucja ODbL) | null. */
  zrodloMiejsca: null,
  /** Jedna próba warstwy zapasowej na sesję (ASSETS §3: brak zapytań systematycznych). */
  miejsceProbowane: false,
  /** Odstęp między instancjami Overpass; `?odstep=0` skraca go w testach. */
  odstepOverpassMs: POLITYKA.odstepMs,
  /** Dwustopniowe kasowanie danych: pierwszy klik uzbraja, drugi kasuje. */
  czyszczenieUzbrojone: false,
  /** Czy widok był już centrowany na pierwszym fixie — potem rządzi palec. */
  wycentrowane: false,
};

function $(id) {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Brak elementu #${id} w index.html`);
  return e;
}

const EKRANY = ['setup', 'pozycja', 'stacje', 'prompt', 'paczka'];

function pokazEkran(nazwa) {
  STAN.ekran = nazwa;
  for (const e of EKRANY) {
    $(`ekran-${e}`).hidden = e !== nazwa;
    const krok = document.querySelector(`#kroki li[data-krok="${e}"]`);
    if (krok) {
      krok.classList.toggle('aktywny', e === nazwa);
      krok.classList.toggle('zrobione', EKRANY.indexOf(e) < EKRANY.indexOf(nazwa));
    }
  }
  odswiezMapeEkranu(nazwa);
  window.scrollTo({ top: 0 });
}

/**
 * Ekran „dane i prywatność" (ADR 0013 pkt 7) nie jest krokiem gry: chowa
 * wszystkie ekrany z paska kroków i pokazuje siebie, a powrót prowadzi na
 * ekran zapamiętany w `STAN.ekran`.
 */
function pokazPrywatnosc() {
  for (const e of EKRANY) $(`ekran-${e}`).hidden = true;
  $('ekran-prywatnosc').hidden = false;
  $('geokodacja-zapasowa').checked = localStorage.getItem('okolica:geokodacja-zapasowa') === '1';
  window.scrollTo({ top: 0 });
}

function wrocZPrywatnosci() {
  $('ekran-prywatnosc').hidden = true;
  pokazEkran(EKRANY.includes(STAN.ekran) ? STAN.ekran : 'setup');
}

/**
 * Kasuje klucze `okolica:*` z przeglądarki — dwustopniowo, bo na telefonie
 * przypadkowe „OK" w `confirm()` klika się bez czytania. Komunikat idzie do
 * pola z `role="status"`, nie do `alert()` (ADR 0015 pkt 6).
 */
function czyscDaneWitryny() {
  const pole = $('czysc-dane-status');
  if (!STAN.czyszczenieUzbrojone) {
    STAN.czyszczenieUzbrojone = true;
    pole.textContent = 'Kliknij ponownie, żeby usunąć ustawienia gry i motyw z tej przeglądarki.';
    return;
  }
  const usuniete = [];
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const klucz = localStorage.key(i);
    if (klucz && klucz.startsWith('okolica:')) {
      localStorage.removeItem(klucz);
      usuniete.push(klucz);
    }
  }
  STAN.czyszczenieUzbrojone = false;
  pole.textContent = usuniete.length
    ? `Usunięto zapisane dane (${usuniete.length}): ${usuniete.join(
)}.`
    : 'Nie znaleziono zapisanych danych tej gry.';
}

function status(tekst) {
  $('status').textContent = tekst;
}

function pokazBledy(idPola, usterki) {
  const pole = $(idPola);
  if (!usterki || usterki.length === 0) {
    pole.hidden = true;
    pole.textContent = '';
    return;
  }
  pole.hidden = false;
  pole.textContent = usterki.map((u) => `${u.kod ? `[${u.kod}] ` : ''}${u.pole ? `${u.pole}: ` : ''}${u.komunikat}`).join(' ');
}

/* ------------------------------------------------------------------ setup */

function renderujTryby() {
  const lista = $('lista-trybow');
  lista.innerHTML = '';
  for (const [klucz, tryb] of Object.entries(TRYBY)) {
    const etykieta = document.createElement('label');
    etykieta.innerHTML = `<input type="radio" name="tryb" value="${klucz}"><strong>${tryb.ikona} ${tryb.etykieta}</strong><span>${tryb.promienM / 1000} km</span>`;
    lista.appendChild(etykieta);
  }
  const zaznaczonyTryb = lista.querySelector(`input[value="${STAN.konfig.tryb}"]`) ?? lista.querySelector('input');
  if (zaznaczonyTryb) {
    zaznaczonyTryb.checked = true;
    STAN.konfig.tryb = zaznaczonyTryb.value;
  }
  lista.addEventListener('change', () => {
    const wybrany = lista.querySelector('input:checked')?.value;
    if (!wybrany || !TRYBY[wybrany]) return;
    STAN.konfig.tryb = wybrany;
    STAN.konfig.promienM = TRYBY[wybrany].promienM;
    $('setup-promien').value = STAN.konfig.promienM;
    aktualizujOpisTrybu();
  });
  aktualizujOpisTrybu();
}

function aktualizujOpisTrybu() {
  const tryb = TRYBY[STAN.konfig.tryb];
  $('opis-trybu').textContent = `${tryb.opis}. Zoom docelowy mapy ≈ ${tryb.zoom}${tryb.wymagaParkingu ? ' · stacje przy parkingu albo obiekcie z dojazdem' : ''}.`;
}

function renderujSegment(nazwaPola, dane, wybranyKlucz, onChange) {
  const lista = $(nazwaPola);
  lista.innerHTML = '';
  for (const [klucz, pozycja] of Object.entries(dane)) {
    const etykieta = document.createElement('label');
    etykieta.innerHTML = `<input type="radio" name="${nazwaPola}" value="${klucz}"><strong>${pozycja.etykieta}</strong>`;
    lista.appendChild(etykieta);
  }
  const zaznaczony = lista.querySelector(`input[value="${wybranyKlucz}"]`);
  if (zaznaczony) zaznaczony.checked = true;
  lista.addEventListener('change', () => {
    const wybrany = lista.querySelector('input:checked')?.value;
    if (wybrany) onChange(wybrany);
  });
}

function renderujTematy() {
  const lista = $('lista-tematow');
  lista.innerHTML = '';
  for (const [klucz, temat] of Object.entries(TEMATY)) {
    const etykieta = document.createElement('label');
    etykieta.innerHTML = `<input type="checkbox" value="${klucz}" title="${temat.opis}"><span>${temat.etykieta}</span>`;
    lista.appendChild(etykieta);
  }
  for (const klucz of STAN.konfig.tematy) {
    const box = lista.querySelector(`input[value="${klucz}"]`);
    if (box) box.checked = true;
  }
  lista.addEventListener('change', () => {
    STAN.konfig.tematy = [...lista.querySelectorAll('input:checked')].map((i) => i.value);
  });
}

function renderujSelecty() {
  const wypelnij = (idPola, dane, wybrany) => {
    const select = $(idPola);
    select.innerHTML = '';
    for (const [klucz, pozycja] of Object.entries(dane)) {
      const option = document.createElement('option');
      option.value = klucz;
      option.textContent = typeof pozycja === 'string' ? pozycja : pozycja.etykieta;
      select.appendChild(option);
    }
    select.value = wybrany;
  };
  wypelnij('setup-wspolpraca', WSPOLPRACA, STAN.konfig.wspolpraca);
  wypelnij('setup-jezyk', JEZYKI, STAN.konfig.jezyk);
  wypelnij('setup-podklad', PODKLADY, STAN.konfig.podklad);
  $('setup-wspolpraca').addEventListener('change', (e) => { STAN.konfig.wspolpraca = e.target.value; });
  $('setup-jezyk').addEventListener('change', (e) => { STAN.konfig.jezyk = e.target.value; });
  $('setup-podklad').addEventListener('change', (e) => { zmienPodklad(e.target.value); });
}

function renderujImiona() {
  const lista = $('lista-imion');
  lista.innerHTML = '';
  STAN.konfig.imiona.forEach((imie, i) => {
    const pole = document.createElement('input');
    pole.type = 'text';
    pole.value = imie;
    pole.maxLength = OGRANICZENIA.dlugoscImienia.max;
    pole.setAttribute('aria-label', `Imię gracza ${i + 1}`);
    pole.addEventListener('input', () => { STAN.konfig.imiona[i] = pole.value; });
    lista.appendChild(pole);
  });
}

function renderujSetup() {
  const k = STAN.konfig;
  $('setup-promien').value = k.promienM;
  $('setup-stacje').value = k.liczbaStacji;
  $('setup-pytania').value = k.pytaniaNaStacje;
  $('setup-gracze').value = k.liczbaGraczy;
  $('setup-kara').value = k.karaRecznaS;
  $('setup-kod').value = k.kodGry ?? '';
  $('setup-geokodacja').checked = !!k.geokodacja;
  $('setup-promien').min = OGRANICZENIA.promienM.min;
  $('setup-promien').max = OGRANICZENIA.promienM.max;

  const czytajLiczbe = (idPola, pole) => $(idPola).addEventListener('input', (e) => {
    const v = Number(e.target.value);
    STAN.konfig[pole] = Number.isFinite(v) ? v : null;
    if (pole === 'liczbaGraczy') {
      STAN.konfig = { ...STAN.konfig, imiona: dostosujImiona(Number.isFinite(v) ? v : 1) };
      renderujImiona();
    }
  });
  czytajLiczbe('setup-promien', 'promienM');
  czytajLiczbe('setup-stacje', 'liczbaStacji');
  czytajLiczbe('setup-pytania', 'pytaniaNaStacje');
  czytajLiczbe('setup-gracze', 'liczbaGraczy');
  czytajLiczbe('setup-kara', 'karaRecznaS');

  $('setup-kod').addEventListener('input', (e) => { STAN.konfig.kodGry = e.target.value.trim(); });
  $('setup-geokodacja').addEventListener('change', (e) => {
    STAN.konfig.geokodacja = e.target.checked;
    renderujMiejsce(); // przełączenie widać od razu (ADR 0013 pkt 3)
  });
  $('geokodacja-zapasowa').addEventListener('change', (e) => {
    localStorage.setItem('okolica:geokodacja-zapasowa', e.target.checked ? '1' : '0');
    status(e.target.checked
      ? 'Warstwa zapasowa nazwy miejsca (Nominatim) włączona — jedno żądanie, tylko gdy Overpass nie da nazwy. © OpenStreetMap (ODbL).'
      : 'Warstwa zapasowa nazwy miejsca (Nominatim) wyłączona — tak jest domyślnie.');
  });
  $('przycisk-kod').addEventListener('click', () => {
    STAN.konfig.kodGry = proponujKodGry(rngZZiarna(`kod:${Date.now()}`));
    $('setup-kod').value = STAN.konfig.kodGry;
    status('Zaproponowano kod gry — identyfikator rozgrywki do eksportu i udostępniania paczki (ADR 0007: pytania ukrywa obfuskacja, nie ten kod).');
  });
}

function dostosujImiona(n) {
  const ile = Math.max(1, Math.min(OGRANICZENIA.liczbaGraczy.max, Number.isFinite(n) ? n : 1));
  const obecne = Array.isArray(STAN.konfig.imiona) ? STAN.konfig.imiona : [];
  return Array.from({ length: ile }, (_, i) => obecne[i] ?? `Gracz ${i + 1}`);
}

function czytajSetupZDomu() {
  const k = STAN.konfig;
  k.imiona = [...document.querySelectorAll('#lista-imion input')].map((i) => i.value);
  return k;
}

/* --------------------------------------------------------------- pozycja */

function pokazPozycje() {
  const p = STAN.pozycja;
  if (!p) {
    $('pozycja-status').textContent = STAN.trybTestowy ? 'Tryb testowy: wpisz współrzędne.' : 'Czekam na pozycję…';
    $('pozycja-dokladnosc').textContent = 'dokładność: —';
    $('pozycja-wspolrzedne').textContent = '';
    $('przycisk-dalej-stacje').disabled = true;
    odswiezWarstwy();
    return;
  }
  $('pozycja-status').textContent = STAN.ostatniFix?.zrodlo === ZRODLA_FIXA.reczne ? 'Pozycja ustawiona ręcznie' : 'Pozycja ustalona';
  $('pozycja-dokladnosc').textContent = STAN.dokladnoscM ? `dokładność: ±${Math.round(STAN.dokladnoscM)} m` : 'dokładność: nieznana (wpisana ręcznie)';
  $('pozycja-wspolrzedne').textContent = `${formatujWspolrzedne(p.lat, p.lon)} · geohash ${geohash(p.lat, p.lon, 6)}`;
  renderujMiejsce();
  $('przycisk-dalej-stacje').disabled = false;
  // Jawność niedokładności (ADR 0004 pkt 4): komunikat i próg liczy `ocenFix`,
  // tu tylko pokazujemy, co powiedział.
  if (STAN.ocenaFixa?.kod) status(STAN.ocenaFixa.komunikat);

  odswiezWarstwy();
  // pierwszy fix ustawia widok; potem mapę prowadzi palec gracza (ADR 0011)
  if (!STAN.wycentrowane) {
    STAN.wycentrowane = true;
    centrujNaPozycji();
  }
}

/** Zamyka watcher, jeśli działa (ADR 0004 pkt 1: jeden watcher na rozgrywkę). */
function zatrzymajGps() {
  if (STAN.watcher) {
    STAN.watcher.zamknij();
    STAN.watcher = null;
  }
}

/**
 * Włącza śledzenie położenia przez osłonę z `pozycja.js`. Cała logika
 * (opcje watchera, filtr dokładności, komunikaty błędów, brak API) jest tam —
 * tu tylko przypisanie stanu i odświeżenie ekranu.
 */
function wlaczGps() {
  zatrzymajGps();
  $('pozycja-status').textContent = 'Szukam satelitów…';
  status('GPS włączony — pierwszy fix potrafi trwać kilkanaście sekund.');
  STAN.watcher = watchPozycja({
    geolocation: navigator.geolocation,
    zegar: () => performance.now(),
    onFix: (fix) => przyjmijFix(fix),
    onBlad: (blad) => {
      pokazBledy('bledy-pozycja', [{ kod: blad.kod, pole: 'geolocation', komunikat: blad.komunikat }]);
      $('pozycja-status').textContent = 'Brak pozycji';
      status('Położenie niedostępne — dojście można zgłaszać ręcznie (ADR 0004 pkt 5) albo grać w trybie testowym (pkt 6).');
    },
  });
  if (!STAN.watcher.czyAktywny()) $('pozycja-status').textContent = 'Brak pozycji';
}

/* ------------------------------------------------------------------ mapa */

/**
 * Zakłada mapy na ekranach „pozycja" i „stacje" (M2). Cała geometria, adresy
 * kafelków i gesty są w `mapa.js`; tu tylko wiązanie stanu aplikacji
 * z warstwami. Brak panelu w `index.html` nie wysypuje aplikacji —
 * `utworzMape` zwraca wtedy `null`.
 */
function utworzMapy() {
  const podklad = PODKLADY[STAN.konfig.podklad] ? STAN.konfig.podklad : DOMYSLNE.podklad;
  STAN.mapy.pozycja = utworzMape({ id: 'mapa-pozycja', podklad, zoom: 16 });
  STAN.mapy.stacje = utworzMape({ id: 'mapa-stacje', podklad, zoom: 16 });
}

function kazdaMapa(fn) {
  for (const mapa of Object.values(STAN.mapy)) if (mapa) fn(mapa);
}

/** Zoom, przy którym promień gry zajmuje ~40% szerokości panelu (`geo.js`). */
function zoomDlaPromienia(mapa, lat) {
  const szerokosc = Math.max(mapa.rozmiar().szerokosc, 240);
  const promienM = STAN.konfig.promienM;
  // Puste albo ręcznie zepsute pole promienia nie może wysypać widoku:
  // wracamy do zoomu z kanonu trybu (LESSONS L10 — widełki nie chronią przed NaN,
  // a `dopasujZoomDoPromienia` odmawia przy niedodatnim promieniu).
  if (!(promienM > 0) || !Number.isFinite(lat)) return TRYBY[STAN.konfig.tryb]?.zoom ?? 16;
  return dopasujZoomDoPromienia(promienM, szerokosc, lat);
}

/**
 * Przenosi stan aplikacji na warstwy map: marker pozycji z kołem dokładności,
 * okrąg promienia gry i numerowane pinezki stacji. Wołane po każdym fixie,
 * po przeliczeniu stacji i po zmianie ustawień, które widać na mapie.
 */
function odswiezWarstwy() {
  const p = STAN.pozycja;
  const fix = p ? { lat: p.lat, lon: p.lon, accuracy: STAN.dokladnoscM ?? undefined } : null;
  kazdaMapa((mapa) => mapa.pokazPozycje(fix));
  if (STAN.mapy.pozycja) STAN.mapy.pozycja.zaznaczStacje([], { promienM: STAN.konfig.promienM });
  if (STAN.mapy.stacje) {
    STAN.mapy.stacje.zaznaczStacje(STAN.stacje, { promienM: STAN.konfig.promienM, aktywna: null });
  }
}

/** Wyśrodkowuje mapy na pozycji gracza w zoomie dobranym do promienia gry. */
function centrujNaPozycji() {
  const p = STAN.pozycja;
  if (!p) return;
  kazdaMapa((mapa) => mapa.ustawSrodek({ lat: p.lat, lon: p.lon, zoom: zoomDlaPromienia(mapa, p.lat) }));
}

/** Podkład wybiera się w setupie; zmiana dotyczy wszystkich map (ADR 0003). */
function zmienPodklad(klucz) {
  if (!PODKLADY[klucz]) return;
  STAN.konfig.podklad = klucz;
  kazdaMapa((mapa) => mapa.ustawPodklad(klucz));
}

/**
 * Panel schowany (`hidden`) ma rozmiar 0, więc nie ma czego rysować —
 * po pokazaniu ekranu widok trzeba przeliczyć od nowa.
 */
function odswiezMapeEkranu(nazwa) {
  const mapa = STAN.mapy[nazwa];
  if (mapa) mapa.odswiez();
}

/**
 * Jedyny lej fixów do stanu: watcher GPS i symulacja trasy karmią aplikację
 * tym samym kodem, więc badge dokładności, mapa i próg dojścia zachowują się
 * identycznie z GPS-em i bez niego (kryterium M3: gra bez GPS).
 */
function przyjmijFix(fix) {
  const ocena = ocenFix(fix);
  STAN.ostatniFix = fix;
  STAN.ocenaFixa = ocena;
  STAN.pozycja = { lat: fix.lat, lon: fix.lon };
  STAN.dokladnoscM = fix.accuracy;
  STAN.historiaFixow = dodajFix(STAN.historiaFixow, fix);
  pokazBledy('bledy-pozycja', ocena.kod ? [{ kod: ocena.kod, pole: 'geolocation', komunikat: ocena.komunikat }] : []);
  pokazPozycje();
}

/* --------------------------------------------------- symulacja dojścia */

/** Odtwarzanie: jeden fix co tyle ms (tylko tryb testowy, ADR 0004 pkt 6). */
const SYMULACJA_KROK_MS = 120;
/** Próba dojścia: 250 m na azymucie 45°, 12 s „marszu", fix co 2 s + postój. */
const SYMULACJA = { dystansM: 250, bearing: 45, czasMs: 12000, coMs: 2000, accuracyM: 12 };

/** Jeden fix symulacji: stan, mapa i zdanie o dystansie do celu. */
function krokSymulacji() {
  const s = STAN.symulacja;
  if (!s) return;
  const fix = s.fixy[s.indeks];
  if (!fix) {
    zatrzymajSymulacje();
    status('Symulacja zakończona.');
    return;
  }
  s.indeks += 1;
  przyjmijFix(fix);
  const stan = stanDojscia(STAN.historiaFixow, s.cel);
  status(stan.dotarl
    ? `Symulacja: cel osiągnięty — debounce dojścia spełniony (fix ${s.indeks}/${s.fixy.length}).`
    : `Symulacja: fix ${s.indeks}/${s.fixy.length}, do celu ${stan.dystansM} m (próg ${stan.progM} m, trafienia ${stan.trafienia}/${stan.wymagane}).`);
  if (s.indeks >= s.fixy.length) zatrzymajSymulacje();
}

function zatrzymajSymulacje() {
  if (!STAN.symulacja) return;
  clearInterval(STAN.symulacja.timer);
  STAN.symulacja = null;
  $('przycisk-symulacja').setAttribute('aria-pressed', 'false');
}

/** Start/stop odtwarzania trasy z bieżącej pozycji do punktu 250 m dalej. */
function przelaczSymulacje() {
  if (STAN.symulacja) {
    zatrzymajSymulacje();
    status('Symulacja zatrzymana — pozycja zostaje tam, gdzie doszła.');
    return;
  }
  if (!STAN.pozycja) {
    status('Symulacja potrzebuje punktu startu: wpisz współrzędne albo włącz GPS.');
    return;
  }
  const start = { lat: STAN.pozycja.lat, lon: STAN.pozycja.lon };
  const cel = przesunPunkt(start, SYMULACJA.bearing, SYMULACJA.dystansM);
  const trasa = trasaProsta({
    start,
    cel,
    czasMs: SYMULACJA.czasMs,
    accuracyM: SYMULACJA.accuracyM,
    przystanki: 2,
  });
  const fixy = sekwencjaSymulowana(trasa, { coMs: SYMULACJA.coMs, postoj: GRANICE.wymaganeTrafnienia });
  STAN.symulacja = { fixy, indeks: 0, cel, timer: setInterval(krokSymulacji, SYMULACJA_KROK_MS) };
  $('przycisk-symulacja').setAttribute('aria-pressed', 'true');
  status(`Symulacja trasy: ${fixy.length} fixów do punktu ${formatujWspolrzedne(cel.lat, cel.lon)} (${SYMULACJA.dystansM} m, azymut ${SYMULACJA.bearing}°).`);
}

/* ---------------------------------------------------------------- stacje */

function ziarno() {
  const data = new Date().toISOString().slice(0, 10);
  return `${ziarnoRozgrywki({ lat: STAN.pozycja.lat, lon: STAN.pozycja.lon, promienM: STAN.konfig.promienM, liczbaStacji: STAN.konfig.liczbaStacji, data })}|${STAN.ziarnoOffset}`;
}

/* --- sieć drogowa (M4): cache, pobieranie z łańcuchem instancji, wybór --- */

/** Klucz cache sieci dla bieżącej pozycji i promienia (ADR 0010 pkt 1). */
function kluczSieci() {
  return kluczCacheSieci({ lat: STAN.pozycja.lat, lon: STAN.pozycja.lon, promienM: STAN.konfig.promienM });
}

function odczytajCacheSieci(klucz, terazMs) {
  try {
    const surowy = localStorage.getItem(klucz);
    if (!surowy) return null;
    return wczytajDaneZCache(JSON.parse(surowy), { terazMs });
  } catch {
    return null; // zepsuty wpis = brak wpisu; naprawi go następne pobranie
  }
}

function zapiszCacheSieci(klucz, dane, terazMs) {
  try {
    localStorage.setItem(klucz, JSON.stringify({ schemat: SCHEMAT_SIECI, zapisanoMs: terazMs, dane }));
    // LRU: ponad 2 MB cache sieci → najstarsze wpisy wypadają (ADR 0010 pkt 1)
    const wpisy = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('okolica:sieci:')) continue;
      const surowy = localStorage.getItem(k) ?? '';
      let zapisanoMs = 0;
      try { zapisanoMs = JSON.parse(surowy)?.zapisanoMs ?? 0; } catch { /* liczy się rozmiar */ }
      wpisy.push({ klucz: k, rozmiarBajtow: surowy.length, zapisanoMs });
    }
    for (const k of przycijCacheSieci(wpisy)) localStorage.removeItem(k);
  } catch {
    status(KODY_SIECI.S04); // brak miejsca — gramy dalej, następna gra pobierze sieć
  }
}

function ustawSiec(dane, { zCache, klucz }) {
  STAN.siec = { stan: 'gotowa', dane, klucz, trybGrafu: null, graf: null, kandydaci: null, zCache };
  const miejsce = nazwaMiejsca(dane);
  if (miejsce) {
    STAN.miejsce = miejsce;
    STAN.zrodloMiejsca = 'overpass';
    renderujMiejsce();
  }
}

/**
 * Wyświetlenie nazwy miejsca z bramą `konfig.geokodacja` (ADR 0013 pkt 3:
 * wyłączona w setupie = prompt i UI mają same współrzędne) oraz atrybucją
 * ODbL, gdy miejsce pochodzi z warstwy zapasowej Nominatim (ASSETS §3).
 */
function renderujMiejsce() {
  const pole = $('pozycja-miejsce');
  if (!STAN.konfig.geokodacja) {
    pole.textContent = 'nazwa miejsca: wyłączona w ustawieniach — prompt ma same współrzędne (ADR 0013 pkt 3)';
    return;
  }
  if (!STAN.miejsce) {
    pole.textContent = 'nazwa miejsca: brak — pobierana z siecią dróg na ekranie stacji';
    return;
  }
  const atrybucja = STAN.zrodloMiejsca === 'nominatim' ? ' · © OpenStreetMap contributors (ODbL)' : '';
  pole.textContent = `miejsce: ${STAN.miejsce}${atrybucja}`;
}

/** Klucz cache nazwy miejsca (polityka Nominatim: „obowiązkowy cache", ASSETS §3). */
function kluczMiejscaCache() {
  return `okolica:miejsce:${geohash(STAN.pozycja.lat, STAN.pozycja.lon, 6)}`;
}

function ustawMiejsce(miejsce, zrodlo) {
  STAN.miejsce = miejsce;
  STAN.zrodloMiejsca = zrodlo;
  renderujMiejsce();
}

/**
 * Zapasowa nazwa miejsca (ADR 0013 pkt 2, ASSETS §3): Nominatim, domyślnie
 * WYŁĄCZONY; jedno żądanie na sesję i tylko gdy Overpass nie dał miejsca,
 * a pobieranie nazwy jest włączone w setupie. Bez ponawiania przy błędzie —
 * polityka zakazuje zapytań systematycznych. Endpoint przełączalny kluczem
 * `okolica:geokodacja-endpoint` (wymóg OSMF „bez aktualizacji oprogramowania").
 */
async function uzupelnijMiejsceZapasowe() {
  if (!STAN.pozycja || STAN.miejsce || !STAN.konfig.geokodacja) return;
  if (STAN.miejsceProbowane) return;
  STAN.miejsceProbowane = true;
  if (localStorage.getItem('okolica:geokodacja-zapasowa') !== '1') return;

  const dzien = 86_400_000;
  const klucz = kluczMiejscaCache();
  try {
    const wpis = JSON.parse(localStorage.getItem(klucz) ?? 'null');
    const swiezy = wpis?.schemat === 'miejsce/1' && typeof wpis.miejsce === 'string' && wpis.miejsce
      && Number.isFinite(wpis.zapisanoMs) && Date.now() - wpis.zapisanoMs <= 30 * dzien;
    if (swiezy) {
      ustawMiejsce(wpis.miejsce, 'nominatim'); // z cache — atrybucja ODbL zostaje
      return;
    }
  } catch {
    /* zepsuty wpis = brak wpisu */
  }

  const f = typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  if (!f) return; // offline/atrapy: warstwa zapasowa po prostu milczy
  const endpoint = localStorage.getItem('okolica:geokodacja-endpoint') || DOMYSLNY_ENDPOINT_GEOKODACJI;
  let url;
  try {
    url = budujUrlGeokodacji({ lat: STAN.pozycja.lat, lon: STAN.pozycja.lon, endpoint });
  } catch {
    return;
  }
  try {
    const kontroler = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = kontroler ? setTimeout(() => kontroler.abort(), POLITYKA.timeoutMs) : null;
    const odpowiedz = await f(url, { signal: kontroler ? kontroler.signal : undefined });
    if (timer) clearTimeout(timer);
    if (!odpowiedz.ok) {
      status(`Zapasowa nazwa miejsca niedostępna (Nominatim: HTTP ${odpowiedz.status}) — prompt będzie miał same współrzędne.`);
      return;
    }
    const miejsce = miejsceZOdpowiedziNominatim(await odpowiedz.json());
    if (!miejsce) {
      status('Nominatim nie zwrócił dzielnicy ani miasta — prompt będzie miał same współrzędne.');
      return;
    }
    ustawMiejsce(miejsce, 'nominatim');
    try {
      localStorage.setItem(klucz, JSON.stringify({ schemat: 'miejsce/1', zapisanoMs: Date.now(), miejsce }));
    } catch {
      /* brak miejsca na cache — nazwa i tak jest w sesji */
    }
    status(`Nazwa miejsca z warstwy zapasowej: ${miejsce} · © OpenStreetMap contributors (ODbL).`);
  } catch {
    status('Zapasowa geokodacja nie odpowiedziała — bez ponawiania (polityka OSMF, ASSETS §3). Prompt będzie miał same współrzędne.');
  }
}

/** Graf i kandydaci dla bieżącego trybu — przebudowa tylko przy zmianie trybu. */
function grafDlaTrybu(tryb) {
  const siec = STAN.siec;
  if (siec.stan !== 'gotowa') return false;
  if (siec.trybGrafu === tryb && siec.graf) return true;
  try {
    siec.graf = budujGraf(siec.dane, { tryb });
    siec.kandydaci = kandydaciNaStacje(siec.dane, siec.graf, { tryb }).kandydaci;
    siec.trybGrafu = tryb;
    return true;
  } catch (blad) {
    pokazBledy('bledy-stacje', [{
      kod: blad?.kod ?? 'S09',
      pole: 'siec',
      komunikat: blad?.komunikat ?? KODY_SIECI[blad?.kod] ?? 'Sieć drogowa nie nadaje się dla tego trybu.',
    }]);
    return false;
  }
}

/**
 * Pobranie sieci z łańcucha instancji (ASSETS §2): sekwencyjnie, z pauzą
 * `odstepMs` po 406/429/5xx, timeoutem 20 s przez `AbortController` i
 * budżetem 8 MB na cache. `fetch` jest czytany w chwili wywołania, więc test
 * może podstawić atrapę po imporcie aplikacji.
 */
async function pobierzSiec(terazMs) {
  // Celowo `window.fetch`, nie gołe `fetch`: Node ≥ 18 MA globalny fetch i
  // testy na atrapie DOM próbowałyby wołać prawdziwy Overpass. Atrapa nie
  // wystawia `window.fetch`, test podstawia atrapę jawnie (LESSONS L18).
  const f = typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  if (!f) return false; // środowisko bez fetch (atrapy/offline) — degradacja
  const zapytanie = budujZapytanieOverpass({
    srodek: STAN.pozycja,
    promienM: STAN.konfig.promienM,
    tryb: STAN.konfig.tryb,
  });
  const pauza = (ms) => new Promise((rozwiaz) => setTimeout(rozwiaz, ms));
  for (let i = 0; i < INSTANCJE_OVERPASS.length; i++) {
    const instancja = INSTANCJE_OVERPASS[i];
    const ostatnia = i === INSTANCJE_OVERPASS.length - 1;
    status(`Pobieram sieć dróg: ${instancja.nazwa}… (jedno zapytanie na grę)`);
    try {
      const kontroler = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = kontroler ? setTimeout(() => kontroler.abort(), POLITYKA.timeoutMs) : null;
      const odpowiedz = await f(instancja.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(zapytanie)}`,
        signal: kontroler ? kontroler.signal : undefined,
      });
      if (timer) clearTimeout(timer);
      if (!odpowiedz.ok) {
        if (!ostatnia && czyPrzelaczycInstancje({ status: odpowiedz.status })) {
          status(`${instancja.nazwa}: HTTP ${odpowiedz.status} — limit publiczny, czekam ${Math.round(STAN.odstepOverpassMs / 1000)} s i próbuję kolejną instancję.`);
          await pauza(STAN.odstepOverpassMs);
          continue;
        }
        throw Object.assign(new Error(`HTTP ${odpowiedz.status}`), { status: odpowiedz.status });
      }
      const tekst = await odpowiedz.text();
      const sparsowane = parsujOdpowiedz(JSON.parse(tekst));
      const dane = upraszczajDaneDoCache(sparsowane);
      if (tekst.length <= 8_000_000) {
        zapiszCacheSieci(kluczSieci(), dane, terazMs);
      } else {
        status(KODY_SIECI.S04);
      }
      ustawSiec(dane, { zCache: false, klucz: kluczSieci() });
      return true;
    } catch (blad) {
      const przelacz = !ostatnia && czyPrzelaczycInstancje({
        status: blad?.status ?? null,
        timeout: blad?.name === 'AbortError',
        bladSieci: blad?.name === 'TypeError' || blad?.name === 'NetworkError',
      });
      if (przelacz) {
        status(`${instancja.nazwa} nie odpowiada — czekam ${Math.round(STAN.odstepOverpassMs / 1000)} s i próbuję kolejną instancję.`);
        await pauza(STAN.odstepOverpassMs);
        continue;
      }
      pokazBledy('bledy-stacje', [{
        kod: blad?.kod ?? 'S03',
        pole: 'siec',
        komunikat: blad?.komunikat ?? `Pobranie sieci dróg nie udało się (${blad?.message ?? instancja.nazwa}).`,
      }]);
      return false;
    }
  }
  pokazBledy('bledy-stacje', [{ kod: 'S03', pole: 'siec', komunikat: KODY_SIECI.S03 }]);
  return false;
}

/** Wspólny koniec każdej ścieżki: wybór stacji z tego, co jest, i render. */
function przeliczZTegoCoJest() {
  const uzyjSieci = !STAN.wymusPierscien && STAN.siec.stan === 'gotowa' && grafDlaTrybu(STAN.konfig.tryb);
  if (uzyjSieci) {
    try {
      const wynik = wybierzStacje({
        graf: STAN.siec.graf,
        kandydaci: STAN.siec.kandydaci,
        srodek: STAN.pozycja,
        konfig: STAN.konfig,
        ziarno: ziarno(),
      });
      STAN.stacje = wynik.stacje;
      STAN.wynikSieci = wynik;
      pokazBledy('bledy-stacje', []);
      renderujStacje();
      odswiezWarstwy();
      centrujNaPozycji();
      status(wynik.usterki.length
        ? `Sieć jest za uboga na ${STAN.konfig.liczbaStacji} stacji — wybrano ${wynik.stacje.length} (kod S12). Zmień okolicę albo promień, jeśli chcesz komplet.`
        : `Stacje z sieci drogowej: ${wynik.stacje.length} punktów osiągalnych, odchylenie dystansów ${Math.round(wynik.sprawiedliwosc.udzialOdchylenia * 100)}%.`);
      return;
    } catch (blad) {
      pokazBledy('bledy-stacje', [{
        kod: blad?.kod ?? 'S12',
        pole: 'siec',
        komunikat: blad?.komunikat ?? 'Nie udało się wybrać stacji z sieci drogowej.',
      }]);
    }
  }
  // degradacja (ADR 0005 pkt 8): pierścień z jawnym ostrzeżeniem
  STAN.stacje = stacjeProste({
    srodek: STAN.pozycja,
    liczbaStacji: STAN.konfig.liczbaStacji,
    promienM: STAN.konfig.promienM,
    ziarno: ziarno(),
    offsetObrotu: STAN.obrot,
  });
  STAN.wynikSieci = null;
  renderujStacje();
  odswiezWarstwy();
  centrujNaPozycji();
}

let trwaPobieranieSieci = false;

async function przeliczStacjeZPobraniem(klucz) {
  if (trwaPobieranieSieci) return;
  trwaPobieranieSieci = true;
  $('przycisk-przelicz').disabled = true;
  try {
    const ok = await pobierzSiec(Date.now());
    if (!ok && STAN.siec.stan !== 'gotowa') {
      status('Sieć drogowa niedostępna — stacje w trybie uproszczonym (pierścień): osiągalność niezweryfikowana. Sprawdź połączenie albo ustaw stacje ręcznie.');
    }
    przeliczZTegoCoJest();
    uzupelnijMiejsceZapasowe();
  } finally {
    trwaPobieranieSieci = false;
    $('przycisk-przelicz').disabled = false;
  }
}

/**
 * Wejście na ekran stacji i „Inny układ": najpierw cache (druga gra w tej
 * samej okolicy nie woła Overpass wcale), potem — tylko gdy jest `fetch`
 * i sieć jest potrzebna — pobranie asynchroniczne. Bez `fetch` (atrapy,
 * offline) wszystko zostaje SYNCHRONICZNE, więc testy i tryb testowy nie
 * czekają na sieć, która nie istnieje.
 */
function przeliczStacje() {
  pokazBledy('bledy-stacje', []); // błędy POPRZEDNIEJ próby gasną; nowa próba pokaże własne
  wylaczTrybReczny(); // nowy układ zastępuje ręcznie przesunięte pinezki
  const klucz = kluczSieci();
  if (STAN.siec.stan !== 'gotowa' || STAN.siec.klucz !== klucz) {
    const zCache = odczytajCacheSieci(klucz, Date.now());
    if (zCache) {
      ustawSiec(zCache, { zCache: true, klucz });
    } else if (typeof window !== 'undefined' && typeof window.fetch === 'function' && !STAN.wymusPierscien) {
      przeliczStacjeZPobraniem(klucz);
      return;
    }
  }
  przeliczZTegoCoJest();
  uzupelnijMiejsceZapasowe();
}

/**
 * Tryb ręczny (ADR 0005 pkt 8b): przeciąganie pinezek na mapie stacji.
 * Dystans liczemy TYLKO w linii prostej i mówimy o tym wprost (pkt 8c).
 */
function przestawStacjeRecznie(index, punkt) {
  const stara = STAN.stacje[index];
  if (!stara) return;
  const przeniesiona = { ...stara, lat: punkt.lat, lon: punkt.lon, zrodlo: 'reczne' };
  // pola sieciowe tracą sens po przesunięciu poza wyznaczoną ścieżkę
  delete przeniesiona.sciezkaPunkty;
  delete przeniesiona.dystansSieciowyM;
  delete przeniesiona.wezel;
  delete przeniesiona.typKandydata;
  STAN.stacje = uzupelnijOdleglosci(
    STAN.stacje.map((s, i) => (i === index ? przeniesiona : s)),
    STAN.pozycja,
  );
  STAN.wynikSieci = null; // układ nie jest już wynikiem wyboru z sieci
  renderujStacje();
  odswiezWarstwy();
}

function wylaczTrybReczny() {
  if (!STAN.trybReczny) return;
  STAN.trybReczny = false;
  $('przycisk-reczne').setAttribute('aria-pressed', 'false');
  if (STAN.mapy.stacje) STAN.mapy.stacje.ustawTrybReczny(false);
}

function renderujStacje() {
  const lista = $('lista-stacji');
  const sieciowe = Boolean(STAN.wynikSieci) && !STAN.wymusPierscien;
  // replaceChildren, nie innerHTML='': jedna operacja, bez migotania (i atrapa
  // DOM w testach odwzorowuje replaceChildren, a innerHTML jest tam inertne)
  lista.replaceChildren(...STAN.stacje.map((s) => {
    const li = document.createElement('li');
    const dystans = sieciowe ? `${s.dystansSieciowyM} m drogi` : `${s.odlegloscM} m`;
    const opis = s.zrodlo === 'reczne'
      ? 'ustawiona ręcznie (linia prosta — osiągalność niezweryfikowana)'
      : s.opis || (sieciowe ? 'punkt przy sieci dróg' : 'punkt w terenie (osiągalność niezweryfikowana)');
    li.innerHTML = `<span class="numer">${s.id}</span><span class="opis">${opis}<br><span class="kod">${formatujWspolrzedne(s.lat, s.lon)} · ${s.bearing}°</span></span><span class="dystans">${dystans}</span>`;
    return li;
  }));
  if (sieciowe) {
    const w = STAN.wynikSieci;
    $('stacje-sprawiedliwosc').textContent = `sieciowo: średnio ${w.sprawiedliwosc.sredniaM} m od startu · odchylenie ${w.sprawiedliwosc.odchylenieM} m (${Math.round(w.sprawiedliwosc.udzialOdchylenia * 100)}%) · pierścień ${w.pierscien.r} m (pasmo ${w.pierscien.pasmo[0]}–${w.pierscien.pasmo[1]} m) · najmniejszy odstęp ${najmniejszyOdstepM(STAN.stacje)} m`;
    const miejsce = STAN.konfig.geokodacja && STAN.miejsce ? ` · miejsce: ${STAN.miejsce}` : '';
    const cache = STAN.siec.zCache ? ' (z pamięci telefonu — Overpass nie został wywołany)' : '';
    $('stacje-tryb').textContent = `${ZRODLA_STACJI.siec}${cache}${miejsce}.`;
    $('przycisk-pierścien').hidden = false;
    $('przycisk-reczne').hidden = true;
  } else {
    const m = miaraSprawiedliwosci(STAN.stacje);
    $('stacje-sprawiedliwosc').textContent = `średnio ${m.sredniaM} m od startu · odchylenie ${m.odchylenieM} m (${Math.round(m.udzialOdchylenia * 100)}%) · najmniejszy odstęp między stacjami ${najmniejszyOdstepM(STAN.stacje)} m`;
    $('stacje-tryb').textContent = STAN.wymusPierscien
      ? `${ZRODLA_STACJI.pierscien} — wymuszony przyciskiem. ${STAN.siec.stan === 'gotowa' ? 'Sieć drogowa jest pobrana: wyłącz tryb uproszczony tym samym przyciskiem.' : 'Sieć drogowa niedostępna (offline albo limit Overpass).'}`
      : `${ZRODLA_STACJI.pierscien}. Stacje z sieci dróg, placów i szlaków (ADR 0005) pojawią się po pobraniu danych Overpass — wymaga połączenia z internetem.`;
    if (STAN.trybReczny) {
      $('stacje-tryb').textContent += ' Tryb ręczny WŁĄCZONY: przeciągnij pinezki na mapie. Dystans pokazujemy tylko w linii prostej — osiągalność niezweryfikowana.';
    } else if (STAN.stacje.some((s) => s.zrodlo === 'reczne')) {
      $('stacje-tryb').textContent += ` Część stacji ${ZRODLA_STACJI.reczne} — dystans w linii prostej.`;
    }
    $('przycisk-pierścien').hidden = STAN.siec.stan !== 'gotowa';
    $('przycisk-reczne').hidden = false;
  }
}

/* ---------------------------------------------------------------- prompt */

function budujPromptEkran() {
  const wynik = zbudujPrompt({
    konfig: STAN.konfig,
    // konfig.geokodacja=false → prompt ma same współrzędne (ADR 0013 pkt 3)
    okolica: { lat: STAN.pozycja.lat, lon: STAN.pozycja.lon, promienM: STAN.konfig.promienM, miejsce: STAN.konfig.geokodacja ? STAN.miejsce : '' },
    stacje: STAN.stacje,
  });
  pokazBledy('bledy-prompt', wynik.usterki);
  STAN.prompt = wynik.prompt;
  $('pole-prompt').value = wynik.prompt ?? '';
  $('prompt-licznik').textContent = wynik.prompt
    ? `${wynik.prompt.length} znaków · ${liczbaPytan(STAN.konfig)} pytań · ${STAN.konfig.liczbaStacji} stacji · protokół ${WERSJA_PROTOKOLU}`
    : 'prompt nie został zbudowany';
  $('przycisk-dalej-paczka').disabled = !wynik.prompt;
}

async function kopiujTekst(tekst, przycisk, etykieta, idPolaZapasowego = 'pole-prompt') {
  const przywroc = () => { przycisk.textContent = etykieta; };
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(tekst);
      przycisk.textContent = '✓ skopiowano';
    } else {
      throw new Error('brak navigator.clipboard');
    }
  } catch (e) {
    void e;
    // Schowek bywa niedostępny (iframe preview, starsze przeglądarki) — zaznacz
    // tekst i każ skopiować ręcznie. Zero komunikatu „nie działa" bez wyjścia.
    const pole = $(idPolaZapasowego);
    pole.focus();
    pole.setSelectionRange(0, pole.value.length);
    przycisk.textContent = '⚠ zaznaczone — skopiuj ręcznie';
  }
  window.setTimeout(przywroc, 2500);
}

function pobierzPlik(nazwa, tresc, typ) {
  const blob = new Blob([tresc], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nazwa;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------- walidacja */

function oczekiwane() {
  return {
    liczbaStacji: STAN.konfig.liczbaStacji,
    liczbaPytan: liczbaPytan(STAN.konfig),
    wiek: STAN.konfig.wiek,
    tematy: STAN.konfig.tematy,
    promienM: STAN.konfig.promienM,
    lat: STAN.pozycja?.lat,
    lon: STAN.pozycja?.lon,
    jezyk: STAN.konfig.jezyk,
    stacje: STAN.stacje,
    teraz: new Date(),
  };
}

function sprawdzOdpowiedz() {
  const tekst = $('pole-odpowiedz').value;
  // Najpierw próba odczytania ukrytej paczki (kontener TO-paczka/2 albo sam
  // blob), potem jawna odpowiedź modelu. `odpakujPaczke` nie rzuca wyjątków —
  // wklejony tekst bywa śmieciem i UI ma to pokazać komunikatem (ADR 0007).
  const zKontenera = odpakujPaczke(tekst);
  const { paczka, blad } = zKontenera.paczka
    ? { paczka: zKontenera.paczka, blad: null }
    : parsujOdpowiedzModela(tekst);
  const wynik = $('wynik-walidacji');
  const listaUsterek = $('wynik-usterki');
  const podsumowanie = $('wynik-podsumowanie');
  wynik.hidden = false;
  listaUsterek.innerHTML = '';
  podsumowanie.innerHTML = '';

  if (!paczka) {
    wynik.dataset.stan = 'blad';
    $('wynik-naglowek').textContent = 'Nie da się odczytać odpowiedzi';
    STAN.usterkiPaczki = [blad];
    STAN.paczka = null;
    renderujUsterki([blad]);
    $('przycisk-poprawka').hidden = false;
    $('przycisk-ukryj').hidden = true;
    $('przycisk-eksport-paczki').hidden = true;
    $('podglad-organizatora').hidden = true;
    status('Odpowiedź odrzucona na etapie odczytu (parsowanie JSON albo kontener).');
    return;
  }

  const usterki = walidujPaczke(paczka, oczekiwane());
  STAN.usterkiPaczki = usterki;
  if (usterki.length) {
    wynik.dataset.stan = 'blad';
    STAN.paczka = null;
    $('wynik-naglowek').textContent = `Paczka odrzucona — usterek: ${usterki.length}`;
    renderujUsterki(usterki);
    $('przycisk-poprawka').hidden = false;
    $('przycisk-ukryj').hidden = true;
    $('przycisk-eksport-paczki').hidden = true;
    $('podglad-organizatora').hidden = true;
    status('Paczka odrzucona przez walidator (protokół PYT §6).');
    return;
  }

  wynik.dataset.stan = 'ok';
  STAN.paczka = paczka;
  $('wynik-naglowek').textContent = 'Paczka przyjęta';
  $('przycisk-poprawka').hidden = true;
  $('przycisk-ukryj').hidden = false;
  $('przycisk-eksport-paczki').hidden = false;
  const postac = zKontenera.zrodlo === 'kontener'
    ? 'paczka ukryta (kontener TO-paczka/2)'
    : zKontenera.zrodlo === 'json'
      ? 'jawny JSON od modelu — przed ukryciem'
      : null;
  renderujPodsumowaniePaczki(paczka, postac);
  $('podglad-organizatora').hidden = false;
  renderujPodgladOrganizatora();
  // Pole wklejenia jest czyszczone natychmiast: plaintext nie zostaje w DOM
  // (ADR 0007 pkt 4). Paczka żyje w pamięci modułu.
  $('pole-odpowiedz').value = '';
  status('Paczka pytań zwalidowana i przyjęta do pamięci sesji.');
}

function renderujUsterki(usterki) {
  // replaceChildren, nie innerHTML='' (LESSONS L19): atrapa i przeglądarka
  // zachowują się wtedy identycznie, a stare wiersze nie zalegają w DOM
  $('wynik-usterki').replaceChildren(...usterki.map((u) => {
    const li = document.createElement('li');
    li.innerHTML = `<code>${u.kod}</code> ${u.pole ? `<strong>${u.pole}</strong> — ` : ''}${u.komunikat}`;
    return li;
  }));
}

/** Podsumowanie przyjętej paczki jako `dt/dd` (też replaceChildren — L19). */
function renderujPodsumowaniePaczki(paczka, postac = null) {
  const s = podsumowaniePaczki(paczka);
  const wiersze = [
    ['pytania', `${s.liczbaPytan} (stacje: ${s.stacje.join(', ')})`],
    ['tematy', s.tematy.join(', ')],
    ['źródła', `${s.liczbaZrodel} adresów — pokazane graczom po odpowiedzi`],
    ['punkty', `${s.punktyRazem} do zdobycia`],
  ];
  if (s.uwagi) wiersze.push(['uwagi modelu', s.uwagi]);
  if (Array.isArray(paczka.modyfikacje) && paczka.modyfikacje.length) {
    wiersze.push(['ręczne poprawki', `${paczka.modyfikacje.length} — zapisane w paczce (ADR 0006 pkt 8)`]);
  }
  if (postac) wiersze.push(['postać', postac]);
  wiersze.push(['następny krok', 'rozgrywka — kamień M6 (pytania zostaną ukryte w pamięci urządzenia)']);
  const wezly = [];
  for (const [dt, dd] of wiersze) {
    const dtEl = document.createElement('dt');
    dtEl.textContent = dt;
    const ddEl = document.createElement('dd');
    ddEl.textContent = dd;
    wezly.push(dtEl, ddEl);
  }
  $('wynik-podsumowanie').replaceChildren(...wezly);
}

/** Nazwa pliku paczki: kod gry oczyszczony do `[a-z0-9-]` (ADR 0010 pkt 3). */
function nazwaPlikuPaczki(kodGry) {
  const oczyszczony = String(kodGry ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
  return `okolica-${oczyszczony || 'gra'}.paczka.json`;
}


/** Zwinięcie podglądu: plaintext pytań znika z DOM (ADR 0007 pkt 4). */
function zwijPodgladOrganizatora() {
  $('podglad-organizatora').hidden = true;
  $('podglad-pytania').replaceChildren();
}

/* ------------------------------------- podgląd i edycja organizatora (M5) */

/**
 * Podgląd „tylko dla organizatora" (ADR 0006 pkt 8): pytania z przyjętej
 * paczki z formularzem edycji. Zapis poprawki przechodzi przez czystą
 * `zastosujEdycjePaczki` (atomowość + `modyfikacje[]`), a wynik jest
 * RE-walidowany całym `walidujPaczke` — edycja nie omija protokołu.
 */
function renderujPodgladOrganizatora() {
  const kontener = $('podglad-pytania');
  if (!STAN.paczka || !Array.isArray(STAN.paczka.pytania)) {
    kontener.replaceChildren();
    return;
  }
  kontener.replaceChildren(...STAN.paczka.pytania.map((pytanie) => kartaPytania(pytanie)));
}

function kartaPytania(p) {
  const karta = document.createElement('article');
  karta.className = 'pytanie-karta';

  const naglowek = document.createElement('h3');
  naglowek.textContent = `${p.id} · stacja ${p.stacja} · ${p.temat} · ${p.punkty} pkt`;
  karta.appendChild(naglowek);

  const tresc = document.createElement('textarea');
  tresc.className = 'pole-tekstowe';
  tresc.rows = 3;
  tresc.value = p.tresc;
  tresc.setAttribute('aria-label', `Treść pytania ${p.id}`);
  karta.appendChild(tresc);

  const odpowiedzi = document.createElement('div');
  odpowiedzi.className = 'edycja-odpowiedzi';
  const inputyOdpowiedzi = [];
  const radioPoprawne = [];
  (Array.isArray(p.odpowiedzi) ? p.odpowiedzi : []).forEach((odp, i) => {
    const wiersz = document.createElement('div');
    wiersz.className = 'wiersz-odpowiedzi';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `poprawna-${p.id}`;
    radio.checked = i === p.poprawna;
    radio.setAttribute('aria-label', `Oznacz odpowiedź ${i + 1} jako poprawną`);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pole-tekstowe';
    input.maxLength = 80;
    input.value = odp;
    input.setAttribute('aria-label', `Odpowiedź ${i + 1} pytania ${p.id}`);
    wiersz.appendChild(radio);
    wiersz.appendChild(input);
    odpowiedzi.appendChild(wiersz);
    inputyOdpowiedzi.push(input);
    radioPoprawne.push(radio);
  });
  karta.appendChild(odpowiedzi);

  const wyjasnienie = document.createElement('textarea');
  wyjasnienie.className = 'pole-tekstowe';
  wyjasnienie.rows = 3;
  wyjasnienie.value = p.wyjasnienie ?? '';
  wyjasnienie.setAttribute('aria-label', `Wyjaśnienie pytania ${p.id}`);
  karta.appendChild(wyjasnienie);

  const zrodla = document.createElement('div');
  zrodla.className = 'edycja-zrodel';
  // wiersze w osobnym kontenerze: przy samym `appendChild` nowy wiersz
  // wylądowałby ZA przyciskiem „Dodaj źródło" (insertBefore nie istnieje
  // w atrapie), więc przycisk jest rodzeństwem listy, nie jej elementem
  const listaZrodel = document.createElement('div');
  zrodla.appendChild(listaZrodel);
  const wierszeZrodel = [];
  function dodajWierszZrodla(z) {
    const wiersz = document.createElement('div');
    wiersz.className = 'wiersz-zrodla';
    const url = document.createElement('input');
    url.type = 'text';
    url.className = 'pole-tekstowe';
    url.value = z?.url ?? '';
    url.setAttribute('aria-label', 'Adres URL źródła');
    const tytul = document.createElement('input');
    tytul.type = 'text';
    tytul.className = 'pole-tekstowe';
    tytul.value = z?.tytul ?? '';
    tytul.setAttribute('aria-label', 'Tytuł źródła');
    const sprawdzono = document.createElement('input');
    sprawdzono.type = 'text';
    sprawdzono.className = 'pole-tekstowe pole-data';
    sprawdzono.value = z?.sprawdzono ?? '';
    sprawdzono.placeholder = 'RRRR-MM-DD';
    sprawdzono.setAttribute('aria-label', 'Data sprawdzenia źródła');
    wiersz.appendChild(url);
    wiersz.appendChild(tytul);
    wiersz.appendChild(sprawdzono);
    listaZrodel.appendChild(wiersz);
    wierszeZrodel.push({ wiersz, url, tytul, sprawdzono });
  }
  for (const z of Array.isArray(p.zrodla) ? p.zrodla : []) dodajWierszZrodla(z);
  const dodajZrodlo = document.createElement('button');
  dodajZrodlo.type = 'button';
  dodajZrodlo.className = 'przycisk przycisk-maly';
  dodajZrodlo.textContent = '＋ Dodaj źródło';
  dodajZrodlo.addEventListener('click', () => dodajWierszZrodla(null));
  zrodla.appendChild(dodajZrodlo);
  karta.appendChild(zrodla);

  const zapisz = document.createElement('button');
  zapisz.type = 'button';
  zapisz.className = 'przycisk';
  zapisz.textContent = '💾 Zapisz poprawkę';
  zapisz.addEventListener('click', () => zapiszPoprawke(p, { tresc, inputyOdpowiedzi, radioPoprawne, wyjasnienie, wierszeZrodel }));
  karta.appendChild(zapisz);
  return karta;
}

function zapiszPoprawke(p, pola) {
  const zmiany = {};
  if (pola.tresc.value !== p.tresc) zmiany.tresc = pola.tresc.value;
  const noweOdpowiedzi = pola.inputyOdpowiedzi.map((input) => input.value);
  if (noweOdpowiedzi.join('|') !== (p.odpowiedzi ?? []).join('|')) zmiany.odpowiedzi = noweOdpowiedzi;
  const indexPoprawnej = pola.radioPoprawne.findIndex((radio) => radio.checked);
  if (indexPoprawnej >= 0 && indexPoprawnej !== p.poprawna) zmiany.poprawna = indexPoprawnej;
  if (pola.wyjasnienie.value !== (p.wyjasnienie ?? '')) zmiany.wyjasnienie = pola.wyjasnienie.value;
  const noweZrodla = pola.wierszeZrodel
    .map(({ url, tytul, sprawdzono }) => ({ url: url.value.trim(), tytul: tytul.value.trim(), sprawdzono: sprawdzono.value.trim() }))
    .filter((z) => z.url || z.tytul || z.sprawdzono);
  if (JSON.stringify(noweZrodla) !== JSON.stringify(p.zrodla ?? [])) zmiany.zrodla = noweZrodla;

  if (Object.keys(zmiany).length === 0) {
    status('Brak zmian do zapisania — pytanie zostaje, jak było.');
    return;
  }
  const wynik = zastosujEdycjePaczki(STAN.paczka, [{ pytanieId: p.id, zmiany }], { terazMs: Date.now() });
  if (!wynik.paczka) {
    $('wynik-walidacji').dataset.stan = 'blad';
    renderujUsterki(wynik.usterki);
    status('Poprawka odrzucona — paczka zostaje bez zmian.');
    return;
  }
  STAN.paczka = wynik.paczka;
  // edycja NIE omija protokołu: cała paczka przechodzi walidację jeszcze raz
  const usterki = walidujPaczke(STAN.paczka, oczekiwane());
  STAN.usterkiPaczki = usterki;
  renderujUsterki(usterki);
  $('wynik-walidacji').dataset.stan = usterki.length ? 'blad' : 'ok';
  $('wynik-naglowek').textContent = usterki.length
    ? `Paczka po poprawce wymaga naprawy — usterek: ${usterki.length}`
    : 'Paczka przyjęta (po ręcznej poprawce)';
  $('przycisk-ukryj').hidden = usterki.length > 0;
  $('przycisk-eksport-paczki').hidden = usterki.length > 0;
  $('przycisk-poprawka').hidden = usterki.length === 0;
  renderujPodsumowaniePaczki(STAN.paczka, null);
  renderujPodgladOrganizatora();
  status(usterki.length
    ? 'Poprawka zapisana w modyfikacje[], ale paczka ma teraz usterki — napraw je albo cofnij zmianę przed ukryciem.'
    : `Poprawka zapisana w modyfikacje[] (łącznie ${STAN.paczka.modyfikacje.length}); paczka przeszła re-walidację protokołu.`);
}

/* ------------------------------------------------------- motyw i zapis */

function przelaczMotyw() {
  const obecny = document.documentElement.dataset.motyw === 'ciemny' ? 'ciemny' : 'jasny';
  const nowy = obecny === 'ciemny' ? 'jasny' : 'ciemny';
  document.documentElement.dataset.motyw = nowy;
  try { localStorage.setItem(KLUCZ_MOTYW, nowy); } catch (e) { void e; }
  $('przycisk-motyw').setAttribute('aria-pressed', String(nowy === 'ciemny'));
}

function zapiszKonfiguracje() {
  try {
    localStorage.setItem(KLUCZ_KONFIG, JSON.stringify({ schemat: 'konfig/1', konfig: STAN.konfig }));
  } catch (e) {
    void e; // prywatny tryb przeglądarki — gramy dalej w pamięci (ADR 0010)
  }
}

function wczytajKonfiguracje() {
  try {
    const surowe = localStorage.getItem(KLUCZ_KONFIG);
    if (!surowe) return;
    const { schemat, konfig } = JSON.parse(surowe);
    if (schemat !== 'konfig/1' || !konfig) return; // migracje: ADR 0010 pkt 6
    // sanitizacja: stary schemat albo ręczna edycja nie może wysypać UI
    STAN.konfig = oczyscKonfiguracje(konfig);
    STAN.konfig.imiona = dostosujImiona(STAN.konfig.liczbaGraczy);
  } catch (e) {
    void e;
  }
}

/* ----------------------------------------------------------- uruchomienie */

function banerStartowy() {
  const baner = $('baner');
  if (location.protocol === 'file:') {
    baner.hidden = false;
    baner.textContent = 'Otwarto z pliku (file://) — moduły ES i fetch nie działają. Uruchom serwer: npm run serwer, potem http://localhost:8000';
  } else if (!window.isSecureContext) {
    baner.hidden = false;
    baner.textContent = 'Brak HTTPS: geolokalizacja i Web Crypto będą zablokowane. Użyj GitHub Pages albo localhost.';
  }
}

function start() {
  wczytajKonfiguracje();
  banerStartowy();
  $('stopka-protokol').textContent = WERSJA_PROTOKOLU;

  renderujTryby();
  renderujSegment('lista-wieku', WIEK, STAN.konfig.wiek, (wiek) => { STAN.konfig.wiek = wiek; });
  renderujTematy();
  renderujSelecty();
  renderujImiona();
  renderujSetup();
  utworzMapy();

  if (location.search.includes('tryb=test')) {
    STAN.trybTestowy = true;
    $('przycisk-test').setAttribute('aria-pressed', 'true');
    $('reczne-wspolrzedne').hidden = false;
    $('przycisk-symulacja').hidden = false;
  }
  if (location.search.includes('odstep=0')) {
    // skrót dla testów/przeglądarki: przełączanie instancji Overpass bez
    // 30-sekundowych pauz (polityka ASSETS §2 jest domyślnie nietknięta)
    STAN.odstepOverpassMs = 0;
  }

  $('przycisk-motyw').addEventListener('click', przelaczMotyw);
  $('przycisk-prywatnosc').addEventListener('click', pokazPrywatnosc);
  $('przycisk-prywatnosc-stopka').addEventListener('click', pokazPrywatnosc);
  $('przycisk-wrocz-prywatnosc').addEventListener('click', wrocZPrywatnosci);
  $('przycisk-czysc-dane').addEventListener('click', czyscDaneWitryny);
  $('przycisk-symulacja').addEventListener('click', przelaczSymulacje);
  $('przycisk-test').addEventListener('click', () => {
    STAN.trybTestowy = !STAN.trybTestowy;
    $('przycisk-test').setAttribute('aria-pressed', String(STAN.trybTestowy));
    $('reczne-wspolrzedne').hidden = !STAN.trybTestowy;
    $('przycisk-symulacja').hidden = !STAN.trybTestowy;
    pokazEkran('pozycja');
    pokazPozycje();
    status(STAN.trybTestowy ? 'Tryb testowy: współrzędne ręczne zamiast GPS (ADR 0004 pkt 6).' : 'Tryb testowy wyłączony.');
  });

  $('przycisk-dalej-pozycja').addEventListener('click', () => {
    const usterki = walidujSetup(czytajSetupZDomu());
    pokazBledy('bledy-setup', usterki);
    if (usterki.length) {
      status(`Konfiguracja ma usterek: ${usterki.length}.`);
      return;
    }
    zapiszKonfiguracje();
    pokazEkran('pozycja');
    pokazPozycje();
    if (!STAN.trybTestowy && !STAN.pozycja) wlaczGps();
  });

  $('przycisk-gps').addEventListener('click', wlaczGps);

  // Obrót telefonu albo zmiana rozmiaru okna: panele map mają inne wymiary,
  // więc widok trzeba przeliczyć (rozmiar bierzemy z `getBoundingClientRect`).
  window.addEventListener('resize', () => {
    kazdaMapa((mapa) => mapa.odswiez());
  });

  // Pauza śledzenia, gdy karta schodzi w tło — oszczędność baterii i jawny
  // komunikat po powrocie (ADR 0004 pkt 1).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
    zatrzymajSymulacje();
      if (STAN.watcher?.czyAktywny()) {
        zatrzymajGps();
        STAN.pauzaWTle = true;
        status(komunikatPauzy().komunikat);
      }
      return;
    }
    if (!STAN.pauzaWTle) return;
    STAN.pauzaWTle = false;
    if (STAN.trybTestowy) return;
    wlaczGps();
    status(komunikatWznowienia().komunikat);
  });
  $('przycisk-recznie').addEventListener('click', () => {
    $('reczne-wspolrzedne').hidden = false;
    $('setup-lat').focus();
  });
  $('przycisk-ustaw-reczne').addEventListener('click', () => {
    const surowyLat = String($('setup-lat').value ?? '').trim();
    const surowyLon = String($('setup-lon').value ?? '').trim();
    if (!surowyLat || !surowyLon) {
      // Puste pole dałoby Number('') === 0, czyli „Null Island" — pozycję
      // wyglądającą na poprawną. Lepiej odmówić niż ustawić grę w zatoce.
      pokazBledy('bledy-pozycja', [{ kod: 'P06', pole: 'wspolrzedne', komunikat: 'Wpisz obie współrzędne: szerokość i długość (stopnie dziesiętne, np. 52.23178 i 21.01234).' }]);
      return;
    }
    const fix = fixZPozycji({ lat: Number(surowyLat), lon: Number(surowyLon), accuracy: null }, performance.now(), ZRODLA_FIXA.reczne);
    const ocena = ocenFix(fix);
    if (!ocena.akceptowany) {
      pokazBledy('bledy-pozycja', [{ kod: ocena.kod, pole: 'wspolrzedne', komunikat: 'Wpisz szerokość od -90 do 90 i długość od -180 do 180 (stopnie dziesiętne).' }]);
      return;
    }
    STAN.ostatniFix = fix;
    STAN.ocenaFixa = ocena;
    STAN.pozycja = { lat: fix.lat, lon: fix.lon };
    STAN.dokladnoscM = fix.accuracy;
    pokazBledy('bledy-pozycja', []);
    pokazPozycje();
    status('Pozycja ustawiona ręcznie (tryb testowy).');
  });

  $('przycisk-wstecz-setup').addEventListener('click', () => pokazEkran('setup'));
  $('przycisk-dalej-stacje').addEventListener('click', () => {
    // Na ekran pozycji da się wejść także przyciskiem trybu testowego, który
    // nie waliduje setupu, a `stacjeProste` odmawia przy niedodatnim promieniu
    // albo liczbie stacji. Zamiast wyjątku w nasłuchu — jawna odmowa z kodami
    // z `konfig.js` (LESSONS L10: walidacja nie może zakładać, że ktoś
    // wcześniej posprzątał).
    // Walidujemy stan, nie DOM: na tym ekranie pola setupu są schowane, a
    // imiona i tak trafiają do `STAN.konfig.imiona` z nasłuchów `input`.
    const usterki = walidujSetup(STAN.konfig);
    if (usterki.length) {
      pokazBledy('bledy-pozycja', usterki);
      status(`Stacje nie zostały rozstawione: konfiguracja ma usterek: ${usterki.length}. Wróć do ustawień gry i popraw je.`);
      return;
    }
    pokazEkran('stacje');
    przeliczStacje();
  });

  $('przycisk-wstecz-pozycja').addEventListener('click', () => pokazEkran('pozycja'));
  $('przycisk-przelicz').addEventListener('click', () => {
    STAN.ziarnoOffset += 1;
    STAN.obrot = (STAN.obrot + 360 / (STAN.konfig.liczbaStacji * 2)) % 360;
    przeliczStacje();
    status('Przeliczono układ stacji (inne ziarno).');
  });
  $('przycisk-pierścien').addEventListener('click', () => {
    STAN.wymusPierscien = !STAN.wymusPierscien;
    $('przycisk-pierścien').setAttribute('aria-pressed', String(STAN.wymusPierscien));
    przeliczStacje();
    status(STAN.wymusPierscien
      ? 'Tryb uproszczony (pierścień) wymuszony — osiągalność stacji niezweryfikowana (ADR 0005 pkt 8).'
      : 'Wracam do stacji z sieci drogowej.');
  });
  $('przycisk-reczne').addEventListener('click', () => {
    if (STAN.trybReczny) {
      wylaczTrybReczny();
      renderujStacje();
      status('Tryb ręczny wyłączony — pinezki zostają tam, gdzie je postawiłeś.');
      return;
    }
    if (STAN.stacje.length === 0) {
      status('Najpierw rozstaw stacje (pierścień albo sieć drogowa), potem poprawiaj je ręcznie.');
      return;
    }
    STAN.trybReczny = true;
    $('przycisk-reczne').setAttribute('aria-pressed', 'true');
    if (STAN.mapy.stacje) {
      STAN.mapy.stacje.ustawTrybReczny(true, przestawStacjeRecznie);
    }
    renderujStacje();
    status('Tryb ręczny: przeciągnij pinezki na mapie. Dystans liczymy w linii prostej — osiągalności NIE weryfikujemy (ADR 0005 pkt 8).');
  });
  $('przycisk-dalej-prompt').addEventListener('click', () => {
    pokazEkran('prompt');
    budujPromptEkran();
  });

  $('przycisk-wstecz-stacje').addEventListener('click', () => pokazEkran('stacje'));
  $('przycisk-kopiuj-prompt').addEventListener('click', (e) => kopiujTekst(STAN.prompt ?? '', e.currentTarget, '⧉ Kopiuj prompt'));
  $('przycisk-pobierz-prompt').addEventListener('click', () => {
    if (!STAN.prompt) return;
    pobierzPlik(`prompt-okolica-${geohash(STAN.pozycja.lat, STAN.pozycja.lon, 5)}.txt`, STAN.prompt, 'text/plain;charset=utf-8');
  });
  $('przycisk-dalej-paczka').addEventListener('click', () => pokazEkran('paczka'));

  $('przycisk-wstecz-prompt').addEventListener('click', () => pokazEkran('prompt'));
  $('przycisk-wklej').addEventListener('click', async (e) => {
    try {
      const tekst = await navigator.clipboard.readText();
      $('pole-odpowiedz').value = tekst;
      e.currentTarget.textContent = '✓ wklejono';
    } catch (err) {
      void err;
      e.currentTarget.textContent = '⚠ schowek zablokowany — wklej palcem (przytrzymaj pole)';
    }
    window.setTimeout(() => { e.currentTarget.textContent = '📋 Wklej ze schowka'; }, 3000);
  });
  $('plik-odpowiedz').addEventListener('change', async (e) => {
    const plik = e.target.files?.[0];
    if (!plik) return;
    $('pole-odpowiedz').value = await plik.text();
    status(`Wczytano odpowiedź z pliku ${plik.name}.`);
  });
  $('przycisk-sprawdz').addEventListener('click', sprawdzOdpowiedz);
  $('przycisk-poprawka').addEventListener('click', (e) => {
    const tekst = poprawkaDlaModelu(STAN.usterkiPaczki, { liczbaPytan: liczbaPytan(STAN.konfig) });
    kopiujTekst(tekst, e.currentTarget, '⧉ Kopiuj poprawkę do modelu');
    $('pole-odpowiedz').value = tekst;
  });

  // Ukrycie przyjętej paczki (ADR 0007): kontener do schowka i do pola, żeby dało
  // się go przenieść na inne urządzenie albo zapisać w pliku. Komunikat mówi
  // wprost, że to obfuskacja — bez złudzenia bezpieczeństwa (pkt 5).
  $('przycisk-ukryj').addEventListener('click', (e) => {
    if (!STAN.paczka) return;
    const tekst = JSON.stringify(zapakujPaczke(STAN.paczka, WERSJA_PROTOKOLU));
    $('pole-odpowiedz').value = tekst;
    kopiujTekst(tekst, e.currentTarget, `⧉ Ukryj paczkę (${SCHEMAT_KONTENERA})`, 'pole-odpowiedz');
    zwijPodgladOrganizatora(); // plaintext pytań znika z ekranu po ukryciu
    status(`Paczka ukryta w kontenerze ${SCHEMAT_KONTENERA} — to obfuskacja bez klucza, nie szyfrowanie (ADR 0007).`);
  });
  $('przycisk-eksport-paczki').addEventListener('click', () => {
    if (!STAN.paczka) return;
    // plik niesie WYŁĄCZNIE ukryty kontener — plaintext nigdy nie opuszcza
    // ekranu (ADR 0007 pkt 4); import: ekran paczki → „⬆ Z pliku"
    const tekst = `${JSON.stringify(zapakujPaczke(STAN.paczka, WERSJA_PROTOKOLU), null, 2)}\n`;
    const nazwa = nazwaPlikuPaczki(STAN.konfig.kodGry);
    pobierzPlik(nazwa, tekst, 'application/json'); // helper z M0 (prompt → plik)
    status(`Paczka zapisana do pliku ${nazwa} (w środku kontener ${SCHEMAT_KONTENERA}, nie plaintext). Wgrasz ją z powrotem przez „⬆ Z pliku".`);
  });

  pokazEkran('setup');
  status(`M0 — fundament. Ustawienia domyślne: ${TRYBY[STAN.konfig.tryb].etykieta}, ${STAN.konfig.liczbaStacji} stacji, ${DOMYSLNE.pytaniaNaStacje} pytanie na stację, wiek ${WIEK[STAN.konfig.wiek].etykieta}.`);
}

if (typeof document !== 'undefined' && document.getElementById('ekran-setup')) start();
