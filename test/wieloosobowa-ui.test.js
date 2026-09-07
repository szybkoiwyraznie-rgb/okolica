/**
 * Testy UI gry wieloosobowej (M11/P5): dwa „urządzenia" = dwie instalacje
 * atrapy DOM + dwa importy `app.js`, grające end-to-end przeciw atrapie mostu
 * Drive (lustrzanej wobec `docs/setup/apps-script-repo-paczek.gs`).
 *
 * Scenariusze z planu:
 *  - wyścig: załóż → dołącz PRZEZ LOBBY → start → dojścia → odpowiedzi → koniec
 *    → wyniki po obu stronach; po drodze kolejka offline i flush po powrocie sieci;
 *  - tury: załóż → dołącz KODEM → bramka „nie Twoja tura" → resume po
 *    „odświeżeniu" telefonu (zamknięte stacje nie wracają) → wyniki;
 *  - odmowa bez zgody (zero wysyłek), odrzucenie zdarzenia poza turą (R08);
 *  - SKANER ciał POST: współrzędne GRACZA nigdy nie wychodzą (ADR 0019 pkt 3).
 *    Wyjątek celowy i jawny: `zestaw.stacje` w gra-zaloz — mapa gry jest
 *    współdzielona dokładnie tak jak paczka w repozytorium (ADR 0016/0017).
 *
 * Tryb `?odstep=0` daje synchronizacji RĘCZNY harmonogram (`harmonogramMulti`
 * w app.js): zero pollingu w tle, test sam pompuje kroki (`przepompuj`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { zainstalujDom } from './helpers/dom.js';
import { WERSJA_PROTOKOLU } from '../app/protokol.js';
import { zapakujPaczke } from '../app/kodowanie.js';
import { KLUCZ_REJESTRU, SCHEMAT_LOKALNY, kluczZestawu, nowyRejestr, zbierzMetaZestawu } from '../app/zestawy.js';
import { biezacyGraczTury, czyKompletna, generujKod, przeliczWyniki, zbudujZdarzenie } from '../app/wieloosobowa.js';
import { polecenieMostu, utworzSynchronizacje } from '../app/sync.js';

const URL_MOSTU = 'https://script.google.com/macros/s/TEST/exec';
/** Pinezka testowa Podkowy (LESSONS: współrzędne testowe z M8) — wszystkie stacje w jej komórce geohash5. */
const PODKOWA = { lat: 52.12303, lon: 20.74614 };

/* ------------------------------------------------- atrapa mostu Drive */

const POLA_ZAKAZANE = ['lat', 'lon', 'szerokosc', 'dlugosc', 'latitude', 'longitude'];

/**
 * Lustro sekcji gier z `.gs` (te same reguły: lobby-only join, max 8, unikalny
 * pseudonim, start u organizatora, tury wg `biezacyGraczTury`, dojscie przed
 * odpowiedz, kasowanie współrzędnych, `czyKompletna` → wyniki). Logikę tur/
 * wyników bierzemy z `app/wieloosobowa.js` — parzystość moduł↔.gs pilnuje
 * `test/kontrakt.test.js`, więc atrapa nie może się rozjechać z produkcją.
 */
function atrapaMostu() {
  const gry = new Map(); // idGry → gra
  const ciala = [];      // surowe ciała POST-ów (skaner prywatności)
  const adresy = [];     // wszystkie URL-e (GET i POST)
  const most = {
    gry, ciala, adresy,
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
          default: return json({ ok: false, blad: `nieznana akcja: ${dane.akcja}` });
        }
      }
      const params = new URL(String(url)).searchParams;
      const akcja = params.get('akcja');
      if (akcja === 'gry') {
        const wpisy = [...gry.values()]
          .filter((g) => g.stan !== 'zakonczona' && g.stan !== 'archiwum' && g.gracze.length < 8)
          .map((g) => ({
            idGry: g.idGry, tryb: g.tryb, stan: g.stan, miejsce: g.konfiguracja.miejsce,
            geohash5: g.konfiguracja.geohash5, wiek: g.konfiguracja.wiek, tematy: g.konfiguracja.tematy,
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

  function znajdzGre(kod, idGry) {
    for (const g of gry.values()) {
      if (idGry && g.idGry === idGry) return g;
      if (kod && g.kod === String(kod).toUpperCase().replace(/[^A-Z0-9]/g, '')) return g;
    }
    return null;
  }
  function zaloz(dane) {
    if (dane.tryb !== 'wyscig' && dane.tryb !== 'tury') return { ok: false, blad: 'tryb musi być wyscig albo tury' };
    const pseudonim = String(dane.organizator?.pseudonim ?? '').trim();
    if (!pseudonim) return { ok: false, blad: 'pseudonim organizatora jest wymagany' };
    const k = dane.konfiguracja ?? {};
    if (!(k.liczbaStacji > 0) || !(k.pytaniaNaStacje > 0) || typeof k.wiek !== 'string'
      || !Array.isArray(k.tematy) || !k.tematy.length || typeof k.miejsce !== 'string'
      || typeof k.geohash5 !== 'string' || k.geohash5.length !== 5) {
      return { ok: false, blad: 'konfiguracja gry niekompletna' };
    }
    const z = dane.zestaw ?? {};
    if (!Array.isArray(z.stacje) || !z.stacje.length || z.kontener?.schemat !== 'TO-paczka/2' || !z.meta) {
      return { ok: false, blad: 'zestaw gry wymaga stacji, kontenera TO-paczka/2 i metadanych' };
    }
    if (z.stacje.length !== k.liczbaStacji) return { ok: false, blad: 'liczba stacji zestawu nie zgadza się z konfiguracją' };
    const teraz = new Date().toISOString();
    const gra = {
      schemat: 'RO-gra/1', kod: generujKod(), idGry: `plik-${gry.size + 1}`, tryb: dane.tryb,
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
      if (gra.tryb === 'tury') {
        const czyj = biezacyGraczTury(gra);
        if (czyj !== z.graczId) return { ok: false, blad: `teraz jest tura gracza ${czyj} — poczekaj na swoją kolej` };
      }
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
      gra.wyniki = przeliczWyniki(gra);
      gra.stan = 'zakonczona';
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

async function noweUrzadzenie({ pamiec = new Map(), most }) {
  // Adres mostu nie jest wpisywany w UI (ADR 0020) — telefon ma go w pamięci albo w kodzie aplikacji.
  if (!pamiec.has('okolica:multi:url-mostu')) pamiec.set('okolica:multi:url-mostu', URL_MOSTU);
  globalThis.fetch = most.fetchImpl; // sync.js czyta globalThis.fetch (wstrzykiwalny fetchImpl)
  const dom = zainstalujDom({ search: '?tryb=test&odstep=0', pamiec });
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
async function zmien(u, id) {
  przelaczNa(u);
  const el = u.dom.pobierz(id);
  for (const fn of el.zdarzenia.change ?? []) fn({ type: 'change', target: el, currentTarget: el });
  await oddech();
}
function tekst(u, id) { przelaczNa(u); return u.dom.pobierz(id).textContent; }
function el(u, id) { przelaczNa(u); return u.dom.pobierz(id); }

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

function paczkaTestowa(stacje) {
  return {
    protokol: WERSJA_PROTOKOLU,
    okolica: { lat: stacje[0].lat, lon: stacje[0].lon, promienM: 1000, miejsce: 'Podkowa Leśna' },
    wiek: 'dorosli', tematy: ['historia'], jezyk: 'polski', utworzono: '2026-09-06 10:00',
    pytania: stacje.map((s) => ({
      id: `s${s.id}p1`, stacja: s.id, temat: 'historia',
      tresc: `Co wydarzyło się przy stacji ${s.id}?`,
      odpowiedzi: ['to', 'tamto', 'owo', 'nic'], poprawna: 0,
      wyjasnienie: 'Bo tak wynika ze źródeł.',
      zrodla: [{ url: 'https://pl.wikipedia.org/wiki/Podkowa_Le%C5%9Bna', tytul: 'Podkowa Leśna — Wikipedia', sprawdzono: '2026-09-06' }],
      punkty: 20,
    })),
  };
}

/** Zestaw lokalny w pamięci telefonu (rejestr + wpis) — źródło „z tego telefonu". */
function zasiejZestaw(pamiec, ileStacji) {
  const stacje = stacjeTestowe(ileStacji);
  const kontener = zapakujPaczke(paczkaTestowa(stacje), WERSJA_PROTOKOLU);
  const meta = zbierzMetaZestawu({
    lat: PODKOWA.lat, lon: PODKOWA.lon, promienM: 1000, tematy: ['historia'], wiek: 'dorosli',
    jezyk: 'polski', miejsce: 'Podkowa Leśna', liczbaStacji: stacje.length, pytaniaNaStacje: 1,
  });
  pamiec.set(kluczZestawu(kontener.skrot), JSON.stringify({ schemat: SCHEMAT_LOKALNY, stacje, kontener, ...meta, kodGry: 'MULTITEST' }));
  const rejestr = nowyRejestr();
  rejestr.wpisy = [{ skrot: kontener.skrot, ...meta, kodGry: 'MULTITEST' }];
  pamiec.set(KLUCZ_REJESTRU, JSON.stringify(rejestr));
  return { stacje, kontener, meta };
}

/** Tożsamość + pozycja (ręczna, tryb testowy) — telefon gotowy do gry (adres mostu: ADR 0020). */
async function przygotujTelefon(u, pseudonim) {
  ustaw(u, 'multi-pseudonim', pseudonim);
  ustaw(u, 'setup-lat', String(PODKOWA.lat));
  ustaw(u, 'setup-lon', String(PODKOWA.lon));
  await klik(u, 'przycisk-ustaw-reczne');
}

async function zalozGreUI(u, { tryb = 'wyscig', skrot }) {
  await klik(u, 'przycisk-multi-zaloz'); // walidacja (pseudonim, zgoda, most) → panel „załóż"
  assert.equal(el(u, 'multi-panel-zaloz').hidden, false, 'panel zakładania widoczny');
  if (tryb === 'tury') {
    przelaczNa(u);
    const przyciskTury = [...u.dom.pobierz('multi-tryby').children].find((b) => b.textContent.includes('Tury'));
    assert.ok(przyciskTury, 'przycisk trybu „Tury" w segmencie');
    kliknijEl(przyciskTury);
    await oddech();
  }
  ustaw(u, 'multi-zrodlo', `lokalna:${skrot}`);
  await zmien(u, 'multi-zrodlo');
  assert.match(tekst(u, 'multi-zaloz-info'), /paczka z tego telefonu/, 'źródło wczytane');
  await klik(u, 'przycisk-zaloz-gre');
  assert.match(tekst(u, 'lobby-kod'), /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/, 'kod gry w lobby');
}

async function dolaczKodemUI(u, kod) {
  await klik(u, 'przycisk-multi-dolacz');
  ustaw(u, 'multi-kod', kod);
  await klik(u, 'przycisk-dolacz-kod');
  assert.equal(el(u, 'multi-panel-lobby').hidden, false, 'gość trafił do lobby');
}

/** Odcinek od startu do „następna stacja": droga + ręczne dojście + poprawna odpowiedź. */
async function przejdzStacje(u) {
  await klik(u, 'przycisk-start-odcinka');
  assert.equal(el(u, 'gra-panel-odcinek').hidden, false, 'panel drogi widoczny');
  await klik(u, 'przycisk-reczne-dojscie'); // POST dojscie (trybDojscia: reczne)
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

test('wyścig end-to-end: załóż → dołącz przez lobby → start → droga offline z kolejką → wyniki po obu stronach', async () => {
  // urządzenie A: organizator
  const pamiecA = new Map();
  const zestawA = zasiejZestaw(pamiecA, 2);
  const A = await noweUrzadzenie({ pamiec: pamiecA, most: mostWyscig });
  await przygotujTelefon(A, 'Ala');
  await zalozGreUI(A, { tryb: 'wyscig', skrot: zestawA.kontener.skrot });
  kodWyscigu = tekst(A, 'lobby-kod');
  assert.equal(el(A, 'przycisk-lobby-start').hidden, false, 'organizator widzi przycisk startu');
  assert.match(tekst(A, 'lobby-tryb'), /Wyścig/, 'tryb widoczny w lobby');

  // urządzenie B: gość dołącza PRZEZ LISTĘ LOBBY (bez kodu)
  const B = await noweUrzadzenie({ most: mostWyscig });
  await przygotujTelefon(B, 'Bartek');
  await klik(B, 'przycisk-multi-dolacz');
  const wierszeLobby = el(B, 'multi-lobby-lista').children;
  assert.equal(wierszeLobby.length, 1, 'jedna otwarta gra w lobby');
  assert.match(wierszeLobby[0].textContent, /Podkowa Leśna · wyścig · 1\/8 graczy · organizator: Ala · ok\. \d+(\.\d+)? km/, 'opis gry z miejscem, trybem, organizatorem i odległością od środka komórki geohash');
  kliknijEl(wierszeLobby[0].children[1]); // „Dołącz"
  await oddech();
  assert.equal(el(B, 'multi-panel-lobby').hidden, false, 'gość w lobby');
  assert.equal(tekst(B, 'lobby-kod'), kodWyscigu, 'ten sam kod gry');

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
  await klik(B, 'przycisk-reczne-dojscie'); // nie wyjdzie — kolejka
  przelaczNa(B);
  kliknijEl(B.dom.pobierz('gra-odpowiedzi').children[0]);
  await oddech();
  assert.match(tekst(B, 'gra-multi-sync'), /2 zdarzeń czeka w kolejce/, 'pasek synchronizacji mówi o kolejce offline');
  assert.match(tekst(B, 'status'), /kolejce/, 'gracz wie, że zdarzenia czekają');
  mostWyscig.online = true;
  await przepompuj(B, 1); // krok: stan + flush kolejki (FIFO)
  const gra = mostWyscig.znajdz(kodWyscigu);
  const zdarzeniaB = gra.zdarzenia.filter((z) => z.graczId === 'g-2');
  assert.deepEqual(zdarzeniaB.map((z) => z.typ), ['dojscie', 'odpowiedz'], 'kolejka wyszła w kolejności FIFO');
  await klik(B, 'przycisk-nastepna-stacja');

  // stacja 2: oboje online — po ostatniej odpowiedzi serwer domyka grę
  await przejdzStacje(A); // A kończy swój zestaw → lokalny ekran wyniku
  await przepompuj(B, 1);
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
  assert.equal(wyniki['g-1'].stacjeZamkniete, 2, 'Ala zamknęła 2 stacje');
  assert.equal(wyniki['g-2'].stacjeZamkniete, 2, 'Bartek zamknął 2 stacje (w tym z kolejki offline)');
  assert.equal(wyniki['g-1'].poprawne, 2, 'obie odpowiedzi Ali poprawne');
});

const mostTury = atrapaMostu();
let kodTur = null;

test('tury end-to-end: dołącz kodem → bramka tury → resume po odświeżeniu → wyniki', async () => {
  // A zakłada grę na 4 stacje (tury: A ma 1 i 3, B ma 2 i 4)
  const pamiecA = new Map();
  const zestawA = zasiejZestaw(pamiecA, 4);
  const A = await noweUrzadzenie({ pamiec: pamiecA, most: mostTury });
  await przygotujTelefon(A, 'Celina');
  await zalozGreUI(A, { tryb: 'tury', skrot: zestawA.kontener.skrot });
  kodTur = tekst(A, 'lobby-kod');

  // B dołącza KODEM (druga ścieżka parowania)
  const pamiecB = new Map();
  const B = await noweUrzadzenie({ pamiec: pamiecB, most: mostTury });
  await przygotujTelefon(B, 'Czarek');
  await dolaczKodemUI(B, kodTur);
  assert.equal(tekst(B, 'lobby-kod'), kodTur, 'kod przepisany z telefonu na telefon');

  await klik(A, 'przycisk-lobby-start');
  await przepompuj(B, 1);
  assert.equal(el(B, 'ekran-gra').hidden, false, 'B wystartował');
  assert.equal(tekst(B, 'gra-postep'), 'stacja 1 z 2', 'w turach B ma swoje 2 z 4 stacji');

  // bramka tury: teraz idzie A — B nie zacznie odcinka (odmowa lokalna, R08 pilnuje serwer)
  await klik(B, 'przycisk-start-odcinka');
  assert.match(tekst(B, 'status'), /Teraz idzie: Celina/, 'jawna odmowa: czyja jest tura');
  assert.equal(el(B, 'gra-panel-odcinek').hidden, true, 'odcinek B nie ruszył');
  assert.match(tekst(B, 'gra-multi-tura'), /Teraz idzie: Celina/, 'panel tur mówi, kto idzie');

  // A zamyka stację 1 → tura przechodzi na B
  await przejdzStacje(A);
  await przepompuj(B, 1);
  assert.match(tekst(B, 'gra-multi-tura'), /Twoja tura/, 'B widzi swoją turę po odświeżeniu');
  await klik(B, 'przycisk-start-odcinka');
  assert.equal(el(B, 'gra-panel-odcinek').hidden, false, 'w swojej turze B rusza');
  await klik(B, 'przycisk-reczne-dojscie');
  przelaczNa(B);
  kliknijEl(B.dom.pobierz('gra-odpowiedzi').children[0]);
  await oddech();
  await klik(B, 'przycisk-nastepna-stacja');

  // RESUME: telefon B „odświeżony" (nowa instalacja DOM, TA SAMA pamięć)
  const B2 = await noweUrzadzenie({ pamiec: pamiecB, most: mostTury });
  assert.equal(el(B2, 'multi-wznowienie').hidden, false, 'baner powrotu do gry widoczny po odświeżeniu');
  assert.match(tekst(B2, 'multi-wznowienie-opis'), new RegExp(kodTur), 'baner pamięta kod gry');
  await klik(B2, 'przycisk-multi-wroc');
  assert.equal(el(B2, 'ekran-gra').hidden, false, 'powrót prosto do gry');
  assert.equal(tekst(B2, 'gra-postep'), 'stacja 1 z 1', 'zamknięta stacja 2 nie wraca — została tylko 4');
  assert.match(tekst(B2, 'gra-multi-tura'), /Teraz idzie: Celina/, 'po powrocie tura znowu A (stacja 3)');

  // A zamyka 3, B2 zamyka 4 → gra kompletna
  await przepompuj(A, 1);
  await przejdzStacje(A);
  await przepompuj(B2, 1);
  assert.match(tekst(B2, 'gra-multi-tura'), /Twoja tura/, 'ostatnia tura B');
  await przejdzStacje(B2);
  assert.equal(mostTury.znajdz(kodTur).stan, 'zakonczona', 'tury domknięte po wszystkich stacjach');
  await przepompuj(A, 1);
  await przepompuj(B2, 1);
  const wyniki = mostTury.znajdz(kodTur).wyniki;
  assert.deepEqual([wyniki['g-1'].stacjeZamkniete, wyniki['g-2'].stacjeZamkniete], [2, 2], 'po dwie stacje na gracza');
  for (const u of [A, B2]) {
    assert.equal(el(u, 'gra-multi-wiersze').children.length, 2, 'tabela wyników po obu stronach');
    assert.match(tekst(u, 'gra-multi-sync'), /odświeżanie zatrzymane/, 'synchronizacja zatrzymana');
  }
  assert.equal(el(B2, 'multi-wznowienie').hidden, true, 'po zakończeniu gry baner powrotu znika (sesja wyczyszczona)');
  assert.equal(mostTury.znajdz(kodTur).zdarzenia.every((z) => !POLA_ZAKAZANE.some((p) => p in (z.dane ?? {}))), true, 'serwer nie przyjął współrzędnych w zdarzeniach');
});

test('bez zgody NIE wysyłam niczego — jawna odmowa (setup → multi)', async () => {
  const most = atrapaMostu();
  const u = await noweUrzadzenie({ most });
  await przygotujTelefon(u, 'Daria');
  przelaczNa(u);
  u.dom.pobierz('multi-zgoda').checked = false; // właściciel może odznaczyć (decyzja 2026-09-06)
  await klik(u, 'przycisk-multi-zaloz');
  assert.equal(el(u, 'bledy-multi').hidden, false, 'odmowa widoczna w polu błędów');
  assert.match(tekst(u, 'bledy-multi'), /Bez zgody/, 'komunikat mówi wprost o zgodzie');
  await klik(u, 'przycisk-multi-dolacz');
  assert.equal(most.ciala.length, 0, 'ZERO wysyłek (POST) na most bez zgody');
  assert.deepEqual(
    most.adresy.filter((a) => /[?&]akcja=(gry|gra-stan|ranking)/.test(a)),
    [],
    'żaden GET gry wieloosobowej nie poszedł (odczyt indeksu paczek jest bez zgody — ADR 0017 pkt 6)',
  );
  // po przywróceniu zgody — droga wolna (panel się otwiera)
  przelaczNa(u);
  u.dom.pobierz('multi-zgoda').checked = true;
  await klik(u, 'przycisk-multi-dolacz');
  assert.equal(el(u, 'multi-panel-dolacz').hidden, false, 'ze zgodą panel dołączania otwarty');
});

test('ADR 0020: adres mostu jest w kodzie — telefon bez wpisu w pamięci gra sieciowo od razu', async () => {
  const most = atrapaMostu();
  // pusty wpis w pamięci = brak nadpisania: telefon bierze adres z kodu (stan po wdrożeniu web app)
  const pamiec = new Map([['okolica:multi:url-mostu', '']]);
  const u = await noweUrzadzenie({ pamiec, most });
  await przygotujTelefon(u, 'Iga');
  przelaczNa(u);
  assert.match(tekst(u, 'multi-most-stan'), /podłączony/i, 'karta gry wieloosobowej: adres z kodu działa bez wpisywania');
  assert.match(tekst(u, 'most-stan-repo'), /podłączony/i, 'karta paczek mówi to samo (jedna prawda o stanie mostu)');
  await klik(u, 'przycisk-multi-zaloz');
  assert.equal(el(u, 'multi-panel-zaloz').hidden, false, 'panel zakładania otwarty — zero odmowy o adres');
  assert.doesNotMatch(tekst(u, 'bledy-multi'), /Brak adresu mostu/, 'komunikat o braku adresu nie istnieje w tej wersji');
});

test('serwer odrzuca zdarzenie poza turą (R08) — klient NIE ponawia i mówi dlaczego', async () => {
  const most = atrapaMostu();
  // gra tur na 2 stacje, dwóch graczy, wystartowana — tura g-1
  const zalozenie = await polecenieMostu(URL_MOSTU, {
    akcja: 'gra-zaloz', tryb: 'tury', organizator: { pseudonim: 'Ewa' },
    konfiguracja: { liczbaStacji: 2, pytaniaNaStacje: 1, wiek: 'dorosli', tematy: ['historia'], promienM: 1000, miejsce: 'Podkowa Leśna', geohash5: 'u3qb8' },
    zestaw: { stacje: stacjeTestowe(2), kontener: zapakujPaczke(paczkaTestowa(stacjeTestowe(2)), WERSJA_PROTOKOLU), meta: { miejsce: 'Podkowa Leśna' } },
  }, { fetchImpl: most.fetchImpl });
  const kod = zalozenie.gra.kod;
  await polecenieMostu(URL_MOSTU, { akcja: 'gra-dolacz', kod, pseudonim: 'Filip' }, { fetchImpl: most.fetchImpl });
  await polecenieMostu(URL_MOSTU, { akcja: 'gra-start', kod, organizatorId: 'g-1' }, { fetchImpl: most.fetchImpl });

  // g-2 próbuje poza turą: polecenieMostu rzuca z odmowaMostu, sync NIE kolejkuje
  const pozaTura = zbudujZdarzenie({ kod, graczId: 'g-2', typ: 'dojscie', stacjaId: 2, dane: { czasOdcinkaMs: 60000, trybDojscia: 'reczne' } });
  await assert.rejects(
    polecenieMostu(URL_MOSTU, { akcja: 'gra-zdarzenie', zdarzenie: pozaTura }, { fetchImpl: most.fetchImpl }),
    (e) => e.odmowaMostu === true && /tura gracza g-1/.test(e.message),
  );
  const bledy = [];
  const sync = utworzSynchronizacje({
    urlMostu: URL_MOSTU, graczId: 'g-2', kod, fetchImpl: most.fetchImpl,
    onBlad: (m) => bledy.push(m), timeout: { ustaw: () => 0, czysc: () => {} },
  });
  const wynik = await sync.wyslijZdarzenie(pozaTura);
  assert.equal(wynik, null, 'odmowa = brak wyniku');
  assert.equal(sync.kolejkaLength, 0, 'odmowa serwera nie ląduje w kolejce (nie ponawiamy)');
  assert.match(bledy[0], /tura gracza g-1/, 'gracz dostaje powód odmowy');
});

test('SKANER prywatności: współrzędne gracza nie wychodzą w żadnej wysyłce (ADR 0019 pkt 3)', () => {
  const WZOR_POL = /"(lat|lon|szerokosc|dlugosc|latitude|longitude)"\s*:/;
  let zbadane = 0;
  for (const [nazwa, most] of [['wyścig', mostWyscig], ['tury', mostTury]]) {
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
  for (const most of [mostWyscig, mostTury]) {
    for (const gra of most.gry.values()) {
      assert.match(gra.konfiguracja.geohash5, /^[0-9b-z]{5}$/, 'geohash5 zamiast współrzędnych w konfiguracji');
      for (const z of gra.zdarzenia) {
        assert.deepEqual(Object.keys(z.dane ?? {}).filter((k) => POLA_ZAKAZANE.includes(k)), [], 'zdarzenie bez pól zakazanych');
      }
    }
  }
});

test('uszkodzony stan z mostu: kod R w statusie, polling nie pada, po naprawie gra wraca', async () => {
  const most = atrapaMostu();
  const pamiec = new Map();
  const zestaw = zasiejZestaw(pamiec, 1);
  const A = await noweUrzadzenie({ pamiec, most });
  await przygotujTelefon(A, 'Ala');
  await zalozGreUI(A, { tryb: 'wyscig', skrot: zestaw.kontener.skrot });
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
