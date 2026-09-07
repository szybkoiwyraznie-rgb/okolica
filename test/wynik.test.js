/**
 * Testy `app/wynik.js` (M7/P4): formatowanie liczb, medal sprawiedliwości
 * trasy i TEKST wyniku — złoty format + STRAŻNIK prywatności (ani treści
 * pytań, ani współrzędnych — ADR 0013, plan M7 decyzja 4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PROG_MEDALU,
  ROLE_PALETY,
  czasTekst,
  dystansTekst,
  etykietaOdcinka,
  medalTekst,
  planObrazuWyniku,
  sprawiedliwoscTrasy,
  tempoTekst,
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
    { id: 'g1', imie: 'Gracz 1', punkty: 60, punktyOdpowiedzi: 50, premieCzasu: 10, poprawne: 1, bledne: 2, odcinki: 2, czasOdcinkowS: 760, dystansM: 1650, srednieTempoSM: 0.4606, reczneDojscia: 1, poLimitie: 0 },
    { id: 'g2', imie: 'Anna', punkty: 120, punktyOdpowiedzi: 100, premieCzasu: 20, poprawne: 2, bledne: 0, odcinki: 1, czasOdcinkowS: 272, dystansM: 820, srednieTempoSM: 0.3317, reczneDojscia: 0, poLimitie: 0 },
  ],
  stacje: [
    { id: 1, gracz: 'g1', stan: 'zakonczony', czasS: 300, dystansM: 820, tempo: null, trybDojscia: 'gps', poprawne: 1, punkty: 60 },
    { id: 2, gracz: 'g2', stan: 'zakonczony', czasS: 272, dystansM: 820, tempo: null, trybDojscia: 'reczne', poprawne: 2, punkty: 120 },
    { id: 3, gracz: 'g1', stan: 'pominiety', czasS: null, dystansM: 830, tempo: null, trybDojscia: null, poprawne: 0, punkty: 0 },
  ],
  punktyRazem: 180,
  zaliczoneStacje: 2,
  pominietaStacje: 1,
  stacjeBezPytan: [],
  czasGryS: 1272,
  zdarzen: 14,
};
const KONFIG = { tryb: 'piesza', wiek: 'dorosli', tematy: ['historia', 'przyroda'] };

test('wynik: czasTekst — sekundy, minuty, godziny, wartości zepsute', () => {
  assert.equal(czasTekst(0), '0 s');
  assert.equal(czasTekst(45), '45 s');
  assert.equal(czasTekst(60), '1 min', 'bez „1 min 0 s"');
  assert.equal(czasTekst(65), '1 min 5 s');
  assert.equal(czasTekst(760), '12 min 40 s');
  assert.equal(czasTekst(3600), '1 godz 0 min');
  assert.equal(czasTekst(3725), '1 godz 2 min');
  assert.equal(czasTekst(NaN), '0 s', 'NaN nie wycieka do użytkownika');
  assert.equal(czasTekst(-30), '0 s', 'ujemny czas nie istnieje');
});

test('wynik: dystansTekst i tempoTekst — polski przecinek, bez locale, kreska przy braku', () => {
  assert.equal(dystansTekst(0), '0 m');
  assert.equal(dystansTekst(850), '850 m');
  assert.equal(dystansTekst(999.4), '999 m');
  assert.equal(dystansTekst(1000), '1,0 km');
  assert.equal(dystansTekst(1650), '1,6 km', 'OCZEKIWANIE POLICZONE (L6): (1.65).toFixed(1) daje 1.6, bo 1.65 binarnie jest poniżej połowy');
  assert.equal(dystansTekst(null), '0 m');
  assert.equal(tempoTekst(0), '—', 'brak pomiaru = kreska, nie 0:00');
  assert.equal(tempoTekst(null), '—');
  assert.equal(tempoTekst(0.301), '5:01 min/km');
  assert.equal(tempoTekst(0.06), '1:00 min/km');
});

test('wynik: etykietaOdcinka — stan i tryb dojścia uczciwie nazwane', () => {
  assert.equal(etykietaOdcinka({ stan: 'zakonczony', trybDojscia: 'gps' }), 'zaliczona (GPS)');
  assert.equal(etykietaOdcinka({ stan: 'zakonczony', trybDojscia: 'reczne' }), 'zaliczona (ręcznie)');
  assert.equal(etykietaOdcinka({ stan: 'pominiety', trybDojscia: null }), 'pominięta');
  assert.equal(etykietaOdcinka({ stan: 'w-trakcie', trybDojscia: null }), 'w drodze');
  assert.equal(etykietaOdcinka({ stan: 'oczekuje', trybDojscia: null }), 'nierozegrana');
});

test('wynik: sprawiedliwoscTrasy — medal z progu 15%, pole sieciowe gdy jest', () => {
  assert.equal(PROG_MEDALU, 0.15, 'próg = kryterium jakości z ROADMAP M4');
  const proste = [
    { id: 1, odlegloscM: 800 }, { id: 2, odlegloscM: 850 },
    { id: 3, odlegloscM: 900 }, { id: 4, odlegloscM: 880 },
  ];
  const m1 = sprawiedliwoscTrasy(proste);
  assert.equal(m1.sieciowe, false);
  assert.equal(m1.medal, true, 'odchylenie ~4% ≤ 15%');

  // sieciowe: pole proste KŁAMIE (duży rozrzut), sieciowe jest równe — medal
  // musi brać dystansSieciowyM (dowód, że wybór pola działa)
  const sieciowe = [
    { id: 1, odlegloscM: 300, dystansSieciowyM: 900 },
    { id: 2, odlegloscM: 1800, dystansSieciowyM: 910 },
    { id: 3, odlegloscM: 950, dystansSieciowyM: 920 },
  ];
  const m2 = sprawiedliwoscTrasy(sieciowe);
  assert.equal(m2.sieciowe, true);
  assert.equal(m2.medal, true, 'sieciowo uczciwa, choć w linii prostej rozrzut');

  const niesprawiedliwe = [{ id: 1, odlegloscM: 400 }, { id: 2, odlegloscM: 1200 }, { id: 3, odlegloscM: 500 }];
  assert.equal(sprawiedliwoscTrasy(niesprawiedliwe).medal, false, 'odchylenie > 15% = bez medalu');
  assert.equal(sprawiedliwoscTrasy([]).medal, true, 'pusta lista = 0% (miara z M4)');
});

test('wynik: medalTekst — 🏅 z progiem albo jawny brak (uczciwie w obu stronach)', () => {
  const tak = medalTekst({ sredniaM: 823, odchylenieM: 5, udzialOdchylenia: 0.006, sieciowe: false, medal: true });
  assert.match(tak, /^🏅 Uczciwa trasa/);
  assert.match(tak, /próg 15%/);
  assert.match(tak, /w linii prostej/);
  assert.match(tak, /823 m od startu/);
  const takSiec = medalTekst({ sredniaM: 900, odchylenieM: 9, udzialOdchylenia: 0.01, sieciowe: true, medal: true });
  assert.match(takSiec, /mierzone siecią dróg/);
  const nie = medalTekst({ sredniaM: 630, odchylenieM: 300, udzialOdchylenia: 0.47, sieciowe: false, medal: false });
  assert.match(nie, /^Trasa bez medalu/);
  assert.match(nie, /47% przekracza próg 15%/);
});

test('wynik: wynikTekstowy — złoty format (nagłówek, ranking, stacje, gra, medal)', () => {
  const tekst = wynikTekstowy({
    podsumowanie: PODSUMOWANIE,
    konfig: KONFIG,
    miejsce: '  Warszawa Śródmieście ',
    data: '2026-09-06 14:32 UTC',
    sprawiedliwosc: { sredniaM: 823, odchylenieM: 5, udzialOdchylenia: 0.006, sieciowe: false, medal: true },
  });
  const linie = tekst.split('\n');
  assert.equal(linie[0], 'TAJEMNICZA OKOLICA — WYNIK GRY');
  assert.equal(linie[1], '2026-09-06 14:32 UTC · Warszawa Śródmieście · tryb: piesza · 2 graczy · 3 stacji', 'miejsce przycięte z białych znaków');
  assert.equal(linie[2], 'kategoria: dorosli · tematy: historia, przyroda');
  assert.ok(linie.includes('🏆 Anna — 120 pkt'), 'zwycięzca z rankingu');
  assert.ok(linie.includes('1. Anna — 120 pkt · poprawne 2/2 · czas odcinków 4 min 32 s'), 'ranking: kolejność, punkty, poprawne/razem, czas');
  assert.ok(linie.includes('2. Gracz 1 — 60 pkt · poprawne 1/3 · czas odcinków 12 min 40 s'));
  assert.ok(linie.includes('stacja 1 · Gracz 1 — zaliczona (GPS) · 5 min · 60 pkt'));
  assert.ok(linie.includes('stacja 2 · Anna — zaliczona (ręcznie) · 4 min 32 s · 120 pkt'));
  assert.ok(linie.includes('stacja 3 · Gracz 1 — pominięta · 0 pkt'), 'pominięta bez czasu — kreski brak, jest 0 pkt');
  assert.ok(linie.includes('czas 21 min 12 s · zaliczone 2 z 3 stacji · pominięte 1 · zdarzenia 14'));
  assert.match(tekst, /🏅 Uczciwa trasa/, 'medal na końcu');
  assert.equal(/\n\n/.test(tekst), true, 'sekcje oddzielone pustą linią (czytelne w SMS)');
  assert.equal(/[#*_`]/.test(tekst), false, 'zero markdowna — hash na początku linii byłby nagłówkiem');
});

test('wynik: wynikTekstowy — warianty (brak miejsca, przerwana, brak medalu/danych) i odmowy', () => {
  const bezMiejsca = wynikTekstowy({ podsumowanie: PODSUMOWANIE, konfig: KONFIG, data: '2026-09-06 14:32 UTC' });
  assert.match(bezMiejsca.split('\n')[1], /^2026-09-06 14:32 UTC · tryb: piesza/, 'null nie wycieka jako „null"');
  assert.equal(bezMiejsca.includes('null'), false);
  assert.equal(bezMiejsca.includes('🏅'), false, 'bez sprawiedliwosci brak linii medalu');

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
    sprawiedliwosc: sprawiedliwoscTrasy(stacje),
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
    sprawiedliwosc: { sredniaM: 823, odchylenieM: 5, udzialOdchylenia: 0.006, sieciowe: false, medal: true },
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
  assert.ok(teksty.includes('1. Anna — 120 pkt · poprawne 2/2 · czas odcinków 4 min 32 s'), 'linie rankingu WSPÓLNE z formatem tekstowym');
  assert.ok(teksty.some((x) => x.startsWith('czas 21 min 12 s · zaliczone 2 z 3')), 'statystyki gry');
  assert.ok(teksty.some((x) => x.startsWith('🏅 Uczciwa trasa')), 'medal na obrazie');
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
