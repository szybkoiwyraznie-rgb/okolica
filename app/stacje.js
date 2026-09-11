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

import { bearingStopnie, odlegloscM, przesunPunkt } from './geo.js?v=m12-66';
import { rngZZiarna } from './konfig.js?v=m12-66';

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

import { dijkstra, sciezkaDo, snapujPunkt, usterka } from './sieci.js?v=m12-66';

/** Stałe pierścienia i separacji z ADR 0005 pkt 5 — wszystkie konfigurowalne. */
export const PIERSCIEN_WYBORU = {
  /** Docelowy dystans sieciowy: `r = R × udzial` — stacje CIĄŻĄ do tego okręgu. */
  udzial: 0.7,
  /** Pasmo wokół r: `[r × (1 − tolerancja), r × (1 + tolerancja)]`. */
  tolerancja: 0.2,
  /**
   * DOPUSZCZALNY dystans sieciowy od startu (decyzja właściciela 2026-09-09):
   * `[udzialMin × R, R]`. Pasmo wokół `r` zostaje jako preferencja w sorcie,
   * ale nie odrzuca już kandydatów — właściciel: „skoro R=1000m to wyobrażam
   * sobie stacje oddalone od 350m do 1000m od miejsca startu (skoro promień to
   * 1000m to czemu zatrzymujemy się na 840m?)". Dolne 0.35 × R to dokładnie
   * separacja sieciowa (0.5 × 0.7 × R = 0.35 × R), więc „nie bliżej niż 350 m"
   * znaczy to samo od startu i między stacjami.
   */
  udzialMin: 0.35,
  /** Górna granica dystansu od startu: `udzialMax × R` (1.0 = pełny promień). */
  udzialMax: 1,
  /** Separacja kątowa od startu między stacjami: `≥ udzial × 360°/N` (górny szczebel drabinki). */
  separacjaKatowaUdzial: 0.7,
  /**
   * Drabinka ustępstw kątowych (decyzja właściciela 2026-09-09). Gdy sieć nie
   * pozwala rozstawić N stacji przy pełnym kącie, schodzimy szczebel niżej,
   * zamiast oddawać mniej stacji: 0.7 → 0.5 → 0.35 → 0.2 → 0 (brak wymogu).
   * Właściciel: „nie widzę sensu w tej separacji kątowej (…) jeśli koniecznie
   * chcesz to utrzymać to możesz zrobić jakąś drabinkę priorytetów — od
   * dzisiejszego kąta stopniowo aż do braku wymaganego kąta (o ile 2a i 2b są
   * spełnione)". Separacja sieciowa i dystans od startu NIE ustępują nigdy.
   */
  drabinkaKatowa: [0.7, 0.5, 0.35, 0.2, 0],
  /** Separacja SIECIOWA między stacjami: `≥ udzial × r`. */
  separacjaSieciowaUdzial: 0.5,
  /**
   * Separacja W LINII PROSTEJ między stacjami: `≥ udzial × r` (zgłoszenie
   * właściciela 2026-09-09: „na bank niektóre stacje są mniej niż 350m od
   * siebie. Tak na oko są takie oddalone o max 100m").
   *
   * Sama separacja sieciowa tego nie łapie: przy krętej sieci (rzeka, tory,
   * ślepe uliczki) dwa punkty odległe o 121 m NA MAPIE mają 388 m drogami
   * i spełniały próg. Gracz patrzy na mapę i widzi dwie pinezki obok siebie —
   * dlatego próg musi obowiązywać w OBU metrykach naraz. Ten sam udział co
   * sieciowa, więc „nie bliżej niż 350 m" znaczy jedno przy R = 1000 m.
   */
  separacjaProstaUdzial: 0.5,
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

/**
 * Koszt układu (mniej = lepiej): równość dystansów + ciasne pary + SKUPISKA.
 *
 * Trzeci składnik dołożony 2026-09-09 (zgłoszenie właściciela: „większość jest
 * w jednym miejscu mimo dość dużego promienia"). Bez niego pass wyrównujący
 * widział tylko odchylenie dystansów od środka, więc chętnie zamieniał dobrze
 * rozrzuconą stację na taką, która lepiej trafia w pierścień — i cofał rozrzut
 * wypracowany przez greedy. Kara liczy PUSTE LUKI kątowe: idealny układ ma
 * wszystkie luki równe `360/n`, każda nadwyżka ponad to jest karana. Waga 2 m
 * na stopień sprowadza karę do tej samej skali co metry (przy 8 stacjach luka
 * o 30° za duża = 60 m kary, porównywalnie z rozjazdem dystansów).
 */
function kosztUkladu(dystanse, macierz, karaParaM, katy = null) {
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
  let karaLuk = 0;
  if (Array.isArray(katy) && katy.length > 1) {
    const posortowane = [...katy].sort((a, b) => a - b);
    const idealna = 360 / posortowane.length;
    for (let i = 0; i < posortowane.length; i++) {
      const nastepny = i + 1 < posortowane.length ? posortowane[i + 1] : posortowane[0] + 360;
      const luka = nastepny - posortowane[i];
      if (luka > idealna) karaLuk += (luka - idealna) * WAGA_LUKI_M_NA_STOPIEN;
    }
  }
  return Math.sqrt(wariancja) + kara + karaLuk;
}

/** Ile metrów kary za każdy stopień pustej luki ponad `360/n` (patrz `kosztUkladu`). */
const WAGA_LUKI_M_NA_STOPIEN = 2;

/**
 * Szerokość kubełka kątowego przy doborze stacji (patrz `zbierzUkladem`).
 * Kandydaci różniący się o mniej niż tyle stopni są kątowo „równoważni",
 * więc decyduje między nimi bliskość pierścienia. 20° to około połowy
 * idealnego odstępu przy 8 stacjach (45°) — dość, by nie gubić rozrzutu,
 * i dość, by nie psuć równości dystansów.
 */
const KUBELEK_KATA = 20;

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
  // Zakres DOPUSZCZALNY (2026-09-09): od `udzialMin × R` do pełnego R. Pasmo
  // wokół r zostaje tylko preferencją w sorcie — kandydat 950 m przy R=1000
  // jest gorszy od kandydata 700 m, ale nie jest już odrzucany.
  const dolnyM = stale.udzialMin * R;
  const gornyM = (stale.udzialMax ?? 1) * R;
  const siecMin = stale.separacjaSieciowaUdzial * r;
  const prostaMin = (stale.separacjaProstaUdzial ?? 0) * r;
  const karaParaM = stale.karaParaUdzial * r;

  const dStart = dijkstra(graf, start);
  const losuj = rngZZiarna(`wybierzStacje|${ziarno}`);

  // 1) ocena kandydatów: bliskość pasma + szum ziarna (deterministyczny sort)
  const ocenieni = [];
  for (let i = 0; i < kandydaci.length; i++) {
    const k = kandydaci[i];
    const d = dStart.dystanse[k.wezel];
    if (!Number.isFinite(d)) continue; // nieosiągalny — nie istnieje dla gry
    if (d < dolnyM || d > gornyM) continue; // poza dopuszczalnym zakresem od startu
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

  // 2) greedy z separacjami — z DRABINKĄ ustępstw kątowych (2026-09-09).
  //
  // Kąt jest jedynym progiem, który ustępuje. Separacja sieciowa (350 m przy
  // R=1000) i zakres dystansu od startu obowiązują na każdym szczeblu: to one
  // pilnują, żeby stacje nie stały jedna na drugiej. Kąt tylko ROZKŁADA je
  // wokół startu, a w sieci, która biegnie jednym korytarzem (rzeka, las,
  // osiedle bez przelotów), sztywne 0.7 × 360°/N oddawało mniej stacji, niż
  // dało się uczciwie postawić.
  //
  // Każdy szczebel liczymy od zera na tej samej liście `ocenieni` (jest już
  // posortowana deterministycznie), więc wynik nie zależy od kolejności prób.
  // Schodzimy niżej TYLKO gdy nie udało się zebrać kompletu N.
  let wybrane = []; // { k, d, kat, wynik }
  let zajete = new Set();
  let katMin = 0;
  let szczebelKatowy = 0;

  const drabinka = Array.isArray(stale.drabinkaKatowa) && stale.drabinkaKatowa.length
    ? stale.drabinkaKatowa
    : [stale.separacjaKatowaUdzial];

  function spelniaSeparacje(propozycja, wybr, prog, bezIndeksu = null) {
    for (let s = 0; s < wybr.length; s++) {
      if (s === bezIndeksu) continue;
      if (roznicaKatow(propozycja.kat, wybr[s].kat) < prog) return false;
      const dystans = wybr[s].wynik.dystanse[propozycja.k.wezel];
      if (Number.isFinite(dystans) && dystans < siecMin) return false;
      // Druga metryka, TWARDA jak sieciowa: odległość widziana na mapie.
      // Bez niej kręta sieć przepuszcza pinezki stojące obok siebie.
      if (odlegloscM(propozycja.k, wybr[s].k) < prostaMin) return false;
    }
    return true;
  }

  // Wybór wewnątrz szczebla: FARTHEST-POINT SAMPLING po kącie, nie „pierwszy
  // pasujący z listy". Zgłoszenie właściciela 2026-09-09: „większość jest
  // w jednym miejscu mimo dość dużego promienia. Stacje koncentrują się blisko
  // siebie."
  //
  // Poprzednia pętla brała kandydatów w kolejności `|d − r|`, więc gdy sieć
  // miała gęste skupisko w dobrej odległości, wypełniała nim komplet i kończyła
  // — separacje tylko odrzucały najbliższe sąsiedztwo, ale nie ciągnęły układu
  // w puste kierunki. Teraz pierwszą stację bierzemy najlepszą wg score,
  // a każdą kolejną tę, która MAKSYMALIZUJE minimalny kąt do już wybranych
  // (remis → lepszy score, potem indeks: determinizm pod ziarnem zachowany).
  function zbierzUkladem(prog) {
    const proba = [];
    const uzyte = new Set();
    while (proba.length < N) {
      let najlepszy = null;
      for (const x of ocenieni) {
        if (uzyte.has(x.i)) continue;
        if (!spelniaSeparacje(x, proba, prog)) continue;
        // Minimalny dystans kątowy do już wybranych — im większy, tym lepiej.
        // KUBEŁKOWANY co `KUBELEK_KATA`: bez tego kąt zdominowałby wybór
        // i układ przestałby przypominać pierścień (kandydat 5° dalej, ale
        // 200 m od docelowego r, wygrywałby z niemal równie dobrym kątowo,
        // a leżącym dokładnie na pierścieniu). Wewnątrz kubełka rozstrzyga
        // `score`, czyli bliskość `r` — tak obie cechy dostają swój głos.
        let minKat = Infinity;
        for (const w of proba) minKat = Math.min(minKat, roznicaKatow(x.kat, w.kat));
        const klucz = proba.length === 0 ? 0 : -Math.floor(minKat / KUBELEK_KATA);
        if (najlepszy === null
          || klucz < najlepszy.klucz
          || (klucz === najlepszy.klucz && x.score < najlepszy.x.score)
          || (klucz === najlepszy.klucz && x.score === najlepszy.x.score && x.i < najlepszy.x.i)) {
          najlepszy = { x, klucz };
        }
      }
      if (najlepszy === null) break; // nic już nie przechodzi progów
      proba.push({ ...najlepszy.x, wynik: wynikZWezla(najlepszy.x.k.wezel) });
      uzyte.add(najlepszy.x.i);
    }
    return { proba, zajeteProby: uzyte };
  }

  for (let szczebel = 0; szczebel < drabinka.length; szczebel++) {
    const prog = N > 1 ? drabinka[szczebel] * (360 / N) : 0;
    const { proba, zajeteProby } = zbierzUkladem(prog);
    // Zapamiętujemy najlepszą próbę: niższy szczebel nigdy nie daje mniej
    // stacji (progi tylko maleją), ale zapis wprost jest odporny na zmianę
    // drabinki na nieposortowaną.
    if (proba.length > wybrane.length) {
      wybrane = proba;
      zajete = zajeteProby;
      katMin = prog;
      szczebelKatowy = szczebel;
    }
    if (wybrane.length >= N) break; // komplet — nie schodzimy niżej bez potrzeby
  }

  // 3) pass wyrównujący: zamiana stacji na lepszą alternatywę
  const alternatywy = ocenieni.filter((x) => !zajete.has(x.i)).slice(0, N * stale.alternatywNaStacje);
  function macierzZ(wybr) {
    return wybr.map((w) => wybr.map((v) => (w === v ? 0 : w.wynik.dystanse[v.k.wezel])));
  }
  let koszt = kosztUkladu(wybrane.map((w) => w.d), macierzZ(wybrane), karaParaM, wybrane.map((w) => w.kat));
  for (let runda = 0; runda < stale.maxRundWyrownania && wybrane.length === N; runda++) {
    let poprawa = false;
    for (let s = 0; s < wybrane.length; s++) {
      for (const alt of alternatywy) {
        if (zajete.has(alt.i)) continue;
        if (!spelniaSeparacje(alt, wybrane, katMin, s)) continue; // ten sam szczebel drabinki, co greedy
        const proba = wybrane.map((w, idx) => (idx === s ? { ...alt, wynik: wynikZWezla(alt.k.wezel) } : w));
        const nowyKoszt = kosztUkladu(proba.map((w) => w.d), macierzZ(proba), karaParaM, proba.map((w) => w.kat));
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
    pierscien: {
      r: Math.round(r),
      pasmo: [Math.round(pasmo[0]), Math.round(pasmo[1])],
      zakres: [Math.round(dolnyM), Math.round(gornyM)],
      start,
    },
    /** Na którym szczeblu drabinki stanął układ (0 = pełny kąt) — do diagnozy i UI. */
    separacje: {
      katMinStopnie: Math.round(katMin * 10) / 10,
      szczebelKatowy,
      ustapiono: szczebelKatowy > 0,
      siecMinM: Math.round(siecMin),
    },
    liczniki: { kandydatow: kandydaci.length, ocenionych: ocenieni.length, dijkstr: pamiecDijkstra.size },
    usterki,
  };
}
