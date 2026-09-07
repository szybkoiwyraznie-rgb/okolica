/**
 * Wynik gry (M7) — czyste funkcje: formatowanie liczb, medal sprawiedliwości
 * trasy i TEKST wyniku do udostępnienia (plan M7, decyzje 3 i 4).
 * Bez DOM i bez zegara: datę i `podsumowanie()` podaje warstwa DOM
 * (ADR 0004 pkt 3); matematyka należy do `rozgrywka.podsumowanie()`
 * i `stacje.miaraSprawiedliwosci()` — ten moduł tylko układa słowa.
 *
 * Prywatność (ADR 0013): tekst wyniku NIE niesie treści pytań ani
 * współrzędnych — stacje występują jako NUMERY, miejsce jako nazwa.
 */
import { STANY_ODCINKA, TRYBY_DOJSCIA } from './rozgrywka.js?v=m12-1';
import { miaraSprawiedliwosci } from './stacje.js?v=m12-1';

/** Próg medalu „uczciwa trasa" — kryterium jakości z ROADMAP M4 (ADR 0005 pkt 5). */
export const PROG_MEDALU = 0.15;

/** Sekundy → czytelny czas: „45 s", „12 min 5 s", „1 godz 2 min". */
export function czasTekst(sekundy) {
  const s = Math.max(0, Math.round(Number.isFinite(sekundy) ? sekundy : 0));
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min ${s % 60} s`.replace(/ 0 s$/, '');
  return `${Math.floor(min / 60)} godz ${min % 60} min`;
}

/** Metry → „850 m" albo „1,6 km" (polski przecinek, bez locale — deterministycznie). */
export function dystansTekst(metry) {
  const m = Number.isFinite(metry) ? metry : 0;
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Tempo (s/m z `podsumowanie()`) → „5:01 min/km"; zero = brak pomiaru → „—". */
export function tempoTekst(srednieTempoSM) {
  if (!(srednieTempoSM > 0)) return '—';
  const sekNaKm = Math.round(srednieTempoSM * 1000);
  return `${Math.floor(sekNaKm / 60)}:${String(sekNaKm % 60).padStart(2, '0')} min/km`;
}

/** Etykieta odcinka: stan + tryb dojścia (uczciwie, co zmierzone). */
export function etykietaOdcinka(s) {
  if (s.stan === STANY_ODCINKA.zakonczony) return s.trybDojscia === TRYBY_DOJSCIA.reczne ? 'zaliczona (ręcznie)' : 'zaliczona (GPS)';
  if (s.stan === STANY_ODCINKA.pominiety) return 'pominięta';
  if (s.stan === STANY_ODCINKA.wTrakcie) return 'w drodze';
  return 'nierozegrana';
}

/**
 * Sprawiedliwość trasy z listy stacji: pola sieciowe, gdy stacje je mają
 * (także po wznowieniu gry z zapisu — snapshot niesie `dystansSieciowyM`),
 * inaczej proste `odlegloscM`. `medal` — udział odchylenia ≤ `PROG_MEDALU`.
 */
export function sprawiedliwoscTrasy(stacje) {
  const lista = Array.isArray(stacje) ? stacje : [];
  const sieciowe = lista.some((s) => Number.isFinite(s?.dystansSieciowyM));
  const m = miaraSprawiedliwosci(lista, { pole: sieciowe ? 'dystansSieciowyM' : 'odlegloscM' });
  return { ...m, sieciowe, medal: m.udzialOdchylenia <= PROG_MEDALU };
}

/** Zdanie o medalu do panelu wyniku (🏅 albo jawny brak — bez medalu też uczciwie). */
export function medalTekst(sp) {
  const procent = Math.round(sp.udzialOdchylenia * 100);
  const miara = sp.sieciowe ? ', mierzone siecią dróg' : ', w linii prostej';
  return sp.medal
    ? `🏅 Uczciwa trasa — odchylenie dystansów ${procent}% (próg ${Math.round(PROG_MEDALU * 100)}%)${miara} · średnio ${sp.sredniaM} m od startu.`
    : `Trasa bez medalu — odchylenie dystansów ${procent}% przekracza próg ${Math.round(PROG_MEDALU * 100)}% (średnio ${sp.sredniaM} m od startu).`;
}

function wymaganie(warunek, komunikat) {
  if (!warunek) throw new TypeError(komunikat);
}

/** Wspólne linie dla tekstu i obrazu — format NIE może się rozjechać (P4/P5). */
function liniaDanych({ podsumowanie, konfig, miejsce, data }) {
  return [
    data,
    miejsce && miejsce.trim() ? miejsce.trim() : null,
    `tryb: ${konfig.tryb}`,
    `${podsumowanie.gracze.length} graczy`,
    `${podsumowanie.stacje.length} stacji`,
  ].filter(Boolean).join(' · ');
}

function liniaKategorii(konfig) {
  if (!konfig.wiek && !(Array.isArray(konfig.tematy) && konfig.tematy.length)) return null;
  return [
    konfig.wiek ? `kategoria: ${konfig.wiek}` : null,
    konfig.tematy?.length ? `tematy: ${konfig.tematy.join(', ')}` : null,
  ].filter(Boolean).join(' · ');
}

function linieRankingu(podsumowanie) {
  const linie = [];
  podsumowanie.ranking.forEach((id, i) => {
    const g = podsumowanie.gracze.find((gracz) => gracz.id === id);
    if (!g) return;
    linie.push(`${i + 1}. ${g.imie} — ${g.punkty} pkt · poprawne ${g.poprawne}/${g.poprawne + g.bledne} · czas odcinków ${czasTekst(g.czasOdcinkowS)}`);
  });
  return linie;
}

function liniaGry(podsumowanie) {
  return `czas ${czasTekst(podsumowanie.czasGryS)} · zaliczone ${podsumowanie.zaliczoneStacje} z ${podsumowanie.stacje.length} stacji · pominięte ${podsumowanie.pominietaStacje} · zdarzenia ${podsumowanie.zdarzen}`;
}

function walidujWejscieWyniku({ podsumowanie, konfig, miejsce }) {
  wymaganie(podsumowanie && typeof podsumowanie === 'object' && Array.isArray(podsumowanie.ranking) && Array.isArray(podsumowanie.gracze) && Array.isArray(podsumowanie.stacje),
    'wynik: podsumowanie musi być wynikiem rozgrywka.podsumowanie()');
  wymaganie(konfig && typeof konfig === 'object' && typeof konfig.tryb === 'string',
    'wynik: konfig z trybem jest wymagany');
  wymaganie(miejsce === null || miejsce === undefined || typeof miejsce === 'string', 'wynik: miejsce to nazwa albo null');
}

/**
 * TEKST wyniku do udostępnienia (ADR 0010 pkt 5): linie zwykłego tekstu —
 * czytelne w SMS-ie i komunikatorze, bez markdowna. `podsumowanie` — wynikiem
 * z `rozgrywka.podsumowanie()`; `data` — gotowym stringiem (formatuje warstwa
 * DOM); `miejsce` — nazwą albo null; `sprawiedliwosc` — wynikiem
 * `sprawiedliwoscTrasy()`; `przerwana` — znacznikiem ręcznego zakończenia.
 */
export function wynikTekstowy({ podsumowanie, konfig, miejsce = null, data = '', sprawiedliwosc = null, przerwana = false } = {}) {
  walidujWejscieWyniku({ podsumowanie, konfig, miejsce });

  const imiona = new Map(podsumowanie.gracze.map((g) => [g.id, g.imie]));
  const linie = [];
  linie.push('TAJEMNICZA OKOLICA — WYNIK GRY');
  linie.push(liniaDanych({ podsumowanie, konfig, miejsce, data }));
  const kategoria = liniaKategorii(konfig);
  if (kategoria) linie.push(kategoria);
  if (przerwana) linie.push('(gra przerwana ręcznie — wynik wczesny)');

  const zwyciezca = podsumowanie.gracze.find((g) => g.id === podsumowanie.zwyciezca) ?? null;
  linie.push('');
  linie.push(zwyciezca ? `🏆 ${zwyciezca.imie} — ${zwyciezca.punkty} pkt` : '🏆 brak zwycięzcy — żadna odpowiedź nie została zapisana');

  linie.push('');
  linie.push('RANKING');
  linie.push(...linieRankingu(podsumowanie));

  linie.push('');
  linie.push('STACJE');
  for (const s of podsumowanie.stacje) {
    const gracz = s.gracz != null ? (imiona.get(s.gracz) ?? `#${s.gracz}`) : '—';
    const czas = s.czasS != null ? ` · ${czasTekst(s.czasS)}` : '';
    linie.push(`stacja ${s.id} · ${gracz} — ${etykietaOdcinka(s)}${czas} · ${s.punkty} pkt`);
  }

  linie.push('');
  linie.push('GRA');
  linie.push(liniaGry(podsumowanie));
  if (sprawiedliwosc) linie.push(medalTekst(sprawiedliwosc));

  return linie.join('\n');
}

/* ------------------------------------------------------- obraz wyniku (P5) */

/**
 * Role kolorów obrazu → zmienne CSS motywu (plan M7, ryzyko „toBlob i motywy"):
 * czysty plan pracuje na ROLACH, a konkretne wartości bierze wykonawca
 * z `getComputedStyle` — ciemny motyw nie rozjeżdża się z planem.
 */
export const ROLE_PALETY = Object.freeze({
  tlo: '--tlo',
  karta: '--tlo-karta',
  tekst: '--tekst',
  tekstSlaby: '--tekst-slaby',
  akcent: '--akcent',
  linia: '--linia',
  ostrzezenie: '--ostrzezenie',
});

/**
 * Plan rysowania obrazu wyniku (wzorzec planu mapy z M2: matematyka czysta
 * i testowalna, wykonawca cienki). Zwraca `{ szerokosc, wysokosc, komendy }`;
 * komendy: `{typ:'prostokat'|'tekst'|'linia', …, kolorRola}` — bez konkretów
 * kolorów (role z `ROLE_PALETY`) i bez treści pytań/współrzędnych (ADR 0013).
 * Obraz to esencja: nagłówek, zwycięzca, ranking, gra, medal — stacje żyją
 * w tekście (na obrazie byłaby to ściana drobnicy nieczytelna w słońcu).
 */
export function planObrazuWyniku({ podsumowanie, konfig, miejsce = null, data = '', sprawiedliwosc = null, przerwana = false, szerokosc = 1080 } = {}) {
  walidujWejscieWyniku({ podsumowanie, konfig, miejsce });
  wymaganie(Number.isFinite(szerokosc) && szerokosc >= 320, 'planObrazuWyniku: szerokosc ≥ 320 px');

  const M = Math.round(szerokosc * 0.045); // margines zewnętrzny
  const P = Math.round(szerokosc * 0.037); // padding karty
  const x0 = M + P;
  const x1 = szerokosc - M - P;
  const komendy = [];
  let y = M + P;

  const tekst = (tresc, rozmiar, kolorRola, waga = 400, krok = null) => {
    komendy.push({ typ: 'tekst', x: x0, y: y + rozmiar, tekst: tresc, rozmiar, waga, kolorRola });
    y += krok ?? Math.round(rozmiar * 1.45);
  };

  tekst('TAJEMNICZA OKOLICA', Math.round(szerokosc * 0.026), 'akcent', 700);
  tekst('WYNIK GRY', Math.round(szerokosc * 0.052), 'tekst', 700, Math.round(szerokosc * 0.075));
  tekst(liniaDanych({ podsumowanie, konfig, miejsce, data }), Math.round(szerokosc * 0.022), 'tekstSlaby');
  const kategoria = liniaKategorii(konfig);
  if (kategoria) tekst(kategoria, Math.round(szerokosc * 0.022), 'tekstSlaby');
  if (przerwana) tekst('(gra przerwana ręcznie — wynik wczesny)', Math.round(szerokosc * 0.022), 'ostrzezenie', 600);
  y += Math.round(szerokosc * 0.02);

  const zwyciezca = podsumowanie.gracze.find((g) => g.id === podsumowanie.zwyciezca) ?? null;
  if (zwyciezca) {
    tekst(`🏆 ${zwyciezca.imie}`, Math.round(szerokosc * 0.037), 'tekst', 700);
    tekst(`${zwyciezca.punkty} pkt`, Math.round(szerokosc * 0.06), 'akcent', 700, Math.round(szerokosc * 0.075));
    tekst(`poprawne ${zwyciezca.poprawne}/${zwyciezca.poprawne + zwyciezca.bledne} · czas odcinków ${czasTekst(zwyciezca.czasOdcinkowS)}`, Math.round(szerokosc * 0.022), 'tekstSlaby');
  } else {
    tekst('🏆 brak zwycięzcy — żadna odpowiedź nie została zapisana', Math.round(szerokosc * 0.03), 'tekstSlaby', 600);
  }
  y += Math.round(szerokosc * 0.015);
  komendy.push({ typ: 'linia', x1: x0, y1: y, x2: x1, y2: y, kolorRola: 'linia' });
  y += Math.round(szerokosc * 0.035);

  tekst('RANKING', Math.round(szerokosc * 0.024), 'tekstSlaby', 700);
  for (const linia of linieRankingu(podsumowanie)) tekst(linia, Math.round(szerokosc * 0.028), 'tekst');
  y += Math.round(szerokosc * 0.015);
  komendy.push({ typ: 'linia', x1: x0, y1: y, x2: x1, y2: y, kolorRola: 'linia' });
  y += Math.round(szerokosc * 0.035);

  tekst('GRA', Math.round(szerokosc * 0.024), 'tekstSlaby', 700);
  tekst(liniaGry(podsumowanie), Math.round(szerokosc * 0.024), 'tekst');
  if (sprawiedliwosc) tekst(medalTekst(sprawiedliwosc), Math.round(szerokosc * 0.024), sprawiedliwosc.medal ? 'akcent' : 'tekstSlaby', sprawiedliwosc.medal ? 600 : 400);
  y += Math.round(szerokosc * 0.02);
  tekst('Wygenerowano na urządzeniu — bez konta, bez serwera.', Math.round(szerokosc * 0.02), 'tekstSlaby');

  const wysokosc = y + P + M;
  return {
    szerokosc,
    wysokosc,
    komendy: [
      { typ: 'prostokat', x: 0, y: 0, w: szerokosc, h: wysokosc, kolorRola: 'tlo' },
      { typ: 'prostokat', x: M, y: M, w: szerokosc - 2 * M, h: wysokosc - 2 * M, kolorRola: 'karta' },
      ...komendy,
    ],
  };
}
