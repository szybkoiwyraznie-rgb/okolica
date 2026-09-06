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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Katalog repozytorium (o dwa poziomy wyżej niż ten plik: test/helpers/). */
export const KATALOG = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

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
        .map((d) => (d && typeof d.textContent === 'string' ? d.textContent : ''))
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
    appendChild(dziecko) { this.children.push(dziecko); return dziecko; },
    removeChild(dziecko) {
      const i = this.children.indexOf(dziecko);
      if (i >= 0) this.children.splice(i, 1);
      return dziecko;
    },
    /** Jak w przeglądarce (Chrome 86+): podmiana całej listy dzieci. */
    replaceChildren(...nowe) { this.children = [...nowe]; return undefined; },
    append(...wezel) { this.children.push(...wezel); return undefined; }, // jak Element.append (bez zwracania)
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
    querySelector() { return null; },
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
export function zainstalujDom({ sciezkaHtml = 'index.html', search = '', geolocation = undefined, pamiec = new Map() } = {}) {
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
      // Minimalna wierność: wzorzec '#id tag' — aplikacja czyta nim listę
      // imion ('#lista-imion input' w `czytajSetupZDomu`), a bez tego KAŻDA
      // nawigacja z setupu padała na K08 w atrapie. Pełnego silnika
      // selektorów do atrapy nie budujemy — inne wzorce dają [] jak dotąd.
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
    elementy,
    pobierz,
    pamiec,
    utworzone,
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
