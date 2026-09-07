/**
 * Testy `app/wynik.js` (M7/P4): formatowanie liczb i TEKST wyniku —
 * złoty format + STRAŻNIK prywatności (ani treści pytań, ani współrzędnych —
 * ADR 0013, plan M7 decyzja 4). Bez czasów i tempa (Partia 2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ROLE_PALETY,
  dystansTekst,
  etykietaOdcinka,
  planObrazuWyniku,
  wynikTekstowy,
} from '../app/wynik.js';
import { nowaRozgrywka, podsumowanie } from '../app/rozgrywka.js';
import { domyslnaKonfiguracja } from '../app/konfig.js';
import { stacjeProste } from '../app/stacje.js';

const KATALOG = join(import.meta.dirname, '..');
const PACZKA = JSON.parse(readFileSync(join(KATALOG, 'test', 'fixtures', 'paczka-ok.json'), 'utf8'));
const SRODEK = { lat: 52.2297, lon: 21.0122 };

/** Ręcznie ułożony wynik gry 2 graczy × 3 stacje (jedna pominięta). */
const PODSUMOWANIE = {
  schemat: 'rozgrywka/1',
  faza: 'koniec',
  zwyciezca: 'g2',
  ranking: ['g2', 'g1'],
  gracze: [
    { id: 'g1', imie: 'Gracz 1', punkty: 60, punktyOdpowiedzi: 60, poprawne: 1, bledne: 2, odcinki: 2, dystansM: 1650, reczneDojscia: 1 },
    { id: 'g2', imie: 'Anna', punkty: 120, punktyOdpowiedzi: 120, poprawne: 2, bledne: 0, odcinki: 1, dystansM: 820, reczneDojscia: 0 },
  ],
  stacje: [
    { id: 1, gracz: 'g1', stan: 'zakonczony', dystansM: 820, trybDojscia: 'gps', poprawne: 1, punkty: 60 },
    { id: 2, gracz: 'g2', stan: 'zakonczony', dystansM: 820, trybDojscia: 'reczne', poprawne: 2, punkty: 120 },
    { id: 3, gracz: 'g1', stan: 'pominiety', dystansM: 830, trybDojscia: null, poprawne: 0, punkty: 0 },
  ],
  punktyRazem: 180,
  zaliczoneStacje: 2,
  pominietaStacje: 1,
  stacjeBezPytan: [],
  zdarzen: 14,
};
const KONFIG = { tryb: 'piesza', wiek: 'dorosli', tematy: ['historia', 'przyroda'] };

test('wynik: dystansTekst — polski przecinek, bez locale', () => {
  assert.equal(dystansTekst(0), '0 m');
  assert.equal(dystansTekst(850), '850 m');
  assert.equal(dystansTekst(999.4), '999 m');
  assert.equal(dystansTekst(1000), '1,0 km');
  assert.equal(dystansTekst(1650), '1,6 km', 'OCZEKIWANIE POLICZONE (L6): (1.65).toFixed(1) daje 1.6, bo 1.65 binarnie jest poniżej połowy');
  assert.equal(dystansTekst(null), '0 m');
});

test('wynik: etykietaOdcinka — stan i tryb dojścia uczciwie nazwane', () => {
  assert.equal(etykietaOdcinka({ stan: 'zakonczony', trybDojscia: 'gps' }), 'zaliczona (GPS)');
  assert.equal(etykietaOdcinka({ stan: 'zakonczony', trybDojscia: 'reczne' }), 'zaliczona (ręcznie)');
  assert.equal(etykietaOdcinka({ stan: 'pominiety', trybDojscia: null }), 'pominięta');
  assert.equal(etykietaOdcinka({ stan: 'w-trakcie', trybDojscia: null }), 'w drodze');
  assert.equal(etykietaOdcinka({ stan: 'oczekuje', trybDojscia: null }), 'nierozegrana');
});

test('wynik: wynikTekstowy — złoty format (nagłówek, ranking, stacje, gra)', () => {
  const tekst = wynikTekstowy({
    podsumowanie: PODSUMOWANIE,
    konfig: KONFIG,
    miejsce: '  Warszawa Śródmieście ',
    data: '2026-09-06 14:32 UTC',
  });
  const linie = tekst.split('\n');
  assert.equal(linie[0], 'TAJEMNICZA OKOLICA — WYNIK GRY');
  assert.equal(linie[1], '2026-09-06 14:32 UTC · Warszawa Śródmieście · tryb: piesza · 2 graczy · 3 stacji', 'miejsce przycięte z białych znaków');
  assert.equal(linie[2], 'kategoria: dorosli · tematy: historia, przyroda');
  assert.ok(linie.includes('🏆 Anna — 120 pkt'), 'zwycięzca z rankingu');
  assert.ok(linie.includes('1. Anna — 120 pkt · poprawne 2/2'), 'ranking: kolejność, punkty, poprawne/razem');
  assert.ok(linie.includes('2. Gracz 1 — 60 pkt · poprawne 1/3'));
  assert.ok(linie.includes('stacja 1 · Gracz 1 — zaliczona (GPS) · 60 pkt'));
  assert.ok(linie.includes('stacja 2 · Anna — zaliczona (ręcznie) · 120 pkt'));
  assert.ok(linie.includes('stacja 3 · Gracz 1 — pominięta · 0 pkt'));
  assert.ok(linie.includes('zaliczone 2 z 3 stacji · pominięte 1 · zdarzenia 14'));
  assert.equal(tekst.includes('🏅'), false, 'medalu nie ma (Partia 2)');
  assert.equal(/\n\n/.test(tekst), true, 'sekcje oddzielone pustą linią (czytelne w SMS)');
  assert.equal(/[#*_`]/.test(tekst), false, 'zero markdowna — hash na początku linii byłby nagłówkiem');
});

test('wynik: wynikTekstowy — warianty (brak miejsca, przerwana, brak medalu/danych) i odmowy', () => {
  const bezMiejsca = wynikTekstowy({ podsumowanie: PODSUMOWANIE, konfig: KONFIG, data: '2026-09-06 14:32 UTC' });
  assert.match(bezMiejsca.split('\n')[1], /^2026-09-06 14:32 UTC · tryb: piesza/, 'null nie wycieka jako „null"');
  assert.equal(bezMiejsca.includes('null'), false);

  const przerwana = wynikTekstowy({ podsumowanie: PODSUMOWANIE, konfig: KONFIG, przerwana: true });
  assert.match(przerwana, /\(gra przerwana ręcznie — wynik wczesny\)/);

  const bezZwyciezcy = wynikTekstowy({ podsumowanie: { ...PODSUMOWANIE, zwyciezca: null }, konfig: KONFIG });
  assert.match(bezZwyciezcy, /🏆 brak zwycięzcy/);

  const bezWieku = wynikTekstowy({ podsumowanie: PODSUMOWANIE, konfig: { tryb: 'rowerowa' } });
  assert.equal(bezWieku.includes('kategoria:'), false, 'pusta kategoria nie tworzy linii-widma');

  assert.throws(() => wynikTekstowy({ konfig: KONFIG }), TypeError, 'brak podsumowania');
  assert.throws(() => wynikTekstowy({ podsumowanie: PODSUMOWANIE }), TypeError, 'brak konfiga');
  assert.throws(() => wynikTekstowy({ podsumowanie: PODSUMOWANIE, konfig: KONFIG, miejsce: 42 }), TypeError, 'miejsce nie-string');
});

test('wynik: STRAŻNIK prywatności — tekst z prawdziwej gry bez pytań i bez współrzędnych (ADR 0013)', () => {
  const konfig = { ...domyslnaKonfiguracja(2), kodGry: 'waw-test', promienM: 1000, liczbaStacji: 3 };
  const stacje = stacjeProste({ srodek: SRODEK, liczbaStacji: 3, promienM: 1000, ziarno: 'z' });
  const rozgrywka = nowaRozgrywka({ konfig, stacje, paczka: PACZKA, srodek: SRODEK, czasMs: 0, ziarno: 'z' });
  const tekst = wynikTekstowy({
    podsumowanie: podsumowanie(rozgrywka),
    konfig,
    miejsce: 'Warszawa Śródmieście',
    data: '2026-09-06 14:32 UTC',
  });
  for (const pytanie of PACZKA.pytania) {
    assert.equal(tekst.includes(pytanie.tresc), false, `treść pytania ${pytanie.id} wyciekła do tekstu wyniku`);
    assert.equal(tekst.includes(pytanie.wyjasnienie), false, `wyjaśnienie ${pytanie.id} wyciekło`);
    for (const odpowiedz of pytanie.odpowiedzi) {
      if (odpowiedz.length > 4) assert.equal(tekst.includes(odpowiedz), false, `odpowiedź „${odpowiedz}" wyciekła`);
    }
  }
  assert.equal(tekst.includes('52.2297'), false, 'współrzędna środka wyciekła');
  assert.equal(tekst.includes('21.0122'), false, 'współrzędna środka wyciekła');
  for (const s of stacje) {
    assert.equal(tekst.includes(s.lat.toFixed(4)), false, `współrzędne stacji ${s.id} wyciekły`);
  }
  assert.match(tekst, /stacja 1 /, 'stacje są NUMERAMI — jak na mapie gry');
});

test('wynik: planObrazuWyniku — deterministyczny plan z ROLAMI kolorów (zero konkretów)', () => {
  const wejscie = {
    podsumowanie: PODSUMOWANIE, konfig: KONFIG, miejsce: 'Warszawa Śródmieście',
    data: '2026-09-06 14:32 UTC',
  };
  const plan = planObrazuWyniku(wejscie);
  assert.deepEqual(planObrazuWyniku(wejscie), plan, 'plan jest deterministyczny (testy bez pikseli)');
  assert.equal(plan.szerokosc, 1080, 'domyślnie 2× gęstość');
  assert.ok(plan.wysokosc > 500 && plan.wysokosc < 4000, `wysokosc z treści: ${plan.wysokosc}`);

  assert.equal(plan.komendy[0].typ, 'prostokat');
  assert.equal(plan.komendy[0].kolorRola, 'tlo');
  assert.deepEqual([plan.komendy[0].w, plan.komendy[0].h], [plan.szerokosc, plan.wysokosc], 'tło na cały obraz');
  assert.equal(plan.komendy[1].kolorRola, 'karta', 'karta wyniku na drugim planie');

  const teksty = plan.komendy.filter((k) => k.typ === 'tekst').map((k) => k.tekst);
  assert.ok(teksty.includes('TAJEMNICZA OKOLICA'), 'marka na obrazie');
  assert.ok(teksty.includes('WYNIK GRY'));
  assert.ok(teksty.some((x) => x === '🏆 Anna'), 'zwycięzca');
  assert.ok(teksty.some((x) => x === '120 pkt'), 'duże punkty zwycięzcy');
  assert.ok(teksty.includes('1. Anna — 120 pkt · poprawne 2/2'), 'linie rankingu WSPÓLNE z formatem tekstowym');
  assert.ok(teksty.some((x) => x.startsWith('zaliczone 2 z 3')), 'statystyki gry');
  assert.ok(plan.komendy.some((k) => k.typ === 'linia'), 'separatory sekcji');
  assert.equal(teksty.some((x) => x.includes('stacja 1')), false, 'stacje zostają w tekście — obraz to esencja (plan M7/P5)');

  // kolory: WYŁĄCZNIE role z ROLE_PALETY — konkrety bierze wykonawca z CSS motywu
  const json = JSON.stringify(plan);
  assert.equal(json.includes('#'), false, 'zero konkretnych kolorów w planie');
  const role = new Set(Object.keys(ROLE_PALETY));
  for (const k of plan.komendy) assert.ok(role.has(k.kolorRola), `komenda z rolą spoza palety: ${k.kolorRola}`);
  assert.equal(ROLE_PALETY.karta, '--tlo-karta', 'role wskazują zmienne CSS');

  // prywatność: obraz nie niesie współrzędnych ani pytań
  assert.equal(json.includes('52.2297'), false);
  for (const pytanie of PACZKA.pytania) assert.equal(json.includes(pytanie.tresc), false);
});

test('wynik: planObrazuWyniku — warianty (przerwana, brak zwycięzcy, szerokość) i odmowy', () => {
  const baza = { podsumowanie: PODSUMOWANIE, konfig: KONFIG };
  const przerwany = planObrazuWyniku({ ...baza, przerwana: true });
  assert.ok(przerwany.komendy.some((k) => k.typ === 'tekst' && k.tekst.includes('przerwana ręcznie')));
  assert.ok(przerwany.komendy.some((k) => k.kolorRola === 'ostrzezenie'), 'adnotacja przerwana w kolorze ostrzeżenia');

  const bezZwyciezcy = planObrazuWyniku({ ...baza, podsumowanie: { ...PODSUMOWANIE, zwyciezca: null } });
  assert.ok(bezZwyciezcy.komendy.some((k) => k.typ === 'tekst' && k.tekst.includes('brak zwycięzcy')));

  const maly = planObrazuWyniku({ ...baza, szerokosc: 540 });
  assert.equal(maly.szerokosc, 540);
  const tytulDuzy = planObrazuWyniku(baza).komendy.find((k) => k.tekst === 'WYNIK GRY');
  const tytulMaly = maly.komendy.find((k) => k.tekst === 'WYNIK GRY');
  assert.ok(tytulMaly.rozmiar < tytulDuzy.rozmiar, 'czcionki skalują się z szerokością');

  assert.throws(() => planObrazuWyniku({ ...baza, szerokosc: 100 }), TypeError, 'szerokosc < 320');
  assert.throws(() => planObrazuWyniku({ konfig: KONFIG }), TypeError, 'brak podsumowania');
});
