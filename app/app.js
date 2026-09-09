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

import { DOMYSLNE, JEZYKI, OGRANICZENIA, PODKLADY, TEMATY, TRYBY, WIEK, domyslnaKonfiguracja, domyslnyKodGry, liczbaPytan, oczyscKonfiguracje, przeliczenieCzasu, walidujSetup, ziarnoRozgrywki } from './konfig.js?v=m12-40';
import { dopasujZoomDoPromienia, formatujWspolrzedne, geohash, odlegloscM, parsujWspolrzedne, przesunPunkt } from './geo.js?v=m12-40';
import {
  czyPaczkaOdwrocona,
  czyWariantFactcheck,
  normalizujTematyPaczki,
  odkodujPaczkeRev1,
  odkodujPaczkeRev2,
  parsujOdpowiedzModela,
  poprawkaDlaModelu,
  szacunekOdpowiedzi,
  walidujPaczke,
  zbudujPrompt,
  WERSJA_PROTOKOLU,
  SZABLON_WERSJA,
  SZABLON_WERSJA_BEZ_WERYFIKACJI,
  WERSJA_PROTOKOLU_REV2,
  WERSJA_PROTOKOLU_REV3,
  PROG_ODPOWIEDZI_TOKENY,
} from './protokol.js?v=m12-40';
import { odpakujPaczke, zapakujPaczke } from './kodowanie.js?v=m12-40';
import { ZRODLA_STACJI, dystanseOdcinkowM, najmniejszyOdstepM, stacjeProste, uzupelnijOdleglosci, wybierzStacje } from './stacje.js?v=m12-40';
import { GRANICE, PROFILE_GPS, ZRODLA_FIXA, dodajFix, komunikatPauzy, komunikatWznowienia, ocenFix, fixZPozycji, profilBaterii, sekwencjaSymulowana, stanDojscia, trasaProsta, watchPozycja } from './pozycja.js?v=m12-40';
import { FAZY, STANY_ODCINKA, TRYBY_DOJSCIA, ktoOdpowiada, nowaRozgrywka, pominStacje, podglad, podsumowanie, pytaniaStacji, skierujDoStacji, stacjeDoWyboru, startOdcinka, zapiszOdpowiedz, zakonczOdcinek } from './rozgrywka.js?v=m12-40';
import { KLUCZ_AKTYWNEJ, KLUCZ_HISTORII, dodajWpisHistorii, kluczStanu, nowaHistoria, oczyscKodGry, serializujStan, skrotGry, walidujHistorieSurowa, walidujStanSurowy, zbierajStan } from './trwalosc.js?v=m12-40';
import {
  KLUCZ_REJESTRU, SCHEMAT_LOKALNY,
  czyWOkolicy, dolozWpisRejestru, dopasujMetaIndeksu, dopasujZestawy, kluczZestawu, nowyRejestr, powodyNiedopasowania,
  rozmiarBajty, walidujIndeksSurowy, walidujRejestrSurowy, walidujZestawLokalnySurowy,
  walidujZestawPublicznySurowy, zbierzMetaZestawu, zbudujPlikZestawu,
  urlPaczkiZRepo,
} from './zestawy.js?v=m12-40';
import { KLUCZ_SYGNALOW, czySygnalyWlaczone, planSygnalu } from './sygnaly.js?v=m12-40';
import { ROLE_PALETY, dystansTekst, etykietaOdcinka, planObrazuWyniku, wynikTekstowy } from './wynik.js?v=m12-40';
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
  kolejnoscInstancji,
  kandydaciNaStacje,
  kluczCacheSieci,
  miejsceZOdpowiedziNominatim,
  nazwaMiejsca,
  parsujOdpowiedz,
  przycijCacheSieci,
  upraszczajDaneDoCache,
  wczytajDaneZCache,
} from './sieci.js?v=m12-40';
import { utworzMape } from './mapa.js?v=m12-40';
import { ALFABET_KODU, MAKS_GRACZY, SCHEMAT_GRY, SCHEMAT_KOLEJKI_HOTSEAT, SCHEMAT_WYSLANYCH_HOTSEAT, TRYBY_GRY, agregujRanking, biezacyGraczTury, czyPinPoprawny, filtrujLobby, graHotseatDoWysylki, kategorieRankingu, kodPoprawny, komunikatBleduProfilu, normalizujKod, normalizujPseudonim, przeliczWyniki, ramkaGeohash, walidujGraczyLokalnych, walidujGreSurowa, walidujLobbySurowe, walidujRankingSurowy, walidujKolejkeHotseat, walidujWyslaneHotseat, zbudujZdarzenie } from './wieloosobowa.js?v=m12-40';
import { interwalPollingu, polecenieMostu, urlGet, urlStanGry, utworzSynchronizacje } from './sync.js?v=m12-40';
import { adresMostu, stanMostu } from './most.js?v=m12-40';
import {
  KLUCZ_OCEN, KLUCZ_KOLEJKI_OCEN, OCENA_PLUS, OCENA_MINUS, noweOceny, nowyTokenGry,
  walidujOcenyLokalneTekst, ocenPytanie, idGlosujacego, znajdzGlos, walidujKolejkeOcenTekst,
  dodajDoKolejkiOcen, usunZKolejkiOcen, walidujOdpowiedzOceny, walidujStatystykiOcen,
  opisOcenTekst,
} from './oceny.js?v=m12-40';

const KLUCZ_KONFIG = 'okolica:konfig';
const KLUCZ_MOTYW = 'okolica:motyw';
/** M11/P4 (ADR 0019): tożsamość i most gry wieloosobowej — osobne klucze, „kasuj dane" czyści wszystko.
 *  Adres mostu NIE jest tu trzymany: żyje w kodzie (`app/most.js`, ADR 0020). */
const KLUCZ_PSEUDONIMU = 'okolica:pseudonim';
const KLUCZ_RODZAJU_GRY = 'okolica:rodzaj-gry';
const KLUCZ_SESJI_MULTI = 'okolica:multi:sesja';

const STAN = {
  konfig: domyslnaKonfiguracja(),
  pozycja: null,
  dokladnoscM: null,
  ostatniFix: null,
  ocenaFixa: null,
  pauzaWTle: false,
  /** M10/T3: bieżący profil watchera GPS ('dokladny' | 'oszczedny') — histereza w `profilBaterii`. */
  profilGps: 'dokladny',
  miejsce: '',
  stacje: [],
  obrot: 0,
  ziarnoOffset: 0,
  prompt: null,
  /** ADR 0032: wariant promptu z ekranu 4 (checkbox „Pytania z fact check") — false = domyślny bez weryfikacji. */
  promptFactcheck: false,
  /** ADR 0032: wariant korekty dla modelu — ze znacznika wklejki, a dla E02 z checkboxa. */
  poprawkaFactcheck: true,
  paczka: null,
  /** ADR 0028: id paczki z repozytorium Drive — tylko takie paczki zbierają oceny. */
  paczkaRepoId: '',
  /** ADR 0028: token tej gry; most liczy z niego „użyta w X grach". */
  tokenGry: '',
  /** ADR 0028: głosy tego telefonu — reguła „już ocenione" działa między sesjami. */
  oceny: noweOceny(),
  /** ADR 0028: pytanie i gracz, przy których stoi panel oceny. */
  ocenianePytanieId: '',
  ocenianyGracz: '',
  /** ADR 0028: tożsamość głosującego spod panelu — ta sama przy renderze i kliku. */
  oceniajacyId: '',
  usterkiPaczki: [],
  /** Ekran, na który wracamy z rankingu i z prywatności (oba są poza EKRANY). */
  powrotZRankingu: 'setup',
  powrotZPrywatnosci: 'setup',
  /** M6: stan gry `rozgrywka/1` — null do „▶ Zacznij grę". */
  rozgrywka: null,
  /** M6: ukryty kontener paczki na czas gry (TO-paczka/2) — nigdy plaintext (ADR 0007 pkt 4). */
  kontenerPaczki: null,
  /** M6: pauza gry — zegar stoi, fixy nie płyną, przyciski faz zablokowane (ADR 0004 pkt 1). */
  graPauza: false,
  graPauzaStartMs: 0,
  pauzaSkumulowanaMs: 0,
  /** M6/R5: kiedy odsłonięto bieżące pytanie (czas odpowiedzi dla modelu). */
  pytaniePokazaneMs: 0,
  /** M6/R6: snapshot `stan-gry/1` znaleziony przy starcie (kandydat do wznowienia). */
  wznowienieKandydat: null,
  /** M6/R6: dwustopniowość — kasowanie zapisu i ręczne zakończenie gry. */
  czyszczenieZapisuUzbrojone: false,
  historiaKasowanieUzbrojone: false,
  graZakonczonaUzbrojone: false,
  graZakonczonaRecznie: false,
  /** M7: tekst wyniku do udostępnienia (wynikTekstowy) — żyje od pokazWyniki. */
  wynikTekst: null,
  /** M11/P4: 'hotseat' | 'multi' — wybór z setupu, utrwalany w localStorage. */
  rodzajGry: 'hotseat',
  /** M11/P4: sesja gry wieloosobowej `{rola, gra, graczId, pseudonim, urlMostu, sync, ostatniStanMs}` albo null. */
  multi: null,
  /** M11/P4: załadowany zestaw do założenia gry `{stacje, kontener, meta, opis}`. */
  multiZrodlo: null,
  /** M11/P4: tryb zakładanej gry ('wyscig' | 'tury'). */
  multiTryb: 'wyscig',
  /** M11/P4: mety paczek z repo Drive dla selecta źródła + adres indeksu. */
  multiRepoMety: [],
  multiRepoUrl: null,
  /** M11/P4: dwustopniowa rezygnacja z gry wieloosobowej (jak inne destrukcyjne). */
  multiRezygnacjaUzbrojona: false,
  /** M12/P6: surowe wiersze RO-ranking/1 z mostu + aktywna zakładka i kategoria. */
  rankingWiersze: null,
  rankingZakladka: 'ogolny',
  rankingKategoria: null,
  trybTestowy: false,
  /** Sterowanie watchera z `watchPozycja()`: `{ zamknij, czyAktywny }`. */
  watcher: null,
  /** Mapy z `mapa.js` (M2): `null`, gdy panelu nie ma w `index.html`. */
  mapy: { pozycja: null, stacje: null, gra: null },
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

const EKRANY = ['setup', 'multi', 'pozycja', 'stacje', 'prompt', 'paczka', 'gra'];

function pokazEkran(nazwa) {
  ukryjStart(); // krok gry chowa okno startowe (poza nim okno nie ma czego przykrywać)
  STAN.ekran = nazwa;
  // ADR 0030: stan ekranu na <body>. CSS nie ma selektora rodzica, a układ
  // rozgrywki na telefonie (mapa tłem, karty faz NA mapie, bez przewijania
  // strony) musi działać wyłącznie na ekranie gry — nie na setupie, gdzie
  // przewijanie jest normalne i potrzebne.
  document.body.dataset.ekran = nazwa;
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
 * Mapa startowa (decyzja właściciela 2026-09-09): sama mapa-tło, nagłówek
 * i stopka — bez formularza. Stan lądowania po starcie (gdy zniknie okno
 * startowe) i po „Wróć na początek". Poza EKRANY jak prywatność i rankingi:
 * to nie krok przygotowania gry, tylko spód, na którym gra się zaczyna.
 */
function pokazMapeStartowa() {
  STAN.ekran = 'mapa';
  document.body.dataset.ekran = 'mapa';
  for (const e of EKRANY) {
    $(`ekran-${e}`).hidden = true;
    const krok = document.querySelector(`#kroki li[data-krok="${e}"]`);
    if (krok) {
      krok.classList.remove('aktywny');
      krok.classList.remove('zrobione');
    }
  }
  odswiezMapeEkranu('pozycja'); // mapa na spodzie to instancja pozycji
  window.scrollTo({ top: 0 });
}

/** Okno startowe znika po kliknięciu gdziekolwiek na nie (jw.). */
function ukryjStart() {
  const w = $('ekran-start');
  if (w) w.hidden = true;
  document.body.classList.remove('okno-start');
  const mp = document.querySelector('#mapa-pozycja .mapa-przyciski');
  if (mp) mp.hidden = false;
}

/**
 * Ekran „dane i prywatność" (ADR 0013 pkt 7) nie jest krokiem gry: chowa
 * wszystkie ekrany z paska kroków i pokazuje siebie, a powrót prowadzi na
 * ekran zapamiętany w `STAN.ekran`.
 */
function pokazPrywatnosc() {
  // ADR 0030: ekran prywatności chowa wszystkie ekrany gry, więc znacznik
  // `data-ekran` musi zniknąć razem z nimi — inaczej reguły „bez przewijania”
  // zostałyby na długim dokumencie, którego nie dałoby się przeczytać.
  // Rankingi NIE należą do EKRANY, więc chowamy je jawnie i zapamiętujemy,
  // że to stamtąd przyszliśmy — bez tego „wróć" zrzucało gracza na setup.
  STAN.powrotZPrywatnosci = $('ekran-ranking').hidden
    ? (EKRANY.includes(STAN.ekran) ? STAN.ekran : 'setup')
    : 'ranking';
  ukryjStart(); // okno startowe nie przykrywa karty prywatności
  document.body.dataset.ekran = 'prywatnosc';
  for (const e of EKRANY) $(`ekran-${e}`).hidden = true;
  $('ekran-ranking').hidden = true;
  $('ekran-prywatnosc').hidden = false;
  $('geokodacja-zapasowa').checked = localStorage.getItem('okolica:geokodacja-zapasowa') === '1';
  window.scrollTo({ top: 0 });
}

function wrocZPrywatnosci() {
  $('ekran-prywatnosc').hidden = true;
  if (STAN.powrotZPrywatnosci === 'ranking') {
    pokazRankingi({ bezPobierania: true }); // dane już są — nie pytamy mostu drugi raz
    return;
  }
  if (STAN.ekran === 'mapa') { pokazMapeStartowa(); return; }
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

/**
 * Dopisek roboczy (np. odniesienie do ADR): dokładany do komunikatu tylko
 * w trybie testowym. Poza nim UI mówi po ludzku, bez żargonu projektowego.
 */
function ADR(tekst) {
  return STAN.trybTestowy ? tekst : '';
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
  // Węzły zamiast innerHTML (LESSONS L19, BACKLOG B16): atrapa DOM w testach
  // nie parsuje innerHTML, a poza tym nic zewnętrznego nie trafia do znaczników.
  lista.replaceChildren(...Object.entries(TRYBY).map(([klucz, tryb]) => {
    const etykieta = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'tryb';
    input.value = klucz;
    const mocne = document.createElement('strong');
    mocne.textContent = `${tryb.ikona} ${tryb.etykieta}`;
    const predkosc = document.createElement('span');
    predkosc.textContent = `${String(tryb.predkoscKmh).replace('.', ',')} km/h`;
    etykieta.append(input, mocne, predkosc);
    return etykieta;
  }));
  const zaznaczonyTryb = lista.querySelector(`input[value="${STAN.konfig.tryb}"]`) ?? lista.querySelector('input');
  if (zaznaczonyTryb) {
    zaznaczonyTryb.checked = true;
    STAN.konfig.tryb = zaznaczonyTryb.value;
  }
  lista.addEventListener('change', () => {
    const wybrany = lista.querySelector('input:checked')?.value;
    if (!wybrany || !TRYBY[wybrany]) return;
    STAN.konfig.tryb = wybrany;
    przeliczPromienZCzasu(); // ADR 0025: promień wynika z czasu i prędkości trybu
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
  lista.replaceChildren(...Object.entries(dane).map(([klucz, pozycja]) => {
    const etykieta = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = nazwaPola;
    input.value = klucz;
    const mocne = document.createElement('strong');
    mocne.textContent = pozycja.etykieta;
    etykieta.append(input, mocne);
    return etykieta;
  }));
  const zaznaczony = lista.querySelector(`input[value="${wybranyKlucz}"]`);
  if (zaznaczony) zaznaczony.checked = true;
  lista.addEventListener('change', () => {
    const wybrany = lista.querySelector('input:checked')?.value;
    if (wybrany) onChange(wybrany);
  });
}

function renderujTematy() {
  const lista = $('lista-tematow');
  lista.replaceChildren(...Object.entries(TEMATY).map(([klucz, temat]) => {
    const etykieta = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = klucz;
    input.title = temat.opis;
    const nazwa = document.createElement('span');
    nazwa.textContent = temat.etykieta;
    etykieta.append(input, nazwa);
    return etykieta;
  }));
  for (const klucz of STAN.konfig.tematy) {
    const box = lista.querySelector(`input[value="${klucz}"]`);
    if (box) box.checked = true;
  }
  const poleWlasne = $('setup-temat-wlasny');
  poleWlasne.value = STAN.konfig.tematWlasny ?? '';
  const odswiezPoleWlasne = () => {
    poleWlasne.hidden = ![...lista.querySelectorAll('input:checked')].some((i) => i.value === 'wlasny');
  };
  odswiezPoleWlasne();
  lista.addEventListener('change', () => {
    STAN.konfig.tematy = [...lista.querySelectorAll('input:checked')].map((i) => i.value);
    odswiezPoleWlasne();
  });
  poleWlasne.addEventListener('input', () => { STAN.konfig.tematWlasny = poleWlasne.value; });
}

function renderujSelecty() {
  const wypelnij = (idPola, dane, wybrany) => {
    const select = $(idPola);
    select.replaceChildren();
    for (const [klucz, pozycja] of Object.entries(dane)) {
      const option = document.createElement('option');
      option.value = klucz;
      option.textContent = typeof pozycja === 'string' ? pozycja : pozycja.etykieta;
      select.appendChild(option);
    }
    select.value = wybrany;
  };
  wypelnij('setup-jezyk', JEZYKI, STAN.konfig.jezyk);
  wypelnij('setup-podklad', PODKLADY, STAN.konfig.podklad);
  $('setup-jezyk').addEventListener('change', (e) => { STAN.konfig.jezyk = e.target.value; });
  $('setup-podklad').addEventListener('change', (e) => { zmienPodklad(e.target.value); });
}

/* ------- lista graczy = tożsamość (ADR 0026 aneks, decyzja 2026-09-07) ------ */

/**
 * Lista graczy jest JEDYNYM miejscem, w którym wpisuje się ludzi do gry na tym
 * telefonie: imię + PIN, a „Dodaj gracza" potwierdza imię na wspólnym Drive.
 * `liczbaGraczy` i `imiona` są WYNIKIEM długości listy — pola do wpisywania
 * liczby nie ma, bo myliło się z listą imion i z tożsamością.
 */
function renderujListeGraczy() {
  const imiona = Array.isArray(STAN.konfig.imiona) ? STAN.konfig.imiona : [];
  const lista = $('lista-graczy');
  lista.replaceChildren();
  imiona.forEach((imie, i) => {
    const li = document.createElement('li');
    const kto = document.createElement('span');
    const pewny = STAN.graczeZweryfikowani?.[i] !== false;
    kto.textContent = `${i + 1}. ${imie || `Gracz ${i + 1}`}${pewny ? '' : ' — bez potwierdzenia z Drive'}`;
    li.appendChild(kto);
    const usun = document.createElement('button');
    usun.type = 'button';
    usun.className = 'przycisk przycisk-maly';
    usun.textContent = '✕ Usuń';
    usun.setAttribute('aria-label', `Usuń gracza ${imie || i + 1} z listy`);
    usun.addEventListener('click', () => usunGracza(i));
    li.appendChild(usun);
    lista.appendChild(li);
  });
  STAN.konfig.liczbaGraczy = Math.max(1, imiona.length);
}

/**
 * Pytania na stację idą za liczbą graczy (ADR 0027 część A): każdy gracz
 * odpowiada raz przy każdej stacji, więc pytania muszą dzielić się równo (K22).
 */
function synchronizujPytaniaZGraczami() {
  const graczy = Math.max(1, STAN.konfig.imiona?.length ?? 1);
  const ile = Math.min(graczy, OGRANICZENIA.pytaniaNaStacje.max);
  if (STAN.konfig.pytaniaNaStacje !== ile) {
    STAN.konfig.pytaniaNaStacje = ile;
    $('setup-pytania').value = ile;
  }
}

function usunGracza(indeks) {
  const imiona = [...(STAN.konfig.imiona ?? [])];
  const [usuniete] = imiona.splice(indeks, 1);
  STAN.konfig.imiona = imiona;
  STAN.graczeZweryfikowani = [...(STAN.graczeZweryfikowani ?? [])].filter((_, i) => i !== indeks);
  renderujListeGraczy();
  synchronizujPytaniaZGraczami();
  przeliczPromienZCzasu(); // pytania wchodzą do wzoru na promień (ADR 0025)
  przywrocGraczy();
  status(usuniete ? `„${usuniete}" usunięte z listy graczy.` : 'Lista graczy bez zmian.');
}

/** Klucz i schemat listy graczy zapamiętanej na tym telefonie (ADR 0026 aneks). */
const KLUCZ_GRACZY = 'okolica:gracze';

function czytajGraczyLokalnych() {
  try {
    return walidujGraczyLokalnych(JSON.parse(localStorage.getItem(KLUCZ_GRACZY) ?? 'null'));
  } catch {
    return null; // śmieci w localStorage nie kładą setupu (LESSONS L10)
  }
}

/** Zapamiętuje gracza potwierdzonego na moście — PIN nie jest zapisywany. */
function zapamietajGracza(pseudonim, { zweryfikowany = true } = {}) {
  const imie = normalizujPseudonim(pseudonim);
  if (!imie) return;
  const zapis = czytajGraczyLokalnych();
  const gracze = (zapis?.gracze ?? []).filter((g) => g.pseudonim.toLowerCase() !== imie.toLowerCase());
  gracze.unshift({ pseudonim: imie, zweryfikowany });
  localStorage.setItem(KLUCZ_GRACZY, JSON.stringify({
    schemat: 'gracze-lokalni/1', gracze: gracze.slice(0, MAKS_GRACZY), kiedy: new Date().toISOString(),
  }));
}

/**
 * Zapamiętani gracze wracają jako przyciski: jedno kliknięcie dodaje ich do gry
 * BEZ pytania o PIN (decyzja właściciela 2026-09-07). Kto nie jest jeszcze
 * potwierdzony na tym telefonie, dostaje kursor w polu PIN.
 *
 * `zListy: true` tylko przy starcie aplikacji — wtedy potwierdzeni gracze sami
 * wskakują na listę. Przy każdej późniejszej zmianie (dodanie, usunięcie)
 * funkcja TYLKO przerysowuje przyciski i znaczniki potwierdzenia: bez tego
 * rozróżnienia usunięty gracz wracałby na listę w tej samej chwili.
 */
function przywrocGraczy({ zListy = false } = {}) {
  const zapamietani = czytajGraczyLokalnych()?.gracze ?? [];
  if (zListy) {
    // Zapamiętana lista wraca do gry BEZ pytania o PIN (decyzja właściciela
    // 2026-09-07) — ale tylko gracze potwierdzeni kiedyś na moście; niepewni
    // zostają jako przyciski i wymagają PIN-u.
    for (const g of zapamietani) {
      if (!g.zweryfikowany) continue;
      const juz = (STAN.konfig.imiona ?? []).some((i) => normalizujPseudonim(i).toLowerCase() === g.pseudonim.toLowerCase());
      if (juz || (STAN.konfig.imiona ?? []).length >= MAKS_GRACZY) continue;
      STAN.konfig.imiona = [...(STAN.konfig.imiona ?? []), g.pseudonim];
      STAN.graczeZweryfikowani = [...(STAN.graczeZweryfikowani ?? []), true];
    }
  }
  renderujListeGraczy();
  const wGrze = new Set((STAN.konfig.imiona ?? []).map((i) => normalizujPseudonim(i).toLowerCase()));
  const wolni = zapamietani.filter((g) => !wGrze.has(g.pseudonim.toLowerCase()));
  const pasek = $('lista-zapamietanych');
  pasek.replaceChildren();
  for (const g of wolni) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'przycisk przycisk-maly';
    b.textContent = `➕ ${g.pseudonim}`;
    b.setAttribute('aria-label', `Dodaj zapamiętanego gracza ${g.pseudonim}`);
    b.addEventListener('click', () => { void dodajZapamietanegoGracza(g); });
    pasek.appendChild(b);
  }
  // kto z bieżącej listy jest potwierdzony na tym telefonie — bez ponownego PIN-u
  const pewni = new Map(zapamietani.map((g) => [g.pseudonim.toLowerCase(), g.zweryfikowany]));
  STAN.graczeZweryfikowani = (STAN.konfig.imiona ?? []).map((imie) => (
    pewni.get(normalizujPseudonim(imie).toLowerCase()) ?? (STAN.graczeZweryfikowani?.[(STAN.konfig.imiona ?? []).indexOf(imie)] ?? false)
  ));
  if ((STAN.konfig.imiona ?? []).length) {
    $('profil-stan').textContent = 'Gracze z tego telefonu są już na liście — bez PIN-u. Usuń albo dodaj kolejnego.';
  } else if (zapamietani.length) {
    $('profil-stan').textContent = 'Ten telefon pamięta graczy — dodaj ich jednym kliknięciem (bez PIN-u) albo wpisz nowe imię z PIN-em.';
  }
}

function dodajGraczaDoListy(imie, { zweryfikowany }) {
  STAN.konfig.imiona = [...(STAN.konfig.imiona ?? []), imie];
  STAN.graczeZweryfikowani = [...(STAN.graczeZweryfikowani ?? []), zweryfikowany];
  pokazBledy('bledy-profil', []);
  $('profil-pseudonim').value = '';
  $('profil-pin').value = ''; // PIN nie zostaje w polu (ADR 0013)
  renderujListeGraczy();
  synchronizujPytaniaZGraczami();
  przeliczPromienZCzasu(); // liczba pytań wchodzi do wzoru na promień (ADR 0025)
  przywrocGraczy();
}

/** Zapamiętany i potwierdzony gracz wchodzi jednym kliknięciem, bez PIN-u. */
async function dodajZapamietanegoGracza(zapamietany) {
  if (!zapamietany?.zweryfikowany) {
    $('profil-pseudonim').value = zapamietany?.pseudonim ?? '';
    $('profil-pin').value = '';
    pokazBledy('bledy-profil', [{ komunikat: 'Ten gracz nie był jeszcze potwierdzony na tym telefonie — wpisz jego PIN.' }]);
    $('profil-pin').focus?.();
    return false;
  }
  if ((STAN.konfig.imiona ?? []).length >= MAKS_GRACZY) {
    pokazBledy('bledy-profil', [{ komunikat: `Maksymalnie ${MAKS_GRACZY} graczy na jednym telefonie.` }]);
    return false;
  }
  dodajGraczaDoListy(zapamietany.pseudonim, { zweryfikowany: true });
  status(`„${zapamietany.pseudonim}" dodany do gry — ten telefon już go potwierdził.`);
  return true;
}

/**
 * „➕ Dodaj gracza": jedno wołanie `profil-ustaw` robi całą robotę — wolne imię
 * zakłada profil z tym PIN-em, zajęte wymaga PIN-u właściciela, a zły PIN to
 * odmowa R20 i gracz NIE trafia na listę. Most, który nie odpowiada, nie
 * blokuje gry (ADR 0016 pkt 5) — gracz wchodzi bez potwierdzenia, a komunikat
 * mówi wprost, że historia nie zostanie zapisana.
 */
async function dodajGracza() {
  const przycisk = $('przycisk-dodaj-gracza');
  if (przycisk.disabled) return false; // jedno kliknięcie = jedno żądanie
  const pseudo = normalizujPseudonim($('profil-pseudonim').value);
  const pin = ($('profil-pin').value ?? '').trim();
  const odmowa = (komunikat, pole = 'profil-pin') => {
    pokazBledy('bledy-profil', [{ komunikat }]);
    $(pole).focus?.();
    return false;
  };
  if (!pseudo) return odmowa('Wpisz imię gracza — trafia do historii gier i rankingów.', 'profil-pseudonim');
  if ((STAN.konfig.imiona ?? []).length >= MAKS_GRACZY) {
    return odmowa(`Maksymalnie ${MAKS_GRACZY} graczy na jednym telefonie.`, 'profil-pseudonim');
  }
  if ((STAN.konfig.imiona ?? []).some((i) => normalizujPseudonim(i).toLowerCase() === pseudo.toLowerCase())) {
    return odmowa(`„${pseudo}" jest już na liście graczy.`, 'profil-pseudonim');
  }
  if (!czyPinPoprawny(pin)) {
    return odmowa('PIN to 4–8 cyfr. Nowe imię dostaje nowy PIN, zajęte wymaga PIN-u właściciela.');
  }

  const url = adresMostu();
  przycisk.disabled = true;
  try {
    if (!url) {
      dodajGraczaDoListy(pseudo, { zweryfikowany: false });
      $('profil-stan').textContent = 'Ta wersja aplikacji nie ma adresu mostu — gracz dodany, ale historia i rankingi nie zostaną zapisane.';
      status(`„${pseudo}" dodany bez potwierdzenia (brak adresu mostu).`);
      return true;
    }
    status(`Sprawdzam imię „${pseudo}" na wspólnym Drive…`);
    let wynik;
    try {
      wynik = await polecenieMostu(url, { akcja: 'profil-ustaw', pseudonim: pseudo, pin });
    } catch (e) {
      if (e?.odmowaMostu) return odmowa(komunikatBleduProfilu(String(e.message ?? '').trim()));
      dodajGraczaDoListy(pseudo, { zweryfikowany: false });
      $('profil-stan').textContent = 'Drive nie odpowiada — gracz dodany bez potwierdzenia. Historia i rankingi z tej gry nie zostaną zapisane; spróbuj przy następnej grze.';
      status('Nie udało się sprawdzić imienia na Drive — gracz dodany lokalnie.');
      return true;
    }
    const imie = wynik.pseudonim || pseudo;
    zapamietajGracza(imie);
    dodajGraczaDoListy(imie, { zweryfikowany: true });
    $('profil-stan').textContent = wynik.nowy
      ? `Nowy profil „${imie}" założony z tym PIN-em. Dodaj kolejnego gracza albo przejdź dalej.`
      : `„${imie}" potwierdzone PIN-em — witaj z powrotem. Dodaj kolejnego gracza albo przejdź dalej.`;
    status(wynik.nowy
      ? `Założono profil „${imie}" — historia i rankingi tego gracza są na wspólnym Drive.`
      : `To Ty — „${imie}" potwierdzone PIN-em.`);
    return true;
  } finally {
    przycisk.disabled = false;
  }
}

/**
 * BRAMA tożsamości ekranu 1 (ADR 0026): na ekran 2 przechodzi się z co
 * najmniej jednym graczem na liście. Same imiona są już sprawdzone — każde
 * przeszło przez `profil-ustaw` przy dodawaniu (albo przez zapamiętanie na tym
 * telefonie), więc brama tylko pilnuje, żeby lista nie była pusta, i mówi
 * wprost, gdy któryś gracz nie ma potwierdzenia z Drive.
 */
async function bramkaTozsamosci() {
  const imiona = (STAN.konfig.imiona ?? []).map((i) => normalizujPseudonim(i)).filter(Boolean);
  if (!imiona.length) {
    const komunikat = 'Dodaj co najmniej jednego gracza: imię i PIN, potem „➕ Dodaj gracza".';
    pokazBledy('bledy-profil', [{ komunikat }]);
    $('profil-stan').textContent = komunikat;
    $('profil-pseudonim').focus?.();
    return false;
  }
  const bezPotwierdzenia = imiona.filter((_, i) => STAN.graczeZweryfikowani?.[i] === false);
  pokazBledy('bledy-profil', []);
  if (bezPotwierdzenia.length) {
    $('profil-stan').textContent = `Grasz lokalnie: ${bezPotwierdzenia.join(', ')} ${bezPotwierdzenia.length === 1 ? 'nie ma' : 'nie mają'} potwierdzenia z Drive — historia i rankingi z tej gry nie zostaną zapisane.`;
    status('Część graczy bez potwierdzenia z Drive — grasz lokalnie.');
  }
  return true;
}

/* ------ wynik gry hot-seat na wspólnym Drive (ADR 0026 aneks) -------------- */

/** Klucze localStorage kolejki i rejestru wysłanych (schematy w `wieloosobowa.js`). */
const KLUCZ_KOLEJKI_HOTSEAT = 'okolica:hotseat-kolejka';
const KLUCZ_WYSLANYCH_HOTSEAT = 'okolica:hotseat-wyslane';
const MAKS_KOLEJKA_HOTSEAT = 5;
const MAKS_REJESTR_WYSLANYCH = 30;

function czytajKolejkeHotseat() {
  try {
    return walidujKolejkeHotseat(JSON.parse(localStorage.getItem(KLUCZ_KOLEJKI_HOTSEAT) ?? 'null'));
  } catch {
    return []; // śmieci w localStorage nie kładą aplikacji (LESSONS L10)
  }
}

function zapiszKolejkeHotseat(gry) {
  if (!gry.length) {
    localStorage.removeItem(KLUCZ_KOLEJKI_HOTSEAT);
    return;
  }
  localStorage.setItem(KLUCZ_KOLEJKI_HOTSEAT, JSON.stringify({ schemat: SCHEMAT_KOLEJKI_HOTSEAT, gry: gry.slice(-MAKS_KOLEJKA_HOTSEAT) }));
}

function czytajWyslaneHotseat() {
  try {
    return walidujWyslaneHotseat(JSON.parse(localStorage.getItem(KLUCZ_WYSLANYCH_HOTSEAT) ?? 'null'));
  } catch {
    return [];
  }
}

function zaznaczWyslanyHotseat(klucz) {
  const klucze = [...czytajWyslaneHotseat().filter((k) => k !== klucz), klucz];
  localStorage.setItem(KLUCZ_WYSLANYCH_HOTSEAT, JSON.stringify({ schemat: SCHEMAT_WYSLANYCH_HOTSEAT, klucze: klucze.slice(-MAKS_REJESTR_WYSLANYCH) }));
}

/**
 * Odcisk gry: kod (pusty w grze lokalnej) + chwila startu + skład. Zapis gry
 * odświeża się przy każdej tranzycji, a wynik ma trafić na Drive RAZ — bez tego
 * klucza ta sama gra weszłaby do rankingów tyle razy, ile razy się zapisała.
 */
function kluczGryHotseat(r) {
  return [String(r.kodGry || 'gra'), Number(r.startMs) || 0, (r.gracze ?? []).map((g) => g.imie).join(',')].join('|');
}

/**
 * Czy jest dokąd zapisać wynik: potrzebny choć jeden gracz potwierdzony
 * profilem na Drive. Zapis jest DOMYŚLNY i nie pytamy o niego przy każdej
 * grze (właściciel, 2026-09-07) — co i dokąd trafia, opisuje sekcja „Dane
 * i prywatność".
 */
function czyWysylacWynikHotseat() {
  return (STAN.graczeZweryfikowani ?? []).some(Boolean);
}

/** Polecenie `gra-hotseat` z bieżącej rozgrywki (fakty, nie gotowe punkty). */
function polecenieHotseat() {
  const r = STAN.rozgrywka;
  if (!r) return { ok: false, usterki: ['brak zakończonej gry'] };
  return graHotseatDoWysylki({
    miejsce: STAN.miejsce || 'nieznane miejsce',
    // geohash5 STARTU gry — tak samo jak w konfiguracji gry wieloosobowej
    // (ADR 0019 pkt 3): przybliżenie okolicy, nie punkt gracza.
    geohash5: Number.isFinite(r.start?.lat) ? geohash(r.start.lat, r.start.lon, 5) : '',
    wiek: STAN.konfig.wiek,
    tematy: STAN.konfig.tematy,
    liczbaStacji: r.stacje.length,
    pytaniaNaStacje: STAN.konfig.pytaniaNaStacje,
    gracze: (r.gracze ?? []).map((g) => ({ id: g.id, pseudonim: g.imie })),
    dziennik: r.dziennik,
    // Ten sam odcisk gry co lokalny rejestr wysłanych — most po nim rozpoznaje
    // powtórkę i nie zakłada drugiego pliku (zgłoszenie właściciela 2026-09-09).
    kluczGry: kluczGryHotseat(r),
  });
}

/**
 * Koniec gry na tym telefonie = wynik na wspólnym Drive (decyzja właściciela
 * 2026-09-07). Punkty liczy most z przesłanych faktów, więc rankingi hot-seat
 * i gier wieloosobowych są jednymi rankingami. Awaria sieci niczego nie gubi:
 * polecenie czeka w kolejce i leci przy następnym uruchomieniu (ADR 0016 pkt 5).
 */
/** Komunikat o wysyłce idzie na WŁASNĄ linię wyniku, nie na wspólny `#status`. */
function stanWysylkiWyniku(tekst) {
  const linia = $('wynik-drive');
  if (linia) linia.textContent = tekst;
}

async function wyslijWynikHotseat() {
  if (STAN.multi) return; // gra wieloosobowa ma wyniki na moście z urzędu (ADR 0019)
  if (!czyWysylacWynikHotseat()) {
    stanWysylkiWyniku('Wynik został na telefonie — żaden gracz nie ma potwierdzonego profilu, więc historia i rankingi z tej gry nie zostaną zapisane.');
    return;
  }
  const r = STAN.rozgrywka;
  const klucz = kluczGryHotseat(r);
  if (czytajWyslaneHotseat().includes(klucz)) return; // ta gra już pojechała
  const bud = polecenieHotseat();
  if (!bud.ok) {
    stanWysylkiWyniku(`Wynik został na telefonie: ${bud.usterki.join('; ')}.`);
    return;
  }
  zaznaczWyslanyHotseat(klucz); // raz na grę — niezależnie od wyniku wysyłki
  const url = adresMostu();
  if (!url) {
    stanWysylkiWyniku('Wynik został na telefonie — ta wersja aplikacji nie ma adresu mostu Drive.');
    return;
  }
  stanWysylkiWyniku('Wysyłam wynik na wspólny Drive…');
  try {
    await polecenieMostu(url, bud.polecenie);
    stanWysylkiWyniku('☁ Wynik jest na wspólnym Drive — punkty graczy weszły do rankingów.');
  } catch (e) {
    // Kolejka zostaje w obu przypadkach, ale powód musi być prawdziwy: jawna
    // odmowa mostu (np. skrypt w Apps Script bez akcji `gra-hotseat`) to nie
    // awaria sieci — patrz kontrakt `polecenieMostu` w app/sync.js.
    zapiszKolejkeHotseat([...czytajKolejkeHotseat(), bud.polecenie]);
    stanWysylkiWyniku(e?.odmowaMostu
      ? `Wynik został na telefonie — most Drive odmówił: ${String(e.message ?? 'nieznany powód')}. Wynik czeka w kolejce i poleci, gdy most przyjmie akcję gra-hotseat (w Apps Script potrzebna jest aktualna wersja skryptu).`
      : 'Drive nie odpowiedział — wynik czeka w kolejce i poleci przy najbliższym uruchomieniu aplikacji.');
  }
}

/** Start aplikacji: wyniki z kolejki jadą na Drive (bez nich rankingi byłyby dziurawe). */
async function oproznijKolejkeHotseat() {
  const url = adresMostu();
  if (!url) return;
  const gry = czytajKolejkeHotseat();
  if (!gry.length) return;
  const zostaly = [];
  let doszlo = 0;
  let odmowa = null;
  for (const polecenie of gry) {
    try {
      await polecenieMostu(url, polecenie);
      doszlo += 1;
    } catch (e) {
      zostaly.push(polecenie); // zostanie na później
      if (e?.odmowaMostu) odmowa = String(e.message ?? 'nieznany powód'); // jawna odmowa, nie awaria sieci
    }
  }
  zapiszKolejkeHotseat(zostaly);
  if (doszlo) status(`Wyniki gier z kolejki (${doszlo}) doszły na wspólny Drive — rankingi są pełne.`);
  if (odmowa) {
    status(`Most Drive odmówił przyjęcia ${zostaly.length} wyników z kolejki: ${odmowa}. Zostaną ponowione przy następnym uruchomieniu — w Apps Script potrzebna jest aktualna wersja skryptu mostu.`);
  }
}

/**
 * Nasłuchy pól setupu podpina się RAZ (LESSONS L14): renderujSetup() odpala
 * i przy starcie, i przy wznowieniu gry — bez strażnika każdy input/select
 * dostałby drugi handler (m.in. podwójne przebudowy list i statusy).
 */
let setupNasluchyPodpiete = false;

/**
 * Promień gry jest WYNIKIEM, nie polem (ADR 0025): organizator wpisuje, ile ma
 * czasu, a promień liczy się z czasu, sposobu poruszania i liczby pytań
 * (`przeliczenieCzasu` w konfig.js). Akapit `#setup-promien-info` pokazuje
 * składowe, żeby liczba nie była magią (LESSONS L6).
 */
function przeliczPromienZCzasu() {
  const k = STAN.konfig;
  const r = przeliczenieCzasu({
    czasGryMin: k.czasGryMin, tryb: k.tryb,
    liczbaStacji: k.liczbaStacji, pytaniaNaStacje: k.pytaniaNaStacje,
  });
  k.promienM = r.promienM;
  const info = $('setup-promien-info');
  if (!info) return;
  const minuty = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  const odleglosc = (m) => (m >= 1000 ? `${minuty(m / 1000)} km` : `${Math.round(m)} m`);
  info.textContent = Number.isFinite(k.czasGryMin)
    // Krótko: setup ma się mieścić na 360 px bez przewijania (WORKFLOW §4.2).
    ? `Promień gry: ${odleglosc(r.promienM)} (z ${k.czasGryMin} min: ${r.pytania} ${r.pytania === 1 ? 'pytanie' : 'pytań'} ≈ ${minuty(r.czasOdpowiedziMin)} min, droga ≈ ${minuty(r.czasDrogiMin)} min, trasa ≈ ${odleglosc(r.trasaM)}).`
    : 'Wpisz planowany czas gry — promień policzy się z niego sam.';
}

function renderujSetup() {
  const k = STAN.konfig;
  $('setup-czas').value = k.czasGryMin;
  $('setup-stacje').value = k.liczbaStacji;
  $('setup-pytania').value = k.pytaniaNaStacje;
  $('setup-czas').min = OGRANICZENIA.czasGryMin.min;
  $('setup-czas').max = OGRANICZENIA.czasGryMin.max;
  przeliczPromienZCzasu();

  // Wartości pól odświeżamy za każdym razem, nasłuchy — tylko raz (L14).
  if (setupNasluchyPodpiete) return;
  setupNasluchyPodpiete = true;

  const czytajLiczbe = (idPola, pole) => $(idPola).addEventListener('input', (e) => {
    const v = Number(e.target.value);
    STAN.konfig[pole] = Number.isFinite(v) ? v : null;
    przeliczPromienZCzasu(); // czas, stacje i pytania wchodzą do wzoru (ADR 0025)
  });
  czytajLiczbe('setup-czas', 'czasGryMin');
  czytajLiczbe('setup-stacje', 'liczbaStacji');
  czytajLiczbe('setup-pytania', 'pytaniaNaStacje');
  $('przycisk-dodaj-gracza').addEventListener('click', () => { void dodajGracza(); });

  $('geokodacja-zapasowa').addEventListener('change', (e) => {
    localStorage.setItem('okolica:geokodacja-zapasowa', e.target.checked ? '1' : '0');
    status(e.target.checked
      ? 'Warstwa zapasowa nazwy miejsca (Nominatim) włączona — jedno żądanie, tylko gdy Overpass nie da nazwy. © OpenStreetMap (ODbL).'
      : 'Warstwa zapasowa nazwy miejsca (Nominatim) wyłączona — tak jest domyślnie.');
  });
}

function czytajSetupZDomu() {
  // imiona i liczba graczy nie mają pól: żyją w liście graczy (`STAN.konfig`)
  return STAN.konfig;
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
  // Karta propozycji paczek żyje na ekranie pozycji (`#zestawy-karta`
  // w `#ekran-pozycja`). `pokazPozycje()` jest wołane przy KAŻDYM fixie, a fixy
  // w grze lecą cały czas — bez tej bramki cała rozgrywka to seria zapytań do
  // mostu o indeks, którego nikt wtedy nie ogląda: bateria, transfer i limit
  // kwoty Apps Script idą w błoto (ADR 0013: żadnych zbędnych żądań).
  if (STAN.ekran === 'pozycja') odswiezPropozycjeZestawow();
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
    opcje: PROFILE_GPS[STAN.profilGps] ?? PROFILE_GPS.dokladny, // M10/T3: bateria
    onFix: (fix) => przyjmijFix(fix),
    onBlad: (blad) => {
      pokazBledy('bledy-pozycja', [{ kod: blad.kod, pole: 'geolocation', komunikat: blad.komunikat }]);
      $('pozycja-status').textContent = 'Brak pozycji';
      status('Położenie niedostępne — gra czeka na sygnał. Wyjdź na otwartą przestrzeń, a jeśli stacja jest nieosiągalna, pomiń odcinek.' + ADR(' (ADR 0029)'));
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
  STAN.mapy.gra = utworzMape({ id: 'mapa-gra', podklad, zoom: 16 });
  // Zadanie właściciela D3: w trybie testowym krótkie stuknięcie mapy pozycji
  // ustawia pozycję — najszybsza droga „pinezki tam, gdzie się chce", bez
  // przepisywania współrzędnych. Bramka trybu i ekranu: stuknięcie w mapę
  // gry ani stacji NIE przestawia gracza.
  if (STAN.mapy.pozycja) {
    STAN.mapy.pozycja.ustawNasluchStukniecia((geo) => {
      if (!STAN.trybTestowy || STAN.ekran !== 'pozycja') return;
      $('setup-lat').value = String(geo.lat);
      $('setup-lon').value = String(geo.lon);
      ustawPozycjeRecznie(geo.lat, geo.lon, { zMapy: true });
    });
  }
}

function kazdaMapa(fn) {
  for (const mapa of Object.values(STAN.mapy)) if (mapa) fn(mapa);
}

/**
 * Ręczna pozycja z pól tekstowych ALBO ze stuknięcia mapy (zadanie D3).
 * Współrzędne parsuje `geo.parsujWspolrzedne`: dziesiętne (kropka albo polski
 * przecinek), DMS z Google Maps (`52°07'22.9"N`) i pełna para w jednym polu.
 * Odmowa jest jawna ([P06] pod polami) — nigdy cichego „Null Island"
 * (`Number('') === 0`), a zakres sprawdza dalej `ocenFix` (jedno źródło).
 */
function ustawPozycjeRecznie(surowyLat, surowyLon, { zMapy = false } = {}) {
  const wynik = parsujWspolrzedne(surowyLat, surowyLon);
  if (!wynik.ok) {
    pokazBledy('bledy-pozycja', [{ kod: 'P06', pole: 'wspolrzedne', komunikat: wynik.komunikat }]);
    return false;
  }
  const fix = fixZPozycji({ lat: wynik.lat, lon: wynik.lon, accuracy: null }, performance.now(), ZRODLA_FIXA.reczne);
  const ocena = ocenFix(fix);
  if (!ocena.akceptowany) {
    pokazBledy('bledy-pozycja', [{ kod: ocena.kod, pole: 'wspolrzedne', komunikat: 'Wpisz szerokość od -90 do 90 i długość od -180 do 180 (stopnie dziesiętne albo format Google Maps, np. 52°07\'22.9"N).' }]);
    return false;
  }
  STAN.ostatniFix = fix;
  STAN.ocenaFixa = ocena;
  STAN.pozycja = { lat: fix.lat, lon: fix.lon };
  STAN.dokladnoscM = fix.accuracy;
  pokazBledy('bledy-pozycja', []);
  pokazPozycje();
  status(zMapy ? 'Pozycja ustawiona z mapy.' : 'Pozycja ustawiona ręcznie.');
  return true;
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
  aktualizujGreNaFix(fix); // M6: ten sam lej co GPS i symulacja — gra widzi fixy identycznie
}

/* --------------------------------------------------- symulacja dojścia */

/** Odtwarzanie: jeden fix co tyle ms (tylko tryb testowy, ADR 0004 pkt 6). */
const SYMULACJA_KROK_MS = 120;
/** Próba dojścia: 250 m na azymucie 45°, 12 s „marszu", fix co 2 s + postój. */
const SYMULACJA = { dystansM: 250, bearing: 45, czasMs: 12000, coMs: 2000, accuracyM: 12 };

/** Symulacja ustępuje grze: poza odcinkiem (dojście, pauza, ręczny koniec) nie
 *  odtwarzamy dalej i NIE nadpisujemy statusu gry (M6/R7 — fix „po tranzycji"
 *  czyścił historię i zamazywał „Stacja osiągnięta"). Poza grą (setup) warunek
 *  jest przezroczysty: `STAN.rozgrywka` wtedy nie istnieje. */
function symulacjaPrzestalaBycPotrzebna() {
  const r = STAN.rozgrywka;
  return Boolean(r) && (r.faza !== FAZY.odcinek || STAN.graPauza || STAN.graZakonczonaRecznie);
}

/** Jeden fix symulacji: stan, mapa i zdanie o dystansie do celu. */
function krokSymulacji() {
  const s = STAN.symulacja;
  if (!s) return;
  if (symulacjaPrzestalaBycPotrzebna()) {
    zatrzymajSymulacje();
    return;
  }
  const fix = s.fixy[s.indeks];
  if (!fix) {
    zatrzymajSymulacje();
    status('Symulacja zakończona.');
    return;
  }
  s.indeks += 1;
  przyjmijFix(fix);
  if (symulacjaPrzestalaBycPotrzebna()) {
    zatrzymajSymulacje(); // ten fix domknął dojście — status gry zostaje
    return;
  }
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

/** Klucz cache sieci dla bieżącej pozycji, promienia i trybu (ADR 0010 pkt 1). */
function kluczSieci() {
  return kluczCacheSieci({ lat: STAN.pozycja.lat, lon: STAN.pozycja.lon, promienM: STAN.konfig.promienM, tryb: STAN.konfig.tryb });
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
 * Wyświetlenie nazwy miejsca (zawsze pobierana — ADR 0013 pkt 3 po poprawce
 * z Partii 2) oraz atrybucją ODbL, gdy miejsce pochodzi z warstwy zapasowej
 * Nominatim (ASSETS §3).
 */
function renderujMiejsce() {
  const pole = $('pozycja-miejsce');
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
  if (!STAN.pozycja || STAN.miejsce) return;
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

const KLUCZ_SPRAWNEJ_INSTANCJI = 'okolica:overpass-sprawny';

/** Adres instancji, która dowiozła ostatnio — albo null (kolejność domyślna). */
function czytajSprawnaInstancje() {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(KLUCZ_SPRAWNEJ_INSTANCJI);
  } catch {
    return null;
  }
}

function zapiszSprawnaInstancje(url) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KLUCZ_SPRAWNEJ_INSTANCJI, url);
  } catch {
    /* brak pamięci — następna gra zacznie od FOSSGIS jak dawniej */
  }
}

/**
 * Pobranie sieci z łańcucha instancji (ASSETS §2): sekwencyjnie, timeout
 * 20 s przez `AbortController`, budżet 8 MB na cache. Pauza 30 s TYLKO po
 * odpowiedzi 406/429/5xx (tego wymaga polityka FOSSGIS); timeout/brak
 * odpowiedzi to MARTWA instancja — przełączenie jest OD RAZU, bo nie ma
 * kogo szanować pauzą (decyzja 2026-09-07: koniec ~100 s czekania).
 * Sprawna instancja ląduje w pamięci telefonu i następna gra próbuje ją
 * pierwszą (`kolejnoscInstancji`). `fetch` czytany w chwili wywołania,
 * więc test może podstawić atrapę po imporcie aplikacji.
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
  const lancuch = kolejnoscInstancji(czytajSprawnaInstancje());
  for (let i = 0; i < lancuch.length; i++) {
    const instancja = lancuch[i];
    const ostatnia = i === lancuch.length - 1;
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
      zapiszSprawnaInstancje(instancja.url);
      return true;
    } catch (blad) {
      const przelacz = !ostatnia && czyPrzelaczycInstancje({
        status: blad?.status ?? null,
        timeout: blad?.name === 'AbortError',
        bladSieci: blad?.name === 'TypeError' || blad?.name === 'NetworkError',
      });
      if (przelacz) {
        // Martwa instancja (timeout/abort/błąd sieci): przełączenie OD RAZU,
        // bez pauzy — pauza 30 s należy się tylko limitom (429/406/5xx).
        status(`${instancja.nazwa} nie odpowiada — próbuję kolejną instancję.`);
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
      // Sieć bywa za uboga na zamówioną liczbę stacji (S12): wybrane stacje SĄ
      // wtedy składem gry, więc konfiguracja IDZIE ZA NIMI. Bez tego setup mówił
      // „5", mapa pokazywała 4, a budowa promptu stawała na WE06 (właściciel,
      // 2026-09-07). Paczka i gra wieloosobowa też porównują te dwie liczby.
      const zamowione = STAN.konfig.liczbaStacji;
      if (wynik.stacje.length !== zamowione) {
        STAN.konfig.liczbaStacji = wynik.stacje.length;
        $('setup-stacje').value = String(wynik.stacje.length);
        przeliczPromienZCzasu(); // mniej stacji = dłuższy odcinek na ten sam czas (ADR 0025)
        pokazBledy('bledy-stacje', [{
          kod: 'S12',
          pole: 'siec',
          komunikat: `Sieć drogowa w tej okolicy nie dała ${zamowione} stacji w wymaganych odstępach — jest ich ${wynik.stacje.length} i tyle będzie w grze (setup zmieniony na ${wynik.stacje.length}). Chcesz ${zamowione}? Zwiększ czas gry, żeby powiększyć promień, albo zmień okolicę.`,
        }]);
      } else {
        pokazBledy('bledy-stacje', []);
      }
      renderujStacje();
      odswiezWarstwy();
      centrujNaPozycji();
      status(wynik.usterki.length
        ? `Sieć jest za uboga na ${zamowione} stacji — w grze będzie ${wynik.stacje.length} (kod S12). Zwiększ czas gry albo zmień okolicę, jeśli chcesz komplet.`
        : `Stacje z sieci drogowej: ${wynik.stacje.length} punktów osiągalnych w promieniu ${STAN.konfig.promienM} m.`);
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
  $('stacje-ladowanie').hidden = false;
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
    $('stacje-ladowanie').hidden = true;
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
    // Opis stacji bywa nazwą z OSM (`tags.name` przez `dopiszMiasto`), czyli
    // tekstem z zewnątrz — do DOM idzie przez textContent, nigdy przez
    // innerHTML (wstrzyknięty znacznik wykonałby się w aplikacji).
    const numer = document.createElement('span');
    numer.classList.add('numer');
    numer.textContent = String(s.id);
    const kod = document.createElement('span');
    kod.classList.add('kod');
    kod.textContent = `${formatujWspolrzedne(s.lat, s.lon)} · ${s.bearing}°`;
    const opisEl = document.createElement('span');
    opisEl.classList.add('opis');
    opisEl.textContent = opis;
    opisEl.append(document.createElement('br'), kod);
    const dystansEl = document.createElement('span');
    dystansEl.classList.add('dystans');
    dystansEl.textContent = dystans;
    li.append(numer, opisEl, dystansEl);
    return li;
  }));
  if (sieciowe) {
    const w = STAN.wynikSieci;
    $('stacje-sprawiedliwosc').textContent = `sieciowo: pierścień ${w.pierscien.r} m (pasmo ${w.pierscien.pasmo[0]}–${w.pierscien.pasmo[1]} m) · najmniejszy odstęp ${najmniejszyOdstepM(STAN.stacje)} m`;
    const miejsce = STAN.miejsce ? ` · miejsce: ${STAN.miejsce}` : '';
    const cache = STAN.siec.zCache ? ' (z pamięci telefonu — Overpass nie został wywołany)' : '';
    $('stacje-tryb').textContent = `${ZRODLA_STACJI.siec}${cache}${miejsce}.`;
    $('przycisk-pierścien').hidden = false;
    $('przycisk-reczne').hidden = true;
    // Sieć z cache (telefon pamięta okolicę) daje ponowienie — świeże pobranie
    // omija cache; przy danych sprzed chwili przycisk nie ma sensu.
    $('przycisk-siec-ponow').hidden = !STAN.siec.zCache;
  } else {
    $('stacje-sprawiedliwosc').textContent = `losowo w promieniu ${STAN.konfig.promienM} m · najmniejszy odstęp między stacjami ${najmniejszyOdstepM(STAN.stacje)} m`;
    $('stacje-tryb').textContent = STAN.wymusPierscien
      ? `${ZRODLA_STACJI.pierscien} — wymuszony przyciskiem. ${STAN.siec.stan === 'gotowa' ? 'Sieć drogowa jest pobrana: wyłącz tryb uproszczony tym samym przyciskiem.' : 'Sieć drogowa niedostępna (offline albo limit Overpass).'}`
      : `${ZRODLA_STACJI.pierscien}. Stacje z sieci dróg, placów i szlaków pojawią się po pobraniu danych Overpass — wymaga połączenia z internetem.` + ADR(' (ADR 0005)');
    if (STAN.trybReczny) {
      $('stacje-tryb').textContent += ' Tryb ręczny WŁĄCZONY: przeciągnij pinezki na mapie. Dystans pokazujemy tylko w linii prostej — osiągalność niezweryfikowana.';
    } else if (STAN.stacje.some((s) => s.zrodlo === 'reczne')) {
      $('stacje-tryb').textContent += ` Część stacji ${ZRODLA_STACJI.reczne} — dystans w linii prostej.`;
    }
    $('przycisk-pierścien').hidden = STAN.siec.stan !== 'gotowa';
    $('przycisk-reczne').hidden = false;
    $('przycisk-siec-ponow').hidden = STAN.siec.stan === 'gotowa';
  }
}

/* --------------------------------------------------------- M6: ekran gry */

/**
 * Zegar gry: `performance.now()` pomniejszony o skumulowane pauzy. Logika
 * rozgrywki nie czyta zegara (ADR 0004 pkt 3) — wszystkie `czasMs` pochodzą
 * z tej warstwy, więc pauza naprawdę zatrzymuje czas odcinków.
 */
function zegarGry() {
  const teraz = performance.now();
  const wTrakciePauzy = STAN.graPauza && STAN.graPauzaStartMs > 0 ? teraz - STAN.graPauzaStartMs : 0;
  return teraz - (STAN.pauzaSkumulowanaMs + wTrakciePauzy);
}

/**
 * Fix w trakcie gry (M6): dystans na żywo do bieżącej stacji i rozstrzygnięcie
 * dojścia przez `stanDojscia` (próg + dwa kolejne trafienia, ADR 0004 pkt 2).
 * Działa identycznie z GPS-em i z symulacją, bo oba strumienie wchodzą jednym
 * lejem `przyjmijFix`.
 */
function aktualizujGreNaFix(fix) {
  const r = STAN.rozgrywka;
  if (!r || r.faza === FAZY.koniec || STAN.ekran !== 'gra' || STAN.graPauza) return;
  const pod = podglad(r);
  if (!pod.stacja || !STAN.pozycja) return;
  const dystans = Math.round(odlegloscM(STAN.pozycja, pod.stacja));
  $('gra-dystans').textContent = `${dystans} m`;
  if (r.faza !== FAZY.odcinek) return;
  const d = stanDojscia(STAN.historiaFixow, pod.stacja);
  $('gra-dystans-odcinka').textContent = d.dystansM == null ? '— m' : `${Math.round(d.dystansM)} m do stacji ${pod.stacja.id}`;
  $('gra-prog-dojscia').textContent = `próg dojścia: ${Math.round(d.progM)} m · trafienia: ${d.trafienia}/${d.wymagane}`;
  dostosujProfilGps(d.dystansM); // M10/T3: „budzenie przy zbliżaniu"
  if (d.kod) {
    $('gra-komunikat').textContent = d.komunikat;
    return;
  }
  if (d.dotarl) zakonczOdcinekGry(TRYBY_DOJSCIA.gps, fix);
}

/**
 * Render faz ekranu gry: badge'y zawsze; panele tylko przy `panele: true`.
 * Po odpowiedzi model bywa już w następnej fazie, ale gracz musi NAJPIERW
 * przeczytać ocenę, wyjaśnienie i źródła — przełączanie paneli czeka wtedy
 * na „Następna stacja" (plan M6/R5).
 */
function renderujGre({ panele = true } = {}) {
  const r = STAN.rozgrywka;
  if (!r) return;
  const pod = podglad(r);
  const indeks = r.stacje.findIndex((s) => s.id === r.biezacaStacja);

  $('gra-kolejka').textContent = pod.gracz ? `Kolej: ${pod.gracz.imie}` : 'Kolej: —';
  $('gra-postep').textContent = r.faza === FAZY.koniec
    ? `zaliczone: ${pod.zaliczoneStacje} · pominięte: ${pod.pominietaStacje} · z ${r.stacje.length}`
    : `stacja ${indeks + 1} z ${r.stacje.length}`;
  if (STAN.pozycja && pod.stacja) {
    $('gra-dystans').textContent = `${Math.round(odlegloscM(STAN.pozycja, pod.stacja))} m`;
  } else {
    $('gra-dystans').textContent = '— m';
  }

  if (panele) {
    const koniec = r.faza === FAZY.koniec || STAN.graZakonczonaRecznie;
    $('gra-panel-oczekuje').hidden = koniec || r.faza !== FAZY.przygotowanie;
    $('gra-panel-odcinek').hidden = koniec || r.faza !== FAZY.odcinek;
    $('gra-panel-pytanie').hidden = koniec || r.faza !== FAZY.pytanie;
    $('gra-panel-koniec').hidden = !koniec;
    if (koniec) pokazWyniki();
  }

  if (panele && r.faza === FAZY.przygotowanie && pod.stacja) {
    $('gra-kto-idzie').textContent = pod.gracz ? `Idzie: ${pod.gracz.imie} → stacja ${indeks + 1}` : `Stacja ${indeks + 1}`;
    $('gra-cel-stacji').textContent = `${pod.stacja.opis || 'Cel bez opisu'} · ${formatujWspolrzedne(pod.stacja.lat, pod.stacja.lon)} · ${Math.round(pod.dystansM)} m ${pod.dystansSieciowy ? 'drogą' : 'w linii prostej'} od poprzedniego punktu`;
    $('przycisk-start-odcinka').textContent = `▶ Idę do stacji ${indeks + 1}`;
  }

  if (panele) {
    $('przycisk-start-odcinka').disabled = STAN.graPauza;
    $('przycisk-symulacja-gra').hidden = !(STAN.trybTestowy && r.faza === FAZY.odcinek);
    $('przycisk-pomin-stacje').disabled = r.faza !== FAZY.odcinek || STAN.graPauza; // ADR 0015 pkt 2: tylko w drodze
  }

  if (STAN.mapy.gra) {
    STAN.mapy.gra.zaznaczStacje(STAN.stacje, { promienM: STAN.konfig.promienM, aktywna: r.biezacaStacja });
  }
  if (STAN.multi) renderujPanelMulti(); // M11/P4: tury, żywe wyniki, pasek synchronizacji
}

/* ---------------- M9/R3: repozytorium paczek (ADR 0017) ---------------- */

/** Rejestr zestawów z `localStorage` (tolerancyjnie: śmieć = pusta lista). */
function czytajRejestrZestawow() {
  if (typeof localStorage === 'undefined') return nowyRejestr();
  const { rejestr } = walidujRejestrSurowy(localStorage.getItem(KLUCZ_REJESTRU) ?? '');
  return rejestr;
}

/** Meta dopasowania z bieżącej konfiguracji i pozycji (wspólna dla zapisu i eksportu). */
function metaBiezacejOkolicy() {
  return zbierzMetaZestawu({
    lat: STAN.pozycja.lat,
    lon: STAN.pozycja.lon,
    promienM: STAN.konfig.promienM,
    tematy: STAN.konfig.tematy,
    wiek: STAN.konfig.wiek,
    jezyk: STAN.konfig.jezyk,
    miejsce: STAN.miejsce ?? '',
    liczbaStacji: STAN.konfig.liczbaStacji,
    pytaniaNaStacje: STAN.konfig.pytaniaNaStacje,
    tematWlasny: STAN.konfig.tematWlasny ?? '',
    factcheck: czyWariantFactcheck(STAN.paczka),
  });
}

/**
 * Kopia lokalna po starcie gry (kryterium M9: druga gra bez modelu): stacje
 * i kontener jadą do `localStorage`, rejestr przycina LRU, usunięte klucze
 * znikają JAWNIE (LESSONS L6). Quota nie może zabić gry — tylko komunikat.
 */
function zapiszZestawLokalnyPoStarcie() {
  if (typeof localStorage === 'undefined' || !STAN.pozycja || !STAN.kontenerPaczki) return;
  try {
    const meta = metaBiezacejOkolicy();
    const wpisPelny = {
      schemat: SCHEMAT_LOKALNY, stacje: STAN.stacje, kontener: STAN.kontenerPaczki,
      ...meta, kodGry: STAN.konfig.kodGry,
    };
    const { rejestr: nowy, usuniete } = dolozWpisRejestru(
      { wpisy: czytajRejestrZestawow() },
      { skrot: STAN.kontenerPaczki.skrot, ...meta, kodGry: STAN.konfig.kodGry },
      { bajty: rozmiarBajty(wpisPelny) },
    );
    localStorage.setItem(kluczZestawu(STAN.kontenerPaczki.skrot), JSON.stringify(wpisPelny));
    for (const skrot of usuniete) localStorage.removeItem(kluczZestawu(skrot));
    localStorage.setItem(KLUCZ_REJESTRU, JSON.stringify(nowy));
    if (usuniete.length) {
      status(`Pamięć paczek telefonu pełna — najstarsze (${usuniete.length}) usunięte. Eksport plikiem zabezpiecza rozgrywkę.`);
    }
  } catch (blad) {
    status(`Paczka nie zmieściła się w pamięci telefonu (${blad?.name ?? 'błąd'}) — druga gra będzie potrzebować modelu albo pliku.`);
  }
}

/**
 * Reguła odczytu flagi weryfikacji (ADR 0032 §4): brak pola w starych
 * zapisach (meta, rejestr, indeks, historia) = paczka zweryfikowana.
 */
function czyWpisFactcheck(wpis) {
  return wpis?.factcheck !== false;
}

/**
 * Znaczek Q (ADR 0032): złota litera dla paczek zweryfikowanych w sieci.
 * Niesie informację (nie jest dekoracją) — stąd role="img" z etykietą.
 * Dla wariantu bez weryfikacji go NIE renderujemy (brak znaczka = brak weryfikacji).
 */
function znaczekFactcheck() {
  const s = document.createElement('span');
  s.className = 'znaczek-factcheck';
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', 'pytania zweryfikowane w sieci');
  s.title = 'Pytania zweryfikowane w sieci (fact check)';
  s.textContent = 'Q';
  return s;
}

function wierszZestawu(opis, etykietaZrodla, akcji, statystyki = '', factcheck = true) {
  const li = document.createElement('li');
  const opisEl = document.createElement('span');
  opisEl.className = 'opis-zestawu';
  opisEl.textContent = `${etykietaZrodla} ${opis}`;
  if (factcheck) opisEl.append(' ', znaczekFactcheck());
  const przycisk = document.createElement('button');
  przycisk.type = 'button';
  przycisk.className = 'przycisk';
  przycisk.textContent = '▶ Graj z tą paczką';
  przycisk.addEventListener('click', akcji);
  li.append(opisEl);
  if (statystyki) {
    // ADR 0028 pkt 5: zdanie o ocenach graczy — jedno miejsce na język.
    const ocenyEl = document.createElement('p');
    ocenyEl.className = 'podpowiedz';
    ocenyEl.textContent = statystyki;
    li.append(ocenyEl);
  }
  li.append(przycisk);
  return li;
}

/**
 * Stan mostu Drive w UI (ADR 0020): adres jest wpisany w kod aplikacji, więc
 * użytkownik go nie konfiguruje — ale MA widzieć, czy wspólne repozytorium,
 * gry sieciowe i rankingi są w tej wersji podłączone (LESSONS L6: status jawny).
 * Jeden tekst z `app/most.js` trafia do obu miejsc, żeby nie było dwóch prawd.
 */
function pokazStanMostu() {
  const { tekst, podlaczony } = stanMostu(undefined, { testowy: STAN.trybTestowy });
  for (const id of ['most-stan-repo', 'multi-most-stan']) {
    const el = $(id);
    if (!el) continue;
    el.textContent = tekst;
    el.classList.toggle('bledy', !podlaczony); // brak mostu = widoczne ostrzeżenie, nie szara podpowiedź
  }
}

/** „1 paczka", „2 paczki", „5 paczek" — komunikat ma brzmieć po polsku. */
function opisLiczbyPaczek(ile) {
  if (ile === 1) return 'jest 1 paczka';
  if (ile > 1 && ile < 5) return `są ${ile} paczki`;
  return `jest ${ile} paczek`;
}

/** Licznik pokoleń odświeżeń propozycji — patrz `odswiezPropozycjeZestawow`. */
let POKOLENIE_PROPOZYCJI = 0;

/**
 * Karta propozycji na ekranie pozycja: najpierw kopie z tego telefonu, potem
 * (asynchronicznie, z timeoutem) dopasowania z repozytorium. Każda awaria
 * repo = „brak propozycji", nigdy blokada gry (ADR 0017 pkt 6).
 */
function odswiezPropozycjeZestawow() {
  const karta = $('zestawy-karta');
  if (!karta) return;
  // Niekompletna konfiguracja (np. wyczyszczony promień, K12) = brak karty:
  // kryteria dopasowania byłyby śmieciem, a odmowa przejścia ma zostać jawna.
  if (!STAN.pozycja || !STAN.konfig?.tematy?.length || !(STAN.konfig.promienM > 0)) {
    karta.hidden = true;
    return;
  }
  karta.hidden = false;
  const kryteria = {
    geohash5: geohash(STAN.pozycja.lat, STAN.pozycja.lon, 5),
    // Pełna pozycja: dopasowanie liczy odległość od komórki paczki z tolerancją
    // (ADR 0024), więc kilka metrów różnicy w starcie nie gubi propozycji.
    lat: STAN.pozycja.lat,
    lon: STAN.pozycja.lon,
    promienM: STAN.konfig.promienM,
    liczbaStacji: STAN.konfig.liczbaStacji,
    pytaniaNaStacje: STAN.konfig.pytaniaNaStacje,
    tematy: STAN.konfig.tematy,
    wiek: STAN.konfig.wiek,
  };
  const lista = $('zestawy-lista');
  lista.replaceChildren(); // standardowe czyszczenie (atrapa DOM też je umie)
  const lokalne = dopasujZestawy(czytajRejestrZestawow(), kryteria);
  for (const wpis of lokalne) {
    lista.append(wierszZestawu(
      `${wpis.miejsce} · ${wpis.data} · ${wpis.liczbaStacji} stacji × ${wpis.pytaniaNaStacje} pytań · ${wpis.tematy.join(', ')} · ${wpis.wiek}`,
      '📱 z tego telefonu:',
      () => grajZZestawemLokalnym(wpis.skrot),
      '',
      czyWpisFactcheck(wpis),
    ));
  }
  const url = adresMostu(); // ADR 0020: adres z kodu aplikacji (albo nadpisany w pamięci telefonu)
  pokazStanMostu();
  if (!url) {
    $('zestawy-status').textContent = lokalne.length
      ? 'Masz gotowe paczki z tego telefonu. Wspólne repozytorium (Drive) nie jest podłączone w tej wersji aplikacji.'
      : 'Wspólne repozytorium (Drive) nie jest podłączone w tej wersji aplikacji — nowe pytania przygotuje model.';
    return;
  }
  $('zestawy-status').textContent = lokalne.length
    ? 'Masz gotowe paczki z tego telefonu; sprawdzam też repozytorium…'
    : 'Sprawdzam repozytorium paczek dla tej okolicy…';
  const f = fetchPrzegladarki(); // L18: nigdy gołe fetch
  if (!f) {
    $('zestawy-status').textContent = lokalne.length
      ? 'Repozytorium niedostępne — zostały paczki z tego telefonu.'
      : 'Repozytorium niedostępne — gramy zwykłą ścieżką (prompt i model).';
    return;
  }
  const kontroler = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => kontroler?.abort(), 6000);
  // Odświeżenie jest asynchroniczne, a setup woła je przy każdej zmianie
  // (pozycja, liczba graczy, czas). Bez tego licznika dwie nakładające się
  // próby dopisałyby te same paczki drugi raz — lista musi pokazywać jedno
  // pokolenie odpowiedzi, więc starsze ignorujemy (LESSONS L32).
  const pokolenie = ++POKOLENIE_PROPOZYCJI;
  f(url, kontroler ? { signal: kontroler.signal } : undefined)
    .then((odp) => (odp.ok ? odp.text() : Promise.reject(new Error(`HTTP ${odp.status}`))))
    .then((tekst) => {
      const indeks = walidujIndeksSurowy(tekst).indeks;
      return { indeks, dopasowane: dopasujMetaIndeksu(indeks, kryteria) };
    })
    .then(({ indeks, dopasowane }) => {
      if (pokolenie !== POKOLENIE_PROPOZYCJI) return; // nowsze odświeżenie wygrało
      for (const meta of dopasowane) {
        lista.append(wierszZestawu(
          `${meta.miejsce} · ${meta.data} · ${meta.liczbaStacji} stacji × ${meta.pytaniaNaStacje} pytań · ${meta.tematy.join(', ')} · ${meta.wiek} · ${meta.licencja}`,
          '🌍 repozytorium:',
          () => grajZZestawemZRepo(meta, url),
          // Brak pola `oceny` w indeksie = most sprzed ADR 0028 (nowy zwraca je
          // zawsze, nawet jako zera) — mówimy to wprost, bez obwiniania sieci.
          meta.oceny === undefined
            ? 'Statystyk ocen jeszcze nie ma: ta wersja mostu Drive ich nie zwraca.'
            : opisOcenTekst(walidujStatystykiOcen(meta.oceny)),
          czyWpisFactcheck(meta),
        ));
      }
      // Komunikat mówi, CO zrobić (ADR 0011 pkt 8): puste repo i repo z paczkami,
      // które nie pasują do setupu, to dwie różne sytuacje — i tylko drugą da się
      // naprawić zmianą ustawień.
      if (dopasowane.length) {
        $('zestawy-status').textContent = 'Repozytorium ma paczki dla tej okolicy — wybór należy do Ciebie.';
      } else {
        // Paczki z innych okolic w ogóle nie wchodzą do komunikatu (właściciel,
        // 2026-09-07): liczy się tylko to, co powstało ±200 m stąd, a komunikat
        // mówi WPROST, które kryterium nie pasuje — nie wymienia całego setupu.
        const bliskie = indeks.filter((m) => czyWOkolicy(m, kryteria));
        let komunikat;
        if (bliskie.length) {
          komunikat = `W tej okolicy ${opisLiczbyPaczek(bliskie.length)}, ale ${bliskie.length === 1 ? 'nie pasuje' : 'nie pasują'}: `
            + bliskie.map((m) => `${m.miejsce ?? 'paczka bez nazwy'} — ${powodyNiedopasowania(m, kryteria).join('; ')}`).join(' | ')
            + '. Zmień te ustawienia albo przygotuj nowe pytania modelem.';
        } else {
          komunikat = indeks.length
            ? 'Repozytorium nie ma paczek dla tej okolicy — nowe pytania przygotuje model.'
            : 'Repozytorium jest puste — nowe pytania przygotuje model.';
        }
        $('zestawy-status').textContent = komunikat;
      }
    })
    .catch(() => {
      if (pokolenie !== POKOLENIE_PROPOZYCJI) return; // komunikat należy do nowszej próby
      $('zestawy-status').textContent = lokalne.length
        ? 'Repozytorium niedostępne — zostały paczki z tego telefonu.'
        : 'Repozytorium niedostępne — gramy zwykłą ścieżką (prompt i model).';
    })
    .finally(() => clearTimeout(timer));
}

/**
 * M9b/D4: „🔌 Sprawdź połączenie" — jawna próba mostu Drive na żywym
 * wdrożeniu (instrument ryzyka CORS/redirect z ADR 0016): GET indeksu,
 * walidacja i komunikat po ludzku. Adres bierze z kodu aplikacji (ADR 0020),
 * nic nie zapisuje; awaria nigdy nie blokuje gry (LESSONS L6: status jawny).
 */
function sprawdzPolaczenieZRepo() {
  const url = adresMostu();
  if (!url) {
    status('Nie mam czego sprawdzać: ta wersja aplikacji nie ma wpisanego adresu mostu Drive. Wspólne paczki, gry sieciowe i rankingi są wyłączone — gramy lokalnie.' + ADR(' (ADR 0020)'));
    return;
  }
  status('Sprawdzam połączenie z mostem Drive…');
  const f = fetchPrzegladarki(); // L18: nigdy gołe fetch
  if (!f) { status('Nie da się sprawdzić: to środowisko nie ma fetch.'); return; }
  const kontroler = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => kontroler?.abort(), 8000);
  f(url, kontroler ? { signal: kontroler.signal } : undefined)
    .then((odp) => (odp.ok ? odp.text() : Promise.reject(new Error(`HTTP ${odp.status}`))))
    .then((tekst) => {
      const { indeks, usterki } = walidujIndeksSurowy(tekst);
      if (!indeks.length && usterki.length) {
        status(`Most odpowiada, ale indeks jest nieczytelny (${usterki[0]?.komunikat ?? 'nieznany błąd'}) — upewnij się, że adres wskazuje web app mostu paczek.`);
        return;
      }
      status(`Połączenie OK: most odpowiada, zaakceptowanych zestawów w indeksie: ${indeks.length}. Przeglądarka przepuściła odpowiedź — próba CORS zaliczona.` + ADR(' (ADR 0016)'));
      odswiezPropozycjeZestawow();
    })
    .catch(() => {
      status('Połączenie NIE działa: brak odpowiedzi mostu (CORS, przekierowanie web app, sieć albo zły adres). Gra toczy się zwykłą ścieżką; zapisz ten wynik.' + ADR(' To dokładnie przypadek z ryzyk ADR 0016.'));
    })
    .finally(() => clearTimeout(timer));
}

/** Wspólny start z gotową paczką: stacje i kontener z zestawu, pytania z pamięci. */
function przyjmijZestawDoGry({ stacje, kontener, zrodlo }) {
  const { paczka, blad } = odpakujPaczke(kontener);
  if (blad || !paczka) {
    status(`Paczka (${zrodlo}) jest uszkodzona: ${blad?.komunikat ?? 'nie da się jej odczytać'} — wracamy do zwykłej ścieżki.`);
    return false;
  }
  STAN.stacje = stacje.map((s, i) => ({ id: s.id ?? i + 1, lat: s.lat, lon: s.lon, opis: s.opis ?? '' }));
  STAN.paczka = paczka;
  STAN.usterkiPaczki = [];
  startGry();
  if (STAN.rozgrywka) {
    status(`Gra z gotowej paczki (${zrodlo}): ${STAN.rozgrywka.stacje.length} stacji, bez modelu i bez Overpassa.` + ADR(' (ADR 0017 pkt 7)'));
  }
  return true;
}

function grajZZestawemLokalnym(skrot) {
  if (typeof localStorage === 'undefined') return;
  const { zestaw, usterki } = walidujZestawLokalnySurowy(localStorage.getItem(kluczZestawu(skrot)) ?? '');
  if (!zestaw) {
    status(`Paczka z tego telefonu jest nieczytelna (${usterki[0]?.komunikat ?? 'błąd'}) — usuwam wpis z rejestru.`);
    const { rejestr } = walidujRejestrSurowy(localStorage.getItem(KLUCZ_REJESTRU) ?? '');
    localStorage.setItem(KLUCZ_REJESTRU, JSON.stringify({ schemat: nowyRejestr().schemat, wpisy: rejestr.filter((w) => w.skrot !== skrot) }));
    localStorage.removeItem(kluczZestawu(skrot));
    odswiezPropozycjeZestawow();
    return;
  }
  STAN.paczkaRepoId = ''; // ADR 0028: paczka z telefonu nie zbiera ocen
  przyjmijZestawDoGry({ stacje: zestaw.stacje, kontener: zestaw.kontener, zrodlo: 'z tego telefonu' });
}

function grajZZestawemZRepo(wpis, urlIndeksu) {
  // M9b/D4: adres liczy czysta funkcja urlPaczkiZRepo — wpis z `id` (most
  // Drive) jedzie przez `?akcja=paczka&id=…`, wpis z `plik` jak dotąd.
  const url = urlPaczkiZRepo(urlIndeksu, wpis);
  status(`Pobieram paczkę z repozytorium: ${wpis.miejsce}…`);
  const f = fetchPrzegladarki(); // L18: nigdy gołe fetch
  if (!f) { status('Nie da się pobrać: to środowisko nie ma fetch.'); return; }
  f(url)
    .then((odp) => (odp.ok ? odp.text() : Promise.reject(new Error(`HTTP ${odp.status}`))))
    .then((tekst) => {
      const { zestaw, usterki } = walidujZestawPublicznySurowy(tekst);
      if (!zestaw) {
        status(`Paczka z repozytorium jest niekompletna (${usterki[0]?.komunikat ?? 'błąd'}) — gramy zwykłą ścieżką.`);
        return;
      }
      // ADR 0028: oceny graczy dotyczą paczek z repozytorium — zapamiętujemy id
      // pliku Drive i token tej gry, a licznik „użyta w X grach" dostaje ping.
      STAN.paczkaRepoId = typeof wpis.id === 'string' ? wpis.id : '';
      if (!STAN.tokenGry) STAN.tokenGry = nowyTokenGry();
      wyslijUzycieWTle(STAN.paczkaRepoId);
      przyjmijZestawDoGry({ stacje: zestaw.stacje, kontener: zestaw.kontener, zrodlo: `repozytorium: ${zestaw.meta.miejsce}` });
    })
    .catch(() => status('Nie udało się pobrać paczki z repozytorium — sprawdź połączenie albo graj zwykłą ścieżką.'));
}

/**
 * „▶ Zacznij grę": paczka jedzie do kontenera `TO-paczka/2`, plaintext znika
 * z pamięci (ADR 0007 pkt 4) — pytania wrócą przez `odpakujPaczke` DOPIERO
 * w chwili dojścia do stacji (pkt 6, wiring w R5).
 */
function startGry() {
  if (!STAN.paczka || STAN.usterkiPaczki.length > 0) return;
  if (!STAN.stacje.length || !STAN.pozycja) {
    status('Nie da się zacząć gry: potrzebna pozycja i policzone stacje (kroki 2–3).');
    return;
  }
  STAN.graPauza = false;
  STAN.graPauzaStartMs = 0;
  STAN.pauzaSkumulowanaMs = 0;
  if (!STAN.konfig.kodGry) {
    // Kod gry nie jest w setupie (Partia 2, pkt 7): identyfikator z imion,
    // miejsca i daty — do plików i kluczy, nie do ochrony pytań.
    STAN.konfig.kodGry = domyslnyKodGry({ imiona: STAN.konfig.imiona, miejsce: STAN.miejsce ?? '' });
  }
  STAN.kontenerPaczki = zapakujPaczke(STAN.paczka, WERSJA_PROTOKOLU);
  zapiszZestawLokalnyPoStarcie();
  STAN.rozgrywka = nowaRozgrywka({
    konfig: STAN.konfig,
    stacje: STAN.stacje,
    paczka: STAN.paczka,
    srodek: STAN.pozycja,
    czasMs: zegarGry(),
    ziarno: ziarno(),
    // ADR 0014 pkt 1: układ z sieci niesie dystanse drogowe (STAN.wynikSieci
    // istnieje tylko wtedy — pierścień i ręczne przesunięcia go kasują).
    dystanseOdcinkowM: dystanseOdcinkowM(STAN.wynikSieci),
  });
  STAN.paczka = null;
  STAN.historiaFixow = [];
  pokazEkran('gra');
  if (!STAN.trybTestowy && !STAN.watcher && typeof navigator !== 'undefined' && navigator.geolocation) wlaczGps();
  const brakPytan = STAN.rozgrywka.brakPytan ?? [];
  status(`Gra rozpoczęta: ${STAN.rozgrywka.gracze.length} gracz(y), ${STAN.rozgrywka.stacje.length} stacji. Pytania odsłaniają się dopiero na stacjach.`
    + (brakPytan.length
      ? ` Uwaga: paczka nie ma pytań do stacji ${brakPytan.join(', ')} — zamkną się samym dojściem, bez punktów (ADR 0015).`
      : ''));
  renderujGre();
  zapiszGre();
}

function startOdcinkaGry() {
  if (!STAN.rozgrywka) return;
  // M11/P4: w turach droga jest zamknięta, dopóki idzie ktoś inny — odmowa
  // lokalna jest tylko grzecznościowa, tę samą regułę pilnuje serwer (R08).
  if (STAN.multi && STAN.multi.gra?.tryb === TRYBY_GRY.tury && STAN.multi.gra?.stan === 'trwa') {
    const czyj = biezacyGraczTury(STAN.multi.gra);
    if (czyj !== STAN.multi.graczId) {
      const kto = STAN.multi.gra.gracze.find((g) => g.id === czyj)?.pseudonim ?? czyj ?? '—';
      status(`Teraz idzie: ${kto} (jej/jego telefon). Swój odcinek zaczniesz, gdy zamknie swoją stację.`);
      return;
    }
  }
  const wynik = startOdcinka(STAN.rozgrywka, { czasMs: zegarGry() });
  STAN.rozgrywka = wynik.stan;
  pokazBledy('bledy-gra', wynik.usterki);
  if (wynik.usterki.length === 0) {
    STAN.historiaFixow = []; // nowy odcinek liczy dojście od zera (plan M6, ryzyko 4)
    status('Odcinek rozpoczęty — idźcie. Stacja zapala się po dwóch kolejnych fixach w progu.' + ADR(' (ADR 0004 pkt 2)'));
    odegrajSygnal('startOdcinka'); // M10/T4
    if (!STAN.trybTestowy && !STAN.watcher && typeof navigator !== 'undefined' && navigator.geolocation) wlaczGps();
  } else {
    status(wynik.usterki.map((u) => `[${u.kod}] ${u.komunikat}`).join(' '));
  }
  renderujGre();
  zapiszGre();
}

function zakonczOdcinekGry(trybDojscia, fix) {
  if (!STAN.rozgrywka) return;
  const stacjaPrzed = STAN.rozgrywka.biezacaStacja; // M11: model może przejść dalej — zdarzenie dotyczy TEJ stacji
  const wynik = zakonczOdcinek(STAN.rozgrywka, { czasMs: zegarGry(), trybDojscia, fix: fix ?? STAN.ostatniFix });
  STAN.rozgrywka = wynik.stan;
  pokazBledy('bledy-gra', wynik.usterki);
  if (wynik.usterki.length > 0) {
    status(wynik.usterki.map((u) => `[${u.kod}] ${u.komunikat}`).join(' '));
    renderujGre();
    return;
  }
  STAN.historiaFixow = []; // stary bufor trafień nie zamyka następnego odcinka
  odegrajSygnal('dotarcie'); // M10/T4: wibracja + dwa tony w górę
  if (STAN.multi) {
    // M11/P4: dojście jedzie na serwer BEZ współrzędnych (biała lista pól, ADR 0019 pkt 3)
    void wyslijZdarzenieMulti('dojscie', stacjaPrzed, { trybDojscia });
  }
  // ADR 0029: jedynym trybem dojścia, jaki ta funkcja może teraz dostać, jest
  // GPS (albo symulacja, która jest tym samym strumieniem fixów) — gałąź
  // „zgłoszone ręcznie" była martwa razem z usuniętym przyciskiem.
  status('Stacja osiągnięta — próg dojścia zadziałał z GPS. Brawo!');
  renderujGre();
  if (STAN.rozgrywka.faza === FAZY.pytanie) renderujPytanie(); // ADR 0007 pkt 6: pytanie DOPIERO teraz
  zapiszGre();
}

/** Pauza gry: zegar stoi, watcher/symulacja zatrzymane, wznowienie jawne. */
function przelaczPauzeGry() {
  const r = STAN.rozgrywka;
  if (!r || r.faza === FAZY.koniec) return;
  STAN.graPauza = !STAN.graPauza;
  const przycisk = $('przycisk-pauza');
  if (STAN.graPauza) {
    STAN.graPauzaStartMs = performance.now();
    zatrzymajSymulacje();
    zatrzymajGps(); // oszczędność baterii — pauza zatrzymuje strumień fixów (ADR 0004 pkt 1)
    $('gra-pauza-komunikat').textContent = `${komunikatPauzy().komunikat} Zegar gry zatrzymany — wznowcie, gdy wszyscy gotowi.`;
    przycisk.textContent = '▶ Wznów';
  } else {
    STAN.pauzaSkumulowanaMs += performance.now() - STAN.graPauzaStartMs;
    STAN.graPauzaStartMs = 0;
    STAN.historiaFixow = []; // fixy sprzed pauzy nie rozstrzygają dojścia po wznowieniu
    $('gra-pauza-komunikat').textContent = komunikatWznowienia().komunikat;
    przycisk.textContent = '⏸ Pauza';
    if (!STAN.trybTestowy && typeof navigator !== 'undefined' && navigator.geolocation) wlaczGps();
  }
  przycisk.setAttribute('aria-pressed', String(STAN.graPauza));
  $('gra-pauza-komunikat').hidden = false;
  renderujGre();
  zapiszGre(); // świeża kotwica zegara — wznowienie nie zgubi pauz
}

/** Symulacja dojścia DO BIEŻĄCEJ STACJI (tryb testowy — kryterium „gra bez GPS"). */
function przelaczSymulacjeDoStacji() {
  if (STAN.symulacja) {
    zatrzymajSymulacje();
    status('Symulacja dojścia zatrzymana.');
    return;
  }
  const r = STAN.rozgrywka;
  if (!r || !STAN.pozycja) return;
  const pod = podglad(r);
  if (!pod.stacja) return;
  const start = { lat: STAN.pozycja.lat, lon: STAN.pozycja.lon };
  const cel = { lat: pod.stacja.lat, lon: pod.stacja.lon };
  const trasa = trasaProsta({ start, cel, czasMs: SYMULACJA.czasMs, accuracyM: SYMULACJA.accuracyM, przystanki: 2 });
  const fixy = sekwencjaSymulowana(trasa, { coMs: SYMULACJA.coMs, postoj: GRANICE.wymaganeTrafnienia });
  STAN.symulacja = { fixy, indeks: 0, cel, timer: setInterval(krokSymulacji, SYMULACJA_KROK_MS) };
  status(`Symulacja dojścia do stacji ${pod.stacja.id}: ${fixy.length} fixów (ostatnie dwa dokładnie w celu).`);
}

/**
 * Faza `pytanie` (M6/R5): paczka jest odsłaniana z kontenera DOPIERO tutaj
 * (ADR 0007 pkt 6). Model rozgrywki pilnuje, kto odpowiada i które pytania
 * zostały (`ktoOdpowiada`, referencje `{stacja, pytanieId}`); treść bierzemy
 * z odsłoniętej paczki po id.
 */
/* ------------------------------------------------- oceny pytań (ADR 0028) */

/** Pamięć przeglądarki albo null (goły Node w testach logiki). */
function pamiecOcen() {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

/** Głosy tego telefonu z pamięci — uszkodzony wpis nie wywraca rozgrywki. */
function zaladujOcenyLokalne() {
  const pamiec = pamiecOcen();
  if (!pamiec) return;
  const { oceny, usterki } = walidujOcenyLokalneTekst(pamiec.getItem(KLUCZ_OCEN) ?? '');
  STAN.oceny = oceny;
  if (usterki.length) status(usterki[0].komunikat);
}

function zapiszOcenyLokalne() {
  const pamiec = pamiecOcen();
  if (pamiec) pamiec.setItem(KLUCZ_OCEN, JSON.stringify(STAN.oceny));
}

function kolejkaOcen() {
  const pamiec = pamiecOcen();
  return walidujKolejkeOcenTekst(pamiec ? pamiec.getItem(KLUCZ_KOLEJKI_OCEN) ?? '' : '');
}

function zapiszKolejkeOcen(kolejka) {
  const pamiec = pamiecOcen();
  if (pamiec) pamiec.setItem(KLUCZ_KOLEJKI_OCEN, JSON.stringify(kolejka));
}

/**
 * Panel „Oceń pytanie" (ADR 0028 pkt 1). Pokazuje się tylko przy paczce
 * z repozytorium — paczka wygenerowana na tym telefonie nie ma gdzie zbierać
 * głosów, więc panelu nie ma (bez komunikatu o brakującej funkcji).
 */
/**
 * Tożsamość głosującego spod panelu ocen. ADR 0026 aneks: na telefonie jest
 * LISTA graczy, nie jeden profil — głosującego szukamy po imieniu
 * odpowiadającego gracza, bo w hot-seat każdy gracz ocenia osobno (ADR 0028
 * pkt 2) i sam identyfikator telefonu byłby za gruby. Jedno miejsce liczenia
 * dla renderu panelu i dla klika — inaczej „już ocenione" mijałoby się z głosem.
 */
function idGlosujacegoPanelu(imie) {
  const zapamietani = czytajGraczyLokalnych();
  const klucz = normalizujPseudonim(imie).toLowerCase();
  const naLiscie = (zapamietani?.gracze ?? []).find((g) => String(g.pseudonim).toLowerCase() === klucz) ?? null;
  return idGlosujacego({
    pseudonim: naLiscie?.pseudonim ?? '',
    zweryfikowany: naLiscie?.zweryfikowany === true,
    imie: imie ?? '',
    pamiec: pamiecOcen(),
  }).id;
}

function renderujPanelOcen(pytanie, gracz = null) {
  const panel = $('gra-oceny');
  if (!panel) return;
  if (!STAN.paczkaRepoId || !pytanie) {
    panel.hidden = true;
    STAN.ocenianePytanieId = '';
    STAN.ocenianyGracz = '';
    STAN.oceniajacyId = '';
    return;
  }
  panel.hidden = false;
  STAN.ocenianePytanieId = pytanie.id;
  if (gracz) {
    STAN.ocenianyGracz = gracz.imie ?? '';
    STAN.oceniajacyId = idGlosujacegoPanelu(gracz.imie);
  }
  // Odświeżenie po głosie woła bez gracza — tożsamość głosującego zostaje ta,
  // która głosowała, bo `idGlosujacego` z pustym imieniem liczy inne id.
  const glos = znajdzGlos(STAN.oceny, { paczkaId: STAN.paczkaRepoId, pytanieId: pytanie.id, graczId: STAN.oceniajacyId });
  const plus = $('gra-ocena-plus');
  const minus = $('gra-ocena-minus');
  if (plus) {
    plus.setAttribute('aria-pressed', glos?.ocena === OCENA_PLUS ? 'true' : 'false');
    plus.disabled = Boolean(glos);
  }
  if (minus) {
    minus.setAttribute('aria-pressed', glos?.ocena === OCENA_MINUS ? 'true' : 'false');
    minus.disabled = Boolean(glos);
  }
  const etykieta = $('gra-oceny-etykieta');
  if (etykieta) etykieta.textContent = glos ? 'To pytanie masz już ocenione — dzięki.' : 'Oceń pytanie (nie musisz)';
}

/**
 * Klik w kciuk: zapis lokalny + wysyłka w tle (ADR 0028 pkt 3). Interfejs nigdy
 * nie czeka na most — głos jest widoczny od razu, a kolejka pilnuje dostarczenia.
 */
function kliknijOcene(ocena) {
  if (!STAN.paczkaRepoId || !STAN.ocenianePytanieId) return;
  // Tożsamość spod renderu panelu — ten sam głosujący, którego sprawdzało
  // „już ocenione" (głosowanie bez renderu nie istnieje, awaryjnie liczymy).
  const id = STAN.oceniajacyId || idGlosujacegoPanelu(STAN.ocenianyGracz);
  const wynik = ocenPytanie(STAN.oceny, {
    paczkaId: STAN.paczkaRepoId,
    pytanieId: STAN.ocenianePytanieId,
    ocena,
    graczId: id,
    gra: STAN.tokenGry,
  });
  if (wynik.usterki.length) {
    status(wynik.usterki.map((u) => u.komunikat).join(' '));
    renderujPanelOcen({ id: STAN.ocenianePytanieId });
    return;
  }
  STAN.oceny = wynik.oceny;
  zapiszOcenyLokalne();
  renderujPanelOcen({ id: STAN.ocenianePytanieId });
  status(ocena === OCENA_PLUS
    ? 'Dzięki — pytanie ocenione na tak. Głos leci na wspólny Drive w tle.'
    : 'Dzięki — pytanie ocenione na nie. Głos leci na wspólny Drive w tle.');
  void wyslijOceneWTle(wynik.doWysylki);
}

/**
 * Wysyłka głosu w tle. Niepowodzenie (brak sieci, stary most, odmowa) nie jest
 * błędem gracza: głos trafia do kolejki i poleci przy następnym uruchomieniu.
 */
function wyslijOceneWTle(zadanie) {
  if (!zadanie) return Promise.resolve();
  const f = fetchPrzegladarki(); // L18: nigdy gołe fetch
  const url = adresMostu();
  if (!f || !url) {
    zapiszKolejkeOcen(dodajDoKolejkiOcen(kolejkaOcen(), zadanie));
    return Promise.resolve();
  }
  return f(url, { method: 'POST', body: JSON.stringify(zadanie) })
    .then((odp) => (odp.ok ? odp.text() : Promise.reject(new Error(`HTTP ${odp.status}`))))
    .then((tekst) => {
      const wynik = walidujOdpowiedzOceny(tekst);
      if (wynik.ok) {
        zapiszKolejkeOcen(usunZKolejkiOcen(kolejkaOcen(), zadanie));
        return;
      }
      zapiszKolejkeOcen(dodajDoKolejkiOcen(kolejkaOcen(), zadanie));
      status(`${wynik.usterki[0].komunikat} Ocena czeka w kolejce i poleci przy najbliższym uruchomieniu aplikacji.`);
    })
    .catch(() => {
      zapiszKolejkeOcen(dodajDoKolejkiOcen(kolejkaOcen(), zadanie));
      status('Ocena nie dojechała na wspólny Drive — czeka w kolejce i poleci przy najbliższym uruchomieniu aplikacji.');
    });
}

/** Głosy z kolejki przy starcie aplikacji (ADR 0028 pkt 3). */
function oproznijKolejkeOcen() {
  for (const zadanie of kolejkaOcen().zadania) void wyslijOceneWTle(zadanie);
}

/** Ping „użyta w X grach" — tło, bez wpływu na start gry (ADR 0028 pkt 6). */
function wyslijUzycieWTle(paczkaId) {
  if (!paczkaId) return;
  const f = fetchPrzegladarki();
  const url = adresMostu();
  if (!f || !url) return;
  void f(url, { method: 'POST', body: JSON.stringify({ akcja: 'uzycie', paczkaId, gra: STAN.tokenGry }) })
    .then(() => undefined)
    .catch(() => undefined); // licznik jest pomocniczy: brak sieci nie jest komunikatem dla gracza
}

function renderujPytanie() {
  const r = STAN.rozgrywka;
  if (!r || r.faza !== FAZY.pytanie) return;
  const { paczka, blad } = odpakujPaczke(STAN.kontenerPaczki);
  if (!paczka) {
    $('gra-pytanie-tresc').textContent = '';
    $('gra-komunikat').textContent = `Nie da się odsłonić pytania: ${blad ?? 'uszkodzony kontener'}. Zakończ grę albo wgraj paczkę ponownie z pliku.`;
    return;
  }
  const idPytan = pytaniaStacji(r, r.biezacaStacja);
  const odpowiadaja = ktoOdpowiada(r, r.biezacaStacja);
  // pierwsza nieobsłużona para (pytanie, gracz) — wiele pytań na stację i wielu
  // odpowiadających (współpraca/zespoły) przechodzi przez ten sam ekran
  let para = null;
  for (const pid of idPytan) {
    for (const gid of odpowiadaja) {
      const juz = r.odpowiedzi.some((o) => o.stacja === r.biezacaStacja && o.pytanieId === pid && o.gracz === gid);
      if (!juz) { para = { pytanieId: pid, graczId: gid }; break; }
    }
    if (para) break;
  }
  if (!para) { renderujGre(); return; } // stacja domknięta — model przeszedł dalej
  const pytanie = paczka.pytania.find((q) => q.id === para.pytanieId);
  const gracz = r.gracze.find((g) => g.id === para.graczId);
  if (!pytanie) {
    $('gra-komunikat').textContent = `Kontener nie zawiera pytania ${para.pytanieId} — paczka rozjechała się z rozgrywką. Zakończ grę albo wgraj paczkę ponownie.`;
    return;
  }
  $('gra-komunikat').textContent = '';
  $('gra-pytanie-naglowek').textContent = `Stacja ${r.biezacaStacja} zdobyta · pytanie ${idPytan.indexOf(para.pytanieId) + 1} z ${idPytan.length} · odpowiada ${gracz?.imie ?? '?'}`;
  $('gra-pytanie-tresc').textContent = pytanie.tresc;
  renderujPanelOcen(pytanie, gracz);
  const lista = $('gra-odpowiedzi');
  lista.replaceChildren();
  pytanie.odpowiedzi.forEach((odp, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'przycisk przycisk-odpowiedz';
    b.textContent = `${'ABCD'[i]}. ${odp}`;
    b.addEventListener('click', () => odpowiedzNaPytanie(pytanie, i, para));
    lista.appendChild(b);
  });
  $('gra-wynik-odpowiedzi').hidden = true;
  $('przycisk-nastepna-stacja').hidden = true;
  STAN.pytaniePokazaneMs = performance.now();
}

/** Zapis odpowiedzi + ocena, wyjaśnienie i źródła (ADR 0008: źródła także w grze). */
function odpowiedzNaPytanie(pytanie, wybrana, para) {
  const r = STAN.rozgrywka;
  if (!r || r.faza !== FAZY.pytanie) return;
  const stacjaOdp = r.biezacaStacja; // M11: po ostatnim pytaniu model bywa już przy następnej stacji
  const wynik = zapiszOdpowiedz(r, {
    stacjaId: r.biezacaStacja,
    graczId: para.graczId,
    pytanie,
    wybrana,
    czasMs: zegarGry(),
  });
  STAN.rozgrywka = wynik.stan;
  pokazBledy('bledy-gra', wynik.usterki);
  if (wynik.usterki.length > 0) {
    status(wynik.usterki.map((u) => `[${u.kod}] ${u.komunikat}`).join(' '));
    return;
  }
  const dobrze = wybrana === pytanie.poprawna;
  odegrajSygnal(dobrze ? 'poprawna' : 'bledna'); // M10/T4: melodia w górę / w dół
  [...$('gra-odpowiedzi').children].forEach((b, i) => {
    b.disabled = true; // jedna odpowiedź na pytanie — bez poprawek po fakcie
    if (i === pytanie.poprawna) b.classList.add('poprawna');
    else if (i === wybrana) b.classList.add('zla');
  });
  const wpis = wynik.stan.odpowiedzi.at(-1);
  if (STAN.multi) {
    // M11/P4: wynik odpowiedzi jedzie na serwer — punkty liczy też serwer (spójność ponad zaufaniem)
    void wyslijZdarzenieMulti('odpowiedz', stacjaOdp, {
      poprawna: dobrze,
      punktyRazem: wpis.punktyRazem,
    });
  }
  $('gra-odpowiedz-ocena').textContent = dobrze
    ? `✓ Dobrze! +${wpis.punktyRazem} pkt`
    : `✗ Źle (0 pkt). Poprawna odpowiedź: ${'ABCD'[pytanie.poprawna]}. ${pytanie.odpowiedzi[pytanie.poprawna]}`;
  $('gra-wyjasnienie').textContent = pytanie.wyjasnienie ?? '';
  const zrodla = $('gra-zrodla');
  zrodla.replaceChildren();
  for (const z of pytanie.zrodla ?? []) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = z.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = `${z.tytul ?? z.url}${z.sprawdzono ? ` (sprawdzono ${z.sprawdzono})` : ''}`;
    li.appendChild(a);
    zrodla.appendChild(li);
  }
  $('gra-wynik-odpowiedzi').hidden = false;
  $('przycisk-nastepna-stacja').hidden = false;
  const faza = wynik.stan.faza;
  $('przycisk-nastepna-stacja').textContent = faza === FAZY.koniec
    ? '🏁 Zobacz wynik →'
    : faza === FAZY.pytanie
      ? 'Następne pytanie →'
      : 'Następna stacja →';
  // Paczka bez źródeł (rev3) nie ma „źródeł poniżej" — status nie może ich obiecywać.
  const maZrodla = Array.isArray(pytanie.zrodla) && pytanie.zrodla.length > 0;
  status(dobrze
    ? 'Poprawna odpowiedź zapisana.'
    : maZrodla ? 'Odpowiedź zapisana — wyjaśnienie i źródła poniżej.' : 'Odpowiedź zapisana — wyjaśnienie poniżej.');
  renderujGre({ panele: false }); // badge'e tak; panele dopiero po „Następna stacja"
  zapiszGre();
}

/** „Następna stacja/pytanie": domyka pokaz wyjaśnienia i przełącza fazę. */
function nastepnaStacja() {
  const r = STAN.rozgrywka;
  if (!r) return;
  renderujGre();
  if (r.faza === FAZY.pytanie) renderujPytanie();
}

/* ----------------------------------------- M6/R6: trwałość i wznowienie gry */

/**
 * Zapis po KAŻDEJ tranzycji (plan M6, decyzja 5): `beforeunload` jest na
 * telefonach zawodny, więc snapshot ląduje w `localStorage` synchronicznie po
 * każdym ruchu. W środku kontener `TO-paczka/2` — nigdy plaintext (ADR 0007).
 */
function zapiszGre() {
  const r = STAN.rozgrywka;
  if (!r || !STAN.kontenerPaczki) return;
  // M11/P4: gra wieloosobowa ma trwałość NA SERWERZE (RO-gra/1) — lokalny
  // snapshot wskrzesiłby ją po odświeżeniu jako hot-seat bez kontekstu multi.
  // Powrót do gry idzie przez `okolica:multi:sesja` (baner w karcie multi).
  if (STAN.multi) return;
  try {
    const snapshot = zbierajStan({
      // kodGry bywa undefined do pierwszego „generuj kod" — klucz i tak musi być stringiem
      konfig: { ...STAN.konfig, kodGry: String(STAN.konfig.kodGry ?? '') },
      stacje: STAN.stacje,
      kontenerPaczki: STAN.kontenerPaczki,
      rozgrywka: r,
      pozycja: STAN.pozycja
        ? { lat: STAN.pozycja.lat, lon: STAN.pozycja.lon, dokladnoscM: STAN.dokladnoscM, zrodlo: STAN.ostatniFix?.zrodlo ?? null }
        : null,
      ekran: 'gra',
      terazMs: Date.now(),
      zegarMs: zegarGry(),
    });
    localStorage.setItem(kluczStanu(r.kodGry), serializujStan(snapshot));
    // wskaźnik = klucz oczyszczony (pusty kodGry → 'gra'); goły '' byłby falsy
    // i baner wznowienia nigdy by się nie pokazał dla gry bez kodu
    localStorage.setItem(KLUCZ_AKTYWNEJ, oczyscKodGry(r.kodGry));
    // M7/P6: gra zakończona (naturalnie albo ręcznie) ląduje w historii —
    // dodajWpisHistorii jest idempotentna po klucz, więc powtórki zastępują,
    // nie dublują (dokończenie przerwanej gry po wznowieniu = wpis pełny)
    if (r.faza === FAZY.koniec || STAN.graZakonczonaRecznie) {
      zapiszGreDoHistorii(STAN.graZakonczonaRecznie && r.faza !== FAZY.koniec);
    }
  } catch (blad) {
    status(blad?.kod === 'T07'
      ? 'Zapis gry przekroczył budżet 2 MB (T07) — gramy dalej bez wznowienia po zamknięciu. Zakończ grę, żeby zobaczyć wynik.'
      : `Zapis gry nie udał się: ${blad?.message ?? blad}. Gramy dalej — ale bez wznowienia po zamknięciu przeglądarki.`);
  }
}

/** Skrót zakończonej gry do `okolica:historia` (M7/P6, ADR 0010 pkt 1).
 *  Błąd zapisu historii NIGDY nie dotyka wyniku ani zapisu gry — jawny status. */
function zapiszGreDoHistorii(przerwana = false) {
  const r = STAN.rozgrywka;
  if (!r) return;
  try {
    const wpis = skrotGry({
      rozgrywka: r,
      konfig: { ...STAN.konfig, kodGry: String(STAN.konfig.kodGry ?? '') },
      stacje: STAN.stacje,
      podsumowanie: podsumowanie(r),
      miejsce: STAN.miejsce ? STAN.miejsce : null,
      terazMs: Date.now(),
      przerwana,
      factcheck: factcheckBiezacejSesji(),
    });
    const surowy = localStorage.getItem(KLUCZ_HISTORII);
    let { historia, usterki } = walidujHistorieSurowa(surowy);
    if (!historia) {
      if (surowy != null) {
        status(`Historia gier była uszkodzona (${usterki.map((u) => u.kod).join(', ')}) — zaczynam nową listę. Stare wpisy były nieczytelne; resztkę usuniesz „Kasuj historię" na ekranie ustawień.`);
      }
      historia = nowaHistoria();
    }
    localStorage.setItem(KLUCZ_HISTORII, JSON.stringify(dodajWpisHistorii(historia, wpis)));
    renderujHistorieGier();
    // ADR 0026 aneks: ten sam koniec gry, który trafia do historii telefonu,
    // wysyła wynik na wspólny Drive (idempotentnie po odcisku gry).
    void wyslijWynikHotseat();
  } catch (blad) {
    status(`Nie udało się dopisać gry do historii: ${blad?.message ?? blad}. Wynik gry i zapis nie są tym dotknięte.`);
  }
}

/** Lista poprzednich gier na setupie: skróty, najnowsza najpierw; zepsuty
 *  zapis = jawne kody H i oferta kasowania (ADR 0010 pkt 6 — nigdy cicho). */
function renderujHistorieGier() {
  const karta = $('karta-historia');
  const usterkiPole = $('historia-usterki');
  const lista = $('historia-lista');
  const przycisk = $('przycisk-kasuj-historie');
  STAN.historiaKasowanieUzbrojone = false;
  przycisk.textContent = '🗑 Kasuj historię';
  const surowy = localStorage.getItem(KLUCZ_HISTORII);
  if (surowy == null) {
    karta.hidden = true;
    return;
  }
  karta.hidden = false;
  const { historia, usterki } = walidujHistorieSurowa(surowy);
  if (!historia) {
    $('historia-naglowek').textContent = 'Poprzednie gry';
    usterkiPole.hidden = false;
    usterkiPole.textContent = `Historia gier jest uszkodzona (${usterki.map((u) => u.kod).join(', ')}) — wpisy są nieczytelne. Skasuj ją przyciskiem poniżej; nowa gra zacznie czystą listę.`;
    lista.replaceChildren();
    return;
  }
  usterkiPole.hidden = true;
  usterkiPole.textContent = '';
  const wpisy = [...historia.wpisy].reverse(); // najnowsza najpierw
  $('historia-naglowek').textContent = `Poprzednie gry (${wpisy.length})`;
  lista.replaceChildren(...wpisy.map((w) => {
    const li = document.createElement('li');
    const kiedy = w.data.slice(0, 16).replace('T', ' ');
    const czesci = [
      kiedy,
      w.miejsce,
      TRYBY[w.tryb]?.etykieta ?? w.tryb,
      w.zwyciezca ? `🏆 ${w.zwyciezca} — ${w.punktyRazem} pkt` : 'brak zwycięzcy',
    ];
    li.textContent = czesci.filter(Boolean).join(' · ') + (w.przerwana ? ' · (przerwana)' : '');
    if (czyWpisFactcheck(w)) li.append(' ', znaczekFactcheck());
    return li;
  }));
}

/** Kasowanie historii — dwustopniowo, bez confirm() (ADR 0015 pkt 6). */
function kasujHistorieGry() {
  if (!STAN.historiaKasowanieUzbrojone) {
    STAN.historiaKasowanieUzbrojone = true;
    $('przycisk-kasuj-historie').textContent = '⚠ Kliknij ponownie, aby skasować historię';
    status('Drugi klik trwale usunie listę poprzednich gier z telefonu.');
    return;
  }
  localStorage.removeItem(KLUCZ_HISTORII);
  STAN.historiaKasowanieUzbrojone = false;
  renderujHistorieGier(); // bez klucza karta się chowa
  status('Historia gier skasowana.');
}

/** Start aplikacji: szukamy zapisu gry i pokazujemy baner na setupie (decyzja 6). */
function sprawdzZapisGry() {
  STAN.wznowienieKandydat = null;
  STAN.czyszczenieZapisuUzbrojone = false;
  const karta = $('karta-wznowienie');
  $('przycisk-kasuj-zapis').textContent = '🗑 Nowa gra (kasuje zapis)';
  const aktywna = localStorage.getItem(KLUCZ_AKTYWNEJ);
  if (!aktywna) {
    karta.hidden = true;
    return;
  }
  const { stan, usterki } = walidujStanSurowy(localStorage.getItem(kluczStanu(aktywna)) ?? '');
  if (!stan) {
    karta.hidden = false;
    $('przycisk-wznow-gre').hidden = true;
    $('wznowienie-opis').textContent = `Znaleziono zepsuty zapis gry „${aktywna}" (${usterki.map((u) => u.kod).join(', ')}). Nie da się go wznowić — usuń go, żeby zacząć nową grę.`;
    return;
  }
  STAN.wznowienieKandydat = stan;
  karta.hidden = false;
  $('przycisk-wznow-gre').hidden = false;
  const r = stan.rozgrywka;
  const indeks = r.stacje.findIndex((s) => s.id === r.biezacaStacja) + 1;
  $('wznowienie-opis').textContent = `Znaleziono niedokończoną grę „${r.kodGry || aktywna}" — faza: ${r.faza}, stacja ${indeks} z ${r.stacje.length}, zapisano ${new Date(stan.zapisanoMs).toLocaleString('pl-PL')}.`;
}

/**
 * Wznowienie: rebaza zegara sesji (plan M6, ryzyko 3/4) — `performance.now()`
 * po restarcie przeglądarki startuje od zera, więc wszystkie znaczniki czasu
 * rozgrywki przesuwamy o różnicę między teraz a kotwicą `zegarMs` z zapisu.
 * Czas zamknięcia karty NIE wlicza się w odcinek (uczciwy pomiar).
 */
function wznowGre() {
  const snapshot = STAN.wznowienieKandydat;
  if (!snapshot) return;
  const przesuniecie = performance.now() - snapshot.zegarMs;
  const r = snapshot.rozgrywka;
  r.startMs += przesuniecie;
  for (const o of r.odcinki) {
    if (o.startMs != null) o.startMs += przesuniecie;
    if (o.koniecMs != null) o.koniecMs += przesuniecie;
  }
  for (const zdarzenie of r.dziennik) zdarzenie.czasMs += przesuniecie;
  STAN.konfig = snapshot.konfig;
  STAN.stacje = snapshot.stacje;
  STAN.kontenerPaczki = snapshot.kontenerPaczki;
  STAN.rozgrywka = r;
  STAN.paczka = null; // w grze nadal tylko kontener (ADR 0007 pkt 4)
  STAN.usterkiPaczki = [];
  if (snapshot.pozycja) {
    STAN.pozycja = { lat: snapshot.pozycja.lat, lon: snapshot.pozycja.lon };
    STAN.dokladnoscM = snapshot.pozycja.dokladnoscM ?? null;
  }
  STAN.graPauza = false;
  STAN.graPauzaStartMs = 0;
  STAN.pauzaSkumulowanaMs = 0;
  STAN.graZakonczonaRecznie = false;
  STAN.historiaFixow = []; // dojście liczymy od nowa — fixy sprzed zamknięcia nie rozstrzygają
  STAN.wycentrowane = false; // pierwszy fix po wznowieniu centruje mapę gry
  STAN.wznowienieKandydat = null;
  $('karta-wznowienie').hidden = true;
  $('przycisk-pauza').textContent = '⏸ Pauza';
  $('przycisk-pauza').setAttribute('aria-pressed', 'false');
  renderujSetup(); // konfiguracja z zapisu wraca do pól setupu
  // Skład gry bierze się z zapisu — tu tylko przyciski zapamiętanych (ADR 0026 aneks).
  przywrocGraczy();
  pokazEkran('gra');
  if (!STAN.trybTestowy && typeof navigator !== 'undefined' && navigator.geolocation) wlaczGps();
  status(`Gra „${r.kodGry || 'bez kodu'}" wznowiona — faza: ${r.faza}. Czas zamknięcia przeglądarki nie wlicza się w odcinek.`);
  renderujGre();
  if (r.faza === FAZY.pytanie) renderujPytanie();
  zapiszGre(); // świeża kotwica zegara
}

/** Kasowanie zapisu — dwustopniowe, bez confirm() (ADR 0015 pkt 6). */
function kasujZapisGry() {
  if (!STAN.czyszczenieZapisuUzbrojone) {
    STAN.czyszczenieZapisuUzbrojone = true;
    $('przycisk-kasuj-zapis').textContent = '⚠ Kliknij ponownie, aby skasować zapis';
    status('Drugi klik trwale usunie zapisaną grę z telefonu.');
    return;
  }
  const aktywna = localStorage.getItem(KLUCZ_AKTYWNEJ);
  if (aktywna) localStorage.removeItem(kluczStanu(aktywna));
  localStorage.removeItem(KLUCZ_AKTYWNEJ);
  STAN.czyszczenieZapisuUzbrojone = false;
  STAN.wznowienieKandydat = null;
  $('karta-wznowienie').hidden = true;
  status('Zapis gry skasowany. Możesz ustawić nową.');
}

/** Pominięcie odcinka w drodze (ADR 0015 pkt 2) — kody G11/G13 trafiają do UI. */
function pominStacjeGry() {
  if (!STAN.rozgrywka) return;
  if (STAN.multi) {
    // serwer zna tylko zdarzenia dojscie/odpowiedz/rezygnacja — „pominięta" stacja
    // blokowałaby grę na zawsze, więc w multi pomijania NIE ma (ADR 0019)
    status('W grze wieloosobowej nie da się pominąć stacji — każda jest czyimś celem. Jeśli nie możesz iść dalej, zrezygnuj (panel gry wieloosobowej).');
    return;
  }
  const wynik = pominStacje(STAN.rozgrywka, { czasMs: zegarGry(), powod: 'pominięcie z ekranu gry' });
  STAN.rozgrywka = wynik.stan;
  pokazBledy('bledy-gra', wynik.usterki);
  status(wynik.usterki.length > 0
    ? wynik.usterki.map((u) => `[${u.kod}] ${u.komunikat}`).join(' ')
    : 'Odcinek pominięty — stacja nie liczy się do punktów ani do mediany tempa (ADR 0015).');
  renderujGre();
  zapiszGre();
}

/**
 * „■ Zakończ grę" — dwustopniowo; pokazuje wynik WCZEŚNIEJ niż model kończy
 * grę, ale NIE niszczy stanu: zapis zostaje i grę można wznowić (pełne
 * podsumowanie z eksportem to M7).
 */
function zakonczGreRecznie() {
  const r = STAN.rozgrywka;
  if (!r) return;
  if (r.faza === FAZY.koniec) {
    // Gra już się skończyła: klikanie „Zakończ grę" nic nie zmienia, więc mówimy
    // wprost, gdzie jest wyjście (właściciel, 2026-09-08).
    status('Ta gra już się zakończyła — wynik jest powyżej. Nową grę zaczniesz przyciskiem „Wróć na początek".');
    return;
  }
  if (!STAN.graZakonczonaUzbrojone) {
    STAN.graZakonczonaUzbrojone = true;
    $('przycisk-zakoncz-gre').textContent = '⚠ Kliknij ponownie, aby zakończyć';
    status('Drugi klik pokaże wynik i zakończy grę. Zapis zostaje — można wznowić od tego miejsca.');
    return;
  }
  STAN.graZakonczonaUzbrojone = false;
  STAN.graZakonczonaRecznie = true;
  $('przycisk-zakoncz-gre').textContent = '■ Zakończ grę';
  // M11/P4: koniec na tym telefonie = rezygnacja w grze wieloosobowej (reszta gra dalej)
  if (STAN.multi) void wyslijZdarzenieMulti('rezygnacja', null, { powod: 'zakończenie ręczne na telefonie' });
  zatrzymajSymulacje();
  pokazWyniki();
  renderujGre();
  zapiszGre(); // M7/P6: ręczne zakończenie JEST tranzycją — zapis + wpis historii „przerwana"
  status('Gra zakończona wcześniej — wynik poniżej. Zapis został, więc można ją wznowić.');
}

/**
 * „Wróć na początek" (właściciel, 2026-09-08): po zakończeniu gry nie było
 * wyjścia z ekranu gry. Wynik jest już w historii, więc sprzątamy stan bieżącej
 * rozgrywki i wracamy do setupu — ustawienia graczy i setup zostają.
 */
function wrocNaPoczatek() {
  const r = STAN.rozgrywka;
  zatrzymajSymulacje();
  if (typeof localStorage !== 'undefined') {
    const kod = r ? oczyscKodGry(r.kodGry) : '';
    if (kod) localStorage.removeItem(kluczStanu(kod));
    localStorage.removeItem(KLUCZ_AKTYWNEJ); // baner „wznów grę" nie proponuje skończonej gry
  }
  STAN.rozgrywka = null;
  STAN.graZakonczonaRecznie = false;
  STAN.graZakonczonaUzbrojone = false;
  STAN.kontenerPaczki = null;
  STAN.paczkaRepoId = '';
  STAN.tokenGry = '';
  STAN.ocenianePytanieId = '';
  STAN.ocenianyGracz = '';
  STAN.oceniajacyId = '';
  pokazMapeStartowa();
  status('Gotowe do nowej gry — setup i gracze zostali, wynik jest w historii.');
}

/* ------------------------------------------------- pełne podsumowanie (M7) */

/** Data wyniku do tekstu: UTC z ISO — deterministyczna, bez locale. */
function dataWynikuTekst(teraz = new Date()) {
  const iso = teraz.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/**
 * Pełne podsumowanie (M7) z `podsumowanie()` — warstwa DOM nie liczy
 * własnej matematyki (plan M7, kryteria kodu). Bez czasów i tempa
 * (Partia 2: zero presji czasowej).
 */
function pokazWyniki() {
  const r = STAN.rozgrywka;
  if (!r) return;
  const wynik = podsumowanie(r);
  const imiona = new Map(r.gracze.map((g) => [g.id, g.imie]));

  // 1. karta zwycięzcy — duże liczby, czytelne w słońcu
  const zwyciezca = wynik.gracze.find((g) => g.id === wynik.zwyciezca) ?? null;
  const kartaZw = $('gra-wynik-zwyciezca');
  kartaZw.replaceChildren();
  if (zwyciezca) {
    const imie = document.createElement('p');
    imie.className = 'zwyciezca-imie';
    imie.textContent = `🏆 ${zwyciezca.imie}`;
    const punkty = document.createElement('p');
    punkty.className = 'zwyciezca-punkty';
    punkty.textContent = `${zwyciezca.punkty} pkt`;
    const detale = document.createElement('p');
    detale.className = 'zwyciezca-detale';
    detale.textContent = `poprawne ${zwyciezca.poprawne}/${zwyciezca.poprawne + zwyciezca.bledne}`;
    kartaZw.append(imie, punkty, detale);
  } else {
    const p = document.createElement('p');
    p.textContent = 'Brak zwycięzcy — żadna odpowiedź nie została zapisana.';
    kartaZw.appendChild(p);
  }

  // 1b. wariant weryfikacji pytań (ADR 0032): Q tylko dla zweryfikowanych.
  const fcEl = $('gra-wynik-factcheck');
  fcEl.replaceChildren();
  if (factcheckBiezacejSesji()) {
    const opis = document.createElement('span');
    opis.textContent = ' Pytania zweryfikowane w sieci (fact check)';
    fcEl.append(znaczekFactcheck(), opis);
  } else {
    fcEl.textContent = 'Pytania z pamięci modelu (bez fact-check — możliwe zmyślone fakty)';
  }

  // 2. ranking — tabela jak w M6 (miejsce, gracz, punkty, poprawne)
  const tbody = $('gra-wyniki-tbody');
  tbody.replaceChildren();
  for (const id of wynik.ranking) {
    const g = wynik.gracze.find((gracz) => gracz.id === id);
    if (!g) continue;
    const wiersz = document.createElement('tr');
    for (const komorka of [`${g.imie}${id === wynik.zwyciezca ? ' 🏆' : ''}`, String(g.punkty), `${g.poprawne}/${g.poprawne + g.bledne}`]) {
      const td = document.createElement('td');
      td.textContent = komorka;
      wiersz.appendChild(td);
    }
    tbody.appendChild(wiersz);
  }

  // 4. statystyki gry (dt/dd — na 360 px dwie kolumny, liczby tabular-nums)
  stanWysylkiWyniku(''); // los wysyłki z poprzedniej gry nie zostaje na ekranie
  const dl = $('gra-wynik-statystyki');
  dl.replaceChildren();
  const pary = [
    ['zaliczone', `${wynik.zaliczoneStacje} z ${r.stacje.length}`],
    ['pominięte', String(wynik.pominietaStacje)],
    ['stacje bez pytań', wynik.stacjeBezPytan.length ? wynik.stacjeBezPytan.map((s) => `#${s}`).join(', ') : 'brak'],
    ['zdarzenia w dzienniku', String(wynik.zdarzen)],
  ];
  for (const [etykieta, wartosc] of pary) {
    const dt = document.createElement('dt');
    dt.textContent = `${etykieta}:`;
    const dd = document.createElement('dd');
    dd.textContent = wartosc;
    dl.append(dt, dd);
  }

  // 5. szczegóły graczy — karty z pełnymi polami podsumowanie()
  const karty = $('gra-wynik-gracze');
  karty.replaceChildren();
  for (const id of wynik.ranking) {
    const g = wynik.gracze.find((gracz) => gracz.id === id);
    if (!g) continue;
    const karta = document.createElement('div');
    karta.className = 'gracz-karta';
    const naglowek = document.createElement('p');
    naglowek.className = 'naglowek';
    naglowek.textContent = `${g.imie}${id === wynik.zwyciezca ? ' 🏆' : ''} · ${g.punkty} pkt`;
    const rozbicie = document.createElement('p');
    rozbicie.className = 'rozbicie';
    rozbicie.textContent = `${g.punkty} pkt · poprawne ${g.poprawne}, błędne ${g.bledne}`;
    const odcinki = document.createElement('p');
    odcinki.className = 'odcinki';
    odcinki.textContent = `odcinki: ${g.odcinki} · dystans ${dystansTekst(g.dystansM)} · ręczne dojścia: ${g.reczneDojscia}`;
    karta.append(naglowek, rozbicie, odcinki);
    karty.appendChild(karta);
  }

  // 6. stacje — zwarta tabela: kto, stan z trybem dojścia, czas, punkty
  const tStacje = $('gra-wynik-stacje-tbody');
  tStacje.replaceChildren();
  for (const s of wynik.stacje) {
    const wiersz = document.createElement('tr');
    for (const komorka of [
      String(s.id),
      s.gracz != null ? (imiona.get(s.gracz) ?? `#${s.gracz}`) : '—',
      etykietaOdcinka(s),
      String(s.punkty),
    ]) {
      const td = document.createElement('td');
      td.textContent = komorka;
      wiersz.appendChild(td);
    }
    tStacje.appendChild(wiersz);
  }

  // 7. tekst wyniku i eksport (M7/P4): tekst żyje w polu readonly i w STAN;
  //    przyciski widoczne tylko gdy ich ścieżka istnieje (plan M7, decyzja 8)
  const tekst = wynikTekstowy({
    podsumowanie: wynik,
    konfig: STAN.konfig,
    miejsce: STAN.miejsce ? STAN.miejsce : null,
    data: dataWynikuTekst(),
    przerwana: STAN.graZakonczonaRecznie && r.faza !== FAZY.koniec,
  });
  STAN.wynikTekst = tekst;
  $('pole-wynik-tekst').value = tekst;
  $('przycisk-udostepnij-wynik').hidden = !(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  $('przycisk-kopiuj-wynik').hidden = !(typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.writeText));
  $('przycisk-udostepnij-obraz').hidden = !(typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && typeof File === 'function');
}

/** Nazwa pliku z obrazem wyniku (M7/P5) — ten sam oczyszczony kod gry. */
function nazwaPlikuObrazuWyniku(kodGry) {
  return `okolica-${oczyscKodGry(kodGry)}.wynik.png`;
}

/** Paleta awaryjna — wartości 1:1 z `:root` w styles.css (motyw jasny).
 *  Obraz musi mieć kolory nawet gdy `getComputedStyle` zawiedzie. */
const PALETA_AWARYJNA = Object.freeze({
  tlo: '#f6f2e9', karta: '#fffdf8', tekst: '#1d2321', tekstSlaby: '#5c6663',
  akcent: '#2f6f4f', linia: '#d9d2c3', ostrzezenie: '#b4531f',
});

/** Konkretne kolory z ról planu: zmienne CSS bieżącego motywu (plan M7, ryzyko
 *  „toBlob i motywy") — ciemny motyw nie rozjeżdża się z czystym planem. */
function paletaZCss() {
  const paleta = { ...PALETA_AWARYJNA };
  try {
    const style = typeof window !== 'undefined' && window.getComputedStyle
      ? window.getComputedStyle(document.documentElement)
      : null;
    if (style) {
      for (const [rola, zmienna] of Object.entries(ROLE_PALETY)) {
        const wartosc = String(style.getPropertyValue(zmienna) ?? '').trim();
        if (wartosc) paleta[rola] = wartosc;
      }
    }
  } catch (e) {
    void e; // awaryjna paleta to nie wstyd — gorszy byłby brak obrazu
  }
  return paleta;
}

/** Cienki wykonawca planu (wzorzec mapy z M2): tylko przekazuje komendy do
 *  kontekstu 2d — zero matematyki i zero decyzji w warstwie DOM. */
function rysujWynikNaCanvas(plan, canvas, paleta) {
  canvas.width = plan.szerokosc;
  canvas.height = plan.wysokosc;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('brak kontekstu 2d canvas w tej przeglądarce');
  const kolor = (rola) => paleta[rola] ?? paleta.tekst;
  for (const k of plan.komendy) {
    if (k.typ === 'prostokat') {
      ctx.fillStyle = kolor(k.kolorRola);
      ctx.fillRect(k.x, k.y, k.w, k.h);
    } else if (k.typ === 'tekst') {
      ctx.fillStyle = kolor(k.kolorRola);
      ctx.font = `${k.waga ?? 400} ${k.rozmiar}px system-ui, -apple-system, Segoe UI, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(k.tekst, k.x, k.y);
    } else if (k.typ === 'linia') {
      ctx.strokeStyle = kolor(k.kolorRola);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(k.x1, k.y1);
      ctx.lineTo(k.x2, k.y2);
      ctx.stroke();
    }
  }
  return canvas;
}

/** Eksport obrazu wyniku (ADR 0010 pkt 5): plan → canvas → PNG → share albo
 *  plik. `udostepnij=true` próbuje `navigator.share({files})` i uczciwie degra
 *  do pobrania, gdy przeglądarka nie umie dzielić się plikami. */
async function eksportujWynikObraz(udostepnij = false) {
  const r = STAN.rozgrywka;
  if (!r) return;
  try {
    const plan = planObrazuWyniku({
      podsumowanie: podsumowanie(r),
      konfig: STAN.konfig,
      miejsce: STAN.miejsce ? STAN.miejsce : null,
      data: dataWynikuTekst(),
      przerwana: STAN.graZakonczonaRecznie && r.faza !== FAZY.koniec,
    });
    const nazwa = nazwaPlikuObrazuWyniku(r.kodGry ?? STAN.konfig?.kodGry);
    const canvas = document.createElement('canvas');
    rysujWynikNaCanvas(plan, canvas, paletaZCss());
    const blob = await new Promise((rozwiaz) => canvas.toBlob(rozwiaz, 'image/png'));
    if (!blob) throw new Error('toBlob nie zwrócił obrazu');
    const plik = typeof File === 'function' ? new File([blob], nazwa, { type: 'image/png' }) : null;
    if (udostepnij && plik && typeof navigator.canShare === 'function' && navigator.canShare({ files: [plik] })) {
      await navigator.share({ title: 'Tajemnicza okolica — wynik gry', files: [plik] });
      return; // udostępnione systemowo — plik nie jest potrzebny
    }
    pobierzPlik(nazwa, blob, 'image/png');
    status(udostepnij
      ? 'Udostępnianie obrazu niedostępne w tej przeglądarce — obraz wyniku zapisany jako plik .png.'
      : 'Obraz wyniku zapisany jako plik .png.');
  } catch (e) {
    if (e?.name === 'AbortError') return; // rezygnacja z udostępniania jest cicha
    status(`Nie udało się zapisać obrazu wyniku: ${e?.message ?? e}. Eksport tekstowy (.txt) działa bez canvas.`);
  }
}

/* ---------------------------------------------------------------- prompt */

function budujPromptEkran() {
  // ADR 0032: checkbox wybiera wariant — domyślnie (pusty) pytania bez
  // weryfikacji z pamięci modelu; zaznaczony to twarda kwerenda w sieci.
  const factcheck = $('prompt-factcheck').checked === true;
  STAN.promptFactcheck = factcheck;
  const wynik = zbudujPrompt({
    konfig: STAN.konfig,
    okolica: { lat: STAN.pozycja.lat, lon: STAN.pozycja.lon, promienM: STAN.konfig.promienM, miejsce: STAN.miejsce ?? '' },
    stacje: STAN.stacje,
    factcheck,
  });
  pokazBledy('bledy-prompt', wynik.usterki);
  STAN.prompt = wynik.prompt;
  $('pole-prompt').value = wynik.prompt ?? '';
  $('prompt-licznik').textContent = wynik.prompt
    ? `${wynik.prompt.length} znaków · ${liczbaPytan(STAN.konfig)} pytań · ${STAN.konfig.liczbaStacji} stacji · protokół ${factcheck ? WERSJA_PROTOKOLU_REV2 : WERSJA_PROTOKOLU_REV3}`
    : 'prompt nie został zbudowany';
  $('prompt-podglad-naglowek').textContent = `Pokaż treść promptu (${factcheck ? 'z fact check' : 'bez fact-check'})`;
  $('prompt-tryb-opis').textContent = factcheck
    ? `Tryb: pytania z fact check (szablon ${SZABLON_WERSJA}) — model sprawdza każdy fakt w sieci, odpowiedź wraca w minuty; każde pytanie ma źródła.`
    : `Tryb: pytania bez fact-check (szablon ${SZABLON_WERSJA_BEZ_WERYFIKACJI}) — model korzysta z własnej wiedzy, odpowiedź wraca w sekundy; możliwe zmyślone fakty.`;
  // B21: prompt jest stały (~1,4 tys. tokenów) niezależnie od liczby pytań —
  // rośnie ODPOWIEDŹ modelu (~210 tokenów na pytanie), a to ona mieści się albo
  // nie w limicie wyjścia. Mówimy o tym ZANIM właściciel zmarnuje generację:
  // ucięty JSON wraca jako E01/E02 bez wskazania prawdziwej przyczyny.
  const ilePytan = liczbaPytan(STAN.konfig);
  const rozmiar = szacunekOdpowiedzi(ilePytan);
  const elRozmiar = $('prompt-rozmiar');
  elRozmiar.hidden = !wynik.prompt;
  elRozmiar.textContent = wynik.prompt
    ? `Odpowiedź modelu będzie miała około ${Math.round(rozmiar.znaki / 100) / 10} tys. znaków (~${Math.round(rozmiar.tokeny / 100) / 10} tys. tokenów) dla ${ilePytan} pytań.`
      + (rozmiar.tokeny > PROG_ODPOWIEDZI_TOKENY
        ? ' To więcej niż limit wyjścia części modeli — jeśli wróci ucięty JSON, zmniejsz liczbę graczy albo stacji i wygeneruj pytania jeszcze raz.'
        : '')
    : '';
  $('przycisk-dalej-paczka').disabled = !wynik.prompt;
}

async function kopiujTekst(tekst, przycisk, etykieta, idPolaZapasowego = 'pole-prompt') {
  const przywroc = () => { przycisk.textContent = etykieta; };
  przycisk.textContent = (await kopiujDoSchowka(tekst, idPolaZapasowego)) ? '✓ skopiowano' : '⚠ zaznaczone — skopiuj ręcznie';
  window.setTimeout(przywroc, 2500);
}

/**
 * Kopiowanie trzema szczeblami — jeden klik ma KOPIOWAĆ, nie zaznaczać:
 * 1) `navigator.clipboard.writeText` (nowoczesne przeglądarki);
 * 2) `document.execCommand('copy')` na tymczasowym polu — działa tam, gdzie
 *    iframe albo uprawnienia blokują schowek asynchroniczny, i nie zależy
 *    od tego, czy `<details>` z polem jest rozwinięty;
 * 3) ostatnia deska: rozwiń `<details>` i zaznacz tekst w polu ekranowym —
 *    użytkownik dokończy ręcznie. Zwraca true, gdy tekst TRAFIŁ do schowka.
 */
async function kopiujDoSchowka(tekst, idPolaZapasowego) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(tekst);
      return true;
    }
  } catch (e) { void e; }
  try {
    if (typeof document.execCommand === 'function') {
      const tymczasowe = document.createElement('textarea');
      tymczasowe.value = tekst;
      tymczasowe.setAttribute('readonly', '');
      tymczasowe.style.position = 'fixed';
      tymczasowe.style.opacity = '0';
      document.body.appendChild(tymczasowe);
      tymczasowe.select();
      const ok = document.execCommand('copy');
      tymczasowe.remove();
      if (ok) return true;
    }
  } catch (e) { void e; }
  try {
    // Schowek nieosiągalny w żaden sposób — zaznacz tekst i każ skopiować
    // ręcznie. Zero komunikatu „nie działa" bez wyjścia.
    const pole = $(idPolaZapasowego);
    if (!pole) return false;
    const zwiniety = typeof pole.closest === 'function' ? pole.closest('details') : null;
    if (zwiniety) zwiniety.open = true; // schowane pole zaznaczyłoby się w próżnię
    pole.focus();
    pole.setSelectionRange(0, pole.value.length);
  } catch (e) { void e; }
  return false;
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
  wynik.hidden = false;
  listaUsterek.replaceChildren();

  if (!paczka) {
    wynik.dataset.stan = 'blad';
    $('wynik-naglowek').textContent = 'Nie da się odczytać odpowiedzi';
    // E02: znacznika nie ma (nieparsowalne) — korekta celuje w wariant,
    // który organizator właśnie zbudował (stan checkboxa z ekranu promptu).
    STAN.poprawkaFactcheck = STAN.promptFactcheck;
    STAN.usterkiPaczki = [blad];
    STAN.paczka = null;
    renderujUsterki([blad]);
    $('przycisk-poprawka').hidden = false;
    status('Odpowiedź odrzucona na etapie odczytu (parsowanie JSON albo kontener).');
    return;
  }

  // Q2 (PROTOKOL §3.4): wariant odwrócony odkodowujemy PRZED walidacją —
  // dalej płynie postać czytelna z markerem PYT/1.0.
  const bylaOdwrocona = czyPaczkaOdwrocona(paczka);
  let wariant = 'rev1';
  if (paczka.protokol === WERSJA_PROTOKOLU_REV2) wariant = 'rev2';
  if (paczka.protokol === WERSJA_PROTOKOLU_REV3) wariant = 'rev3';
  const robocza = (paczka.protokol === WERSJA_PROTOKOLU_REV2 || paczka.protokol === WERSJA_PROTOKOLU_REV3)
    ? odkodujPaczkeRev2(paczka)
    : odkodujPaczkeRev1(paczka);
  const usterki = walidujPaczke(robocza, oczekiwane());
  STAN.usterkiPaczki = usterki;
  // Korekta celuje w profil walidacji wklejki (znacznik), nie w checkbox —
  // wklejona paczka rev2 ma dostać przypomnienie o kwerendzie także wtedy,
  // gdy checkbox jest akurat pusty.
  STAN.poprawkaFactcheck = czyWariantFactcheck(paczka);
  if (usterki.length) {
    wynik.dataset.stan = 'blad';
    STAN.paczka = null;
    $('wynik-naglowek').textContent = `Paczka odrzucona — usterek: ${usterki.length}`;
    renderujUsterki(usterki);
    $('przycisk-poprawka').hidden = false;
    status('Paczka odrzucona przez walidator (protokół PYT §6).');
    return;
  }

  wynik.dataset.stan = 'ok';
  STAN.paczka = normalizujTematyPaczki(robocza);
  const weryfikacja = czyWariantFactcheck(robocza) ? 'fact check' : 'bez fact-check';
  $('wynik-naglowek').textContent = bylaOdwrocona
    ? `Paczka przyjęta (odwrócona, ${wariant} — odkodowana; ${weryfikacja})`
    : `Paczka przyjęta (${weryfikacja})`;
  $('przycisk-poprawka').hidden = true;
  renderujUsterki([]);
  // Pole wklejenia jest czyszczone natychmiast: plaintext nie zostaje w DOM
  // (ADR 0007 pkt 4). Paczka żyje w pamięci modułu.
  $('pole-odpowiedz').value = '';
  wyslijZestawNaDrive();
  // Decyzja właściciela 2026-09-07: poprawna paczka = OD RAZU gra. Podgląd,
  // ściąganie i edycja nie są graczowi potrzebne — to zadania właściciela
  // na Drive, dokąd zestaw właśnie poleciał. Guard startGry pilnuje
  // kolejności kroków, gdyby ktoś tu dotarł bez pozycji albo stacji.
  startGry();
}

/**
 * M9b/D2+D3: automatyczna wysyłka zestawu na Drive w chwili przyjęcia
 * (decyzja właściciela 2026-09-07: prywatna aplikacja — wysyłka DOMYŚLNA,
 * bez checkboxa i bez przypominajki; checkbox z 2026-09-06 usunięty).
 * Brak adresu mostu, pozycji albo fetch = zero wysyłki i JAWNY status
 * (LESSONS L6). POST text/plain omija preflight CORS (plan M9b).
 */
function wyslijZestawNaDrive() {
  const url = adresMostu(); // ADR 0020: jeden adres z kodu aplikacji
  if (!url) {
    status('Paczka przyjęta. Nie wysłano na Drive: brak adresu repozytorium w tej wersji aplikacji — paczka zostaje na tym telefonie.' + ADR(' (ADR 0020)'));
    return;
  }
  if (!STAN.pozycja || !STAN.stacje.length || !STAN.paczka) {
    status('Paczka przyjęta. Wysyłka na Drive pominięta: brak pozycji albo stacji w tej sesji.');
    return;
  }
  const plik = zbudujPlikZestawu({
    stacje: STAN.stacje,
    kontener: zapakujPaczke(STAN.paczka, WERSJA_PROTOKOLU),
    meta: metaBiezacejOkolicy(),
  });
  const f = fetchPrzegladarki(); // L18: nigdy gołe fetch
  if (!f) { status('Paczka przyjęta. Nie wysłano na Drive: to środowisko nie ma fetch.'); return; }
  f(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(plik),
  })
    .then((odp) => odp.json().catch(() => ({})))
    .then((wynik) => {
      if (wynik?.ok && wynik.status === 'przyjeta-do-przegladu') {
        status('Paczka przyjęta i WYSŁANA na Drive: czeka na Twój przegląd — e-mail z linkiem przyjdzie za chwilę.');
      } else if (wynik?.ok) {
        status(`Paczka przyjęta; taki zestaw już jest na Drive (${wynik.status}) — duplikat nie powstał.`);
      } else {
        status(`Paczka przyjęta, ale Drive odrzucił wysyłkę: ${wynik?.blad ?? 'nieznany błąd mostu'} — gra toczy się dalej.`);
      }
    })
    .catch(() => status('Paczka przyjęta, ale wysyłka na Drive nie udała się (sieć albo most) — gra toczy się dalej; możesz też zapisać plik i wnieść go ręcznie.'));
}

function renderujUsterki(usterki) {
  // replaceChildren, nie innerHTML='' (LESSONS L19): atrapa i przeglądarka
  // zachowują się wtedy identycznie, a stare wiersze nie zalegają w DOM
  $('wynik-usterki').replaceChildren(...usterki.map((u) => {
    const li = document.createElement('li');
    const kod = document.createElement('code');
    kod.textContent = u.kod ?? '';
    li.append(kod);
    // Komunikaty cytują dane z zewnątrz (meta paczki, odpowiedź mostu), więc
    // tekst idzie przez textContent — innerHTML wykonałby znacznik z paczki.
    if (u.pole) {
      const pole = document.createElement('strong');
      pole.textContent = ` ${u.pole}`;
      const reszta = document.createElement('span');
      reszta.textContent = ` — ${u.komunikat ?? ''}`;
      li.append(pole, reszta);
    } else {
      const reszta = document.createElement('span');
      reszta.textContent = ` ${u.komunikat ?? ''}`;
      li.append(reszta);
    }
    return li;
  }));
}

function nazwaPlikuWyniku(kodGry) {
  return `okolica-${oczyscKodGry(kodGry)}.wynik.txt`;
}


/* ------------------------- sygnały (M10/T4), Service Worker (M10/T2), bateria (M10/T3) */

let kontekstAudio = null;

/** Czy sygnały są włączone? Domyślnie TAK; `okolica:sygnaly`='0' wyłącza. */
function sygnalyWlaczone() {
  return czySygnalyWlaczone(typeof localStorage !== 'undefined' ? localStorage.getItem(KLUCZ_SYGNALOW) : null);
}

/**
 * Nuty z oscylatora Web Audio — zero plików dźwiękowych, zero zależności
 * (ADR 0001). Kontekst tworzony leniwie: pierwszy sygnał zawsze następuje po
 * geście użytkownika, więc polityka autoplay przeglądarek jest spełniona.
 * Każda awaria jest cicha: dźwięk to ozdoba, nie rozgrywka (LESSONS L6).
 */
function odegrajDzwieki(nuty) {
  try {
    const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (typeof Ctx !== 'function') return;
    kontekstAudio ??= new Ctx();
    if (kontekstAudio.state === 'suspended') kontekstAudio.resume?.();
    let t = kontekstAudio.currentTime;
    for (const nuta of nuty) {
      const osc = kontekstAudio.createOscillator();
      const gain = kontekstAudio.createGain();
      osc.type = 'sine';
      osc.frequency.value = nuta.czHz;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + nuta.ms / 1000);
      osc.connect(gain);
      gain.connect(kontekstAudio.destination);
      osc.start(t);
      osc.stop(t + nuta.ms / 1000 + 0.03);
      t += nuta.ms / 1000 + 0.05;
    }
  } catch { /* brak AudioContext albo zablokowany — gramy dalej bez dźwięku */ }
}

/** Wykonuje plan sygnału (wibracja + dźwięk); czysta decyzja w `sygnaly.js`. */
function odegrajSygnal(zdarzenie) {
  const plan = planSygnalu(zdarzenie, { wlaczone: sygnalyWlaczone() });
  if (!plan) return;
  try {
    if (plan.wibracjaMs && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(plan.wibracjaMs);
  } catch { /* brak wibracji (desktop, iOS) jest normalny */ }
  if (plan.dzwiek?.length) odegrajDzwieki(plan.dzwiek);
}

/** „🔔 sygnały": przełącznik + zapis + potwierdzenie (klik = gest, może grać). */
function przelaczSygnaly() {
  const wlaczone = !sygnalyWlaczone();
  if (typeof localStorage !== 'undefined') localStorage.setItem(KLUCZ_SYGNALOW, wlaczone ? '1' : '0');
  $('przycisk-sygnaly').setAttribute('aria-pressed', String(wlaczone));
  status(wlaczone
    ? 'Sygnały włączone: wibracja i dźwięk przy dojściu do stacji, starcie odcinka i ocenie odpowiedzi.'
    : 'Sygnały wyłączone — gra toczy się bez dźwięku i wibracji.');
  if (wlaczone) odegrajSygnal('poprawna');
}

/**
 * M10/T2: rejestracja Service Workera — offline skorupa + kafelki ostatniej
 * okolicy (`sw.js`). Tylko po http(s) (na file: SW nie działa) i tylko gdy
 * przeglądarka go ma; awaria rejestracji jest cicha (offline to dodatek).
 */
function zarejestrujServiceWorker() {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register('./sw.js');
  } catch { /* brak SW = zwykła gra online */ }
}

/**
 * M10/T3: „budzenie przy zbliżaniu" — w trasie GPS oszczędny, przy stacji
 * dokładny. Decyduje czysta `profilBaterii` (histereza 250/150 m); zmiana
 * profilu = restart watchera z nowymi opcjami i JAWNY status (LESSONS L6).
 * Bez aktywnego watchera (tryb testowy, symulacja, pauza) nie robi nic.
 */
function dostosujProfilGps(dystansM) {
  if (!STAN.watcher || STAN.trybTestowy) return;
  const nowy = profilBaterii({ poprzedni: STAN.profilGps, dystansM });
  if (nowy === STAN.profilGps) return;
  STAN.profilGps = nowy;
  wlaczGps();
  status(nowy === 'oszczedny'
    ? 'GPS w trybie oszczędnym — do stacji daleko, bateria odpoczywa; pełna dokładność wróci przy stacji.'
    : 'GPS w trybie dokładnym — jesteś blisko stacji, łapiemy dojście z metrów.');
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

/* ================================ M11/P4: gra na wielu urządzeniach (ADR 0019) */

/** Adres mostu gier (ADR 0020): wpisany w kod aplikacji — ten sam web app co repozytorium paczek i rankingi. */
function urlMostuMulti() {
  return adresMostu();
}

/**
 * `window.fetch`, nie gołe `fetch` (LESSONS L18): Node ≥ 18 ma globalny fetch
 * i testy na atrapie DOM wołałyby prawdziwą sieć. Zwraca funkcję albo null
 * (środowisko bez fetch — wołający degraduje się JAWNIE, nigdy po cichu).
 */
function fetchPrzegladarki() {
  return typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
}

/** GET do mostu z limitem 8 s i jawnym błędem — współdzielony przez lobby, indeks i wznowienie. */
/**
 * Nasz własny limit czasu (8 s) przerywa żądanie przez `AbortController`,
 * a przeglądarka opisuje to PO ANGIELSKU i od swojej strony: Chrome daje
 * „signal is aborted without reason", Firefox „The user aborted a request.".
 * Dla gracza to bełkot, więc rozróżniamy nasze przerwanie od prawdziwej awarii
 * sieci i zawsze oddajemy komunikat po polsku (LESSONS: komunikat musi nazywać
 * przyczynę, nie wyjątek).
 */
function bladMostuPoPolsku(e, { przekroczonyCzas, url }) {
  if (przekroczonyCzas) return new Error('most Drive nie odpowiedział w 8 sekund — sprawdź połączenie albo spróbuj za chwilę');
  const tekst = String(e?.message ?? e ?? '');
  if (e?.name === 'AbortError' || /abort/i.test(tekst)) {
    return new Error('połączenie z mostem Drive zostało przerwane — spróbuj jeszcze raz');
  }
  if (/failed to fetch|networkerror|load failed/i.test(tekst)) {
    return new Error('brak połączenia z mostem Drive — telefon jest offline albo adres repozytorium nie odpowiada');
  }
  return new Error(`${tekst}${url ? ` (${url})` : ''}`);
}

async function pobierzGetMulti(url) {
  const f = fetchPrzegladarki(); // L18: nigdy gołe fetch
  if (!f) throw new Error('to środowisko nie ma fetch — nie da się zapytać mostu');
  const kontroler = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let przekroczonyCzas = false;
  const timer = setTimeout(() => { przekroczonyCzas = true; kontroler?.abort(); }, 8000);
  try {
    const odp = await f(url, kontroler ? { signal: kontroler.signal } : undefined);
    if (!odp.ok) throw new Error(`HTTP ${odp.status}`);
    return await odp.json();
  } catch (e) {
    throw bladMostuPoPolsku(e, { przekroczonyCzas, url: null });
  } finally {
    clearTimeout(timer);
  }
}

/** GET, którego odpowiedź jest tekstem (indeks/paczka z repo — jak w M9b). */
async function pobierzGetTekst(url) {
  const f = fetchPrzegladarki(); // L18: nigdy gołe fetch
  if (!f) throw new Error('to środowisko nie ma fetch — nie da się zapytać mostu');
  const kontroler = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => kontroler?.abort(), 8000);
  try {
    const odp = await f(url, kontroler ? { signal: kontroler.signal } : undefined);
    if (!odp.ok) throw new Error(`HTTP ${odp.status}`);
    return await odp.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Usterki gotowości (pseudonim, zgoda, most) jako tekst do `pokazBledy`. */
function pokazBledyMulti(komunikaty) {
  pokazBledy('bledy-multi', komunikaty.map((komunikat) => ({ komunikat })));
  if (komunikaty.length) status(komunikaty[0]);
}

/**
 * Walidacja przed KAŻDĄ wysyłką na most. Zgody NIE sprawdzamy (właściciel,
 * 2026-09-07): gra na wielu telefonach z natury działa przez wspólny Drive,
 * a co i dokąd trafia opisuje sekcja „Dane i prywatność". Kto nie chce
 * wysyłać niczego, gra w hot-seat.
 */
function walidujGotowoscMulti() {
  const usterki = [];
  const pseudonim = ($('multi-pseudonim').value ?? '').trim();
  if (!pseudonim) usterki.push('Wpisz pseudonim — widzą go inni gracze w lobby i w wynikach.');
  else if (pseudonim.length > 24) usterki.push('Pseudonim może mieć najwyżej 24 znaki.');
  if (!urlMostuMulti()) usterki.push('Brak adresu mostu w tej wersji aplikacji (ADR 0020) — gra na wielu urządzeniach jest wyłączona. Wybierz rodzaj gry „Hot-seat", żeby grać na jednym telefonie.');
  return usterki;
}

function wczytajUstawieniaMulti() {
  pokazStanMostu(); // adres mostu jest w kodzie (ADR 0020) — UI pokazuje stan, nie pole do wpisywania
  if (typeof localStorage === 'undefined') return;
  $('multi-pseudonim').value = localStorage.getItem(KLUCZ_PSEUDONIMU) ?? '';
  if (localStorage.getItem(KLUCZ_RODZAJU_GRY) === 'multi') {
    STAN.rodzajGry = 'multi';
    $('setup-rodzaj').value = 'multi';
  }
}

function renderujRodzajGry() {
  $('karta-multi').hidden = STAN.rodzajGry !== 'multi';
}

/* --- sesja multi w localStorage: powrót do gry po zgaszeniu ekranu/odświeżeniu --- */

function zapiszSesjeMulti() {
  if (typeof localStorage === 'undefined' || !STAN.multi) return;
  const m = STAN.multi;
  try {
    localStorage.setItem(KLUCZ_SESJI_MULTI, JSON.stringify({
      kod: m.gra.kod, idGry: m.gra.idGry ?? null, graczId: m.graczId,
      pseudonim: m.pseudonim, urlMostu: m.urlMostu, rola: m.rola, zapisano: new Date().toISOString(),
    }));
  } catch { /* quota — gra toczy się dalej, tylko bez powrotu po odświeżeniu */ }
}

function czytajSesjeMulti() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const s = JSON.parse(localStorage.getItem(KLUCZ_SESJI_MULTI) ?? 'null');
    return s && typeof s.kod === 'string' && typeof s.graczId === 'string' && typeof s.urlMostu === 'string' && s.urlMostu ? s : null;
  } catch {
    return null;
  }
}

function usunSesjeMulti() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KLUCZ_SESJI_MULTI);
}

function renderujWznowienieMulti() {
  const sesja = czytajSesjeMulti();
  const karta = $('multi-wznowienie');
  if (!sesja || STAN.multi) { karta.hidden = true; return; }
  karta.hidden = false;
  $('multi-wznowienie-opis').textContent = `Telefon pamięta grę wieloosobową ${sesja.kod} (${sesja.rola === 'organizator' ? 'zakładałeś ją' : 'dołączyłeś'}). Gra żyje na serwerze — można do niej wrócić.`;
}

/* --- ekrany i panele --- */

function otworzPanelMulti(panel) {
  for (const nazwa of ['zaloz', 'dolacz', 'lobby']) $(`multi-panel-${nazwa}`).hidden = nazwa !== panel;
  pokazBledy('bledy-multi', []);
  pokazEkran('multi');
}

function renderujTrybyMulti() {
  const lista = $('multi-tryby');
  lista.replaceChildren();
  const etykiety = {
    wyscig: '🏁 Wyścig — wszyscy idą jednocześnie',
    tury: '🔁 Tury — stacje przypisane do graczy',
  };
  for (const klucz of [TRYBY_GRY.wyscig, TRYBY_GRY.tury]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'przycisk';
    b.textContent = etykiety[klucz];
    b.setAttribute('aria-pressed', String(STAN.multiTryb === klucz));
    b.addEventListener('click', () => {
      STAN.multiTryb = klucz;
      renderujTrybyMulti();
      $('multi-tryb-opis').textContent = klucz === TRYBY_GRY.tury
        ? 'Każda stacja ma stałego właściciela (kolejność z chwili startu). Serwer pilnuje kolejności: odpowiedzieć można dopiero, gdy poprzedni gracz zamknie swoją stację.'
        : 'Wszyscy idą tę samą trasę jednocześnie, każdy na swoim telefonie. Wygrywa najlepszy wynik — tabela jest żywa.';
    });
    lista.appendChild(b);
  }
  $('multi-tryb-opis').textContent = STAN.multiTryb === TRYBY_GRY.tury
    ? 'Każda stacja ma stałego właściciela (kolejność z chwili startu). Serwer pilnuje kolejności: odpowiedzieć można dopiero, gdy poprzedni gracz zamknie swoją stację.'
    : 'Wszyscy idą tę samą trasę jednocześnie, każdy na swoim telefonie. Wygrywa najlepszy wynik — tabela jest żywa.';
}

/**
 * Wariant weryfikacji bieżącej sesji (ADR 0032): z paczki w pamięci, a po
 * wznowieniu (plaintext tylko w kontenerze) przez odpakowanie. Nieznane = true.
 */
function factcheckBiezacejSesji() {
  if (STAN.paczka) return czyWariantFactcheck(STAN.paczka);
  if (STAN.kontenerPaczki) {
    const { paczka } = odpakujPaczke(STAN.kontenerPaczki);
    if (paczka) return czyWariantFactcheck(paczka);
  }
  return true;
}

/** Meta zestawu z sesji — bez pozycji liczymy od pierwszej stacji (uczciwe: i tak tam idziemy). */
function metaSesjiMulti(stacje) {
  const punkt = STAN.pozycja ?? (stacje.length ? { lat: stacje[0].lat, lon: stacje[0].lon } : null);
  if (!punkt) return null;
  return zbierzMetaZestawu({
    lat: punkt.lat, lon: punkt.lon,
    promienM: STAN.konfig.promienM, tematy: STAN.konfig.tematy, wiek: STAN.konfig.wiek,
    jezyk: STAN.konfig.jezyk, miejsce: STAN.miejsce ?? '',
    liczbaStacji: stacje.length, pytaniaNaStacje: STAN.konfig.pytaniaNaStacje,
    tematWlasny: STAN.konfig.tematWlasny ?? '',
    factcheck: factcheckBiezacejSesji(),
  });
}

/** Wpis lokalny ma metę spłaszczoną — zbieram pola potrzebne mostowi (bledyGryKandydata). */
function metaZWpisuLokalnego(z) {
  return {
    miejsce: z.miejsce, geohash5: z.geohash5, promienM: z.promienM, tematy: z.tematy,
    wiek: z.wiek, jezyk: z.jezyk, data: z.data, liczbaStacji: z.liczbaStacji, pytaniaNaStacje: z.pytaniaNaStacje,
    tematWlasny: z.tematWlasny ?? '',
    factcheck: z.factcheck ?? true,
  };
}

function odswiezZrodlaMulti() {
  const select = $('multi-zrodlo');
  select.replaceChildren();
  STAN.multiZrodlo = null;
  STAN.multiRepoMety = [];
  STAN.multiRepoUrl = adresMostu() || null; // ADR 0020: adres z kodu aplikacji
  const opcje = [];
  const sesjaGotowa = STAN.stacje.length > 0 && (STAN.kontenerPaczki || (STAN.paczka && STAN.usterkiPaczki.length === 0));
  if (sesjaGotowa) opcje.push({ value: 'sesja', tekst: `📦 Paczka z tej sesji (${STAN.stacje.length} stacji)` });
  for (const wpis of czytajRejestrZestawow()) {
    opcje.push({ value: `lokalna:${wpis.skrot}`, tekst: `📱 ${wpis.miejsce} · ${wpis.data} · ${wpis.liczbaStacji} stacji × ${wpis.pytaniaNaStacje} pytań · ${wpis.wiek}` });
  }
  for (const o of opcje) {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = o.tekst;
    select.appendChild(op);
  }
  if (!opcje.length) {
    $('multi-zaloz-info').textContent = 'Brak gotowych paczek. Przejdź zwykłą ścieżkę (pozycja → stacje → model → wklejenie) albo zagraj raz na tym telefonie — paczka się zapisze i wróci tu jako źródło.';
    return;
  }
  void zaladujZrodloMulti();
  // Repo Drive dokładamy asynchronicznie; awaria repo NIE blokuje zakładania (jak w M9/R3)
  if (STAN.multiRepoUrl && STAN.pozycja) {
    const kryteria = {
      geohash5: geohash(STAN.pozycja.lat, STAN.pozycja.lon, 5),
      lat: STAN.pozycja.lat, lon: STAN.pozycja.lon, // tolerancja okolicy (ADR 0024)
      promienM: STAN.konfig.promienM, liczbaStacji: STAN.konfig.liczbaStacji,
      pytaniaNaStacje: STAN.konfig.pytaniaNaStacje, tematy: STAN.konfig.tematy, wiek: STAN.konfig.wiek,
    };
    pobierzGetTekst(STAN.multiRepoUrl)
      .then((tekst) => dopasujMetaIndeksu(walidujIndeksSurowy(tekst).indeks, kryteria))
      .then((dopasowane) => {
        for (const meta of dopasowane) {
          STAN.multiRepoMety.push(meta);
          const op = document.createElement('option');
          op.value = `drive:${STAN.multiRepoMety.length - 1}`;
          op.textContent = `🌍 ${meta.miejsce} · ${meta.data} · ${meta.liczbaStacji} stacji × ${meta.pytaniaNaStacje} pytań · ${meta.wiek}`;
          select.appendChild(op);
        }
      })
      .catch(() => { /* repo niedostępne — zostają źródła z telefonu */ });
  }
}

async function zaladujZrodloMulti() {
  const wartosc = $('multi-zrodlo').value ?? '';
  STAN.multiZrodlo = null;
  $('multi-zaloz-info').textContent = 'Wczytuję paczkę…';
  try {
    if (wartosc === 'sesja') {
      const stacje = STAN.stacje.map((s) => ({ id: s.id, lat: s.lat, lon: s.lon, opis: s.opis ?? '' }));
      const kontener = STAN.kontenerPaczki ?? zapakujPaczke(STAN.paczka, WERSJA_PROTOKOLU);
      const meta = metaSesjiMulti(stacje);
      if (!meta) throw new Error('nie da się ustalić metadanych okolicy (brak pozycji i stacji)');
      STAN.multiZrodlo = { stacje, kontener, meta, opis: 'paczka z tej sesji' };
    } else if (wartosc.startsWith('lokalna:')) {
      const skrot = wartosc.slice('lokalna:'.length);
      const { zestaw, usterki } = walidujZestawLokalnySurowy(localStorage.getItem(kluczZestawu(skrot)) ?? '');
      if (!zestaw) throw new Error(usterki[0]?.komunikat ?? 'nieczytelna paczka');
      STAN.multiZrodlo = { stacje: zestaw.stacje, kontener: zestaw.kontener, meta: metaZWpisuLokalnego(zestaw), opis: `paczka z tego telefonu (${zestaw.miejsce})` };
    } else if (wartosc.startsWith('drive:')) {
      const meta = STAN.multiRepoMety[Number(wartosc.slice('drive:'.length))];
      if (!meta) throw new Error('wpis repozytorium zniknął — odśwież listę źródeł');
      const tekst = await pobierzGetTekst(urlPaczkiZRepo(STAN.multiRepoUrl, meta));
      const { zestaw, usterki } = walidujZestawPublicznySurowy(tekst);
      if (!zestaw) throw new Error(usterki[0]?.komunikat ?? 'nieczytelna paczka');
      STAN.multiZrodlo = { stacje: zestaw.stacje, kontener: zestaw.kontener, meta: zestaw.meta, opis: `paczka z Drive (${zestaw.meta.miejsce})` };
    } else {
      $('multi-zaloz-info').textContent = 'Wybierz źródło pytań i stacji.';
      return;
    }
    const z = STAN.multiZrodlo;
    $('multi-zaloz-info').textContent = `${z.opis}: ${z.stacje.length} stacji × ${z.meta.pytaniaNaStacje} pytań · ${z.meta.wiek} · tematy: ${z.meta.tematy.join(', ')} · ${z.meta.miejsce}.`;
  } catch (e) {
    $('multi-zaloz-info').textContent = `Nie udało się wczytać paczki: ${e?.message ?? e}. Wybierz inne źródło.`;
  }
}

/* --- zakładanie, dołączanie, lobby --- */

/**
 * M11/P5: w trybie testowym (`?odstep=0`) synchronizacja dostaje RĘCZNY
 * harmonogram — zero pollingu w tle, test sam pompuje kroki przez
 * `window.__MULTI_TIMERY__`. W przeglądarce: zwykły `setTimeout`.
 */
function harmonogramMulti() {
  if (STAN.odstepOverpassMs !== 0) return undefined;
  const timery = [];
  if (typeof window !== 'undefined') window.__MULTI_TIMERY__ = timery;
  return {
    ustaw: (fn) => { timery.push(fn); return timery.length - 1; },
    czysc: (id) => { timery[id] = null; },
  };
}

function wejdzDoGryMulti(gra, graczId, rola) {
  zatrzymajSyncMulti();
  STAN.multi = {
    rola, gra, graczId,
    pseudonim: ($('multi-pseudonim').value ?? '').trim(),
    urlMostu: urlMostuMulti(),
    ostatniStanMs: Date.now(),
    sync: null,
  };
  STAN.multiRezygnacjaUzbrojona = false;
  STAN.multi.sync = utworzSynchronizacje({
    urlMostu: STAN.multi.urlMostu,
    graczId,
    kod: gra.kod,
    idGry: gra.idGry ?? null,
    onStan: onStanGryMulti,
    onBlad: (komunikat) => { status(`Gra wieloosobowa: ${komunikat}`); renderujPasekSync(); },
    timeout: harmonogramMulti(),
  });
  zapiszSesjeMulti();
  renderujWznowienieMulti();
  otworzPanelMulti('lobby');
  onStanGryMulti(gra); // lobby widoczne od razu, nie po pierwszym pollingu
  STAN.multi.sync.start();
}

function zatrzymajSyncMulti() {
  STAN.multi?.sync?.stop();
  if (STAN.multi) STAN.multi.sync = null;
}

async function zalozGreMulti() {
  const usterki = walidujGotowoscMulti();
  if (usterki.length) { pokazBledyMulti(usterki); return; }
  if (!STAN.multiZrodlo) { pokazBledyMulti(['Najpierw wybierz i wczytaj paczkę z pytaniami (lista źródeł wyżej).']); return; }
  const z = STAN.multiZrodlo;
  status('Zakładam grę na mostku Drive…');
  try {
    const wynik = await polecenieMostu(urlMostuMulti(), {
      akcja: 'gra-zaloz',
      tryb: STAN.multiTryb,
      organizator: { pseudonim: ($('multi-pseudonim').value ?? '').trim() },
      konfiguracja: {
        liczbaStacji: z.stacje.length,
        pytaniaNaStacje: z.meta.pytaniaNaStacje,
        wiek: z.meta.wiek,
        tematy: z.meta.tematy,
        promienM: z.meta.promienM,
        miejsce: z.meta.miejsce ?? '',
        geohash5: z.meta.geohash5,
      },
      zestaw: { stacje: z.stacje, kontener: z.kontener, meta: z.meta },
    });
    status(`Gra założona — kod ${wynik.gra.kod}. Przekaż go innym graczom albo niech dołączą z listy gier w okolicy.`);
    wejdzDoGryMulti(wynik.gra, wynik.gra.organizatorId, 'organizator');
  } catch (e) {
    status(`Nie udało się założyć gry: ${e?.message ?? e}`);
  }
}

async function dolaczDoGryMulti({ kod = null, idGry = null } = {}) {
  const usterki = walidujGotowoscMulti();
  if (usterki.length) { pokazBledyMulti(usterki); otworzPanelMulti('dolacz'); return; }
  if (kod && !kodPoprawny(kod)) {
    pokazBledyMulti([`Kod „${kod}” jest niepoprawny: oczekuję 6 znaków z alfabetu ${ALFABET_KODU} (bez 0, O, 1, I).`]);
    return;
  }
  status(kod ? `Dołączam do gry ${kod}…` : 'Dołączam do gry z listy w okolicy…');
  try {
    const wynik = await polecenieMostu(urlMostuMulti(), {
      akcja: 'gra-dolacz', kod, idGry,
      pseudonim: ($('multi-pseudonim').value ?? '').trim(),
    });
    wejdzDoGryMulti(wynik.gra, wynik.graczId, 'gosc');
    status('Jesteś w grze — czekasz w lobby, aż organizator wystartuje.');
  } catch (e) {
    status(`Nie udało się dołączyć: ${e?.message ?? e}`);
  }
}

async function odswiezLobby() {
  const url = urlMostuMulti();
  const lista = $('multi-lobby-lista');
  if (!url) {
    $('multi-lobby-status').textContent = 'Brak adresu mostu w tej wersji aplikacji — lista gier w okolicy jest niedostępna.' + ADR(' (ADR 0020)');
    return;
  }
  $('multi-lobby-status').textContent = 'Pobieram listę gier z mostu Drive…';
  try {
    const odpowiedz = await pobierzGetMulti(urlGet(url, 'gry'));
    const { wpisy, usterki } = walidujLobbySurowe(JSON.stringify(odpowiedz ?? null));
    if (usterki.length && !wpisy.length) throw new Error(usterki[0].komunikat);
    const bliskie = STAN.pozycja ? filtrujLobby(wpisy, { geohash5: geohash(STAN.pozycja.lat, STAN.pozycja.lon, 5) }) : wpisy;
    lista.replaceChildren();
    for (const wpis of bliskie) {
      const li = document.createElement('li');
      const opis = document.createElement('span');
      const ramka = wpis.geohash5 ? ramkaGeohash(wpis.geohash5) : null;
      const dystans = ramka && STAN.pozycja
        ? ` · ok. ${Math.round(odlegloscM(STAN.pozycja, { lat: (ramka.latMin + ramka.latMax) / 2, lon: (ramka.lonMin + ramka.lonMax) / 2 }) / 100) / 10} km`
        : '';
      opis.textContent = `${wpis.miejsce || 'nieznane miejsce'} · ${wpis.tryb === TRYBY_GRY.tury ? 'tury' : 'wyścig'} · ${wpis.liczbaGraczy}/${MAKS_GRACZY} graczy · organizator: ${wpis.organizator ?? '?'}${dystans}`;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'przycisk przycisk-maly';
      b.textContent = 'Dołącz';
      b.addEventListener('click', () => { void dolaczDoGryMulti({ idGry: wpis.idGry }); });
      li.append(opis, b);
      lista.appendChild(li);
    }
    $('multi-lobby-status').textContent = bliskie.length
      ? (STAN.pozycja
        ? `Gry w Twojej okolicy (ta sama komórka geohash5 albo sąsiednia): ${bliskie.length}.`
        : `Otwarte gry: ${bliskie.length}. Ustaw pozycję (krok 2), żeby zobaczyć najbliższe — bez niej lista jest pełna.`)
      : 'Brak otwartych gier w tej okolicy — załóż własną albo dołącz z kodem.';
  } catch (e) {
    $('multi-lobby-status').textContent = `Nie udało się pobrać lobby: ${e?.message ?? e}. Nadal możesz dołączyć kodem.`;
  }
}

async function startLobby() {
  const m = STAN.multi;
  if (!m || m.rola !== 'organizator') return;
  status(`Startuję grę ${m.gra.kod}…`);
  try {
    const wynik = await polecenieMostu(m.urlMostu, {
      akcja: 'gra-start', kod: m.gra.kod, idGry: m.gra.idGry ?? null, organizatorId: m.graczId,
    });
    status(`Gra ${m.gra.kod} wystartowała — idźcie!`);
    onStanGryMulti(wynik.gra);
  } catch (e) {
    status(`Nie udało się wystartować gry: ${e?.message ?? e}`);
  }
}

function opuscLobby() {
  const m = STAN.multi;
  if (!m) { pokazEkran('setup'); return; }
  status(m.rola === 'organizator'
    ? 'Wychodzisz z lobby — gra bez organizatora nie wystartuje i po 24 h trafi do archiwum.'
    : 'Wychodzisz z lobby. Dopóki gra nie wystartowała, możesz dołączyć ponownie (kod albo lista).');
  zatrzymajSyncMulti();
  usunSesjeMulti();
  STAN.multi = null;
  renderujWznowienieMulti();
  pokazEkran('setup');
}

/** Powrót do gry po odświeżeniu telefonu: sesja z localStorage + stan z mostu. */
async function przywrocGreMulti() {
  const sesja = czytajSesjeMulti();
  if (!sesja) { status('Telefon nie pamięta żadnej gry wieloosobowej.'); return; }
  $('multi-pseudonim').value = sesja.pseudonim;
  status(`Wracam do gry ${sesja.kod}…`);
  try {
    const odpowiedz = await pobierzGetMulti(urlStanGry(sesja.urlMostu, { kod: sesja.kod, idGry: sesja.idGry }));
    if (!odpowiedz?.ok || !odpowiedz.gra) throw new Error(odpowiedz?.blad ?? 'most nie zwrócił stanu gry');
    const gra = odpowiedz.gra;
    if (gra.schemat !== SCHEMAT_GRY) throw new Error(`nieznany schemat gry: ${gra.schemat}`);
    if (!gra.gracze.some((g) => g.id === sesja.graczId)) throw new Error('nie ma Cię już na liście graczy tej gry');
    STAN.multi = {
      rola: sesja.rola, gra, graczId: sesja.graczId, pseudonim: sesja.pseudonim,
      urlMostu: sesja.urlMostu, ostatniStanMs: Date.now(), sync: null,
    };
    STAN.multi.sync = utworzSynchronizacje({
      urlMostu: sesja.urlMostu, graczId: sesja.graczId, kod: gra.kod, idGry: gra.idGry ?? null,
      onStan: onStanGryMulti,
      onBlad: (komunikat) => { status(`Gra wieloosobowa: ${komunikat}`); renderujPasekSync(); },
      timeout: harmonogramMulti(),
    });
    if (gra.stan === 'lobby') otworzPanelMulti('lobby');
    onStanGryMulti(gra); // 'trwa' → lokalna rozgrywka od niezamkniętych stacji
    STAN.multi?.sync?.start();
  } catch (e) {
    status(`Nie udało się wrócić do gry: ${e?.message ?? e}. Jeśli gra się zakończyła albo wygasła, porzuć zapamiętaną sesję.`);
  }
}

/* --- stan gry z serwera → lokalna rozgrywka i ekrany --- */

function onStanGryMulti(gra) {
  const m = STAN.multi;
  if (!m || !gra || gra.schemat !== SCHEMAT_GRY) return;
  // Stan z mostu WALIDUJEMY (kody R**), zanim dotknie renderu i maszynki tur:
  // uszkodzony stan to jawny status i czekanie na poprawny, nie TypeError
  // w pętli pollingu (wcześniej sprawdzaliśmy tylko `schemat`).
  const { gra: czysta, usterki } = walidujGreSurowa(JSON.stringify(gra));
  if (!czysta) {
    const u = usterki[0];
    status(`Most zwrócił uszkodzony stan gry ([${u?.kod ?? 'R?'}] ${u?.komunikat ?? 'nieznany powód'}) — czekam na poprawny, gra toczy się dalej.`);
    return;
  }
  m.gra = czysta;
  m.ostatniStanMs = Date.now();
  if (gra.stan === 'trwa' && !STAN.rozgrywka && STAN.ekran !== 'gra') uruchomGreMulti(gra);
  if (gra.stan === 'zakonczona' || gra.stan === 'archiwum') {
    zatrzymajSyncMulti();
    usunSesjeMulti();
    renderujWznowienieMulti();
    if (STAN.rozgrywka && STAN.rozgrywka.faza !== FAZY.koniec && !STAN.graZakonczonaRecznie) {
      STAN.graZakonczonaRecznie = true;
      status(gra.stan === 'archiwum'
        ? 'Lobby wygasło (24 h bez startu) — gra trafiła do archiwum.'
        : 'Gra wieloosobowa zakończona — wszystkie stacje zamknięte albo wszyscy zrezygnowali. Wyniki poniżej.');
      pokazWyniki();
      renderujGre();
    } else {
      status(gra.stan === 'archiwum' ? 'Ta gra wygasła w lobby (24 h bez startu).' : 'Gra zakończona — ostateczne wyniki w tabeli.');
    }
  }
  if (STAN.ekran === 'multi') renderujLobby();
  renderujPanelMulti();
  renderujPasekSync();
}

/**
 * Pytanie gracza w grze sieciowej (ADR 0027 część B pkt 2): paczka ma
 * `pytaniaNaStacje = liczbaGraczy` pytań przy każdej stacji, a pytanie `k`
 * należy do gracza `k`. Dzięki temu każde urządzenie zna swoje pytanie BEZ
 * negocjacji z innymi — nie ma wyścigu o pytanie ani blokady przy braku
 * zasięgu, a serwer nie musi rozstrzygać, kto pierwszy.
 *
 * Paczka mniejsza niż liczba graczy nie zostawia nikogo bez pytania: indeks
 * zawija się (`k mod liczba pytań stacji`), więc gracze dzielą pytanie. Gra i
 * tak toczy się na osobnych telefonach, a pusty zestaw pytań zatrzymałby
 * rozgrywkę — więc dzielenie jest tu mniejszym złem niż brak pytania.
 *
 * Reguła dotyczy obu trybów multi: w turach właściciel stacji też odpowiada na
 * jedno pytanie (serwer odrzuca drugą odpowiedź tego samego gracza do stacji).
 */
function pytaniaDlaGracza(paczka, { liczbaGraczy, indeksGracza }) {
  if (!(liczbaGraczy > 1) || !(indeksGracza >= 0)) return paczka;
  const przezStacje = new Map();
  for (const q of paczka.pytania) {
    const lista = przezStacje.get(q.stacja) ?? [];
    lista.push(q);
    przezStacje.set(q.stacja, lista);
  }
  const wybrane = new Set();
  for (const lista of przezStacje.values()) {
    // Paczka z `pytaniaNaStacje = liczbaGraczy` (domyślna po ADR 0027 część A)
    // daje każdemu WŁASNE pytanie. Starsza/mniejsza paczka nie zostawia gracza
    // bez pytania: indeks zawija się, więc gracze dzielą pytanie — w grze
    // sieciowej każdy odpowiada na swoim telefonie, więc to uczciwe, a brak
    // pytania zatrzymałby grę (rozgrywka wymaga niepustej paczki).
    wybrane.add(lista[indeksGracza % lista.length]);
  }
  return { ...paczka, pytania: paczka.pytania.filter((q) => wybrane.has(q)) };
}

/**
 * Lokalny silnik gry wieloosobowej: wyścig = wszystkie stacje w WOLNEJ
 * kolejności (ADR 0027 część B), tury = tylko własne (stacja i należy do
 * gracze[i % N] — kolejka USTALONA przy starcie, rezygnacje pomijają stacje,
 * nie przesuwają). Przy powrocie po odświeżeniu zamknięte już stacje nie
 * wracają — reszta rozgrywa się normalnie.
 */
function uruchomGreMulti(gra) {
  const m = STAN.multi;
  const { paczka, blad } = odpakujPaczke(gra.zestaw?.kontener);
  if (!paczka) {
    status(`Nie da się odsłonić pytań gry ${gra.kod}: ${blad?.komunikat ?? 'uszkodzony kontener'}.`);
    return;
  }
  const wszystkie = (gra.zestaw.stacje ?? []).map((s, i) => ({ id: s.id ?? i + 1, lat: s.lat, lon: s.lon, opis: s.opis ?? '' }));
  const N = gra.gracze.length;
  const mojIndeks = gra.gracze.findIndex((g) => g.id === m.graczId);
  const zamknietePrzezeMnie = new Set(
    gra.zdarzenia.filter((z) => z.graczId === m.graczId && z.typ === 'odpowiedz' && z.stacjaId != null).map((z) => Number(z.stacjaId)),
  );
  let moje = gra.tryb === TRYBY_GRY.tury ? wszystkie.filter((s, i) => i % N === mojIndeks) : wszystkie;
  moje = moje.filter((s) => !zamknietePrzezeMnie.has(Number(s.id)));
  if (!moje.length) {
    status(`Gra ${gra.kod} się toczy, ale nie masz już żadnych stacji do przejścia — śledź żywe wyniki na ekranie lobby.`);
    if (STAN.ekran !== 'multi') otworzPanelMulti('lobby');
    return;
  }
  const srodek = STAN.pozycja ? { lat: STAN.pozycja.lat, lon: STAN.pozycja.lon } : { lat: moje[0].lat, lon: moje[0].lon };
  const konfig = oczyscKonfiguracje({ ...STAN.konfig, liczbaGraczy: 1, imiona: [m.pseudonim], kodGry: gra.kod });
  // pytanie tego gracza przy każdej stacji (indeks = pozycja w `gra.gracze`)
  const paczkaGracza = pytaniaDlaGracza(paczka, { liczbaGraczy: N, indeksGracza: mojIndeks });
  m.indeksGracza = mojIndeks;
  STAN.stacje = moje;
  STAN.kontenerPaczki = gra.zestaw.kontener;
  STAN.paczka = paczka;
  STAN.usterkiPaczki = [];
  STAN.graPauza = false;
  STAN.graPauzaStartMs = 0;
  STAN.pauzaSkumulowanaMs = 0;
  STAN.graZakonczonaRecznie = false;
  STAN.rozgrywka = nowaRozgrywka({
    konfig, stacje: moje, paczka: paczkaGracza, srodek,
    gracze: [{ id: 1, imie: m.pseudonim }],
    czasMs: zegarGry(), ziarno: gra.kod,
  });
  STAN.paczka = null; // plaintext nie zostaje w pamięci (ADR 0007 pkt 4) — pytania odsłoni kontener
  STAN.historiaFixow = [];
  pokazEkran('gra');
  if (!STAN.trybTestowy && !STAN.watcher && typeof navigator !== 'undefined' && navigator.geolocation) wlaczGps();
  status(`Gra ${gra.kod} (${gra.tryb === TRYBY_GRY.tury ? 'tury' : 'wyścig'}) rozpoczęta: ${moje.length} z ${wszystkie.length} stacji jest Twoich. Pytania odsłaniają się dopiero na stacjach.`
    + (zamknietePrzezeMnie.size ? ' Zamknięte wcześniej stacje nie wracają — wracasz do gry w połowie drogi.' : ''));
  renderujGre();
  renderujPanelMulti();
}

/* --- zdarzenia na serwer + żywe ekrany wyników/tur/synchronizacji --- */

function wyslijZdarzenieMulti(typ, stacjaId, dane) {
  const m = STAN.multi;
  if (!m?.sync) return Promise.resolve(null);
  const zdarzenie = zbudujZdarzenie({
    kod: m.gra.kod, idGry: m.gra.idGry ?? null, graczId: m.graczId,
    typ, stacjaId, dane, tUrzadzenia: Date.now(),
  });
  return m.sync.wyslijZdarzenie(zdarzenie).then((wynik) => { renderujPasekSync(); return wynik; });
}

function renderujWierszeWynikow(tbody, gra) {
  const wyniki = przeliczWyniki(gra);
  const koniec = gra?.stan === 'zakonczona' || gra?.stan === 'archiwum';
  const wszystkich = Number(gra?.konfiguracja?.liczbaStacji) || 0;
  const wiersze = Object.entries(wyniki)
    .sort((a, b) => b[1].punkty - a[1].punkty || b[1].poprawne - a[1].poprawne || a[1].pseudonim.localeCompare(b[1].pseudonim, 'pl'));
  tbody.replaceChildren();
  for (const [id, w] of wiersze) {
    const tr = document.createElement('tr');
    const komorki = [
      `${w.pseudonim}${id === STAN.multi?.graczId ? ' (Ty)' : ''}${w.zrezygnowal ? ' — zrezygnował(a)' : ''}`,
      String(w.punkty),
      `${w.poprawne}/${w.poprawne + w.bledne}`,
      // postęp każdego gracza (ADR 0027 część B): ile stacji z ilu
      wszystkich > 0 ? `${w.stacjeZamkniete}/${wszystkich}` : String(w.stacjeZamkniete),
      // premia za kolejność ukończenia wchodzi do punktów dopiero w podsumowaniu
      w.premia > 0 ? (koniec ? `+${w.premia}` : `+${w.premia} (na koniec)`) : '—',
    ];
    for (const tekst of komorki) {
      const td = document.createElement('td');
      td.textContent = tekst;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

function renderujLobby() {
  const m = STAN.multi;
  if (!m) return;
  const gra = m.gra;
  $('lobby-kod').textContent = gra.kod ?? '';
  $('lobby-tryb').textContent = `${gra.tryb === TRYBY_GRY.tury ? '🔁 Tury' : '🏁 Wyścig'} · ${gra.konfiguracja?.liczbaStacji ?? '?'} stacji · ${gra.konfiguracja?.miejsce || 'nieznane miejsce'}`;
  const lista = $('lobby-gracze');
  lista.replaceChildren();
  for (const g of gra.gracze ?? []) {
    const li = document.createElement('li');
    li.textContent = `${g.pseudonim}${g.id === gra.organizatorId ? ' — organizator' : ''}${g.id === m.graczId ? ' (Ty)' : ''}`;
    lista.appendChild(li);
  }
  const wLobby = gra.stan === 'lobby';
  $('przycisk-lobby-start').hidden = !(wLobby && m.rola === 'organizator');
  $('przycisk-lobby-opusc').hidden = !wLobby;
  if (wLobby) {
    $('lobby-status').textContent = m.rola === 'organizator'
      ? `Czekasz na graczy (maks. ${MAKS_GRACZY}). Wystartuj, gdy wszyscy dołączą — po starcie dołączenie nie jest już możliwe.`
      : 'Czekasz, aż organizator wystartuje grę…';
    $('lobby-widownia').hidden = true;
  } else if (STAN.ekran !== 'gra') {
    $('lobby-status').textContent = gra.stan === 'trwa' ? 'Gra się toczy — śledzisz żywe wyniki.' : 'Gra zakończona — ostateczne wyniki:';
    $('lobby-widownia').hidden = false;
    renderujWierszeWynikow($('lobby-widownia-wiersze'), gra);
  }
}

function renderujPanelMulti() {
  const m = STAN.multi;
  const panel = $('gra-panel-multi');
  panel.hidden = !m;
  if (!m) return;
  const gra = m.gra;
  const r = STAN.rozgrywka;
  const tura = $('gra-multi-tura');
  const graSieToczy = gra.stan === 'trwa' && r && r.faza !== FAZY.koniec && !STAN.graZakonczonaRecznie;
  if (gra.tryb === TRYBY_GRY.tury && graSieToczy) {
    const czyj = biezacyGraczTury(gra);
    if (czyj === m.graczId) {
      tura.textContent = `Twoja tura! Idź do stacji ${r.biezacaStacja} — jest Twoja.`;
    } else if (czyj) {
      const kto = gra.gracze.find((g) => g.id === czyj)?.pseudonim ?? czyj;
      tura.textContent = `Teraz idzie: ${kto} (jej/jego telefon). Czekasz — Twoja stacja odblokuje się, gdy zamknie swoją.`;
    } else {
      tura.textContent = 'Wszystkie stacje zamknięte albo pominięte — czekam na zakończenie gry.';
    }
  } else if (graSieToczy) {
    const zostalo = r ? stacjeDoWyboru(r).length : 0;
    tura.textContent = `Wyścig! Każdy idzie swoją kolejnością — zostało Ci ${zostalo} stacji. Wyniki na żywo poniżej.`;
  } else {
    tura.textContent = gra.stan === 'zakonczona' ? 'Gra zakończona — ostateczne wyniki:' : 'Gra wieloosobowa.';
  }
  renderujWierszeWynikow($('gra-multi-wiersze'), gra);
  // ADR 0032: wariant weryfikacji zestawu — meta jedzie w środku RO-gra/1.
  const fcMulti = $('multi-factcheck');
  fcMulti.hidden = false;
  fcMulti.replaceChildren();
  if (czyWpisFactcheck(gra.zestaw?.meta)) {
    const opis = document.createElement('span');
    opis.textContent = ' Pytania zweryfikowane w sieci (fact check)';
    fcMulti.append(znaczekFactcheck(), opis);
  } else {
    fcMulti.textContent = 'Pytania z pamięci modelu (bez fact-check)';
  }
  renderujWyborStacji(gra, r, graSieToczy);
  // tury: przycisk drogi zablokowany, dopóki idzie ktoś inny (serwer i tak pilnuje)
  if (r && r.faza === FAZY.przygotowanie && gra.tryb === TRYBY_GRY.tury && gra.stan === 'trwa') {
    $('przycisk-start-odcinka').disabled = STAN.graPauza || biezacyGraczTury(gra) !== m.graczId;
  }
  $('przycisk-pomin-stacje').hidden = true; // w multi pomijania nie ma — patrz pominStacjeGry
  renderujPasekSync();
}

/**
 * Wolna kolejność stacji (ADR 0027 część B pkt 2): w wyścigu gracz wybiera
 * dowolną stację, do której jeszcze nie doszedł. Lista znika w turach (tam
 * kolejność ustala kolejka) i po zamknięciu wszystkich stacji.
 */
function renderujWyborStacji(gra, r, graSieToczy) {
  const blok = $('multi-wybor-stacji');
  const mozna = Boolean(graSieToczy && r && gra.tryb === TRYBY_GRY.wyscig && r.faza === FAZY.przygotowanie);
  const dostepne = mozna ? stacjeDoWyboru(r) : [];
  blok.hidden = dostepne.length === 0;
  if (!dostepne.length) return;
  const lista = $('multi-wybor-przyciski');
  lista.replaceChildren();
  for (const stacjaId of dostepne) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'przycisk';
    const cel = STAN.stacje?.find((s) => Number(s.id) === Number(stacjaId));
    b.textContent = `Stacja ${stacjaId}${cel?.opis ? ` · ${cel.opis}` : ''}`;
    b.disabled = STAN.graPauza;
    b.setAttribute('aria-pressed', String(Number(r.biezacaStacja) === Number(stacjaId)));
    b.addEventListener('click', () => wybierzStacjeMulti(stacjaId));
    lista.appendChild(b);
  }
}

/** Klik w stację z listy: bieżąca stacja idzie za wyborem (silnik waliduje G14/G10). */
function wybierzStacjeMulti(stacjaId) {
  const r = STAN.rozgrywka;
  if (!r || r.faza !== FAZY.przygotowanie) return;
  const wynik = skierujDoStacji(r, { stacjaId, czasMs: zegarGry() });
  STAN.rozgrywka = wynik.stan;
  pokazBledy('bledy-gra', wynik.usterki);
  if (wynik.usterki.length > 0) {
    status(wynik.usterki.map((u) => `[${u.kod}] ${u.komunikat}`).join(' '));
    return;
  }
  zapiszGre();
  renderujGre();
  renderujPanelMulti();
  status(`Idziesz do stacji ${stacjaId}. Kolejność jest dowolna — po drodze możesz wybrać inną.`);
}

function renderujPasekSync() {
  const m = STAN.multi;
  let tekst = '';
  if (m) {
    const nastepny = interwalPollingu({ gra: m.gra, graczId: m.graczId });
    const kolejka = m.sync?.kolejkaLength ?? 0;
    tekst = `Ostatni stan: ${new Date(m.ostatniStanMs).toISOString().slice(11, 19)} UTC`
      + (nastepny ? ` · następne odświeżenie za ~${Math.round(nastepny / 1000)} s` : ' · odświeżanie zatrzymane')
      + (kolejka ? ` · ${kolejka} zdarzeń czeka w kolejce (brak sieci)` : '');
  }
  $('multi-sync-pasek').textContent = tekst;
  $('gra-multi-sync').textContent = tekst;
}

function rezygnujZGryMulti() {
  const m = STAN.multi;
  if (!m || !STAN.rozgrywka || STAN.rozgrywka.faza === FAZY.koniec) return;
  if (!STAN.multiRezygnacjaUzbrojona) {
    STAN.multiRezygnacjaUzbrojona = true;
    $('przycisk-multi-rezygnuj').textContent = '⚠ Kliknij ponownie, aby potwierdzić rezygnację';
    status('Rezygnacja oznacza, że Twoje pozostałe stacje zostaną pominięte — inni gracze grają dalej.');
    return;
  }
  STAN.multiRezygnacjaUzbrojona = false;
  $('przycisk-multi-rezygnuj').textContent = '🏳 Rezygnuję z gry';
  void wyslijZdarzenieMulti('rezygnacja', null, { powod: 'rezygnacja z telefonu' });
  STAN.graZakonczonaRecznie = true;
  zatrzymajSymulacje();
  pokazWyniki();
  renderujGre();
  status('Zrezygnowałeś — Twój wynik poniżej. Synchronizacja działa dalej: gdy inni skończą, zobaczysz ostateczną tabelę.');
}

/* ================================ M12/P6: rankingi i moje gry (ADR 0019 pkt 7) */

const RANKING_ZAKLADKI = [
  { klucz: 'ogolny', etykieta: 'Ogólny' },
  { klucz: 'wiek', etykieta: 'Wiek' },
  { klucz: 'tematy', etykieta: 'Tematy' },
  { klucz: 'lokalizacja', etykieta: 'Lokalizacja' },
  { klucz: 'moje', etykieta: 'Moje gry' },
];

/** Ekran rankingów nie jest krokiem gry — chowa wszystkie ekrany (jak prywatność). */
function pokazRankingi({ bezPobierania = false } = {}) {
  // Zapamiętujemy ekran, z którego gracz przyszedł: `STAN.ekran` nie zmienia się
  // przy wejściu na rankingi, więc bez tego „wróć" zawsze zrzucało na setup.
  ukryjStart(); // warstwa rankingów wchodzi nad wszystko, okno startowe znika
  STAN.powrotZRankingu = EKRANY.includes(STAN.ekran) || STAN.ekran === 'mapa' ? STAN.ekran : 'setup';
  for (const e of EKRANY) $(`ekran-${e}`).hidden = true;
  $('ekran-prywatnosc').hidden = true;
  $('ekran-ranking').hidden = false;
  window.scrollTo({ top: 0 });
  if (!bezPobierania) void pobierzRankingi();
}

function wrocZRankingu() {
  $('ekran-ranking').hidden = true;
  if (STAN.powrotZRankingu === 'mapa') { pokazMapeStartowa(); return; }
  pokazEkran(STAN.powrotZRankingu ?? 'setup');
}

/** Adres mostu do rankingów (ADR 0020): ten sam web app co repozytorium paczek i gry. */
function urlMostuRankingu() {
  return adresMostu();
}

async function pobierzRankingi() {
  const url = urlMostuRankingu();
  if (!url) {
    STAN.rankingWiersze = [];
    $('ranking-status').textContent = 'Brak adresu mostu Drive w tej wersji aplikacji — rankingi są niedostępne.' + ADR(' (ADR 0020)');
    renderujRankingi();
    return;
  }
  $('ranking-status').textContent = 'Pobieram wyniki zakończonych gier…';
  try {
    const odpowiedz = await pobierzGetMulti(urlGet(url, 'ranking'));
    const { wiersze, usterki } = walidujRankingSurowy(JSON.stringify(odpowiedz ?? null));
    STAN.rankingWiersze = wiersze;
    $('ranking-status').textContent = usterki.length && !wiersze.length
      ? `Odpowiedź mostu jest nieczytelna (${usterki[0].komunikat}).`
      : (wiersze.length
        ? `Zakończone gry wieloosobowe: ${wiersze.length} wyników graczy.`
        : 'Na moście nie ma jeszcze zakończonych gier — rankingi zapełnią się po pierwszych rozgrywkach.');
  } catch (e) {
    $('ranking-status').textContent = `Nie udało się pobrać rankingów: ${e?.message ?? e}`;
  }
  renderujRankingi();
}

function renderujRankingi() {
  const wiersze = STAN.rankingWiersze ?? [];
  const zakladki = $('ranking-zakladki');
  zakladki.replaceChildren();
  for (const z of RANKING_ZAKLADKI) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'przycisk przycisk-maly';
    b.textContent = z.etykieta;
    b.setAttribute('aria-pressed', String(STAN.rankingZakladka === z.klucz));
    b.addEventListener('click', () => {
      STAN.rankingZakladka = z.klucz;
      STAN.rankingKategoria = null; // nowa zakładka startuje od pierwszej kategorii
      renderujRankingi();
    });
    zakladki.appendChild(b);
  }
  const chipy = $('ranking-kategorie');
  chipy.replaceChildren();
  const tbody = $('ranking-wiersze');
  const mojeLista = $('ranking-moje-gry');
  const tabela = $('ranking-tabela');

  if (STAN.rankingZakladka === 'moje') {
    tabela.hidden = true;
    mojeLista.hidden = false;
    const pseudonim = (typeof localStorage !== 'undefined' ? localStorage.getItem(KLUCZ_PSEUDONIMU) : null) ?? '';
    const moje = wiersze.filter((w) => w.pseudonim === pseudonim);
    mojeLista.replaceChildren();
    const komunikat = (tekst) => { const li = document.createElement('li'); li.textContent = tekst; mojeLista.appendChild(li); };
    if (!pseudonim) komunikat('Nie masz jeszcze pseudonimu — ustaw go w ustawieniach gry (rodzaj gry: „Gra na wielu urządzeniach").');
    else if (!moje.length) komunikat(`Pseudonim „${pseudonim}” nie ma jeszcze zakończonych gier na moście Drive.`);
    else {
      for (const w of moje) {
        const li = document.createElement('li');
        li.textContent = `${String(w.data ?? '').slice(0, 16).replace('T', ' ')} · ${w.miejsce || 'nieznane miejsce'} · ${w.tryb === TRYBY_GRY.tury ? 'tury' : 'wyścig'} · ${w.punkty} pkt · ${w.poprawne} poprawne, ${w.bledne} błędne · ${w.stacjeZamkniete} stacji`;
        mojeLista.appendChild(li);
      }
    }
    return;
  }
  tabela.hidden = false;
  mojeLista.hidden = true;

  // kategorie (wiek/tematy/lokalizacja) — chipy z dostępnych wartości
  const kategorie = kategorieRankingu(wiersze);
  let filtr = {};
  let pustoWKategorii = false;
  const chip = (klucz, etykieta) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'przycisk przycisk-maly';
    b.textContent = etykieta;
    b.setAttribute('aria-pressed', String(STAN.rankingKategoria === klucz));
    b.addEventListener('click', () => { STAN.rankingKategoria = klucz; renderujRankingi(); });
    chipy.appendChild(b);
  };
  if (STAN.rankingZakladka === 'wiek') {
    pustoWKategorii = kategorie.wieki.length === 0;
    if (!pustoWKategorii) {
      if (!kategorie.wieki.includes(STAN.rankingKategoria)) STAN.rankingKategoria = kategorie.wieki[0];
      for (const k of kategorie.wieki) chip(k, WIEK[k]?.etykieta ?? k);
      filtr = { wiek: STAN.rankingKategoria };
    }
  } else if (STAN.rankingZakladka === 'tematy') {
    pustoWKategorii = kategorie.tematy.length === 0;
    if (!pustoWKategorii) {
      if (!kategorie.tematy.includes(STAN.rankingKategoria)) STAN.rankingKategoria = kategorie.tematy[0];
      for (const k of kategorie.tematy) chip(k, TEMATY[k]?.etykieta ?? k);
      filtr = { temat: STAN.rankingKategoria };
    }
  } else if (STAN.rankingZakladka === 'lokalizacja') {
    pustoWKategorii = kategorie.lokalizacje.length === 0;
    if (!pustoWKategorii) {
      const klucze = kategorie.lokalizacje.map((l) => l.geohash5);
      if (!klucze.includes(STAN.rankingKategoria)) STAN.rankingKategoria = klucze[0];
      for (const l of kategorie.lokalizacje) chip(l.geohash5, l.miejsce || l.geohash5);
      filtr = { geohash5: STAN.rankingKategoria };
    }
  }

  const agregat = pustoWKategorii ? [] : agregujRanking(wiersze, filtr);
  tbody.replaceChildren();
  if (!agregat.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.setAttribute('colspan', '5');
    td.textContent = 'Brak zakończonych gier w tej kategorii — zapełni się po pierwszych rozgrywkach.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  const pseudonim = (typeof localStorage !== 'undefined' ? localStorage.getItem(KLUCZ_PSEUDONIMU) : null) ?? '';
  agregat.forEach((a, i) => {
    const tr = document.createElement('tr');
    for (const tekst of [`${i + 1}.`, `${a.pseudonim}${a.pseudonim === pseudonim ? ' (Ty)' : ''}`, String(a.punkty), String(a.gry), `${a.poprawne} ✓ / ${a.bledne} ✗`]) {
      const td = document.createElement('td');
      td.textContent = tekst;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
}

/**
 * Tryb testowy wchodzi WYŁĄCZNIE parametrem adresu (decyzja właściciela
 * 2026-09-08 — przycisk w nagłówku usunięty). Przyjmowane formy:
 * `?test=true`, `?test=1`, `?test=tak` oraz historyczne `?tryb=test`, którego
 * używają testy (`test/helpers/dom.js`). Wielkość liter bez znaczenia.
 */
/**
 * Wysokość belki jako zmienna CSS `--wysokosc-belki`.
 *
 * Przyciski +/− mapy-tła muszą siedzieć PONIŻEJ belki: mapa-tło ma
 * `position: fixed; inset: 0`, więc sięga pod samą belkę, a belka ma `z-index: 3`
 * i nieprzezroczyste tło — przy domyślnym `top: 8px` przyciski znikały pod nią
 * (zgłoszenie właściciela 2026-09-08). Stałej liczby w CSS nie chcemy: `.akcje`
 * ma `flex-wrap: wrap`, więc na wąskim ekranie belka rośnie i każda stała
 * w końcu przestaje wystarczać. Mierzymy.
 */
function ustawWysokoscBelki() {
  const belka = document.querySelector('.gora');
  if (!belka) return; // atrapa DOM w testach nie ma `querySelector` po klasie
  const wysokosc = belka.offsetHeight;
  if (!Number.isFinite(wysokosc) || wysokosc <= 0) return;
  document.documentElement.style.setProperty('--wysokosc-belki', `${Math.round(wysokosc)}px`);
}

function czyTrybTestowyWUrl() {
  if (typeof location === 'undefined' || typeof location.search !== 'string') return false;
  const parametr = new URLSearchParams(location.search);
  if (parametr.get('tryb') === 'test') return true;
  return ['true', '1', 'tak'].includes(String(parametr.get('test') ?? '').trim().toLowerCase());
}

function start() {
  wczytajKonfiguracje();
  banerStartowy();
  $('stopka-protokol').textContent = WERSJA_PROTOKOLU;
  // Numer budowy w stopce: właściciel dwa razy oceniał starą wersję z cache i
  // nie miał jak tego stwierdzić. Bierzemy go z `?v=` w adresie TEGO modułu,
  // więc nie ma drugiej stałej do pamiętania przy podbijaniu cache-bust.
  if ($('stopka-wersja')) {
    $('stopka-wersja').textContent = new URL(import.meta.url).searchParams.get('v') || 'dev';
  }
  ustawWysokoscBelki();
  // Łatka szablonu (PROTOKOL §7): organizator widzi, którą wersją promptu gra.
  $('stopka-szablon').textContent = SZABLON_WERSJA;

  renderujTryby();
  renderujSegment('lista-wieku', WIEK, STAN.konfig.wiek, (wiek) => { STAN.konfig.wiek = wiek; });
  renderujTematy();
  renderujSelecty();
  renderujSetup();
  // Lista graczy zaczyna PUSTA: domyślne „Gracz 1" z kanonu nie przeszło przez
  // most, więc nie może udawać tożsamości (ADR 0026 aneks). Zapamiętani gracze
  // wracają jako przyciski — jedno kliknięcie, bez PIN-u.
  STAN.konfig.imiona = [];
  renderujListeGraczy();
  przywrocGraczy({ zListy: true });
  utworzMapy();
  // Wyniki, które nie doszły na Drive w terenie, jadą przy starcie (ADR 0016 pkt 5).
  void oproznijKolejkeHotseat();

  if (czyTrybTestowyWUrl()) {
    // Decyzja właściciela 2026-09-08: tryb testowy NIE MA przycisku w
    // interfejsie — wchodzi się tylko parametrem adresu (`?test=true`).
    // Przełącznik w nagłówku kusił do grania bez GPS, a wyniki i tak szły
    // na Drive i do rankingów (ADR 0029).
    STAN.trybTestowy = true;
    document.body.classList.add('tryb-testowy');
    $('reczne-wspolrzedne').hidden = false;
    $('przycisk-symulacja').hidden = false;
  }
  if (location.search.includes('odstep=0')) {
    // skrót dla testów/przeglądarki: przełączanie instancji Overpass bez
    // 30-sekundowych pauz (polityka ASSETS §2 jest domyślnie nietknięta)
    STAN.odstepOverpassMs = 0;
  }

  $('przycisk-setup').addEventListener('click', () => pokazEkran('setup')); // START GRY w nagłówku
  $('ekran-start').addEventListener('click', ukryjStart); // okno startowe: klik gdziekolwiek zamyka
  $('przycisk-start-zacznij').addEventListener('click', ukryjStart); // to samo jawnym przyciskiem
  document.addEventListener('keydown', (z) => { if (z.key === 'Escape') ukryjStart(); });
  $('przycisk-motyw').addEventListener('click', przelaczMotyw);
  $('przycisk-sygnaly').addEventListener('click', przelaczSygnaly);
  $('przycisk-sygnaly').setAttribute('aria-pressed', String(sygnalyWlaczone()));
  zarejestrujServiceWorker();
  $('przycisk-prywatnosc').addEventListener('click', pokazPrywatnosc);
  $('przycisk-ranking').addEventListener('click', pokazRankingi); // M12/P6
  $('przycisk-wrocz-ranking').addEventListener('click', wrocZRankingu);
  $('przycisk-ranking-krzyzyk').addEventListener('click', wrocZRankingu); // krzyżyk w rogu warstwy
  $('przycisk-ranking-odswiez').addEventListener('click', () => { void pobierzRankingi(); });
  $('przycisk-prywatnosc-stopka').addEventListener('click', pokazPrywatnosc);
  $('przycisk-wrocz-prywatnosc').addEventListener('click', wrocZPrywatnosci);
  $('przycisk-czysc-dane').addEventListener('click', czyscDaneWitryny);
  $('przycisk-symulacja').addEventListener('click', przelaczSymulacje);

  $('przycisk-dalej-pozycja').addEventListener('click', async () => {
    const usterki = walidujSetup(czytajSetupZDomu());
    pokazBledy('bledy-setup', usterki);
    if (usterki.length) {
      status(`Konfiguracja ma usterek: ${usterki.length}.`);
      return;
    }
    // Tożsamość przed zapisem konfiguracji: imię z profilu jest częścią setupu
    // (wpisuje się w `imiona`), więc najpierw brama, potem zapis (ADR 0026).
    const przyciskDalej = $('przycisk-dalej-pozycja');
    przyciskDalej.disabled = true; // jedno kliknięcie = jedno wołanie mostu
    let przeszedl;
    try {
      przeszedl = await bramkaTozsamosci();
    } finally {
      przyciskDalej.disabled = false;
    }
    if (!przeszedl) {
      status('Bez potwierdzonego imienia nie idziemy dalej — wpisz imię i PIN.');
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
    ustawWysokoscBelki(); // belka mogła urosnąć/zmaleć (`.akcje` się zawija)
    kazdaMapa((mapa) => mapa.odswiez());
  });

  // Pauza śledzenia, gdy karta schodzi w tło — oszczędność baterii i jawny
  // komunikat po powrocie (ADR 0004 pkt 1).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
    zatrzymajSymulacje();
      // M6: gra w tle = pełna pauza (zegar stoi, wznowienie jawne przyciskiem)
      if (STAN.rozgrywka && STAN.rozgrywka.faza !== FAZY.koniec && STAN.ekran === 'gra' && !STAN.graPauza) {
        przelaczPauzeGry();
        return;
      }
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
    ustawPozycjeRecznie($('setup-lat').value, $('setup-lon').value);
  });

  $('przycisk-wstecz-setup').addEventListener('click', () => pokazEkran('setup'));
  $('przycisk-dalej-stacje').addEventListener('click', () => {
    // Na ekran pozycji da się wejść także ikonką setup w nagłówku, która nie
    // waliduje setupu, a `stacjeProste` odmawia przy niedodatnim promieniu
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
  $('przycisk-siec-ponow').addEventListener('click', () => {
    pokazBledy('bledy-stacje', []);
    status('Ponownie pobieram sieć drogową…');
    void przeliczStacjeZPobraniem(kluczSieci());
  });
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
    status('Tryb ręczny: przeciągnij pinezki na mapie. Dystans liczymy w linii prostej — osiągalności NIE weryfikujemy.' + ADR(' (ADR 0005 pkt 8)'));
  });
  $('przycisk-dalej-prompt').addEventListener('click', () => {
    pokazEkran('prompt');
    budujPromptEkran();
  });

  $('przycisk-wstecz-stacje').addEventListener('click', () => pokazEkran('stacje'));
  $('przycisk-kopiuj-prompt').addEventListener('click', (e) => kopiujTekst(STAN.prompt ?? '', e.currentTarget, '⧉ Kopiuj prompt'));
  $('prompt-factcheck').addEventListener('change', () => budujPromptEkran());
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
    const tekst = poprawkaDlaModelu(STAN.usterkiPaczki, { liczbaPytan: liczbaPytan(STAN.konfig), factcheck: STAN.poprawkaFactcheck });
    kopiujTekst(tekst, e.currentTarget, '⧉ Kopiuj poprawkę do modelu');
    $('pole-odpowiedz').value = tekst;
  });

  $('przycisk-test-polaczenia').addEventListener('click', () => sprawdzPolaczenieZRepo());
  $('przycisk-start-odcinka').addEventListener('click', () => startOdcinkaGry());
  // ADR 0029: ręcznego zgłaszania dojścia NIE MA — ani w index.html, ani tutaj.
  // Dojście zamyka wyłącznie strumień fixów (GPS albo symulacja w trybie
  // testowym, która karmi aplikację tym samym `przyjmijFix`); testy idą tą samą
  // drogą, więc nie ma drugiego, produkcyjnie martwego wejścia do fazy pytania.
  $('przycisk-nowa-gra').addEventListener('click', () => wrocNaPoczatek());
  $('przycisk-pauza').addEventListener('click', () => przelaczPauzeGry());
  $('przycisk-symulacja-gra').addEventListener('click', () => przelaczSymulacjeDoStacji());
  $('przycisk-nastepna-stacja').addEventListener('click', () => nastepnaStacja());
  // ADR 0028: oceny pytań — kliknięcie jest jednoklikowe i nie blokuje gry.
  $('gra-ocena-plus').addEventListener('click', () => kliknijOcene(OCENA_PLUS));
  $('gra-ocena-minus').addEventListener('click', () => kliknijOcene(OCENA_MINUS));
  zaladujOcenyLokalne();
  oproznijKolejkeOcen();
  $('przycisk-pomin-stacje').addEventListener('click', () => pominStacjeGry());
  $('przycisk-zakoncz-gre').addEventListener('click', () => zakonczGreRecznie());
  $('przycisk-wznow-gre').addEventListener('click', () => wznowGre());
  $('przycisk-kasuj-zapis').addEventListener('click', () => kasujZapisGry());
  $('przycisk-kasuj-historie').addEventListener('click', () => kasujHistorieGry());

  // M7/P4: eksport tekstu wyniku — share (telefon) → schowek → plik (zawsze).
  // Aplikacja nie udaje, że udostępniła: AbortError (rezygnacja) jest cichy,
  // inny błąd dostaje jawny status ze wskazaniem pola i pliku (decyzja 8).
  $('przycisk-udostepnij-wynik').addEventListener('click', async () => {
    if (!STAN.wynikTekst || typeof navigator.share !== 'function') return;
    try {
      await navigator.share({ title: 'Tajemnicza okolica — wynik gry', text: STAN.wynikTekst });
    } catch (e) {
      if (e?.name !== 'AbortError') {
        status(`Nie udało się udostępnić wyniku: ${e?.message ?? e}. Tekst jest w polu „Tekst wyniku" i w pliku .txt.`);
      }
    }
  });
  $('przycisk-kopiuj-wynik').addEventListener('click', () => {
    if (!STAN.wynikTekst) return;
    void kopiujTekst(STAN.wynikTekst, $('przycisk-kopiuj-wynik'), '📋 Kopiuj wynik', 'pole-wynik-tekst');
  });
  $('przycisk-pobierz-wynik').addEventListener('click', () => {
    if (!STAN.wynikTekst) return;
    pobierzPlik(nazwaPlikuWyniku(STAN.rozgrywka?.kodGry ?? STAN.konfig?.kodGry), STAN.wynikTekst, 'text/plain;charset=utf-8');
    status('Wynik zapisany jako plik .txt.');
  });
  $('przycisk-pobierz-obraz').addEventListener('click', () => { void eksportujWynikObraz(false); });
  $('przycisk-udostepnij-obraz').addEventListener('click', () => { void eksportujWynikObraz(true); });

  /* M11/P4: gra na wielu urządzeniach — setup, zakładanie, dołączanie, lobby */
  wczytajUstawieniaMulti();
  renderujRodzajGry();
  renderujTrybyMulti();
  renderujWznowienieMulti();
  $('setup-rodzaj').addEventListener('change', () => {
    STAN.rodzajGry = $('setup-rodzaj').value === 'multi' ? 'multi' : 'hotseat';
    if (typeof localStorage !== 'undefined') localStorage.setItem(KLUCZ_RODZAJU_GRY, STAN.rodzajGry);
    renderujRodzajGry();
    status(STAN.rodzajGry === 'multi'
      ? 'Gra na wielu urządzeniach: podaj pseudonim, potem załóż grę albo dołącz (kod lub lista gier w okolicy).'
      : 'Hot-seat: jeden telefon podawany dalej (ADR 0009).');
  });
  $('multi-pseudonim').addEventListener('input', () => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KLUCZ_PSEUDONIMU, ($('multi-pseudonim').value ?? '').trim());
  });
  $('przycisk-multi-zaloz').addEventListener('click', () => {
    const usterki = walidujGotowoscMulti();
    if (usterki.length) { pokazBledyMulti(usterki); return; }
    otworzPanelMulti('zaloz');
    odswiezZrodlaMulti();
  });
  $('przycisk-multi-dolacz').addEventListener('click', () => {
    const usterki = walidujGotowoscMulti();
    if (usterki.length) { pokazBledyMulti(usterki); return; }
    otworzPanelMulti('dolacz');
    void odswiezLobby();
  });
  $('multi-zrodlo').addEventListener('change', () => { void zaladujZrodloMulti(); });
  $('przycisk-zaloz-gre').addEventListener('click', () => { void zalozGreMulti(); });
  $('przycisk-dolacz-kod').addEventListener('click', () => { void dolaczDoGryMulti({ kod: normalizujKod($('multi-kod').value) }); });
  $('przycisk-odswiez-lobby').addEventListener('click', () => { void odswiezLobby(); });
  $('przycisk-lobby-start').addEventListener('click', () => { void startLobby(); });
  $('przycisk-lobby-opusc').addEventListener('click', opuscLobby);
  $('przycisk-multi-wstecz-zaloz').addEventListener('click', () => pokazEkran('setup'));
  $('przycisk-multi-wstecz-dolacz').addEventListener('click', () => pokazEkran('setup'));
  $('przycisk-multi-rezygnuj').addEventListener('click', rezygnujZGryMulti);
  $('przycisk-multi-wroc').addEventListener('click', () => { void przywrocGreMulti(); });
  $('przycisk-multi-porzuc').addEventListener('click', () => {
    usunSesjeMulti();
    renderujWznowienieMulti();
    status('Telefon nie pamięta już tamtej gry wieloosobowej.');
  });

  sprawdzZapisGry(); // M6/R6: baner wznowienia, jeśli telefon pamięta grę
  renderujHistorieGier(); // M7/P6: lista poprzednich gier na setupie
  // Start to mapa + okno startowe, nie setup (decyzja właściciela 2026-09-09).
  pokazMapeStartowa();
  const start = $('ekran-start');
  if (start) start.hidden = false;
  document.body.classList.add('okno-start');
  const mp = document.querySelector('#mapa-pozycja .mapa-przyciski');
  if (mp) mp.hidden = true;
  status(`M0 — fundament. Ustawienia domyślne: ${TRYBY[STAN.konfig.tryb].etykieta}, ${STAN.konfig.liczbaStacji} stacji, ${DOMYSLNE.pytaniaNaStacje} pytanie na stację, wiek ${WIEK[STAN.konfig.wiek].etykieta}.`);
}

if (typeof document !== 'undefined' && document.getElementById('ekran-setup')) start();
