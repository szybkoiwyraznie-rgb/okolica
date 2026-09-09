/**
 * `sync.js` — M11/P3: warstwa synchronizacji gry wieloosobowej z mostem Drive
 * (ADR 0019 pkt 6).
 *
 * Zasady:
 * - polling stanu gry z interwałem zależnym od fazy (czysta `interwalPollingu`):
 *   lobby 10 s, wyścig 12 s, tury — bieżący gracz 10 s, czekający 30 s,
 *   gra zakończona: zero (sygnał dla warstwy UI, żeby zatrzymać polling —
 *   `zaplanuj` celowo NIGDY nie zwraca 0, tylko awaryjne tempo lobby, bo
 *   jest też wołany bez świeżego stanu; zatrzymanie robi warstwa DOM po
 *   wykryciu stanu zakonczona/archiwum w odebranym stanie);
 * - zdarzenia wychodzą POST-em `text/plain` natychmiast (bez preflightu CORS,
 *   wzorzec M9b); awaria SIECI dokłada zdarzenie do KOLEJKI offline, która
 *   wychodzi przy najbliższym udanym kroku (flush na `online` wystawia
 *   warstwa DOM); ODMOWA mostu (np. „to nie Twoja tura") NIE jest ponawiana
 *   — trafia jawnie do `onBlad` (LESSONS L6);
 * - wszystkie zależności (fetch, timery) są wstrzykiwalne — moduł testuje się
 *   bez przeglądarki i bez sieci.
 */

import { biezacyGraczTury } from './wieloosobowa.js?v=m12-43';

export const INTERWALY_MS = Object.freeze({
  lobby: 10_000,
  wyscig: 12_000,
  turyMoje: 10_000,
  turyCzekam: 30_000,
});

/** Czysta decyzja: co ile ms odpytywać most o stan gry (0 = nie odpytywać). */
export function interwalPollingu({ gra = null, graczId = null } = {}) {
  if (!gra || gra.stan === 'zakonczona' || gra.stan === 'archiwum') return 0;
  if (gra.stan === 'lobby') return INTERWALY_MS.lobby;
  if (gra.tryb === 'wyscig') return INTERWALY_MS.wyscig;
  return biezacyGraczTury(gra) === graczId ? INTERWALY_MS.turyMoje : INTERWALY_MS.turyCzekam;
}

/** Baza adresu mostu bez query/hash (web app URL bywa wklejony z ogonem). */
function bazaMostu(urlMostu) {
  return String(urlMostu).split(/[?#]/)[0];
}

/** Adres GET do mostu: `?akcja=…` + parametry (puste wartości pomijane). */
export function urlGet(urlMostu, akcja, parametry = {}) {
  const query = new URLSearchParams({ akcja });
  for (const [klucz, wartosc] of Object.entries(parametry)) {
    if (wartosc != null && wartosc !== '') query.set(klucz, String(wartosc));
  }
  return `${bazaMostu(urlMostu)}?${query.toString()}`;
}

/** Adres stanu gry: po kodzie (gracz zna kod) albo po idGry (dołączył z lobby). */
export function urlStanGry(urlMostu, { kod = null, idGry = null } = {}) {
  return urlGet(urlMostu, 'gra-stan', idGry ? { id: idGry } : { kod });
}

/**
 * Jednorazowe polecenie POST do mostu (gra-zaloz / gra-dolacz / gra-start /
 * gra-zdarzenie / gra-zakoncz). Rozwiązuje wynikiem `{ok:true,…}`, rzuca
 * Error z `odmowaMostu=true` przy jawnej odmowie serwera (nie ponawiać!)
 * albo zwykły Error przy awarii sieci (kolejkować i ponowić).
 */
export async function polecenieMostu(urlMostu, cialo, { fetchImpl = null } = {}) {
  const fetcher = fetchImpl ?? globalThis.fetch;
  const odp = await fetcher(bazaMostu(urlMostu), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(cialo),
  });
  let wynik = null;
  try {
    wynik = await odp.json();
  } catch {
    wynik = null;
  }
  if (!wynik || wynik.ok !== true) {
    const blad = new Error(wynik?.blad ?? `most odpowiedział ${odp?.status ?? 'nieznanym stanem'}`);
    blad.odmowaMostu = Boolean(wynik);
    throw blad;
  }
  return wynik;
}

/**
 * Pętla synchronizacji jednej gry. `onStan(gra)` po każdym udanym pobraniu
 * (i po flushu kolejki), `onBlad(komunikat)` przy każdej awarii — obie
 * ścieżki jawne (LESSONS L6). Timer cykliczny bez nakładania się kroków:
 * następne pobranie planowane DOPIERO po zakończeniu bieżącego.
 */
export function utworzSynchronizacje({
  urlMostu,
  graczId,
  kod = null,
  idGry = null,
  onStan = null,
  onBlad = null,
  fetchImpl = null,
  timeout = null,
} = {}) {
  const fetcher = fetchImpl ?? globalThis.fetch;
  const harmonogram = timeout ?? {
    ustaw: (fn, ms) => globalThis.setTimeout(fn, ms),
    czysc: (id) => globalThis.clearTimeout(id),
  };
  let timer = null;
  let pracuje = false;
  let ostatniaGra = null;
  const kolejka = [];

  async function pobierzStan() {
    const odp = await fetcher(urlStanGry(urlMostu, { kod, idGry }));
    if (!odp.ok) throw new Error(`HTTP ${odp.status}`);
    const wynik = await odp.json();
    if (!wynik?.ok || !wynik.gra) throw new Error(wynik?.blad ?? 'most nie zwrócił stanu gry');
    return wynik.gra;
  }

  async function oproznijKolejke() {
    while (kolejka.length) {
      try {
        // eslint-disable-next-line no-await-in-loop — kolejność zdarzeń jest częścią kontraktu
        await polecenieMostu(urlMostu, { akcja: 'gra-zdarzenie', zdarzenie: kolejka[0] }, { fetchImpl: fetcher });
        kolejka.shift();
      } catch (e) {
        if (e.odmowaMostu) {
          kolejka.shift(); // odmowa serwera nie jest ponawiana (np. „nie Twoja tura")
          onBlad?.(e.message);
        } else {
          break; // nadal offline — reszta kolejki czeka na następny krok
        }
      }
    }
  }

  function zaplanuj() {
    const interwal = interwalPollingu({ gra: ostatniaGra, graczId }) || INTERWALY_MS.lobby;
    timer = harmonogram.ustaw(() => krok(), interwal); // zwracamy promise: testy mogą czekać na cały krok
  }

  async function krok() {
    if (!pracuje) return;
    try {
      const gra = await pobierzStan();
      ostatniaGra = gra;
      if (kolejka.length) await oproznijKolejke();
      onStan?.(gra);
    } catch (e) {
      onBlad?.(e?.message ?? String(e)); // awaria kroku nie zatrzymuje pętli
    } finally {
      if (pracuje) zaplanuj();
    }
  }

  return {
    start() {
      if (pracuje) return;
      pracuje = true;
      krok();
    },
    stop() {
      pracuje = false;
      if (timer != null) harmonogram.czysc(timer);
      timer = null;
    },
    /** Zdarzenie gry: natychmiast albo do kolejki offline (nigdy cicho). */
    async wyslijZdarzenie(zdarzenie) {
      try {
        return await polecenieMostu(urlMostu, { akcja: 'gra-zdarzenie', zdarzenie }, { fetchImpl: fetcher });
      } catch (e) {
        if (e.odmowaMostu) {
          onBlad?.(e.message);
          return null;
        }
        kolejka.push(zdarzenie);
        onBlad?.('Brak połączenia z mostem — zdarzenie czeka w kolejce i wyjdzie automatycznie, gdy sieć wróci.');
        return null;
      }
    },
    /** Próba natychmiastowego wypchnięcia kolejki (np. zdarzenie `online`). */
    async flush() {
      if (kolejka.length) await oproznijKolejke();
    },
    get kolejkaLength() {
      return kolejka.length;
    },
    get ostatniaGra() {
      return ostatniaGra;
    },
    get czyPracuje() {
      return pracuje;
    },
  };
}
