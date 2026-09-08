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

/**
 * Uruchamia cały skrypt mostu z atrapą Drive. `getParents()` zwraca ŻYWĄ listę
 * rodziców (jak FolderIterator w Apps Script), więc `przenies()` jest testowane
 * tak, jak działa naprawdę.
 */
export function uruchomMost() {
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
      stanGry, listaGier, rankingi, przeliczWyniki, archiwizujPrzeterminowane,
    };
  `);
  const api = fabryka(...parametry.map((k) => serwisy[k]));
  return { most: api, pliki };
}

