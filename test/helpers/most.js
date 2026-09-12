import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../..');
/** Tekst mostu — wykonywany dosłownie, bez przepisywania (LESSONS L33). */
export const GS = readFileSync(join(ROOT, 'docs/setup/apps-script-repo-paczek.gs'), 'utf8');

/**
 * Atrapa Google Drive do WYKONYWANIA tekstu `docs/setup/apps-script-repo-paczek.gs`
 * w testach (LESSONS L33). Zwraca `{ most, pliki }`: `most` to funkcje skryptu,
 * `pliki` to mapa id → surowy rekord pliku (z `nazwa`, `tresc`, `rodzice`).
 *
 * Semantyka jak w Apps Script: `getParents()`/`getFiles()` oddają ŻYWE iteratory,
 * `folder()` zakłada katalog, gdy go nie ma, a `zBlokada` działa synchronicznie.
 */

/* ------------------------------------------------------------------ atrapa */

function iterator(tab) {
  let i = 0;
  return { hasNext: () => i < tab.length, next: () => tab[i++] };
}

/** Nazwy funkcji zadeklarowane w tekście skryptu (kolejność jak w pliku). */
export function listaFunkcji(tekst) {
  return [...tekst.matchAll(/^function ([A-Za-z0-9_]+)\s*\(/gm)].map((m) => m[1]);
}

/**
 * Ciało przekazywane do `new Function`. Zwracam je osobno, bo `tools/zasieg-mostu.mjs`
 * musi wiedzieć, jakie przesunięcie ma tekst .gs względem wykonywanego skryptu,
 * żeby przełożyć pokrycie V8 na numery linii pliku.
 */
export function cialoSkryptu(bezFolder, funkcje) {
  return `
    function folder(nazwa) {
      const it = DriveApp.getFoldersByName(nazwa);
      if (it.hasNext()) return it.next();
      return DriveApp.createFolder(nazwa);
    }
    ${bezFolder}
    return { ${funkcje.join(', ')} };
  `;
}

/** Tekst .gs bez własnego `folder()` (podstawiamy atrapę) — tak jest wykonywany. */
export function tekstWykonywany() {
  return GS.replace(/^function folder\(nazwa\) \{[\s\S]*?\n\}/m, '');
}

/**
 * Uruchamia cały skrypt mostu z atrapą Drive. `getParents()` zwraca ŻYWĄ listę
 * rodziców (jak FolderIterator w Apps Script), więc `przenies()` jest testowane
 * tak, jak działa naprawdę.
 *
 * `urlSerwisu` parametryzuje atrapę `ScriptApp.getService().getUrl()` —
 * domyślnie adres `/exec`; testy odporności linku przeglądu podają `/dev`
 * albo adres starego wdrożenia (znane usterki Apps Scripta, zgłoszenie
 * właściciela 2026-09-11: „Nie udało się otworzyć pliku…").
 */
export function uruchomMost({ urlSerwisu = 'https://most.invalid/exec' } = {}) {
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
      // jak DriveApp.File: getUrl prowadzi do pliku na Dysku (awaryjna droga
      // przeglądu z maila), getName — do nazwy pliku
      getName: () => p.nazwa,
      getUrl: () => 'https://drive.example.invalid/file/d/' + p.id + '/view',
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

  // Właściwości skryptu: właściciel wpisuje je w Apps Script (OWNER_EMAIL,
  // REVIEW_SECRET). Bez nich strona przeglądu i powiadomienie są martwe.
  const wlasnosci = new Map([
    ['OWNER_EMAIL', 'wlasciciel@example.invalid'],
    ['REVIEW_SECRET', 'sekret-testowy-0123456789'],
  ]);
  const wyslaneMaile = [];
  const serwisy = {
    DriveApp,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (klucz) => (wlasnosci.has(klucz) ? wlasnosci.get(klucz) : null),
        setProperty: (klucz, wartosc) => { wlasnosci.set(klucz, String(wartosc)); },
      }),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (tekst) => ({ setMimeType: () => ({ tekst }) }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: {
      sendEmail: (adres, temat, tresc) => { wyslaneMaile.push({ adres, temat, tresc }); },
    },
    HtmlService: {
      createHtmlOutput: (html) => ({ setTitle: () => ({ html }), html }),
    },
    ScriptApp: { getService: () => ({ getUrl: () => urlSerwisu }) },
    Utilities: {
      base64Decode: (s) => Uint8Array.from(Buffer.from(s, 'base64')),
      newBlob: (bajty) => ({ getDataAsString: () => Buffer.from(bajty).toString('utf8') }),
    },
  };

  // `folder()` z atrapą zwraca obiekty z `getName`/`addFile`, więc podstawiamy
  // własną (identyczną logicznie) — reszta skryptu jest wykonywana bez zmian.
  const bezFolder = tekstWykonywany();
  const parametry = Object.keys(serwisy);
  // eslint-disable-next-line no-new-func — celowo: wykonujemy tekst skryptu, nie jego kopię
  // Lista eksportów buduje się SAMA z tekstu .gs — nowa funkcja w moście jest
  // od razu osiągalna w testach (i od razu trafia pod „przegląd" niżej).
  const funkcje = listaFunkcji(bezFolder);
  const fabryka = new Function(...parametry, cialoSkryptu(bezFolder, funkcje));
  const api = fabryka(...parametry.map((k) => serwisy[k]));
  return { most: api, pliki, funkcje, wlasnosci, wyslaneMaile };
}

/* --------------------------------------------------- fixtures paczek (wspólne) */

import { zapakujPaczke } from '../../app/kodowanie.js';

/* ----------------------------------------------------------------- fixtures */

export function zestawPrzykladowy({ stacje = 3, bezKotwicy = false, tematyMeta = null } = {}) {
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
  const wynik = {
    schemat: 'TO-zestaw/1',
    meta: {
      miejsce: 'Podkowa Leśna',
      geohash5: 'u3qb8',
      geohash6: 'u3qb8g',
      promienM: 1000,
      // `tematyMeta` odtwarza paczkę sprzed 2026-09-11: meta niosą listę
      // tematów DOPUSZCZALNYCH w setupie (szerszą niż faktyczna zawartość).
      tematy: tematyMeta || ['historia'],
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
  if (bezKotwicy) delete wynik.meta.geohash6; // paczka sprzed B19 — kotwicę trzeba oszacować
  return wynik;
}

/** Odpowiedź mostu tak, jak widzi ją aplikacja: tekst JSON. */
export function tekstOdpowiedzi(wynik) {
  return JSON.stringify(wynik);
}

export function idPoNazwie(pliki, nazwa) {
  for (const [id, plik] of pliki) if (plik.nazwa === nazwa) return id;
  return null;
}

