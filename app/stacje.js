/**
 * stacje.js — wybór punktów docelowych (stacji).
 *
 * Docelowo stacje pochodzą z sieci drogowej pobranej z Overpass API (ADR 0005,
 * kamień M4). W M0 działa **tryb uproszczony**: punkty na pierścieniu wokół
 * pozycji startowej, z deterministycznym rozrzutem pod ziarnem (ADR 0005 pkt 8b).
 * Tryb uproszczony NIE gwarantuje osiągalności — UI musi to mówić wprost.
 *
 * Moduł czysty: bez DOM, bez sieci, bez `Math.random()` (losowość z ziarna).
 */

import { bearingStopnie, odlegloscM, przesunPunkt } from './geo.js?v=m12-22';
import { rngZZiarna } from './konfig.js?v=m12-22';

/** Źródło układu stacji — pokazywane w UI i zapisywane w paczce rozgrywki. */
export const ZRODLA_STACJI = {
  pierscien: 'tryb uproszczony (pierścień) — osiągalność niezweryfikowana',
  siec: 'sieć drogowa (Overpass) — punkty osiągalne',
  reczne: 'ustawione ręcznie przez organizatora',
};

/**
 * Stacje na pierścieniu: `liczbaStacji` punktów wokół `srodek`, w odległości
 * ~`promienM × 0.65–0.85`, z kątowym rozrzutem ±25% kroku. Deterministyczne
 * dla danego ziarna — ta sama gra daje ten sam układ.
 */
export function stacjeProste({ srodek, liczbaStacji, promienM, ziarno, offsetObrotu = 0 }) {
  if (!srodek || !Number.isFinite(srodek.lat) || !Number.isFinite(srodek.lon)) {
    throw new TypeError('stacjeProste: brak poprawnego środka');
  }
  if (!Number.isInteger(liczbaStacji) || liczbaStacji < 1) throw new TypeError('stacjeProste: liczbaStacji >= 1');
  if (!(promienM > 0)) throw new TypeError('stacjeProste: promienM > 0');

  const losuj = rngZZiarna(`${ziarno}|${offsetObrotu}`);
  const krok = 360 / liczbaStacji;
  const stacje = [];
  for (let i = 0; i < liczbaStacji; i++) {
    const kat = (offsetObrotu + i * krok + (losuj() - 0.5) * 0.5 * krok + 360) % 360;
    const promien = promienM * (0.65 + 0.2 * losuj());
    const punkt = przesunPunkt(srodek, kat, promien);
    stacje.push({
      id: i + 1,
      lat: punkt.lat,
      lon: punkt.lon,
      opis: '',
      kat,
      zrodlo: 'pierscien',
    });
  }
  return uzupelnijOdleglosci(stacje, srodek);
}

/** Dopisuje `odlegloscM` i `bearing` od środka — używane w UI i w miarach. */
export function uzupelnijOdleglosci(stacje, srodek) {
  return stacje.map((s) => ({
    ...s,
    odlegloscM: Math.round(odlegloscM(srodek, s)),
    bearing: Math.round(bearingStopnie(srodek, s)),
  }));
}

/** Minimalna odległość między dwiema stacjami (metry) — do passu wyrównującego. */
export function najmniejszyOdstepM(stacje) {
  let min = Infinity;
  for (let i = 0; i < stacje.length; i++) {
    for (let j = i + 1; j < stacje.length; j++) {
      const d = odlegloscM(stacje[i], stacje[j]);
      if (d < min) min = d;
    }
  }
  return Number.isFinite(min) ? Math.round(min) : 0;
}

/* =========================== M4: stacje z sieci drogowej (ADR 0005 pkt 5) */

import { dijkstra, sciezkaDo, snapujPunkt, usterka } from './sieci.js?v=m12-22';

/** Stałe pierścienia i separacji z ADR 0005 pkt 5 — wszystkie konfigurowalne. */
export const PIERSCIEN_WYBORU = {
  /** Docelowy dystans sieciowy: `r = R × udzial`. */
  udzial: 0.7,
  /** Pasmo wokół r: `[r × (1 − tolerancja), r × (1 + tolerancja)]`. */
  tolerancja: 0.2,
  /** Separacja kątowa od startu między stacjami: `≥ udzial × 360°/N`. */
  separacjaKatowaUdzial: 0.7,
  /** Separacja SIECIOWA między stacjami: `≥ udzial × r`. */
  separacjaSieciowaUdzial: 0.5,
  /** Pass wyrównujący karze pary bliższe niż `udzial × r`. */
  karaParaUdzial: 0.3,
  /** Szum ziarna w greedy: ±`udzial × r` — inne ziarno, inny układ. */
  szumZiarnaUdzial: 0.02,
  /** Ile rund zamian robi pass wyrównujący. */
  maxRundWyrownania: 3,
  /** Ile alternatyw na stację bierze pass (budżet dijkstr na telefonie). */
  alternatywNaStacje: 8,
};

function roznicaKatow(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function kosztUkladu(dystanse, macierz, karaParaM) {
  // odchylenie standardowe dystansów sieciowych + kara za ciasne pary (metry)
  const n = dystanse.length;
  if (n === 0) return Infinity;
  const srednia = dystanse.reduce((a, b) => a + b, 0) / n;
  const wariancja = dystanse.reduce((a, b) => a + (b - srednia) ** 2, 0) / n;
  let kara = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = macierz[i][j];
      if (Number.isFinite(d) && d < karaParaM) kara += karaParaM - d;
    }
  }
  return Math.sqrt(wariancja) + kara;
}

/**
 * Wybór stacji z sieci drogowej (ADR 0005 pkt 5) — cały algorytm jest funkcją
 * `(kandydaci, graf, środek, konfiguracja, ziarno)`:
 *
 * 1. **greedy**: kandydaci sortowani wg `|d_sieci − r|` (r = R × 0.7) z szumem
 *    ziarna ±2% r, przyjmowani jeśli trzymają separację kątową ≥ 0.7×360°/N
 *    od startu i separację SIECIOWĄ ≥ 0.5 r od już wybranych;
 * 2. **pass wyrównujący**: zamiany parami (stacja ↔ najlepsza alternatywa)
 *    akceptowane, gdy ściśle zmniejszają koszt = odchylenie standardowe
 *    dystansów + kara za pary bliższe niż 0.3 r;
 * 3. wynik: stacje (`zrodlo: 'siec'`, dystans sieciowy, sugerowana ścieżka),
 *    macierz odległości sieciowych, sprawiedliwość liczona na dystansach
 *    SIECIOWYCH (w linii prostej 800 m bywa 3 km przez rzekę bez mostu).
 *
 * Gdy sieć jest za uboga na N stacji, zwraca tyle, ile się dało, z usterką
 * `S12` — decyzję (ostrzeżenie, pierścień awaryjny) podejmuje UI. Start zbyt
 * daleko od sieci to `S13` (rzucane — bez startu nie ma gry).
 */
/**
 * Dystanse odcinków gry z wyniku wyboru sieciowego (ADR 0014 pkt 1: od M4
 * dystans odcinka to dystans sieciowy, nie prosta kreska): odcinek 0 to
 * droga start→stacja1, odcinek i>0 to macierz[i-1][i] (stacja→stacja).
 * Zwraca tablicę długości N z liczbami albo nullami (null = para
 * nieosiągalna albo brak wyniku — rozgrywka liczy wtedy linię prostą).
 */
export function dystanseOdcinkowM(wynik) {
  const stacje = wynik?.stacje;
  const macierz = wynik?.macierz;
  if (!Array.isArray(stacje) || stacje.length === 0 || !Array.isArray(macierz)) return null;
  const liczba = (v) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
  return stacje.map((s, i) => (i === 0 ? liczba(s?.dystansSieciowyM) : liczba(macierz[i - 1]?.[i])));
}

export function wybierzStacje({ graf, kandydaci, srodek, konfig, ziarno = 0, stale = PIERSCIEN_WYBORU }) {
  if (!graf?.wezly?.length) throw usterka('S09', 'graf pusty');
  if (!Array.isArray(kandydaci) || kandydaci.length === 0) throw usterka('S12', 'brak kandydatów');
  if (!srodek || !Number.isFinite(srodek.lat) || !Number.isFinite(srodek.lon)) {
    throw new TypeError('wybierzStacje: brak poprawnego środka');
  }
  const N = konfig?.liczbaStacji;
  const R = konfig?.promienM;
  if (!Number.isInteger(N) || N < 1) throw new TypeError('wybierzStacje: liczbaStacji >= 1');
  if (!(R > 0)) throw new TypeError('wybierzStacje: promienM > 0');

  const start = snapujPunkt(graf, srodek, { maxM: 150 });
  if (start === null) throw usterka('S13');

  const r = R * stale.udzial;
  const pasmo = [r * (1 - stale.tolerancja), r * (1 + stale.tolerancja)];
  const katMin = N > 1 ? stale.separacjaKatowaUdzial * (360 / N) : 0;
  const siecMin = stale.separacjaSieciowaUdzial * r;
  const karaParaM = stale.karaParaUdzial * r;

  const dStart = dijkstra(graf, start);
  const losuj = rngZZiarna(`wybierzStacje|${ziarno}`);

  // 1) ocena kandydatów: bliskość pasma + szum ziarna (deterministyczny sort)
  const ocenieni = [];
  for (let i = 0; i < kandydaci.length; i++) {
    const k = kandydaci[i];
    const d = dStart.dystanse[k.wezel];
    if (!Number.isFinite(d)) continue; // nieosiągalny — nie istnieje dla gry
    const szum = (losuj() - 0.5) * 2 * stale.szumZiarnaUdzial * r;
    ocenieni.push({ k, d, kat: bearingStopnie(srodek, k), score: Math.abs(d - r) + szum, i });
  }
  ocenieni.sort((a, b) => a.score - b.score || a.i - b.i);
  if (ocenieni.length === 0) throw usterka('S12', 'żaden kandydat nieosiągalny ze startu');

  // pamięć dijkstr: klucz = indeks węzła (start + wybrane + alternatywy)
  const pamiecDijkstra = new Map([[start, dStart]]);
  function wynikZWezla(wezel) {
    let w = pamiecDijkstra.get(wezel);
    if (!w) {
      w = dijkstra(graf, wezel);
      pamiecDijkstra.set(wezel, w);
    }
    return w;
  }

  // 2) greedy z separacjami
  const wybrane = []; // { k, d, kat, wynik }
  function spelniaSeparacje(propozycja, bezIndeksu = null) {
    for (let s = 0; s < wybrane.length; s++) {
      if (s === bezIndeksu) continue;
      if (roznicaKatow(propozycja.kat, wybrane[s].kat) < katMin) return false;
      const dystans = wybrane[s].wynik.dystanse[propozycja.k.wezel];
      if (Number.isFinite(dystans) && dystans < siecMin) return false;
    }
    return true;
  }
  const zajete = new Set();
  for (const x of ocenieni) {
    if (wybrane.length >= N) break;
    if (!spelniaSeparacje(x)) continue;
    wybrane.push({ ...x, wynik: wynikZWezla(x.k.wezel) });
    zajete.add(x.i);
  }

  // 3) pass wyrównujący: zamiana stacji na lepszą alternatywę
  const alternatywy = ocenieni.filter((x) => !zajete.has(x.i)).slice(0, N * stale.alternatywNaStacje);
  function macierzZ(wybr) {
    return wybr.map((w) => wybr.map((v) => (w === v ? 0 : w.wynik.dystanse[v.k.wezel])));
  }
  let koszt = kosztUkladu(wybrane.map((w) => w.d), macierzZ(wybrane), karaParaM);
  for (let runda = 0; runda < stale.maxRundWyrownania && wybrane.length === N; runda++) {
    let poprawa = false;
    for (let s = 0; s < wybrane.length; s++) {
      for (const alt of alternatywy) {
        if (zajete.has(alt.i)) continue;
        if (!spelniaSeparacje(alt, s)) continue;
        const proba = wybrane.map((w, idx) => (idx === s ? { ...alt, wynik: wynikZWezla(alt.k.wezel) } : w));
        const nowyKoszt = kosztUkladu(proba.map((w) => w.d), macierzZ(proba), karaParaM);
        if (nowyKoszt < koszt - 1) { // ściśle lepiej o ponad metr — koniec dryfu
          zajete.delete(wybrane[s].i);
          zajete.add(alt.i);
          wybrane[s] = proba[s];
          koszt = nowyKoszt;
          poprawa = true;
          break; // od nowa dla tej stacji, z aktualnym układem
        }
      }
      if (poprawa) break;
    }
    if (!poprawa) break;
  }

  // 4) wynik: stacje w kolejności kąta od północy (czytelna mapa i paczka)
  wybrane.sort((a, b) => a.kat - b.kat);
  const stacje = wybrane.map((w, idx) => ({
    id: idx + 1,
    lat: w.k.lat,
    lon: w.k.lon,
    opis: w.k.nazwa ?? '',
    kat: w.kat,
    zrodlo: 'siec',
    typKandydata: w.k.typ,
    dystansSieciowyM: Math.round(w.d),
    wezel: w.k.wezel,
    sciezkaPunkty: (sciezkaDo(dStart, w.k.wezel) ?? []).map((i) => ({ lat: graf.wezly[i].lat, lon: graf.wezly[i].lon })),
  }));
  const zOdleglosciami = uzupelnijOdleglosci(stacje, srodek);
  const macierz = wybrane.map((w) => wybrane.map((v) => {
    if (w === v) return 0;
    const d = w.wynik.dystanse[v.k.wezel];
    return Number.isFinite(d) ? Math.round(d) : null; // null = para nieosiągalna
  }));

  const usterki = [];
  if (zOdleglosciami.length < N) usterki.push({ kod: 'S12', komunikat: `Wybrano ${zOdleglosciami.length} z ${N} stacji.` });

  return {
    stacje: zOdleglosciami,
    macierz,
    pierscien: { r: Math.round(r), pasmo: [Math.round(pasmo[0]), Math.round(pasmo[1])], start },
    liczniki: { kandydatow: kandydaci.length, ocenionych: ocenieni.length, dijkstr: pamiecDijkstra.size },
    usterki,
  };
}
