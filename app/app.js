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

import { DOMYSLNE, KANON_SETUPU, OGRANICZENIA, PODKLADY, TEMATY_SETUP, TRYBY, WIEK_SETUP, kanonicznyTemat, konfiguracjaNowegoSetupu, domyslnaKonfiguracja, domyslnyKodGry, dopelnijKonfiguracjeDoKanou, kanonSprzedBiezacego, liczbaPytan, oczyscKonfiguracje, przeliczenieCzasu, walidujSetup, ziarnoRozgrywki } from './konfig.js?v=m12-93';
import { PROMIEN_SUFITU_ZOOMU_M, dopasujZoomDoPromienia, formatujWspolrzedne, geohash, odlegloscM } from './geo.js?v=m12-93';
import {
  czyPaczkaOdwrocona,
  czyWariantFactcheck,
  normalizujTematyPaczki,
  odkodujPaczkeRev1,
  odkodujPaczkeRev2,
  parsujOdpowiedzModela,
  poprawkaDlaModelu,
  walidujPaczke,
  zbudujPrompt,
  WERSJA_PROTOKOLU,
  SZABLON_WERSJA,
  WARIANTY_Z_KODEM,
  WERSJA_PROTOKOLU_REV4,
  WERSJA_PROTOKOLU_REV5,
} from './protokol.js?v=m12-93';
import { odpakujPaczke, zapakujPaczke } from './kodowanie.js?v=m12-93';
import { ZRODLA_STACJI, dystanseOdcinkowM, stacjeProste, uzupelnijOdleglosci, wybierzStacje } from './stacje.js?v=m12-93';
import { GRANICE, PROFILE_GPS, ZEGAR_MILCZENIA_MS, ZRODLA_FIXA, czyMilczy, dodajFix, komunikatMilczenia, komunikatPauzy, komunikatWznowienia, ocenFix, fixZPozycji, profilBaterii, sekwencjaSymulowana, stanDojscia, trasaProsta, watchPozycja } from './pozycja.js?v=m12-93';
import { FAZY, TRYBY_DOJSCIA, graczPytania, ktoOdpowiada, nowaRozgrywka, pominStacje, podglad, podsumowanie, pytaniaStacji, skierujDoStacji, stacjeDoWyboru, startOdcinka, zapiszOdpowiedz, zakonczOdcinek } from './rozgrywka.js?v=m12-93';
import { KLUCZ_AKTYWNEJ, KLUCZ_HISTORII, dodajWpisHistorii, kluczStanu, nowaHistoria, oczyscKodGry, serializujStan, skrotGry, walidujHistorieSurowa, walidujStanSurowy, zbierajStan } from './trwalosc.js?v=m12-93';
import {
  KLUCZ_REJESTRU, SCHEMAT_INDEKSU, SCHEMAT_LOKALNY,
  czyWOkolicy, dolozWpisRejestru, dopasujMetaIndeksu, dopasujZestawy, kluczZestawu, nowyRejestr, powodyNiedopasowania,
  rozmiarBajty, walidujIndeksSurowy, walidujRejestrSurowy, walidujZestawLokalnySurowy,
  walidujZestawPublicznySurowy, zbierzMetaZestawu, zbudujPlikZestawu,
  urlPaczkiZRepo, faktyczneTematyPytan,
} from './zestawy.js?v=m12-93';
import { KLUCZ_SYGNALOW, czySygnalyWlaczone, planSygnalu } from './sygnaly.js?v=m12-93';
import {
  KODY_SIECI,
  POLITYKA,
  SCHEMAT_SIECI,
  budujGraf,
  budujZapytanieOverpass,
  czyPrzelaczycInstancje,
  kolejnoscInstancji,
  kandydaciNaStacje,
  kluczCacheSieci,
  nazwaMiejsca,
  parsujOdpowiedz,
  przycijCacheSieci,
  upraszczajDaneDoCache,
  wczytajDaneZCache,
} from './sieci.js?v=m12-93';
import { KLUCZ_URL_KAFELKOW, utworzMape, ustawSzablonKafelkow } from './mapa.js?v=m12-93';
import { MAKS_GRACZY, SCHEMAT_GRY, SCHEMAT_KOLEJKI_HOTSEAT, SCHEMAT_WYSLANYCH_HOTSEAT, TRYBY_GRY, czyPinPoprawny, filtrujLobby, graHotseatDoWysylki, komunikatBleduProfilu, normalizujPseudonim, przeliczWyniki, walidujGraczyLokalnych, walidujGreSurowa, walidujLobbySurowe, walidujKolejkeHotseat, walidujWyslaneHotseat, zbudujZdarzenie } from './wieloosobowa.js?v=m12-93';
import { interwalPollingu, polecenieMostu, urlGet, urlStanGry, utworzSynchronizacje } from './sync.js?v=m12-93';
import { adresMostu, stanMostu } from './most.js?v=m12-93';
import { LIMIT_RANKINGU, formatujSkutecznosc, mistrzowieZagadek, rankingPunktowy, walidujRankingSurowy } from './ranking.js?v=m12-93';
import {
  KLUCZ_OCEN, KLUCZ_KOLEJKI_OCEN, OCENA_PLUS, OCENA_MINUS, noweOceny, nowyTokenGry,
  walidujOcenyLokalneTekst, ocenPytanie, idGlosujacego, znajdzGlos, walidujKolejkeOcenTekst,
  dodajDoKolejkiOcen, usunZKolejkiOcen, walidujOdpowiedzOceny, walidujStatystykiOcen,
  opisOcenTekst,
} from './oceny.js?v=m12-93';

const KLUCZ_KONFIG = 'okolica:konfig';
const KLUCZ_MOTYW = 'okolica:motyw';
/** M11/P4 (ADR 0019): tożsamość i most gry wieloosobowej — osobne klucze, „kasuj dane" czyści wszystko.
 *  Adres mostu NIE jest tu trzymany: żyje w kodzie (`app/most.js`, ADR 0020). */
const KLUCZ_RODZAJU_GRY = 'okolica:rodzaj-gry';
const KLUCZ_SESJI_MULTI = 'okolica:multi:sesja';

/**
 * Limit czasu odpowiedzi mostu Drive (ms) — WSPÓLNY dla indeksu paczek, listy
 * gier i stanu gry. Zgłoszenie właściciela 2026-09-12 („problem z łączeniem
 * z Drive po ostatnich zmianach”): panel paczek mówił „Repozytorium
 * niedostępne”, choć paczki na Drive są. Dwie przyczyny po naszej stronie:
 * (1) indeks miał limit 6 s, a zimny start web app Apps Script — zwłaszcza
 * pierwsze żądanie po wdrożeniu — potrafi trwać dłużej, więc żądanie było
 * przerywane, ZANIM most zdążył odpowiedzieć; (2) błąd był połykany
 * (`.catch(() => …)`) i dawał jeden komunikat niezależnie od przyczyny, więc
 * braku sieci nie dało się odróżnić od HTTP 403 (LESSONS L6).
 */
const LIMIT_MOSTU_MS = 15000;

/**
 * Odstęp przed ponowną próbą pobrania indeksu (ms). Jedna powtórka leczy
 * najczęstszą awarię mostu: pierwsze żądanie po wdrożeniu trafia w zimny start.
 * Testy skracają odstęp globalem (wzorzec `__MAKS_KAFELKI_TEST__` z `sw.js`).
 */
const PONOWNA_PROBA_INDEKSU_MS = Number(globalThis.__OKOLICA_PONOWNA_PROBA_MS__) || 800;

/**
 * Bug G (zgłoszenie terenowe 2026-09-12): WebKit potrafi trzymać
 * `watchPosition` w całkowitej ciszy — bez fixa i bez błędu, ignorując opcję
 * `timeout` — a GPS telefonu działa. Watchdog co `KROK_WATCHDOG_GPS_MS`
 * sprawdza znak życia streamu i po `LIMIT_MILCZENIA_GPS_MS` ciszy zakłada
 * świeżego watchera (`ZEGAR_MILCZENIA_MS` w `pozycja.js` to granica domyślna).
 * Gałki globalne istnieją wyłącznie dla testów (wzorzec
 * `__OKOLICA_PONOWNA_PROBA_MS__`).
 */
const KROK_WATCHDOG_GPS_MS = Number(globalThis.__OKOLICA_KROK_GPS_MS__) || 5000;
const LIMIT_MILCZENIA_GPS_MS = Number(globalThis.__OKOLICA_MILCZENIE_GPS_MS__) || ZEGAR_MILCZENIA_MS;

const STAN = {
  konfig: domyslnaKonfiguracja(),
  pozycja: null,
  dokladnoscM: null,
  ostatniFix: null,
  /** Pozycja, przy której OSTATNIO sprawdziliśmy propozycje paczek (uwagi
   *  terenowe #2, 2026-09-11): null = sprawdź przy najbliższym fixie;
   *  potem dopiero dystans ≥ 250 m od tej pozycji zezwala na kolejne żądanie. */
  ostatniaPozycjaZestawow: null,
  ocenaFixa: null,
  pauzaWTle: false,
  /** M10/T3: bieżący profil watchera GPS ('dokladny' | 'oszczedny') — histereza w `profilBaterii`. */
  profilGps: 'dokladny',
  /** Nazwa miejsca z Overpass — JEDYNA warstwa od 2026-09-11 (zapasowa
   *  Nominatim usunięta całkowicie decyzją właściciela, ADR 0013 aneks). */
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
  /** Ekran, na który wracamy z karty prywatności (jest poza EKRANY). */
  powrotZPrywatnosci: 'setup',
  /** ADR 0039: ostatnia odpowiedź mostu `?akcja=ranking` (RO-ranking/2) albo null. */
  ranking: null,
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
  /** M11/P4: 'hotseat' | 'multi' — wybór z setupu, utrwalany w localStorage. */
  rodzajGry: 'hotseat',
  /** M11/P4: sesja gry wieloosobowej `{rola, gra, graczId, pseudonim, urlMostu, sync, ostatniStanMs}` albo null. */
  multi: null,
  /** M12-74 (właściciel 2026-09-11): ścieżka wybrana na setupie — 'zaloz'
   *  albo 'dolacz'. Dołączanie działa TYLKO z listy gier ≤50 m (bez kodów). */
  multiSciezka: 'zaloz',
/** M11/P4: tryb zakładanej gry ('trasa' | 'wyscig') — decyzja właściciela
 * 2026-09-11: Wspólna Trasa (po kolei) i Wyścig na Orientację (dowolnie). */
  multiTryb: 'trasa',
  /** Wspólna Trasa z ptaszkiem „widoczna tylko kolejna stacja” (domyślnie ✓,
   *  właściciel 2026-09-11). Właściwość GRY — jedzie na most jako trasaSekret. */
  multiTrasaSekret: true,
  /** Ścieżka AI dla multi (właściciel, 2026-09-11): po wklejeniu paczki
   * wracamy do panelu „Załóż grę” z gotową paczką, nie do gry hot-seat. */
  multiPoPaczce: false,
  /** Wspólna Trasa = trasa-sekret: przy generowaniu stacji chowamy listę
   * i kropki na mapie — organizator nie poznaje trasy z góry. */
  ukryjStacje: false,
  /** M11/P4: dwustopniowa rezygnacja z gry wieloosobowej (jak inne destrukcyjne). */
  multiRezygnacjaUzbrojona: false,
  /** Wyjście ORGANIZATORA z lobby zamyka grę WSZYSTKIM — akcja nieodwracalna,
   *  więc też dwustopniowa (audyt PR #13; wzorzec `rezygnujZGryMulti`). */
  multiOpuszczenieUzbrojone: false,
  trybTestowy: false,
  /** Sterowanie watchera z `watchPozycja()`: `{ zamknij, czyAktywny }`. */
  watcher: null,
  /** Bug G: ostatni znak życia GPS (fix albo błąd) — `performance.now()`. */
  gpsOstatniZnakMs: null,
  /** Bug G: ile razy watchdog zakładał świeżego watchera od ostatniego fixa. */
  gpsProba: 0,
  /** Bug G: zegar watchdoga (`setInterval`) — zdejmuje go `zatrzymajGps()`. */
  gpsTimer: null,
  /** Krótki powód ostatniej nieudanej próby mostu (indeks paczek) — pokazywany
   *  w `#most-stan-repo`, żeby „podłączony” nie było obietnicą bez pokrycia:
   *  adres w kodzie to nie to samo co działające połączenie (LESSONS L6). */
  mostOstatniBlad: null,
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
  /** Tryb ręczny (ADR 0005 pkt 8b): organizator przeciąga pinezki stacji. */
  trybReczny: false,
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

/**
 * Stan ikon w belce (zgłoszenie właściciela F3, 2026-09-09).
 *
 * Ikona ⚙ START GRY zachowuje się jak 🔔 Sygnały: gdy jej warstwa jest
 * otwarta, ikona jest „wciśnięta” (`aria-pressed="true"`, a CSS daje jej tło
 * akcentu). Powtórny klik w podświetloną ikonę zamyka warstwę. Jedno miejsce
 * liczy stan, bo warstwę otwiera i zamyka kilka ścieżek (przycisk, Escape,
 * „wróć”) — rozsypanie tego po nich gwarantowałoby ikonę świecącą nad
 * zamkniętą warstwą.
 */
function odswiezStanIkonBelki() {
  const ustaw = (id, wlaczona) => {
    const el = $(id);
    if (el) el.setAttribute('aria-pressed', String(Boolean(wlaczona)));
  };
  // „START GRY” świeci na całej ścieżce przygotowania gry (ekrany 1–5), bo to
  // ta sama warstwa setupu — nie tylko na pierwszym jej kroku.
  ustaw('przycisk-setup', EKRANY.includes(STAN.ekran));
}

/** Próg odświeżania propozycji paczek (uwagi terenowe #2, 2026-09-11):
 *  poniżej 250 m dryf GPS nie zmienia sensu „okolica", a każde odświeżenie
 *  to żądanie do mostu Drive (limit kwoty Apps Script — ADR 0013). */
const PROG_ODSWIEZENIA_ZESTAWOW_M = 250;

function pokazEkran(nazwa) {
  ukryjStart(); // krok gry chowa okno startowe (poza nim okno nie ma czego przykrywać)
  zamknijInformacje();
  zamknijRankingi({ bezFokusu: true });
  // Wejście na ekran pozycji = nowy pobyt na „stronie z paczkami": kontrolna
  // pozycja wraca do null, więc pierwszy fix sprawdzi propozycje od nowa.
  if (nazwa === 'pozycja') STAN.ostatniaPozycjaZestawow = null;
  $('ekran-prywatnosc').hidden = true;
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
  odswiezStanIkonBelki();
  odswiezWidocznoscPaneli();
  window.scrollTo({ top: 0 });
}

/**
 * Mapa startowa (decyzja właściciela 2026-09-09): sama mapa-tło, nagłówek
 * i stopka — bez formularza. Stan lądowania po starcie (gdy zniknie okno
 * startowe) i po „Wróć na początek". Poza EKRANY jak prywatność:
 * to nie krok przygotowania gry, tylko spód, na którym gra się zaczyna.
 */
function pokazMapeStartowa() {
  zamknijInformacje();
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
  odswiezStanIkonBelki();
  odswiezWidocznoscPaneli();
  window.scrollTo({ top: 0 });
}

/** Okno startowe znika po kliknięciu gdziekolwiek na nie (jw.). */
function ukryjStart() {
  const w = $('ekran-start');
  if (w) w.hidden = true;
  document.body.classList.remove('okno-start');
  const mp = document.querySelector('#mapa-pozycja .mapa-przyciski');
  if (mp) mp.hidden = false;
  odswiezWidocznoscPaneli();
}

/**
 * Ekran „dane i prywatność" (ADR 0013 pkt 7) nie jest krokiem gry: chowa
 * wszystkie ekrany z paska kroków i pokazuje siebie, a powrót prowadzi na
 * ekran zapamiętany w `STAN.ekran`.
 */
function pokazPrywatnosc() {
  STAN.prywatnoscZInformacji = !$('ekran-informacje').hidden;
  zamknijInformacje();
  // ADR 0030: ekran prywatności chowa wszystkie ekrany gry, więc znacznik
  // `data-ekran` musi zniknąć razem z nimi — inaczej reguły „bez przewijania”
  // zostałyby na długim dokumencie, którego nie dałoby się przeczytać.
  STAN.powrotZPrywatnosci = EKRANY.includes(STAN.ekran) ? STAN.ekran : 'setup';
  ukryjStart(); // okno startowe nie przykrywa karty prywatności
  document.body.dataset.ekran = 'prywatnosc';
  for (const e of EKRANY) $(`ekran-${e}`).hidden = true;
  $('ekran-prywatnosc').hidden = false;
  odswiezStanIkonBelki();
  odswiezWidocznoscPaneli(); // prywatność gasi ikony obu warstw (F3)
  window.scrollTo({ top: 0 });
}

function wrocZPrywatnosci() {
  $('ekran-prywatnosc').hidden = true;
  if (STAN.prywatnoscZInformacji) {
    if (STAN.ekran === 'mapa') pokazMapeStartowa(); else pokazEkran(STAN.ekran);
    przelaczInformacje();
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

const PANELE = [...EKRANY, 'prywatnosc', 'ranking', 'start', 'informacje'];

/** „START GRY" w nagłówku (F3): z kroku gry wraca na mapę startową, spoza niej
 *  otwiera setup. Przełącznik, nie jednostronne przejście — gracz klika go
 *  odruchowo drugi raz. */
function przelaczSetup() {
  if (EKRANY.includes(STAN.ekran)) { pokazMapeStartowa(); return; }
  pokazEkran('setup');
}

function odswiezWidocznoscPaneli() {
  const podglad = STAN.podgladMapy === true;
  document.body.dataset.mapa = ['stacje', 'prompt', 'paczka'].includes(STAN.ekran)
    ? 'stacje' : STAN.ekran === 'gra' ? 'gra' : 'pozycja';
  const info = !$('ekran-informacje').hidden;
  const ranking = !$('ekran-ranking').hidden;
  const droga = STAN.ekran === 'gra' && !$('gra-panel-odcinek').hidden;
  document.body.classList.toggle('gra-w-drodze', droga);
  $('informacje-gra').hidden = !droga;
  document.body.classList.toggle('podglad-mapy', podglad);
  document.body.classList.toggle('informacje-otwarte', info);
  for (const nazwa of PANELE) {
    const panel = $(`ekran-${nazwa}`);
    panel.inert = podglad || (info && nazwa !== 'informacje') || (ranking && nazwa !== 'ranking');
  }
  $('przygaszenie-mapy').hidden = podglad || !PANELE.some(n => !$(`ekran-${n}`).hidden && !(n === 'gra' && droga));
  $('przycisk-podejrzyj-mape').setAttribute('aria-pressed', String(podglad));
  const opis = podglad ? 'Wróć do panelu' : 'Podejrzyj mapę';
  $('przycisk-podejrzyj-mape').setAttribute('aria-label', opis);
  $('przycisk-podejrzyj-mape').title = opis;
  $('przycisk-informacje').setAttribute('aria-expanded', String(info));
  $('przycisk-informacje').setAttribute('aria-pressed', String(info));
  // Jedno miejsce liczy stan obu ikon-warstw (wzorzec F3 właściciela: podświetlona
  // ikona = otwarta warstwa, drugi klik zamyka) — rozsypanie tego po handlerach
  // gwarantowałoby ikonę świecącą nad zamkniętą warstwą.
  $('przycisk-ranking').setAttribute('aria-expanded', String(ranking));
  $('przycisk-ranking').setAttribute('aria-pressed', String(ranking));
}

function przelaczPodgladMapy() {
  STAN.podgladMapy = !STAN.podgladMapy;
  odswiezWidocznoscPaneli();
  kazdaMapa(m => m.odswiez());
  $('przycisk-podejrzyj-mape').focus();
}

function zamknijInformacje() {
  $('ekran-informacje').hidden = true;
  document.body.classList.remove('informacje-otwarte');
  $('przycisk-informacje').setAttribute('aria-expanded', 'false');
  $('przycisk-informacje').setAttribute('aria-pressed', 'false');
}

function przelaczInformacje() {
  const otwieramy = $('ekran-informacje').hidden;
  $('ekran-informacje').hidden = !otwieramy;
  STAN.podgladMapy = false;
  odswiezWidocznoscPaneli();
  $(otwieramy ? 'przycisk-zamknij-informacje' : 'przycisk-informacje').focus();
}

/* ---------------------------- Ranking (zgłoszenie właściciela 2026-09-12, ADR 0039) */

/**
 * Adres rankingu: ten sam most co reszta (ADR 0020), akcja `ranking`.
 * Pusty łańcuch = ta wersja aplikacji nie ma adresu — wołający mówi to wprost.
 */
function urlRankingu() {
  const url = adresMostu();
  return url ? urlGet(url, 'ranking') : '';
}

function ustawStatusRankingu(tekst) {
  $('ranking-status').textContent = tekst;
}

/** Wypełnia `tbody` tabeli rankingu; buduje WYŁĄCZNIE komórki tekstowe. */
function wypelnijTabeleRankingu(idCiala, wiersze, zbudujKomorki) {
  const cialo = $(idCiala);
  cialo.replaceChildren();
  for (const wiersz of wiersze) {
    const tr = document.createElement('tr');
    for (const wartosc of zbudujKomorki(wiersz)) {
      const td = document.createElement('td');
      td.textContent = String(wartosc);
      tr.appendChild(td);
    }
    cialo.appendChild(tr);
  }
}

/**
 * Rysuje dwie tabele z danych mostu: „Ranking Punktowy Graczy” (suma punktów)
 * i „Mistrzowie Zagadek” (proporcja poprawnych do zadanych, próg 10 pytań).
 * Liczy je `app/ranking.js` — tu zostaje samo wstawienie wierszy i zdanie
 * o stanie danych (pusty ranking musi umieć powiedzieć, DLACZEGO jest pusty).
 */
function renderujRankingi() {
  const ranking = STAN.ranking;
  if (!ranking) return;
  const punktowy = rankingPunktowy(ranking);
  const mistrzowie = mistrzowieZagadek(ranking);
  wypelnijTabeleRankingu('ranking-punkty-wiersze', punktowy.wiersze,
    (w) => [w.pozycja, w.pseudonim, `${w.punkty} pkt`]);
  wypelnijTabeleRankingu('ranking-mistrzowie-wiersze', mistrzowie.wiersze,
    (w) => [w.pozycja, w.pseudonim, formatujSkutecznosc(w)]);
  const czesci = [punktowy.wszystkich
    ? `Graczy z potwierdzonym profilem: ${punktowy.wszystkich} — tabele pokazują po ${LIMIT_RANKINGU} pozycji.`
    : 'Ranking jest pusty — punkty zbiera gracz z potwierdzonym profilem (imię i PIN).'];
  if (punktowy.wszystkich) {
    // Próg mówimy ZAWSZE, nie tylko gdy nikt nie kwalifikuje — gracz musi
    // wiedzieć, dlaczego nie ma go w drugiej tabeli (LESSONS L6: brak danych
    // bez wyjaśnienia wygląda jak zgubiony wynik).
    czesci.push(`Mistrzowie Zagadek liczą się od ${mistrzowie.prog} zadanych pytań`
      + (mistrzowie.kwalifikowani ? '.' : ' — nikt jeszcze nie ma tyle.'));
  }
  ustawStatusRankingu(czesci.join(' '));
}

/** Pobiera ranking z mostu i rysuje tabele; każdą awarię nazywa po polsku (LESSONS L6). */
async function pobierzRankingi() {
  const url = urlRankingu();
  if (!url) {
    ustawStatusRankingu('Ta wersja aplikacji nie ma adresu mostu Drive — rankingu nie ma skąd pobrać (ADR 0020).');
    return;
  }
  ustawStatusRankingu('Pobieram ranking ze wspólnego Drive…');
  try {
    const odpowiedz = walidujRankingSurowy(await pobierzGetTekst(url));
    if (odpowiedz.usterka) {
      ustawStatusRankingu(`Nie udało się odczytać rankingu (${odpowiedz.usterka}) — spróbuj ponownie.`);
      return;
    }
    STAN.ranking = odpowiedz;
    renderujRankingi();
  } catch (e) {
    ustawStatusRankingu(`Nie udało się pobrać rankingu (${e?.powod ?? 'brak odpowiedzi'}) — sprawdź połączenie i spróbuj ponownie.`);
  }
}

function zamknijRankingi({ bezFokusu = false } = {}) {
  if ($('ekran-ranking').hidden) return;
  $('ekran-ranking').hidden = true;
  document.body.classList.remove('ranking-otwarte');
  // Stan ikony liczy `odswiezWidocznoscPaneli` — jedno miejsce dla obu warstw.
  odswiezWidocznoscPaneli();
  if (!bezFokusu) $('przycisk-ranking').focus();
}

/**
 * Ikona pucharu: pierwszy klik otwiera warstwę i pobiera ranking, drugi zamyka
 * (właściciel 2026-09-12: „Ranking jako ikonka pucharu w menu togglowana,
 * otwierany jako layer”).
 */
function przelaczRankingi() {
  if (!$('ekran-ranking').hidden) {
    zamknijRankingi();
    return;
  }
  STAN.podgladMapy = false;
  zamknijInformacje(); // warstwy nie świecą równocześnie
  $('ekran-ranking').hidden = false;
  document.body.classList.add('ranking-otwarte');
  odswiezWidocznoscPaneli();
  $('przycisk-zamknij-ranking').focus();
  void pobierzRankingi();
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
  const inputDla = (klucz) => [...lista.children].flatMap((l) => [...(l?.children ?? [])]).find((i) => i?.value === klucz);
  const zaznaczony = inputDla(wybranyKlucz);
  if (zaznaczony) zaznaczony.checked = true;
  lista.addEventListener('change', () => {
    // dzieci kontenera zamiast querySelector('input:checked') — to samo w
    // przeglądarce, a testowa atrapa DOM umie przejść po dzieciach (L19)
    const wybrany = [...lista.children].flatMap((l) => [...(l?.children ?? [])]).find((i) => i?.checked)?.value;
    if (wybrany) onChange(wybrany);
  });
}

function renderujTematy() {
  const lista = $('lista-tematow');
  lista.replaceChildren(...Object.entries(TEMATY_SETUP).map(([klucz, temat]) => {
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
  // Zaznaczanie przez `children` (nie querySelector po atrybucie) — jak przy
  // odczycie w `tematyZListy`: w przeglądarce to samo, a atrapa testowa też
  // to obsłuży (LESSONS L19), więc stan chipów daje się asertować w testach.
  for (const klucz of STAN.konfig.tematy) {
    for (const etykieta of lista.children) {
      const box = etykieta.children[0];
      if (box && box.value === klucz) box.checked = true;
    }
  }
  const poleWlasne = $('setup-temat-wlasny');
  poleWlasne.value = STAN.konfig.tematWlasny ?? '';
  const odswiezPoleWlasne = () => {
    poleWlasne.hidden = ![...lista.querySelectorAll('input:checked')].some((i) => i.value === 'wlasny');
  };
  odswiezPoleWlasne();
  lista.addEventListener('change', () => {
    STAN.konfig.tematy = tematyZListy(lista);
    odswiezPoleWlasne();
  });
  poleWlasne.addEventListener('input', () => { STAN.konfig.tematWlasny = poleWlasne.value; });
}

/**
 * Tematy zaznaczone na chipach `#lista-tematow` (chip = `label > input+span`).
 * Odczyt przez `children`, nie `querySelectorAll('input:checked')`: atrapa DOM
 * w testach nie ma silnika selektorów po elementach (LESSONS L19), a `children`
 * odwzorowuje — skrót „wszystkie/żadne" da się więc przetestować jak w
 * przeglądarce. W prawdziwym DOM oba odczyty dają to samo.
 */
function tematyZListy(lista) {
  return [...lista.children]
    .map((etykieta) => etykieta.children[0])
    .filter((input) => input && input.checked)
    .map((input) => input.value);
}

/**
 * Skróty „⊞ wszystkie"/„⊟ żadne" przy tematach pytań (właściciel, 2026-09-09).
 * „Dopisz sam" (`wlasny`) skrót nie rusza — to decyzja organizatora, nie
 * temat z kanonu. Stan konfiguracji czyta z DOMu tym samym kodem co handler
 * `change`, więc ręczne i skrócone zaznaczanie dają identyczny wynik.
 */
function ustawWszystkieTematy(zaznacz) {
  const lista = $('lista-tematow');
  for (const etykieta of lista.children) {
    const input = etykieta.children[0];
    if (!input || input.value === 'wlasny') continue;
    input.checked = zaznacz;
  }
  STAN.konfig.tematy = tematyZListy(lista);
  const poleWlasne = $('setup-temat-wlasny');
  poleWlasne.hidden = !STAN.konfig.tematy.includes('wlasny');
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
  renderujPolaTozsamosci(); // multi: pola wpisywania znikają po dodaniu siebie
  // Dołączającemu w multi lista gier ~50 m dopina się do ZNANEGO imienia bez
  // osobnego klikania (funkcja sama odmawia poza ścieżką „Dołączam” i bez
  // potwierdzonego gracza — hot-seat niczego tu nie wywoła).
  void odswiezListeGierNaSetupie();
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
  if (STAN.rodzajGry === 'multi' && (STAN.konfig.imiona ?? []).length >= 1) {
    // Multiplayer: dokładnie jedna osoba na telefon (właściciel 2026-09-11) —
    // ten sam limit co w `dodajGracza`, skrót zapamiętanych go nie omija.
    pokazBledy('bledy-profil', [{ komunikat: 'W multiplayerze gra z tego telefonu tylko jedna osoba — usuń siebie z listy, żeby zmienić gracza.' }]);
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
  if (!pseudo) return odmowa('Wpisz imię gracza — trafia do historii gier.', 'profil-pseudonim');
  if (STAN.rodzajGry === 'multi' && (STAN.konfig.imiona ?? []).length >= 1) {
    // Właściciel, 2026-09-11: w grze na wielu urządzeniach wpisujesz na setupie
    // TYLKO siebie (imię+PIN jak w hot-seat) — pozostałych zapraszasz w lobby.
    return odmowa('W grze na wielu urządzeniach gra z tego telefonu tylko JEDNA osoba — Ty. Pozostałych graczy dołączysz w lobby.', 'profil-pseudonim');
  }
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
      $('profil-stan').textContent = 'Ta wersja aplikacji nie ma adresu mostu — gracz dodany, ale historia gier nie zostanie zapisana.';
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
      $('profil-stan').textContent = 'Drive nie odpowiada — gracz dodany bez potwierdzenia. Historia tej gry nie zostanie zapisana; spróbuj przy następnej grze.';
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
      ? `Założono profil „${imie}" — historia gier tego gracza jest na wspólnym Drive.`
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
  if (STAN.rodzajGry === 'multi' && imiona.length > 1) {
    const komunikat = 'W grze na wielu urządzeniach na tym telefonie gra tylko JEDNA osoba — Ty. Usuń pozostałych graczy z listy (✕ Usuń), pozostałych zaproś w lobby.';
    pokazBledy('bledy-profil', [{ komunikat }]);
    $('profil-stan').textContent = komunikat;
    return false;
  }
  const bezPotwierdzenia = imiona.filter((_, i) => STAN.graczeZweryfikowani?.[i] === false);
  pokazBledy('bledy-profil', []);
  if (bezPotwierdzenia.length) {
    $('profil-stan').textContent = `Grasz lokalnie: ${bezPotwierdzenia.join(', ')} ${bezPotwierdzenia.length === 1 ? 'nie ma' : 'nie mają'} potwierdzenia z Drive — historia tej gry nie zostanie zapisana.`;
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
 * klucza ta sama gra weszłaby do historii tyle razy, ile razy się zapisała.
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
 * 2026-09-07). Punkty liczy most z przesłanych faktów, więc historia hot-seat
 * i gier wieloosobowych jest jedną historią. Awaria sieci niczego nie gubi:
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
    stanWysylkiWyniku('Wynik został na telefonie — żaden gracz nie ma potwierdzonego profilu, więc historia tej gry nie zostanie zapisana.');
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
    stanWysylkiWyniku('☁ Wynik jest na wspólnym Drive — gra jest w historii.');
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

/** Start aplikacji: wyniki z kolejki jadą na Drive (bez nich historia byłaby dziurawa). */
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
  if (doszlo) status(`Wyniki gier z kolejki (${doszlo}) doszły na wspólny Drive — historia jest pełna.`);
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
}

function czytajSetupZDomu() {
  // imiona i liczba graczy nie mają pól: żyją w liście graczy (`STAN.konfig`)
  return STAN.konfig;
}

/* --------------------------------------------------------------- pozycja */

function pokazPozycje() {
  const p = STAN.pozycja;
  if (!p) {
    $('pozycja-status').textContent = STAN.trybTestowy ? 'Tryb testowy: użyj oka i wskaż miejsce na mapie.' : 'Czekam na pozycję…';
    $('pozycja-wspolrzedne').textContent = '';
    $('przycisk-dalej-stacje').disabled = true;
    odswiezWarstwy();
    return;
  }
  $('pozycja-status').textContent = STAN.trybTestowy ? 'Pozycja ustawiona z mapy / symulacji' : 'Pozycja ustalona';
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
  // lecą cały czas — bez tej bramki cała rozgrywka to seria zapytań do
  // mostu o indeks, którego nikt wtedy nie ogląda: bateria, transfer i limit
  // kwoty Apps Script idą w błoto (ADR 0013: żadnych zbędnych żądań).
  // Właściciel 2026-09-11 (uwagi terenowe #2): GPS na miejscu dryfuje o metry,
  // więc oprócz „tylko na ekranie pozycji" dokładamy próg dystansu — sprawdzamy
  // raz po wejściu na ekran (kontrolna pozycja jest wtedy null), a potem dopiero
  // po odejściu ≥ 250 m od pozycji ostatniego sprawdzenia.
  if (STAN.ekran === 'pozycja') {
    const kontrolna = STAN.ostatniaPozycjaZestawow;
    const doscDaleko = !kontrolna
      || !STAN.pozycja
      || odlegloscM(kontrolna, STAN.pozycja) >= PROG_ODSWIEZENIA_ZESTAWOW_M;
    if (doscDaleko) {
      STAN.ostatniaPozycjaZestawow = STAN.pozycja ? { lat: STAN.pozycja.lat, lon: STAN.pozycja.lon } : null;
      odswiezPropozycjeZestawow();
    }
  }
}

/** Zamyka watcher, jeśli działa (ADR 0004 pkt 1: jeden watcher na rozgrywkę). */
function zatrzymajGps() {
  if (STAN.watcher) {
    STAN.watcher.zamknij();
    STAN.watcher = null;
  }
  if (STAN.gpsTimer) {
    clearInterval(STAN.gpsTimer);
    STAN.gpsTimer = null;
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
  // Bug G: o „GPS włączony” mówimy tylko na pierwszym starcie. Pauza, wznowienie,
  // profil baterii i watchdog też przechodzą tędy — restarowi watchera w trakcie
  // gry NIE wolno nadpisywać statusu rozgrywki (LESSONS L22).
  if (!STAN.ostatniFix) status('GPS włączony — pierwszy fix potrafi trwać kilkanaście sekund.');
  STAN.watcher = watchPozycja({
    geolocation: navigator.geolocation,
    zegar: () => performance.now(),
    opcje: PROFILE_GPS[STAN.profilGps] ?? PROFILE_GPS.dokladny, // M10/T3: bateria
    onFix: (fix) => {
      STAN.gpsOstatniZnakMs = performance.now(); // bug G: fix to znak życia
      STAN.gpsProba = 0;
      przyjmijFix(fix);
    },
    onBlad: (blad) => {
      STAN.gpsOstatniZnakMs = performance.now(); // bug G: błąd to też znak życia — pipe odpowiada
      pokazBledy('bledy-pozycja', [{ kod: blad.kod, pole: 'geolocation', komunikat: blad.komunikat }]);
      $('pozycja-status').textContent = 'Brak pozycji';
      status('Położenie niedostępne — gra czeka na sygnał. Wyjdź na otwartą przestrzeń, a jeśli stacja jest nieosiągalna, pomiń odcinek.' + ADR(' (ADR 0029)'));
    },
  });
  if (STAN.watcher?.czyAktywny() && !STAN.gpsTimer && czyUzbroicWatchdogGps()) {
    STAN.gpsTimer = setInterval(tykniecieGps, KROK_WATCHDOG_GPS_MS);
  }
  if (!STAN.watcher.czyAktywny()) $('pozycja-status').textContent = 'Brak pozycji';
}

/**
 * Czy w tej chwili w ogóle czekamy na fixa watchdogiem: na ekranie pozycji albo
 * w odcinku gry. Poza nimi watcher bywa aktywny (idzie za graczem między
 * ekranami), ale nie ma czegokolwiek, na co miałby czekać w ciszy — zegar jest
 * wtedy zbędny, a w testach nie wolno zostawiać żywych interwałów po instancji
 * (zawiesiłyby pętlę zdarzeń `node --test`).
 */
function czyUzbroicWatchdogGps() {
  if (STAN.trybTestowy || !STAN.watcher?.czyAktywny()) return false;
  if (STAN.ekran === 'pozycja') return true;
  const r = STAN.rozgrywka;
  return Boolean(r) && r.faza === FAZY.odcinek && !STAN.graPauza;
}

/**
 * Bug G: tyknięcie watchdoga GPS. Cisza dłuższa niż `LIMIT_MILCZENIA_GPS_MS`
 * bez JAKIEGOKOLWIEK callbacku oznacza martwy nasłuch (WebKit ignoruje wtedy
 * własny `timeout`) — zakładamy świeżego watchera i mówimy graczowi, która
 * to próba. „czyAktywny()” mówi tylko, że NASZ wrapper żyje, nie że WebKit
 * cokolwiek dostarczy — dokładnie ta pułapka kosztowała bez końca wiszący
 * ekran „Gdzie jesteś?”.
 */
function tykniecieGps() {
  if (!czyUzbroicWatchdogGps()) {
    if (STAN.gpsTimer) { clearInterval(STAN.gpsTimer); STAN.gpsTimer = null; }
    return;
  }
  const teraz = performance.now();
  if (!czyMilczy({ ostatniZnakMs: STAN.gpsOstatniZnakMs, terazMs: teraz, limitMs: LIMIT_MILCZENIA_GPS_MS })) return;
  const sekundy = Math.round((teraz - STAN.gpsOstatniZnakMs) / 1000);
  STAN.gpsProba += 1;
  wlaczGps(); // zatrzymuje starego watchera i zegar, zakłada świeże, resetuje licznik ciszy
  $('pozycja-status').textContent = komunikatMilczenia({ sekundy, proba: STAN.gpsProba });
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
      if (!STAN.trybTestowy) return;
      przyjmijFix(fixZPozycji(geo, performance.now(), ZRODLA_FIXA.symulacja));
      status('Pozycja ustawiona z mapy.');
    });
  }
}

function kazdaMapa(fn) {
  for (const mapa of Object.values(STAN.mapy)) if (mapa) fn(mapa);
}

/**
 * Zoom, przy którym promień gry zajmuje ~40% szerokości panelu (`geo.js`).
 *
 * Sufit przybliżenia (1000 m, decyzja właściciela 2026-09-12) siedzi
 * w `dopasujZoomDoPromienia` — dzięki temu ten sam sufit dostaje KAŻDA ścieżka,
 * która dobiera widok do promienia: stuknięcie mapy w trybie testowym, pierwszy
 * fix GPS i przeliczenie stacji po Overpassie (wszystkie wołają
 * `centrujNaPozycji`).
 */
function zoomDlaPromienia(mapa, lat) {
  const szerokosc = Math.max(mapa.rozmiar().szerokosc, 240);
  const promienM = STAN.konfig.promienM;
  // Puste albo ręcznie zepsute pole promienia nie może wysypać widoku:
  // wracamy do kadru sufitu, nie do najgłębszego zoomu trybu (LESSONS L10 —
  // widełki nie chronią przed NaN, a `TRYBY.piesza.zoom` = 17 to dokładnie ten
  // zoom, na którym kafle OSM bywają puste; brak szerokości geograficznej
  // liczymy dla Polski, bo tylko tam gra ma sens).
  if (!(promienM > 0) || !Number.isFinite(lat)) {
    return dopasujZoomDoPromienia(PROMIEN_SUFITU_ZOOMU_M, szerokosc, Number.isFinite(lat) ? lat : 52);
  }
  return dopasujZoomDoPromienia(promienM, szerokosc, lat);
}

/**
 * Przenosi stan aplikacji na warstwy map: marker pozycji z kołem dokładności,
 * okrąg promienia gry i numerowane pinezki stacji. Wołane po każdym fixie,
 * po przeliczeniu stacji i po zmianie ustawień, które widać na mapie.
 */
function odswiezWarstwy() {
  const p = STAN.pozycja;
  const fix = p ? { lat: p.lat, lon: p.lon } : null;
  kazdaMapa((mapa) => mapa.pokazPozycje(fix));
  if (STAN.mapy.pozycja) STAN.mapy.pozycja.zaznaczStacje([], { promienM: STAN.konfig.promienM });
  if (STAN.mapy.stacje) {
    // trasa-sekret: przy generowaniu paczki dla Wspólnej Trasy mapa stacji
    // nie rysuje kropek — organizator nie może poznać trasy z góry
    STAN.mapy.stacje.zaznaczStacje(STAN.ukryjStacje ? [] : STAN.stacje, { promienM: STAN.konfig.promienM, aktywna: null });
  }
}

/** Wyśrodkowuje mapy na pozycji gracza w zoomie dobranym do promienia gry. */
function centrujNaPozycji() {
  const p = STAN.pozycja;
  if (!p) return;
  kazdaMapa((mapa) => mapa.ustawSrodek({ lat: p.lat, lon: p.lon, zoom: zoomDlaPromienia(mapa, p.lat) }));
}

/**
 * Panel schowany (`hidden`) ma rozmiar 0, więc nie ma czego rysować —
 * po pokazaniu ekranu widok trzeba przeliczyć od nowa.
 */
function odswiezMapeEkranu(nazwa) {
  const mapa = STAN.mapy[['prompt', 'paczka'].includes(nazwa) ? 'stacje' : nazwa] ?? STAN.mapy.pozycja;
  if (mapa) mapa.odswiez();
}

/**
 * Jedyny lej fixów do stanu: watcher GPS i symulacja trasy karmią aplikację
 * tym samym kodem, więc badge dokładności, mapa i próg dojścia zachowują się
 * identycznie z GPS-em i bez niego (kryterium M3: gra bez GPS).
 */
function przyjmijFix(fix) {
  const ocena = ocenFix(fix);
  if (!ocena.akceptowany) {
    pokazBledy('bledy-pozycja', [{ kod: ocena.kod, pole: 'geolocation', komunikat: ocena.komunikat }]);
    return;
  }
  STAN.ostatniFix = fix;
  STAN.ocenaFixa = ocena;
  STAN.pozycja = { lat: fix.lat, lon: fix.lon };
  STAN.dokladnoscM = null; // pole wyłącznie zgodności zapisu, ADR 0034
  STAN.historiaFixow = dodajFix(STAN.historiaFixow, fix);
  pokazBledy('bledy-pozycja', ocena.kod ? [{ kod: ocena.kod, pole: 'geolocation', komunikat: ocena.komunikat }] : []);
  pokazPozycje();
  aktualizujGreNaFix(fix); // M6: ten sam lej co GPS i symulacja — gra widzi fixy identycznie
}

/* --------------------------------------------------- symulacja dojścia */

/** Odtwarzanie: jeden fix co tyle ms (tylko tryb testowy, ADR 0004 pkt 6). */
const SYMULACJA_KROK_MS = 120;
/** Próba dojścia: 250 m na azymucie 45°, 12 s „marszu", fix co 2 s + postój. */
const SYMULACJA = { czasMs: 12000, coMs: 2000, accuracyM: 12 };

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
    renderujMiejsce();
  }
}

/**
 * Wyświetlenie nazwy miejsca (zawsze pobierana z siecią dróg — ADR 0013 pkt 3;
 * warstwa zapasowa Nominatim usunięta 2026-09-11 decyzją właściciela).
 */
function renderujMiejsce() {
  const pole = $('pozycja-miejsce');
  if (!STAN.miejsce) {
    pole.textContent = 'nazwa miejsca: brak — pobierana z siecią dróg na ekranie stacji';
    return;
  }
  pole.textContent = `miejsce: ${STAN.miejsce}`;
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

/** Limit całej próby (nagłówki i ciało), także gdy fetch nie respektuje abort. */
async function pobierzTekstSieci(f, url, zapytanie) {
  const kontroler = new AbortController();
  let timer;
  let uplynalCzas = false;
  try {
    const limit = new Promise((_, odrzuc) => {
      timer = setTimeout(() => {
        uplynalCzas = true;
        kontroler.abort();
        odrzuc(Object.assign(new Error('Przekroczono czas oczekiwania 10 s'), { timeout: true }));
      }, POLITYKA.timeoutMs);
    });
    return await Promise.race([limit, (async () => {
      const odpowiedz = await f(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(zapytanie)}`,
        signal: kontroler.signal,
      });
      if (!odpowiedz.ok) throw Object.assign(new Error(`HTTP ${odpowiedz.status}`), { status: odpowiedz.status });
      return await odpowiedz.text();
    })()]);
  } catch (blad) {
    // Nie zależymy od nazwy/tekstu błędu zwróconego przez przeglądarkę.
    if (uplynalCzas || kontroler.signal.aborted) {
      throw Object.assign(new Error('Przekroczono czas oczekiwania 10 s'), { timeout: true });
    }
    throw blad;
  } finally {
    clearTimeout(timer);
  }
}

/** Sekwencyjnie: ostatnia sprawna najpierw, 10 s na próbę; wyniki w Informacjach. */
async function pobierzSiec(terazMs) {
  const f = typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  if (!f) return false;
  const zapytanie = budujZapytanieOverpass({
    srodek: STAN.pozycja, promienM: STAN.konfig.promienM, tryb: STAN.konfig.tryb,
  });
  const lancuch = kolejnoscInstancji(czytajSprawnaInstancje());
  const lista = $('siec-proby');
  lista.textContent = '';
  lista.hidden = false;
  for (let i = 0; i < lancuch.length; i++) {
    const instancja = lancuch[i];
    const wpis = document.createElement('li');
    const prefiks = `Próba ${i + 1}/${lancuch.length}: ${instancja.nazwa}`;
    wpis.textContent = `${prefiks} — pobieram (limit 10 s)…`;
    lista.appendChild(wpis);
    status(wpis.textContent);
    try {
      const tekst = await pobierzTekstSieci(f, instancja.url, zapytanie);
      const sparsowane = parsujOdpowiedz(JSON.parse(tekst));
      const dane = upraszczajDaneDoCache(sparsowane);
      if (tekst.length <= 8_000_000) zapiszCacheSieci(kluczSieci(), dane, terazMs);
      else status(KODY_SIECI.S04);
      ustawSiec(dane, { zCache: false, klucz: kluczSieci() });
      zapiszSprawnaInstancje(instancja.url);
      wpis.textContent = `${prefiks} — pobrano sieć dróg.`;
      return true;
    } catch (blad) {
      const timeout = blad?.timeout === true || blad?.name === 'AbortError';
      const opis = timeout ? 'przekroczono czas oczekiwania 10 s'
        : blad?.status ? `HTTP ${blad.status}`
        : blad?.name === 'SyntaxError' ? 'niepoprawna odpowiedź serwera'
        : (blad?.komunikat ?? blad?.message ?? 'błąd połączenia');
      wpis.textContent = `${prefiks} — ${opis}.`;
      const przelacz = i < lancuch.length - 1 && czyPrzelaczycInstancje({
        status: blad?.status ?? null, timeout,
        bladSieci: ['TypeError', 'NetworkError', 'SyntaxError'].includes(blad?.name) || blad?.kod === 'S01',
      });
      if (przelacz) {
        const pauza = [406, 429].includes(blad?.status) || blad?.status >= 500;
        status(`${wpis.textContent} Próbuję kolejną instancję.`);
        if (pauza) await new Promise(r => setTimeout(r, STAN.odstepOverpassMs));
        continue;
      }
      pokazBledy('bledy-stacje', [{
        kod: blad?.kod ?? 'S03', pole: 'siec',
        komunikat: 'Nie udało się pobrać sieci dróg. Szczegóły w ⓘ Informacje. Spróbuj ponownie lub użyj trybu uproszczonego.',
      }]);
      return false;
    }
  }
  return false;
}

/** Wspólny koniec każdej ścieżki: wybór stacji z tego, co jest, i render. */
function przeliczZTegoCoJest() {
  const uzyjSieci = STAN.siec.stan === 'gotowa' && grafDlaTrybu(STAN.konfig.tryb);
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
  $('siec-proby').textContent = '';
  $('siec-proby').hidden = true;
  pokazBledy('bledy-stacje', []); // błędy POPRZEDNIEJ próby gasną; nowa próba pokaże własne
  wylaczTrybReczny(); // nowy układ zastępuje ręcznie przesunięte pinezki
  const klucz = kluczSieci();
  if (STAN.siec.stan !== 'gotowa' || STAN.siec.klucz !== klucz) {
    const zCache = odczytajCacheSieci(klucz, Date.now());
    if (zCache) {
      ustawSiec(zCache, { zCache: true, klucz });
    } else if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      przeliczStacjeZPobraniem(klucz);
      return;
    }
  }
  przeliczZTegoCoJest();
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
  const sieciowe = Boolean(STAN.wynikSieci);
  if (STAN.ukryjStacje) {
    // Wspólna Trasa = trasa-sekret (właściciel, 2026-09-11): organizator
    // generujący paczkę nie widzi nazw miejsc ani współrzędnych — tylko
    // status, że stacje powstały (kropki na mapie chowa `odswiezWarstwy`).
    const li = document.createElement('li');
    // Komunikat mówi, czy stacje ZLOKALIZOWANO na sieci dróg (właściciel,
    // pierwotny pomysł multi: „wygenerowano i zlokalizowano/nie zlokalizowano
    // X stacji"). Pierścień jest układem zastępczym — jego osiągalność nie
    // jest zweryfikowana, więc organizator ma to wiedzieć ZANIM wyjdzie.
    li.textContent = sieciowe
      ? `Wygenerowano i zlokalizowano stacji: ${STAN.stacje.length}. Nazwy i położenie są ukryte — trasa odsłania się w czasie gry, po jednej stacji.`
      : `Wygenerowano stacji: ${STAN.stacje.length}, ale NIE zlokalizowano ich na sieci dróg (układ pierścieniowy, osiągalność niezweryfikowana). Nazwy i położenie są ukryte — trasa odsłania się w czasie gry, po jednej stacji.`;
    lista.replaceChildren(li);
    $('stacje-tryb').textContent = 'Tryb tajnej trasy: mapa i lista nie pokazują stacji.';
    $('przycisk-reczne').hidden = true; // przeciąganie pinezek pokazałoby stacje
    // „Inny układ" też odsłania stacje (nowy układ = inne punkty do zgadnięcia),
    // a właściciel w tajnej trasie tej opcji nie chce wcale.
    $('przycisk-przelicz').hidden = true;
    $('przycisk-siec-ponow').hidden = STAN.siec.stan === 'gotowa';
    return;
  }
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
    const miejsce = STAN.miejsce ? ` · miejsce: ${STAN.miejsce}` : '';
    const cache = STAN.siec.zCache ? ' (z pamięci telefonu — Overpass nie został wywołany)' : '';
    $('stacje-tryb').textContent = `${ZRODLA_STACJI.siec}${cache}${miejsce}.`;
    $('przycisk-reczne').hidden = true;
    // Sieć z cache (telefon pamięta okolicę) daje ponowienie — świeże pobranie
    // omija cache; przy danych sprzed chwili przycisk nie ma sensu.
    $('przycisk-siec-ponow').hidden = !STAN.siec.zCache;
  } else {
    $('stacje-tryb').textContent = `${ZRODLA_STACJI.pierscien}. Stacje z sieci dróg, placów i szlaków pojawią się po pobraniu danych Overpass — wymaga połączenia z internetem.` + ADR(' (ADR 0005)');
    if (STAN.trybReczny) {
      $('stacje-tryb').textContent += ' Tryb ręczny WŁĄCZONY: przeciągnij pinezki na mapie. Dystans pokazujemy tylko w linii prostej — osiągalność niezweryfikowana.';
    } else if (STAN.stacje.some((s) => s.zrodlo === 'reczne')) {
      $('stacje-tryb').textContent += ` Część stacji ${ZRODLA_STACJI.reczne} — dystans w linii prostej.`;
    }
    $('przycisk-reczne').hidden = false;
    $('przycisk-przelicz').hidden = false; // poza tajną trasą „Inny układ" jest dostępny
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
  odswiezPasekDrogi();
  if (r.faza !== FAZY.odcinek) return;
  const d = stanDojscia(STAN.historiaFixow, pod.stacja);
  $('gra-dystans-odcinka').textContent = d.dystansM == null ? '— m' : `${Math.round(d.dystansM)} m do stacji ${pod.stacja.id}`;
  dostosujProfilGps(d.dystansM); // M10/T3: „budzenie przy zbliżaniu"
  if (d.kod) {
    $('gra-komunikat').textContent = d.komunikat;
    return;
  }
  if (d.dotarl) zakonczOdcinekGry(TRYBY_DOJSCIA.gps, fix);
}

/** W drodze mapa + pojedynczy pasek; istniejące kontrolki przenosimy bez klonowania. */
function odswiezPasekDrogi() {
  const r = STAN.rozgrywka;
  if (!r) return;
  const droga = !$('gra-panel-odcinek').hidden;
  const sterowanie = $('gra-sterowanie');
  const docelowy = $(droga ? 'informacje-gra' : 'gra-slot-sterowanie');
  if (sterowanie.parentNode !== docelowy) docelowy.appendChild(sterowanie);
  $('gra-pasek').hidden = !droga;
  const pod = podglad(r);
  const imie = pod.gracz?.imie ?? '—';
  const dystans = STAN.pozycja && pod.stacja ? Math.round(odlegloscM(STAN.pozycja, pod.stacja)) : '—';
  const indeks = r.stacje.findIndex(s => s.id === r.biezacaStacja) + 1;
  // Właściciel 2026-09-11: dystans w pasku ma być widoczny od razu (zielona
  // pigułka), nie tylko w Informacjach — dlatego pasek budujemy z węzłów,
  // a nie z jednego textContent.
  const pasek = $('gra-pasek');
  pasek.replaceChildren(`Kto: ${imie} `);
  const pigulka = document.createElement('span');
  pigulka.className = 'pasek-dystans';
  pigulka.textContent = `(odległość od stacji ${dystans} m)`;
  pasek.append(pigulka, ` · stacja ${indeks} z ${r.stacje.length}`);
  // Dojście ma odsłonić pytanie także po korzystaniu ze sterowania w Informacjach.
  if (STAN.bylPasekDrogi && !droga && !$('gra-panel-pytanie').hidden) zamknijInformacje();
  STAN.bylPasekDrogi = droga;
  odswiezWidocznoscPaneli();
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
    // Właściciel 2026-09-11 (preview, „niechciany layer"): pauza — zwykle
    // AUTOMATYCZNA po zwinięciu karty/okna (visibilitychange) — woła ten
    // render i wstawiała panel oczekiwania ponad oceną odpowiedzi, którą
    // gracz właśnie czyta. Dopóki trwa pokaz oceny (M6/R5), panele się NIE
    // przełączają; domyka je dopiero „Następna stacja" (patrz nastepnaStacja).
    // Wyjątek: RĘCZNE zakończenie gry — wynik „teraz" jest ważniejszy niż
    // dokończenie czytania oceny (naturalny koniec z odpowiedzi czeka
    // z oceną na „🏁 Zobacz wynik", bo to jeszcze część tej samej odpowiedzi).
    const pokazOceny = !STAN.graZakonczonaRecznie
      && !$('gra-panel-pytanie').hidden && !$('gra-wynik-odpowiedzi').hidden;
    if (!pokazOceny) {
      // Właściciel 2026-09-11 (uwagi terenowe #2): w fazie pytania ekran ma być
      // czysty — pytanie, odpowiedzi i wynik. Nagłówek „Gra", badge'y i przyciski
      // „pomiń/zakończ" nie są wtedy potrzebne. Panel multi żyje poza slotem.
      // Zgłoszenie właściciela 2026-09-12 (D a): na ekranie wyników slot
      // sterowania („Gra”, badge'y kolejki/dystansu, „Pomiń odcinek”,
      // „Zakończ grę”) znika CAŁY — nad wynikami zostawały resztki stanu gry.
      $('gra-slot-sterowanie').hidden = r.faza === FAZY.pytanie || koniec;
      $('gra-panel-oczekuje').hidden = koniec || r.faza !== FAZY.przygotowanie;
      $('gra-panel-odcinek').hidden = koniec || r.faza !== FAZY.odcinek;
      $('gra-panel-pytanie').hidden = koniec || r.faza !== FAZY.pytanie;
      $('gra-panel-koniec').hidden = !koniec;
      if (koniec) pokazWyniki();
    }
  }

  if (panele && r.faza === FAZY.przygotowanie && pod.stacja) {
    $('gra-kto-idzie').textContent = pod.gracz ? `Idzie: ${pod.gracz.imie} → stacja ${indeks + 1}` : `Stacja ${indeks + 1}`;
    $('gra-cel-stacji').textContent = `${pod.stacja.opis || 'Cel bez opisu'} · ${formatujWspolrzedne(pod.stacja.lat, pod.stacja.lon)} · ${Math.round(pod.dystansM)} m ${pod.dystansSieciowy ? 'drogą' : 'w linii prostej'} od poprzedniego punktu`;
    $('przycisk-start-odcinka').textContent = `▶ Idę do stacji ${indeks + 1}`;
  }

  if (panele) {
    // Pauza (albo cudza tura) w trakcie czytania wyjaśnienia zmienia sens
    // przycisku „dalej" — musi przestać obiecywać start odcinka.
    const dalej = $('przycisk-nastepna-stacja');
    if (!dalej.hidden && r.faza !== FAZY.koniec) dalej.textContent = etykietaPrzyciskuDalej(r);
    $('przycisk-start-odcinka').disabled = STAN.graPauza;
    $('przycisk-symulacja-gra').hidden = !(STAN.trybTestowy && r.faza === FAZY.odcinek);
    $('przycisk-pomin-stacje').disabled = r.faza !== FAZY.odcinek || STAN.graPauza; // ADR 0015 pkt 2: tylko w drodze
  }

  if (STAN.mapy.gra) {
    // Wspólna Trasa to trasa-sekret (właściciel, 2026-09-11): na mapie widać
    // TYLKO bieżącą stację — kolejne odsłaniają się po zamknięciu poprzedniej.
    // Sekret jest własnością GRY (pole trasaSekret z mostu); brak pola w starych
    // grach traktujemy jak sekret (zgodność wstecz z m12-73).
    const graSekret = STAN.multi?.gra?.tryb === TRYBY_GRY.trasa && STAN.multi.gra.trasaSekret !== false;
    const stacjeWidoczne = graSekret
      ? STAN.stacje.filter((s) => Number(s.id) === Number(r.biezacaStacja))
      : STAN.stacje;
    STAN.mapy.gra.zaznaczStacje(stacjeWidoczne, { promienM: STAN.konfig.promienM, aktywna: r.biezacaStacja });
  }
  odswiezPasekDrogi();
  if (STAN.multi) renderujPanelMulti(); // M11/P4: żywe wyniki, pasek synchronizacji
}

/* ---------------- M9/R3: repozytorium paczek (ADR 0017) ---------------- */

/** Rejestr zestawów z `localStorage` (tolerancyjnie: śmieć = pusta lista). */
function czytajRejestrZestawow() {
  if (typeof localStorage === 'undefined') return nowyRejestr();
  const { rejestr } = walidujRejestrSurowy(localStorage.getItem(KLUCZ_REJESTRU) ?? '');
  return rejestr;
}

/**
 * Jednorazowy porządek rejestru przy starcie (właściciel, 2026-09-11): stare
 * wpisy niosą listę tematów DOPUSZCZALNYCH w setupu, z którego paczka powstała —
 * a to bywa szersze niż faktyczna zawartość (model nie zawsze pisze pytania
 * ze wszystkich tematów). Dopasowanie porównuje tematy wpisu z setupem, więc
 * paczka była odrzucana, choć pytań z „obcych" tematów w niej nie ma. Tu wpisy
 * (i pełne zapisy) przechodzą na FAKTYCZNE tematy pytań z paczki. Idempotentne:
 * drugi start nie zmienia nic, a wpis bez czytelnej paczki zostaje jak był.
 */
function ujedgajnijTematyWpisowLokalnych() {
  if (typeof localStorage === 'undefined') return;
  try {
    const wpisy = czytajRejestrZestawow();
    let zmiana = false;
    for (const wpis of wpisy) {
      const { zestaw } = walidujZestawLokalnySurowy(localStorage.getItem(kluczZestawu(wpis.skrot)) ?? '');
      const faktyczne = faktyczneTematyPytan(odpakujPaczke(zestaw?.kontener).paczka?.pytania ?? []);
      if (!faktyczne.length) continue; // brak paczki w pamięci albo puste pytania: nie ruszamy
      const zapisane = [...new Set((wpis.tematy ?? []).map(kanonicznyTemat))];
      if (zapisane.length === faktyczne.length && zapisane.every((t, i) => t === faktyczne[i])) continue;
      wpis.tematy = faktyczne;
      if (zestaw) {
        zestaw.tematy = faktyczne; // pełny wpis też niesie spłaszczoną metę
        localStorage.setItem(kluczZestawu(wpis.skrot), JSON.stringify(zestaw));
      }
      zmiana = true;
    }
    if (zmiana) localStorage.setItem(KLUCZ_REJESTRU, JSON.stringify({ schemat: SCHEMAT_INDEKSU, wpisy }));
  } catch {
    // porządek rejestru nie może kłaść startu aplikacji (LESSONS L10)
  }
}

/**
 * Identyfikator paczki na Drive zapamiętany przy skrócie kontenera.
 *
 * ADR 0028 aneks (właściciel 2026-09-09): każda paczka jest na Drive — ta
 * z repozytorium przychodzi z `id` we wpisie indeksu, ta wygenerowana dostaje
 * `id` w odpowiedzi mostu na wysyłkę. Zapamiętanie go przy skrócie sprawia, że
 * druga gra z pamięci telefonu też pozwala ocenić pytania.
 */
const KLUCZ_ID_PACZEK = 'okolica:paczki-drive';
const MAKS_ID_PACZEK = 24;

function czytajIdPaczek() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const surowy = JSON.parse(localStorage.getItem(KLUCZ_ID_PACZEK) ?? 'null');
    if (!surowy || typeof surowy !== 'object' || typeof surowy.pary !== 'object' || !surowy.pary) return {};
    const czyste = {};
    for (const [skrot, id] of Object.entries(surowy.pary)) {
      if (typeof skrot === 'string' && typeof id === 'string' && id) czyste[skrot] = id;
    }
    return czyste;
  } catch {
    return {}; // śmieci w localStorage nie kładą aplikacji (LESSONS L10)
  }
}

function zapamietajIdPaczkiDlaZestawu(skrot, id) {
  if (typeof localStorage === 'undefined') return;
  if (typeof skrot !== 'string' || !skrot || typeof id !== 'string' || !id) return;
  const pary = czytajIdPaczek();
  delete pary[skrot]; // najświeższy wpis idzie na koniec (proste LRU)
  pary[skrot] = id;
  const klucze = Object.keys(pary).slice(-MAKS_ID_PACZEK);
  const przyciete = {};
  for (const k of klucze) przyciete[k] = pary[k];
  try {
    localStorage.setItem(KLUCZ_ID_PACZEK, JSON.stringify({ schemat: 'paczki-drive/1', pary: przyciete }));
  } catch {
    /* pełna pamięć telefonu nie może zepsuć gry — ocena po prostu nie zadziała */
  }
}

function idPaczkiDlaZestawu(skrot) {
  return typeof skrot === 'string' && skrot ? (czytajIdPaczek()[skrot] ?? '') : '';
}

/**
 * Panel ocen po spóźnionym poznaniu `id` paczki: wysyłka na Drive kończy się
 * PO tym, jak gracz może już patrzeć na pytanie, więc kciuki trzeba odsłonić
 * bez czekania na następny render.
 */
function odswiezPanelOcenPoIdPaczki() {
  if (!STAN.ocenianePytanieId) return;
  renderujPanelOcen({ id: STAN.ocenianePytanieId });
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
    // Faktyczne tematy pytań (właściciel 2026-09-11): meta opisuje zawartość
    // paczki, nie listę dopuszczalnych z setupu.
    pytania: pytaniaBiezacejSesji(),
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
 * gry sieciowe są w tej wersji podłączone (LESSONS L6: status jawny).
 * Jeden tekst z `app/most.js` trafia do obu miejsc, żeby nie było dwóch prawd.
 */
function pokazStanMostu() {
  const { tekst, podlaczony } = stanMostu(undefined, { testowy: STAN.trybTestowy });
  // Sam adres w kodzie (ADR 0020) to jeszcze nie działające połączenie:
  // po nieudanej próbie mówimy o tym wprost (zgłoszenie właściciela
  // 2026-09-12 — panel obiecywał „podłączony”, a paczki się nie pokazywały).
  const awaria = podlaczony ? STAN.mostOstatniBlad : null;
  const opis = awaria ? `${tekst} Ostatnia próba nie doszła: ${awaria}.` : tekst;
  // jedyny miejscowy pokaz stanu mostu (karta na ekranie pozycji); linijkę
  // z karty multi na setupie właściciel usunął (uwagi terenowe #3, 2026-09-11)
  for (const id of ['most-stan-repo']) {
    const el = $(id);
    if (!el) continue;
    el.textContent = opis;
    el.classList.toggle('bledy', !podlaczony || Boolean(awaria)); // brak połączenia = widoczne ostrzeżenie, nie szara podpowiedź
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
 * Kandydaci bieżącej karty propozycji (lokalne + repo) i stan rozwinięcia.
 * Właściciel 2026-09-11: lista pokazuje trzy najlepsze paczki, reszta po
 * przycisku „Zobacz więcej paczek"; pierwsze są najlepiej ocenione.
 */
let KANDYDACI_ZESTAWOW = [];
let ZESTAWY_ROZWINIETE = false;
const LIMIT_ZESTAWOW_NA_LISCIE = 3;

/** Sort kandydatów: najwięcej ocen pozytywnych pierwsza, przy remisie świeższa data. */
function sortujKandydatowZestawow(a, b) {
  return (b.plus - a.plus) || String(b.data).localeCompare(String(a.data));
}

/** Rysuje listę propozycji od zera: sort, limit i stan przycisku „więcej". */
function renderujZestawy() {
  const lista = $('zestawy-lista');
  lista.replaceChildren();
  const posortowane = [...KANDYDACI_ZESTAWOW].sort(sortujKandydatowZestawow);
  const widoczne = ZESTAWY_ROZWINIETE ? posortowane : posortowane.slice(0, LIMIT_ZESTAWOW_NA_LISCIE);
  for (const k of widoczne) lista.append(wierszZestawu(k.opis, k.etykieta, k.akcja, k.statystyki, k.factcheck));
  const wiecej = $('przycisk-zestawy-wiecej');
  wiecej.hidden = KANDYDACI_ZESTAWOW.length <= LIMIT_ZESTAWOW_NA_LISCIE;
  wiecej.textContent = ZESTAWY_ROZWINIETE ? 'Zobacz mniej paczek' : 'Zobacz więcej paczek';
}

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
  // Nowe kryteria (pozycja, setup) = nowa lista: startuje zwinięta.
  ZESTAWY_ROZWINIETE = false;
  KANDYDACI_ZESTAWOW = dopasujZestawy(czytajRejestrZestawow(), kryteria).map((wpis) => ({
    opis: `${wpis.miejsce} · ${wpis.data} · ${wpis.liczbaStacji} stacji × ${wpis.pytaniaNaStacje} pytań · ${wpis.tematy.join(', ')} · ${wpis.wiek}`,
    etykieta: '📱 z tego telefonu:',
    akcja: () => grajZZestawemLokalnym(wpis.skrot),
    statystyki: '',
    factcheck: czyWpisFactcheck(wpis),
    // Oceny żyją na Drive (ADR 0028) — paczka z telefonu zaczyna bez głosów.
    plus: 0,
    data: wpis.data,
  }));
  renderujZestawy();
  const url = adresMostu(); // ADR 0020: adres z kodu aplikacji (albo nadpisany w pamięci telefonu)
  pokazStanMostu();
  if (!url) {
    $('zestawy-status').textContent = KANDYDACI_ZESTAWOW.length
      ? 'Masz gotowe paczki z tego telefonu. Wspólne repozytorium (Drive) nie jest podłączone w tej wersji aplikacji.'
      : 'Wspólne repozytorium (Drive) nie jest podłączone w tej wersji aplikacji — nowe pytania przygotuje model.';
    return;
  }
  $('zestawy-status').textContent = KANDYDACI_ZESTAWOW.length
    ? 'Masz gotowe paczki z tego telefonu; sprawdzam też repozytorium…'
    : 'Sprawdzam repozytorium paczek dla tej okolicy…';
  const f = fetchPrzegladarki(); // L18: nigdy gołe fetch
  if (!f) {
    $('zestawy-status').textContent = KANDYDACI_ZESTAWOW.length
      ? 'Repozytorium niedostępne — zostały paczki z tego telefonu.'
      : 'Repozytorium niedostępne — gramy zwykłą ścieżką (prompt i model).';
    return;
  }
  // Odświeżenie jest asynchroniczne, a setup woła je przy każdej zmianie
  // (pozycja, liczba graczy, czas). Bez tego licznika dwie nakładające się
  // próby dopisałyby te same paczki drugi raz — lista musi pokazywać jedno
  // pokolenie odpowiedzi, więc starsze ignorujemy (LESSONS L32).
  const pokolenie = ++POKOLENIE_PROPOZYCJI;
  void pobierzIndeksZRepo(url, kryteria, pokolenie);
}

/**
 * Indeks repozytorium: jedno żądanie i JEDNA powtórka. Powtórka leczy zimny
 * start web app po wdrożeniu (najczęstszą przyczynę „Repozytorium
 * niedostępne”). Gdy most odpowiedział NIECZYTELNIE, powtarzanie nic nie
 * zmieni — wtedy od razu mówimy prawdę.
 *
 * Sieć i NASZE czytanie odpowiedzi są rozdzielone (zgłoszenie właściciela
 * 2026-09-12: „most na pewno działa, to musiał być problem ze sprawdzaniem
 * paczek”). Wcześniejszy `.catch(() => …)` obejmował cały łańcuch i każdy
 * wyjątek — także usterkę we własnym kodzie na poprawnej odpowiedzi — meldował
 * jako „most nie odpowiada”. Teraz awaria mostu (z powodem) i błąd aplikacji to
 * dwa różne komunikaty, a powtórka należy się WYŁĄCZNIE pierwszemu.
 */
async function pobierzIndeksZRepo(url, kryteria, pokolenie) {
  const aktualne = () => pokolenie === POKOLENIE_PROPOZYCJI;
  const gdzie = adresDoDiagnostyki(url);
  let powod = 'brak odpowiedzi';
  let szczegol = null;
  for (let proba = 1; proba <= 2; proba += 1) {
    let tekst;
    try {
      tekst = await pobierzGetTekst(url);
    } catch (e) {
      if (!aktualne()) return;
      powod = e?.powod ?? 'brak odpowiedzi';
      szczegol = null;
      if (proba === 1) {
        $('zestawy-status').textContent = `Most Drive nie odpowiedział (${powod}) — próbuję jeszcze raz…`;
        await new Promise((r) => setTimeout(r, PONOWNA_PROBA_INDEKSU_MS));
        if (!aktualne()) return;
      }
      continue;
    }
    if (!aktualne()) return;
    let usterka;
    try {
      usterka = przyjmijIndeksZRepo(tekst, kryteria, url);
    } catch (e) {
      // Most ODPOWIEDZIAŁ — wysypało się nasze czytanie odpowiedzi. Nie wolno
      // tego zameldować jako awarii mostu ani „leczyć” powtórką żądania.
      STAN.mostOstatniBlad = null;
      pokazStanMostu();
      const opis = String(e?.message ?? e);
      // Bez obiecywania, co gracz widzi: lista mogła się wysypać w połowie.
      $('zestawy-status').textContent = `Repozytorium odpowiedziało, ale lista paczek się nie wczytała `
        + `(błąd aplikacji: ${opis}) — lista może być niepełna, zgłoś ten błąd.`;
      return;
    }
    if (!usterka) {
      STAN.mostOstatniBlad = null;
      pokazStanMostu();
      return;
    }
    // Odpowiedź niezrozumiała: powodu szukamy u siebie i w adresie, nie w sieci.
    powod = `nieczytelna odpowiedź (${usterka.kod})`;
    szczegol = `${usterka.kod} — ${usterka.komunikat}`;
    break;
  }
  if (!aktualne()) return;
  // Pełny powód (z kodem usterki) trafia do stanu mostu; w zdaniu wystarcza kod.
  STAN.mostOstatniBlad = szczegol ?? powod;
  pokazStanMostu();
  $('zestawy-status').textContent = KANDYDACI_ZESTAWOW.length
    ? `Repozytorium niedostępne (${powod}${gdzie}) — zostały paczki z tego telefonu.`
    : `Repozytorium niedostępne (${powod}${gdzie}) — gramy zwykłą ścieżką (prompt i model).`;
}

/** Adres mostu do komunikatu awarii — rozpoznawalny, ale nie cały URL.
 *  Właściciel może mieć kilka wdrożeń Apps Script o różnych adresach, więc przy
 *  awarii pokazujemy prefiks identyfikatora wdrożenia: po nim widać, czy
 *  aplikacja pyta o TO wdrożenie, które przed chwilą wkleił (ADR 0020: adres
 *  wdrożenia jest publicznym punktem końcowym, nie sekretem). */
function adresDoDiagnostyki(url) {
  try {
    const u = new URL(String(url));
    const id = u.hostname === 'script.google.com' ? u.pathname.match(/\/s\/([^/]+)/)?.[1] : null;
    return id ? `, ${u.host}/s/${id.slice(0, 10)}…/exec` : `, ${u.host}`;
  } catch {
    return '';
  }
}

/**
 * Odpowiedź indeksu → lista propozycji. `null` = przyjęte; obiekt usterki =
 * „most odpowiedział, ale NIE rozumiemy odpowiedzi” (Z01/Z09, a także Z10, gdy
 * nie dało się wczytać ANI JEDNEGO wpisu). Rozróżnienie jest istotą sprawy:
 * poprzednia wersja zwracała `false`, a wołający meldował to jako awarię sieci
 * (LESSONS L6/L51 — komunikat nazywa przyczynę, także gdy przyczyną jesteśmy my).
 */
function przyjmijIndeksZRepo(tekst, kryteria, urlZrodla) {
  const { indeks, usterki } = walidujIndeksSurowy(tekst);
  const nieczytelna = usterki.find((u) => u.kod === 'Z01' || u.kod === 'Z09')
    ?? (indeks.length === 0 ? usterki.find((u) => u.kod === 'Z10') : null);
  if (nieczytelna) return nieczytelna;
  const dopasowane = dopasujMetaIndeksu(indeks, kryteria);
  KANDYDACI_ZESTAWOW.push(...dopasowane.map((meta) => ({
    opis: `${meta.miejsce} · ${meta.data} · ${meta.liczbaStacji} stacji × ${meta.pytaniaNaStacje} pytań · ${meta.tematy.join(', ')} · ${meta.wiek} · ${meta.licencja}`,
    etykieta: '🌍 repozytorium:',
    akcja: () => grajZZestawemZRepo(meta, urlZrodla),
    // Brak pola `oceny` w indeksie = most sprzed ADR 0028 (nowy zwraca je
    // zawsze, nawet jako zera) — mówimy to wprost, bez obwiniania sieci.
    statystyki: meta.oceny === undefined
      ? 'Statystyk ocen jeszcze nie ma: ta wersja mostu Drive ich nie zwraca.'
      : opisOcenTekst(walidujStatystykiOcen(meta.oceny)),
    factcheck: czyWpisFactcheck(meta),
    // Sort listy (właściciel 2026-09-11): najwięcej ocen pozytywnych pierwsza.
    plus: walidujStatystykiOcen(meta.oceny)?.plus ?? 0,
    data: meta.data,
  })));
  renderujZestawy();
  // Komunikat mówi, CO zrobić (ADR 0011 pkt 8): puste repo i repo z paczkami,
  // które nie pasują do setupu, to dwie różne sytuacje — i tylko drugą da się
  // naprawić zmianą ustawień.
  if (dopasowane.length) {
    $('zestawy-status').textContent = 'Repozytorium ma paczki dla tej okolicy — wybór należy do Ciebie.';
    return null;
  }
  // Paczki z innych okolic w ogóle nie wchodzą do komunikatu (właściciel,
  // 2026-09-07): liczy się tylko to, co powstało ±200 m stąd, a komunikat mówi
  // WPROST, które kryterium nie pasuje — nie wymienia całego setupu.
  const bliskie = indeks.filter((m) => czyWOkolicy(m, kryteria));
  $('zestawy-status').textContent = bliskie.length
    ? `W tej okolicy ${opisLiczbyPaczek(bliskie.length)}, ale ${bliskie.length === 1 ? 'nie pasuje' : 'nie pasują'}: `
      + bliskie.map((m) => `${m.miejsce ?? 'paczka bez nazwy'} — ${powodyNiedopasowania(m, kryteria).join('; ')}`).join(' | ')
      + '. Zmień te ustawienia albo przygotuj nowe pytania modelem.'
    : (indeks.length
      ? 'Repozytorium nie ma paczek dla tej okolicy — nowe pytania przygotuje model.'
      : 'Repozytorium jest puste — nowe pytania przygotuje model.');
  return null;
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
  if (STAN.multiPoPaczce) {
    // Wspólny setup (właściciel, 2026-09-11): w multi po wybraniu paczki z
    // ekranu pozycji też otwiera się lobby, nie gra hot-seat.
    STAN.multiPoPaczce = false;
    STAN.ukryjStacje = false;
    STAN.kontenerPaczki = kontener;
    void zalozGreMulti();
    return true;
  }
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
  // ADR 0028 aneks (właściciel 2026-09-09): paczka z pamięci telefonu też jest
  // na Drive — jeśli znamy jej identyfikator, kciuki działają jak przy paczce
  // wziętej z repozytorium. Nie znamy = panel zostaje schowany (jak dotąd).
  STAN.paczkaRepoId = idPaczkiDlaZestawu(zestaw.kontener?.skrot);
  if (STAN.paczkaRepoId && !STAN.tokenGry) STAN.tokenGry = nowyTokenGry();
  przyjmijZestawDoGry({ stacje: zestaw.stacje, kontener: zestaw.kontener, zrodlo: 'z tego telefonu' });
}

async function grajZZestawemZRepo(wpis, urlIndeksu) {
  // M9b/D4: adres liczy czysta funkcja urlPaczkiZRepo — wpis z `id` (most
  // Drive) jedzie przez `?akcja=paczka&id=…`, wpis z `plik` jak dotąd.
  const url = urlPaczkiZRepo(urlIndeksu, wpis);
  status(`Pobieram paczkę z repozytorium: ${wpis.miejsce}…`);
  let tekst;
  try {
    // Ten sam limit (15 s) i ten sam słownik błędów co indeks. Bez powtórki:
    // tuż przed tym żądaniem poszedł indeks, więc instancja mostu jest już
    // rozgrzana, a ponowić można jednym kliknięciem (powód zobaczysz w statusie).
    tekst = await pobierzGetTekst(url);
  } catch (e) {
    status(`Nie udało się pobrać paczki z repozytorium (${e?.powod ?? 'brak odpowiedzi'}) — sprawdź połączenie albo graj zwykłą ścieżką.`);
    return;
  }
  const { zestaw, usterki } = walidujZestawPublicznySurowy(tekst);
  if (!zestaw) {
    status(`Paczka z repozytorium jest niekompletna (${usterki[0]?.komunikat ?? 'błąd'}) — gramy zwykłą ścieżką.`);
    return;
  }
  // ADR 0028: oceny graczy dotyczą paczek z repozytorium — zapamiętujemy id
  // pliku Drive i token tej gry, a licznik „użyta w X grach" dostaje ping.
  STAN.paczkaRepoId = typeof wpis.id === 'string' ? wpis.id : '';
  if (!STAN.tokenGry) STAN.tokenGry = nowyTokenGry();
  // Druga gra tą samą paczką idzie już z pamięci telefonu — bez tego wpisu
  // straciłaby prawo do oceny (ADR 0028 aneks 2026-09-09).
  zapamietajIdPaczkiDlaZestawu(zestaw.kontener?.skrot, STAN.paczkaRepoId);
  wyslijUzycieWTle(STAN.paczkaRepoId);
  przyjmijZestawDoGry({ stacje: zestaw.stacje, kontener: zestaw.kontener, zrodlo: `repozytorium: ${zestaw.meta.miejsce}` });
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
  const wynik = startOdcinka(STAN.rozgrywka, { czasMs: zegarGry() });
  STAN.rozgrywka = wynik.stan;
  pokazBledy('bledy-gra', wynik.usterki);
  if (wynik.usterki.length === 0) {
    STAN.historiaFixow = []; // nowy odcinek liczy dojście od zera (plan M6, ryzyko 4)
    status('Odcinek rozpoczęty — idźcie. Pytanie otworzy się po dwóch kolejnych pomiarach nie dalej niż 50 m od stacji.' + ADR(' (ADR 0004 pkt 2)'));
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
  // Pauza w trakcie pokazu oceny odpowiedzi: panel pytania ZOSTAJE (patrz
  // renderujGre), więc komunikat z panelu B jest niewidoczny — o pauzie
  // mówimy w komunikacie ekranu gry i wskazujemy wyjście jednym przyciskiem.
  if (!$('gra-panel-pytanie').hidden && !$('gra-wynik-odpowiedzi').hidden) {
    $('gra-komunikat').textContent = STAN.graPauza
      ? '⏸ Pauza: zegar gry stoi. „Następna stacja" wznowi grę i wyjdzie w drogę.'
      : 'Gra wznowiona — zegar ruszył.';
  }
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
  // Pierwsza nieobsłużona para (pytanie, jego autor). Autorem jest KONKRETNY
  // gracz z rotacji (zgłoszenie właściciela 2026-09-12: przy dwóch pytaniach na
  // stacji drugie pytanie dostaje następny gracz, nie ten z kolejki) — dlatego
  // nie ma tu pętli po wszystkich „dozwolonych”.
  let para = null;
  for (const pid of idPytan) {
    const gid = graczPytania(r, r.biezacaStacja, pid);
    if (gid == null) continue;
    const juz = r.odpowiedzi.some((o) => o.stacja === r.biezacaStacja && o.pytanieId === pid && o.gracz === gid);
    if (!juz) { para = { pytanieId: pid, graczId: gid }; break; }
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
  lista.hidden = false; // poprzednie pytanie schowało przyciski — nowe pokazuje
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
  // Właściciel 2026-09-11 (uwagi terenowe #2): po odpowiedzi przyciski znikają
  // zamiast się podświetlać — ocena i wyjaśnienie mówią wszystko. Jedna
  // odpowiedź na pytanie zostaje wymuszona brakiem przycisków do kliknięcia.
  $('gra-odpowiedzi').hidden = true;
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
  $('przycisk-nastepna-stacja').textContent = etykietaPrzyciskuDalej(wynik.stan);
  // Paczka bez źródeł (rev3) nie ma „źródeł poniżej" — status nie może ich obiecywać.
  const maZrodla = Array.isArray(pytanie.zrodla) && pytanie.zrodla.length > 0;
  status(dobrze
    ? 'Poprawna odpowiedź zapisana.'
    : maZrodla ? 'Odpowiedź zapisana — wyjaśnienie i źródła poniżej.' : 'Odpowiedź zapisana — wyjaśnienie poniżej.');
  renderujGre({ panele: false }); // badge'e tak; panele dopiero po „Następna stacja"
  zapiszGre();
}

/**
 * Zgłoszenie właściciela 2026-09-09: między odpowiedzią a wyjściem w drogę były
 * DWA kliknięcia — „Następna stacja →", a po nim jeszcze „▶ Idę do stacji X" na
 * panelu oczekiwania. Na telefonie w marszu to jeden klik za dużo, więc przycisk
 * pod wyjaśnieniem od razu startuje odcinek i mówi, kto i dokąd idzie.
 *
 * Automatu NIE MA tam, gdzie odebrałby graczowi decyzję albo złamał regułę:
 * w pauzie, w wyścigu (ADR 0027 część B: gracz sam wybiera stację) i w turach,
 * gdy droga należy do kogoś innego. Wtedy zostaje stary panel A ze startem.
 */
function czyStartPoDalej() {
  if (STAN.graPauza) return false;
  const m = STAN.multi;
  if (!m) return true;
  const gra = m.gra;
  if (!gra || gra.stan !== 'trwa') return true;
  if (gra.tryb === TRYBY_GRY.wyscig) return false; // wolna kolejność — wybór należy do gracza
  return true; // Wspólna Trasa: stacje po kolei — kolejny odcinek rusza od razu
}

/** Napis na przycisku pod wyjaśnieniem — zależny od fazy PO zapisaniu odpowiedzi. */
function etykietaPrzyciskuDalej(stan) {
  if (stan.faza === FAZY.koniec) return '🏁 Zobacz wynik →';
  if (stan.faza === FAZY.pytanie) return 'Następne pytanie →';
  // Pauza w trakcie czytania oceny (najczęściej automatyczna po zwinięciu
  // karty): przycisk pauzy mieszka w panelu B i jest wtedy niewidoczny,
  // więc to „Następna stacja" wznawia zegar i prowadzi dalej — etykieta
  // mówi o tym wprost (zgłoszenie właściciela 2026-09-11, preview).
  if (STAN.graPauza && !STAN.multi) return '⏸ Wznów grę i idź dalej →';
  if (!czyStartPoDalej()) return 'Następna stacja →';
  const pod = podglad(stan);
  const indeks = stan.stacje.findIndex((s) => s.id === stan.biezacaStacja);
  const kto = pod.gracz ? `${pod.gracz.imie}, ` : '';
  return `▶ ${kto}stacja ${indeks + 1} — idę →`;
}

/**
 * „Następna stacja/pytanie": domyka pokaz wyjaśnienia, przełącza fazę i — jeśli
 * wolno (patrz `czyStartPoDalej`) — od razu otwiera odcinek, bez drugiego klika.
 */
function nastepnaStacja() {
  const r = STAN.rozgrywka;
  if (!r) return;
  // Domknięcie pokazu oceny — od tej chwili renderujGre może przełączać
  // panele (patrz warunek „pokazOceny" w renderujGre).
  $('gra-wynik-odpowiedzi').hidden = true;
  // Pauza nie da się w tym widoku wznowić przyciskiem pauzy (mieszka w
  // panelu B, schowanym). Klik w „Następna stacja" to JAWNA decyzja gracza
  // — wznawia zegar (M6: wznowienie jawne, tutaj właśnie przyciskiem)
  // i prowadzi dalej, zamiast zostawiać panel A z zablokowanym startem.
  if (STAN.graPauza) przelaczPauzeGry();
  renderujGre();
  if (r.faza === FAZY.pytanie) {
    renderujPytanie();
    return;
  }
  if (r.faza === FAZY.przygotowanie && czyStartPoDalej()) startOdcinkaGry();
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
  // Właściciel, uwagi terenowe #3 pkt 4e (2026-09-11): „Poprzednie gry” to
  // funkcja hot-seat — w trybie multiplayer karty nie pokazujemy wcale.
  if (STAN.rodzajGry === 'multi') {
    karta.hidden = true;
    return;
  }
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
  // Zakończona gra nie jest „niedokończona" — baner mówi prawdę: to tylko
  // ponowne obejrzenie wyniku (wznowienie jej nie wysyła wyniku drugi raz).
  $('wznowienie-opis').textContent = r.faza === FAZY.koniec
    ? `Znaleziono zapis ZAKOŃCZONEJ gry „${r.kodGry || aktywna}" — możesz jeszcze raz obejrzeć wynik.`
    : `Znaleziono niedokończoną grę „${r.kodGry || aktywna}" — faza: ${r.faza}, stacja ${indeks} z ${r.stacje.length}, zapisano ${new Date(stan.zapisanoMs).toLocaleString('pl-PL')}.`;
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
  const r = snapshot.rozgrywka;
  // Gra ZAKOŃCZONA jest wznawiana tylko po to, by jeszcze raz obejrzeć wynik:
  // zegar nie chodzi, więc rebaza byłaby szkodliwa — psuje odcisk gry
  // (kluczGryHotseat liczy się z startMs), a przez to każde odświeżenie
  // i wznowienie zakończonej gry wysyłało wynik DRUGI raz i most zakładał
  // kolejny plik gra-hotseat-*.json (zgłoszenie właściciela 2026-09-11:
  // dziesiątki plików w okolica-gry-zakonczone).
  const przesuniecie = r.faza === FAZY.koniec ? 0 : performance.now() - snapshot.zegarMs;
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
  // Właściciel 2026-09-11 (uwagi terenowe #2): „Wznów grę" nie może pokazywać
  // międzystrony „Idzie: … ▶ Idę do stacji …" — w fazie przygotowania od razu
  // droga i pasek na dole ekranu (faza przygotowania czeka tylko na wznawiającego).
  if (r.faza === FAZY.przygotowanie && czyStartPoDalej()) startOdcinkaGry();
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

/* ------------------------------------------------- podsumowanie gry (M7) */

/**
 * Podsumowanie po grze: karta zwycięzcy i tabela rankingu. Nic więcej —
 * reszta ekranu to jeden przycisk „Wróć na początek” (ADR 0038).
 *
 * Decyzja właściciela 2026-09-12: statystyki gry, szczegóły graczy, tabela
 * stacji, eksporty i linia fact-checku zniknęły razem z kodem, który je
 * wypełniał („masa błędów i niepotrzebnych informacji”).
 */
function pokazWyniki() {
  const r = STAN.rozgrywka;
  if (!r) return;
  const wynik = podsumowanie(r);

  // 1. karta zwycięzcy
  const kartaZw = $('gra-wynik-zwyciezca');
  kartaZw.replaceChildren();
  const zwyciezca = wynik.gracze.find((g) => g.id === wynik.zwyciezca) ?? null;
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

  // 2. tabela rankingu — te same kolumny co w panelu multi
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
  stanWysylkiWyniku(''); // los wysyłki z poprzedniej gry nie zostaje na ekranie
}

/* ---------------------------------------------------------------- prompt */

function budujPromptEkran() {
  // ADR 0032: checkbox wybiera wariant — domyślnie (pusty) pytania bez
  // weryfikacji (model sam decyduje, czy sprawdzi w sieci); zaznaczony to
  // twarda, wymuszona kwerenda dla każdego faktu.
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
    ? `${wynik.prompt.length} znaków · ${liczbaPytan(STAN.konfig)} pytań · ${STAN.konfig.liczbaStacji} stacji · protokół ${factcheck ? WERSJA_PROTOKOLU_REV4 : WERSJA_PROTOKOLU_REV5}`
    : 'prompt nie został zbudowany';
  $('prompt-podglad-naglowek').textContent = `Pokaż treść promptu (${factcheck ? 'z fact check' : 'bez fact-check'})`;
  // Teksty zlecenia właściciela (2026-09-09) — słowo w słowo:
  $('prompt-tryb-opis').textContent = factcheck
    ? 'Tryb: pytania z fact check — model sprawdza każdy fakt w sieci ale generowanie pytań trwa dłużej.'
    : 'Tryb: pytania bez fact-check — model AI korzysta z własnej wiedzy, generowanie pytań trwa krócej.';
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

/**
 * Walidacja i przyjęcie paczki. `tekstZewnetrzny` podaje treść z pominięciem
 * DOM (droga ze schowka); bez argumentu bierze zawartość pola awaryjnego.
 */
function sprawdzOdpowiedz(tekstZewnetrzny = null) {
  const tekst = typeof tekstZewnetrzny === 'string' ? tekstZewnetrzny : $('pole-odpowiedz').value;
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
    $('wklejka-status').textContent = 'Nie udało się odczytać tej treści — szczegóły niżej.';
    status('Odpowiedź odrzucona na etapie odczytu (parsowanie JSON albo kontener).');
    return;
  }

  // Q2 (PROTOKOL §3.4): wariant odwrócony odkodowujemy PRZED walidacją —
  // dalej płynie postać czytelna z markerem PYT/1.0.
  // B2 (2026-09-09): bieżące warianty rev4/rev5 NIE odwracają tekstu — kodowany
  // jest tylko numer poprawnej odpowiedzi. Odwracanie czytamy dalej, bo paczki
  // rev1/rev2/rev3 leżą na Drive i muszą dać się otworzyć.
  const bylaOdwrocona = czyPaczkaOdwrocona(paczka);
  const wariant = String(paczka.protokol ?? '').replace('PYT/1.0-', '') || 'rev1';
  const robocza = WARIANTY_Z_KODEM.includes(paczka.protokol)
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
    $('wklejka-status').textContent = `Paczka ma ${usterki.length} usterek — szczegóły i poprawka niżej.`;
    status('Paczka odrzucona przez walidator (protokół PYT §6).');
    return;
  }

  wynik.dataset.stan = 'ok';
  STAN.paczka = normalizujTematyPaczki(robocza);
  const weryfikacja = czyWariantFactcheck(robocza) ? 'fact check' : 'bez fact-check';
  $('wynik-naglowek').textContent = bylaOdwrocona
    ? `Paczka przyjęta (odwrócona, ${wariant} — odkodowana; ${weryfikacja})`
    : `Paczka przyjęta (${wariant === 'rev1' ? '' : `${wariant}, `}${weryfikacja})`;
  $('przycisk-poprawka').hidden = true;
  renderujUsterki([]);
  // Pole wklejenia jest czyszczone natychmiast: plaintext nie zostaje w DOM
  // (ADR 0007 pkt 4). Paczka żyje w pamięci modułu.
  $('pole-odpowiedz').value = '';
  $('wklejka-status').textContent = '';
  wyslijZestawNaDrive();
  // Multi (właściciel, 2026-09-11): po wklejeniu odpowiedzi modelu otwiera
  // się LOBBY — gra zakłada się z paczki tej sesji, bez pośredniego panelu.
  if (STAN.multiPoPaczce) {
    STAN.multiPoPaczce = false;
    STAN.ukryjStacje = false;
    void zalozGreMulti();
    return;
  }
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
      // ADR 0028 aneks (właściciel 2026-09-09): KAŻDA paczka jest na Drive, więc
      // każdą wolno ocenić. Most oddaje `id` pliku także przy duplikacie —
      // zapamiętujemy je, inaczej łapki nie miałyby czego oceniać.
      if (wynik?.ok && typeof wynik.id === 'string' && wynik.id) {
        STAN.paczkaRepoId = wynik.id;
        if (!STAN.tokenGry) STAN.tokenGry = nowyTokenGry();
        zapamietajIdPaczkiDlaZestawu(STAN.kontenerPaczki?.skrot, wynik.id);
        odswiezPanelOcenPoIdPaczki();
      }
      // Decyzja właściciela 2026-09-11: koniec sesji przeglądu — paczka jest
      // na Drive od razu, dostępna w zestawach; jakość rozstrzygają łapki.
      if (wynik?.ok && wynik.status === 'zaakceptowana') {
        status('Paczka przyjęta i WYSŁANA na Drive: dostępna od razu w zestawach — jakość rozstrzygną łapki graczy.' + ADR(' (ADR 0017 aneks 2026-09-11)'));
      } else if (wynik?.ok && wynik.status === 'juz-w-odrzuconych') {
        status('Paczka przyjęta; identyczny zestaw został wcześniej odrzucony ręcznie na Drive — nowy plik nie powstał, gra toczy się dalej.');
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
    ? 'GPS w trybie oszczędnym — do stacji daleko, bateria odpoczywa; częstsze pomiary wrócą przy stacji.'
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
    // m12-75: koperta z markerem kanonu — przy ZMIANIE tematów domyślnych
    // stare zapisy dostaną jednorazowe dopełnienie zamiast cichej wczorajszej listy.
    localStorage.setItem(KLUCZ_KONFIG, JSON.stringify({ schemat: 'konfig/1', kanon: KANON_SETUPU, konfig: STAN.konfig }));
  } catch (e) {
    void e; // prywatny tryb przeglądarki — gramy dalej w pamięci (ADR 0010)
  }
}

function wczytajKonfiguracje() {
  try {
    const surowe = localStorage.getItem(KLUCZ_KONFIG);
    if (!surowe) return;
    const { schemat, konfig, kanon } = JSON.parse(surowe);
    if (schemat !== 'konfig/1' || !konfig) return; // migracje: ADR 0010 pkt 6
    // sanitizacja: stary schemat albo ręczna edycja nie może wysypać UI
    STAN.konfig = oczyscKonfiguracje(konfig);
    // m12-75 / m12-84: marker kanonu jest PORÓWNYWANY, nie tylko obecny (audyt PR
    // #13, obserwacja 3). Dopełnienia idą per-wersja: zapis z markerem starszym
    // od KANON_SETUPU dostaje dokładnie te tematy, które doszły do domyślnych PO
    // jego wersji — a zapis bieżący (albo z nowszej wersji aplikacji) nie jest
    // ruszany, bo organizator mógł temat odptaszkować ZAMIERZENIE.
    STAN.konfig = dopelnijKonfiguracjeDoKanou(STAN.konfig, kanon);
    if (kanonSprzedBiezacego(kanon)) zapiszKonfiguracje();
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

/** Adres mostu gier (ADR 0020): wpisany w kod aplikacji — ten sam web app co repozytorium paczek. */
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

/**
 * Błąd mostu po polsku + KRÓTKI powód dla UI (`blad.powod`).
 *
 * Pełny komunikat idzie do `status()`, a krótki powód w nawiasie do miejsc,
 * gdzie zdanie musi zostać zdaniem („Repozytorium niedostępne (HTTP 403)…”).
 * Rozróżnienie przyczyn jest tu istotą sprawy: zgłoszenie właściciela
 * 2026-09-12 pokazało, że jeden zbiorczy komunikat „niedostępne” potrafi
 * ukryć i brak sieci, i zablokowane wdrożenie, i własną literówkę w schemacie.
 */
function bladMostuPoPolsku(e, { przekroczonyCzas, url, limitMs = LIMIT_MOSTU_MS }) {
  const sekundy = Math.max(1, Math.round(limitMs / 1000));
  if (przekroczonyCzas) {
    return bladZPowodem(
      `most Drive nie odpowiedział w ${sekundy} s — pierwsze żądanie po wdrożeniu bywa wolne, spróbuj za chwilę`,
      `brak odpowiedzi w ${sekundy} s`,
    );
  }
  const tekst = String(e?.message ?? e ?? '');
  if (e?.name === 'AbortError' || /abort/i.test(tekst)) {
    return bladZPowodem('połączenie z mostem Drive zostało przerwane — spróbuj jeszcze raz', 'przerwane połączenie');
  }
  if (/failed to fetch|networkerror|load failed/i.test(tekst)) {
    return bladZPowodem(
      'brak połączenia z mostem Drive — telefon jest offline albo adres repozytorium nie odpowiada',
      'brak połączenia',
    );
  }
  const http = /^HTTP (\d{3})$/.exec(tekst);
  if (http) {
    const kod = Number(http[1]);
    const podpowiedz = kod === 401 || kod === 403
      ? ' — sprawdź, czy wdrożenie web app ma dostęp „Każdy”'
      : '';
    return bladZPowodem(`most Drive odpowiedział HTTP ${kod}${podpowiedz}`, `HTTP ${kod}`);
  }
  return bladZPowodem(`${tekst}${url ? ` (${url})` : ''}`, tekst.slice(0, 80) || 'nieznany błąd');
}

/** Błąd z krótkim powodem dla UI (`powod`), czytanym przez `pobierzIndeksZRepo`. */
function bladZPowodem(wiadomosc, powod) {
  const blad = new Error(wiadomosc);
  blad.powod = powod;
  return blad;
}

/**
 * GET mostu, którego odpowiedź jest JSON-em (lobby, stan gry).
 *
 * Nasz własny limit czasu przerywa żądanie przez `AbortController`, a przeglądarka
 * opisuje to PO ANGIELSKU i od swojej strony: Chrome daje „signal is aborted
 * without reason”, Firefox „The user aborted a request.”. Dla gracza to bełkot,
 * więc rozróżniamy nasze przerwanie od prawdziwej awarii sieci i zawsze oddajemy
 * komunikat po polsku (LESSONS L6: komunikat musi nazywać przyczynę, nie wyjątek).
 */
async function pobierzGetMulti(url) {
  const f = fetchPrzegladarki(); // L18: nigdy gołe fetch
  if (!f) throw new Error('to środowisko nie ma fetch — nie da się zapytać mostu');
  const kontroler = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let przekroczonyCzas = false;
  const timer = setTimeout(() => { przekroczonyCzas = true; kontroler?.abort(); }, LIMIT_MOSTU_MS);
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

/**
 * GET, którego odpowiedź jest tekstem (indeks/paczka z repozytorium — M9b).
 * Ten sam limit i ten sam słownik błędów co `pobierzGetMulti`: panel paczek ma
 * umieć powiedzieć, CO się nie udało (LESSONS L6).
 */
async function pobierzGetTekst(url) {
  const f = fetchPrzegladarki(); // L18: nigdy gołe fetch
  if (!f) throw bladZPowodem('to środowisko nie ma fetch — nie da się zapytać mostu', 'brak fetch w tej przeglądarce');
  const kontroler = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let przekroczonyCzas = false;
  const timer = setTimeout(() => { przekroczonyCzas = true; kontroler?.abort(); }, LIMIT_MOSTU_MS);
  try {
    const odp = await f(url, kontroler ? { signal: kontroler.signal } : undefined);
    if (!odp.ok) throw new Error(`HTTP ${odp.status}`);
    return await odp.text();
  } catch (e) {
    throw bladMostuPoPolsku(e, { przekroczonyCzas, url });
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
  if (!urlMostuMulti()) usterki.push('Brak adresu mostu w tej wersji aplikacji (ADR 0020) — gra na wielu urządzeniach jest wyłączona. Wybierz rodzaj gry „Hot-seat”, żeby grać na jednym telefonie.');
  // Tożsamość multi = imię+PIN z bloku „Kto gra?” jak w hot-seat (właściciel,
  // 2026-09-11, profil na wspólnym Drive) — dokładnie JEDEN gracz na telefon.
  const imiona = (STAN.konfig.imiona ?? []).filter(Boolean);
  if (!imiona.length) usterki.push('Wpisz swoje imię i PIN w bloku „Kto gra?” — to Twoja tożsamość w grze.');
  else if (imiona.length > 1) usterki.push('W grze na wielu urządzeniach gra z tego telefonu tylko jedna osoba — usuń pozostałych graczy z listy (✕ Usuń).');
  return usterki;
}

/** Imię potwierdzonego gracza — tożsamość multi zamiast dawnego pola pseudonimu. */
function pseudonimGraczaMulti() {
  return normalizujPseudonim(STAN.konfig.imiona?.[0] ?? '').trim().slice(0, 24);
}

function wczytajUstawieniaMulti() {
  pokazStanMostu(); // adres mostu jest w kodzie (ADR 0020) — UI pokazuje stan, nie pole do wpisywania
  if (typeof localStorage !== 'undefined' && localStorage.getItem(KLUCZ_RODZAJU_GRY) === 'multi') {
    STAN.rodzajGry = 'multi';
  }
}

/** Segment „Rodzaj gry” na setupie (właściciel, 2026-09-11): toggle obok
 *  siebie jak środek transportu — hot-seat albo gra na wielu urządzeniach. */
const RODZAJE_GRY = {
  hotseat: { etykieta: '👥 Hot-seat — jeden telefon' },
  multi: { etykieta: '📱 Multiplayer — każdy ma telefon' },
};

const OPISY_RODZAJOW = {
  hotseat: 'Jeden telefon podawany dalej — wszyscy gracze są na liście poniżej.',
  multi: 'Każdy gracz ma swój telefon. Możesz być hostem albo dołączyć do istniejącej gry.',
};

function renderujRodzajeGry() {
  renderujSegment('lista-rodzajow', RODZAJE_GRY, STAN.rodzajGry, (wybrany) => {
    STAN.rodzajGry = wybrany === 'multi' ? 'multi' : 'hotseat';
    if (typeof localStorage !== 'undefined') localStorage.setItem(KLUCZ_RODZAJU_GRY, STAN.rodzajGry);
    renderujRodzajGry();
    $('rodzaj-opis').textContent = OPISY_RODZAJOW[STAN.rodzajGry];
    status(STAN.rodzajGry === 'multi'
      ? 'Gra na wielu urządzeniach: potwierdź swoje imię i PIN, wybierz ścieżkę — zakładasz albo dołączasz.'
      : 'Hot-seat: jeden telefon podawany dalej (ADR 0009).');
  });
  $('rodzaj-opis').textContent = OPISY_RODZAJOW[STAN.rodzajGry];
}

/** Segment „Co robisz?” na karcie multi (m12-74): załóż nową / dołącz. */
const SCIEZKI_MULTI = {
  zaloz: { etykieta: '🚀 Zakładam nową grę' },
  dolacz: { etykieta: '🚪 Dołączam do istniejącej' },
};

const OPISY_SCIEZEK = {
  zaloz: 'Jesteś hostem nowej rozgrywki. Zaloguj się, wybierz odpowiednie opcje i przejdź dalej.',
  dolacz: 'Zobaczysz gry, których host jest w zasięgu ~50 m — dołączasz jednym kliknięciem, bez kodu. Możesz opuścić grę w dowolnym momencie.',
};

/**
 * „Ty w tej grze" jedzie POD OPIS ŚCIEŻKI, gdy gramy w multi (właściciel,
 * 2026-09-12) — login jest pierwszym krokiem obu ścieżek, więc nie może
 * siedzieć pod opcjami hosta. Poza multi pole wraca na swoje miejsce w setupie.
 * Przenosimy WĘZEŁ, nie kopię: `id` zostaje ten sam, więc nasłuchy, testy
 * i `renderujPolaTozsamosci` nie wiedzą o przeprowadzce.
 */
function umiescTozsamosc(multi) {
  const pole = $('pole-tozsamosc');
  const slot = $(multi ? 'multi-slot-tozsamosc' : 'slot-tozsamosc-dom');
  if (!pole || !slot || pole.parentNode === slot) return;
  slot.appendChild(pole);
}

/**
 * Lista gier ~50 m: OSOBNY BOKS i DOPIERO po zalogowaniu (właściciel,
 * 2026-09-12). Bez potwierdzonego imienia most i tak odmawia zapytania
 * (`odswiezListeGierNaSetupie`), więc pusty boks tylko zajmował miejsce.
 */
function renderujPanelDolacz() {
  const dolacz = STAN.rodzajGry === 'multi' && STAN.multiSciezka === 'dolacz';
  $('multi-panel-dolacz').hidden = !(dolacz && Boolean(pseudonimGraczaMulti()));
}

function renderujMultiSciezka() {
  renderujSegment('multi-sciezka', SCIEZKI_MULTI, STAN.multiSciezka, (wybrany) => {
    STAN.multiSciezka = wybrany === 'dolacz' ? 'dolacz' : 'zaloz';
    renderujRodzajGry();
    $('multi-sciezka-opis').textContent = OPISY_SCIEZEK[STAN.multiSciezka];
    // „Dołączam do istniejącej” (właściciel, uwagi terenowe #3 2026-09-11):
    // lista gier w okolicy pokazuje się OD RAZU na setupie — GPS startuje
    // sam (jeśli trzeba), status mówi, co się dzieje.
    if (STAN.multiSciezka === 'dolacz') void odswiezListeGierNaSetupie();
  });
  $('multi-sciezka-opis').textContent = OPISY_SCIEZEK[STAN.multiSciezka];
}

/**
 * Lista gier w zasięgu ~50 m na setupie (m12-75): dołączający widzi ją pod
 * blokiem „Kto gra?”, bez przechodzenia na osobny ekran. GPS włącza się sam —
 * bez pozycji lista nie ma czym filtrować (~50 m, geohash8 hosta). Wołana z
 * kilku miejsc (klik segmentu, odśwież, zmiana graczy) — dlatego NA WEJŚCIU
 * odmawia, gdy kontekst nie pasuje (hot-seat ani gość bez znanego imienia nie
 * robią żadnego zapytania do mostu).
 */
async function odswiezListeGierNaSetupie() {
  if (STAN.rodzajGry !== 'multi' || STAN.multiSciezka !== 'dolacz') return;
  const panel = $('multi-panel-dolacz');
  if (panel.hidden) return;
  if (!STAN.pozycja && !STAN.trybTestowy && !STAN.watcher?.czyAktywny()) {
    status('Włączam GPS — lista pokazuje gry w zasięgu ~50 m od Ciebie.');
    wlaczGps();
  }
  // Bez potwierdzonego imienia nie pytamy mostu (zero wysyłek). Komunikatu
  // „zaloguj się" tu nie ma: od 2026-09-12 cały boks jest schowany do czasu
  // zalogowania, więc nie ma go gdzie pokazać (właściciel).
  if (!pseudonimGraczaMulti()) return;
  await odswiezLobby();
}

/**
 * Przełączanie widoczności pól setupu wg rodzaju gry i ścieżki multi
 * (przepisany flow, właściciel 2026-09-11): w multi znika „pytań na stację”
 * (liczba stacji = liczba pytań), a tryb gry i trasa-sekret wybiera
 * zakładający. Dołączający nie ustawia nic poza sobą.
 */
function renderujRodzajGry() {
  const multi = STAN.rodzajGry === 'multi';
  const zaloz = multi && STAN.multiSciezka === 'zaloz';
  const dolacz = multi && STAN.multiSciezka === 'dolacz';
  $('karta-multi').hidden = !multi;
  $('pole-pytania').hidden = multi; // liczba stacji = liczba pytań
  $('pole-multi-tryb').hidden = !zaloz;
  renderujSekretTrasy();
  // Dołączanie (właściciel, uwagi terenowe #3 pkt 4d 2026-09-11): po wybraniu
  // „Dołączam do istniejącej” z setupu zostaje tylko „Ty w tej grze” i lista
  // gier w odległości ≤50 m — wszystkie opcje hosta znikają.
  umiescTozsamosc(multi); // 2026-09-12: login zaraz pod opisem ścieżki
  renderujPanelDolacz();  // 2026-09-12: boks listy dopiero po zalogowaniu
  for (const id of ['pole-tryb', 'pole-parametry', 'pole-wiek', 'pole-tematy']) {
    const el = $(id);
    if (el) el.hidden = dolacz;
  }
  const promienInfo = $('setup-promien-info');
  if (promienInfo) promienInfo.hidden = dolacz;
  $('przycisk-dalej-pozycja').hidden = dolacz; // dalej wiodą przyciski „Dołącz” z listy
  $('legend-tozsamosc').textContent = multi ? '👤 Ty w tej grze' : '👤 Kto gra?';
  $('przycisk-dodaj-gracza').textContent = multi ? '✔ Potwierdź — to ja' : '➕ Dodaj gracza';
  renderujHistorieGier(); // pkt 4e: „Poprzednie gry” tylko dla hot-seat
  renderujPolaTozsamosci(); // pkt 4i: w multi po wpisaniu siebie pola znikają
}

/**
 * Uwagi terenowe #3 (właściciel 2026-09-11, pkt 4i): w multiplayerze ten
 * telefon obsługuje DOKŁADNIE jedną osobę — po dodaniu „Ty w tej grze” pola
 * wpisywania (imię/PIN, przycisk i skróty zapamiętanych) chowają się, żeby
 * nikt nie dodał drugiego gracza; wracają, gdy lista znów jest pusta.
 */
function renderujPolaTozsamosci() {
  const ukryj = STAN.rodzajGry === 'multi' && (STAN.konfig.imiona ?? []).length >= 1;
  const siatka = $('pole-tozsamosc-siatka');
  if (siatka) siatka.hidden = ukryj;
  $('przycisk-dodaj-gracza').hidden = ukryj;
  const zapamietani = $('lista-zapamietanych');
  if (zapamietani) zapamietani.hidden = ukryj;
  renderujPanelDolacz(); // zalogowany dołączający dostaje boks z listą gier
}

/** Ptaszek „widoczna tylko kolejna stacja” — tylko trasa + ścieżka zakładania. */
function renderujSekretTrasy() {
  $('pole-trasa-sekret').hidden = !(STAN.rodzajGry === 'multi' && STAN.multiSciezka === 'zaloz' && STAN.multiTryb === TRYBY_GRY.trasa);
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
  // m12-75: ekran multi to już TYLKO lobby — lista „Dołącz” żyje na setupie
  // (właściciel, uwagi terenowe #3 2026-09-11). Zakładanie również na setupie.
  if (panel !== 'lobby') return;
  // Wejście do lobby rozbraja potwierdzenie wyjścia: uzbrojenie z poprzedniego
  // wejścia nie może zostać w przycisku (audyt PR #13 pkt 2).
  STAN.multiOpuszczenieUzbrojone = false;
  $('przycisk-lobby-opusc').textContent = 'Opuść lobby';
  $('multi-panel-lobby').hidden = false;
  pokazBledy('bledy-multi', []);
  pokazEkran('multi');
}

/**
 * Tryby gry wieloosobowej (właściciel, 2026-09-11): Wspólna Trasa i Wyścig
 * na Orientację. Punktacja jest WSPÓLNA (zdanie pod listą, w index.html —
 * bez dublowania), różni się tylko kolejność stacji.
 */
function renderujTrybyMulti() {
  const lista = $('multi-tryby');
  lista.replaceChildren();
  const etykiety = {
    trasa: '🗺️ Wspólna Trasa — ta sama trasa, po kolei',
    wyscig: '🏁 Wyścig na Orientację — dowolna kolejność stacji',
  };
  const opisy = {
    [TRYBY_GRY.trasa]: 'Wszyscy pokonują tą samą trasę, każdy na swoim telefonie i we własnym tempie. Stacje przechodzi się po kolei.',
    [TRYBY_GRY.wyscig]: 'Każdy wybiera własną trasę, a kolejność stacji jest dowolna.',
  };
  for (const klucz of [TRYBY_GRY.trasa, TRYBY_GRY.wyscig]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'przycisk';
    b.textContent = etykiety[klucz];
    b.setAttribute('aria-pressed', String(STAN.multiTryb === klucz));
    b.addEventListener('click', () => {
      STAN.multiTryb = klucz;
      renderujTrybyMulti();
      renderujSekretTrasy(); // ptaszek tylko przy Wspólnej Trasie
    });
    lista.appendChild(b);
  }
  $('multi-tryb-opis').textContent = opisy[STAN.multiTryb] ?? opisy[TRYBY_GRY.trasa];
  renderujSekretTrasy();
}

/**
 * Pytania paczki bieżącej sesji — do liczenia FAKTYCZNYCH tematów w meta
 * (właściciel, 2026-09-11). W pamięci albo przez odpakowanie kontenera
 * (wzorzec `factcheckBiezacejSesji`).
 */
function pytaniaBiezacejSesji() {
  if (STAN.paczka) return Array.isArray(STAN.paczka.pytania) ? STAN.paczka.pytania : [];
  if (STAN.kontenerPaczki) {
    const { paczka } = odpakujPaczke(STAN.kontenerPaczki);
    return Array.isArray(paczka?.pytania) ? paczka.pytania : [];
  }
  return [];
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
    pytania: pytaniaBiezacejSesji(),
  });
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
    pseudonim: pseudonimGraczaMulti(), // imię+PIN z setupu (właściciel, 2026-09-11)
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
  // m12-74 (właściciel, 2026-09-11): grę zakłada się PO wklejeniu odpowiedzi
  // modelu (albo po wybraniu pasującej paczki na ekranie pozycji) — paczka
  // bieżącej sesji jest źródłem pytań i stacji, bez listy źródeł i kodów.
  const usterki = walidujGotowoscMulti();
  if (usterki.length) { pokazBledyMulti(usterki); return; }
  const stacje = STAN.stacje.map((st) => ({ id: st.id, lat: st.lat, lon: st.lon, opis: st.opis ?? '' }));
  const kontener = STAN.kontenerPaczki ?? (STAN.paczka ? zapakujPaczke(STAN.paczka, WERSJA_PROTOKOLU) : null);
  const meta = metaSesjiMulti(stacje);
  if (!stacje.length || !kontener || !meta) {
    pokazBledyMulti(['Nie ma z czego założyć gry — najpierw wygeneruj stacje i pytania albo wybierz paczkę na ekranie pozycji.']);
    return;
  }
  const sekret = STAN.multiTryb === TRYBY_GRY.trasa && STAN.multiTrasaSekret;
  status('Zakładam grę na mostku Drive…');
  try {
    const wynik = await polecenieMostu(urlMostuMulti(), {
      akcja: 'gra-zaloz',
      tryb: STAN.multiTryb,
      trasaSekret: sekret, // właściciel 2026-09-11: własność GRY (mapa w grze), nie konfiguracji
      organizator: { pseudonim: pseudonimGraczaMulti() },
      konfiguracja: {
        liczbaStacji: stacje.length,
        pytaniaNaStacje: 1, // liczba stacji = liczba pytań (właściciel, 2026-09-11)
        wiek: meta.wiek,
        tematy: meta.tematy,
        promienM: meta.promienM,
        miejsce: meta.miejsce ?? '',
        geohash5: meta.geohash5,
        geohash8: STAN.pozycja ? geohash(STAN.pozycja.lat, STAN.pozycja.lon, 8) : '', // ~40 m: miara zasięgu 50 m
      },
      zestaw: { stacje, kontener, meta },
    });
    status('Gra założona — gracze w zasięgu ~50 m zobaczą Cię na liście „Dołącz do gry”. Startujesz z lobby, kiedy zechcesz (możesz i solo).');
    wejdzDoGryMulti(wynik.gra, wynik.gra.organizatorId, 'organizator');
  } catch (e) {
    status(`Nie udało się założyć gry: ${e?.message ?? e}`);
    pokazBledyMulti([`Nie udało się założyć gry: ${e?.message ?? e}`]);
  }
}
/** Błędy dołączania lądują tam, gdzie jest gracz: na setupie (lista w karcie
 *  multi) wracają do `bledy-setup`, na ekranie multi do `bledy-multi`. */
function pokazBledyDolacza(usterki) {
  if (!usterki.length) { pokazBledy('bledy-setup', []); pokazBledyMulti([]); return; }
  if (STAN.ekran === 'multi') {
    pokazBledyMulti(usterki);
  } else {
    pokazBledy('bledy-setup', usterki.map((komunikat) => ({ komunikat })));
    status(usterki[0]);
  }
}

async function dolaczDoGryMulti({ idGry = null } = {}) {
  // Właściciel 2026-09-11 (odpowiedź 4A): dołączanie kodem USUNIĘTE —
  // zostaje lista gier w zasięgu ~50 m od hosta, renderowana na setupie.
  const usterki = walidujGotowoscMulti();
  if (usterki.length) { pokazBledyDolacza(usterki); return; }
  if (!idGry) {
    pokazBledyDolacza(['Nie wiem, do której gry dołączyć — wybierz hosta z listy gier w okolicy.']);
    return;
  }
  status('Dołączam do gry z listy…');
  try {
    const wynik = await polecenieMostu(urlMostuMulti(), {
      akcja: 'gra-dolacz',
      idGry,
      pseudonim: pseudonimGraczaMulti(),
    });
    wejdzDoGryMulti(wynik.gra, wynik.graczId, 'gosc');
    status('Jesteś w grze — czekasz w lobby, aż host wystartuje.');
  } catch (e) {
    status(`Nie udało się dołączyć: ${e?.message ?? e}`);
    pokazBledyDolacza([`Nie udało się dołączyć: ${e?.message ?? e}`]);
  }
}

async function odswiezLobby() {
  const url = urlMostuMulti();
  const lista = $('multi-lobby-lista');
  if (!url) {
    $('multi-lobby-status').textContent = 'Brak adresu mostu w tej wersji aplikacji — lista gier w okolicy jest niedostępna.' + ADR(' (ADR 0020)');
    return;
  }
  if (!STAN.pozycja) {
    lista.replaceChildren();
    $('multi-lobby-status').textContent = 'Czekam na Twoją pozycję — lista pokazuje gry w zasięgu ~50 m od hosta.';
    return;
  }
  $('multi-lobby-status').textContent = 'Pobieram listę gier z mostu Drive…';
  try {
    const odpowiedz = await pobierzGetMulti(urlGet(url, 'gry'));
    const { wpisy, usterki } = walidujLobbySurowe(JSON.stringify(odpowiedz ?? null));
    if (usterki.length && !wpisy.length) throw new Error(usterki[0].komunikat);
    // Dołączenie tylko w lobby — po starcie nowi gracze nie wchodzą
    // (właściciel, 2026-09-11, odpowiedź 2).
    const otwarte = wpisy.filter((w) => w.stan === 'lobby');
    // ~50 m od hosta (właściciel, 2026-09-11): komórka geohash8 (~40 m) +
    // sąsiedzi, pozycja hosta z chwili założenia gry.
    const bliskie = filtrujLobby(otwarte, { geohash8: geohash(STAN.pozycja.lat, STAN.pozycja.lon, 8) });
    lista.replaceChildren();
    for (const wpis of bliskie) {
      const li = document.createElement('li');
      const opis = document.createElement('span');
      // Tylko host, bez dodatkowych informacji (właściciel, 2026-09-11).
      opis.textContent = `Host: ${wpis.organizator ?? '?'}`;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'przycisk przycisk-maly';
      b.textContent = 'Dołącz';
      b.addEventListener('click', () => { void dolaczDoGryMulti({ idGry: wpis.idGry }); });
      li.append(opis, b);
      lista.appendChild(li);
    }
    $('multi-lobby-status').textContent = bliskie.length
      ? `Gry w zasięgu ~50 m: ${bliskie.length}.`
      : 'Brak gier w zasięgu ~50 m — załóż własną albo odśwież za chwilę.';
  } catch (e) {
    $('multi-lobby-status').textContent = `Nie udało się pobrać listy gier: ${e?.message ?? e}`;
  }
}

// m12-75: dawny handler listy gier z ekranu multi przeniósł się na setup —
// `odswiezListeGierNaSetupie` przy segmencie „Dołączam” i przycisku odświeżania.
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
  const organizator = m.rola === 'organizator';
  // Audyt PR #13 pkt 2: wyjście organizatora zamyka grę WSZYSTKIM (most
  // przenosi ją do archiwum — bez organizatora nie ma kto wystartować), więc
  // jest to akcja nieodwracalna i idzie dwustopniowo, jak rezygnacja w grze
  // (`rezygnujZGryMulti`) i kasowanie danych. Gość wychodzi jednym klikiem:
  // przed startem może dołączyć ponownie z listy gier w okolicy.
  if (organizator && !STAN.multiOpuszczenieUzbrojone) {
    STAN.multiOpuszczenieUzbrojone = true;
    $('przycisk-lobby-opusc').textContent = '⚠ Kliknij ponownie, aby zamknąć grę';
    status('Wyjście organizatora ZAMYKA grę dla wszystkich — nikt już nie wystartuje. Kliknij ponownie, aby potwierdzić.');
    return;
  }
  STAN.multiOpuszczenieUzbrojone = false;
  $('przycisk-lobby-opusc').textContent = 'Opuść lobby';
  const url = m.urlMostu ?? urlMostuMulti();
  const cialo = {
    akcja: 'gra-opusc',
    idGry: m.gra?.idGry ?? null,
    kod: m.gra?.kod ?? null,
    graczId: m.graczId,
  };
  status(organizator
    ? 'Wychodzisz z lobby — zamykam grę, bo bez organizatora nie może wystartować.'
    : 'Wychodzisz z lobby. Dopóki gra nie wystartowała, możesz dołączyć ponownie z listy gier w okolicy.');
  zatrzymajSyncMulti();
  usunSesjeMulti();
  STAN.multi = null;
  renderujWznowienieMulti();
  pokazEkran('setup');
  // Telefon jest wolny od razu — polecenie idzie w tle. Bez niego wychodzący
  // zostawał w `liczbaGraczy` na liście gier: lobby obiecywało grę z graczem,
  // którego już nie było, a odświeżanie listy (10 s) niczego nie prostowało.
  if (!url) return;
  void polecenieMostu(url, cialo).catch((e) => {
    status(`Wyszedłeś z lobby, ale most tego nie przyjął (${e?.message ?? e}) — inni mogą Cię widzieć na liście, dopóki gra nie zniknie.`);
  });
}

/** Powrót do gry po odświeżeniu telefonu: sesja z localStorage + stan z mostu. */
async function przywrocGreMulti() {
  const sesja = czytajSesjeMulti();
  if (!sesja) { status('Telefon nie pamięta żadnej gry wieloosobowej.'); return; }
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
        : 'Gra wieloosobowa zakończona — host zamknął grę albo wszyscy aktywni gracze domknęli stacje. Wyniki poniżej.');
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
 * Lokalny silnik gry wieloosobowej (właściciel, 2026-09-11): w OBU trybach
 * gracz przechodzi wszystkie stacje — w Wspólnej Trasie PO KOLEI (kolejność
 * narzuca trasa, bez listy wyboru), w Wyścigu na Orientację w dowolnej
 * kolejności (ADR 0027 część B). Przy powrocie po odświeżeniu zamknięte
 * już stacje nie wracają — reszta rozgrywa się normalnie.
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
  let moje = wszystkie; // oba tryby: każdy przechodzi wszystkie stacje (trasa po kolei, wyścig dowolnie)
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
  status(`Gra ${gra.kod} (${gra.tryb === TRYBY_GRY.trasa ? 'Wspólna Trasa' : 'Wyścig na Orientację'}) rozpoczęta: przed Tobą ${moje.length} z ${wszystkie.length} stacji. Pytania odsłaniają się dopiero na stacjach.`
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
  // Opcje gry BEZ pytań i stacji — tylko ilość (właściciel, 2026-09-11).
  const sekret = gra.tryb === TRYBY_GRY.trasa && gra.trasaSekret !== false;
  $('lobby-tryb').textContent = `${gra.tryb === TRYBY_GRY.trasa ? '🗺️ Wspólna Trasa' : '🏁 Wyścig na Orientację'}${sekret ? ' · tylko kolejna stacja' : ''} · ${gra.konfiguracja?.liczbaStacji ?? '?'} stacji · ${gra.konfiguracja?.miejsce || 'nieznane miejsce'}`;
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
      ? `Czekasz na graczy z tej samej okolicy (maks. ${MAKS_GRACZY}). Możesz wystartować od razu — także solo, jednym graczem. Po starcie dołączenie nie jest już możliwe.`
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
  if (graSieToczy) {
    const zostalo = r ? stacjeDoWyboru(r).length : 0;
    tura.textContent = gra.tryb === TRYBY_GRY.trasa
      ? `Wspólna Trasa — stacje po kolei, każdy we własnym tempie. Zostało Ci ${zostalo} stacji. Wyniki na żywo poniżej.`
      : `Wyścig na Orientację — kolejność dowolna. Zostało Ci ${zostalo} stacji. Wyniki na żywo poniżej.`;
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
    fcMulti.textContent = 'Pytania bez wymuszonego fact-checku';
  }
  renderujWyborStacji(gra, r, graSieToczy);
  $('przycisk-pomin-stacje').hidden = true; // w multi pomijania nie ma — patrz pominStacjeGry
  renderujInfoMulti(gra);
  // Host kończy grę, kiedy chce — wszyscy dostają podsumowanie (właściciel, 2026-09-11).
  $('przycisk-multi-zakoncz').hidden = !(gra.stan === 'trwa' && m.rola === 'organizator');
  renderujPasekSync();
}

/**
 * Kanał info z gry (właściciel, 2026-09-11): kto dołączył, kto dotarł do
 * stacji i czy dobrze odpowiedział, rezygnacje i koniec gry. Komunikaty są
 * neutralne płciowo i pojawiają się z pollingu (w grze co ~30 s).
 */
function renderujInfoMulti(gra) {
  const blok = $('multi-info');
  const lista = $('multi-info-lista');
  const pseudonimy = new Map((gra?.gracze ?? []).map((g) => [g.id, g.pseudonim]));
  const komunikaty = [];
  for (const z of gra?.zdarzenia ?? []) {
    const kto = pseudonimy.get(z.graczId) ?? 'któś';
    if (z.typ === 'start') komunikaty.push(`▶ ${kto} wystartował grę`);
    else if (z.typ === 'dojscie') komunikaty.push(`📍 ${kto} jest na stacji ${z.stacjaId}`);
    else if (z.typ === 'odpowiedz') komunikaty.push(`${z.dane?.poprawna ? '✅' : '❌'} ${kto}: ${z.dane?.poprawna ? 'dobra' : 'zła'} odpowiedź (stacja ${z.stacjaId})`);
    else if (z.typ === 'rezygnacja') komunikaty.push(`🏳 ${kto} opuszcza grę`);
    else if (z.typ === 'koniec') komunikaty.push(`⏹ ${kto} zakończył grę`);
  }
  blok.hidden = komunikaty.length === 0;
  lista.replaceChildren(...komunikaty.slice(-8).reverse().map((tekst) => {
    const li = document.createElement('li');
    li.textContent = tekst;
    return li;
  }));
}

/** Host kończy grę przed czasem — u wszystkich podsumowanie i ranking. */
async function zakonczGreMulti() {
  const m = STAN.multi;
  if (!m || m.rola !== 'organizator') return;
  status('Kończę grę na mostku Drive…');
  try {
    const wynik = await polecenieMostu(m.urlMostu, {
      akcja: 'gra-zakoncz', kod: m.gra.kod, idGry: m.gra.idGry ?? null, graczId: m.graczId,
    });
    status('Gra zakończona — podsumowanie i ranking końcowy poniżej. Premie za kolejność liczą się też przy takim końcu.');
    onStanGryMulti(wynik.gra);
  } catch (e) {
    status(`Nie udało się zakończyć gry: ${e?.message ?? e}`);
  }
}

/**
 * Wolna kolejność stacji (ADR 0027 część B pkt 2): w Wyścigu na Orientację
 * gracz wybiera dowolną stację, do której jeszcze nie doszedł. W Wspólnej
 * Trasie listy nie ma — kolejność narzuca trasa (kolejna stacja po
 * zamknięciu poprzedniej); lista znika też po zamknięciu wszystkich stacji.
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

/**
 * Operatorskie nadpisanie szablonu kafelków OSM. Polityka kafelków OSM wprost
 * zaleca: „avoid hard-coding the tile URL; allow switching without needing a
 * software update" — serwer kafelków jest wolontariacki, bez SLA, i może zostać
 * wycofany albo zablokowany bez uprzedzenia. Klucz pozwala przełączyć podkład
 * w terenie, bez czekania na wdrożenie.
 *
 * Wartość nieobecna albo błędna = adres wbudowany (`walidujSzablonKafelkow`
 * odrzuca wszystko, co nie jest `https:` z `{z}/{x}/{y}`), więc domyślne
 * zachowanie jest niezmienione. `localStorage` bywa niedostępny (tryb prywatny,
 * zablokowane ciastka) — stąd `try/catch`.
 *
 * @returns {string|null} szablon przyjęty, albo `null` gdy został wbudowany
 */
function wczytajNadpisanieKafelkow() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return ustawSzablonKafelkow(localStorage.getItem(KLUCZ_URL_KAFELKOW));
  } catch {
    return null;
  }
}

function start() {
  wczytajNadpisanieKafelkow();
  wczytajKonfiguracje();
  STAN.konfig = konfiguracjaNowegoSetupu(STAN.konfig);
  // Porządek rejestru paczek (właściciel 2026-09-11): stare wpisy dostają
  // FAKTYCZNE tematy pytań — dopasowanie przestaje odrzucać paczkę za tematy
  // dopuszczalne w starym setupie, których w pytaniach nie ma.
  ujedgajnijTematyWpisowLokalnych();
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
  renderujSegment('lista-wieku', WIEK_SETUP, STAN.konfig.wiek, (wiek) => { STAN.konfig.wiek = wiek; });
  renderujTematy();
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
    // na Drive (ADR 0029).
    STAN.trybTestowy = true;
    document.body.classList.add('tryb-testowy');
  }
  if (location.search.includes('odstep=0')) {
    // skrót dla testów/przeglądarki: przełączanie instancji Overpass bez
    // pauz limitowych (polityka ASSETS §2 jest domyślnie nietknięta)
    STAN.odstepOverpassMs = 0;
  }

  $('przycisk-ranking').addEventListener('click', przelaczRankingi); // 🏆 warstwa rankingu (ADR 0039)
  $('przycisk-zamknij-ranking').addEventListener('click', przelaczRankingi);
  $('przycisk-informacje').addEventListener('click', przelaczInformacje);
  $('przycisk-zamknij-informacje').addEventListener('click', przelaczInformacje);
  $('przycisk-podejrzyj-mape').addEventListener('click', przelaczPodgladMapy);
  $('przycisk-setup').addEventListener('click', przelaczSetup); // START GRY w nagłówku (F3: przełącznik)
  $('ekran-start').addEventListener('click', ukryjStart); // okno startowe: klik gdziekolwiek zamyka
  // „▶ Zacznij” (właściciel 2026-09-09): jawny przycisk intro otwiera setup,
  // dokładnie jak ⚙ START GRY w belce — samo zamknięcie okna zostawiało gracza
  // na pustej mapie i kazało szukać drugiego przycisku. `stopPropagation`, bo
  // klik bąbelkuje do warstwy, której handler tylko zamyka okno.
  $('przycisk-start-zacznij').addEventListener('click', (z) => {
    z.stopPropagation?.();
    pokazEkran('setup'); // sam woła ukryjStart()
  });
  document.addEventListener('keydown', (z) => {
    if (z.key !== 'Escape') return;
    if (STAN.podgladMapy) przelaczPodgladMapy();
    else if (!$('ekran-informacje').hidden) przelaczInformacje();
    else if (!$('ekran-ranking').hidden) przelaczRankingi();
    else ukryjStart();
    odswiezWidocznoscPaneli();
  });
  $('przycisk-motyw').addEventListener('click', przelaczMotyw);
  $('przycisk-sygnaly').addEventListener('click', przelaczSygnaly);
  $('przycisk-sygnaly').setAttribute('aria-pressed', String(sygnalyWlaczone()));
  zarejestrujServiceWorker();
  // „🔐 Dane i prywatność" na ekranie setupu nie ma (właściciel, 2026-09-09) —
  // jedyny dostęp to stopka (`przycisk-prywatnosc-stopka` poniżej).
  $('przycisk-tematy-wszystkie').addEventListener('click', () => ustawWszystkieTematy(true));
  $('przycisk-tematy-zadne').addEventListener('click', () => ustawWszystkieTematy(false));
  $('przycisk-prywatnosc-stopka').addEventListener('click', pokazPrywatnosc);
  $('przycisk-wrocz-prywatnosc').addEventListener('click', wrocZPrywatnosci);
  $('przycisk-czysc-dane').addEventListener('click', czyscDaneWitryny);

  $('przycisk-dalej-pozycja').addEventListener('click', async () => {
    STAN.multiPoPaczce = false; // to jest zwykła ścieżka hot-seat, nie multi
    STAN.ukryjStacje = false;
    // „Dołączam do istniejącej” nie używa tego przycisku (m12-75): lista gier
    // w okolicy żyje bezpośrednio na setupie, a przycisk jest wtedy Ukryty.
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
    // Multi + „Zakładam nową grę” (właściciel, 2026-09-11): pytań na stację
    // BRAK — liczba stacji = liczba pytań (po 1 na stację), promień liczy
    // się jak w hot-seat. Po wklejeniu paczki otworzy się lobby.
    if (STAN.rodzajGry === 'multi') {
      STAN.konfig.pytaniaNaStacje = 1;
      przeliczPromienZCzasu(); // promień zależy od liczby pytań (ADR 0025)
      STAN.multiPoPaczce = true;
      STAN.ukryjStacje = STAN.multiTryb === TRYBY_GRY.trasa && STAN.multiTrasaSekret;
    }
    zapiszKonfiguracje();
    pokazEkran('pozycja');
    pokazPozycje();
    // Bug G: ten klik jest gestem użytkownika. Watcher z ładowania strony bywa
    // na iOS „aktywny” i niemy zarazem (WebKit bez callbacków), więc dopóki nie
    // ma żadnego fixa, odświeżamy nasłuch przy każdym wejściu na ekran pozycji.
    if (!STAN.trybTestowy && (!STAN.watcher?.czyAktywny() || !STAN.ostatniFix)) wlaczGps();
    if (STAN.multiPoPaczce) {
      status(STAN.ukryjStacje
        ? 'Potwierdź pozycję, wygeneruj stacje i pytania, wklej odpowiedź modelu — po paczce otworzy się lobby. Trasa jest tajemnicą: widzisz tylko komunikat o liczbie stacji.'
        : 'Potwierdź pozycję, wygeneruj stacje i pytania, wklej odpowiedź modelu — po paczce otworzy się lobby.');
    }
  });


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
  $('przycisk-wstecz-setup').addEventListener('click', () => {
    STAN.multiPoPaczce = false; // porzucono ścieżkę AI-multi
    STAN.ukryjStacje = false;
    pokazEkran('setup');
  });
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
    // Uwaga terenowa G.a (właściciel, 2026-09-12): każda NOWA generacja
    // startuje z domyślnym = ODPTASZKOWANYM checkboxem (ADR 0032: domyślny
    // jest wariant bez fact-check). Aplikacja nie przeładowuje się sama
    // (PWA), więc stan DOM checkboxa „przeżywał” tło aplikacji i staro
    // zaptaszkowane pole właściciel widział jako „domyślnie zaptaszkowane”.
    // Reset jest TYLKO przy wejściu z ekranu 3: strzałka wstecz (ekran 5 → 4)
    // celowo nie rusza checkboxa — prompt tej samej generacji nie może
    // zmieniać się pod palcem.
    $('prompt-factcheck').checked = false;
    pokazEkran('prompt');
    budujPromptEkran();
  });

  $('przycisk-wstecz-stacje').addEventListener('click', () => pokazEkran('stacje'));
  $('przycisk-kopiuj-prompt').addEventListener('click', (e) => kopiujTekst(STAN.prompt ?? '', e.currentTarget, '⧉ Kopiuj prompt'));
  $('prompt-factcheck').addEventListener('change', () => budujPromptEkran());
  // Przycisku „Zapisz jako plik" nie ma (właściciel, 2026-09-09): prompt i tak
  // idzie do schowka („Kopiuj prompt"), a plik .txt był dodatkową drogą, której
  // nikt nie używał. Eksportów wyniku też już nie ma (ADR 0038), więc zniknął
  // i helper `pobierzPlik` — nie ma czego pobierać.
  $('przycisk-dalej-paczka').addEventListener('click', () => pokazEkran('paczka'));

  $('przycisk-wstecz-prompt').addEventListener('click', () => pokazEkran('prompt'));
  // Zgłoszenie właściciela 2026-09-09 (trzecia tura): „ma zostać pole i guzik
  // »Wklej ze schowka« → po wklejeniu czegokolwiek ma się automatycznie
  // zatwierdzać". Wklejenie jest już decyzją organizatora — osobne „Sprawdź
  // i przyjmij" tylko dokładało klik w terenie, więc zniknęło razem z importem
  // z pliku (ścieżka, z której nikt nigdy nie korzystał).
  $('przycisk-wklej').addEventListener('click', async (e) => {
    try {
      const tekst = await navigator.clipboard.readText();
      if (!tekst.trim()) {
        $('wklejka-status').textContent = 'Schowek jest pusty — skopiuj najpierw całą odpowiedź modelu w czacie.';
        return;
      }
      $('pole-odpowiedz').value = tekst;
      sprawdzOdpowiedz(tekst);
    } catch (err) {
      void err;
      // Schowek bywa zablokowany (ENVIRONMENT §5) — wtedy zostaje wklejenie
      // palcem do pola obok, które i tak samo się zatwierdzi. L6: mówimy o tym.
      e.currentTarget.textContent = '⚠ schowek zablokowany';
      $('wklejka-status').textContent = 'Przeglądarka nie dała dostępu do schowka — wklej treść palcem: przytrzymaj pole powyżej i wybierz „Wklej".';
      window.setTimeout(() => { e.currentTarget.textContent = '📋 Wklej ze schowka'; }, 3000);
    }
  });

  /**
   * Wklejenie palcem (Ctrl+V albo menu dotykowe) waliduje samo z siebie.
   *
   * Treść bierzemy z `clipboardData`, NIE z pola: `paste` leci PRZED wstawieniem
   * tekstu, więc `pole.value` jest w tej chwili jeszcze puste (albo ma poprzednią
   * zawartość). Domyślnej akcji nie blokujemy — pole ma pokazać, że coś w nim
   * jest, a `sprawdzOdpowiedz` i tak je wyczyści po przyjęciu paczki.
   */
  $('pole-odpowiedz').addEventListener('paste', (e) => {
    const tekst = e.clipboardData?.getData('text') ?? '';
    if (!tekst.trim()) return; // wklejenie obrazka albo pustki nie udaje paczki
    $('pole-odpowiedz').value = tekst;
    sprawdzOdpowiedz(tekst);
  });
  $('przycisk-poprawka').addEventListener('click', (e) => {
    const tekst = poprawkaDlaModelu(STAN.usterkiPaczki, { liczbaPytan: liczbaPytan(STAN.konfig), factcheck: STAN.poprawkaFactcheck });
    kopiujTekst(tekst, e.currentTarget, '⧉ Kopiuj poprawkę do modelu');
    $('pole-odpowiedz').value = tekst;
  });

  // „Zobacz więcej/mniej paczek" (właściciel 2026-09-11): lista startuje
  // zwinięta do trzech najlepszych, przycisk odsłania resztę i zwija z powrotem.
  $('przycisk-zestawy-wiecej').addEventListener('click', () => {
    ZESTAWY_ROZWINIETE = !ZESTAWY_ROZWINIETE;
    renderujZestawy();
  });
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

  /* M11/P4+m12-74: gra na wielu urządzeniach — segmenty na setupie, lobby,
     kanał info i koniec gry z ręki hosta (bez kodów i bez źródeł paczek). */
  wczytajUstawieniaMulti();
  renderujRodzajeGry();
  renderujMultiSciezka();
  renderujTrybyMulti();
  renderujRodzajGry();
  renderujWznowienieMulti();
  $('multi-trasa-sekret').addEventListener('change', (e) => {
    STAN.multiTrasaSekret = e.target.checked;
    status(STAN.multiTrasaSekret
      ? 'Trasa-sekret: w grze mapa pokazuje tylko bieżącą stację.'
      : 'Trasa jawna: mapa w grze pokazuje wszystkie stacje.');
  });
  $('przycisk-odswiez-lobby').addEventListener('click', () => { void odswiezListeGierNaSetupie(); });
  $('przycisk-lobby-start').addEventListener('click', () => { void startLobby(); });
  $('przycisk-lobby-opusc').addEventListener('click', opuscLobby);
  $('przycisk-multi-zakoncz').addEventListener('click', () => { void zakonczGreMulti(); });
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

  odswiezWidocznoscPaneli();
  // Brak komunikatu na starcie (właściciel 2026-09-11): dawny status „M0 —
  // fundament. Ustawienia domyślne…” był developerskim tekstem na ekranie gry.
  if (!STAN.trybTestowy && !STAN.watcher?.czyAktywny()) wlaczGps();
}

if (typeof document !== 'undefined' && document.getElementById('ekran-setup')) start();
