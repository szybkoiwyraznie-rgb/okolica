/**
 * Most Drive: wyniki gry wieloosobowej (ADR 0027 część B).
 *
 * `przeliczWyniki` istnieje w dwóch miejscach — w moście (`gra.wyniki`, które
 * dostają wszyscy gracze) i w aplikacji (`app/wieloosobowa.js`, podgląd na żywo).
 * Rozjazd oznaczałby, że telefon pokazuje inny wynik niż Drive, więc test
 * WYKONUJE tekst funkcji ze skryptu i porównuje z implementacją aplikacji na
 * tych samych grach. Premia za kolejność (pierwszy G−1, …, ostatni 0) musi
 * wychodzić identycznie po obu stronach.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { przeliczWyniki as przeliczWynikiKlient, premiaZaKolejnosc as premiaKlient } from '../app/wieloosobowa.js';

const ROOT = join(import.meta.dirname, '..');
const GS = readFileSync(join(ROOT, 'docs/setup/apps-script-repo-paczek.gs'), 'utf8');

/** Wycina ze skryptu `premiaZaKolejnosc` + `przeliczWyniki` i zwraca je jako funkcje. */
function wynikiMostu() {
  const start = GS.indexOf('/**\n * Premia za kolejność ukończenia');
  const koniec = GS.indexOf('/** POST gra-zdarzenie:', start);
  assert.ok(start >= 0 && koniec > start, 'skrypt mostu ma premię i przeliczWyniki obok siebie');
  // eslint-disable-next-line no-new-func — celowo: wykonujemy tekst skryptu, nie jego kopię
  return new Function(`${GS.slice(start, koniec)}; return { premiaZaKolejnosc, przeliczWyniki };`)();
}

const { premiaZaKolejnosc: premiaMost, przeliczWyniki: przeliczWynikiMost } = wynikiMostu();

/** Gra wyścigowa; `odpowiedz` nadaje rosnącą `kolejnosc` tak jak `przyjmijZdarzenie`. */
function graWyscig({ liczbaGraczy = 4, stan = 'zakonczona', liczbaStacji = 3 } = {}) {
  return {
    schemat: 'RO-gra/1',
    kod: 'K2H7QM',
    tryb: 'wyscig',
    stan,
    organizatorId: 'g-1',
    gracze: Array.from({ length: liczbaGraczy }, (_, i) => ({ id: `g-${i + 1}`, pseudonim: `Gracz ${i + 1}`, dolaczyl: `t${i}` })),
    konfiguracja: { liczbaStacji, pytaniaNaStacje: liczbaGraczy, wiek: 'dorosli', tematy: ['historia'], promienM: 1000, miejsce: 'Podkowa Leśna', geohash5: 'u3qb8' },
    zdarzenia: [],
  };
}

let licznik = 0;
function odpowiedz(gra, graczId, stacjaId, { poprawna = true } = {}) {
  licznik += 1;
  gra.zdarzenia.push({
    kolejnosc: licznik, graczId, typ: 'odpowiedz', stacjaId,
    dane: { poprawna, punktyRazem: poprawna ? 1 : 0, czasOdcinkaMs: 60_000 }, tSerwera: `t${licznik}`,
  });
  return gra;
}

function dojście(gra, graczId, stacjaId) {
  licznik += 1;
  gra.zdarzenia.push({ kolejnosc: licznik, graczId, typ: 'dojscie', stacjaId, dane: { czasOdcinkaMs: 45_000 }, tSerwera: `t${licznik}` });
  return gra;
}

function zakonczWszystkie(gra, graczId) {
  for (let st = 1; st <= gra.konfiguracja.liczbaStacji; st += 1) {
    dojście(gra, graczId, st);
    odpowiedz(gra, graczId, st);
  }
  return gra;
}

function rezygnacja(gra, graczId) {
  licznik += 1;
  gra.zdarzenia.push({ kolejnosc: licznik, graczId, typ: 'rezygnacja', dane: { powod: 'test' }, tSerwera: `t${licznik}` });
  return gra;
}

test('premia w moście = premia w aplikacji (kopia pilnowana testem)', () => {
  const scenariusze = [
    ['czterech kończy w kolejności g-2, g-4, g-1, g-3', (g) => ['g-2', 'g-4', 'g-1', 'g-3'].forEach((id) => zakonczWszystkie(g, id))],
    ['dwóch kończy, trzeci rezygnuje', (g) => { zakonczWszystkie(g, 'g-3'); zakonczWszystkie(g, 'g-1'); rezygnacja(g, 'g-2'); }],
    ['gospodarz kończy przy jednym skończonym', (g) => { zakonczWszystkie(g, 'g-2'); odpowiedz(g, 'g-1', 1); }],
    ['nikt nie skończył', (g) => { odpowiedz(g, 'g-1', 1); odpowiedz(g, 'g-2', 2); }],
    ['jeden gracz (solo)', (g) => zakonczWszystkie(g, 'g-1')],
  ];
  for (const [opis, buduj] of scenariusze) {
    licznik = 0;
    const gra = graWyscig({ liczbaGraczy: opis.includes('solo') ? 1 : 4 });
    buduj(gra);
    assert.deepEqual(
      premiaMost(gra),
      premiaKlient(gra),
      `premia się rozjeżdża dla scenariusza: ${opis}`,
    );
  }
});

test('wyniki mostu = wyniki aplikacji: punkty z premią, poprawne, odcinki, rezygnacje', () => {
  licznik = 0;
  const gra = graWyscig({ liczbaGraczy: 3, stan: 'trwa' });
  zakonczWszystkie(gra, 'g-2'); // 1. miejsce → premia 2
  odpowiedz(gra, 'g-1', 1, { poprawna: false });
  dojście(gra, 'g-1', 2);
  rezygnacja(gra, 'g-3');

  // gra się toczy: premia policzona, ale poza punktami — po obu stronach tak samo
  assert.deepEqual(przeliczWynikiMost(gra), przeliczWynikiKlient(gra), 'wyniki w trakcie gry');
  assert.equal(przeliczWynikiMost(gra)['g-2'].premia, 2, 'premia pierwszego = G−1 = 2');
  assert.equal(przeliczWynikiMost(gra)['g-2'].punkty, 3, 'w trakcie gry punkty bez premii');

  gra.stan = 'zakonczona';
  assert.deepEqual(przeliczWynikiMost(gra), przeliczWynikiKlient(gra), 'wyniki końcowe');
  assert.equal(przeliczWynikiMost(gra)['g-2'].punkty, 5, 'podsumowanie: 3 pkt + premia 2');
  assert.equal(przeliczWynikiMost(gra)['g-1'].punkty, 0, 'błędna odpowiedź = 0 pkt, brak premii');
  assert.equal(przeliczWynikiMost(gra)['g-1'].bledne, 1);
  assert.equal(przeliczWynikiMost(gra)['g-1'].czasOdcinkowMs, 45_000, 'czas odcinka z dojścia');
  assert.equal(przeliczWynikiMost(gra)['g-3'].zrezygnowal, true);
  assert.equal(przeliczWynikiMost(gra)['g-3'].premia, 0, 'rezygnujący bez premii');
});

test('most ustawia stan PRZED policzeniem wyników — inaczej premia nie wchodzi do punktów', () => {
  const cialo = GS.slice(GS.indexOf('function przyjmijZdarzenie')); // ostatnia funkcja skryptu
  const stanIdx = cialo.indexOf("gra.stan = 'zakonczona'");
  const wynikiIdx = cialo.indexOf('gra.wyniki = przeliczWyniki(gra)');
  assert.ok(stanIdx >= 0 && wynikiIdx > stanIdx, 'w przyjmijZdarzenie stan idzie przed wynikami');
});

/* ------- hot-seat: gra z jednego telefonu zapisana na Drive (ADR 0026 aneks) - */

/** Minimalna atrapa Drive: katalogi są domniemane, pliki to wpisy w Mapie. */
function atrapaDrive() {
  const pliki = new Map();
  let licznik = 0;
  const iter = (lista) => {
    let i = 0;
    return { hasNext: () => i < lista.length, next: () => lista[i++] };
  };
  const plikApi = (p) => ({
    getId: () => p.id,
    getBlob: () => ({ getDataAsString: () => p.zawartosc }),
    setContent: (tekst) => { p.zawartosc = tekst; },
    getParents: () => iter([...p.foldery].map((n) => ({ removeFile: () => p.foldery.delete(n) }))),
  });
  const wFolderze = (nazwa) => [...pliki.values()].filter((p) => p.foldery.has(nazwa));
  const folderApi = (nazwa) => ({
    createFile(nazwaPliku, zawartosc) {
      licznik += 1;
      const p = { id: `plik-${licznik}`, nazwa: nazwaPliku, foldery: new Set([nazwa]), zawartosc };
      pliki.set(p.id, p);
      return plikApi(p);
    },
    getFiles: () => iter(wFolderze(nazwa).map(plikApi)),
    getFilesByName: (n) => iter(wFolderze(nazwa).filter((p) => p.nazwa === n).map(plikApi)),
  });
  const nazwyFolderow = () => [...new Set([...pliki.values()].flatMap((p) => [...p.foldery]))];
  const DriveApp = {
    getFoldersByName: (n) => iter(nazwyFolderow().filter((x) => x === n).map(folderApi)),
    createFolder: (n) => folderApi(n),
    getFileById: (id) => {
      if (!pliki.has(id)) throw new Error('brak pliku o tym id');
      return plikApi(pliki.get(id));
    },
  };
  return { DriveApp, pliki };
}

/** Wykonuje tekst sekcji gier z mostu (z hot-seat) na atrapach Drive i blokady. */
function mostHotseat() {
  const start = GS.indexOf('/* --------------------------------------- gry wieloosobowe');
  const koniec = GS.indexOf('function stanGry(kod, idGry)');
  assert.ok(start >= 0 && koniec > start, 'sekcja gier w moście istnieje');
  // `FOLDERY` żyje na początku pliku — bierzemy jego tekst, nie kopię z głowy.
  const sFoldery = GS.indexOf('const FOLDERY = {');
  const koniecFoldery = GS.indexOf('};', sFoldery) + 2;
  assert.ok(sFoldery >= 0 && koniecFoldery > sFoldery, 'most ma katalogi FOLDERY');
  // `folder()` mieszka w sekcji infrastruktury — bez niej nie ma gdzie zapisać.
  const sFolder = GS.indexOf('function folder(nazwa) {');
  const koniecFolder = GS.indexOf('/** Jednorazowo:', sFolder);
  assert.ok(sFolder >= 0 && koniecFolder > sFolder, 'most ma funkcję folder()');
  const { DriveApp, pliki } = atrapaDrive();
  const LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
  // eslint-disable-next-line no-new-func — celowo: wykonujemy tekst skryptu, nie jego kopię
  const api = new Function('DriveApp', 'LockService', `${GS.slice(sFoldery, koniecFoldery)}\n${GS.slice(sFolder, koniecFolder)}\n${GS.slice(start, koniec)}; return { przyjmijGreHotseat, bledyGryHotseat, rankingi, przeliczWyniki, premiaZaKolejnosc, FOLDERY };`)(DriveApp, LockService);
  return { ...api, pliki };
}

/** Polecenie `gra-hotseat` takie, jakie buduje `graHotseatDoWysylki` w aplikacji. */
function polecenieHotseat({ gracze = ['Ala', 'Jan'], stacje = 2, poprawne = true } = {}) {
  const zdarzenia = [];
  gracze.forEach((pseudonim, i) => {
    for (let st = 1; st <= stacje; st += 1) {
      zdarzenia.push({ schemat: 'RO-zdarzenie/1', graczId: i + 1, typ: 'dojscie', stacjaId: st, dane: { trybDojscia: 'gps' } });
      zdarzenia.push({ schemat: 'RO-zdarzenie/1', graczId: i + 1, typ: 'odpowiedz', stacjaId: st, dane: { poprawna: poprawne, punktyRazem: poprawne ? 10 : 0 } });
    }
  });
  return {
    akcja: 'gra-hotseat',
    tryb: 'hotseat',
    konfiguracja: { miejsce: 'Podkowa Leśna', geohash5: 'u3qb8', wiek: 'dorosli', tematy: ['historia'], liczbaStacji: stacje, pytaniaNaStacje: 1 },
    gracze: gracze.map((pseudonim, i) => ({ id: i + 1, pseudonim })),
    zdarzenia,
  };
}

test('most: gra-hotseat zapisuje grę zakończoną i wchodzi do tych samych rankingów', () => {
  const most = mostHotseat();
  const wynik = most.przyjmijGreHotseat(polecenieHotseat({ poprawne: true }));
  assert.equal(wynik.ok, true, `zapis przyjęty (${wynik.blad ?? ''})`);
  assert.equal(Object.keys(wynik.wyniki).length, 2, 'wynik per gracz');
  assert.equal(wynik.wyniki[1].punkty, 20, '2 stacje × 10 pkt liczone przez most, nie przez telefon');
  assert.equal(wynik.wyniki[1].premia, 0, 'hot-seat nie ma premii za kolejność (gracze idą razem)');

  const zapis = JSON.parse([...most.pliki.values()][0].zawartosc);
  assert.equal(zapis.schemat, 'RO-gra/1', 'to zwykła gra — rankingi czytają ją bez zmian');
  assert.equal(zapis.stan, 'zakonczona');
  assert.equal(zapis.tryb, 'hotseat');
  assert.equal(zapis.zestaw, null, 'paczka i pytania nie wchodzą na Drive (ADR 0013)');
  assert.equal(zapis.kod, null, 'hot-seat nie ma kodu do podyktowania');
  assert.equal(zapis.konfiguracja.geohash5, 'u3qb8', 'okolica jako geohash5, nie punkt');
  assert.equal(/"(lat|lon)"/.test(JSON.stringify(zapis)), false, 'zero współrzędnych w zapisie gry');

  const ranking = most.rankingi();
  assert.equal(ranking.schemat, 'RO-ranking/1');
  assert.equal(ranking.wiersze.length, 2, 'obaj gracze są w rankingu');
  assert.deepEqual(ranking.wiersze.map((w) => w.pseudonim).sort(), ['Ala', 'Jan']);
  assert.equal(ranking.wiersze[0].tryb, 'hotseat', 'ranking widzi tryb gry');
  assert.equal(ranking.wiersze[0].miejsce, 'Podkowa Leśna');
});

test('most: gra-hotseat kasuje współrzędne ze zdarzeń i odmawia śmieciom', () => {
  const most = mostHotseat();
  const zWspolrzednymi = polecenieHotseat();
  zWspolrzednymi.zdarzenia[0].dane.lat = 52.2297;
  zWspolrzednymi.zdarzenia[0].dane.lon = 21.0122;
  const zapisane = most.przyjmijGreHotseat(zWspolrzednymi);
  assert.equal(zapisane.ok, true);
  const gra = JSON.parse([...most.pliki.values()][0].zawartosc);
  assert.deepEqual(gra.zdarzenia[0].dane, { trybDojscia: 'gps' }, 'współrzędne skasowane po stronie mostu (ADR 0019 pkt 3)');

  const odmowy = [
    ['inny tryb', { ...polecenieHotseat(), tryb: 'wyscig' }],
    ['brak graczy', { ...polecenieHotseat(), gracze: [] }],
    ['za dużo graczy', { ...polecenieHotseat(), gracze: Array.from({ length: 9 }, (_, i) => ({ id: i, pseudonim: `G${i}` })) }],
    ['pseudonim dwa razy', { ...polecenieHotseat(), gracze: [{ id: 1, pseudonim: 'Ala' }, { id: 2, pseudonim: 'ala' }] }],
    ['bez zdarzeń', { ...polecenieHotseat(), zdarzenia: [] }],
    ['zły geohash5', { ...polecenieHotseat(), konfiguracja: { ...polecenieHotseat().konfiguracja, geohash5: 'x' } }],
  ];
  for (const [opis, dane] of odmowy) {
    const wynik = most.przyjmijGreHotseat(dane);
    assert.equal(wynik.ok, false, `${opis}: most odmawia`);
    assert.equal(typeof wynik.blad, 'string', `${opis}: odmowa z komunikatem`);
  }

  const spozaListy = polecenieHotseat();
  spozaListy.zdarzenia[0].graczId = 99;
  assert.equal(most.przyjmijGreHotseat(spozaListy).ok, false, 'zdarzenie gracza spoza listy = odmowa');

  const stacjaPozaZakresem = polecenieHotseat();
  stacjaPozaZakresem.zdarzenia[0].stacjaId = 77;
  assert.equal(most.przyjmijGreHotseat(stacjaPozaZakresem).ok, false, 'stacjaId poza zakresem gry = odmowa');

  const zlyTyp = polecenieHotseat();
  zlyTyp.zdarzenia[0].typ = 'rezygnacja';
  assert.equal(most.przyjmijGreHotseat(zlyTyp).ok, false, 'hot-seat przyjmuje tylko dojścia i odpowiedzi');
});

test('most: premia hot-seat = 0 po obu stronach (kopia pilnowana testem)', () => {
  const gra = {
    schemat: 'RO-gra/1', tryb: 'hotseat', stan: 'zakonczona',
    gracze: [{ id: '1', pseudonim: 'Ala' }, { id: '2', pseudonim: 'Jan' }, { id: '3', pseudonim: 'Ola' }],
    konfiguracja: { liczbaStacji: 3 },
    zdarzenia: [],
  };
  let kolejnosc = 0;
  for (const id of ['2', '3', '1']) {
    for (let st = 1; st <= 3; st += 1) {
      kolejnosc += 1;
      gra.zdarzenia.push({ kolejnosc, graczId: id, typ: 'odpowiedz', stacjaId: st, dane: { poprawna: true, punktyRazem: 1 } });
    }
  }
  assert.deepEqual(premiaMost(gra), {}, 'most nie daje premii w hot-seat');
  assert.deepEqual(premiaKlient(gra), {}, 'aplikacja pokazuje to samo (zero premii)');
  const wynikiMost = przeliczWynikiMost(gra);
  const wynikiKlient = przeliczWynikiKlient(gra);
  assert.deepEqual(wynikiMost['2'].punkty, wynikiKlient['2'].punkty, 'punkty identyczne po obu stronach');
});
