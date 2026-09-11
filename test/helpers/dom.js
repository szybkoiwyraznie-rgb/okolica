/**
 * helpers/dom.js — wspólna atrapa DOM dla testów warstwy aplikacji.
 *
 * Wyciągnięta z `test/aplikacja.test.js`, bo testów dotykających `app.js`
 * przybywa (geolokalizacja, rozgrywka, trwałość) i każdy potrzebowałby tej
 * samej konstrukcji. Atrapa jest celowo głupia: `querySelector` zwraca `null`
 * (jak w pustym kontenerze), `innerHTML` niczego nie parsuje. Kod, który tego
 * nie przeżyje, nie przeżyje też wolnego renderowania w przeglądarce.
 *
 * **Uwaga na `node --test`**: każdy plik `.js` w katalogu `test/` jest
 * traktowany jak plik testowy, więc ten też się uruchamia — dlatego nie ma tu
 * ani jednej asercji, ani skutku ubocznego na poziomie modułu. Wszystko dzieje
 * się dopiero w `zainstalujDom()` (ARCHITECTURE „Testowanie").
 */
import { projektuj } from '../../app/geo.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Katalog repozytorium (o dwa poziomy wyżej niż ten plik: test/helpers/). */
export const KATALOG = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/**
 * Prawdziwy fetch Node — łapany PRZY IMPORCIE (zanim jakikolwiek test podstawi
 * własną atrapę), ale tylko odczytywany: instalacja hermetycznej sieci dzieje
 * się w `zainstalujDom()`, więc ten moduł nie ma skutków ubocznego.
 */
const PRAWDZIWY_FETCH = typeof globalThis.fetch === 'function' ? globalThis.fetch : null;
/** Aktywna hermetyczna sieć testów: `{ wywolania: string[] }`, eksponowana jako `dom.siec`. */
let hermetycznaSiec = null;

/**
 * Atrapa nie parsuje HTML-a, więc stan początkowy `hidden` bierzemy z pliku:
 * elementy oznaczone w `index.html` jako ukryte są ukryte również w teście.
 * @returns {Set<string>} identyfikatory elementów z atrybutem `hidden`
 */
export function ukryteWHtml(html) {
  return new Set(
    [...html.matchAll(/<[a-z]+[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => /\bhidden\b/.test(tag))
      .map((tag) => tag.match(/id="([^"]+)"/)?.[1])
      .filter(Boolean),
  );
}

/** Pojedynczy element-atrapa. `zdarzenia` i `children` pozwalają asertować UI. */
export function stubElementu(id, ukryte = new Set(), { prostokat = null } = {}) {
  let wartosc = '';
  let wlasnyTekst = '';
  return {
    id,
    tagName: String(id).toUpperCase(),
    /** Rozmiar elementu na ekranie — mapa mierzy nim swój panel. */
    getBoundingClientRect() {
      return prostokat ?? { width: 360, height: 320, top: 0, left: 0, right: 360, bottom: 320 };
    },
    // jak w prawdziwym <input>: zapis liczby i tak czytany jest jako tekst —
    // atrapa, która tego nie robi, przepuściłaby porównania `value === 1000`
    get value() { return wartosc; },
    set value(v) { wartosc = v === null || v === undefined ? '' : String(v); },
    // jak w prawdziwym DOM: odczyt AGREGUJE tekst potomków, a zapis ZASTĘPUJE
    // potomków jednym tekstem (atrapa bez tego przepuściłaby puste kontenery
    // z dziećmi — M7/P3 czyta tekst całej karty wyniku)
    get textContent() {
      const zDzieci = this.children
        .map((d) => {
          if (typeof d === 'string') return d; // Element.append(tekst) — węzeł tekstowy
          if (typeof d === 'number') return String(d);
          return d && typeof d.textContent === 'string' ? d.textContent : '';
        })
        .join('');
      return wlasnyTekst + zDzieci;
    },
    set textContent(v) {
      wlasnyTekst = v === null || v === undefined ? '' : String(v);
      this.children = [];
    },
    innerHTML: '',
    checked: false,
    disabled: false,
    hidden: ukryte.has(id),
    style: {},
    checked: false, // jak HTMLInputElement.checked; zainstalujDom nadpisze z atrybutu
    dataset: {},
    children: [],
    zdarzenia: {},
    classList: {
      dodane: new Set(),
      add(...c) { c.forEach((x) => this.dodane.add(x)); },
      remove(...c) { c.forEach((x) => this.dodane.delete(x)); },
      toggle(c, czyNa) { if (czyNa) this.dodane.add(c); else this.dodane.delete(c); },
      contains(c) { return this.dodane.has(c); },
    },
    appendChild(dziecko) { if (dziecko.parentNode) dziecko.parentNode.removeChild(dziecko); this.children.push(dziecko); dziecko.parentNode = this; return dziecko; },
    removeChild(dziecko) {
      const i = this.children.indexOf(dziecko);
      if (i >= 0) { this.children.splice(i, 1); dziecko.parentNode = null; }
      return dziecko;
    },
    /** Jak w przeglądarce (Chrome 86+): podmiana całej listy dzieci. */
    replaceChildren(...nowe) { this.children = [...nowe]; return undefined; },
    append(...wezel) { this.children.push(...wezel); return undefined; }, // jak Element.append (bez zwracania)
    get firstChild() { return this.children[0] ?? null; }, // jak Node.firstChild (M9/R3: czyszczenie listy)
    setAttribute(k, v) { this.dataset[`attr-${k}`] = v; },
    getAttribute(k) { return this.dataset[`attr-${k}`] ?? null; },
    removeAttribute(k) { delete this.dataset[`attr-${k}`]; },
    addEventListener(typ, fn) { (this.zdarzenia[typ] ??= []).push(fn); },
    removeEventListener(typ, fn) {
      const lista = this.zdarzenia[typ];
      if (!lista) return;
      const i = lista.indexOf(fn);
      if (i >= 0) lista.splice(i, 1);
    },
    /**
     * Selektory klas (`.foo`, `span.foo`) — wystarczają testom piguł
     * informacyjnych; każdy inny selektor zostaje „nie znaleziony",
     * żeby atrapa nie udawała prawdziwego silnika CSS.
     */
    querySelector(selektor) {
      const m = /^([a-z]+)?\.([a-z0-9_-]+)$/i.exec(String(selektor ?? '').trim());
      if (!m) return null;
      const [, typ, klasa] = m;
      for (const dziecko of this.children) {
        if (dziecko && typeof dziecko === 'object') {
          const klasy = String(dziecko.className ?? '').split(/\s+/).filter(Boolean);
          const tagOk = !typ || String(dziecko.tagName ?? '').toLowerCase() === typ.toLowerCase();
          if (klasy.includes(klasa) && tagOk) return dziecko;
          const wNizej = typeof dziecko.querySelector === 'function' ? dziecko.querySelector(selektor) : null;
          if (wNizej) return wNizej;
        }
      }
      return null;
    },
    querySelectorAll() { return []; },
    focus() {}, select() {}, setSelectionRange() {}, click() {}, scrollIntoView() {},
    setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture() { return false; },
    remove() {}, insertAdjacentHTML() {}, closest() { return null; }, matches() { return false; },
  };
}

/**
 * Instaluje atrapy `document`, `window`, `navigator`, `localStorage`,
 * `location` i paru API przeglądarki w `globalThis` i zwraca uchwyty do
 * sterowania nimi z testu.
 *
 * Wywołaj PRZED `await import('../app/app.js')` — aplikacja uruchamia
 * `start()` przy wczytaniu modułu.
 *
 * Każde wywołanie zakłada ŚWIEŻY zestaw atrap i nadpisuje globale, więc test
 * chcący inny stan startowy (np. `?tryb=test`) woła `zainstalujDom()` jeszcze
 * raz i importuje `app.js` od nowa — egzemplarze aplikacji nie dzielą wtedy
 * nasłuchów zdarzeń i nie wchodzą sobie w drogę.
 *
 * @param {object} [args]
 * @param {string} [args.sciezkaHtml] plik HTML względem repozytorium
 * @param {string} [args.search] `location.search` (np. `?tryb=test`)
 * @param {object} [args.geolocation] atrapa `navigator.geolocation`; `undefined` = brak API
 * @param {Map}    [args.pamiec] wspólna pamięć `localStorage` między importami
 * @returns {object} uchwyty: `pobierz`, `elementy`, `pamiec`, `wyslijZdarzenie*`, `ustaw*`
 */
export function zainstalujDom({ sciezkaHtml = 'index.html', search = '', geolocation = undefined, pamiec = new Map(), bezGracza = false } = {}) {
  // Tożsamość jest bramą ekranu 1 (ADR 0026 aneks): bez gracza na liście nie da
  // się przejść dalej, a testy nawigacji, mapy i paczek nie są o tożsamości.
  // Telefon w teście ma więc zapamiętanego, potwierdzonego gracza — jak po
  // pierwszej udanej grze. Testy bramy dają `bezGracza: true` (pusta lista).
  if (!bezGracza && !pamiec.has('okolica:gracze')) {
    pamiec.set('okolica:gracze', JSON.stringify({
      schemat: 'gracze-lokalni/1',
      gracze: [{ pseudonim: 'Ala', zweryfikowany: true }],
    }));
  }
  const gpsDom = atrapaGeolokalizacji();
  if (geolocation === undefined) geolocation = gpsDom.geolocation;
  const html = readFileSync(join(KATALOG, sciezkaHtml), 'utf8');
  const ukryte = ukryteWHtml(html);
  const elementy = new Map();

  const prostokaty = new Map();
  /** Wszystkie elementy utworzone przez aplikację (`document.createElement`) — testy canvasa M7/P5. */
  const utworzone = [];

  const pobierz = (id) => {
    if (!elementy.has(id)) elementy.set(id, stubElementu(id, ukryte, { prostokat: prostokaty.get(id) ?? null }));
    return elementy.get(id);
  };

  // M9b/D3: atrybut `checked` z HTML staje się stanem początkowym atrapy —
  // domyślna zgoda (checkbox wysyłki na Drive) musi być widoczna w testach.
  for (const m of html.matchAll(/<input[^>]*\bid="([^"]+)"[^>]*\bchecked\b/g)) {
    pobierz(m[1]).checked = true;
  }

  for (const m of html.matchAll(/<(?:button|input|select|textarea)[^>]*\bid="([^"]+)"[^>]*\bdisabled\b/g)) {
    pobierz(m[1]).disabled = true;
  }
  const zdarzeniaDokumentu = {};
  const documentStub = {
    documentElement: stubElementu('html', ukryte),
    body: stubElementu('body', ukryte),
    head: stubElementu('head', ukryte),
    hidden: false,
    visibilityState: 'visible',
    getElementById: pobierz,
    querySelector() { return null; },
    querySelectorAll(selektor) {
      // Minimalna wierność: wzorzec '#id tag' (pełnego silnika selektorów do
      // atrapy nie budujemy — inne wzorce dają [] jak dotąd).
      const m = /^#([\w-]+)\s+([a-zA-Z][\w-]*)$/.exec(String(selektor ?? '').trim());
      if (!m) return [];
      const rodzic = pobierz(m[1]);
      if (!rodzic) return [];
      const wynik = [];
      const zbierz = (el) => {
        for (const dziecko of el.children ?? []) {
          if (String(dziecko.tagName ?? '').toLowerCase() === m[2].toLowerCase()) wynik.push(dziecko);
          zbierz(dziecko);
        }
      };
      zbierz(rodzic);
      return wynik;
    },
    createElement(typ) {
      const el = stubElementu(typ, ukryte);
      utworzone.push(el);
      if (String(typ).toLowerCase() === 'canvas') {
        // atrapa canvas 2d: REJESTRUJE komendy (test wykonawcy planu), toBlob
        // oddaje Blob-asynchronicznie jak prawdziwy (M7/P5)
        el.width = 0;
        el.height = 0;
        el.komendy = [];
        el.getContext = (rodzaj) => {
          if (rodzaj !== '2d') return null;
          if (!el._kontekst) {
            const komendy = el.komendy;
            el._kontekst = {
              fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'alphabetic',
              fillRect(x, y, w, h) { komendy.push({ op: 'fillRect', x, y, w, h, fillStyle: this.fillStyle }); },
              fillText(tresc, x, y) { komendy.push({ op: 'fillText', tekst: String(tresc), x, y, fillStyle: this.fillStyle, font: this.font, textAlign: this.textAlign }); },
              beginPath() {},
              moveTo(x, y) { komendy.push({ op: 'moveTo', x, y }); },
              lineTo(x, y) { komendy.push({ op: 'lineTo', x, y }); },
              stroke() { komendy.push({ op: 'stroke', strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); },
              measureText(tresc) { return { width: String(tresc).length * 8 }; },
            };
          }
          return el._kontekst;
        };
        el.toBlob = (zwrotnik, typMime) => { setTimeout(() => zwrotnik(new Blob(['atrapa-png'], { type: typMime || 'image/png' })), 0); };
      }
      return el;
    },
    createElementNS(przestrzen, typ) {
      const el = stubElementu(typ, ukryte);
      el.przestrzenNazw = przestrzen;
      return el;
    },
    addEventListener(typ, fn) { (zdarzeniaDokumentu[typ] ??= []).push(fn); },
  };

  const zdarzeniaOkna = {};
  const windowStub = {
    scrollTo() {},
    // paleta jasna 1:1 z :root w styles.css — wykonawca planu obrazu (M7/P5)
    // bierze konkretne kolory z ról przez getComputedStyle
    getComputedStyle() {
      const zmienne = {
        '--tlo': '#f6f2e9', '--tlo-karta': '#fffdf8', '--tekst': '#1d2321',
        '--tekst-slaby': '#5c6663', '--akcent': '#2f6f4f', '--linia': '#d9d2c3',
        '--ostrzezenie': '#b4531f',
      };
      return { getPropertyValue: (nazwa) => zmienne[String(nazwa)] ?? '' };
    },
    addEventListener(typ, fn) { (zdarzeniaOkna[typ] ??= []).push(fn); },
    matchMedia() { return { matches: false, addEventListener() {}, addListener() {} }; },
    // przeglądarka wystawia timery także na `window` — kod, który woła
    // `window.setTimeout`, w atrapie bez nich padał PO teście (async)
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: (...args) => clearTimeout(...args),
  };

  const navigatorStub = { clipboard: undefined, geolocation, userAgent: 'node-test', language: 'pl-PL' };

  // Hermetyczna sieć (zgłoszenie właściciela 2026-09-11): w katalogu
  // okolica-gry-zakonczone na Drive pojawiały się dziesiątki plików
  // gra-hotseat-* — testy kończące grę leciały PRAWDZIWYM POST-em na
  // produkcyjny most (adres siedzi w DOMYSLNY_URL_MOSTU), a CI ma pełny
  // dostęp do internetu. Domyślny fetch testów odmawia jak awaria sieci;
  // testy, którym trzeba odpowiedzi mostu, podstawiają WŁASNĄ atrapę
  // (atrapaFetch w zestawy-ui, globalThis.fetch = … w hotseat) — te
  // ŚWIADOMIE zastępują tę, więc nie ruszamy niczego poza prawdziwym fetchem.
  if (PRAWDZIWY_FETCH && globalThis.fetch === PRAWDZIWY_FETCH) {
    hermetycznaSiec = { wywolania: [] };
    globalThis.fetch = async (adres) => {
      hermetycznaSiec.wywolania.push(String(adres));
      throw new TypeError(`fetch atrapy: testy nie wychodzą na sieć (${String(adres).slice(0, 80)})`);
    };
  }

  globalThis.document = documentStub;
  globalThis.window = windowStub;
  // Node 22+ ma własny getter `navigator` — tylko defineProperty go nadpisze.
  Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: navigatorStub });
  globalThis.localStorage = {
    getItem: (k) => (pamiec.has(k) ? pamiec.get(k) : null),
    setItem: (k, v) => pamiec.set(k, String(v)),
    removeItem: (k) => pamiec.delete(k),
    // pełne API przeglądarki, żeby kod mógł iterować klucze po prefiksie
    key: (i) => [...pamiec.keys()][i] ?? null,
    get length() { return pamiec.size; },
  };
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    writable: true,
    value: { protocol: 'https:', search, href: `https://przyklad.test/${search}`, host: 'przyklad.test' },
  });
  globalThis.matchMedia = windowStub.matchMedia;
  globalThis.alert = () => {};
  globalThis.performance = globalThis.performance ?? { now: () => 0 };
  globalThis.Blob = class { constructor(czesci) { this.size = (czesci ?? []).join('').length; } };
  globalThis.URL = globalThis.URL ?? {};
  globalThis.URL.createObjectURL = () => 'blob:test';
  globalThis.URL.revokeObjectURL = () => {};

  return {
    html,
    gps: gpsDom,
    /** Rzeczywiste wejście: fix GPS lub tap w mapę (?test=true), bez pól ręcznych. */
    ustawPozycje(lat, lon) {
      if (!documentStub.body.classList.contains('tryb-testowy')) {
        gpsDom.wyslijFix(Number(lat), Number(lon), 1250);
        return;
      }
      const t = pobierz('mapa-pozycja-kafelki').getAttribute('transform');
      const [, tx, ty, scale] = t.match(/translate\(([^ ]+) ([^)]+)\) scale\(([^)]+)\)/);
      const p = projektuj(Number(lat), Number(lon));
      const rect = pobierz('mapa-pozycja').getBoundingClientRect();
      const e = { pointerId: 999, clientX: p.x * Number(scale) + Number(tx) + rect.left,
        clientY: p.y * Number(scale) + Number(ty) + rect.top, preventDefault() {} };
      const svg = pobierz('mapa-pozycja-svg');
      for (const typ of ['pointerdown', 'pointerup']) for (const fn of svg.zdarzenia[typ] ?? []) fn({ ...e, type: typ });
    },
    elementy,
    pobierz,
    pamiec,
    utworzone,
    /** Hermetyczna sieć tej instancji: lista adresów, których test próbował. */
    siec: hermetycznaSiec,
    document: documentStub,
    window: windowStub,
    navigator: navigatorStub,
    zdarzeniaDokumentu,
    zdarzeniaOkna,
    /** Odpala nasłuch dokumentu (np. `visibilitychange`). */
    wyslijZdarzenieDokumentu(typ, zdarzenie = {}) {
      for (const fn of zdarzeniaDokumentu[typ] ?? []) fn({ type: typ, ...zdarzenie });
      return (zdarzeniaDokumentu[typ] ?? []).length;
    },
    /** Odpala nasłuch okna. */
    wyslijZdarzenieOkna(typ, zdarzenie = {}) {
      for (const fn of zdarzeniaOkna[typ] ?? []) fn({ type: typ, ...zdarzenie });
      return (zdarzeniaOkna[typ] ?? []).length;
    },
    /**
     * Wklejenie tekstu do pola: ustawia wartość i odpala `paste`, tak jak
     * przeglądarka po Ctrl+V albo „Wklej" z menu dotykowego. `clipboardData`
     * jest obecne, bo prawdziwe zdarzenie je niesie — kod produkcyjny czyta
     * treść stamtąd, nie z pola (w chwili `paste` pole jest jeszcze puste).
     */
    wklej(id, tekst) {
      const el = pobierz(id);
      el.value = tekst;
      const zdarzenie = {
        type: 'paste',
        target: el,
        currentTarget: el,
        clipboardData: { getData: () => tekst },
      };
      for (const fn of el.zdarzenia.paste ?? []) fn(zdarzenie);
      return (el.zdarzenia.paste ?? []).length;
    },
    /** Klik w element (wszystkie nasłuchy `click`). */
    kliknij(id) {
      const el = pobierz(id);
      for (const fn of el.zdarzenia.click ?? []) fn({ type: 'click', target: el, currentTarget: el });
      return (el.zdarzenia.click ?? []).length;
    },
    /** Karta w tle / na wierzchu (ADR 0004 pkt 1: pauza śledzenia). */
    ustawHidden(czyUkryty) {
      documentStub.hidden = Boolean(czyUkryty);
      documentStub.visibilityState = czyUkryty ? 'hidden' : 'visible';
    },
    /** Rozmiar elementu zwracany przez `getBoundingClientRect()` (panel mapy). */
    ustawProstokat(id, { width = 360, height = 320 } = {}) {
      prostokaty.set(id, { width, height, top: 0, left: 0, right: width, bottom: height });
      const el = elementy.get(id);
      if (el) el.getBoundingClientRect = () => ({ width, height, top: 0, left: 0, right: width, bottom: height });
      return prostokaty.get(id);
    },
    /** Podmiana `navigator.geolocation` bez reinstalacji całej atrapy. */
    ustawGeolokalizacje(atrapa) {
      navigatorStub.geolocation = atrapa;
    },
  };
}

/**
 * Atrapa `navigator.geolocation` z ręcznym sterowaniem: zapisuje wywołania,
 * a fixy i błędy wysyła się z testu.
 */
export function atrapaGeolokalizacji({ idWatcha = 42 } = {}) {
  const wywolania = { watch: 0, clear: [], opcje: null };
  let ostatniOk = null;
  let ostatniBlad = null;
  return {
    wywolania,
    geolocation: {
      watchPosition(ok, blad, opcje) {
        wywolania.watch += 1;
        wywolania.opcje = opcje;
        ostatniOk = ok;
        ostatniBlad = blad;
        return idWatcha;
      },
      clearWatch(id) { wywolania.clear.push(id); },
    },
    /** Udaje fix z przeglądarki. */
    wyslijFix(lat, lon, accuracy = 12, timestamp = 1000) {
      if (!ostatniOk) throw new Error('watchPosition nie został jeszcze wywołany');
      ostatniOk({ coords: { latitude: lat, longitude: lon, accuracy }, timestamp });
    },
    /** Udaje błąd z przeglądarki (kody 1/2/3 z `GeolocationPositionError`). */
    wyslijBlad(code = 1, message = 'atrapa błędu') {
      if (!ostatniBlad) throw new Error('watchPosition nie został jeszcze wywołany');
      ostatniBlad({ code, message });
    },
  };
}
