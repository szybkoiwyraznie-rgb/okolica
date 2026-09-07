/**
 * Testy ekranu „🏆 Rankingi" (M12/P6): jedna instalacja DOM + import `app.js`
 * przeciw atrapie mostu oddającej surowe wiersze RO-ranking/1. Agregacje
 * (ogólny/wiek/tematy/lokalizacja) i „Moje gry" liczy telefon — serwer tylko
 * przechowuje (ADR 0019 pkt 7).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { zainstalujDom } from './helpers/dom.js';
import { WIEK } from '../app/konfig.js';

const URL_MOSTU = 'https://script.google.com/macros/s/TEST/exec';

function wiersz({ pseudonim, punkty, poprawne, bledne, miejsce, geohash5, wiek, tematy, tryb = 'wyscig', data = '2026-09-01T10:00:00.000Z', stacjeZamkniete = 5 }) {
  return { pseudonim, punkty, poprawne, bledne, czasOdcinkowMs: 600000, stacjeZamkniete, data, tryb, miejsce, geohash5, wiek, tematy };
}

const WIERSZE = [
  wiersz({ pseudonim: 'Ala', punkty: 100, poprawne: 5, bledne: 1, miejsce: 'Podkowa Leśna', geohash5: 'u3qb8', wiek: 'dorosli', tematy: ['historia', 'przyroda'] }),
  wiersz({ pseudonim: 'Bartek', punkty: 120, poprawne: 6, bledne: 0, miejsce: 'Podkowa Leśna', geohash5: 'u3qb8', wiek: 'dorosli', tematy: ['historia'] }),
  wiersz({ pseudonim: 'Ala', punkty: 60, poprawne: 3, bledne: 1, miejsce: 'Milanówek', geohash5: 'u3q9g', wiek: '15', tematy: ['przyroda'], tryb: 'tury', data: '2026-09-02T16:30:00.000Z' }),
  wiersz({ pseudonim: 'Celina', punkty: 80, poprawne: 4, bledne: 2, miejsce: 'Podkowa Leśna', geohash5: 'u3qb8', wiek: 'dorosli', tematy: ['historia'] }),
];

function atrapaMostu(odpowiedzRankingu) {
  const adresy = [];
  return {
    adresy,
    fetchImpl: async (url) => {
      adresy.push(String(url));
      const params = new URL(String(url)).searchParams;
      const json = (obiekt) => ({ ok: true, status: 200, json: async () => structuredClone(obiekt) });
      if (params.get('akcja') !== 'ranking') return json({ ok: false, blad: 'nieznana akcja' });
      return json(odpowiedzRankingu);
    },
  };
}

const oddech = () => new Promise((r) => setTimeout(r, 0));

async function telefonZRankingiem({ odpowiedz = { schemat: 'RO-ranking/1', wiersze: WIERSZE }, pamiec = new Map(), pseudonim = 'Ala' } = {}) {
  const most = atrapaMostu(odpowiedz);
  globalThis.fetch = most.fetchImpl;
  if (pseudonim) pamiec.set('okolica:pseudonim', pseudonim);
  if (!pamiec.has('okolica:multi:url-mostu')) pamiec.set('okolica:multi:url-mostu', URL_MOSTU);
  const dom = zainstalujDom({ search: '?tryb=test&odstep=0', pamiec });
  await import(`../app/app.js?r=${Math.random()}`);
  const kliknij = async (id) => { dom.kliknij(id); await oddech(); };
  await kliknij('przycisk-ranking');
  return { dom, most, kliknij };
}

function wierszeTabeli(dom) {
  return dom.pobierz('ranking-wiersze').children.map((tr) => tr.textContent);
}
function zakladka(dom, i) {
  const b = dom.pobierz('ranking-zakladki').children[i];
  for (const fn of b.zdarzenia.click ?? []) fn({ type: 'click', target: b, currentTarget: b });
  return b;
}
function chipy(dom) {
  return dom.pobierz('ranking-kategorie').children;
}

test('ranking ogólny: sumy po pseudonimach, sort punktami, własne wyniki oznaczone', async () => {
  const { dom, most } = await telefonZRankingiem();
  assert.equal(dom.pobierz('ekran-ranking').hidden, false, 'ekran rankingów widoczny');
  assert.match(dom.pobierz('ranking-status').textContent, /4 wyników graczy/, 'status mówi, ile wierszy przyszło');
  assert.ok(most.adresy[0].includes('akcja=ranking'), 'żądanie GET akcja=ranking');
  const wiersze = wierszeTabeli(dom);
  assert.equal(wiersze.length, 3, 'trzech graczy po agregacji');
  assert.match(wiersze[0], /^1\.Ala \(Ty\)1602/, 'Ala: 100+60=160 pkt z 2 gier, pierwsza, oznaczona „(Ty)"');
  assert.match(wiersze[1], /^2\.Bartek1201/, 'Bartek: 120 pkt z 1 gry');
  assert.match(wiersze[2], /3\.Celina801/, 'Celina: 80 pkt');
});

test('zakładka Wiek: kategorie z danych, filtr zawęża agregację', async () => {
  const { dom } = await telefonZRankingiem();
  zakladka(dom, 1); // Wiek
  const etykiety = chipy(dom).map((c) => c.textContent);
  assert.deepEqual(etykiety, [WIEK['15'].etykieta, WIEK.dorosli.etykieta], 'chipy kategorii wiekowych z etykietami konfigu');
  // domyślnie pierwsza kategoria ('15' sortuje się przed 'dorosli')
  assert.equal(wierszeTabeli(dom).length, 1, 'wiek 15: tylko druga gra Ali');
  assert.match(wierszeTabeli(dom)[0], /^1\.Ala \(Ty\)601/, 'Ala 60 pkt z 1 gry wśród 15-latków');
  const chipDorosli = chipy(dom)[1];
  for (const fn of chipDorosli.zdarzenia.click ?? []) fn({ type: 'click', target: chipDorosli, currentTarget: chipDorosli });
  const wiersze = wierszeTabeli(dom);
  assert.equal(wiersze.length, 3, 'dorośli: Ala (100), Bartek, Celina');
  assert.match(wiersze[0], /Bartek1201/, 'Bartek pierwszy wśród dorosłych');
  assert.match(wiersze[1], /Ala \(Ty\)1001/, 'Ala z jedną grą 100 pkt');
});


test('zakładka Tematy: filtr po tematach paczki', async () => {
  const { dom } = await telefonZRankingiem();
  zakladka(dom, 2); // Tematy
  const etykiety = chipy(dom).map((c) => c.textContent);
  assert.deepEqual(etykiety, ['Historia', 'Przyroda'], 'dwa tematy z wierszy, etykiety z konfigu');
  assert.match(wierszeTabeli(dom)[0], /Bartek1201/, 'historia: Bartek pierwszy');
  const chipPrzyroda = chipy(dom).find((c) => c.textContent === 'Przyroda');
  for (const fn of chipPrzyroda.zdarzenia.click ?? []) fn({ type: 'click', target: chipPrzyroda, currentTarget: chipPrzyroda });
  assert.deepEqual(wierszeTabeli(dom).length, 1, 'przyroda: tylko Ala');
  assert.match(wierszeTabeli(dom)[0], /Ala \(Ty\)1602/, 'obie gry Ali miały przyrodę — suma 160');
});

test('zakładka Lokalizacja: „najlepsi w Podkowie Leśnej" działa dosłownie', async () => {
  const { dom } = await telefonZRankingiem();
  zakladka(dom, 3); // Lokalizacja
  const etykiety = chipy(dom).map((c) => c.textContent);
  assert.deepEqual(etykiety, ['Podkowa Leśna', 'Milanówek'], 'chipy miejsc (geohash5 → nazwa miejsca)');
  const wiersze = wierszeTabeli(dom);
  assert.equal(wiersze.length, 3, 'Podkowa: Ala, Bartek, Celina');
  assert.match(wiersze[0], /Bartek1201/, 'najlepszy w Podkowie Leśnej: Bartek');
  const chipMilanowek = chipy(dom)[1];
  for (const fn of chipMilanowek.zdarzenia.click ?? []) fn({ type: 'click', target: chipMilanowek, currentTarget: chipMilanowek });
  assert.equal(wierszeTabeli(dom).length, 1, 'Milanówek: tylko Ala');
  assert.match(wierszeTabeli(dom)[0], /^1\.Ala \(Ty\)601/, 'Ala 60 pkt z 1 gry w Milanówku');
});

test('„Moje gry": historia zakończonych gier własnego pseudonimu', async () => {
  const { dom } = await telefonZRankingiem();
  zakladka(dom, 4); // Moje gry
  assert.equal(dom.pobierz('ranking-tabela').hidden, true, 'tabela schowana — lista gier');
  const lista = dom.pobierz('ranking-moje-gry');
  assert.equal(lista.hidden, false, 'lista widoczna');
  assert.equal(lista.children.length, 2, 'Ala ma dwie zakończone gry');
  assert.match(lista.children[0].textContent, /2026-09-01 10:00 · Podkowa Leśna · wyścig · 100 pkt · 5 poprawne, 1 błędne · 5 stacji/, 'wiersz historii z datą, miejscem, trybem i wynikiem');
  assert.match(lista.children[1].textContent, /Milanówek · tury · 60 pkt/, 'druga gra: tury w Milanówku');
});

test('puste rankingi i śmieciowa odpowiedź mostu są jawne (LESSONS L6)', async () => {
  const pusty = await telefonZRankingiem({ odpowiedz: { schemat: 'RO-ranking/1', wiersze: [] }, pseudonim: null });
  assert.match(pusty.dom.pobierz('ranking-status').textContent, /nie ma jeszcze zakończonych gier/, 'status mówi wprost, że pusto');
  assert.match(wierszeTabeli(pusty.dom)[0], /Brak zakończonych gier w tej kategorii/, 'tabela ma jeden wiersz-komunikat');
  zakladka(pusty.dom, 4);
  assert.match(pusty.dom.pobierz('ranking-moje-gry').children[0].textContent, /Nie masz jeszcze pseudonimu/, 'bez pseudonimu lista mówi, gdzie go ustawić');

  const smieci = await telefonZRankingiem({ odpowiedz: { schemat: 'RO-gra/1', wiersze: 'to nie ranking' } });
  assert.match(smieci.dom.pobierz('ranking-status').textContent, /nieczytelna/, 'zły schemat = jawny komunikat, nie pusty ekran');
  assert.equal(wierszeTabeli(smieci.dom).length, 1, 'tabela z komunikatem zamiast śmieci');
});

test('bez adresu mostu ekran rankingów tłumaczy, co ustawić', async () => {
  const pamiec = new Map();
  pamiec.set('okolica:multi:url-mostu', ''); // pusty = jak brak
  const { dom, most } = await telefonZRankingiem({ pamiec, pseudonim: null });
  assert.match(dom.pobierz('ranking-status').textContent, /Brak adresu mostu Drive/, 'status wskazuje ustawienia');
  assert.equal(most.adresy.length, 0, 'zero żądań bez adresu');
});
