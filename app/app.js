/**
 * app.js — bootstrap: ekrany, stan sesji, spinanie modułów.
 *
 * Zakres M0: setup → pozycja → stacje (tryb uproszczony) → prompt → wklejenie
 * i walidacja paczki. Mapa (M2), Overpass (M4), szyfrowanie paczki (M1/M5)
 * i rozgrywka (M6) dochodzą w kolejnych kamieniach — patrz `docs/ROADMAP.md`.
 *
 * Warstwa DOM jest celowo cienka (ARCHITECTURE §podział): logika mieszka
 * w `konfig.js`, `geo.js`, `protokol.js`, `stacje.js` i jest testowana w Node.
 */

import { DOMYSLNE, JEZYKI, OGRANICZENIA, PODKLADY, TEMATY, TRYBY, WIEK, WSPOLPRACA, domyslnaKonfiguracja, liczbaPytan, oczyscKonfiguracje, proponujKodGry, rngZZiarna, walidujSetup, ziarnoRozgrywki } from './konfig.js?v=m0-1';
import { formatujWspolrzedne, geohash, czyWspolrzedneOk } from './geo.js?v=m0-1';
import {
  parsujOdpowiedzModela,
  podsumowaniePaczki,
  poprawkaDlaModelu,
  walidujPaczke,
  zbudujPrompt,
  WERSJA_PROTOKOLU,
} from './protokol.js?v=m0-1';
import { SCHEMAT_KONTENERA, odpakujPaczke, zapakujPaczke } from './kodowanie.js?v=m0-1';
import { ZRODLA_STACJI, miaraSprawiedliwosci, najmniejszyOdstepM, stacjeProste } from './stacje.js?v=m0-1';

const KLUCZ_KONFIG = 'okolica:konfig';
const KLUCZ_MOTYW = 'okolica:motyw';

const STAN = {
  konfig: domyslnaKonfiguracja(),
  pozycja: null,
  dokladnoscM: null,
  miejsce: '',
  stacje: [],
  obrot: 0,
  ziarnoOffset: 0,
  prompt: null,
  paczka: null,
  usterkiPaczki: [],
  trybTestowy: false,
  watcher: null,
};

function $(id) {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Brak elementu #${id} w index.html`);
  return e;
}

const EKRANY = ['setup', 'pozycja', 'stacje', 'prompt', 'paczka'];

function pokazEkran(nazwa) {
  for (const e of EKRANY) {
    $(`ekran-${e}`).hidden = e !== nazwa;
    const krok = document.querySelector(`#kroki li[data-krok="${e}"]`);
    if (krok) {
      krok.classList.toggle('aktywny', e === nazwa);
      krok.classList.toggle('zrobione', EKRANY.indexOf(e) < EKRANY.indexOf(nazwa));
    }
  }
  window.scrollTo({ top: 0 });
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
  $('setup-podklad').addEventListener('change', (e) => { STAN.konfig.podklad = e.target.value; });
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
  $('setup-geokodacja').addEventListener('change', (e) => { STAN.konfig.geokodacja = e.target.checked; });
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
    return;
  }
  $('pozycja-status').textContent = 'Pozycja ustalona';
  $('pozycja-dokladnosc').textContent = STAN.dokladnoscM ? `dokładność: ±${Math.round(STAN.dokladnoscM)} m` : 'dokładność: nieznana (tryb testowy)';
  $('pozycja-wspolrzedne').textContent = `${formatujWspolrzedne(p.lat, p.lon)} · geohash ${geohash(p.lat, p.lon, 6)}`;
  $('pozycja-miejsce').textContent = STAN.miejsce ? `miejsce: ${STAN.miejsce}` : 'nazwa miejsca: brak odczytu (Overpass dołączy ją w M4)';
  $('przycisk-dalej-stacje').disabled = false;
  if (STAN.dokladnoscM && STAN.dokladnoscM > 100) {
    status('Dokładność GPS powyżej 100 m — przejdź w miejsce z lepszym widokiem nieba albo użyj współrzędnych ręcznych.');
  }
}

function wlaczGps() {
  if (!('geolocation' in navigator)) {
    pokazBledy('bledy-pozycja', [{ kod: 'G01', pole: 'geolocation', komunikat: 'Ta przeglądarka nie udostępnia geolokalizacji. Użyj trybu testowego (⚙) albo innej przeglądarki.' }]);
    return;
  }
  if (STAN.watcher != null) navigator.geolocation.clearWatch(STAN.watcher);
  $('pozycja-status').textContent = 'Szukam satelitów…';
  status('GPS włączony — pierwszy fix potrafi trwać kilkanaście sekund.');
  STAN.watcher = navigator.geolocation.watchPosition(
    (fix) => {
      STAN.pozycja = { lat: fix.coords.latitude, lon: fix.coords.longitude };
      STAN.dokladnoscM = fix.coords.accuracy;
      pokazPozycje();
      pokazBledy('bledy-pozycja', []);
    },
    (blad) => {
      const komunikaty = {
        1: 'Brak zgody na geolokalizację — włącz ją w ustawieniach strony albo użyj współrzędnych ręcznych.',
        2: 'Pozycja niedostępna (brak sygnału GPS). Wyjdź na otwartą przestrzeń albo wpisz współrzędne ręcznie.',
        3: 'Przekroczony czas oczekiwania na pozycję. Spróbuj ponownie.',
      };
      pokazBledy('bledy-pozycja', [{ kod: `G0${blad.code || 9}`, pole: 'geolocation', komunikat: komunikaty[blad.code] ?? blad.message }]);
      $('pozycja-status').textContent = 'Brak pozycji';
      status('GPS niedostępny — dostępny tryb ręczny (ADR 0004 pkt 5).');
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
  );
}

/* ---------------------------------------------------------------- stacje */

function ziarno() {
  const data = new Date().toISOString().slice(0, 10);
  return `${ziarnoRozgrywki({ lat: STAN.pozycja.lat, lon: STAN.pozycja.lon, promienM: STAN.konfig.promienM, liczbaStacji: STAN.konfig.liczbaStacji, data })}|${STAN.ziarnoOffset}`;
}

function przeliczStacje() {
  STAN.stacje = stacjeProste({
    srodek: STAN.pozycja,
    liczbaStacji: STAN.konfig.liczbaStacji,
    promienM: STAN.konfig.promienM,
    ziarno: ziarno(),
    offsetObrotu: STAN.obrot,
  });
  renderujStacje();
}

function renderujStacje() {
  const lista = $('lista-stacji');
  lista.innerHTML = '';
  STAN.stacje.forEach((s) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="numer">${s.id}</span><span class="opis">${s.opis || 'punkt w terenie (bez nazwy — nazwy doda Overpass w M4)'}<br><span class="kod">${formatujWspolrzedne(s.lat, s.lon)} · ${s.bearing}°</span></span><span class="dystans">${s.odlegloscM} m</span>`;
    lista.appendChild(li);
  });
  const m = miaraSprawiedliwosci(STAN.stacje);
  $('stacje-sprawiedliwosc').textContent = `średnio ${m.sredniaM} m od startu · odchylenie ${m.odchylenieM} m (${Math.round(m.udzialOdchylenia * 100)}%) · najmniejszy odstęp między stacjami ${najmniejszyOdstepM(STAN.stacje)} m`;
  $('stacje-tryb').textContent = `${ZRODLA_STACJI.pierscien}. Docelowo: punkty na sieci dróg, placów i szlaków (ADR 0005, kamień M4).`;
}

/* ---------------------------------------------------------------- prompt */

function budujPromptEkran() {
  const wynik = zbudujPrompt({
    konfig: STAN.konfig,
    okolica: { lat: STAN.pozycja.lat, lon: STAN.pozycja.lon, promienM: STAN.konfig.promienM, miejsce: STAN.miejsce },
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
    status('Paczka odrzucona przez walidator (protokół PYT §6).');
    return;
  }

  wynik.dataset.stan = 'ok';
  STAN.paczka = paczka;
  $('wynik-naglowek').textContent = 'Paczka przyjęta';
  $('przycisk-poprawka').hidden = true;
  $('przycisk-ukryj').hidden = false;
  const s = podsumowaniePaczki(paczka);
  const wpisz = (dt, dd) => { podsumowanie.insertAdjacentHTML('beforeend', `<dt>${dt}</dt><dd>${dd}</dd>`); };
  wpisz('pytania', `${s.liczbaPytan} (stacje: ${s.stacje.join(', ')})`);
  wpisz('tematy', s.tematy.join(', '));
  wpisz('źródła', `${s.liczbaZrodel} adresów — pokazane graczom po odpowiedzi`);
  wpisz('punkty', `${s.punktyRazem} do zdobycia`);
  if (s.uwagi) wpisz('uwagi modelu', s.uwagi);
  if (zKontenera.zrodlo === 'kontener') wpisz('postać', 'paczka ukryta (kontener TO-paczka/2)');
  else if (zKontenera.zrodlo === 'json') wpisz('postać', 'jawny JSON od modelu — przed ukryciem');
  wpisz('następny krok', 'rozgrywka — kamień M6 (pytania zostaną ukryte w pamięci urządzenia)');
  // Pole wklejenia jest czyszczone natychmiast: plaintext nie zostaje w DOM
  // (ADR 0007 pkt 4). Paczka żyje w pamięci modułu.
  $('pole-odpowiedz').value = '';
  status('Paczka pytań zwalidowana i przyjęta do pamięci sesji.');
}

function renderujUsterki(usterki) {
  const lista = $('wynik-usterki');
  lista.innerHTML = '';
  for (const u of usterki) {
    const li = document.createElement('li');
    li.innerHTML = `<code>${u.kod}</code> ${u.pole ? `<strong>${u.pole}</strong> — ` : ''}${u.komunikat}`;
    lista.appendChild(li);
  }
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

  if (location.search.includes('tryb=test')) {
    STAN.trybTestowy = true;
    $('przycisk-test').setAttribute('aria-pressed', 'true');
    $('reczne-wspolrzedne').hidden = false;
  }

  $('przycisk-motyw').addEventListener('click', przelaczMotyw);
  $('przycisk-test').addEventListener('click', () => {
    STAN.trybTestowy = !STAN.trybTestowy;
    $('przycisk-test').setAttribute('aria-pressed', String(STAN.trybTestowy));
    $('reczne-wspolrzedne').hidden = !STAN.trybTestowy;
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
  $('przycisk-recznie').addEventListener('click', () => {
    $('reczne-wspolrzedne').hidden = false;
    $('setup-lat').focus();
  });
  $('przycisk-ustaw-reczne').addEventListener('click', () => {
    const lat = Number($('setup-lat').value);
    const lon = Number($('setup-lon').value);
    if (!czyWspolrzedneOk(lat, lon)) {
      pokazBledy('bledy-pozycja', [{ kod: 'G10', pole: 'wspolrzedne', komunikat: 'Wpisz szerokość od -90 do 90 i długość od -180 do 180 (stopnie dziesiętne).' }]);
      return;
    }
    STAN.pozycja = { lat, lon };
    STAN.dokladnoscM = null;
    pokazBledy('bledy-pozycja', []);
    pokazPozycje();
    status('Pozycja ustawiona ręcznie (tryb testowy).');
  });

  $('przycisk-wstecz-setup').addEventListener('click', () => pokazEkran('setup'));
  $('przycisk-dalej-stacje').addEventListener('click', () => {
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
    status(`Paczka ukryta w kontenerze ${SCHEMAT_KONTENERA} — to obfuskacja bez klucza, nie szyfrowanie (ADR 0007).`);
  });

  pokazEkran('setup');
  status(`M0 — fundament. Ustawienia domyślne: ${TRYBY[STAN.konfig.tryb].etykieta}, ${STAN.konfig.liczbaStacji} stacji, ${DOMYSLNE.pytaniaNaStacje} pytanie na stację, wiek ${WIEK[STAN.konfig.wiek].etykieta}.`);
}

if (typeof document !== 'undefined' && document.getElementById('ekran-setup')) start();
