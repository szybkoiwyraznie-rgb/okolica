/**
 * Testy UI gry wieloosobowej (M11/P5): dwa „urządzenia" = dwie instalacje
 * atrapy DOM + dwa importy `app.js`, grające end-to-end przeciw atrapie mostu
 * Drive (lustrzanej wobec `docs/setup/apps-script-repo-paczek.gs`).
 *
 * Scenariusze (m12-74: przepisany flow właściciela 2026-09-11):
 *  - setup: rodzaj gry i ścieżka multi (załóż/dołącz) to SEGMENTY na setupie,
 *    tożsamość = imię+PIN z bloku „Kto gra?" (dokładnie jeden gracz);
 *  - załóż: Dalej → pozycja → PASUJĄCA paczka z telefonu (karta propozycji)
 *    → lobby; albo pełna ścieżka AI (stacje-sekret → wklejenie) → lobby;
 *  - dołącz: TYLKO z listy „Host: X" w zasięgu ~50 m (geohash8), bez kodów;
 *  - wyścig: start → droga offline z kolejką → wyniki po obu stronach;
 *  - wspólna trasa: ta sama trasa po kolei, każde tempo własne → resume po
 *    „odświeżeniu" telefonu (zamknięte stacje nie wracają) → wyniki;
 *    osobno start SOLO i koniec gry z ręki hosta;
 *  - odmowa bez potwierdzonego imienia (zero wysyłek), odrzucenie odpowiedzi
 *    bez dojścia (R08);
 *  - SKANER ciał POST: współrzędne GRACZA nigdy nie wychodzą (ADR 0019 pkt 3).
 *    Wyjątek celowy i jawny: `zestaw.stacje` w gra-zaloz — mapa gry jest
 *    współdzielona dokładnie tak jak paczka w repozytorium (ADR 0016/0017).
 *
 * Tryb `?odstep=0` daje synchronizacji RĘCZNY harmonogram (`harmonogramMulti`
 * w app.js): zero pollingu w tle, test sam pompuje kroki (`przepompuj`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync as czytajPlik } from 'node:fs';

import { zainstalujDom } from './helpers/dom.js';
import { WERSJA_PROTOKOLU, WERSJA_PROTOKOLU_REV3 } from '../app/protokol.js';
import { zapakujPaczke } from '../app/kodowanie.js';
import { zbierzMetaZestawu, zbudujPlikZestawu } from '../app/zestawy.js';
import { czyKompletna, generujKod, przeliczWyniki, zbudujZdarzenie } from '../app/wieloosobowa.js';
import { SCHEMAT_SIECI, kluczCacheSieci, parsujOdpowiedz, upraszczajDaneDoCache } from '../app/sieci.js';
import { promienZCzasuGry } from '../app/konfig.js';
import { polecenieMostu, utworzSynchronizacje } from '../app/sync.js';

const URL_MOSTU = 'https://script.google.com/macros/s/TEST/exec';
/** Pinezka testowa Podkowy (LESSONS: współrzędne testowe z M8) — wszystkie stacje w jej komórce geohash5. */
const PODKOWA = { lat: 52.12303, lon: 20.74614 };

/* ------------------------------------------------- atrapa mostu Drive */

const POLA_ZAKAZANE = ['lat', 'lon', 'szerokosc', 'dlugosc', 'latitude', 'longitude'];

/**
 * Lustro sekcji gier z `.gs` (te same reguły: lobby-only join, max 8, unikalny
 * pseudonim, start u organizatora, dojscie przed odpowiedzią, kasowanie
 * współrzędnych, `czyKompletna` → wyniki). Logikę wyników bierzemy z
 * `app/wieloosobowa.js` — parzystość moduł↔.gs pilnuje
 * `test/kontrakt.test.js`, więc atrapa nie może się rozjechać z produkcją.
 */
function atrapaMostu() {
  const gry = new Map(); // idGry → gra
  const ciala = [];      // surowe ciała POST-ów (skaner prywatności)
  const adresy = [];     // wszystkie URL-e (GET i POST)
  const profile = new Map(); // id → { pseudonim, pin } (lustro profil-* z .gs, ADR 0021)
  const most = {
    gry, ciala, adresy, profile,
    online: true,
    repoPakiet: null, // I.b: { url, indeks, plik } — repozytorium paczek dla organizatora
    znajdz: (kod) => [...gry.values()].find((g) => g.kod === String(kod).toUpperCase()) ?? null,
    fetchImpl: async (url, opcje = {}) => {
      adresy.push(String(url));
      if (!most.online) throw new TypeError('Failed to fetch');
      const json = (obiekt) => ({ ok: true, status: 200, json: async () => structuredClone(obiekt) });
      if ((opcje.method ?? 'GET') === 'POST') {
        const tekst = String(opcje.body ?? '');
        ciala.push(tekst);
        const dane = JSON.parse(tekst);
        switch (dane.akcja) {
          case 'gra-zaloz': return json(zaloz(dane));
          case 'gra-dolacz': return json(dolacz(dane));
          case 'gra-opusc': return json(opusc(dane));
          case 'gra-start': return json(start(dane));
          case 'gra-zdarzenie': return json(zdarzenie(dane));
          case 'gra-zakoncz': return json(zakoncz(dane));
          case 'profil-ustaw': return json(profilUstaw(dane));
          case 'profil-sprawdz': return json(profilSprawdz(dane));
          default: return json({ ok: false, blad: `nieznana akcja: ${dane.akcja}` });
        }
      }
      const params = new URL(String(url)).searchParams;
      const akcja = params.get('akcja');
      // I.b: jedno wdrożenie mostu wydaje też paczki (adresMostu woli URL
      // multi): indeks pod gołym adresem, plik przez ?akcja=paczka&id=….
      if (most.repoPakiet && (akcja === 'paczka' || params.toString() === '')) {
        const tekst = akcja === 'paczka' ? most.repoPakiet.plik : most.repoPakiet.indeks;
        return { ok: true, status: 200, text: async () => tekst };
      }
      if (akcja === 'gry') {
        // m12-74: tylko lobby (po starcie nie ma dołączania — właściciel,
        // 2026-09-11) i z geohash8 hosta (miara zasięgu ~50 m)
        const wpisy = [...gry.values()]
          .filter((g) => g.stan === 'lobby' && g.gracze.length < 8)
          .map((g) => ({
            idGry: g.idGry, tryb: g.tryb, stan: g.stan, miejsce: g.konfiguracja.miejsce,
            geohash5: g.konfiguracja.geohash5, geohash8: g.konfiguracja.geohash8,
            wiek: g.konfiguracja.wiek, tematy: g.konfiguracja.tematy,
            liczbaGraczy: g.gracze.length, utworzono: g.utworzono, organizator: g.gracze[0]?.pseudonim,
          }));
        return json({ schemat: 'RO-lobby/1', wpisy });
      }
      if (akcja === 'gra-stan') {
        const gra = znajdzGre(params.get('kod'), params.get('id'));
        return json(gra ? { ok: true, gra } : { ok: false, blad: 'nie ma takiej gry' });
      }
      return json({ ok: false, blad: `nieznana akcja GET: ${akcja}` });
    },
  };

  function profilUstaw(dane) {
    const pseudo = String(dane.pseudonim ?? '').trim().slice(0, 20);
    const pin = String(dane.pin ?? '');
    const id = pseudo.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    if (!id) return { ok: false, blad: 'R19' };
    if (!/^\d{4,8}$/.test(pin)) return { ok: false, blad: 'R20' };
    const jest = profile.get(id);
    if (jest) {
      if (jest.pin !== pin) return { ok: false, blad: 'R20' };
      return { ok: true, nowy: false, pseudonim: jest.pseudonim };
    }
    profile.set(id, { pseudonim: pseudo, pin });
    return { ok: true, nowy: true, pseudonim: pseudo };
  }
  function profilSprawdz(dane) {
    const id = String(dane.pseudonim ?? '').trim().toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    const jest = id ? profile.get(id) : null;
    if (!jest) return { ok: false, blad: 'R19' };
    if (jest.pin !== String(dane.pin ?? '')) return { ok: false, blad: 'R20' };
    return { ok: true, pseudonim: jest.pseudonim };
  }
  function znajdzGre(kod, idGry) {
    for (const g of gry.values()) {
      if (idGry && g.idGry === idGry) return g;
      if (kod && g.kod === String(kod).toUpperCase().replace(/[^A-Z0-9]/g, '')) return g;
    }
    return null;
  }
  function zaloz(dane) {
    if (dane.tryb !== 'trasa' && dane.tryb !== 'wyscig') return { ok: false, blad: 'tryb musi być trasa albo wyscig' };
    const pseudonim = String(dane.organizator?.pseudonim ?? '').trim();
    if (!pseudonim) return { ok: false, blad: 'pseudonim organizatora jest wymagany' };
    const k = dane.konfiguracja ?? {};
    if (!(k.liczbaStacji > 0) || !(k.pytaniaNaStacje > 0) || typeof k.wiek !== 'string'
      || !Array.isArray(k.tematy) || !k.tematy.length || typeof k.miejsce !== 'string'
      || typeof k.geohash5 !== 'string' || k.geohash5.length !== 5) {
      return { ok: false, blad: 'konfiguracja gry niekompletna' };
    }
    if (typeof k.geohash8 !== 'string' || k.geohash8.length !== 8) {
      return { ok: false, blad: 'konfiguracja wymaga geohash8 (8 znaków, pozycja hosta)' };
    }
    if (dane.trasaSekret !== undefined && typeof dane.trasaSekret !== 'boolean') {
      return { ok: false, blad: 'trasaSekret musi być true/false' };
    }
    const z = dane.zestaw ?? {};
    if (!Array.isArray(z.stacje) || !z.stacje.length || z.kontener?.schemat !== 'TO-paczka/2' || !z.meta) {
      return { ok: false, blad: 'zestaw gry wymaga stacji, kontenera TO-paczka/2 i metadanych' };
    }
    if (z.stacje.length !== k.liczbaStacji) return { ok: false, blad: 'liczba stacji zestawu nie zgadza się z konfiguracją' };
    const teraz = new Date().toISOString();
    const gra = {
      schemat: 'RO-gra/1', kod: generujKod(), idGry: `plik-${gry.size + 1}`, tryb: dane.tryb,
      trasaSekret: dane.trasaSekret === true,
      stan: 'lobby', utworzono: teraz, organizatorId: 'g-1',
      gracze: [{ id: 'g-1', pseudonim, dolaczyl: teraz }],
      konfiguracja: k, zestaw: { stacje: z.stacje, kontener: z.kontener, meta: z.meta },
      zdarzenia: [], wyniki: {},
    };
    gry.set(gra.idGry, gra);
    return { ok: true, gra: structuredClone(gra) };
  }
  /** Lustro `opuscGre` z .gs: wyjście z lobby prostuje skład gry. */
  function opusc(dane) {
    const gra = znajdzGre(dane.kod, dane.idGry);
    if (!gra) return { ok: false, blad: 'nie ma gry o takim kodzie/identyfikatorze' };
    if (gra.stan !== 'lobby') return { ok: false, blad: 'gra już wystartowała — wyjście w trakcie gry to rezygnacja, nie opuszczenie lobby' };
    const indeks = gra.gracze.findIndex((g) => g.id === String(dane.graczId ?? ''));
    if (indeks < 0) return { ok: false, blad: 'nie ma takiego gracza w tej grze' };
    if (indeks === 0) {
      gra.stan = 'archiwum';
      return { ok: true, zamknieta: true };
    }
    gra.gracze.splice(indeks, 1);
    return { ok: true, zamknieta: false, gra: structuredClone(gra) };
  }
  function dolacz(dane) {
    const pseudonim = String(dane.pseudonim ?? '').trim().slice(0, 24);
    if (!pseudonim) return { ok: false, blad: 'pseudonim jest wymagany' };
    const gra = znajdzGre(dane.kod, dane.idGry);
    if (!gra) return { ok: false, blad: 'nie ma gry o takim kodzie/identyfikatorze' };
    if (gra.stan !== 'lobby') return { ok: false, blad: 'dołączyć można tylko w lobby' };
    if (gra.gracze.length >= 8) return { ok: false, blad: 'gra jest pełna' };
    if (gra.gracze.some((g) => g.pseudonim === pseudonim)) return { ok: false, blad: 'ten pseudonim już gra' };
    const gracz = { id: `g-${gra.gracze.length + 1}`, pseudonim, dolaczyl: new Date().toISOString() };
    gra.gracze.push(gracz);
    return { ok: true, graczId: gracz.id, gra: structuredClone(gra) };
  }
  function start(dane) {
    const gra = znajdzGre(dane.kod, dane.idGry);
    if (!gra) return { ok: false, blad: 'nie ma takiej gry' };
    if (gra.stan !== 'lobby') return { ok: false, blad: `gra nie jest już w lobby (stan: ${gra.stan})` };
    if (String(dane.organizatorId) !== gra.organizatorId) return { ok: false, blad: 'tylko organizator może wystartować grę' };
    gra.stan = 'trwa';
    gra.zdarzenia.push({ kolejnosc: 1, graczId: gra.organizatorId, typ: 'start', stacjaId: null, dane: {}, tSerwera: new Date().toISOString() });
    return { ok: true, gra: structuredClone(gra) };
  }
  function zdarzenie(dane) {
    const z = dane.zdarzenie ?? {};
    if (z.schemat !== 'RO-zdarzenie/1') return { ok: false, blad: 'oczekiwałem zdarzenia RO-zdarzenie/1' };
    const gra = znajdzGre(z.kod, z.idGry);
    if (!gra) return { ok: false, blad: 'nie ma takiej gry' };
    if (gra.stan !== 'trwa') return { ok: false, blad: 'gra się nie toczy' };
    if (!gra.gracze.some((g) => g.id === z.graczId)) return { ok: false, blad: 'nie ma takiego gracza' };
    if (gra.zdarzenia.some((e) => e.graczId === z.graczId && e.typ === 'rezygnacja') && (z.typ === 'dojscie' || z.typ === 'odpowiedz')) {
      return { ok: false, blad: 'ten gracz zrezygnował' };
    }
    if (z.typ === 'dojscie' || z.typ === 'odpowiedz') {
      const n = Number(z.stacjaId);
      if (!(n >= 1 && n <= gra.konfiguracja.liczbaStacji)) return { ok: false, blad: 'stacjaId poza zakresem' };
      if (z.typ === 'odpowiedz') {
        if (!gra.zdarzenia.some((e) => e.typ === 'dojscie' && e.graczId === z.graczId && Number(e.stacjaId) === n)) {
          return { ok: false, blad: 'odpowiedź bez dojścia' };
        }
        if (gra.zdarzenia.some((e) => e.typ === 'odpowiedz' && e.graczId === z.graczId && Number(e.stacjaId) === n)) {
          return { ok: false, blad: 'ta stacja jest już odpowiedziana' };
        }
      }
    }
    const daneZdarzenia = { ...(z.dane ?? {}) };
    for (const pole of POLA_ZAKAZANE) delete daneZdarzenia[pole]; // współrzędne NIGDY (ADR 0019 pkt 3)
    gra.zdarzenia.push({
      kolejnosc: gra.zdarzenia.length + 1, graczId: z.graczId, typ: z.typ,
      stacjaId: z.stacjaId != null ? Number(z.stacjaId) : null, dane: daneZdarzenia,
      tSerwera: new Date().toISOString(),
    });
    // Lustro .gs (ADR 0019 aneks 2026-09-13, uwaga G): rezygnacja też domyka grę.
    if (z.typ !== 'koniec' && czyKompletna(gra)) {
      gra.stan = 'zakonczona'; // jak w moście: stan PRZED wynikami (premia, ADR 0027 pkt 5)
      gra.wyniki = przeliczWyniki(gra);
    }
    return { ok: true, kolejnosc: gra.zdarzenia.at(-1).kolejnosc, stan: gra.stan, wyniki: gra.wyniki };
  }
  function zakoncz(dane) {
    const gra = znajdzGre(dane.kod, dane.idGry);
    if (!gra) return { ok: false, blad: 'nie ma takiej gry' };
    if (String(dane.graczId) !== gra.organizatorId) return { ok: false, blad: 'tylko organizator może zakończyć' };
    gra.stan = 'zakonczona';
    gra.wyniki = przeliczWyniki(gra);
    return { ok: true, gra: structuredClone(gra) };
  }
  return most;
}

/* ------------------------------------------------- dwa urządzenia */

const oddech = () => new Promise((r) => setTimeout(r, 0));

function przelaczNa(u) {
  globalThis.document = u.globale.document;
  globalThis.window = u.globale.window;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: u.globale.navigator });
  globalThis.localStorage = u.globale.localStorage;
  Object.defineProperty(globalThis, 'location', { configurable: true, writable: true, value: u.globale.location });
}

async function noweUrzadzenie({ pamiec = new Map(), most, bezGracza = false }) {
  // Adres mostu nie jest wpisywany w UI (ADR 0020) — telefon ma go w pamięci albo w kodzie aplikacji.
  if (!pamiec.has('okolica:multi:url-mostu')) pamiec.set('okolica:multi:url-mostu', URL_MOSTU);
  globalThis.fetch = most.fetchImpl; // sync.js czyta globalThis.fetch (wstrzykiwalny fetchImpl)
  const dom = zainstalujDom({ search: '?tryb=test&odstep=0', pamiec, bezGracza });
  dom.window.fetch = most.fetchImpl; // app.js czyta window.fetch (LESSONS L18)
  const u = {
    dom, pamiec,
    globale: {
      document: globalThis.document, window: globalThis.window, navigator: globalThis.navigator,
      localStorage: globalThis.localStorage, location: globalThis.location,
    },
  };
  przelaczNa(u);
  await import(`../app/app.js?urz=${Math.random()}`); // świeży egzemplarz aplikacji = świeży STAN
  return u;
}

/**
 * Koniec gry jak z aplikacji (ADR 0043): ikona ⚙ START GRY otwiera warstwę,
 * wpisanie TAK odblokowuje przycisk, klik kończy grę. Przycisków „⏹ Zakończ
 * grę (host)" i „🏳 Rezygnuję z gry" NIE MA (uwaga F, ADR 0044).
 */
async function potwierdzKoniecGry(u) {
  await klik(u, 'przycisk-setup');
  assert.equal(el(u, 'ekran-koniec-gry').hidden, false, '⚙ otwiera warstwę potwierdzenia');
  przelaczNa(u);
  u.dom.wpisz('koniec-gry-potwierdzenie', 'tak');
  await oddech();
  assert.equal(el(u, 'przycisk-koniec-gry').disabled, false, 'wpisane TAK odblokowuje przycisk');
  await klik(u, 'przycisk-koniec-gry');
}

/** Ustawia wartość pola (bez zdarzenia) — jak wpisanie palcem. */
function ustaw(u, id, wartosc) { przelaczNa(u); u.dom.pobierz(id).value = wartosc; }
function kliknijEl(el) { for (const fn of el.zdarzenia.click ?? []) fn({ type: 'click', target: el, currentTarget: el }); }
async function klik(u, id) { przelaczNa(u); u.dom.kliknij(id); await oddech(); }

/**
 * ADR 0029: dojście rozstrzyga wyłącznie strumień fixów, więc testy nie mają już
 * „ręcznego" przycisku — karmią aplikację symulacją, która idzie przez ten sam
 * `przyjmijFix` co GPS. Czekamy aktywnie na skutek (panel drogi znika), więc
 * brak dojścia wywala test zamiast po cichu sprawdzać coś dalej.
 */
/**
 * W trybie testowym nie ma GPS, a po wznowieniu gry wieloosobowej pozycja nie
 * wraca z mostu — współrzędne z zasady nie opuszczają telefonu (ADR 0013), więc
 * w prawdziwej grze daje je watcher wznowiony przez `uruchomGreMulti`. Tu gracz
 * po prostu wie, gdzie jest, czyli wpisuje współrzędne jak na ekranie pozycji.
 */
async function ustawPozycjeTestowa(u, { lat = PODKOWA.lat, lon = PODKOWA.lon } = {}) {
  przelaczNa(u);
  u.dom.ustawPozycje(lat, lon);
  await oddech();
}

async function dojdzSymulacja(u, { maksMs = 5000 } = {}) {
  await klik(u, 'przycisk-symulacja-gra');
  const start = Date.now();
  while (el(u, 'gra-panel-odcinek').hidden === false) {
    if (Date.now() - start > maksMs) {
      throw new Error(`symulacja nie domknęła dojścia w ${maksMs} ms — status: ${tekst(u, 'status')}`);
    }
    await new Promise((r) => setTimeout(r, 40));
  }
}
async function zmien(u, id) {
  przelaczNa(u);
  const el = u.dom.pobierz(id);
  for (const fn of el.zdarzenia.change ?? []) fn({ type: 'change', target: el, currentTarget: el });
  await oddech();
}
function tekst(u, id) { przelaczNa(u); return u.dom.pobierz(id).textContent; }
function el(u, id) { przelaczNa(u); return u.dom.pobierz(id); }

/** Czeka (aktywnie, z timeoutem) na warunek — jak dojdzSymulacja, ale ogólnie. */
async function czekajNa(u, warunek, opis, maksMs = 5000) {
  const start = Date.now();
  while (!warunek()) {
    if (Date.now() - start > maksMs) throw new Error(`${opis} nie nastąpiło w ${maksMs} ms — status: ${tekst(u, 'status')}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** Zaznacza opcję segmentu (radio w etykiecie) i odpala change kontenera.
 *  Atrapa DOM nie grupuje radiów (przeglądarka odznacza siostra sama), więc
 *  zdejmujemy „checked” z pozostanych opcji ręcznie. */
async function wybierzSegment(u, id, wartosc) {
  przelaczNa(u);
  const inputy = [...u.dom.pobierz(id).children].flatMap((etykieta) => [...(etykieta?.children ?? [])]);
  const input = inputy.find((i) => i?.value === wartosc);
  assert.ok(input, `segment #${id} ma opcję „${wartosc}”`);
  for (const i of inputy) if (i?.checked !== undefined) i.checked = false;
  input.checked = true;
  for (const fn of u.dom.pobierz(id).zdarzenia.change ?? []) fn({ type: 'change', target: input });
  await oddech();
}

/** Wpisuje liczbę w pole setupu Z zdarzeniem input (STAN musi ją zobaczyć). */
async function wpiszLiczbe(u, id, wartosc) {
  przelaczNa(u);
  const pole = u.dom.pobierz(id);
  pole.value = wartosc;
  for (const fn of pole.zdarzenia.input ?? []) fn({ type: 'input', target: pole });
  await oddech();
}

/** Tożsamość m12-74: imię+PIN w bloku „Kto gra?” — jedno wołanie profil-ustaw. */
async function dodajGraczaUI(u, pseudonim, pin = '1234') {
  przelaczNa(u);
  u.dom.pobierz('profil-pseudonim').value = pseudonim;
  u.dom.pobierz('profil-pin').value = pin;
  await klik(u, 'przycisk-dodaj-gracza');
  await czekajNa(u, () => el(u, 'lista-graczy').children.length > 0, `gracz ${pseudonim} na liście`);
}

/** Pompuje N kroków synchronizacji urządzenia (ręczny harmonogram z `?odstep=0`). */
async function przepompuj(u, ile = 1) {
  for (let i = 0; i < ile; i += 1) {
    przelaczNa(u);
    const timery = u.globale.window.__MULTI_TIMERY__;
    if (!timery) return;
    const idx = timery.map((f, k) => (f ? k : -1)).filter((k) => k >= 0).at(-1);
    if (idx === undefined || idx < 0) return;
    const fn = timery[idx];
    timery[idx] = null;
    await fn();
    await oddech();
  }
}

/* ------------------------------------------------- fixtures: zestaw paczki */

function stacjeTestowe(ile) {
  return Array.from({ length: ile }, (_, i) => ({
    id: i + 1, lat: PODKOWA.lat + i * 0.0004, lon: PODKOWA.lon + i * 0.0004, opis: `Stacja ${i + 1} (test)`,
  }));
}

function paczkaTestowa(stacje, pytaniaNaStacje = 1, { factcheck = true } = {}) {
  return {
    protokol: factcheck ? WERSJA_PROTOKOLU : WERSJA_PROTOKOLU_REV3,
    okolica: { lat: stacje[0].lat, lon: stacje[0].lon, promienM: 1000, miejsce: 'Podkowa Leśna' },
    wiek: 'dorosli', tematy: ['historia'], jezyk: 'polski', utworzono: '2026-09-06 10:00',
    pytania: stacje.flatMap((s) => Array.from({ length: pytaniaNaStacje }, (_, k) => ({
      id: `s${s.id}p${k + 1}`, stacja: s.id, temat: 'historia',
      tresc: `Co wydarzyło się przy stacji ${s.id}? (wariant ${k + 1})`,
      odpowiedzi: ['to', 'tamto', 'owo', 'nic'], poprawna: 0,
      wyjasnienie: 'Bo tak wynika ze źródeł.',
      zrodla: [{ url: 'https://pl.wikipedia.org/wiki/Podkowa_Le%C5%9Bna', tytul: 'Podkowa Leśna — Wikipedia', sprawdzono: '2026-09-06' }],
      punkty: 20,
    }))),
  };
}

/** Paczka w repozytorium mostu (indeks + plik) — organizator bierze ją z listy (I.b). */
function zasiejZestaw(most, ileStacji, pytaniaNaStacje = 1, { factcheck = true } = {}) {
  const stacje = stacjeTestowe(ileStacji);
  const kontener = zapakujPaczke(paczkaTestowa(stacje, pytaniaNaStacje, { factcheck }), factcheck ? WERSJA_PROTOKOLU : WERSJA_PROTOKOLU_REV3);
  const meta = zbierzMetaZestawu({
    lat: PODKOWA.lat, lon: PODKOWA.lon,
    // ADR 0046: promień jest kryterium dopasowania (równość), więc fixtura
    // liczy promień TAK SAMO jak setup telefonu (multi: pytaniaNaStacje=1,
    // 60 min, piesza). Pole meta `pytaniaNaStacje` zostaje z parametru zasiewu
    // — paczka może mieć WIĘCEJ pytań niż setup (nadmiar nie przeszkadza).
    promienM: promienZCzasuGry({ czasGryMin: 60, tryb: 'piesza', liczbaStacji: stacje.length, pytaniaNaStacje: 1 }),
    tematy: ['historia'], wiek: 'dorosli',
    jezyk: 'polski', miejsce: 'Podkowa Leśna', liczbaStacji: stacje.length, pytaniaNaStacje,
    data: '2026-09-06 09:00', factcheck,
  });
  const plik = zbudujPlikZestawu({ stacje, kontener, meta });
  most.repoPakiet = {
    indeks: JSON.stringify({ schemat: 'TO-indeks/1', wpisy: [{ ...meta, licencja: 'CC BY-SA 4.0', id: `repo-${kontener.skrot}` }] }),
    plik: JSON.stringify(plik),
  };
  return { stacje, kontener, meta };
}

/** Kod jedynej gry na moście (lobby nie pokazuje już kodu — m12-74). */
function kodGry(most) {
  const gry = [...most.gry.values()];
  assert.equal(gry.length, 1, 'na moście jest dokładnie jedna gra');
  return gry[0].kod;
}

/**
 * Telefon gotowy do gry multi (m12-74): rodzaj gry „Wielu graczy” na setupie,
 * dokładnie JEDEN potwierdzony gracz (imię+PIN), liczba stacji pod paczkę
 * (propozycje na ekranie pozycji dopasowują się po liczbie pytań) i pozycja.
 */
async function przygotujTelefon(u, pseudonim, { stacje = 2 } = {}) {
  await wybierzSegment(u, 'lista-rodzajow', 'multi');
  assert.equal(el(u, 'karta-multi').hidden, false, 'karta multi widoczna po wyborze rodzaju');
  await wpiszLiczbe(u, 'setup-stacje', String(stacje));
  await dodajGraczaUI(u, pseudonim);
  await ustawPozycjeTestowa(u);
}

/**
 * Zakłada grę przez nowy flow: setup (tryb) → „Dalej: moja pozycja” →
 * PASUJĄCA paczka z repozytorium („▶ Graj z tą paczką”) → lobby.
 */
async function zalozGreUI(u, { tryb = 'wyscig', sekret = null } = {}) {
  przelaczNa(u);
  const etykietaTrybu = tryb === 'trasa' ? 'Wspólna Trasa' : 'Wyścig na Orientację';
  const przyciskTrybu = [...u.dom.pobierz('multi-tryby').children].find((b) => b.textContent.includes(etykietaTrybu));
  assert.ok(przyciskTrybu, `przycisk trybu „${etykietaTrybu}” w segmencie`);
  kliknijEl(przyciskTrybu);
  await oddech();
  if (sekret !== null) {
    przelaczNa(u);
    const ptaszek = u.dom.pobierz('multi-trasa-sekret');
    ptaszek.checked = sekret;
    for (const fn of ptaszek.zdarzenia.change ?? []) fn({ type: 'change', target: ptaszek });
    await oddech();
  }
  await klik(u, 'przycisk-dalej-pozycja');
  assert.equal(el(u, 'ekran-pozycja').hidden, false, 'Dalej prowadzi na ekran pozycji');
  // karta propozycji: paczka z repo musi się dopasować (m12-74: paczka PRZED lobby)
  await czekajNa(u, () => el(u, 'zestawy-lista').children.length > 0, 'paczka z repozytorium w propozycjach');
  const wiersz = el(u, 'zestawy-lista').children[0];
  const przyciskPaczki = [...wiersz.children].at(-1);
  assert.match(przyciskPaczki.textContent, /Graj z tą paczką/);
  przelaczNa(u);
  kliknijEl(przyciskPaczki);
  await czekajNa(u, () => el(u, 'multi-panel-lobby').hidden === false, 'lobby po paczce');
}

/** Dołącza z listy gier w zasięgu ~50 m (m12-75: lista od razu na setupie). */
async function dolaczZListyUI(u) {
  await wybierzSegment(u, 'multi-sciezka', 'dolacz');
  // m12-75 (właściciel, uwagi terenowe #3): bez ekranu multi — lista gier ~50 m
  // pokazuje się od razu na setupie, pod „Kto gra?”, a opcje hosta znikają.
  assert.equal(el(u, 'multi-panel-dolacz').hidden, false, 'panel „Dołączam” otwarty na setupie');
  assert.equal(el(u, 'pole-tematy').hidden, true, 'tematy schowane dla dołączającego');
  assert.equal(el(u, 'przycisk-dalej-pozycja').hidden, true, 'dolny przycisk znika — dalej wiodą „Dołącz” z listy');
  await czekajNa(u, () => el(u, 'multi-lobby-lista').children.length > 0, 'lista gier w zasięgu ~50 m');
  const wiersz = el(u, 'multi-lobby-lista').children[0];
  assert.match(wiersz.children[0].textContent, /^Host: /, 'wpis pokazuje tylko hosta');
  przelaczNa(u);
  kliknijEl(wiersz.children[1]); // „Dołącz”
  await czekajNa(u, () => el(u, 'multi-panel-lobby').hidden === false, 'gość w lobby');
}

/** Odcinek od startu do „następna stacja": droga + dojście z fixów (ADR 0029) + poprawna odpowiedź. */
async function przejdzStacje(u) {
  // 2026-09-14 F: wyścig auto-startuje odcinek, więc panel oczekiwania może być już schowany
  const panelOczekuje = u.dom.elementy.get('gra-panel-oczekuje');
  if (panelOczekuje && !panelOczekuje.hidden) {
    await klik(u, 'przycisk-start-odcinka');
  }
  assert.equal(el(u, 'gra-panel-odcinek').hidden, false, 'panel drogi widoczny');
  await dojdzSymulacja(u); // POST dojscie (trybDojscia: gps)
  przelaczNa(u);
  const odpowiedzi = u.dom.pobierz('gra-odpowiedzi').children;
  assert.ok(odpowiedzi.length === 4, 'pytanie odsłonięte z czterema odpowiedziami');
  kliknijEl(odpowiedzi[0]); // poprawna (fixture: poprawna === 0) → POST odpowiedz
  await oddech();
  await klik(u, 'przycisk-nastepna-stacja');
}

/* ------------------------------------------------- scenariusze */

const mostWyscig = atrapaMostu();
let kodWyscigu = null;

test('wyścig end-to-end: załóż (paczka przed lobby) → dołącz z listy → start → droga offline z kolejką → wyniki', async () => {
  // urządzenie A: organizator — setup multi, tryb wyścig, paczka z repozytorium
  const pamiecA = new Map();
  zasiejZestaw(mostWyscig, 3);
  const A = await noweUrzadzenie({ pamiec: pamiecA, most: mostWyscig, bezGracza: true });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'wyscig' });
  kodWyscigu = kodGry(mostWyscig);
  assert.equal(el(A, 'przycisk-lobby-start').hidden, false, 'organizator widzi przycisk startu');
  assert.match(tekst(A, 'lobby-tryb'), /Wyścig/, 'tryb widoczny w lobby');
  assert.equal(A.dom.elementy.has('przycisk-multi-zakoncz'), false,
    'przycisku „Zakończ grę (host)" nie ma — grę kończy ikona ⚙ START GRY (uwagi F i H1)');

  // urządzenie B: gość dołącza Z LISTY gier w zasięgu ~50 m (bez kodu)
  const B = await noweUrzadzenie({ most: mostWyscig, bezGracza: true });
  await przygotujTelefon(B, 'Bartek');
  await dolaczZListyUI(B);
  assert.match(tekst(B, 'lobby-tryb'), /Wyścig/, 'gość widzi opcje gry (bez pytań i stacji — tylko ilość)');
  assert.equal(el(B, 'przycisk-lobby-start').hidden, true, 'gość NIE widzi przycisku startu');

  // A widzi Bartka po odświeżeniu stanu (ręczny polling)
  await przepompuj(A, 1);
  assert.equal(el(A, 'lobby-gracze').children.length, 2, 'lobby pokazuje dwoje graczy');

  // start u organizatora → A od razu w grze, B dowiaduje się pollingiem
  await klik(A, 'przycisk-lobby-start');
  assert.equal(el(A, 'ekran-gra').hidden, false, 'organizator na ekranie gry');
  // uwaga F (ADR 0044): sygnał i odliczanie na środku, nad przezroczystym tłem
  assert.equal(el(A, 'odliczanie').hidden, false, 'host widzi odliczanie startu');
  assert.match(tekst(A, 'odliczanie-cyfra'), /^[54321]$|^START$/, 'wielka cyfra na środku ekranu');
  assert.ok(A.dom.wibracje.length >= 1, 'krok odliczania daje sygnał: dźwięk i wibrację (ADR 0041)');
  assert.equal(A.dom.elementy.has('gra-panel-multi'), false,
    'panelu multi NIE MA — po starcie gra wygląda jak hotseat');
  // uwaga D (2026-09-14): w wyścigu KAŻDA stacja jest dobra, więc żadna nie
  // jest „bieżącą” — inny kolor mają TYLKO stacje zamknięte przez gracza.
  const pinezkiWyscig = A.dom.pobierz('mapa-gra-pinezki');
  assert.ok(pinezkiWyscig.children.length >= 3, 'wyścig: wszystkie stacje widoczne');
  assert.equal(pinezkiWyscig.children.some((g) => String(g.getAttribute('class')).includes('pinezka-aktywna')), false,
    'wyścig: żadna pinezka nie jest „aktywna” (uwaga D)');
  await przepompuj(B, 1);
  assert.equal(el(B, 'ekran-gra').hidden, false, 'gość wystartował po odświeżeniu stanu');
  assert.equal(el(B, 'odliczanie').hidden, false, 'gość też odlicza — start jest wspólny');
  assert.ok(B.dom.wibracje.length >= 1, 'sygnał startu także u gościa');

  // stacja 1: A online, B OFFLINE — zdarzenia lądują w kolejce i wychodzą po powrocie
  await przejdzStacje(A);
  mostWyscig.online = false;
  await klik(B, 'przycisk-start-odcinka');
  await dojdzSymulacja(B); // nie wyjdzie — kolejka
  przelaczNa(B);
  kliknijEl(B.dom.pobierz('gra-odpowiedzi').children[0]);
  await oddech();
  // Pasek synchronizacji został TYLKO w lobby (uwaga F) — w grze go nie ma,
  // ale kolejka offline musi być widoczna w statusie gracza.
  assert.match(tekst(B, 'multi-sync-pasek'), /2 zdarzeń czeka w kolejce/, 'pasek lobby mówi o kolejce offline');
  assert.match(tekst(B, 'status'), /kolejce/, 'gracz wie, że zdarzenia czekają');
  mostWyscig.online = true;
  await przepompuj(B, 1); // krok: stan + flush kolejki (FIFO)
  const zdarzeniaB = mostWyscig.znajdz(kodWyscigu).zdarzenia.filter((z) => z.graczId === 'g-2');
  assert.deepEqual(zdarzeniaB.map((z) => z.typ), ['dojscie', 'odpowiedz'], 'kolejka wyszła w kolejności FIFO');
  await klik(B, 'przycisk-nastepna-stacja');

  // Kanału info NIE MA (uwaga F: „bezużyteczne informacje przyklejone pod
  // paskiem") — zdarzenia i tak są w moście (sprawdzone wyżej po flushu kolejki),
  // a wynik widać na ekranie końca gry i w rankingu.
  await przepompuj(A, 1);
  assert.equal(A.dom.elementy.has('multi-info-lista'), false, 'kanału info nie ma (ADR 0044)');

  // stacje 2–3: oboje online — po ostatniej odpowiedzi serwer domyka grę
  await przejdzStacje(A);
  await przejdzStacje(A); // A kończy swój zestaw → lokalny ekran wyniku
  await przepompuj(B, 1);
  await przejdzStacje(B);
  await przejdzStacje(B); // ostatnia odpowiedź → czyKompletna → stan 'zakonczona'
  assert.equal(mostWyscig.znajdz(kodWyscigu).stan, 'zakonczona', 'serwer zamknął grę po wszystkich odpowiedziach');
  await przepompuj(A, 1);
  await przepompuj(B, 1);

  // wyniki po obu stronach: ten sam MINIMALNY ekran końca gry co w hotseat
  // (ADR 0038), ale z liczbami z mostu — punkty wszystkich graczy z premią.
  for (const [nazwa, u] of [['A', A], ['B', B]]) {
    const wiersze = el(u, 'gra-wyniki-tbody').children;
    assert.equal(wiersze.length, 2, `${nazwa}: tabela końca gry ma dwa wiersze`);
    assert.match(wiersze[0].textContent, /Ala|Bartek/, `${nazwa}: pseudonimy w tabeli`);
    assert.match(tekst(u, 'multi-sync-pasek'), /odświeżanie zatrzymane/, `${nazwa}: polling staje po zakończeniu`);
  }
  const wyniki = mostWyscig.znajdz(kodWyscigu).wyniki;
  assert.equal(wyniki['g-1'].stacjeZamkniete, 3, 'Ala zamknęła 3 stacje');
  assert.equal(wyniki['g-2'].stacjeZamkniete, 3, 'Bartek zamknął 3 stacje (w tym z kolejki offline)');
  assert.equal(wyniki['g-1'].poprawne, 3, 'wszystkie odpowiedzi Ali poprawne');
  // premia za kolejność ukończenia: pula = grający − 1 (uwaga L, ADR 0027 aneks
  // 2026-09-13) — dwóch grających gra o 1 pkt, drugi dostaje zero.
  assert.equal(wyniki['g-1'].premia, 1, 'Ala skończyła pierwsza: premia 1 (2 grających → pula 1)');
  assert.equal(wyniki['g-2'].premia, 0, 'Bartek drugi: premia 0');
  assert.equal(wyniki['g-1'].punkty, 4, 'podsumowanie: 3 pkt z odpowiedzi + premia 1');
  assert.equal(wyniki['g-2'].punkty, 3, 'Bartek: 3 pkt + premia 0');
  // tabela na obu telefonach: trzy kolumny (gracz | punkty | poprawne) — premia
  // jest JUŻ w punktach (4 = 3 odpowiedzi + 1), a doklejonych kolumn nie ma
  for (const [nazwa, u] of [['A', A], ['B', B]]) {
    const wiersze = [...el(u, 'gra-wyniki-tbody').children];
    assert.equal(wiersze[0].children.length, 3, `${nazwa}: gracz | punkty | poprawne (ADR 0038)`);
    assert.match(wiersze[0].textContent, /Ala.*4.*3\/3/, `${nazwa}: Ala pierwsza — 3 odpowiedzi + premia 1 = 4 pkt`);
    assert.match(wiersze[1].textContent, /Bartek.*3.*3\/3/, `${nazwa}: Bartek drugi — 3 pkt, premia 0`);
    assert.match(tekst(u, 'gra-wynik-zwyciezca'), /Ala/, `${nazwa}: karta zwycięzcy z punktacji mostu`);
  }
});

const mostTrasy = atrapaMostu();
let kodTrasy = null;

test('trasa end-to-end: dołącz z listy → wspólna trasa po kolei → resume po odświeżeniu → wyniki', async () => {
  // A zakłada Wspólną Trasę na 4 stacje: obaj gracze przechodzą WSZYSTKIE,
  // po kolei, każde we własnym tempie (właściciel, 2026-09-11).
  const pamiecA = new Map();
  zasiejZestaw(mostTrasy, 4);
  const A = await noweUrzadzenie({ pamiec: pamiecA, most: mostTrasy, bezGracza: true });
  await przygotujTelefon(A, 'Celina', { stacje: 4 });
  await zalozGreUI(A, { tryb: 'trasa' });
  assert.match(tekst(A, 'lobby-tryb'), /Wspólna Trasa/, 'lobby nazywa tryb');
  assert.match(tekst(A, 'lobby-tryb'), /tylko kolejna stacja/, 'lobby mówi o trasa-sekret (domyślnie ✓)');
  assert.equal(mostTrasy.znajdz(kodGry(mostTrasy)).trasaSekret, true, 'sekret zapisany w grze na moście');
  kodTrasy = kodGry(mostTrasy);

  // B dołącza Z LISTY (~50 m, bez kodu — m12-74)
  const pamiecB = new Map();
  const B = await noweUrzadzenie({ pamiec: pamiecB, most: mostTrasy, bezGracza: true });
  await przygotujTelefon(B, 'Czarek');
  await dolaczZListyUI(B);
  assert.match(tekst(B, 'lobby-tryb'), /Wspólna Trasa.*tylko kolejna stacja/, 'opcje gry z sekretem u gościa');

  await klik(A, 'przycisk-lobby-start');
  await przepompuj(B, 1);
  assert.equal(el(B, 'ekran-gra').hidden, false, 'B wystartował');
  assert.equal(tekst(B, 'gra-postep'), 'stacja 1 z 4', 'trasa: B ma przed sobą wszystkie 4 stacje');
  assert.equal(B.dom.elementy.has('multi-wybor-stacji'), false, 'trasa: warstwa wyboru usunięta (F) — kolejność narzuca trasa');
  assert.equal(B.dom.elementy.has('gra-multi-tura'), false,
    'komunikatu trybu w grze nie ma — tryb mówi lobby, a w grze jest jak w hotseat (uwaga F)');

  // Nikt na nikogo nie czeka: B zamyka stację 1, a A w tym czasie dopiero RUSZA
  // swoją stację 1 (to ta sama stacja, ale w własnym tempie każdego gracza).
  await przejdzStacje(B);
  await klik(A, 'przycisk-start-odcinka');
  assert.equal(el(A, 'gra-panel-odcinek').hidden, false, 'A nie czeka na B — tempo własne');
  await dojdzSymulacja(A);
  przelaczNa(A);
  kliknijEl(A.dom.pobierz('gra-odpowiedzi').children[0]);
  await oddech();
  await klik(A, 'przycisk-nastepna-stacja');
  assert.equal(tekst(A, 'gra-postep'), 'stacja 2 z 4', 'A idzie do stacji 2 — kolejność po kolei');

  // RESUME (uwaga K, ADR 0045): telefon B „odświeżony” (nowa instalacja DOM, TA
  // SAMA pamięć) wraca do gry SAM — karty „↩ Wróć do gry" nie ma i nie ma kliku.
  const B2 = await noweUrzadzenie({ pamiec: pamiecB, most: mostTrasy, bezGracza: true });
  przelaczNa(B2);
  await oddech();
  await oddech();
  assert.equal(el(B2, 'ekran-gra').hidden, false, 'powrót prosto do gry, bez banera i bez kliku');
  assert.equal(el(B2, 'ekran-start').hidden, true, 'powrót do gry pomija okno startowe');
  assert.match(tekst(B2, 'status'), /wracasz do gry w połowie drogi/,
    'status mówi, że to powrót, a nie nowa gra');
  assert.equal(el(B2, 'odliczanie').hidden, true,
    'powrót po odświeżeniu telefonu NIE odlicza — to nie jest start gry (ADR 0044)');
  // Zgłoszenie terenowe N (2026-09-13): zamknięta stacja 1 nie wraca do trasy,
  // ale numeracja zostaje — cel B2 to WCIĄŻ stacja 2, a licznik pokazuje pełną
  // trasę (4), nie skróconą listę telefonu. Wcześniej panel mówił „stacja 1 z 3".
  assert.equal(tekst(B2, 'gra-postep'), 'stacja 2 z 4', 'po powrocie cel ma swój numer na trasie, a licznik — pełną trasę');
  // Pytanie właściciela do zgłoszenia N (2026-09-13): „punkty zachowane przy
  // graczach?”. W grze sieciowej punkty liczy MOST z dziennika zdarzeń
  // (ADR 0019 pkt 6, `przeliczWyniki`), a lokalnego snapshotu gry multi nie ma
  // wcale (`zapiszGre` wychodzi przy `STAN.multi`) — więc odświeżenie telefonu
  // nie ma czego zgubić: odpowiedź B ze stacji 1 jest już na moście.
  const odpowiedziB = mostTrasy.znajdz(kodTrasy).zdarzenia
    .filter((z) => z.typ === 'odpowiedz' && z.graczId === 'g-2');
  assert.equal(odpowiedziB.length, 1, 'odpowiedź B ze stacji 1 doszła na most PRZED odświeżeniem');
  assert.equal(odpowiedziB[0].dane.punktyRazem, 1, 'most zapisał punkt B (nie telefon)');
  await ustawPozycjeTestowa(B2); // świeży telefon: GPS brak, więc pozycja z ekranu 2

  // A i B2 domykają resztę trasy (po kolei, każdy u siebie) → gra kompletna
  await przejdzStacje(A);
  await przejdzStacje(A);
  await przejdzStacje(A);
  await przejdzStacje(B2);
  await przejdzStacje(B2);
  await przejdzStacje(B2);
  assert.equal(mostTrasy.znajdz(kodTrasy).stan, 'zakonczona', 'trasa domknięta: obaj przeszli wszystkie stacje');
  await przepompuj(A, 1);
  await przepompuj(B2, 1);
  const wyniki = mostTrasy.znajdz(kodTrasy).wyniki;
  assert.deepEqual([wyniki['g-1'].stacjeZamkniete, wyniki['g-2'].stacjeZamkniete], [4, 4], 'po cztery stacje na gracza');
  // Punktacja per gracz z mostu: `punkty` zawierają premię za kolejność
  // (ADR 0044), więc porównujemy punkty z odpowiedzi (`punkty − premia`)
  // i liczbę poprawnych — w tym punkt B zdobyty PRZED odświeżeniem telefonu.
  assert.deepEqual(
    [wyniki['g-1'].punkty - wyniki['g-1'].premia, wyniki['g-2'].punkty - wyniki['g-2'].premia],
    [4, 4], 'po cztery punkty z odpowiedzi na gracza — punkt B sprzed reloadu nie zginął');
  assert.deepEqual([wyniki['g-1'].poprawne, wyniki['g-2'].poprawne], [4, 4],
    'cztery poprawne odpowiedzi na gracza, w tym ta sprzed odświeżenia');
  for (const u of [A, B2]) {
    assert.equal(el(u, 'gra-wyniki-tbody').children.length, 2, 'tabela końca gry po obu stronach (ADR 0038)');
    assert.match(tekst(u, 'multi-sync-pasek'), /odświeżanie zatrzymane/, 'synchronizacja zatrzymana');
  }
  // Telefon B widzi w tabeli WŁASNE punkty z mostu — razem z tym sprzed reloadu.
  const wierszB = [...el(B2, 'gra-wyniki-tbody').children]
    .find((w) => /Czarek \(Ty\)/.test(w.children[0].textContent));
  assert.ok(wierszB, 'B ma swój wiersz w tabeli końca gry');
  assert.equal(Number(wierszB.children[1].textContent), wyniki['g-2'].punkty,
    'punkty B w tabeli = punkty z mostu (z premią za kolejność)');

  assert.equal(pamiecB.has('okolica:multi:sesja'), false,
    'po zakończeniu gry sesja wyczyszczona — następne otwarcie nie wraca do skończonej gry (ADR 0045)');
  assert.equal(mostTrasy.znajdz(kodTrasy).zdarzenia.every((z) => !POLA_ZAKAZANE.some((pz) => pz in (z.dane ?? {}))), true, 'serwer nie przyjął współrzędnych w zdarzeniach');
});

test('start SOLO: organizator wystartuje grę z jednym graczem i sam ją domyka', async () => {
  const most = atrapaMostu();
  const pamiec = new Map();
  zasiejZestaw(most, 3);
  const A = await noweUrzadzenie({ pamiec, most, bezGracza: true });
  await przygotujTelefon(A, 'Ola', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'trasa' });
  const kod = kodGry(most);
  assert.match(tekst(A, 'lobby-status'), /Po starcie dołączenie nie jest już możliwe/, 'lobby status po zmianach E');
  await klik(A, 'przycisk-lobby-start');
  assert.equal(el(A, 'ekran-gra').hidden, false, 'gra ruszyła z jednym graczem');
  await przejdzStacje(A);
  await przejdzStacje(A);
  await przejdzStacje(A);
  const gra = most.znajdz(kod);
  assert.equal(gra.stan, 'zakonczona', 'solo domyka grę sam');
  assert.deepEqual(Object.keys(gra.wyniki), ['g-1'], 'wyniki dla jednego gracza');
  assert.equal(gra.wyniki['g-1'].stacjeZamkniete, 3, 'wszystkie stacje zamknięte');
  assert.equal(gra.wyniki['g-1'].premia, 0, 'bez rywali nie ma premii za kolejność');
});

test('uwaga G: koniec gry hosta NIE kończy gry innym — gość gra dalej, a most domyka grę, gdy skończy', async () => {
  const most = atrapaMostu();
  const pamiecA = new Map();
  zasiejZestaw(most, 3);
  const A = await noweUrzadzenie({ pamiec: pamiecA, most });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'wyscig' });
  const B = await noweUrzadzenie({ most, bezGracza: true });
  await przygotujTelefon(B, 'Bartek', { stacje: 3 });
  await dolaczZListyUI(B);
  await przepompuj(A, 1);
  await klik(A, 'przycisk-lobby-start');
  await przepompuj(B, 1);

  // Ala (organizator) domyka jedną stację, Bartek nie domknął jeszcze żadnej
  await przejdzStacje(A);
  await przepompuj(A, 1);
  const kod = kodGry(most);

  // Host kończy grę na swoim telefonie: ⚙ START GRY → TAK (ADR 0043). Telefon
  // hosta służył tylko do wystartowania gry i wybrania pytań (uwaga G).
  await potwierdzKoniecGry(A);
  assert.equal(pamiecA.has('okolica:multi:sesja'), false,
    'rezygnacja kasuje sesję — po odświeżeniu host nie wraca do gry, z której wyszedł (ADR 0045)');
  await czekajNa(A, () => most.znajdz(kod).zdarzenia.some((z) => z.typ === 'rezygnacja' && z.graczId === 'g-1'),
    'koniec hosta wychodzi na most jako rezygnacja');
  assert.equal(most.znajdz(kod).stan, 'trwa', 'gra NIE jest zamknięta — pozostali gracze grają dalej');
  assert.equal(most.znajdz(kod).zdarzenia.some((z) => z.typ === 'koniec'), false,
    'most nie dostał zdarzenia „koniec" — aplikacji nie wolno kończyć gry innym');
  assert.equal(most.ciala.filter((c) => JSON.parse(c).akcja === 'gra-zakoncz').length, 0,
    'aplikacja nie woła akcji gra-zakoncz — host nie kończy gry na moście (uwaga G)');
  assert.equal(el(A, 'gra-panel-koniec').hidden, false, 'host widzi swój wynik');
  assert.match(tekst(A, 'status'), /pozostali gracze grają dalej/, 'status mówi wprost, że inni grają dalej');

  // Bartek gra dalej — cała jego trasa, bez blokady i bez utraconych informacji
  await przepompuj(B, 1);
  assert.equal(el(B, 'ekran-gra').hidden, false, 'gość został w grze');
  assert.equal(el(B, 'gra-panel-koniec').hidden, true, 'u gościa gra się NIE skończyła');
  await przejdzStacje(B);
  await przejdzStacje(B);
  await przejdzStacje(B);
  await czekajNa(B, () => most.znajdz(kod).stan === 'zakonczona',
    'most domknął grę, gdy ostatni aktywny gracz skończył (rezygnacja hosta też domyka — .gs)');

  // Premia: pula liczy tylko tych, którzy dograli (uwaga L) — host wyszedł, więc
  // grających jest 1 i pula premii wynosi 0.
  const wyniki = most.znajdz(kod).wyniki;
  assert.equal(wyniki['g-1'].zrezygnowal, true, 'host jest wykreślony z gry jako rezygnujący');
  assert.equal(wyniki['g-2'].premia, 0, 'jeden dogrywający → pula premii 0 (ADR 0027 aneks 2026-09-13)');
  assert.equal(wyniki['g-2'].punkty, 3, 'Bartek: trzy dobre odpowiedzi');

  // Gdy gra się domknie, OBA telefony pokazują wspólną tabelę (ADR 0038/0044)
  await przepompuj(A, 1);
  await przepompuj(B, 1);
  for (const [nazwa, u] of [['A', A], ['B', B]]) {
    await czekajNa(u, () => el(u, 'gra-wyniki-tbody').children.length === 2, `${nazwa}: wspólna tabela po domknięciu gry`);
    assert.match(tekst(u, 'gra-wynik-zwyciezca'), /Bartek/, `${nazwa}: zwycięzca z punktacji mostu`);
    assert.match(tekst(u, 'multi-sync-pasek'), /odświeżanie zatrzymane/, `${nazwa}: koniec gry zatrzymuje polling`);
  }
});

test('uwaga E (2026-09-14): „Wróć na początek” po grze sieciowej zamyka synchronizację — stara gra się NIE odradza', async () => {
  // Zgłoszenie właściciela (poważne): po zakończeniu gry sieciowej i powrocie
  // „🏠 Wróć na początek” podczas wybierania NASTĘPNEJ gry (hotseat albo multi)
  // nagle startowało odliczanie i WRACAŁA poprzednia gra sieciowa — bez
  // wybrania czegokolwiek. Mechanizm: rezygnacja zostawia polling żywy (celowo
  // — wspólna tabela), a „Wróć na początek” czyścił rozgrywkę BEZ kończenia
  // synchronizacji, więc najbliższy krok pollingu widział „trwa + brak gry na
  // ekranie” i odradzał starą grę z odliczaniem (onStanGryMulti).
  const most = atrapaMostu();
  const pamiecA = new Map();
  zasiejZestaw(most, 3);
  const A = await noweUrzadzenie({ pamiec: pamiecA, most, bezGracza: true });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'wyscig' });
  const B = await noweUrzadzenie({ most, bezGracza: true });
  await przygotujTelefon(B, 'Bartek', { stacje: 3 });
  await dolaczZListyUI(B);
  await przepompuj(A, 1);
  await klik(A, 'przycisk-lobby-start');
  await przepompuj(B, 1);

  // Host kończy grę na swoim telefonie (⚙ START GRY → TAK), gość gra dalej —
  // gra na moście NADAL ma stan „trwa” (uwaga G).
  await przejdzStacje(A);
  await przepompuj(A, 1);
  const kod = kodGry(most);
  await potwierdzKoniecGry(A);
  assert.equal(most.znajdz(kod).stan, 'trwa', 'gość gra dalej — gra trwa na moście');

  // „🏠 Wróć na początek”: mapa startowa (właściciel, 2026-09-08) — stąd ikoną
  // ⚙ otwiera się setup NASTĘPNEJ gry…
  await klik(A, 'przycisk-nowa-gra');
  assert.equal(el(A, 'ekran-gra').hidden, true, 'ekran gry zamknięty po powrocie');
  await klik(A, 'przycisk-setup');
  assert.equal(el(A, 'ekran-setup').hidden, false, 'Ala wybiera nową grę na setupie');

  // …i NASTĘPNE KROKI synchronizacji niczego nie odradzają: dawniej polling
  // widział „trwa + brak rozgrywki” i wpychał starą grę z odliczaniem.
  await przepompuj(A, 2);
  assert.equal(el(A, 'ekran-gra').hidden, true, 'stara gra NIE wraca podczas wyboru nowej (uwaga E)');
  assert.equal(el(A, 'odliczanie').hidden, true, 'żadnego odliczania w trakcie wyboru nowej gry');
  assert.equal(el(A, 'ekran-setup').hidden, false, 'Ala zostaje na setupie');
  assert.equal(most.znajdz(kod).stan, 'trwa', 'gra na moście niezmieniona — to telefon wyszedł, nie most');
});

test('uwaga F: po starcie gry sygnał i odliczanie 5-4-3-2-1-START u hosta i u gościa', async () => {
  const most = atrapaMostu();
  const pamiecA = new Map();
  zasiejZestaw(most, 3);
  const A = await noweUrzadzenie({ pamiec: pamiecA, most });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'wyscig' });
  const B = await noweUrzadzenie({ most, bezGracza: true });
  await przygotujTelefon(B, 'Bartek', { stacje: 3 });
  await dolaczZListyUI(B);
  await przepompuj(A, 1);
  assert.equal(el(A, 'odliczanie').hidden, true, 'w lobby nic się nie odlicza');

  A.dom.wibracje.length = 0;
  await klik(A, 'przycisk-lobby-start');
  // host: odliczanie jest NAD grą, nie zamiast niej — tło przezroczyste, więc
  // mapa i panel fazy zostają widoczne (uwaga F)
  assert.equal(el(A, 'odliczanie').hidden, false, 'host odlicza od razu po swoim kliku');
  assert.match(tekst(A, 'odliczanie-cyfra'), /^[54321]$|^START$/, 'wielka cyfra na środku');
  assert.equal(el(A, 'ekran-gra').hidden, false, 'gra pod odliczaniem już żyje');
  assert.ok(A.dom.wibracje.length >= 1, 'krok odliczania daje sygnał (ADR 0041: dźwięk i wibracja)');

  B.dom.wibracje.length = 0;
  await przepompuj(B, 1);
  assert.equal(el(B, 'odliczanie').hidden, false, 'gość odlicza, gdy dowie się o starcie z mostu');
  assert.ok(B.dom.wibracje.length >= 1, 'sygnał startu także u gościa');

  // po „START" warstwa znika i zostaje zwykła gra — wygląd hotseat, zero doklejek
  for (const [nazwa, u] of [['A', A], ['B', B]]) {
    await czekajNa(u, () => el(u, 'odliczanie').hidden === true, `${nazwa}: odliczanie kończy się na START`);
    assert.equal(tekst(u, 'odliczanie-cyfra'), '', `${nazwa}: cyfra sprzątnięta`);
    assert.equal(el(u, 'ekran-gra').hidden, false, `${nazwa}: gracz zostaje na ekranie gry`);
    assert.equal(el(u, 'gra-postep').textContent.startsWith('stacja 1 z 3'), true, `${nazwa}: postęp jak w hotseat`);
    for (const id of ['gra-panel-multi', 'gra-multi-tura', 'gra-multi-wiersze', 'multi-info-lista',
      'gra-multi-sync', 'multi-factcheck', 'przycisk-multi-zakoncz', 'przycisk-multi-rezygnuj']) {
      assert.equal(u.dom.elementy.has(id), false, `${nazwa}: po potworku nie ma śladu — #${id}`);
    }
  }
});

test('pełna ścieżka AI: setup multi → pozycja → stacje (trasa-sekret) → wklejenie → LOBBY', async () => {
  const most = atrapaMostu();
  // konfig zgodny z fixturem paczka-ok.json (3 stacje × 1 pytanie, tematy z paczki)
  const KONFIG_AI = JSON.stringify({
    schemat: 'konfig/1', kanon: '2026-09-10',
    konfig: {
      tryb: 'piesza', liczbaGraczy: 1, liczbaStacji: 3, pytaniaNaStacje: 1, czasGryMin: 85,
      tematy: ['historia', 'architektura'], wiek: 'dorosli', jezyk: 'polski',
      karaRecznaS: 60, podklad: 'osm', promienM: 1000, kodGry: 'test',
    },
  });
  const pamiec = new Map([['okolica:konfig', KONFIG_AI]]);
  const A = await noweUrzadzenie({ pamiec, most, bezGracza: true });
  // setup: rodzaj gry multi (tryb trasa + sekret to domyślne), dokładnie jeden gracz
  await wybierzSegment(A, 'lista-rodzajow', 'multi');
  assert.equal(el(A, 'pole-pytania').hidden, true, 'w multi nie ma pola „pytań na stację”');
  assert.equal(el(A, 'pole-multi-tryb').hidden, false, 'segment trybu multi widoczny');
  assert.equal(el(A, 'pole-trasa-sekret').hidden, false, 'ptaszek trasa-sekret widoczny przy trasie');
  assert.equal(el(A, 'multi-trasa-sekret').checked, true, 'sekret domyślnie zaznaczony');
  await dodajGraczaUI(A, 'Ewa');
  await ustawPozycjeTestowa(A, { lat: 52.23178, lon: 21.01234 });
  await klik(A, 'przycisk-dalej-pozycja');
  assert.equal(el(A, 'ekran-pozycja').hidden, false, 'Dalej prowadzi na ekran pozycji (ścieżka wspólna)');

  await klik(A, 'przycisk-dalej-stacje');
  await new Promise((r) => setTimeout(r, 40)); // stacje liczą się asynchronicznie (pierścień po 404)
  assert.equal(el(A, 'ekran-stacje').hidden, false, 'ekran stacji widoczny');
  // trasa-sekret: organizator widzi tylko STATUS, nie nazwy ani współrzędne
  assert.equal(el(A, 'lista-stacji').children.length, 1, 'lista stacji ma jeden wiersz statusu');
  assert.match(tekst(A, 'lista-stacji'), /Wygenerowano stacji: 3/, 'status mówi tylko ile');
  assert.match(tekst(A, 'lista-stacji'), /NIE zlokalizowano/, 'bez sieci dróg komunikat mówi wprost, że stacje nie są zlokalizowane');
  assert.equal(el(A, 'przycisk-przelicz').hidden, true, 'w tajnej trasie nie ma opcji „Inny układ”');
  assert.match(tekst(A, 'lista-stacji'), /ukryte/i, 'ukrycie jest jawne');
  assert.doesNotMatch(tekst(A, 'lista-stacji'), /52\./, 'współrzędne stacji nie wyciekają');
  await klik(A, 'przycisk-dalej-prompt');
  await klik(A, 'przycisk-dalej-paczka');
  assert.equal(el(A, 'ekran-paczka').hidden, false, 'ekran wklejania widoczny');

  const paczka = JSON.parse(czytajPlik(new URL('./fixtures/paczka-ok.json', import.meta.url), 'utf8'));
  A.dom.wklej('pole-odpowiedz', JSON.stringify(paczka));
  // po wklejeniu odpowiedzi modelu otwiera się LOBBY (m12-74) — bez pośrednich paneli
  await czekajNa(A, () => el(A, 'multi-panel-lobby').hidden === false, 'lobby po wklejeniu paczki');
  assert.match(tekst(A, 'lobby-tryb'), /Wspólna Trasa/, 'tryb przetrwał całą ścieżkę');
  assert.match(tekst(A, 'lobby-tryb'), /tylko kolejna stacja/, 'sekret przetrwał całą ścieżkę');
  const gra = most.znajdz(kodGry(most));
  assert.equal(gra.trasaSekret, true, 'gra na moście ma trasaSekret');
  assert.equal(gra.konfiguracja.pytaniaNaStacje, 1, 'liczba stacji = liczba pytań (1 na stację)');
  assert.match(gra.konfiguracja.geohash8, /^[0-9b-z]{8}$/, 'konfiguracja niesie geohash8 (~50 m)');
});

test('wyjście z lobby jest zgłaszane mostowi — inaczej liczba graczy kłamie', async () => {
  // Właściciel 2026-09-11: „dołączanie i wychodzenie w dowolnym momencie".
  // Samo wyjście z ekranu zostawiało gracza w `gracze` na moście, a lista gier
  // w okolicy (liczbaGraczy = gracze.length) obiecywała kogoś, kogo nie było.
  const most = atrapaMostu();
  const KONFIG = JSON.stringify({
    schemat: 'konfig/1', kanon: '2026-09-10',
    konfig: {
      tryb: 'piesza', liczbaGraczy: 1, liczbaStacji: 3, pytaniaNaStacje: 1, czasGryMin: 85,
      tematy: ['historia', 'architektura'], wiek: 'dorosli', jezyk: 'polski',
      karaRecznaS: 60, podklad: 'osm', promienM: 1000, kodGry: 'test',
    },
  });
  const A = await noweUrzadzenie({ pamiec: new Map([['okolica:konfig', KONFIG]]), most, bezGracza: true });
  await wybierzSegment(A, 'lista-rodzajow', 'multi');
  await dodajGraczaUI(A, 'Ewa');
  await ustawPozycjeTestowa(A, { lat: 52.23178, lon: 21.01234 });
  await klik(A, 'przycisk-dalej-pozycja');
  await klik(A, 'przycisk-dalej-stacje');
  await new Promise((r) => setTimeout(r, 40));
  await klik(A, 'przycisk-dalej-prompt');
  await klik(A, 'przycisk-dalej-paczka');
  const paczka = JSON.parse(czytajPlik(new URL('./fixtures/paczka-ok.json', import.meta.url), 'utf8'));
  A.dom.wklej('pole-odpowiedz', JSON.stringify(paczka));
  await czekajNa(A, () => el(A, 'multi-panel-lobby').hidden === false, 'lobby po wklejeniu paczki');

  // Wyjście organizatora zamyka grę WSZYSTKIM, więc jest dwustopniowe
  // (audyt PR #13 pkt 2): pierwszy klik uzbraja i mówi, co się stanie,
  // dopiero drugi wysyła `gra-opusc`.
  await klik(A, 'przycisk-lobby-opusc');
  await new Promise((r) => setTimeout(r, 40));
  const poJednym = most.ciala.map((c) => { try { return JSON.parse(c); } catch { return null; } })
    .find((c) => c?.akcja === 'gra-opusc');
  assert.equal(poJednym, undefined, 'pierwszy klik organizatora NIE zamyka gry');
  assert.match(tekst(A, 'przycisk-lobby-opusc'), /ponownie/i, 'przycisk prosi o potwierdzenie');
  assert.match(tekst(A, 'status'), /zamyka grę/i, 'status mówi wprost, co zrobi drugi klik');
  assert.equal(el(A, 'ekran-setup').hidden, true, 'po pierwszym kliku gracz zostaje w lobby');

  await klik(A, 'przycisk-lobby-opusc');
  await new Promise((r) => setTimeout(r, 40));
  // Nie wszystkie POST-y są JSON-em (przyjęcie paczki idzie jako `data=…`),
  // więc czytamy defensywnie — szukamy jednego konkretnego polecenia.
  const przeczytane = most.ciala.map((c) => { try { return JSON.parse(c); } catch { return null; } });
  const wyjscie = przeczytane.find((c) => c?.akcja === 'gra-opusc');
  assert.ok(wyjscie, 'telefon wysłał gra-opusc');
  assert.equal(wyjscie.graczId, 'g-1', 'wychodzi ten gracz, który klika');
  assert.equal([...most.gry.values()][0].stan, 'archiwum', 'wyjście organizatora zamyka grę — bez niego nie wystartuje');
  assert.match(tekst(A, 'status'), /zamykam grę/i, 'komunikat mówi, co się stało z grą');
  assert.equal(el(A, 'ekran-setup').hidden, false, 'gracz wraca na setup');
});

test('uwagi B1+B2 (2026-09-14): czekanie ma puls — paczka „Ładuję paczkę” aż do lobby, lobby „Pobieram listę gier” bez Drive', async () => {
  // B1: klik „▶ Graj z tą paczką” przy zakładaniu gry sieciowej trwa 5–10 s
  // (zimny web app). Przycisk musi cały czas mówić „⏳ Ładuję paczkę…” i
  // pulsować — nie gasnąć po szybkim pobraniu pliku. B2: czekanie na listę
  // gier pulsuje jak każde oczekiwanie i nie wymienia „mostu Drive”.
  const most = atrapaMostu();
  zasiejZestaw(most, 3);
  const A = await noweUrzadzenie({ most, bezGracza: true });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });

  // Atrapa zwłoki: asercje „w trakcie” robimy DOKŁADNIE w chwili żądania.
  const pierwotnyFetch = A.dom.window.fetch;
  let przyciskPaczki = null;
  const fetchZZwloka = async (url, opcje) => {
    const adres = String(url);
    if (adres.includes('akcja=gry')) {
      const pole = el(A, 'multi-lobby-status');
      assert.match(pole.textContent, /^Pobieram listę gier/, 'status mówi, że lista jest pobierana');
      assert.equal(pole.classList.contains('pulsuje'), true, 'czekanie na listę pulsuje (B2)');
      assert.equal(pole.textContent.includes('Drive'), false, 'komunikat nie mówi o Drive (B2)');
    }
    if (adres.includes('akcja=gra-zaloz') && przyciskPaczki) {
      assert.equal(przyciskPaczki.disabled, true, 'przycisk paczki nie przyjmuje drugiego kliku w trakcie zakładania gry (B1)');
      assert.equal(przyciskPaczki.classList.contains('pulsuje'), true, 'przycisk pulsuje przez CAŁE zakładanie gry (B1)');
      assert.equal(przyciskPaczki.textContent, '⏳ Ładuję paczkę…', 'etykieta czekania jest ta sama co przy pobieraniu pliku (B1)');
    }
    return pierwotnyFetch(url, opcje);
  };
  A.dom.window.fetch = fetchZZwloka;
  globalThis.fetch = fetchZZwloka;
  try {
    // B2: wejście na ścieżkę „Dołączam” odpytuje most o listę gier.
    await wybierzSegment(A, 'multi-sciezka', 'dolacz');
    await czekajNa(A, () => /Brak gier|Gry w zasięgu/.test(tekst(A, 'multi-lobby-status')), 'lista gier przestała pulsować');
    assert.equal(el(A, 'multi-lobby-status').classList.contains('pulsuje'), false, 'po odpowiedzi pulsowanie gaśnie');
    assert.equal(tekst(A, 'multi-lobby-status').includes('Drive'), false, 'status końcowy też bez Drive');

    // B1: ścieżka „Zakładam” — paczka z repo, klik, POST gra-zaloz pod lupą.
    await wybierzSegment(A, 'multi-sciezka', 'zaloz');
    przelaczNa(A);
    const przyciskTrybu = [...A.dom.pobierz('multi-tryby').children].find((b) => b.textContent.includes('Wyścig'));
    kliknijEl(przyciskTrybu);
    await oddech();
    await klik(A, 'przycisk-dalej-pozycja');
    await czekajNa(A, () => el(A, 'zestawy-lista').children.length > 0, 'paczka z repozytorium w propozycjach');
    przyciskPaczki = [...el(A, 'zestawy-lista').children[0].children].at(-1);
    przelaczNa(A);
    kliknijEl(przyciskPaczki);
    await czekajNa(A, () => el(A, 'multi-panel-lobby').hidden === false, 'lobby po zakładzeniu gry');
    assert.equal(przyciskPaczki.disabled, false, 'po lobby przycisk wraca do życia');
    assert.equal(przyciskPaczki.textContent, '▶ Graj z tą paczką', 'etykieta wraca po zakończeniu czekania');
    assert.equal(przyciskPaczki.classList.contains('pulsuje'), false, 'pulsowanie gaśnie po otwarciu lobby');
  } finally {
    A.dom.window.fetch = pierwotnyFetch;
    globalThis.fetch = pierwotnyFetch;
  }
});

test('trasa-sekret z siecią dróg: komunikat mówi „zlokalizowano”, a „Inny układ” zostaje schowany', async () => {
  const most = atrapaMostu();
  const KONFIG = {
    tryb: 'piesza', liczbaGraczy: 1, liczbaStacji: 3, pytaniaNaStacje: 1, czasGryMin: 110,
    tematy: ['historia', 'architektura'], wiek: 'dorosli', jezyk: 'polski',
    podklad: 'osm', kodGry: 'test',
  };
  const pamiec = new Map([['okolica:konfig', JSON.stringify({ schemat: 'konfig/1', kanon: '2026-09-10', konfig: KONFIG })]]);
  // Sieć z pamięci telefonu (cache) — bez internetu, a stacje są SIECIOWE,
  // więc komunikat ma powiedzieć „zlokalizowano” (fixture centrum, 1000 m).
  const promienM = promienZCzasuGry({ ...KONFIG, promienM: null });
  const dane = upraszczajDaneDoCache(parsujOdpowiedz(JSON.parse(czytajPlik(new URL('./fixtures/overpass-centrum.json', import.meta.url), 'utf8'))));
  pamiec.set(kluczCacheSieci({ lat: 52.2297, lon: 21.0122, promienM, tryb: 'piesza' }),
    JSON.stringify({ schemat: SCHEMAT_SIECI, zapisanoMs: Date.now(), dane }));

  const A = await noweUrzadzenie({ pamiec, most, bezGracza: true });
  await wybierzSegment(A, 'lista-rodzajow', 'multi');
  await dodajGraczaUI(A, 'Ewa');
  await ustawPozycjeTestowa(A, { lat: 52.2297, lon: 21.0122 });
  await klik(A, 'przycisk-dalej-pozycja');
  await klik(A, 'przycisk-dalej-stacje');
  await new Promise((r) => setTimeout(r, 40));
  assert.match(tekst(A, 'lista-stacji'), /Wygenerowano i zlokalizowano stacji: 3/, 'sieć drogowa = stacje zlokalizowane');
  assert.doesNotMatch(tekst(A, 'lista-stacji'), /NIE zlokalizowano/, 'wariant pierścieniowy nie podchodzi pod sieć');
  assert.equal(el(A, 'przycisk-przelicz').hidden, true, '„Inny układ” schowany także przy sieci');
  assert.doesNotMatch(tekst(A, 'lista-stacji'), /52\./, 'współrzędne stacji nie wyciekają');
});

test('bez potwierdzonego imienia NIE wysyłam niczego — jawna odmowa (lista na setupie)', async () => {
  const most = atrapaMostu();
  const u = await noweUrzadzenie({ most, bezGracza: true });
  await wybierzSegment(u, 'lista-rodzajow', 'multi');
  await wybierzSegment(u, 'multi-sciezka', 'dolacz');
  await ustawPozycjeTestowa(u);
  // Właściciel 2026-09-12: boks z listą gier jest osobną kartą i pokazuje się
  // DOPIERO po zalogowaniu — bez imienia nie ma czym zapytać mostu, a pusty
  // boks tylko zajmował miejsce.
  assert.equal(el(u, 'multi-panel-dolacz').hidden, true, 'bez zalogowania boksu z listą w ogóle nie ma');
  assert.equal(el(u, 'pole-tozsamosc').parentNode.id, 'multi-slot-tozsamosc', '„Ty w tej grze” siedzi w karcie multi, pod opisem ścieżki');
  await oddech();
  assert.equal(el(u, 'multi-lobby-lista').children.length, 0, 'lista pusta bez znanego imienia');
  assert.equal(most.ciala.length, 0, 'ZERO wysyłek (POST) na most bez potwierdzonego imienia');
  assert.deepEqual(
    most.adresy.filter((a) => /[?&]akcja=(gry|gra-stan|ranking)/.test(a)),
    [],
    'żaden GET gry wieloosobowej nie poszedł (odczyt indeksu paczek jest bez bramki — ADR 0017 pkt 6)',
  );
  // z potwierdzonym imieniem — droga wolna (lista odświeża się sama po dodaniu gracza)
  await dodajGraczaUI(u, 'Daria');
  assert.equal(el(u, 'multi-panel-dolacz').hidden, false, 'po zalogowaniu boks z listą się pokazuje');
  await czekajNa(u, () => most.adresy.some((a) => /[?&]akcja=gry/.test(a)), 'lista pyta o gry po zalogowaniu');
  assert.equal(el(u, 'pole-tozsamosc-siatka').hidden, true, 'pola wpisywania znikają — jedna osoba na telefon');
});

test('ADR 0020: adres mostu jest w kodzie — telefon bez wpisu w pamięci gra sieciowo od razu', async () => {
  const most = atrapaMostu();
  // pusty wpis w pamięci = brak nadpisania: telefon bierze adres z kodu (stan po wdrożeniu web app)
  const pamiec = new Map([['okolica:multi:url-mostu', '']]);
  const u = await noweUrzadzenie({ pamiec, most, bezGracza: true });
  await wybierzSegment(u, 'lista-rodzajow', 'multi');
  przelaczNa(u);
  // m12-75: osobnego badge'a na ekranie multi już nie ma (samo lobby); jedna
  // prawda o stanie mostu żyje przy karcie paczek na setupie.
  assert.match(tekst(u, 'most-stan-repo'), /podłączony/i, 'karta paczek: adres z kodu działa bez wpisywania');
  await dodajGraczaUI(u, 'Iga');
  await ustawPozycjeTestowa(u);
  await klik(u, 'przycisk-dalej-pozycja');
  assert.equal(el(u, 'ekran-pozycja').hidden, false, 'ścieżka multi rusza bez odmowy o adres');
  assert.doesNotMatch(tekst(u, 'bledy-setup'), /Brak adresu mostu/, 'komunikat o braku adresu nie istnieje w tej wersji');
});

test('serwer odrzuca odpowiedź bez dojścia (R08) — klient NIE ponawia i mówi dlaczego', async () => {
  const most = atrapaMostu();
  // wspólna trasa na 2 stacje, dwóch graczy, wystartowana
  const zalozenie = await polecenieMostu(URL_MOSTU, {
    akcja: 'gra-zaloz', tryb: 'trasa', trasaSekret: true, organizator: { pseudonim: 'Ewa' },
    konfiguracja: { liczbaStacji: 2, pytaniaNaStacje: 1, wiek: 'dorosli', tematy: ['historia'], promienM: 1000, miejsce: 'Podkowa Leśna', geohash5: 'u3qb8', geohash8: 'u3qb8xyz' },
    zestaw: { stacje: stacjeTestowe(2), kontener: zapakujPaczke(paczkaTestowa(stacjeTestowe(2)), WERSJA_PROTOKOLU), meta: { miejsce: 'Podkowa Leśna' } },
  }, { fetchImpl: most.fetchImpl });
  const kod = zalozenie.gra.kod;
  await polecenieMostu(URL_MOSTU, { akcja: 'gra-dolacz', kod, pseudonim: 'Filip' }, { fetchImpl: most.fetchImpl });
  await polecenieMostu(URL_MOSTU, { akcja: 'gra-start', kod, organizatorId: 'g-1' }, { fetchImpl: most.fetchImpl });

  // g-2 odpowiada bez dojścia (kolejność zdarzeń, R08): polecenieMostu rzuca
  // z odmowaMostu, sync NIE kolejkuje
  const bezDojscia = zbudujZdarzenie({ kod, graczId: 'g-2', typ: 'odpowiedz', stacjaId: 2, dane: { poprawna: true, punktyRazem: 1 } });
  await assert.rejects(
    polecenieMostu(URL_MOSTU, { akcja: 'gra-zdarzenie', zdarzenie: bezDojscia }, { fetchImpl: most.fetchImpl }),
    (e) => e.odmowaMostu === true && /odpowiedź bez dojścia/.test(e.message),
  );
  const bledy = [];
  const sync = utworzSynchronizacje({
    urlMostu: URL_MOSTU, graczId: 'g-2', kod, fetchImpl: most.fetchImpl,
    onBlad: (m) => bledy.push(m), timeout: { ustaw: () => 0, czysc: () => {} },
  });
  const wynik = await sync.wyslijZdarzenie(bezDojscia);
  assert.equal(wynik, null, 'odmowa = brak wyniku');
  assert.equal(sync.kolejkaLength, 0, 'odmowa serwera nie ląduje w kolejce (nie ponawiamy)');
  assert.match(bledy[0], /odpowiedź bez dojścia/, 'gracz dostaje powód odmowy');
});

test('SKANER prywatności: współrzędne gracza nie wychodzą w żadnej wysyłce (ADR 0019 pkt 3)', () => {
  const WZOR_POL = /"(lat|lon|szerokosc|dlugosc|latitude|longitude)"\s*:/;
  let zbadane = 0;
  for (const [nazwa, most] of [['wyścig', mostWyscig], ['trasa', mostTrasy]]) {
    for (const tekstCiala of most.ciala) {
      const dane = JSON.parse(tekstCiala);
      const kopia = structuredClone(dane);
      if (kopia.akcja === 'gra-zaloz') {
        // mapa gry (stacje) i ukryty kontener jadą celowo — jak paczka w repo
        // (ADR 0016/0017). Cała RESZTA ciała musi być czysta od współrzędnych.
        delete kopia.zestaw.stacje;
        delete kopia.zestaw.kontener;
      }
      assert.ok(!WZOR_POL.test(JSON.stringify(kopia)), `${nazwa}/${dane.akcja}: współrzędne w ciele POST`);
      zbadane += 1;
    }
    for (const adres of most.adresy) {
      assert.ok(!/[?&](lat|lon|szerokosc|dlugosc)=/i.test(adres), `${nazwa}: współrzędne w adresie GET`);
      assert.ok(adres.startsWith(URL_MOSTU), `${nazwa}: wszystkie żądania idą na most`);
    }
  }
  assert.ok(zbadane >= 20, `skaner zbadał ${zbadane} ciał — oczekuję pełnych rozgrywek (≥20)`);
  // konfiguracja gry niesie geohash5 (przybliżenie okolicy), NIE punkt gracza
  for (const most of [mostWyscig, mostTrasy]) {
    for (const gra of most.gry.values()) {
      assert.match(gra.konfiguracja.geohash5, /^[0-9b-z]{5}$/, 'geohash5 zamiast współrzędnych w konfiguracji');
      assert.match(gra.konfiguracja.geohash8, /^[0-9b-z]{8}$/, 'geohash8 (miara ~50 m) zamiast współrzędnych');
      for (const z of gra.zdarzenia) {
        assert.deepEqual(Object.keys(z.dane ?? {}).filter((k) => POLA_ZAKAZANE.includes(k)), [], 'zdarzenie bez pól zakazanych');
      }
    }
  }
});

test('uszkodzony stan z mostu: kod R w statusie, polling nie pada, po naprawie gra wraca', async () => {
  const most = atrapaMostu();
  const pamiec = new Map();
  zasiejZestaw(most, 3);
  const A = await noweUrzadzenie({ pamiec, most, bezGracza: true });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'wyscig' });
  await klik(A, 'przycisk-lobby-start');
  assert.equal(el(A, 'ekran-gra').hidden, false, 'organizator w grze');

  const gra = [...most.gry.values()][0];
  const zapas = gra.konfiguracja;
  gra.konfiguracja = null; // most oddał uszkodzony stan (np. połowiczny zapis)
  await przepompuj(A, 2);
  assert.match(tekst(A, 'status'), /\[R07\]/, 'jawny kod usterki stanu, nie wyjątek w pollingu');
  assert.equal(el(A, 'ekran-gra').hidden, false, 'aplikacja żyje na uszkodzonym stanie');

  gra.konfiguracja = zapas; // most naprawiony
  await przepompuj(A, 2);
  assert.equal(el(A, 'ekran-gra').hidden, false, 'gra toczy się dalej po poprawnym stanie');
});

test('lista graczy = tożsamość (ADR 0026 aneks): dodaj, odmowa PIN-u, zapamiętanie, usuwanie', async () => {
  const lista = (u) => [...el(u, 'lista-graczy').children].map((li) => li.children[0].textContent);
  const most = atrapaMostu();
  most.profile.set('ala', { pseudonim: 'Ala', pin: '1234' });

  // 1) wolne imię + PIN → jedno wołanie zakłada profil i gracz jest na liście
  const A = await noweUrzadzenie({ most, bezGracza: true });
  ustaw(A, 'profil-pseudonim', 'Ewa');
  ustaw(A, 'profil-pin', '9999');
  await klik(A, 'przycisk-dodaj-gracza');
  await oddech();
  assert.equal(most.profile.get('ewa')?.pin, '9999', 'profil Ewy powstał na moście');
  assert.deepEqual(lista(A), ['1. Ewa'], 'gracz na liście po dodaniu');
  assert.match(tekst(A, 'status'), /Założono profil/, 'jawne potwierdzenie założenia profilu');
  assert.equal(el(A, 'profil-pin').value, '', 'PIN nie zostaje w polu (ADR 0013)');
  assert.equal(el(A, 'profil-pseudonim').value, '', 'pole imienia jest gotowe na kolejnego gracza');
  assert.equal(el(A, 'setup-pytania').value, '1', 'pytania na stację idą za liczbą graczy (K22)');

  // 2) to samo imię drugi raz → odmowa lokalna, bez wołania mostu
  const przed = most.adresy.length;
  ustaw(A, 'profil-pseudonim', 'ewa');
  ustaw(A, 'profil-pin', '9999');
  await klik(A, 'przycisk-dodaj-gracza');
  await oddech();
  assert.match(tekst(A, 'bledy-profil'), /jest już na liście/, 'duplikat nie wchodzi na listę');
  assert.deepEqual(lista(A), ['1. Ewa'], 'lista bez zmian');
  assert.equal(most.adresy.length, przed, 'duplikat nie leci w sieć');

  // 3) drugi gracz: lista zastępuje pole „Liczba graczy" i podnosi pytania na stację
  ustaw(A, 'profil-pseudonim', 'Jan');
  ustaw(A, 'profil-pin', '2222');
  await klik(A, 'przycisk-dodaj-gracza');
  await oddech();
  assert.deepEqual(lista(A), ['1. Ewa', '2. Jan'], 'kolejność dodawania to kolejność gry');
  assert.equal(el(A, 'setup-pytania').value, '2', 'dwa pytania na stację przy dwóch graczach');

  // 4) „✕ Usuń" zdejmuje gracza z listy
  const przyciskUsun = el(A, 'lista-graczy').children[0].children[1];
  przelaczNa(A); kliknijEl(przyciskUsun); await oddech();
  assert.deepEqual(lista(A), ['1. Jan'], 'usunięty gracz znika z listy');
  assert.equal(el(A, 'setup-pytania').value, '1', 'pytania wracają do jednego gracza');

  // 5) zajęte imię + POPRAWNY PIN → przechodzi, profil bez zmian
  const B = await noweUrzadzenie({ most, bezGracza: true });
  ustaw(B, 'profil-pseudonim', 'Ala');
  ustaw(B, 'profil-pin', '1234');
  await klik(B, 'przycisk-dodaj-gracza');
  await oddech();
  assert.deepEqual(lista(B), ['1. Ala'], 'znane imię wchodzi na listę');
  assert.match(tekst(B, 'status'), /To Ty/, 'potwierdzenie tożsamości');

  // 6) zajęte imię + ZŁY PIN → R20, gracz NIE trafia na listę, brama nie puszcza
  const C = await noweUrzadzenie({ most, bezGracza: true });
  ustaw(C, 'profil-pseudonim', 'Ala');
  ustaw(C, 'profil-pin', '0000');
  await klik(C, 'przycisk-dodaj-gracza');
  await oddech();
  assert.deepEqual(lista(C), [], 'zły PIN = brak gracza na liście');
  assert.match(tekst(C, 'bledy-profil'), /PIN/, 'komunikat R20 po ludzku');
  await klik(C, 'przycisk-dalej-pozycja');
  assert.equal(el(C, 'ekran-pozycja').hidden, true, 'pusta lista nie puszcza na ekran 2');
  // pusta lista to usterka K08 — komunikat mówi wprost, gdzie dodać gracza
  assert.match(tekst(C, 'bledy-setup'), /Nie dodano jeszcze żadnego gracza/, 'K08 prowadzi do bloku „Kto gra?"');

  // 7) puste pola → odmowa lokalna, zanim cokolwiek poleci w sieć
  const D = await noweUrzadzenie({ most, bezGracza: true });
  const adresyD = most.adresy.length;
  await klik(D, 'przycisk-dodaj-gracza');
  assert.match(tekst(D, 'bledy-profil'), /Wpisz imię/);
  ustaw(D, 'profil-pseudonim', 'Jan');
  await klik(D, 'przycisk-dodaj-gracza');
  assert.match(tekst(D, 'bledy-profil'), /4–8 cyfr/, 'PIN jest wymagany');
  assert.equal(most.adresy.length, adresyD, 'bez imienia i PIN-u nie ma wołania mostu');

  // 8) most nie odpowiada → gracz wchodzi bez potwierdzenia, gra nie staje (ADR 0016 pkt 5)
  const padniety = atrapaMostu();
  padniety.fetchImpl = async () => { throw new Error('offline'); };
  const E = await noweUrzadzenie({ most: padniety, bezGracza: true });
  ustaw(E, 'profil-pseudonim', 'Ola');
  ustaw(E, 'profil-pin', '4321');
  await klik(E, 'przycisk-dodaj-gracza');
  await oddech();
  assert.deepEqual(lista(E), ['1. Ola — bez potwierdzenia z Drive'], 'gracz dodany mimo awarii');
  assert.match(tekst(E, 'profil-stan'), /bez potwierdzenia/, 'degradacja jest jawna');
  await klik(E, 'przycisk-dalej-pozycja');
  assert.equal(el(E, 'ekran-pozycja').hidden, false, 'awaria mostu nie blokuje gry');

  // 9) zapamiętany na tym telefonie → wraca na listę BEZ PIN-u i bez wołania mostu
  const adresyF = padniety.adresy.length;
  const F = await noweUrzadzenie({
    most: padniety,
    pamiec: new Map([
      ['okolica:multi:url-mostu', URL_MOSTU],
      ['okolica:gracze', JSON.stringify({
        schemat: 'gracze-lokalni/1',
        gracze: [
          { pseudonim: 'Ala', zweryfikowany: true },
          { pseudonim: 'Tomek', zweryfikowany: false },
        ],
        kiedy: '2026-09-07T10:00:00.000Z',
      })],
    ]),
  });
  assert.deepEqual(lista(F), ['1. Ala'], 'potwierdzony gracz wraca sam, bez klikania');
  assert.equal(el(F, 'lista-zapamietanych').children.length, 1, 'niepewny gracz czeka jako przycisk');
  await klik(F, 'przycisk-dalej-pozycja');
  assert.equal(el(F, 'ekran-pozycja').hidden, false, 'znany z telefonu gracz przechodzi bez mostu');
  assert.equal(padniety.adresy.length, adresyF, 'zapamiętany gracz nie woła mostu o PIN');

  // 10) zapamiętany BEZ potwierdzenia: klik w przycisk prosi o PIN, nie puszcza bez niego
  const G = await noweUrzadzenie({
    most,
    pamiec: new Map([
      ['okolica:multi:url-mostu', URL_MOSTU],
      ['okolica:gracze', JSON.stringify({
        schemat: 'gracze-lokalni/1',
        gracze: [{ pseudonim: 'Tomek', zweryfikowany: false }],
        kiedy: '2026-09-07T10:00:00.000Z',
      })],
    ]),
  });
  assert.deepEqual(lista(G), [], 'niepewny gracz nie wchodzi na listę sam');
  przelaczNa(G); kliknijEl(el(G, 'lista-zapamietanych').children[0]); await oddech();
  assert.match(tekst(G, 'bledy-profil'), /wpisz jego PIN/, 'klik prosi o PIN');
  assert.equal(el(G, 'profil-pseudonim').value, 'Tomek', 'imię jest już wpisane');
  ustaw(G, 'profil-pin', '7777');
  await klik(G, 'przycisk-dodaj-gracza');
  await oddech();
  assert.deepEqual(lista(G), ['1. Tomek'], 'po poprawnym PIN-ie gracz jest na liście');
  assert.match(tekst(G, 'status'), /Założono profil/, 'niepewny gracz został potwierdzony na moście');
});

/* ------- ADR 0027 część B: wolna kolejność i pytanie wg indeksu gracza ------ */

const mostWolna = atrapaMostu();

test('wolna kolejność: wyścig bez wyboru stacji — dowolna kolejność i pytanie własne dla każdego gracza', async () => {
  // 2026-09-14 F: warstwa wyboru stacji usunięta — gracz sam decyduje, app wykrywa dotarcie do dowolnej
  const pamiecA = new Map();
  zasiejZestaw(mostWolna, 3, 2);
  const A = await noweUrzadzenie({ pamiec: pamiecA, most: mostWolna, bezGracza: true });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'wyscig' });

  const B = await noweUrzadzenie({ most: mostWolna, bezGracza: true });
  await przygotujTelefon(B, 'Bartek');
  await dolaczZListyUI(B);
  await przepompuj(A, 1);
  await klik(A, 'przycisk-lobby-start');
  await przepompuj(B, 1);

  // brak warstwy wyboru — od razu odcinek i pasek „Jacek. Stacja X/Y"
  assert.equal(A.dom.elementy.has('multi-wybor-stacji'), false, 'wyścig: warstwa wyboru usunięta (F)');
  assert.equal(el(A, 'gra-panel-odcinek').hidden, false, 'wyścig: od razu odcinek, bez klikania „Idę”');
  assert.match(tekst(A, 'gra-pasek'), /Stacja 1\/3/, 'pasek dolny „Stacja X/Y” (F)');

  // symulacja dojścia do dowolnej stacji — w teście idziemy do najbliższej
  await dojdzSymulacja(A);
  assert.match(tekst(A, 'gra-pytanie-tresc'), /stacji \d+\? \(wariant 1\)/, 'organizator (indeks 0) ma pierwsze pytanie stacji');

  // Bartek gra u siebie, bez uzgadniania: ta sama stacja 1, ale DRUGIE pytanie
  // W wyścigu start odcinka jest auto, więc od razu symulacja dojścia
  await dojdzSymulacja(B);
  assert.match(tekst(B, 'gra-pytanie-tresc'), /stacji \d+\? \(wariant 2\)/, 'gość (indeks 1) ma drugie pytanie tej stacji');

  // po pierwszym pytaniu — stacja zamknięta (2 graczy × 2 pytania = 1 pytanie na gracza na stację)
  przelaczNa(A);
  kliknijEl(A.dom.pobierz('gra-odpowiedzi').children[0]);
  await oddech();
  assert.match(tekst(A, 'przycisk-nastepna-stacja'), /Idź dalej/, 'przycisk „Idź dalej ->" w wyścigu (F)');
  await klik(A, 'przycisk-nastepna-stacja');
  assert.equal(el(A, 'gra-panel-odcinek').hidden, false, 'po zamknięciu stacji od razu mapa w wyścigu');
});

test('pytania mniejszej paczki są dzielone, a nie gubione (indeks się zawija)', async () => {
  // paczka z JEDNYM pytaniem na stację przy dwóch graczach: gra się nie zatrzymuje
  const most = atrapaMostu();
  const pamiecA = new Map();
  zasiejZestaw(most, 3, 1);
  const A = await noweUrzadzenie({ pamiec: pamiecA, most });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'wyscig' });
  const B = await noweUrzadzenie({ most, bezGracza: true });
  await przygotujTelefon(B, 'Bartek');
  await dolaczZListyUI(B);
  await przepompuj(A, 1);
  await klik(A, 'przycisk-lobby-start');
  await przepompuj(B, 1);

  // w wyścigu start odcinka auto — od razu symulacja
  await dojdzSymulacja(B);
  assert.match(tekst(B, 'gra-pytanie-tresc'), /stacji \d+\?/, 'gość ma pytanie mimo paczki mniejszej niż liczba graczy');
  przelaczNa(B);
  assert.equal(B.dom.pobierz('gra-odpowiedzi').children.length, 4, 'cztery odpowiedzi do wyboru');
});

test('we Wspólnej Trasie nie ma wolnego wyboru stacji — kolejność ustala trasa', async () => {
  const most = atrapaMostu();
  const pamiecA = new Map();
  zasiejZestaw(most, 3);
  const A = await noweUrzadzenie({ pamiec: pamiecA, most });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'trasa' });
  await klik(A, 'przycisk-lobby-start');
  assert.equal(A.dom.elementy.has('multi-wybor-stacji'), false, 'trasa: warstwa wyboru usunięta (F)');
  assert.equal(A.dom.elementy.has('gra-multi-tura'), false,
    'komunikatu trybu w grze nie ma (uwaga F) — tryb mówi lobby, w grze jest jak w hotseat');
  assert.match(tekst(A, 'lobby-tryb'), /Wspólna Trasa/, 'tryb zostaje w lobby');
  assert.equal(tekst(A, 'gra-postep'), 'stacja 1 z 3', 'kolejność narzuca trasa — postęp jak w hotseat');
  // W trasie (kolejność narzucona) bieżąca stacja MA być wyróżniona —
  // wyłączenie podświetlenia dotyczy tylko wyścigu (uwaga D).
  const pinezkiTrasa = A.dom.pobierz('mapa-gra-pinezki');
  assert.equal(pinezkiTrasa.children.filter((g) => String(g.getAttribute('class')).includes('pinezka-aktywna')).length, 1,
    'trasa: dokładnie jedna (bieżąca) pinezka jest „aktywna”');
});

test('ADR 0032: wariant fact-check jedzie w stanie gry, a ekran gry nie dokleja swojej linii (uwaga F)', async () => {
  const most = atrapaMostu();
  const pamiec = new Map();
  zasiejZestaw(most, 3); // meta z factcheck:true (domyślne)
  const A = await noweUrzadzenie({ pamiec, most, bezGracza: true });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'wyscig' });
  await klik(A, 'przycisk-lobby-start');
  assert.equal(el(A, 'ekran-gra').hidden, false, 'organizator w grze');
  // Linii wariantu (`#multi-factcheck`) NIE MA razem z panelem multi (ADR 0044):
  // w grze zostaje dokładnie to, co w hotseat. Wariant nadal jedzie w stanie gry
  // (`zestaw.meta`, RO-gra/1) i tam go sprawdzamy.
  assert.equal(A.dom.elementy.has('multi-factcheck'), false, 'ekran gry nie dokleja linii wariantu');
  assert.equal(most.znajdz(kodGry(most)).zestaw.meta.factcheck, true, 'meta gry niesie wariant zweryfikowany');

  // wariant bez weryfikacji: paczka w wariancie bez fact-checku (REV3)
  const most2 = atrapaMostu();
  const pamiec2 = new Map();
  zasiejZestaw(most2, 3, 1, { factcheck: false });
  const B = await noweUrzadzenie({ pamiec: pamiec2, most: most2, bezGracza: true });
  await przygotujTelefon(B, 'Bartek', { stacje: 3 });
  await zalozGreUI(B, { tryb: 'wyscig' });
  await klik(B, 'przycisk-lobby-start');
  assert.equal(most2.znajdz(kodGry(most2)).zestaw.meta.factcheck, false, 'meta gry niesie wariant bez weryfikacji');
  assert.equal(B.dom.elementy.has('multi-factcheck'), false, 'żaden wariant nie dokleja linii do gry');
});

/* -------- ADR 0019 aneks 2026-09-13d: odpowiedź bez zasięgu przeżywa odświeżenie telefonu -------- */

test('kolejka multi: zdarzenia zapisane bez sieci wychodzą po odświeżeniu telefonu, PRZED pobraniem stanu gry', async () => {
  // Właściciel 2026-09-13: odpowiedź udzielona bez zasięgu czekała tylko w RAM
  // (`app/sync.js`), więc reload gubił ją — most nie poznawał odpowiedzi, a
  // stacja zostawała do przejścia jeszcze raz. Teraz kolejka jest utrwalona.
  const most = atrapaMostu();
  zasiejZestaw(most, 3);
  const pamiecA = new Map();
  const A = await noweUrzadzenie({ pamiec: pamiecA, most, bezGracza: true });
  await przygotujTelefon(A, 'Celina', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'trasa' });
  const kod = kodGry(most);
  const pamiecB = new Map();
  const B = await noweUrzadzenie({ pamiec: pamiecB, most, bezGracza: true });
  await przygotujTelefon(B, 'Czarek');
  await dolaczZListyUI(B);
  await klik(A, 'przycisk-lobby-start');
  await przepompuj(B, 1);
  assert.equal(el(B, 'ekran-gra').hidden, false, 'B w grze');

  // B odpowiada BEZ połączenia z mostem (odcinek, dojście, poprawna odpowiedź)
  most.online = false;
  await klik(B, 'przycisk-start-odcinka');
  await dojdzSymulacja(B);
  przelaczNa(B);
  kliknijEl(B.dom.pobierz('gra-odpowiedzi').children[0]);
  await oddech();
  assert.match(tekst(B, 'status'), /czeka w kolejce/, 'B wie, że zdarzenia czekają na sieć');
  assert.deepEqual(
    most.znajdz(kod).zdarzenia.filter((z) => z.graczId === 'g-2').map((z) => z.typ), [],
    'most jeszcze nic nie dostał — gra jest niepełna',
  );
  assert.equal(pamiecB.has('okolica:multi-kolejka'), true,
    'kolejka jest UTRWALONA w pamięci telefonu, nie tylko w RAM');
  const zapisana = JSON.parse(pamiecB.get('okolica:multi-kolejka'));
  assert.equal(zapisana.kod, kod, 'zapis dotyczy TEJ gry');
  assert.deepEqual(zapisana.zdarzenia.map((z) => z.typ), ['dojscie', 'odpowiedz'], 'oba zdarzenia B są w pamięci');

  // Telefon B zostaje „zamknięty i otwarty” (nowa instancja DOM, TA SAMA pamięć),
  // a sieć wraca.
  most.online = true;
  const B2 = await noweUrzadzenie({ pamiec: pamiecB, most, bezGracza: true });
  przelaczNa(B2);
  await oddech();
  await oddech();
  await oddech();
  assert.deepEqual(
    most.znajdz(kod).zdarzenia.filter((z) => z.graczId === 'g-2').map((z) => z.typ),
    ['dojscie', 'odpowiedz'],
    'zaległe zdarzenia wyszły PRZED pobraniem stanu gry — odpowiedź B nie zginęła',
  );
  assert.equal(pamiecB.has('okolica:multi-kolejka'), false, 'po dostarczeniu kolejka jest czysta');
  assert.equal(el(B2, 'ekran-gra').hidden, false, 'powrót prosto do gry');
  assert.equal(tekst(B2, 'gra-postep'), 'stacja 2 z 3',
    'stacja 1 jest domknięta na moście, więc telefon nie każe jej przechodzić drugi raz');
  const punktyB = most.znajdz(kod).zdarzenia.find((z) => z.typ === 'odpowiedz' && z.graczId === 'g-2');
  assert.equal(punktyB.dane.punktyRazem, 1, 'punkt B za stację 1 jest na moście (punkty liczy most, nie telefon)');
});

test('kolejka multi: bez sieci odświeżony telefon NIC nie gubi — zdarzenia zostają w pamięci i wychodzą później', async () => {
  const most = atrapaMostu();
  zasiejZestaw(most, 3); // konfig wymaga min. 3 stacji (K10)
  const A = await noweUrzadzenie({ pamiec: new Map(), most, bezGracza: true });
  await przygotujTelefon(A, 'Celina', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'wyscig' });
  const kod = kodGry(most);
  const pamiecB = new Map();
  const B = await noweUrzadzenie({ pamiec: pamiecB, most, bezGracza: true });
  await przygotujTelefon(B, 'Czarek');
  await dolaczZListyUI(B);
  await klik(A, 'przycisk-lobby-start');
  await przepompuj(B, 1);

  most.online = false;
  await klik(B, 'przycisk-start-odcinka');
  await dojdzSymulacja(B);
  przelaczNa(B);
  kliknijEl(B.dom.pobierz('gra-odpowiedzi').children[0]);
  await oddech();
  const przedReloadem = JSON.parse(pamiecB.get('okolica:multi-kolejka'));
  assert.equal(przedReloadem.zdarzenia.length, 2, 'dwa zdarzenia B w pamięci');

  // Reload WCIĄŻ bez sieci: powrót do gry się nie udaje, ale kolejka zostaje.
  const B2 = await noweUrzadzenie({ pamiec: pamiecB, most, bezGracza: true });
  przelaczNa(B2);
  await oddech();
  await oddech();
  assert.deepEqual(
    most.znajdz(kod).zdarzenia.filter((z) => z.graczId === 'g-2').map((z) => z.typ), [],
    'bez sieci nic nie wychodzi na most — i nic nie jest kasowane',
  );
  const poReloadzie = JSON.parse(pamiecB.get('okolica:multi-kolejka'));
  assert.deepEqual(poReloadzie.zdarzenia.map((z) => z.typ), ['dojscie', 'odpowiedz'],
    'kolejka przeżyła odświeżenie bez sieci');

  // Sieć wraca: kolejny powrót do gry wypycha zdarzenia i domyka stację.
  most.online = true;
  const B3 = await noweUrzadzenie({ pamiec: pamiecB, most, bezGracza: true });
  przelaczNa(B3);
  await oddech();
  await oddech();
  await oddech();
  assert.deepEqual(
    most.znajdz(kod).zdarzenia.filter((z) => z.graczId === 'g-2').map((z) => z.typ),
    ['dojscie', 'odpowiedz'], 'odpowiedź B w końcu doszła — raz, nie dwa razy',
  );
  assert.equal(pamiecB.has('okolica:multi-kolejka'), false, 'pamięć po dostarczeniu jest czysta');
});
