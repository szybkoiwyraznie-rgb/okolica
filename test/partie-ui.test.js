/**
 * B21 (ADR 0031) — UI generowania pytań partiami.
 *
 * Czyste funkcje (`planPartii`, `scalPartie`, `walidujPaczke` z zakresem stacji)
 * pilnuje `test/partie.test.js`; ten plik sprawdza to, czego one nie widzą:
 * że aplikacja DZIELI zlecenie, pokazuje właścicielowi która to część, przyjmuje
 * części po kolei i sama składa je w jedną paczkę, która dopiero startuje grę.
 * Bez tego testu wystarczyłoby zgubić `pokazStanPartii()` albo pomylić indeks
 * `biezaca` i aplikacja pytałaby w kółko o tę samą część.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { zainstalujDom } from './helpers/dom.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BAZA = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'paczka-ok.json'), 'utf8'));
/** Pinezka fixture'a — pytania mówią „grabowicki", więc przechodzą E14. */
const MIEJSCE = { lat: 52.2297, lon: 21.0122 };

function ustawPozycjeTestowa(dom, lat, lon) {
  dom.pobierz('setup-lat').value = lat;
  dom.pobierz('setup-lon').value = lon;
  dom.kliknij('przycisk-ustaw-reczne');
}

/**
 * Paczka na `liczbaStacji × pytaniaNaStacje` pytań o GLOBALNYCH numerach stacji
 * (`odStacji` pozwala zbudować wycinek — odpowiedź jednej partii). Klon pytania
 * z fixture'a, więc kształt pól i kotwiczenie w miejscu są te same, co w
 * `paczka-ok.json` — zmieniają się tylko identyfikatory i treść (E13/E10).
 */
function odpowiedzCzesci(liczbaStacji, pytaniaNaStacje, odStacji, promienM) {
  const wzor = BAZA.pytania[0];
  const pytania = [];
  for (let s = odStacji; s < odStacji + liczbaStacji; s += 1) {
    for (let p = 1; p <= pytaniaNaStacje; p += 1) {
      pytania.push({
        ...structuredClone(wzor),
        id: `s${s}p${p}`,
        stacja: s,
        temat: BAZA.tematy[(s + p) % BAZA.tematy.length],
        tresc: `W którym roku grabowicki rynek, parcela numer ${s} karta ${p}, otrzymał prawa miejskie nadane przez księcia Siemowita?`,
        wyjasnienie: `Parcela ${s} przy grabowickim rynku, karta ${p} gminnej ewidencji zabytków, wiąże nadanie praw miejskich z księciem Siemowitem, co potwierdza wpis w księdze grodzkiej, a nie przekaz ustny mieszkańców.`,
        // E10 odrzuca adresy „przykładowe" — zostajemy przy domenie fixture'a.
        zrodla: [{
          url: `https://pl.wikipedia.org/wiki/Grabowice_parcela_${s}_karta_${p}`,
          tytul: `Karta ${p} gminnej ewidencji — parcela ${s}`,
          sprawdzono: wzor.zrodla[0].sprawdzono,
        }],
      });
    }
  }
  // E16: promień w paczce musi być taki, jaki setup wyliczył z czasu gry.
  return { ...structuredClone(BAZA), okolica: { ...BAZA.okolica, promienM }, pytania, uwagi: '' };
}

/**
 * Rozgrywa ekran 4 → 5 tyle razy, ile jest części, i zwraca DOM po ostatniej.
 * `liczbaStacji × pytaniaNaStacje` musi wymuszać podział (PROTOKOL §2.2).
 */
async function przejdzPartie({ liczbaStacji, pytaniaNaStacje }) {
  const pamiec = new Map();
  pamiec.set('okolica:konfig', JSON.stringify({
    schemat: 'konfig/1',
    konfig: { liczbaGraczy: pytaniaNaStacje, liczbaStacji, pytaniaNaStacje, tematy: BAZA.tematy, czasGryMin: 180 },
  }));
  const dom = zainstalujDom({ search: '?tryb=test', pamiec });
  await import(`../app/app.js?partie=${Math.random().toString(36).slice(2)}`);
  ustawPozycjeTestowa(dom, String(MIEJSCE.lat), String(MIEJSCE.lon));
  dom.pobierz('setup-stacje').value = String(liczbaStacji);
  dom.kliknij('przycisk-dalej-stacje');
  dom.kliknij('przycisk-dalej-prompt'); // pierścień bez fetch jest synchroniczny

  const echy = [];
  let czesc = 1;
  for (;;) {
    assert.equal(dom.pobierz('ekran-prompt').hidden, false, `ekran promptu dla części ${czesc}`);
    echy.push({
      licznik: dom.pobierz('prompt-licznik').textContent,
      partia: dom.pobierz('prompt-partia').textContent,
      ukryta: dom.pobierz('prompt-partia').hidden,
      prompt: dom.pobierz('pole-prompt').value,
    });
    dom.kliknij('przycisk-dalej-paczka');
    assert.equal(dom.pobierz('ekran-paczka').hidden, false, 'ekran wklejenia odpowiedzi');
    // Oba ekrany mówią to samo o części — albo oba milczą, gdy podziału nie ma.
    assert.equal(dom.pobierz('paczka-partia').hidden, echy.at(-1).ukryta,
      'ekran wklejenia pokazuje część wtedy i tylko wtedy, gdy ekran promptu');
    assert.equal(dom.pobierz('paczka-partia').textContent, echy.at(-1).partia, 'ta sama etykieta na obu ekranach');

    // Numer pierwszej stacji tej części — z listy STACJE w promptcie.
    const numery = [...echy.at(-1).prompt.matchAll(/^- stacja (\d+):/gm)].map((m) => Number(m[1]));
    const promienM = Number(echy.at(-1).prompt.match(/- promień gry: (\d+) m/)[1]);
    const paczka = odpowiedzCzesci(numery.length, pytaniaNaStacje, numery[0], promienM);
    dom.pobierz('pole-odpowiedz').value = JSON.stringify(paczka);
    dom.kliknij('przycisk-sprawdz');
    if (dom.pobierz('ekran-gra').hidden === false) break; // ostatnia część złożyła paczkę
    czesc += 1;
    assert.ok(czesc <= 6, 'pętla części się nie zapętliła w nieskończoność');
  }
  return { dom, echy };
}

test('B21 UI: duży setup dzieli się na części, a ostatnia część składa paczkę i startuje grę', async () => {
  // 4 stacje × 5 pytań = 20 pytań (~4 290 tokenów) — ponad budżet jednej partii
  // (18 pytań), więc `stacjiWPartii = 3` i wychodzą dwie części: 1–3 oraz 4.
  const { dom, echy } = await przejdzPartie({ liczbaStacji: 4, pytaniaNaStacje: 5 });

  assert.equal(echy.length, 2, 'dokładnie dwie części, bez powtarzania tej samej');
  assert.equal(echy[0].ukryta, false, 'wskaźnik części widoczny na ekranie promptu');
  assert.match(echy[0].partia, /^Część 1 z 2 — stacje 1–3, 15 pytań/, `etykieta pierwszej części: „${echy[0].partia}"`);
  assert.match(echy[1].partia, /^Część 2 z 2 — stacje 4, 5 pytań · zebrane: 1 z 1/, `etykieta drugiej części: „${echy[1].partia}"`);
  assert.match(echy[0].licznik, /15 pytań · 3 stacji \(część 1\/2\)/, 'licznik mówi o wycinku, nie o całej paczce');
  assert.match(echy[0].prompt, /część 1 z 2 tej samej paczki/, 'prompt mówi modelowi, że to wycinek');
  assert.match(echy[1].prompt, /- stacja 4:/, 'druga część pyta o stację 4');
  assert.ok(!/- stacja 1:/.test(echy[1].prompt), 'druga część nie pyta o stacje z pierwszej');

  // Gra ruszyła dopiero po złożeniu całości — nie po pierwszej części.
  assert.equal(dom.pobierz('ekran-gra').hidden, false, 'gra startuje po ostatniej części');
  assert.match(dom.pobierz('wynik-naglowek').textContent, /złożona z 2 części/, `nagłówek: „${dom.pobierz('wynik-naglowek').textContent}"`);
});

test('B21 UI: mały setup nie udaje podziału — jedna paczka, brak wskaźnika części', async () => {
  const { dom, echy } = await przejdzPartie({ liczbaStacji: 3, pytaniaNaStacje: 1 });
  assert.equal(echy.length, 1, 'trzy pytania mieszczą się w jednym zleceniu');
  assert.equal(echy[0].ukryta, true, 'wskaźnik części schowany, gdy podziału nie ma');
  assert.equal(echy[0].partia, '');
  assert.equal(dom.pobierz('ekran-gra').hidden, false, 'gra startuje od razu');
  assert.equal(dom.pobierz('wynik-naglowek').textContent, 'Paczka przyjęta');
});
