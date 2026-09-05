/**
 * Test dymny aplikacji (app/app.js) na atrapie DOM.
 *
 * Moduły czyste mają własne testy, ale to `app.js` spina je z HTML-em — i to tu
 * psują się rzeczy niewidoczne dla reszty bramy: import nazwy, której moduł nie
 * eksportuje (aplikacja wtedy w ogóle nie wstaje), `null.checked` przy kluczu
 * spoza kanonu, brak nasłuchu na przycisku. Ten test uruchamia prawdziwy
 * bootstrap na minimalnej atrapie DOM i sprawdza stan początkowy ekranu.
 *
 * Atrapa jest celowo głupia: `querySelector` zwraca `null` (jak w pustym
 * kontenerze), `innerHTML` niczego nie parsuje. Kod, który tego nie przeżyje,
 * nie przeżyje też wolnego renderowania w przeglądarce.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WERSJA_PROTOKOLU } from '../app/protokol.js';
import { DOMYSLNE, TEMATY, TRYBY } from '../app/konfig.js';

/* ---------------------------------------------------------------- atrapa DOM */

const KATALOG = dirname(dirname(fileURLToPath(import.meta.url)));
const HTML = readFileSync(join(KATALOG, 'index.html'), 'utf8');

/** Atrapa nie parsuje HTML-a, więc stan początkowy `hidden` bierzemy z pliku. */
const UKRYTE_W_HTML = new Set(
  [...HTML.matchAll(/<[a-z]+[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => /\bhidden\b/.test(tag))
    .map((tag) => tag.match(/id="([^"]+)"/)?.[1])
    .filter(Boolean),
);

const elementy = new Map();

function stubElementu(id) {
  let wartosc = '';
  const el = {
    id,
    // jak w prawdziwym <input>: zapis liczby i tak czytany jest jako tekst —
    // atrapa, która tego nie robi, przepuściłaby porównania `value === 1000`
    get value() { return wartosc; },
    set value(v) { wartosc = v === null || v === undefined ? '' : String(v); },
    textContent: '',
    innerHTML: '',
    checked: false,
    disabled: false,
    hidden: UKRYTE_W_HTML.has(id),
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
    setAttribute(k, v) { this.dataset[`attr-${k}`] = v; },
    getAttribute(k) { return this.dataset[`attr-${k}`] ?? null; },
    removeAttribute(k) { delete this.dataset[`attr-${k}`]; },
    addEventListener(typ, fn) { (this.zdarzenia[typ] ??= []).push(fn); },
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    focus() {}, select() {}, setSelectionRange() {}, click() {}, scrollIntoView() {},
    remove() {}, insertAdjacentHTML() {}, closest() { return null; }, matches() { return false; },
  };
  return el;
}

function pobierz(id) {
  if (!elementy.has(id)) elementy.set(id, stubElementu(id));
  return elementy.get(id);
}

const dokumentZdarzenia = {};
globalThis.document = {
  documentElement: stubElementu('html'),
  body: stubElementu('body'),
  head: stubElementu('head'),
  getElementById: pobierz,
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement(typ) { return stubElementu(typ); },
  addEventListener(typ, fn) { (dokumentZdarzenia[typ] ??= []).push(fn); },
};

const oknoZdarzenia = {};
globalThis.window = {
  scrollTo() {},
  addEventListener(typ, fn) { (oknoZdarzenia[typ] ??= []).push(fn); },
  matchMedia() { return { matches: false, addEventListener() {}, addListener() {} }; },
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { clipboard: undefined, geolocation: undefined, userAgent: 'node-test', language: 'pl-PL' },
});
const pamiec = new Map();
globalThis.localStorage = {
  getItem: (k) => (pamiec.has(k) ? pamiec.get(k) : null),
  setItem: (k, v) => pamiec.set(k, String(v)),
  removeItem: (k) => pamiec.delete(k),
};
Object.defineProperty(globalThis, 'location', {
  configurable: true,
  value: { protocol: 'https:', search: '?tryb=test', href: 'https://przyklad.test/?tryb=test', host: 'przyklad.test' },
});
globalThis.matchMedia = globalThis.window.matchMedia;
globalThis.alert = () => {};
globalThis.Blob = class { constructor(czesci) { this.size = (czesci ?? []).join('').length; } };
globalThis.URL.createObjectURL = () => 'blob:test';
globalThis.URL.revokeObjectURL = () => {};

/* ------------------------------------------------------------ bootstrap */

// Import PO ustawieniu globali — app.js uruchamia start() przy wczytaniu.
await import('../app/app.js');

test('bootstrap: aplikacja startuje bez wyjątku na atrapie DOM', () => {
  assert.ok(elementy.size > 40, `aplikacja dotknęła tylko ${elementy.size} elementów — wygląda na urwany start`);
});

test('bootstrap: widoczny jest ekran setupu, reszta ukryta', () => {
  assert.equal(pobierz('ekran-setup').hidden, false, 'ekran setupu ma być widoczny na starcie');
  for (const ekran of ['pozycja', 'stacje', 'prompt', 'paczka']) {
    assert.equal(pobierz(`ekran-${ekran}`).hidden, true, `ekran ${ekran} ma być na starcie ukryty`);
  }
});

test('bootstrap: stopka pokazuje obowiązującą wersję protokołu', () => {
  assert.equal(pobierz('stopka-protokol').textContent, WERSJA_PROTOKOLU);
});

test('bootstrap: lista trybów i tematów jest wyrenderowana z kanonu', () => {
  assert.equal(pobierz('lista-trybow').children.length, Object.keys(TRYBY).length, 'trzy tryby ruchu');
  assert.equal(pobierz('lista-tematow').children.length, Object.keys(TEMATY).length, 'dziesięć tematów z kanonu');
});

test('bootstrap: pola setupu mają wartości domyślne z kanonu', () => {
  assert.equal(pobierz('setup-promien').value, String(TRYBY[DOMYSLNE.tryb].promienM));
  assert.equal(pobierz('setup-stacje').value, String(DOMYSLNE.liczbaStacji));
  assert.equal(pobierz('setup-pytania').value, String(DOMYSLNE.pytaniaNaStacje));
  assert.equal(pobierz('setup-gracze').value, String(DOMYSLNE.liczbaGraczy));
});

test('bootstrap: pasek stanu ma komunikat, a wynik walidacji zostaje schowany', () => {
  assert.ok(pobierz('status').textContent.length > 20, 'pasek stanu milczy po starcie');
  assert.equal(pobierz('przycisk-ukryj').hidden, true, 'nie ma przyjętej paczki — nie ma czego ukrywać');
  assert.equal(pobierz('wynik-walidacji').hidden, true, 'karta wyniku jest w HTML ukryta i bootstrap jej nie odsłania');
  assert.equal(pobierz('wynik-naglowek').textContent, '', 'żaden wynik nie został wyrenderowany przed wklejeniem paczki');
});

test('bootstrap: przyciski nawigacji mają nasłuch zdarzeń', () => {
  for (const id of ['przycisk-dalej-pozycja', 'przycisk-kopiuj-prompt', 'przycisk-sprawdz', 'przycisk-poprawka', 'przycisk-ukryj', 'przycisk-motyw', 'przycisk-kod', 'przycisk-przelicz']) {
    assert.ok(pobierz(id).zdarzenia.click?.length >= 1, `#${id} nie ma nasłuchu click — przycisk byłby martwy`);
  }
});

test('bootstrap: uszkodzona konfiguracja w localStorage nie kładzie startu', async () => {
  pamiec.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1',
    konfig: { tryb: 'konny', wiek: 'nestor', podklad: 'carto', tematy: ['kosmos'], liczbaGraczy: 'dużo', imiona: null, geokodacja: 'tak' },
  }));
  // ponowne wczytanie modułu z odświeżonym query — nowy egzemplarz, ten sam kod
  await import(`../app/app.js?powtorka=${Date.now()}`);
  assert.equal(pobierz('ekran-setup').hidden, false, 'aplikacja musi wystartować nawet na śmieciowym stanie');
  assert.ok(pobierz('status').textContent.length > 20);
});
