/**
 * MOST REPOZYTORIUM PACZEK: Google Drive + Apps Script (ADR 0016, plan M9b).
 *
 * Przepływ (decyzje właściciela 2026-09-06):
 *   1. aplikacja po „✓ Sprawdź i przyjmij” wysyła plik TO-zestaw/1 (doPost),
 *   2. skrypt zapisuje go w katalogu „do przeglądu” i mailuje właścicielowi
 *      link do podglądu (token z Properties skryptu),
 *   3. właściciel klika „Zaakceptuj” lub „Odrzuć” na stronie przeglądu,
 *   4. gracze pobierają indeks i paczki WYŁĄCZNIE z katalogu zaakceptowanych
 *      (doGet: akcja=indeks / akcja=paczka).
 *
 * Wdrożenie: docs/setup/most-drive-instrukcja.md (krok po kroku, bez wiedzy
 * programistycznej). Właściwości skryptu (Ustawienia → Właściwości skryptu):
 *   OWNER_EMAIL   — e-mail właściciela (powiadomienia o przeglądzie)
 *   REVIEW_SECRET — dowolny długi ciąg znaków (zdolność linku przeglądu)
 *
 * Zero kluczy API w aplikacji (ADR 0001): web app.deployowana jako
 * „każdy może być anonimowy”, URL jest jedyną zdolnością.
 */

const FOLDERY = {
  przeglad: 'okolica-paczki-do-przegladu',
  zaakceptowane: 'okolica-paczki-zaakceptowane',
  odrzucone: 'okolica-paczki-odrzucone',
};
const SCHEMAT_ZESTAWU = 'TO-zestaw/1';
const SCHEMAT_KONTENERA = 'TO-paczka/2';
const ZNAK_OCZEKUJE = 'oczekuje przeglądu';

/* ---------------------------------------------------------- infrastruktura */

function ustawienia() {
  const p = PropertiesService.getScriptProperties();
  return { email: p.getProperty('OWNER_EMAIL'), sekret: p.getProperty('REVIEW_SECRET') };
}

function folder(nazwa) {
  const it = DriveApp.getFoldersByName(nazwa);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(nazwa);
}

/** Jednorazowo: zakłada trzy katalogi. Uruchom z edytora po wdrożeniu. */
function setup() {
  Object.values(FOLDERY).forEach(folder);
  return 'katalogi gotowe: ' + Object.values(FOLDERY).join(', ');
}

function json(obiekt) {
  return ContentService.createTextOutput(JSON.stringify(obiekt))
    .setMimeType(ContentService.MimeType.JSON);
}

function urlSerwisu() {
  return ScriptApp.getService().getUrl();
}

/* ------------------------------------------- kontener TO-paczka/2 (odczyt) */
/* Ten sam algorytm co app/kodowanie.js: xmur3+mulberry32 → XOR → base64url. */

const ZIARNO_MASKI = 'okolica:maska:b64x1:v2';

function strumienMaski(dlugosc) {
  let h = 1779033703 ^ ZIARNO_MASKI.length;
  for (let i = 0; i < ZIARNO_MASKI.length; i++) {
    h = Math.imul(h ^ ZIARNO_MASKI.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const bajty = new Uint8Array(dlugosc);
  for (let i = 0; i < dlugosc; i++) {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    bajty[i] = ((t ^ (t >>> 14)) >>> 0) % 256;
  }
  return bajty;
}

function zBase64url(tekst) {
  const b64 = String(tekst).replace(/-/g, '+').replace(/_/g, '/');
  const dop = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bajty = Utilities.base64Decode(dop);
  return new Uint8Array(bajty);
}

function skrotFnv1a(bajty) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bajty.length; i++) {
    h ^= bajty[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Kontener → plaintext PYT; rzuca Error przy uszkodzeniu (jak odpakujPaczke). */
function odpakujKontener(kontener) {
  if (!kontener || kontener.schemat !== SCHEMAT_KONTENERA) throw new Error('to nie jest kontener ' + SCHEMAT_KONTENERA);
  const bajty = zBase64url(kontener.dane);
  const maska = strumienMaski(bajty.length);
  const czyste = new Uint8Array(bajty.length);
  for (let i = 0; i < bajty.length; i++) czyste[i] = bajty[i] ^ maska[i];
  const tekst = Utilities.newBlob(czyste).getDataAsString('UTF-8');
  if (skrotFnv1a(czyste) !== kontener.skrot) throw new Error('suma kontrolna się nie zgadza (urwanie lub podmiana)');
  return JSON.parse(tekst);
}

/* ------------------------------------------------------------- walidacja */

function czyMetaOk(meta) {
  return !!meta && typeof meta === 'object'
    && typeof meta.geohash5 === 'string' && meta.geohash5.length === 5
    && Number.isFinite(meta.promienM) && meta.promienM > 0
    && Array.isArray(meta.tematy) && meta.tematy.length > 0
    && typeof meta.wiek === 'string' && meta.wiek.length > 0
    && Number.isInteger(meta.liczbaStacji) && meta.liczbaStacji > 0
    && Number.isInteger(meta.pytaniaNaStacje) && meta.pytaniaNaStacje > 0
    && typeof meta.licencja === 'string' && meta.licencja.length > 0
    && typeof meta.przegladZrodel === 'string' && meta.przegladZrodel.length > 0;
}

function walidujKandydata(plik) {
  const bledy = [];
  if (!plik || typeof plik !== 'object' || plik.schemat !== SCHEMAT_ZESTAWU) bledy.push('schemat musi brzmieć ' + SCHEMAT_ZESTAWU);
  if (!czyMetaOk(plik.meta)) bledy.push('meta niekompletna (geohash5, promienM, tematy, wiek, liczby, licencja, przegladZrodel)');
  if (!Array.isArray(plik.stacje) || plik.stacje.length === 0) bledy.push('brak stacji');
  let paczka = null;
  try {
    paczka = odpakujKontener(plik.kontener);
  } catch (e) {
    bledy.push('kontener: ' + e.message);
  }
  if (paczka) {
    const liczby = {};
    (paczka.pytania || []).forEach((p) => { liczby[p.stacja] = (liczby[p.stacja] || 0) + 1; });
    for (let i = 1; i <= plik.stacje.length; i++) {
      if (!liczby[i]) bledy.push('stacja ' + i + ' nie ma pytań');
    }
  }
  return { bledy, paczka };
}

/* ------------------------------------------------------------------- API */

function doGet(e) {
  const akcja = (e && e.parameter && e.parameter.akcja) || 'indeks';
  try {
    if (akcja === 'indeks') return json(budujIndeks());
    if (akcja === 'paczka') return json(paczkaPrzezId(e.parameter.id));
    if (akcja === 'przeglad') return stronaPrzegladu(e.parameter);
    return json({ blad: 'nieznana akcja' });
  } catch (err) {
    return json({ blad: String((err && err.message) || err) });
  }
}

function doPost(e) {
  try {
    const plik = JSON.parse(e.postData.contents);
    return json(przyjmijKandydata(plik));
  } catch (err) {
    return json({ ok: false, blad: String((err && err.message) || err) });
  }
}

/** Indeks WYŁĄCZNIE z katalogu zaakceptowanych: same meta + id pliku. */
function budujIndeks() {
  const wpisy = [];
  const pliki = folder(FOLDERY.zaakceptowane).getFiles();
  while (pliki.hasNext()) {
    const plik = pliki.next();
    try {
      const zestaw = JSON.parse(plik.getBlob().getDataAsString('UTF-8'));
      if (zestaw.schemat !== SCHEMAT_ZESTAWU || !czyMetaOk(zestaw.meta)) continue;
      wpisy.push(Object.assign({}, zestaw.meta, {
        id: plik.getId(),
        skrot: zestaw.kontener && zestaw.kontener.skrot,
        stacji: zestaw.stacje.length,
      }));
    } catch (e) { /* uszkodzony plik nie psuje indeksu */ }
  }
  wpisy.sort((a, b) => String(a.miejsce + a.data).localeCompare(String(b.miejsce + b.data)));
  return { schemat: 'TO-indeks/1', wpisy };
}

function plikPrzezId(id) {
  return DriveApp.getFileById(id);
}

function paczkaPrzezId(id) {
  const plik = plikPrzezId(id);
  const rodzice = plik.getParents();
  const wZaakceptowanych = rodzice.hasNext() && rodzice.next().getName() === FOLDERY.zaakceptowane;
  if (!wZaakceptowane) return { blad: 'ta paczka nie jest zaakceptowana' };
  return JSON.parse(plik.getBlob().getDataAsString('UTF-8'));
}

/** Przyjmuje zestaw z aplikacji: katalog przeglądu + e-mail z linkiem. */
function przyjmijKandydata(plik) {
  const { bledy } = walidujKandydata(plik);
  if (bledy.length) return { ok: false, blad: bledy.join('; ') };
  const skrot = plik.kontener.skrot;
  const nazwa = plik.meta.geohash5 + '-' + skrot + '.zestaw.json';
  const wszedzie = [FOLDERY.zaakceptowane, FOLDERY.przeglad, FOLDERY.odrzucone];
  for (const nazwaFolderu of wszedzie) {
    const it = folder(nazwaFolderu).getFilesByName(nazwa);
    if (it.hasNext()) {
      return { ok: true, status: nazwaFolderu === FOLDERY.zaakceptowane ? 'juz-zaakceptowana' : 'juz-w-obiegu', nazwa };
    }
  }
  const utworzony = folder(FOLDERY.przeglad).createFile(nazwa, JSON.stringify(plik, null, 2), 'application/json');
  powiadomWlasciciela(utworzony, plik);
  return { ok: true, status: 'przyjeta-do-przegladu', nazwa };
}

function powiadomWlasciciela(plikDrive, zestaw) {
  const { email, sekret } = ustawienia();
  if (!email || !sekret) return; // bez ustawień skrypt milczy, paczka czeka
  const link = urlSerwisu() + '?akcja=przeglad&token=' + encodeURIComponent(sekret) + '&id=' + encodeURIComponent(plikDrive.getId());
  const meta = zestaw.meta;
  const temat = 'Tajemnicza Okolica: paczka pytań do przeglądu (' + meta.miejsce + ')';
  const cialo = 'Nowa paczka pytań czeka na Twój przegląd.\n\n'
    + 'Miejsce: ' + meta.miejsce + ' (geohash ' + meta.geohash5 + ')\n'
    + 'Stacje: ' + meta.liczbaStacji + ' × ' + meta.pytaniaNaStacje + ' pytań, poziom: ' + meta.wiek + '\n'
    + 'Tematy: ' + meta.tematy.join(', ') + '\n'
    + 'Utworzono: ' + meta.data + ' przez ' + meta.autor + '\n\n'
    + 'Podgląd i akceptacja jednym kliknięciem:\n' + link + '\n\n'
    + 'Pamiętaj: sprawdź źródła pytań i miejsca stacji (ADR 0008 pkt 6).';
  MailApp.sendEmail(email, temat, cialo);
}

/* ------------------------------------------------- strona przeglądu (HTML) */

function esc(tekst) {
  return String(tekst == null ? '' : tekst)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function stronaPrzegladu(param) {
  const { sekret } = ustawienia();
  if (!sekret || param.token !== sekret) {
    return HtmlService.createHtmlOutput('<p>Brak ważnego tokena przeglądu.</p>');
  }
  const plik = plikPrzezId(param.id);
  const zestaw = JSON.parse(plik.getBlob().getDataAsString('UTF-8'));
  const paczka = odpakujKontener(zestaw.kontener);
  const meta = zestaw.meta;
  const sekcje = zestaw.stacje.map((stacja, i) => {
    const pytania = (paczka.pytania || []).filter((p) => p.stacja === i + 1);
    const wiersze = pytania.map((p) => {
      const odpowiedzi = p.odpowiedzi.map((o, k) => '<li' + (k === p.poprawna ? ' style="color:#2f6f4f;font-weight:700"' : '') + '>' + esc(o) + (k === p.poprawna ? ' ✓' : '') + '</li>').join('');
      const zrodla = (p.zrodla || []).map((z) => '<a href="' + esc(z.url) + '">' + esc(z.tytul) + '</a>').join(', ');
      return '<h3>' + esc(p.id) + ' (' + esc(p.temat) + ')</h3><p>' + esc(p.tresc) + '</p><ul>' + odpowiedzi + '</ul>'
        + '<p><em>' + esc(p.wyjasnienie) + '</em></p><p>Źródła: ' + zrodla + '</p>';
    }).join('');
    return '<section><h2>Stacja ' + (i + 1) + ': ' + esc(stacja.opis || '') + ' [' + Number(stacja.lat).toFixed(5) + ', ' + Number(stacja.lon).toFixed(5) + ']</h2>' + wiersze + '</section>';
  }).join('');
  const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<style>body{font-family:sans-serif;margin:16px;line-height:1.5}h1{font-size:20px}section{border-top:2px solid #2f6f4f;margin-top:16px;padding-top:8px}button{font-size:18px;padding:14px 22px;margin:8px 8px 8px 0;border-radius:10px;border:1px solid #444}</style>'
    + '<h1>Paczka: ' + esc(meta.miejsce) + '</h1>'
    + '<p>geohash ' + esc(meta.geohash5) + ' · ' + esc(meta.liczbaStacji) + ' stacji × ' + esc(meta.pytaniaNaStacje) + ' pytań · poziom ' + esc(meta.wiek) + ' · tematy: ' + esc(meta.tematy.join(', ')) + '<br>utworzono ' + esc(meta.data) + ' · autor: ' + esc(meta.autor) + ' · licencja ' + esc(meta.licencja) + '</p>'
    + '<p><strong>Uwagi twórcy:</strong> ' + esc(paczka.uwagi || '') + '</p>'
    + sekcje
    + '<div><button onclick="google.script.run.withSuccessHandler(o=>document.body.innerHTML=\'<h1>✔ Zaakceptowano</h1><p>Paczka jest dostępna dla graczy.</p>\').zatwierdz(\'' + esc(param.id) + '\')">✔ Zaakceptuj</button>'
    + '<button onclick="google.script.run.withSuccessHandler(o=>document.body.innerHTML=\'<h1>✘ Odrzucono</h1><p>Paczka trafiła do katalogu odrzuconych.</p>\').odrzuc(\'' + esc(param.id) + '\')">✘ Odrzuć</button></div>';
  return HtmlService.createHtmlOutput(html).setTitle('Przegląd paczki');
}

/** Akcje ze strony przeglądu (google.script.run). */
function zatwierdz(id) {
  przenies(id, FOLDERY.zaakceptowane);
  return 'zaakceptowano';
}

function odrzuc(id) {
  przenies(id, FOLDERY.odrzucone);
  return 'odrzucono';
}

function przenies(id, nazwaFolderu) {
  const plik = plikPrzezId(id);
  const cel = folder(nazwaFolderu);
  const rodzice = plik.getParents();
  while (rodzice.hasNext()) rodzice.next().removeFile(plik);
  cel.addFile(plik);
}
