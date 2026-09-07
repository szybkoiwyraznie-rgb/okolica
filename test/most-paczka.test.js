/**
 * Most Drive: pełna droga paczki z repozytorium (M9b) — WYKONANIE skryptu.
 *
 * Dlaczego ten test istnieje: w `paczkaPrzezId` była literówka (`wZaakceptowanych`
 * zadeklarowane, `wZaakceptowane` czytane) — ReferenceError łapany przez `doGet`
 * zamieniał się w `{blad:"… is not defined"}`, a aplikacja mówiła tylko
 * „Plik publiczny ma inny schemat niż TO-zestaw/1" (Z07). Gracz nie miał jak
 * zgadnąć, że winny jest skrypt. Test wykonuje tekst `.gs` na atrapie Drive
 * i przechodzi całą drogę: przyjęcie → akceptacja → indeks → pobranie → walidacja
 * po stronie aplikacji. Rozjazd którejkolwiek strony widać od razu.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { zapakujPaczke } from '../app/kodowanie.js';
import { walidujZestawPublicznySurowy, walidujIndeksSurowy } from '../app/zestawy.js';

const ROOT = join(import.meta.dirname, '..');
const GS = readFileSync(join(ROOT, 'docs/setup/apps-script-repo-paczek.gs'), 'utf8');

/* ------------------------------------------------------------------ atrapa */

function iterator(tab) {
  let i = 0;
  return { hasNext: () => i < tab.length, next: () => tab[i++] };
}

/**
 * Uruchamia cały skrypt mostu z atrapą Drive. `getParents()` zwraca ŻYWĄ listę
 * rodziców (jak FolderIterator w Apps Script), więc `przenies()` jest testowane
 * tak, jak działa naprawdę.
 */
function uruchomMost() {
  const foldery = new Map();
  const pliki = new Map();
  let licznik = 0;

  const surowyFolder = (nazwa) => {
    if (!foldery.has(nazwa)) foldery.set(nazwa, { nazwa, pliki: new Set() });
    return foldery.get(nazwa);
  };
  const surowyPlik = (id, tresc) => {
    const p = { id, tresc, nazwa: '', rodzice: new Set() };
    pliki.set(id, p);
    return p;
  };

  const apiFolder = (f) => ({
    getName: () => f.nazwa,
    getFiles: () => iterator([...f.pliki].map(apiPlik)),
    getFilesByName: (nazwa) => iterator([...f.pliki].filter((p) => p.nazwa === nazwa).map(apiPlik)),
    createFile(nazwa, tresc) {
      licznik += 1;
      const p = surowyPlik(`ID${licznik}`, tresc);
      p.nazwa = nazwa;
      f.pliki.add(p);
      p.rodzice.add(f);
      return apiPlik(p);
    },
    addFile(opakowany) {
      const p = opakowany.surowy;
      f.pliki.add(p);
      p.rodzice.add(f);
    },
    removeFile(opakowany) {
      const p = opakowany.surowy;
      f.pliki.delete(p);
      p.rodzice.delete(f);
    },
  });

  function apiPlik(p) {
    return {
      surowy: p,
      getId: () => p.id,
      getBlob: () => ({ getDataAsString: () => p.tresc }),
      setContent: (t) => { p.tresc = t; },
      getParents: () => iterator([...p.rodzice].map(apiFolder)),
    };
  }

  const DriveApp = {
    getFoldersByName: (n) => iterator(foldery.has(n) ? [apiFolder(foldery.get(n))] : []),
    createFolder: (n) => apiFolder(surowyFolder(n)),
    getFileById: (id) => {
      const p = pliki.get(id);
      if (!p) throw new Error('nie ma pliku o takim identyfikatorze');
      return apiPlik(p);
    },
  };

  const serwisy = {
    DriveApp,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (tekst) => ({ setMimeType: () => ({ tekst }) }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { sendEmail() {} },
    HtmlService: {
      createHtmlOutput: (html) => ({ setTitle: () => ({ html }), html }),
    },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://most.invalid/exec' }) },
    Utilities: {
      base64Decode: (s) => Uint8Array.from(Buffer.from(s, 'base64')),
      newBlob: (bajty) => ({ getDataAsString: () => Buffer.from(bajty).toString('utf8') }),
    },
  };

  // `folder()` z atrapą zwraca obiekty z `getName`/`addFile`, więc podstawiamy
  // własną (identyczną logicznie) — reszta skryptu jest wykonywana bez zmian.
  const bezFolder = GS.replace(/^function folder\(nazwa\) \{[\s\S]*?\n\}/m, '');
  const parametry = Object.keys(serwisy);
  // eslint-disable-next-line no-new-func — celowo: wykonujemy tekst skryptu, nie jego kopię
  const fabryka = new Function(...parametry, `
    function folder(nazwa) {
      const it = DriveApp.getFoldersByName(nazwa);
      if (it.hasNext()) return it.next();
      return DriveApp.createFolder(nazwa);
    }
    ${bezFolder}
    return {
      doGet, doPost, setup, przyjmijKandydata, zatwierdz, odrzuc, budujIndeks,
      paczkaPrzezId, przenies, zalozGre, dolaczDoGry, startGryMulti,
      przyjmijZdarzenie, zakonczGre, przyjmijGreHotseat, ustawProfil, sprawdzProfil,
    };
  `);
  const api = fabryka(...parametry.map((k) => serwisy[k]));
  return { most: api, pliki };
}

/* ----------------------------------------------------------------- fixtures */

function zestawPrzykladowy({ stacje = 3 } = {}) {
  const paczka = {
    schemat: 'PYT/1.0.6',
    pytania: Array.from({ length: stacje }, (_, i) => ({
      id: `s${i + 1}p1`,
      stacja: i + 1,
      temat: 'historia',
      tresc: `Pytanie ${i + 1}?`,
      odpowiedzi: ['a', 'b', 'c', 'd'],
      poprawna: 17 + (i + 1) + (i + 1) + 1,
      wyjasnienie: 'bo tak',
      zrodla: [{ tytul: 'Źródło', url: 'https://przyklad.invalid/x' }],
    })),
  };
  return {
    schemat: 'TO-zestaw/1',
    meta: {
      miejsce: 'Podkowa Leśna',
      geohash5: 'u3qb8',
      geohash6: 'u3qb8g',
      promienM: 1000,
      tematy: ['historia'],
      wiek: 'dorosli',
      liczbaStacji: stacje,
      pytaniaNaStacje: 1,
      licencja: 'CC BY 4.0',
      przegladZrodel: 'przejrzane 2026-09-01',
      data: '2026-09-01',
      autor: 'Jan',
    },
    stacje: Array.from({ length: stacje }, (_, i) => ({
      id: i + 1,
      lat: 52.12 + i * 0.002,
      lon: 20.74 + i * 0.002,
      opis: `stacja ${i + 1}`,
    })),
    kontener: zapakujPaczke(paczka, 'PYT/1.0.6'),
  };
}

/** Odpowiedź mostu tak, jak widzi ją aplikacja: tekst JSON. */
function tekstOdpowiedzi(wynik) {
  return JSON.stringify(wynik);
}

/* -------------------------------------------------------------------- testy */

test('most: paczka z repozytorium przechodzi całą drogę i aplikacja ją przyjmuje', () => {
  const { most, pliki } = uruchomMost();
  const zestaw = zestawPrzykladowy();

  const przyjeta = most.przyjmijKandydata(zestaw);
  assert.equal(przyjeta.ok, true, `przyjęcie do przeglądu: ${JSON.stringify(przyjeta)}`);
  assert.equal(przyjeta.status, 'przyjeta-do-przegladu');

  const indeksPrzed = walidujIndeksSurowy(tekstOdpowiedzi(most.budujIndeks()));
  assert.equal(indeksPrzed.indeks.length, 0, 'paczka w przeglądzie NIE jest proponowana graczom');

  // Id pliku bierzemy tak, jak bierze je właściciel: z linku przeglądu.
  const idPliku = idPoNazwie(pliki, przyjeta.nazwa);
  assert.ok(idPliku, 'plik paczki leży w katalogu przeglądu');
  assert.equal(most.zatwierdz(idPliku), 'zaakceptowano');

  const indeksPo = walidujIndeksSurowy(tekstOdpowiedzi(most.budujIndeks()));
  assert.equal(indeksPo.usterki.length, 0, 'indeks bez usterek');
  assert.equal(indeksPo.indeks.length, 1, 'po akceptacji paczka jest w indeksie');
  const wpis = indeksPo.indeks[0];
  assert.equal(wpis.id, idPliku, 'wpis indeksu niesie id pliku Drive');
  assert.equal(wpis.geohash6, 'u3qb8g', 'kotwica geohash6 z meta (B19)');

  // Dokładnie to robi aplikacja po kliknięciu „Graj z tą paczką".
  const pobrane = walidujZestawPublicznySurowy(tekstOdpowiedzi(most.paczkaPrzezId(wpis.id)));
  assert.deepEqual(pobrane.usterki, [], 'pobrana paczka jest kompletna (regresja po literówce w paczkaPrzezId)');
  assert.equal(pobrane.zestaw.schemat, 'TO-zestaw/1');
  assert.deepEqual(pobrane.zestaw.kontener, zestaw.kontener, 'kontener pytań dojechał bez zmian');
  assert.equal(pobrane.zestaw.stacje.length, 3);
});

test('most: paczka spoza katalogu zaakceptowanych dostaje jawny powód', () => {
  const { most, pliki } = uruchomMost();
  const przyjeta = most.przyjmijKandydata(zestawPrzykladowy({ stacje: 2 }));
  const idPliku = idPoNazwie(pliki, przyjeta.nazwa);

  const odpowiedz = most.paczkaPrzezId(idPliku);
  assert.equal(odpowiedz.blad, 'ta paczka nie jest zaakceptowana');

  // Gracz ma zobaczyć powód z mostu, a nie „inny schemat" (Z07 bez wyjaśnienia).
  const { zestaw, usterki } = walidujZestawPublicznySurowy(tekstOdpowiedzi(odpowiedz));
  assert.equal(zestaw, null);
  assert.equal(usterki[0].kod, 'Z11', 'kod mówi, że odmówił most');
  assert.match(usterki[0].komunikat, /nie jest zaakceptowana/, 'komunikat cytuje most');
});

test('most: żadna akcja nie odpowiada błędem wykonania skryptu', () => {
  const { most } = uruchomMost();
  const gety = ['indeks', 'paczka', 'gry', 'gra-stan', 'ranking', 'przeglad', 'nieznana'];
  for (const akcja of gety) {
    const odp = most.doGet({ parameter: { akcja, id: 'BRAK', kod: 'BRAK', token: 'BRAK' } });
    assert.equal(/is not defined/.test(odp.tekst), false, `doGet ${akcja}: ${odp.tekst}`);
  }
  const posty = ['gra-zaloz', 'gra-dolacz', 'gra-start', 'gra-zdarzenie', 'gra-zakoncz',
    'gra-hotseat', 'profil-ustaw', 'profil-sprawdz', 'nieznana'];
  for (const akcja of posty) {
    const odp = most.doPost({ postData: { contents: JSON.stringify({ akcja }) } });
    assert.equal(/is not defined/.test(odp.tekst), false, `doPost ${akcja}: ${odp.tekst}`);
  }
});

/** Id pliku po nazwie — tak właściciel dostaje je w linku z e-maila. */
function idPoNazwie(pliki, nazwa) {
  for (const [id, plik] of pliki) if (plik.nazwa === nazwa) return id;
  return null;
}
