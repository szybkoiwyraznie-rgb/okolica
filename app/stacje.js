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

import { bearingStopnie, odlegloscM, przesunPunkt } from './geo.js';
import { rngZZiarna } from './konfig.js';

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

/**
 * Miara sprawiedliwości układu (ADR 0005 pkt 5): średnia i odchylenie
 * standardowe odległości stacji od środka. `udzialOdchylenia` ≤ 0.15 to
 * kryterium jakości z ROADMAP M4.
 */
export function miaraSprawiedliwosci(stacje) {
  const d = stacje.map((s) => s.odlegloscM).filter((v) => Number.isFinite(v));
  if (d.length === 0) return { sredniaM: 0, odchylenieM: 0, udzialOdchylenia: 0 };
  const sredniaM = d.reduce((a, b) => a + b, 0) / d.length;
  const wariancja = d.reduce((a, b) => a + (b - sredniaM) ** 2, 0) / d.length;
  const odchylenieM = Math.sqrt(wariancja);
  return {
    sredniaM: Math.round(sredniaM),
    odchylenieM: Math.round(odchylenieM),
    udzialOdchylenia: sredniaM ? odchylenieM / sredniaM : 0,
  };
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
