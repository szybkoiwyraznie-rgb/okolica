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
import { KLUCZ_REJESTRU, SCHEMAT_LOKALNY, kluczZestawu, nowyRejestr, zbierzMetaZestawu } from '../app/zestawy.js';
import { czyKompletna, generujKod, przeliczWyniki, zbudujZdarzenie } from '../app/wieloosobowa.js';
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
    if (z.typ !== 'rezygnacja' && z.typ !== 'koniec' && czyKompletna(gra)) {
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

/** Zestaw lokalny w pamięci telefonu (rejestr + wpis) — źródło „z tego telefonu". */
function zasiejZestaw(pamiec, ileStacji, pytaniaNaStacje = 1, { factcheck = true } = {}) {
  const stacje = stacjeTestowe(ileStacji);
  const kontener = zapakujPaczke(paczkaTestowa(stacje, pytaniaNaStacje, { factcheck }), factcheck ? WERSJA_PROTOKOLU : WERSJA_PROTOKOLU_REV3);
  const meta = zbierzMetaZestawu({
    lat: PODKOWA.lat, lon: PODKOWA.lon, promienM: 1000, tematy: ['historia'], wiek: 'dorosli',
    jezyk: 'polski', miejsce: 'Podkowa Leśna', liczbaStacji: stacje.length, pytaniaNaStacje,
  });
  pamiec.set(kluczZestawu(kontener.skrot), JSON.stringify({ schemat: SCHEMAT_LOKALNY, stacje, kontener, ...meta, kodGry: 'MULTITEST' }));
  const rejestr = nowyRejestr();
  rejestr.wpisy = [{ skrot: kontener.skrot, ...meta, kodGry: 'MULTITEST' }];
  pamiec.set(KLUCZ_REJESTRU, JSON.stringify(rejestr));
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
 * PASUJĄCA paczka z telefonu („▶ Graj z tą paczką”) → lobby.
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
  // karta propozycji: lokalna paczka musi się dopasować (m12-74: paczka PRZED lobby)
  await czekajNa(u, () => el(u, 'zestawy-lista').children.length > 0, 'lokalna paczka w propozycjach');
  const wiersz = el(u, 'zestawy-lista').children[0];
  const przyciskPaczki = [...wiersz.children].at(-1);
  assert.match(przyciskPaczki.textContent, /Graj z tą paczką/);
  przelaczNa(u);
  kliknijEl(przyciskPaczki);
  await czekajNa(u, () => el(u, 'multi-panel-lobby').hidden === false, 'lobby po paczce');
}

/** Dołącza z listy gier w zasięgu ~50 m (m12-74: bez kodów, wpis „Host: X”). */
async function dolaczZListyUI(u) {
  await wybierzSegment(u, 'multi-sciezka', 'dolacz');
  assert.match(tekst(u, 'przycisk-dalej-pozycja'), /Pokaż gry w okolicy/, 'przycisk dolny zmienia etykietę');
  await klik(u, 'przycisk-dalej-pozycja');
  await czekajNa(u, () => el(u, 'multi-lobby-lista').children.length > 0, 'lista gier w zasięgu ~50 m');
  const wiersz = el(u, 'multi-lobby-lista').children[0];
  assert.match(wiersz.children[0].textContent, /^Host: /, 'wpis pokazuje tylko hosta');
  przelaczNa(u);
  kliknijEl(wiersz.children[1]); // „Dołącz”
  await czekajNa(u, () => el(u, 'multi-panel-lobby').hidden === false, 'gość w lobby');
}

/** Odcinek od startu do „następna stacja": droga + dojście z fixów (ADR 0029) + poprawna odpowiedź. */
async function przejdzStacje(u) {
  await klik(u, 'przycisk-start-odcinka');
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
  // urządzenie A: organizator — setup multi, tryb wyścig, paczka z telefonu
  const pamiecA = new Map();
  zasiejZestaw(pamiecA, 3);
  const A = await noweUrzadzenie({ pamiec: pamiecA, most: mostWyscig, bezGracza: true });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'wyscig' });
  kodWyscigu = kodGry(mostWyscig);
  assert.equal(el(A, 'przycisk-lobby-start').hidden, false, 'organizator widzi przycisk startu');
  assert.match(tekst(A, 'lobby-tryb'), /Wyścig/, 'tryb widoczny w lobby');
  assert.equal(el(A, 'przycisk-multi-zakoncz').hidden, true, 'w lobby nie ma kończenia gry');

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
  assert.equal(el(A, 'gra-panel-multi').hidden, false, 'panel wieloosobowy widoczny');
  assert.match(tekst(A, 'gra-multi-tura'), /Wyścig/, 'wyścig: wszyscy jednocześnie');
  await przepompuj(B, 1);
  assert.equal(el(B, 'ekran-gra').hidden, false, 'gość wystartował po odświeżeniu stanu');

  // stacja 1: A online, B OFFLINE — zdarzenia lądują w kolejce i wychodzą po powrocie
  await przejdzStacje(A);
  mostWyscig.online = false;
  await klik(B, 'przycisk-start-odcinka');
  await dojdzSymulacja(B); // nie wyjdzie — kolejka
  przelaczNa(B);
  kliknijEl(B.dom.pobierz('gra-odpowiedzi').children[0]);
  await oddech();
  assert.match(tekst(B, 'gra-multi-sync'), /2 zdarzeń czeka w kolejce/, 'pasek synchronizacji mówi o kolejce offline');
  assert.match(tekst(B, 'status'), /kolejce/, 'gracz wie, że zdarzenia czekają');
  mostWyscig.online = true;
  await przepompuj(B, 1); // krok: stan + flush kolejki (FIFO)
  const zdarzeniaB = mostWyscig.znajdz(kodWyscigu).zdarzenia.filter((z) => z.graczId === 'g-2');
  assert.deepEqual(zdarzeniaB.map((z) => z.typ), ['dojscie', 'odpowiedz'], 'kolejka wyszła w kolejności FIFO');
  await klik(B, 'przycisk-nastepna-stacja');

  // kanał info (m12-74): dojścia i odpowiedzi zamieniają się w komunikaty
  await przepompuj(A, 1);
  const infoA = [...el(A, 'multi-info-lista').children].map((li) => li.textContent).join(' | ');
  assert.match(infoA, /Bartek: dobra odpowiedź/, 'info: odpowiedź Bartka widoczna');
  assert.match(infoA, /Bartek jest na stacji/, 'info: dojście Bartka widoczne');
  assert.match(infoA, /Ala: dobra odpowiedź/, 'info: własna odpowiedź też w kanale');

  // stacje 2–3: oboje online — po ostatniej odpowiedzi serwer domyka grę
  await przejdzStacje(A);
  await przejdzStacje(A); // A kończy swój zestaw → lokalny ekran wyniku
  await przepompuj(B, 1);
  await przejdzStacje(B);
  await przejdzStacje(B); // ostatnia odpowiedź → czyKompletna → stan 'zakonczona'
  assert.equal(mostWyscig.znajdz(kodWyscigu).stan, 'zakonczona', 'serwer zamknął grę po wszystkich odpowiedziach');
  await przepompuj(A, 1);
  await przepompuj(B, 1);

  // wyniki po obu stronach: ta sama tabela z serwera
  for (const [nazwa, u] of [['A', A], ['B', B]]) {
    const wiersze = el(u, 'gra-multi-wiersze').children;
    assert.equal(wiersze.length, 2, `${nazwa}: tabela wyników ma dwa wiersze`);
    assert.match(wiersze[0].textContent, /Ala|Bartek/, `${nazwa}: pseudonimy w tabeli`);
    assert.match(tekst(u, 'gra-multi-sync'), /odświeżanie zatrzymane/, `${nazwa}: polling staje po zakończeniu`);
  }
  const wyniki = mostWyscig.znajdz(kodWyscigu).wyniki;
  assert.equal(wyniki['g-1'].stacjeZamkniete, 3, 'Ala zamknęła 3 stacje');
  assert.equal(wyniki['g-2'].stacjeZamkniete, 3, 'Bartek zamknął 3 stacje (w tym z kolejki offline)');
  assert.equal(wyniki['g-1'].poprawne, 3, 'wszystkie odpowiedzi Ali poprawne');
  // premia za kolejność ukończenia: STAŁA 3/2/1 (właściciel, 2026-09-11)
  assert.equal(wyniki['g-1'].premia, 3, 'Ala skończyła pierwsza: premia 3');
  assert.equal(wyniki['g-2'].premia, 2, 'Bartek drugi: premia 2 (stała 3/2/1)');
  assert.equal(wyniki['g-1'].punkty, 6, 'podsumowanie: 3 pkt z odpowiedzi + premia 3');
  assert.equal(wyniki['g-2'].punkty, 5, 'Bartek: 3 pkt + premia 2');
  // tabela na obu telefonach: kolumna premii i postęp „ile z ilu”
  for (const [nazwa, u] of [['A', A], ['B', B]]) {
    const wiersze = [...el(u, 'gra-multi-wiersze').children];
    assert.match(wiersze[0].textContent, /Ala.*3\/3.*\+3/, `${nazwa}: pierwsza w tabeli ma postęp 3/3 i premię +3`);
    assert.match(wiersze[1].textContent, /Bartek.*3\/3.*\+2/, `${nazwa}: drugi ma postęp 3/3 i premię +2`);
  }
});

const mostTrasy = atrapaMostu();
let kodTrasy = null;

test('trasa end-to-end: dołącz z listy → wspólna trasa po kolei → resume po odświeżeniu → wyniki', async () => {
  // A zakłada Wspólną Trasę na 4 stacje: obaj gracze przechodzą WSZYSTKIE,
  // po kolei, każde we własnym tempie (właściciel, 2026-09-11).
  const pamiecA = new Map();
  zasiejZestaw(pamiecA, 4);
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
  assert.equal(el(B, 'multi-wybor-stacji').hidden, true, 'trasa: lista wyboru schowana — kolejność narzuca trasa');
  assert.match(tekst(B, 'gra-multi-tura'), /Wspólna Trasa/, 'panel mówi: wspólna trasa, po kolei');

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

  // RESUME: telefon B „odświeżony” (nowa instalacja DOM, TA SAMA pamięć)
  const B2 = await noweUrzadzenie({ pamiec: pamiecB, most: mostTrasy, bezGracza: true });
  assert.equal(el(B2, 'multi-wznowienie').hidden, false, 'baner powrotu do gry widoczny po odświeżeniu');
  assert.match(tekst(B2, 'multi-wznowienie-opis'), /dołączyłeś/, 'baner pamięta, że B dołączył do gry');
  await klik(B2, 'przycisk-multi-wroc');
  assert.equal(el(B2, 'ekran-gra').hidden, false, 'powrót prosto do gry');
  assert.equal(tekst(B2, 'gra-postep'), 'stacja 1 z 3', 'zamknięta stacja 1 nie wraca — zostały 3');
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
  for (const u of [A, B2]) {
    assert.equal(el(u, 'gra-multi-wiersze').children.length, 2, 'tabela wyników po obu stronach');
    assert.match(tekst(u, 'gra-multi-sync'), /odświeżanie zatrzymane/, 'synchronizacja zatrzymana');
  }
  assert.equal(el(B2, 'multi-wznowienie').hidden, true, 'po zakończeniu gry baner powrotu znika (sesja wyczyszczona)');
  assert.equal(mostTrasy.znajdz(kodTrasy).zdarzenia.every((z) => !POLA_ZAKAZANE.some((pz) => pz in (z.dane ?? {}))), true, 'serwer nie przyjął współrzędnych w zdarzeniach');
});

test('start SOLO: organizator wystartuje grę z jednym graczem i sam ją domyka', async () => {
  const most = atrapaMostu();
  const pamiec = new Map();
  zasiejZestaw(pamiec, 3);
  const A = await noweUrzadzenie({ pamiec, most, bezGracza: true });
  await przygotujTelefon(A, 'Ola', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'trasa' });
  const kod = kodGry(most);
  assert.match(tekst(A, 'lobby-status'), /solo/, 'lobby mówi wprost: można wystartować solo');
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

test('host kończy grę przyciskiem: podsumowanie u wszystkich, premia liczy się też przy przedwczesnym końcu', async () => {
  const most = atrapaMostu();
  const pamiecA = new Map();
  zasiejZestaw(pamiecA, 3);
  const A = await noweUrzadzenie({ pamiec: pamiecA, most });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'wyscig' });
  const B = await noweUrzadzenie({ most, bezGracza: true });
  await przygotujTelefon(B, 'Bartek', { stacje: 3 });
  await dolaczZListyUI(B);
  await przepompuj(A, 1);
  await klik(A, 'przycisk-lobby-start');
  await przepompuj(B, 1);

  // Bartek domyka WSZYSTKIE stacje pierwszy; Ala tylko jedną — i host kończy grę
  await przejdzStacje(B);
  await przejdzStacje(B);
  await przejdzStacje(B);
  await przejdzStacje(A);
  await przepompuj(A, 1);
  assert.equal(el(A, 'przycisk-multi-zakoncz').hidden, false, 'host w grze widzi „Zakończ grę”');
  assert.equal(el(B, 'przycisk-multi-zakoncz').hidden, true, 'gość go NIE widzi');
  await klik(A, 'przycisk-multi-zakoncz');
  await czekajNa(A, () => most.znajdz(kodGry(most)).stan === 'zakonczona', 'most zakończył grę po kliknięciu hosta');
  const kod = kodGry(most);
  const wyniki = most.znajdz(kod).wyniki;
  assert.equal(wyniki['g-2'].premia, 3, 'Bartek skończył przed końcem gry: premia 3 liczy się także przy przedwczesnym końcu');
  assert.equal(wyniki['g-2'].punkty, 6, '3 odpowiedzi + premia 3');
  assert.equal(wyniki['g-1'].premia, 0, 'Ala nie domknęła stacji: bez premii');
  await przepompuj(B, 1);
  for (const [nazwa, u] of [['A', A], ['B', B]]) {
    await czekajNa(u, () => el(u, 'gra-multi-wiersze').children.length === 2, `${nazwa}: tabela podsumowania`);
    assert.match(tekst(u, 'gra-multi-sync'), /odświeżanie zatrzymane/, `${nazwa}: koniec gry zatrzymuje polling`);
    const info = [...el(u, 'multi-info-lista').children].map((li) => li.textContent).join(' | ');
    assert.match(info, /zakończył grę|opuszcza grę|dobra odpowiedź/, `${nazwa}: kanał info żyje`);
  }
  // kanał info: rezygnacja tez ma komunikat
});

test('pełna ścieżka AI: setup multi → pozycja → stacje (trasa-sekret) → wklejenie → LOBBY', async () => {
  const most = atrapaMostu();
  // konfig zgodny z fixturem paczka-ok.json (3 stacje × 1 pytanie, tematy z paczki)
  const KONFIG_AI = JSON.stringify({
    schemat: 'konfig/1',
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
  assert.match(tekst(A, 'lista-stacji'), /Stacje wygenerowano: 3/, 'status mówi tylko ile');
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

test('bez potwierdzonego imienia NIE wysyłam niczego — jawna odmowa (setup → lista gier)', async () => {
  const most = atrapaMostu();
  const u = await noweUrzadzenie({ most, bezGracza: true });
  await wybierzSegment(u, 'lista-rodzajow', 'multi');
  await wybierzSegment(u, 'multi-sciezka', 'dolacz');
  await ustawPozycjeTestowa(u);
  await klik(u, 'przycisk-dalej-pozycja');
  assert.match(tekst(u, 'bledy-profil'), /co najmniej jednego gracza/, 'odmowa mówi wprost, czego brakuje');
  assert.equal(el(u, 'multi-panel-dolacz').hidden, true, 'lista gier się NIE otwiera');
  await klik(u, 'przycisk-dalej-pozycja');
  assert.equal(most.ciala.length, 0, 'ZERO wysyłek (POST) na most bez potwierdzonego imienia');
  assert.deepEqual(
    most.adresy.filter((a) => /[?&]akcja=(gry|gra-stan|ranking)/.test(a)),
    [],
    'żaden GET gry wieloosobowej nie poszedł (odczyt indeksu paczek jest bez bramki — ADR 0017 pkt 6)',
  );
  // z potwierdzonym imieniem — droga wolna (lista gier się otwiera)
  await dodajGraczaUI(u, 'Daria');
  await klik(u, 'przycisk-dalej-pozycja');
  await czekajNa(u, () => el(u, 'multi-panel-dolacz').hidden === false, 'lista gier otwarta po dodaniu gracza');
});

test('ADR 0020: adres mostu jest w kodzie — telefon bez wpisu w pamięci gra sieciowo od razu', async () => {
  const most = atrapaMostu();
  // pusty wpis w pamięci = brak nadpisania: telefon bierze adres z kodu (stan po wdrożeniu web app)
  const pamiec = new Map([['okolica:multi:url-mostu', '']]);
  const u = await noweUrzadzenie({ pamiec, most, bezGracza: true });
  await wybierzSegment(u, 'lista-rodzajow', 'multi');
  przelaczNa(u);
  assert.match(tekst(u, 'multi-most-stan'), /podłączony/i, 'karta gry wieloosobowej: adres z kodu działa bez wpisywania');
  assert.match(tekst(u, 'most-stan-repo'), /podłączony/i, 'karta paczek mówi to samo (jedna prawda o stanie mostu)');
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
  zasiejZestaw(pamiec, 3);
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

test('wolna kolejność: wybór stacji z listy i pytanie własne dla każdego gracza', async () => {
  // paczka 3 stacje × 2 pytania = na dwóch graczy (domyślne po ADR 0027 część A)
  const pamiecA = new Map();
  zasiejZestaw(pamiecA, 3, 2);
  const A = await noweUrzadzenie({ pamiec: pamiecA, most: mostWolna, bezGracza: true });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'wyscig' });

  const B = await noweUrzadzenie({ most: mostWolna, bezGracza: true });
  await przygotujTelefon(B, 'Bartek');
  await dolaczZListyUI(B);
  await przepompuj(A, 1);
  await klik(A, 'przycisk-lobby-start');
  await przepompuj(B, 1);

  // lista wyboru: trzy stacje do wzięcia w dowolnej kolejności
  assert.equal(el(A, 'multi-wybor-stacji').hidden, false, 'wyścig pokazuje wybór stacji');
  const przyciski = [...el(A, 'multi-wybor-przyciski').children];
  assert.deepEqual(przyciski.map((b) => b.textContent.split(' ·')[0]), ['Stacja 1', 'Stacja 2', 'Stacja 3'], 'trzy stacje do wyboru');

  // Ala wybiera stację 3 — gra idzie tam, nie „po kolei”
  kliknijEl(przyciski[2]);
  await oddech();
  assert.match(tekst(A, 'przycisk-start-odcinka'), /stacji 3/, 'przycisk drogi wskazuje wybraną stację');

  await klik(A, 'przycisk-start-odcinka');
  await dojdzSymulacja(A);
  assert.match(tekst(A, 'gra-pytanie-tresc'), /stacji 3\? \(wariant 1\)/, 'organizator (indeks 0) ma pierwsze pytanie stacji');

  // Bartek gra u siebie, bez uzgadniania: ta sama stacja 1, ale DRUGIE pytanie
  await klik(B, 'przycisk-start-odcinka');
  await dojdzSymulacja(B);
  assert.match(tekst(B, 'gra-pytanie-tresc'), /stacji 1\? \(wariant 2\)/, 'gość (indeks 1) ma drugie pytanie tej stacji');

  // po zamknięciu stacji lista wyboru maleje
  przelaczNa(A);
  kliknijEl(A.dom.pobierz('gra-odpowiedzi').children[0]);
  await oddech();
  await klik(A, 'przycisk-nastepna-stacja');
  assert.deepEqual(
    [...el(A, 'multi-wybor-przyciski').children].map((b) => b.textContent.split(' ·')[0]),
    ['Stacja 1', 'Stacja 2'],
    'zamknięta stacja znika z wyboru',
  );
});

test('pytania mniejszej paczki są dzielone, a nie gubione (indeks się zawija)', async () => {
  // paczka z JEDNYM pytaniem na stację przy dwóch graczach: gra się nie zatrzymuje
  const most = atrapaMostu();
  const pamiecA = new Map();
  zasiejZestaw(pamiecA, 3, 1);
  const A = await noweUrzadzenie({ pamiec: pamiecA, most });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'wyscig' });
  const B = await noweUrzadzenie({ most, bezGracza: true });
  await przygotujTelefon(B, 'Bartek');
  await dolaczZListyUI(B);
  await przepompuj(A, 1);
  await klik(A, 'przycisk-lobby-start');
  await przepompuj(B, 1);

  await klik(B, 'przycisk-start-odcinka');
  await dojdzSymulacja(B);
  assert.match(tekst(B, 'gra-pytanie-tresc'), /stacji 1\?/, 'gość ma pytanie mimo paczki mniejszej niż liczba graczy');
  przelaczNa(B);
  assert.equal(B.dom.pobierz('gra-odpowiedzi').children.length, 4, 'cztery odpowiedzi do wyboru');
});

test('we Wspólnej Trasie nie ma wolnego wyboru stacji — kolejność ustala trasa', async () => {
  const most = atrapaMostu();
  const pamiecA = new Map();
  zasiejZestaw(pamiecA, 3);
  const A = await noweUrzadzenie({ pamiec: pamiecA, most });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'trasa' });
  await klik(A, 'przycisk-lobby-start');
  assert.equal(el(A, 'multi-wybor-stacji').hidden, true, 'trasa: lista wyboru schowana');
  assert.match(tekst(A, 'gra-multi-tura'), /Wspólna Trasa/, 'trasa: komunikat o wspólnej trasie');
});

test('ADR 0032: panel multi pokazuje Q dla zweryfikowanej, notkę dla paczki bez weryfikacji', async () => {
  const maQ = (u) => [...el(u, 'multi-factcheck').children].some((c) => c.className === 'znaczek-factcheck' && c.textContent === 'Q');

  const most = atrapaMostu();
  const pamiec = new Map();
  zasiejZestaw(pamiec, 3); // meta z factcheck:true (domyślne)
  const A = await noweUrzadzenie({ pamiec, most, bezGracza: true });
  await przygotujTelefon(A, 'Ala', { stacje: 3 });
  await zalozGreUI(A, { tryb: 'wyscig' });
  await klik(A, 'przycisk-lobby-start');
  assert.equal(el(A, 'ekran-gra').hidden, false, 'organizator w grze');
  assert.equal(el(A, 'multi-factcheck').hidden, false, 'linia wariantu widoczna');
  assert.match(tekst(A, 'multi-factcheck'), /fact check/);
  assert.equal(maQ(A), true, 'Q w panelu multi dla paczki zweryfikowanej');

  // wariant bez weryfikacji: paczka w wariancie bez fact-checku (REV3)
  const most2 = atrapaMostu();
  const pamiec2 = new Map();
  zasiejZestaw(pamiec2, 3, 1, { factcheck: false });
  const B = await noweUrzadzenie({ pamiec: pamiec2, most: most2, bezGracza: true });
  await przygotujTelefon(B, 'Bartek', { stacje: 3 });
  await zalozGreUI(B, { tryb: 'wyscig' });
  await klik(B, 'przycisk-lobby-start');
  assert.match(tekst(B, 'multi-factcheck'), /bez wymuszonego fact-checku/);
  assert.equal(maQ(B), false, 'brak znaczka dla wariantu bez weryfikacji');
});
