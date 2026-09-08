/**
 * Wspólne fikstury paczek PYT/1.0-rev2 dla testów (B21 i `duza-paczka`).
 *
 * Realistyczny kształt: treść ~140 znaków, cztery odpowiedzi, wyjaśnienie
 * ~200 znaków, jedno źródło — bo na tych liczbach oparty jest pomiar budżetu
 * odpowiedzi modelu (PROTOKOL §2.1). `odStacji` pozwala zbudować paczkę
 * obejmującą WYCIANEK stacji, czyli dokładnie to, co wraca z jednej partii
 * przy generowaniu częściami (PROTOKOL §2.2) — numery stacji zostają globalne.
 */

export const OKOLICA_PACZKI = { lat: 52.12303, lon: 20.74614, miejsce: 'Podkowa Leśna', promienM: 1000 };
export const TEMATY_PACZKI = ['historia', 'architektura', 'przyroda'];

/** Stacje wokół środka — opisy z nazwą ulicy, żeby heurystyka E14 miała się czego złapać. */
export function stacjePaczki(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    lat: OKOLICA_PACZKI.lat + i * 0.002,
    lon: OKOLICA_PACZKI.lon + i * 0.002,
    opis: `Punkt przy ulicy Modrzewiowej ${i + 1}, przy skrzyżowaniu z Aleją Lipową`,
  }));
}

export function konfigPaczki(graczy, liczbaStacji = 5) {
  return {
    czasGryMin: 110, tryb: 'piesza', wiek: 'dorosli', jezyk: 'polski',
    tematy: TEMATY_PACZKI, liczbaStacji, pytaniaNaStacje: graczy,
    liczbaGraczy: graczy, promienM: 1000,
  };
}

/**
 * Paczka rev2 o globalnych numerach stacji `odStacji … odStacji + ileStacji - 1`.
 * Treści i adresy źródeł są unikalne na pytanie, więc przechodzą E13 i E10.
 */
export function paczkaPyr(ileStacji, naStacje, { odStacji = 1, uwagi = '' } = {}) {
  const pytania = [];
  for (let s = odStacji; s < odStacji + ileStacji; s += 1) {
    for (let p = 1; p <= naStacje; p += 1) {
      pytania.push({
        id: `s${s}p${p}`,
        stacja: s,
        temat: TEMATY_PACZKI[(s + p) % 3],
        tresc: `Który rok określa powstanie obiektu numer ${s} przy ulicy Modrzewiowej w Podkowie Leśnej, według karty ${p} gminnej ewidencji zabytków?`,
        odpowiedzi: [`rok 19${20 + s} albo 19${21 + s}`, `rok 19${30 + p} albo 19${31 + p}`, 'rok 1948 albo 1949', 'rok 1961 albo 1962'],
        poprawna: 17 + s + p + ((s + p) % 4),
        wyjasnienie: `Obiekt numer ${s} wpisano do gminnej ewidencji zabytków w roku 19${20 + s}, a karta ${p} wiąże go z pierwszym planem regulacyjnym miasta-ogrodu, więc data wynika z dokumentu, nie z tradycji ustnej.`,
        zrodla: [{
          url: `https://www.podkowalesna.pl/zabytki/modrzewiowa-${s}-${p}`,
          tytul: 'Gminna ewidencja zabytków — karta obiektu',
          sprawdzono: '2026-09-07',
        }],
      });
    }
  }
  return {
    protokol: 'PYT/1.0-rev2',
    okolica: OKOLICA_PACZKI,
    wiek: 'dorosli',
    tematy: TEMATY_PACZKI,
    jezyk: 'polski',
    utworzono: '2026-09-07 12:00',
    pytania,
    uwagi,
  };
}
