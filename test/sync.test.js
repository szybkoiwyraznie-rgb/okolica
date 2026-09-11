/**
 * Testy `app/sync.js` (M11/P3) — warstwa synchronizacji z mostem Drive.
 * Fetch i timery wstrzyknięte: bez przeglądarki, bez sieci, bez czekania.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { INTERWALY_MS, interwalPollingu, polecenieMostu, urlGet, urlStanGry, utworzSynchronizacje } from '../app/sync.js';

const URL_MOSTU = 'https://script.google.com/macros/s/ABC/exec';

const graLobby = { schemat: 'RO-gra/1', kod: 'K2H7QM', stan: 'lobby', tryb: 'wyscig', konfiguracja: { liczbaStacji: 3 }, gracze: [{ id: 'g-1', pseudonim: 'A' }], zdarzenia: [] };
const graWyscig = { ...graLobby, stan: 'trwa' };
const graTrasy = { ...graLobby, stan: 'trwa', tryb: 'trasa', gracze: [{ id: 'g-1', pseudonim: 'A' }, { id: 'g-2', pseudonim: 'B' }] };
const graKoniec = { ...graLobby, stan: 'zakonczona' };

function fakeHarmonogram() {
  const zaplanowane = [];
  return {
    zaplanowane,
    setup: {
      ustaw: (fn, ms) => { zaplanowane.push({ fn, ms }); return zaplanowane.length - 1; },
      czysc: (id) => { zaplanowane[id] = null; },
    },
    async odpalOstatni() {
      const ostatni = zaplanowane.filter(Boolean).at(-1);
      assert.ok(ostatni, 'nic nie zaplanowano');
      await ostatni.fn();
    },
  };
}

function stubFetch(obsługa) {
  const wywolania = [];
  const fetchImpl = async (url, opcje) => {
    wywolania.push({ url: String(url), opcje });
    return obsługa(String(url), opcje, wywolania.length);
  };
  return { wywolania, fetchImpl };
}
const jsonOdp = (obiekt) => ({ ok: true, status: 200, json: async () => obiekt });

/* ------------------------------------------------- czyste decyzje */

test('interwalPollingu: faza gry wyznacza rytm; oba tryby pytają tak samo (ADR 0019 pkt 6)', () => {
  assert.equal(interwalPollingu({}), 0, 'brak gry = brak pollingu');
  assert.equal(interwalPollingu({ gra: graLobby, graczId: 'g-1' }), INTERWALY_MS.lobby);
  assert.equal(interwalPollingu({ gra: graWyscig, graczId: 'g-1' }), INTERWALY_MS.gra, 'wyścig: stały rytm w grze');
  assert.equal(interwalPollingu({ gra: graTrasy, graczId: 'g-1' }), INTERWALY_MS.gra, 'trasa: ten sam rytm — nikt na nikogo nie czeka');
  assert.equal(interwalPollingu({ gra: graTrasy, graczId: 'g-2' }), INTERWALY_MS.gra, 'trasa: drugi gracz dokładnie tak samo');
  assert.equal(interwalPollingu({ gra: graKoniec, graczId: 'g-1' }), 0, 'zakończona = polling staje');
  assert.equal(interwalPollingu({ gra: { ...graLobby, stan: 'archiwum' } }), 0);
});

test('urlGet/urlStanGry: baza bez query, parametry zakodowane, puste pomijane', () => {
  assert.equal(urlGet(`${URL_MOSTU}?stary=1`, 'gry'), `${URL_MOSTU}?akcja=gry`);
  assert.equal(urlStanGry(URL_MOSTU, { kod: 'k2h7qm' }), `${URL_MOSTU}?akcja=gra-stan&kod=k2h7qm`);
  assert.equal(urlStanGry(URL_MOSTU, { kod: 'x', idGry: 'drive-1' }), `${URL_MOSTU}?akcja=gra-stan&id=drive-1`, 'idGry wygrywa z kodem');
});

/* ------------------------------------------------- polecenie POST */

test('polecenieMostu: POST text/plain na bazę, wynik ok przepuszczony', async () => {
  const stub = stubFetch(() => jsonOdp({ ok: true, gra: graLobby }));
  const wynik = await polecenieMostu(`${URL_MOSTU}?ogon=1`, { akcja: 'gra-dolacz', kod: 'K2H7QM' }, { fetchImpl: stub.fetchImpl });
  assert.equal(wynik.ok, true);
  assert.equal(stub.wywolania.length, 1);
  assert.equal(stub.wywolania[0].url, URL_MOSTU, 'POST idzie na bazę bez query');
  assert.equal(stub.wywolania[0].opcje.method, 'POST');
  assert.equal(stub.wywolania[0].opcje.headers['Content-Type'], 'text/plain;charset=utf-8', 'bez preflightu CORS');
  assert.deepEqual(JSON.parse(stub.wywolania[0].opcje.body), { akcja: 'gra-dolacz', kod: 'K2H7QM' });
});

test('polecenieMostu: odmowa mostu ma odmowaMostu=true (nie ponawiać), awaria sieci false', async () => {
  const odmowa = stubFetch(() => jsonOdp({ ok: false, blad: 'teraz jest tura gracza g-1' }));
  await assert.rejects(
    polecenieMostu(URL_MOSTU, { akcja: 'gra-zdarzenie' }, { fetchImpl: odmowa.fetchImpl }),
    (e) => e.message.includes('tura gracza g-1') && e.odmowaMostu === true,
  );
  const siec = stubFetch(() => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(
    polecenieMostu(URL_MOSTU, { akcja: 'gra-zdarzenie' }, { fetchImpl: siec.fetchImpl }),
    (e) => e.odmowaMostu === undefined,
  );
  const smieci = stubFetch(() => ({ ok: false, status: 500, json: async () => { throw new Error('to nie json'); } }));
  await assert.rejects(
    polecenieMostu(URL_MOSTU, {}, { fetchImpl: smieci.fetchImpl }),
    (e) => e.message.includes('500') && e.odmowaMostu === false,
  );
});

/* ------------------------------------------------- pętla synchronizacji */

test('sync: start pobiera stan od razu i planuje następny krok wg fazy', async () => {
  const stany = [graLobby, graWyscig];
  let i = 0;
  const stub = stubFetch(() => jsonOdp({ ok: true, gra: stany[Math.min(i, 1)] }));
  const harmo = fakeHarmonogram();
  const stanyOdebrane = [];
  const sync = utworzSynchronizacje({
    urlMostu: URL_MOSTU, graczId: 'g-1', kod: 'K2H7QM',
    onStan: (g) => stanyOdebrane.push(g), fetchImpl: stub.fetchImpl, timeout: harmo.setup,
  });
  sync.start();
  await new Promise((r) => setTimeout(r, 5));
  i += 1;
  assert.equal(stanyOdebrane.length, 1, 'pierwszy stan od razu');
  assert.equal(harmo.zaplanowane.at(-1).ms, INTERWALY_MS.lobby, 'lobby: 10 s');
  await harmo.odpalOstatni();
  assert.equal(stanyOdebrane.length, 2);
  assert.equal(harmo.zaplanowane.at(-1).ms, INTERWALY_MS.gra, 'gra w toku: 12 s');
  assert.equal(stub.wywolania[0].url, `${URL_MOSTU}?akcja=gra-stan&kod=K2H7QM`);
});

test('sync: awaria kroku jest jawna i NIE zatrzymuje pętli; stop czyści timer', async () => {
  let psuj = true;
  const stub = stubFetch(() => {
    if (psuj) throw new TypeError('offline');
    return jsonOdp({ ok: true, gra: graLobby });
  });
  const harmo = fakeHarmonogram();
  const bledy = [];
  const sync = utworzSynchronizacje({
    urlMostu: URL_MOSTU, graczId: 'g-1', kod: 'K2H7QM',
    onBlad: (m) => bledy.push(m), fetchImpl: stub.fetchImpl, timeout: harmo.setup,
  });
  sync.start();
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(bledy, ['offline'], 'awaria nazwana po imieniu');
  psuj = false;
  await harmo.odpalOstatni();
  assert.equal(bledy.length, 1, 'po awarii pętla żyje i pobrała stan');
  sync.stop();
  assert.equal(sync.czyPracuje, false);
  const przed = stub.wywolania.length;
  const ostatni = harmo.zaplanowane.findLastIndex((z) => z === null);
  assert.ok(ostatni >= 0, 'stop wyczyścił zaplanowany timer');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(stub.wywolania.length, przed, 'po stop zero nowych żądań');
});

test('sync: awaria sieci kolejkuję zdarzenia, a flush po powrocie zachowuje kolejność', async () => {
  let online = false;
  const posty = [];
  const stub = stubFetch((url, opcje) => {
    if (opcje?.method === 'POST') {
      if (!online) throw new TypeError('offline');
      posty.push(JSON.parse(opcje.body));
      return jsonOdp({ ok: true, kolejnosc: posty.length, stan: 'trwa', wyniki: {} });
    }
    if (!online) throw new TypeError('offline');
    return jsonOdp({ ok: true, gra: graWyscig });
  });
  const harmo = fakeHarmonogram();
  const bledy = [];
  const sync = utworzSynchronizacje({
    urlMostu: URL_MOSTU, graczId: 'g-1', kod: 'K2H7QM',
    onBlad: (m) => bledy.push(m), fetchImpl: stub.fetchImpl, timeout: harmo.setup,
  });
  await sync.wyslijZdarzenie({ schemat: 'RO-zdarzenie/1', typ: 'dojscie', stacjaId: 1 });
  await sync.wyslijZdarzenie({ schemat: 'RO-zdarzenie/1', typ: 'odpowiedz', stacjaId: 1 });
  assert.equal(sync.kolejkaLength, 2, 'offline: zdarzenia w kolejce, nie zgubione');
  assert.match(bledy.at(-1), /kolejce/, 'gracz wie, że zdarzenia czekają');
  online = true;
  sync.start();
  await new Promise((r) => setTimeout(r, 5)); // pierwszy krok: pobranie stanu + flush kolejki
  assert.equal(sync.kolejkaLength, 0, 'kolejka wypchnięta');
  assert.deepEqual(posty.map((p) => p.zdarzenie.typ), ['dojscie', 'odpowiedz'], 'kolejność FIFO zachowana');
  assert.ok(posty.every((p) => p.akcja === 'gra-zdarzenie'));
});

test('sync: odmowa mostu nie jest ponawiana i trafia do onBlad (np. „nie Twoja tura")', async () => {
  const stub = stubFetch(() => jsonOdp({ ok: false, blad: 'teraz jest tura gracza g-1 — poczekaj na swoją kolej' }));
  const bledy = [];
  const sync = utworzSynchronizacje({
    urlMostu: URL_MOSTU, graczId: 'g-2', kod: 'K2H7QM',
    onBlad: (m) => bledy.push(m), fetchImpl: stub.fetchImpl, timeout: fakeHarmonogram().setup,
  });
  const wynik = await sync.wyslijZdarzenie({ schemat: 'RO-zdarzenie/1', typ: 'dojscie', stacjaId: 1 });
  assert.equal(wynik, null);
  assert.equal(sync.kolejkaLength, 0, 'odmowa nie ląduje w kolejce (nie ponawiamy w kółko)');
  assert.match(bledy[0], /nie Twoja tura|tura gracza g-1/);
  assert.equal(stub.wywolania.length, 1, 'dokładnie jedna próba');
});
