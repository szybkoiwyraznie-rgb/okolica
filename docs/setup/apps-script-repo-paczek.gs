/**
 * MOST DRIVE (paczki + gry wieloosobowe + rankingi): Google Drive + Apps Script
 * (ADR 0016, 0018, 0019; plany M9b i M11/M12).
 *
 * Przepływ (decyzja właściciela 2026-09-11: koniec sesji przeglądu):
 *   1. aplikacja po przyjęciu paczki wysyła plik TO-zestaw/1 (doPost),
 *   2. skrypt waliduje kandydata i zapisuje go OD RAZU w katalogu
 *      zaakceptowanych — bez kolejki przeglądu i bez maili do właściciela,
 *   3. o jakości paczek rozstrzygają łapki graczy (ADR 0028); właściciel
 *      przegląda katalogi na Drive, gdy sam chce, a niechcianą paczkę
 *      wyłącza z obiegu RĘCZNIE: przeciąga plik do katalogu odrzuconych
 *      (znika z indeksu natychmiast),
 *   4. gracze pobierają indeks i paczki WYŁĄCZNIE z katalogu zaakceptowanych
 *      (doGet: akcja=indeks / akcja=paczka).
 *
 * Wdrożenie: docs/setup/most-drive-instrukcja.md (krok po kroku, bez wiedzy
 * programistycznej). Skrypt nie potrzebuje żadnych właściwości — adres
 * wdrożenia jest jedyną zdolnością (ADR 0020).
 *
 * Zero kluczy API w aplikacji (ADR 0001): web app.deployowana jako
 * „każdy może być anonimowy”, URL jest jedyną zdolnością.
 *
 * M11 (ADR 0019): TEN SAM most obsługuje gry wieloosobowe na wielu
 * urządzeniach — doPost: gra-zaloz / gra-dolacz / gra-start / gra-zdarzenie /
 * gra-zakoncz; doGet: gry (lobby) / gra-stan / ranking. Stan gry (RO-gra/1)
 * żyje w katalogach okolica-gry-{otwarte,zakonczone}; zdarzenia NIE zawierają
 * współrzędnych graczy (ADR 0013/0019 pkt 3 — pola lat/lon są kasowane).
 */

const FOLDERY = {
  // „odrzucone” to ręczny kosz właściciela: przeciągnięcie pliku tam
  // wyłącza paczkę z indeksu (decyzja 2026-09-11 — bez sesji przeglądu).
  zaakceptowane: 'okolica-paczki-zaakceptowane',
  odrzucone: 'okolica-paczki-odrzucone',
  gryOtwarte: 'okolica-gry-otwarte',
  gryZakonczone: 'okolica-gry-zakonczone',
  profile: 'okolica-profile',
  oceny: 'okolica-oceny-paczek', // ADR 0028: głosy graczy, osobno od paczek
};
const SCHEMAT_ZESTAWU = 'TO-zestaw/1';
const SCHEMAT_PROFILU = 'RO-profil/1'; // Partia 1 (3): PIN-profil pseudonimu (ADR 0021)
const SCHEMAT_KONTENERA = 'TO-paczka/2';
const SCHEMAT_OCENY = 'RO-oceny/1';  // ADR 0028: plik ocen jednej paczki
const SCHEMAT_OCENA = 'RO-ocena/1';  // ADR 0028: pojedynczy głos (kciuk w górę/dół)

/* ---------------------------------------------------------- infrastruktura */

function folder(nazwa) {
  const it = DriveApp.getFoldersByName(nazwa);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(nazwa);
}

/** Jednorazowo: zakłada katalogi (paczki + gry). Uruchom z edytora po wdrożeniu. */
function setup() {
  Object.values(FOLDERY).forEach(folder);
  // Decyzja właściciela 2026-09-11: żadnych maili ani sesji przeglądu —
  // paczki lądują w zaakceptowanych od razu. Właściwości skryptu z czasów
  // przeglądu (adres e-mail, token, adres serwisu) są zbędne i usunięte.
  return 'katalogi gotowe: ' + Object.values(FOLDERY).join(', ')
    + '. Paczki zapisują się od razu w zaakceptowanych (bez maili).';
}

function json(obiekt) {
  return ContentService.createTextOutput(JSON.stringify(obiekt))
    .setMimeType(ContentService.MimeType.JSON);
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

/* ------------------------------------------------- profile (ADR 0021) */

function idProfilu(pseudonim) {
  const s = String(pseudonim || '').trim().toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż]+/g, '-').replace(/^-+|-+$/g, '');
  return s.slice(0, 40);
}

function czytajProfil(id) {
  const it = folder(FOLDERY.profile).getFilesByName('profil-' + id + '.json');
  if (!it.hasNext()) return null;
  try {
    const p = JSON.parse(it.next().getBlob().getDataAsString('UTF-8'));
    return p && p.schemat === SCHEMAT_PROFILU ? p : null;
  } catch (e) { return null; }
}

function ustawProfil(cialo) {
  const pseudo = String((cialo && cialo.pseudonim) || '').trim().slice(0, 20);
  const pin = String((cialo && cialo.pin) || '');
  const id = idProfilu(pseudo);
  if (!id) return { ok: false, blad: 'R19' };
  if (!/^\d{4,8}$/.test(pin)) return { ok: false, blad: 'R20' };
  const jest = czytajProfil(id);
  if (jest) {
    if (jest.pin !== pin) return { ok: false, blad: 'R20' };
    return { ok: true, nowy: false, pseudonim: jest.pseudonim || pseudo };
  }
  folder(FOLDERY.profile).createFile('profil-' + id + '.json', JSON.stringify({
    schemat: SCHEMAT_PROFILU, pseudonim: pseudo, pin,
    utworzono: new Date().toISOString(),
  }), 'application/json');
  return { ok: true, nowy: true, pseudonim: pseudo };
}

function sprawdzProfil(cialo) {
  const id = idProfilu(cialo && cialo.pseudonim);
  const jest = id ? czytajProfil(id) : null;
  if (!jest) return { ok: false, blad: 'R19' };
  if (jest.pin !== String((cialo && cialo.pin) || '')) return { ok: false, blad: 'R20' };
  return { ok: true, pseudonim: jest.pseudonim || '' };
}

/* ---------------------------- oceny pytań przez graczy (ADR 0028) */

const MAKS_GLOSOW_NA_PACZKE = 5000;
const MAKS_GIER_NA_PACZKE = 500;

/** Id pliku Drive jest z [A-Za-z0-9_-], ale nazwę pliku i tak składamy ostrożnie. */
function nazwaPlikuOcen(paczkaId) {
  return 'oceny-' + String(paczkaId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) + '.json';
}

/** Głosy paczki albo null, gdy paczka nie była jeszcze oceniana. */
function czytajOceny(paczkaId) {
  const it = folder(FOLDERY.oceny).getFilesByName(nazwaPlikuOcen(paczkaId));
  if (!it.hasNext()) return null;
  try {
    const dane = JSON.parse(it.next().getBlob().getDataAsString('UTF-8'));
    if (!dane || dane.schemat !== SCHEMAT_OCENY) return null;
    if (!Array.isArray(dane.glosy)) dane.glosy = [];
    if (!Array.isArray(dane.gry)) dane.gry = [];
    return dane;
  } catch (e) {
    return null; // uszkodzony plik ocen nie może zepsuć indeksu ani głosu
  }
}

function pusteOceny(paczkaId) {
  return { schemat: SCHEMAT_OCENY, paczkaId: String(paczkaId), glosy: [], gry: [] };
}

function zapiszOceny(oceny) {
  const nazwa = nazwaPlikuOcen(oceny.paczkaId);
  const tekst = JSON.stringify(oceny, null, 2);
  const it = folder(FOLDERY.oceny).getFilesByName(nazwa);
  if (it.hasNext()) {
    const plik = it.next();
    plik.setContent(tekst);
    return plik;
  }
  return folder(FOLDERY.oceny).createFile(nazwa, tekst, 'application/json');
}

/** Czy paczka o tym id jest w katalogu zaakceptowanych (głosować można tylko na takie). */
/**
 * Czy paczka jest na Drive i wolno ją oceniać.
 *
 * Właściciel (2026-09-09): „Nie ma paczek, które nie istnieją na Drive. Każda
 * powinna móc być oceniona”. Paczka wygenerowana przez model leci na Drive od
 * razu, ale ląduje w katalogu PRZEGLĄDU — gracz gra nią natychmiast, więc
 * ocenianie tylko paczek już zaakceptowanych odcinało większość rozgrywek.
 * Oceny zbieramy więc dla przeglądu i akceptacji; odrzucone są poza obiegiem.
 */
function paczkaJestWRepo(paczkaId) {
  try {
    const rodzice = DriveApp.getFileById(String(paczkaId)).getParents();
    if (!rodzice.hasNext()) return false;
    const nazwa = rodzice.next().getName();
    return nazwa === FOLDERY.zaakceptowane;
  } catch (e) {
    return false;
  }
}

/**
 * Statystyki do indeksu i do odpowiedzi na głos. Przy dwóch ikonach nie ma
 * głosów neutralnych, więc plus + minus = glosow (ADR 0028 pkt 5).
 */
function podsumowanieOcen(oceny) {
  const glosy = (oceny && oceny.glosy) || [];
  let plus = 0;
  glosy.forEach((g) => { if (Number(g.ocena) === 1) plus += 1; });
  return {
    glosow: glosy.length,
    plus: plus,
    minus: glosy.length - plus,
    uzytaWGrach: ((oceny && oceny.gry) || []).length,
  };
}

/** POST ocena: jeden głos gracza na pytanie. Duplikat nie jest błędem. */
function przyjmijOcene(cialo) {
  return zBlokada(() => {
    if (!cialo || cialo.schemat !== SCHEMAT_OCENA) return { ok: false, blad: 'oczekiwałem głosu ' + SCHEMAT_OCENA };
    const paczkaId = String(cialo.paczkaId || '').trim();
    if (!paczkaId) return { ok: false, blad: 'głos bez paczki — nie wiadomo, co ocenić' };
    if (!paczkaJestWRepo(paczkaId)) return { ok: false, blad: 'nie ma takiej paczki w repozytorium (albo nie jest zaakceptowana)' };
    const pytanieId = String(cialo.pytanieId || '').trim().slice(0, 40);
    if (!pytanieId) return { ok: false, blad: 'głos bez identyfikatora pytania' };
    const ocena = Number(cialo.ocena) === -1 ? -1 : (Number(cialo.ocena) === 1 ? 1 : 0);
    if (!ocena) return { ok: false, blad: 'ocena musi być kciukiem w górę (1) albo w dół (-1)' };
    const gracz = idProfilu(cialo.gracz); // ADR 0028 pkt 2: tożsamość liczy most
    if (!gracz) return { ok: false, blad: 'głos bez tożsamości gracza' };

    const oceny = czytajOceny(paczkaId) || pusteOceny(paczkaId);
    const juzBylo = oceny.glosy.some((g) => g.gracz === gracz && g.pytanieId === pytanieId);
    if (!juzBylo) {
      oceny.glosy.push({
        pytanieId: pytanieId,
        gracz: gracz,
        ocena: ocena,
        gra: String(cialo.gra || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40),
        kiedy: new Date().toISOString(),
      });
      if (oceny.glosy.length > MAKS_GLOSOW_NA_PACZKE) {
        oceny.glosy.splice(0, oceny.glosy.length - MAKS_GLOSOW_NA_PACZKE);
      }
      zapiszOceny(oceny);
    }
    return { ok: true, juzBylo: juzBylo, podsumowanie: podsumowanieOcen(oceny) };
  });
}

/**
 * POST uzycie: gra pobrała paczkę — token gry wchodzi do licznika „użyta w X
 * grach" (ADR 0028 pkt 6). Osobna akcja, żeby pobranie paczki (GET) zostało
 * czystym odczytem.
 */
function przyjmijUzycie(cialo) {
  return zBlokada(() => {
    const paczkaId = String((cialo && cialo.paczkaId) || '').trim();
    if (!paczkaId) return { ok: false, blad: 'brak paczki' };
    if (!paczkaJestWRepo(paczkaId)) return { ok: false, blad: 'nie ma takiej paczki w repozytorium (albo nie jest zaakceptowana)' };
    const token = String((cialo && cialo.gra) || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    if (!token) return { ok: false, blad: 'brak tokena gry' };
    const oceny = czytajOceny(paczkaId) || pusteOceny(paczkaId);
    const juzBylo = oceny.gry.indexOf(token) >= 0;
    if (!juzBylo) {
      oceny.gry.push(token);
      if (oceny.gry.length > MAKS_GIER_NA_PACZKE) oceny.gry.splice(0, oceny.gry.length - MAKS_GIER_NA_PACZKE);
      zapiszOceny(oceny);
    }
    return { ok: true, juzBylo: juzBylo, podsumowanie: podsumowanieOcen(oceny) };
  });
}

/* ------------------------------------------------------------------- API */

function doGet(e) {
  const akcja = (e && e.parameter && e.parameter.akcja) || 'indeks';
  try {
    if (akcja === 'indeks') return json(budujIndeks());
    if (akcja === 'paczka') return json(paczkaPrzezId(e.parameter.id));
    if (akcja === 'gry') return json(listaGier());
    if (akcja === 'gra-stan') return json(stanGry(e.parameter.kod, e.parameter.id));
    if (akcja === 'ranking') return json(rankingi());
    return json({ blad: 'nieznana akcja' });
  } catch (err) {
    return json({ blad: String((err && err.message) || err) });
  }
}

function doPost(e) {
  try {
    const cialo = JSON.parse(e.postData.contents);
    // M9b: wysyłka zestawu — ciało jest PLIKIEM TO-zestaw/1 (bez pola akcja).
    if (cialo.schemat === SCHEMAT_ZESTAWU) return json(przyjmijKandydata(cialo));
    // M11 (ADR 0019): polecenia i zdarzenia gier wieloosobowych.
    switch (cialo.akcja) {
      case 'gra-zaloz': return json(zalozGre(cialo));
      case 'gra-dolacz': return json(dolaczDoGry(cialo));
      case 'gra-start': return json(startGryMulti(cialo));
      case 'gra-zdarzenie': return json(przyjmijZdarzenie(cialo));
      case 'gra-zakoncz': return json(zakonczGre(cialo));
      case 'gra-hotseat': return json(przyjmijGreHotseat(cialo));
      case 'ocena': return json(przyjmijOcene(cialo));
      case 'uzycie': return json(przyjmijUzycie(cialo));
      case 'profil-ustaw': return json(ustawProfil(cialo));
      case 'profil-sprawdz': return json(sprawdzProfil(cialo));
      default: return json({ ok: false, blad: 'nieznana akcja albo schemat ciała' });
    }
  } catch (err) {
    return json({ ok: false, blad: String((err && err.message) || err) });
  }
}

const ALFABET_GEOHASH = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Koder geohash — przepisany z `geohash()` w `app/geo.js` (B19, ADR 0024 pkt 4).
 * Apps Script nie może importować modułów aplikacji, więc to kopia; zgodność
 * obu implementacji pilnuje `test/most-indeks.test.js`, który wykonuje TEN tekst
 * i porównuje wyniki z `app/geo.js` na siatce współrzędnych.
 */
function geohashPunkt(lat, lon, precyzja) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return '';
  let przedzialLat = [-90, 90];
  let przedzialLon = [-180, 180];
  let wynik = '';
  let bit = 0;
  let znak = 0;
  let nawet = true; // nawet = dzielimy długość, nieparzyste = szerokość
  while (wynik.length < precyzja) {
    if (nawet) {
      const srodek = (przedzialLon[0] + przedzialLon[1]) / 2;
      if (lon >= srodek) { znak = znak * 2 + 1; przedzialLon = [srodek, przedzialLon[1]]; }
      else { znak = znak * 2; przedzialLon = [przedzialLon[0], srodek]; }
    } else {
      const srodek = (przedzialLat[0] + przedzialLat[1]) / 2;
      if (lat >= srodek) { znak = znak * 2 + 1; przedzialLat = [srodek, przedzialLat[1]]; }
      else { znak = znak * 2; przedzialLat = [przedzialLat[0], srodek]; }
    }
    nawet = !nawet;
    bit += 1;
    if (bit === 5) {
      wynik += ALFABET_GEOHASH.charAt(znak);
      bit = 0;
      znak = 0;
    }
  }
  return wynik;
}

/**
 * Kotwica dopasowania okolicy wpisu indeksu (B19).
 *
 * Nowe pliki niosą `meta.geohash6` obliczony z pozycji startowej — to kotwica
 * dokładna. Pliki opublikowane przed ADR 0024 mają tylko `geohash5`
 * (≈3,0 × 4,9 km), więc paczka zakotwiczona 3 km dalej też się pokazywała.
 *
 * Dla starych plików liczymy geohash6 ze ŚRODKA CIĘŻKOŚCI stacji (nie z pierwszej
 * stacji: start gry jest w środku obszaru stacji, a pierwsza stacja bywa na jego
 * skraju). Punkt startowy gry jest nieznany, ale każda stacja leży w promieniu
 * `meta.promienM` od niego — dlatego wpis dostaje `geohash6Szacowany: true`,
 * a klient poszerza tolerancję o `promienM`. Efekt: ten sam start dopasuje się
 * zawsze (brak regresji), a nadmiarowe dopasowanie maleje z ~4 km do ~promienM.
 */
function kotwicaZestawu(zestaw) {
  const meta = zestaw.meta || {};
  if (typeof meta.geohash6 === 'string' && meta.geohash6.length === 6) {
    return { geohash6: meta.geohash6, szacowany: false };
  }
  const stacje = (zestaw.stacje || []).filter((s) => (
    s && Number.isFinite(s.lat) && Number.isFinite(s.lon)
  ));
  if (!stacje.length) return null;
  let sumaLat = 0;
  let sumaLon = 0;
  for (let i = 0; i < stacje.length; i += 1) {
    sumaLat += stacje[i].lat;
    sumaLon += stacje[i].lon;
  }
  return {
    geohash6: geohashPunkt(sumaLat / stacje.length, sumaLon / stacje.length, 6),
    szacowany: true,
  };
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
      const kotwica = kotwicaZestawu(zestaw);
      wpisy.push(Object.assign({}, zestaw.meta, {
        id: plik.getId(),
        skrot: zestaw.kontener && zestaw.kontener.skrot,
        stacji: zestaw.stacje.length,
        // B19: pliki sprzed ADR 0024 dostają kotwicę geohash6 ze stacji.
        geohash6: kotwica ? kotwica.geohash6 : zestaw.meta.geohash6,
        geohash6Szacowany: kotwica ? kotwica.szacowany : false,
        // ADR 0028: statystyki ocen — ekran 2 pokazuje je przy wyborze paczki.
        oceny: podsumowanieOcen(czytajOceny(plik.getId())),
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
  const wZaakceptowane = rodzice.hasNext() && rodzice.next().getName() === FOLDERY.zaakceptowane;
  if (!wZaakceptowane) return { blad: 'ta paczka nie jest zaakceptowana' };
  return JSON.parse(plik.getBlob().getDataAsString('UTF-8'));
}

/**
 * Przyjmuje zestaw z aplikacji — OD RAZU do katalogu zaakceptowanych.
 * Decyzja właściciela 2026-09-11: koniec sesji przeglądu i maili; o jakości
 * rozstrzygają łapki graczy (ADR 0028), a ręczne odrzucenie to przeciągnięcie
 * pliku do katalogu odrzuconych na Drive (paczka znika z indeksu).
 */
function przyjmijKandydata(plik) {
  const { bledy } = walidujKandydata(plik);
  if (bledy.length) return { ok: false, blad: bledy.join('; ') };
  const skrot = plik.kontener.skrot;
  const nazwa = plik.meta.geohash5 + '-' + skrot + '.zestaw.json';
  const wszedzie = [FOLDERY.zaakceptowane, FOLDERY.odrzucone];
  for (const nazwaFolderu of wszedzie) {
    const it = folder(nazwaFolderu).getFilesByName(nazwa);
    if (it.hasNext()) {
      // `id` wraca także przy duplikacie: telefon, który gra tą paczką, musi
      // znać jej identyfikator, żeby dało się ją ocenić (ADR 0028, aneks 2026-09-09).
      // Duplikat w odrzuconych = wcześniejsza RĘCZNA decyzja właściciela —
      // nowy plik nie powstaje, odrzucenie obowiązuje dalej.
      return { ok: true, status: nazwaFolderu === FOLDERY.zaakceptowane ? 'juz-zaakceptowana' : 'juz-w-odrzuconych', nazwa, id: it.next().getId() };
    }
  }
  const utworzony = folder(FOLDERY.zaakceptowane).createFile(nazwa, JSON.stringify(plik, null, 2), 'application/json');
  return { ok: true, status: 'zaakceptowana', nazwa, id: utworzony.getId() };
}

function przenies(id, nazwaFolderu) {
  const plik = plikPrzezId(id);
  const cel = folder(nazwaFolderu);
  const rodzice = plik.getParents();
  while (rodzice.hasNext()) rodzice.next().removeFile(plik);
  cel.addFile(plik);
}

/* --------------------------------------- gry wieloosobowe (M11, ADR 0019) */

const SCHEMAT_GRY = 'RO-gra/1';
const SCHEMAT_ZDARZENIA = 'RO-zdarzenie/1';
const ALFABET_KODU = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // bez 0/O/1/I (kod czyta się przez telefon)
const DLUGOSC_KODU = 6;
const MAKS_GRACZY = 8;
const WYGASANIE_LOBBY_MS = 24 * 60 * 60 * 1000; // otwarta gra gaśnie po 24 h (plan M11, ryzyko „porzucone lobby")
const TYPY_ZDARZEN = ['start', 'dojscie', 'odpowiedz', 'rezygnacja', 'koniec'];
const POLA_ZAKAZANE_W_ZDARZENIU = ['lat', 'lon', 'szerokosc', 'dlugosc', 'latitude', 'longitude']; // ADR 0013/0019 pkt 3

/** Zapis pod LockService — stany wyścigu dwóch urządzeń (plan M11, ryzyko 2). */
function zBlokada(fn) {
  const blokada = LockService.getScriptLock();
  try {
    blokada.waitLock(20000);
    return fn();
  } catch (err) {
    return { ok: false, blad: 'most jest zajęty — spróbuj ponownie za chwilę (' + ((err && err.message) || err) + ')' };
  } finally {
    try { blokada.releaseLock(); } catch (e2) { /* nie było blokady */ }
  }
}

function nazwaPlikuGry(kod) { return 'gra-' + kod + '.json'; }

/** Kod gry: 6 znaków z alfabetu bez mylących znaków, unikalny w obu katalogach. */
function wolnyKod() {
  for (let proba = 0; proba < 40; proba += 1) {
    let kod = '';
    for (let i = 0; i < DLUGOSC_KODU; i += 1) kod += ALFABET_KODU.charAt(Math.floor(Math.random() * ALFABET_KODU.length));
    const zajety = folder(FOLDERY.gryOtwarte).getFilesByName(nazwaPlikuGry(kod)).hasNext()
      || folder(FOLDERY.gryZakonczone).getFilesByName(nazwaPlikuGry(kod)).hasNext();
    if (!zajety) return kod;
  }
  return null;
}

function znajdzGre(kod, idGry) {
  try {
    if (idGry) {
      const plik = DriveApp.getFileById(idGry);
      return { plik, gra: JSON.parse(plik.getBlob().getDataAsString('UTF-8')) };
    }
    if (kod) {
      const k = String(kod).toUpperCase().replace(/[^A-Z0-9]/g, '');
      let it = folder(FOLDERY.gryOtwarte).getFilesByName(nazwaPlikuGry(k));
      if (!it.hasNext()) it = folder(FOLDERY.gryZakonczone).getFilesByName(nazwaPlikuGry(k));
      if (!it.hasNext()) return null;
      const plik = it.next();
      return { plik, gra: JSON.parse(plik.getBlob().getDataAsString('UTF-8')) };
    }
  } catch (err) {
    return null;
  }
  return null;
}

function zapiszGre(plik, gra) { plik.setContent(JSON.stringify(gra, null, 2)); }

function bledyGryKandydata(dane) {
  const bledy = [];
  if (!dane || (dane.tryb !== 'trasa' && dane.tryb !== 'wyscig')) bledy.push('tryb musi być „trasa” albo „wyscig”');
  const org = dane && dane.organizator;
  const pseudonim = org && typeof org.pseudonim === 'string' ? org.pseudonim.trim() : '';
  if (!pseudonim) bledy.push('pseudonim organizatora jest wymagany');
  else if (pseudonim.length > 24) bledy.push('pseudonim maks. 24 znaki');
  const k = dane && dane.konfiguracja;
  if (!k || !(k.liczbaStacji > 0) || !(k.pytaniaNaStacje > 0) || typeof k.wiek !== 'string'
    || !Array.isArray(k.tematy) || !k.tematy.length || typeof k.miejsce !== 'string'
    || typeof k.geohash5 !== 'string' || k.geohash5.length !== 5) {
    bledy.push('konfiguracja gry niekompletna (liczbaStacji, pytaniaNaStacje, wiek, tematy, miejsce, geohash5)');
  }
  const z = dane && dane.zestaw;
  if (!z || !Array.isArray(z.stacje) || !z.stacje.length || !z.kontener
    || z.kontener.schemat !== SCHEMAT_KONTENERA || !z.meta) {
    bledy.push('zestaw gry wymaga stacji, kontenera ' + SCHEMAT_KONTENERA + ' i metadanych');
  } else if (k && z.stacje.length !== k.liczbaStacji) {
    bledy.push('liczba stacji zestawu nie zgadza się z konfiguracją');
  }
  return bledy;
}

/** POST gra-zaloz: lobby z kodem (organizator + jego zestaw z telefonu). */
function zalozGre(dane) {
  return zBlokada(() => {
    const bledy = bledyGryKandydata(dane);
    if (bledy.length) return { ok: false, blad: bledy.join('; ') };
    const kod = wolnyKod();
    if (!kod) return { ok: false, blad: 'brak wolnych kodów gier — spróbuj później' };
    const teraz = new Date().toISOString();
    const gra = {
      schemat: SCHEMAT_GRY,
      kod,
      idGry: null,
      tryb: dane.tryb,
      stan: 'lobby',
      utworzono: teraz,
      organizatorId: 'g-1',
      gracze: [{ id: 'g-1', pseudonim: String(dane.organizator.pseudonim).trim().slice(0, 24), dolaczyl: teraz }],
      konfiguracja: dane.konfiguracja,
      zestaw: { stacje: dane.zestaw.stacje, kontener: dane.zestaw.kontener, meta: dane.zestaw.meta },
      zdarzenia: [],
      wyniki: {},
    };
    const plik = folder(FOLDERY.gryOtwarte).createFile(nazwaPlikuGry(kod), JSON.stringify(gra, null, 2), 'application/json');
    gra.idGry = plik.getId();
    zapiszGre(plik, gra); // idGry ląduje w stanie (lobby odsyła je graczom)
    return { ok: true, gra };
  });
}

/** Lobby: otwarte gry BEZ kodów i BEZ zestawów — dołączenie kliknięciem przez idGry. */
function archiwizujPrzeterminowane() {
  const pliki = folder(FOLDERY.gryOtwarte).getFiles();
  const terazMs = Date.now();
  while (pliki.hasNext()) {
    const plik = pliki.next();
    try {
      const gra = JSON.parse(plik.getBlob().getDataAsString('UTF-8'));
      if (gra.schemat !== SCHEMAT_GRY) continue;
      const wiekMs = terazMs - new Date(gra.utworzono).getTime();
      if (wiekMs > WYGASANIE_LOBBY_MS && gra.stan !== 'zakonczona') {
        gra.stan = 'archiwum';
        zapiszGre(plik, gra);
        przenies(plik.getId(), FOLDERY.gryZakonczone);
      }
    } catch (err) { /* uszkodzony plik zostaje — nie archiwizujemy na siłę */ }
  }
}

function listaGier() {
  archiwizujPrzeterminowane();
  const wpisy = [];
  const pliki = folder(FOLDERY.gryOtwarte).getFiles();
  while (pliki.hasNext()) {
    const plik = pliki.next();
    try {
      const gra = JSON.parse(plik.getBlob().getDataAsString('UTF-8'));
      if (gra.schemat !== SCHEMAT_GRY || gra.stan === 'zakonczona' || gra.stan === 'archiwum') continue;
      if (gra.gracze.length >= MAKS_GRACZY) continue; // pełna — nie wisi w lobby
      wpisy.push({
        idGry: plik.getId(),
        tryb: gra.tryb,
        stan: gra.stan,
        miejsce: gra.konfiguracja.miejsce,
        geohash5: gra.konfiguracja.geohash5,
        wiek: gra.konfiguracja.wiek,
        tematy: gra.konfiguracja.tematy,
        liczbaGraczy: gra.gracze.length,
        utworzono: gra.utworzono,
        organizator: gra.gracze[0] && gra.gracze[0].pseudonim,
      });
    } catch (err) { /* uszkodzony plik nie psuje lobby */ }
  }
  return { schemat: 'RO-lobby/1', wpisy };
}

/** POST gra-dolacz: kod ALBO idGry (z lobby) + pseudonim; tylko w lobby. */
function dolaczDoGry(dane) {
  return zBlokada(() => {
    const pseudonim = String((dane && dane.pseudonim) || '').trim().slice(0, 24);
    if (!pseudonim) return { ok: false, blad: 'pseudonim jest wymagany' };
    const znaleziona = znajdzGre(dane && dane.kod, dane && dane.idGry);
    if (!znaleziona) return { ok: false, blad: 'nie ma gry o takim kodzie/identyfikatorze' };
    const gra = znaleziona.gra;
    if (gra.stan !== 'lobby') return { ok: false, blad: 'ta gra już wystartowała albo się zakończyła — dołączyć można tylko w lobby' };
    if (gra.gracze.length >= MAKS_GRACZY) return { ok: false, blad: 'gra jest pełna (maks. ' + MAKS_GRACZY + ' graczy)' };
    if (gra.gracze.some((g) => g.pseudonim === pseudonim)) return { ok: false, blad: 'ten pseudonim już gra w tej grze — wybierz inny' };
    const gracz = { id: 'g-' + (gra.gracze.length + 1), pseudonim, dolaczyl: new Date().toISOString() };
    gra.gracze.push(gracz);
    zapiszGre(znaleziona.plik, gra);
    return { ok: true, graczId: gracz.id, gra };
  });
}

/** POST gra-start: organizator rusza grę (lobby → trwa). */
function startGryMulti(dane) {
  return zBlokada(() => {
    const znaleziona = znajdzGre(dane && dane.kod, dane && dane.idGry);
    if (!znaleziona) return { ok: false, blad: 'nie ma takiej gry' };
    const gra = znaleziona.gra;
    if (gra.stan !== 'lobby') return { ok: false, blad: 'gra nie jest już w lobby (stan: ' + gra.stan + ')' };
    if (String(dane && dane.organizatorId) !== gra.organizatorId) return { ok: false, blad: 'tylko organizator może wystartować grę' };
    gra.stan = 'trwa';
    gra.zdarzenia.push({
      kolejnosc: gra.zdarzenia.length + 1, graczId: gra.organizatorId, typ: 'start',
      stacjaId: null, dane: {}, tSerwera: new Date().toISOString(),
    });
    zapiszGre(znaleziona.plik, gra);
    return { ok: true, gra };
  });
}

function czyKompletna(gra) {
  const N = gra.konfiguracja.liczbaStacji;
  const rezygnacje = {};
  gra.zdarzenia.forEach((z) => { if (z.typ === 'rezygnacja') rezygnacje[z.graczId] = true; });
  // Wspólna Trasa i Wyścig domykają się tak samo: KAŻDY gracz zamyka wszystkie
  // stacje (w trasie po kolei, w wyścigu w dowolnej kolejności) albo rezygnuje.
  return gra.gracze.every((g) => {
    if (rezygnacje[g.id]) return true;
    const stacje = {};
    gra.zdarzenia.forEach((z) => { if (z.graczId === g.id && z.typ === 'odpowiedz' && z.stacjaId) stacje[z.stacjaId] = true; });
    return Object.keys(stacje).length >= N;
  });
}

/**
 * Premia za kolejność ukończenia (ADR 0027 część B pkt 5): pierwszy gracz, który
 * zamknął wszystkie stacje, dostaje G−1 punktów, drugi G−2, …, ostatni 0.
 * Kolejność z `kolejnosc` zdarzeń (nadawana w `zBlokada`), NIE z zegara
 * urządzenia. Rezygnujący i niedokończeni premii nie dostają.
 *
 * Reguła jest KOPIĄ `premiaZaKolejnosc` z `app/wieloosobowa.js` — zgodność
 * pilnuje `test/most-gra.test.js`, który wykonuje ten tekst i porównuje wyniki.
 */
function premiaZaKolejnosc(gra) {
  const premia = {};
  const gracze = gra.gracze || [];
  const N = Number(gra.konfiguracja && gra.konfiguracja.liczbaStacji) || 0;
  if (gracze.length < 2 || N < 1) return premia;
  // Hot-seat (jedna gra na jednym telefonie, ADR 0026 aneks): gracze idą razem,
  // więc „kto pierwszy skończył" jest artefaktem kolejności klikania — premii 0.
  if (gra.tryb === 'hotseat') return premia;
  const rezygnacje = {};
  const zamkniete = {};
  const ostatnia = {};
  gra.zdarzenia.forEach((z) => {
    if (z.typ === 'rezygnacja') rezygnacje[z.graczId] = true;
    if (z.typ === 'odpowiedz' && z.stacjaId != null) {
      if (!zamkniete[z.graczId]) zamkniete[z.graczId] = {};
      zamkniete[z.graczId][z.stacjaId] = true;
      ostatnia[z.graczId] = Number(z.kolejnosc) || 0;
    }
  });
  const skonczeni = gracze
    .filter((g) => !rezygnacje[g.id] && zamkniete[g.id] && Object.keys(zamkniete[g.id]).length >= N)
    .map((g) => ({ id: g.id, koniec: ostatnia[g.id] || 0 }))
    .sort((a, b) => a.koniec - b.koniec);
  for (let i = 0; i < skonczeni.length; i += 1) {
    const ile = gracze.length - (i + 1);
    if (ile > 0) premia[skonczeni[i].id] = ile;
  }
  return premia;
}

function przeliczWyniki(gra) {
  const premia = premiaZaKolejnosc(gra);
  // premia wchodzi do punktów dopiero w podsumowaniu (ADR 0027 pkt 5)
  const koniec = gra.stan === 'zakonczona' || gra.stan === 'archiwum';
  const wyniki = {};
  gra.gracze.forEach((g) => {
    wyniki[g.id] = { pseudonim: g.pseudonim, punkty: 0, poprawne: 0, bledne: 0, czasOdcinkowMs: 0, stacjeZamkniete: 0, zrezygnowal: false, premia: 0 };
  });
  gra.zdarzenia.forEach((z) => {
    const w = wyniki[z.graczId];
    if (!w) return;
    if (z.typ === 'dojscie') w.czasOdcinkowMs += Number(z.dane && z.dane.czasOdcinkaMs) || 0;
    if (z.typ === 'odpowiedz') {
      w.stacjeZamkniete += 1;
      w.punkty += Number(z.dane && z.dane.punktyRazem) || 0;
      if (z.dane && z.dane.poprawna) w.poprawne += 1; else w.bledne += 1;
    }
    if (z.typ === 'rezygnacja') w.zrezygnowal = true;
  });
  gra.gracze.forEach((g) => {
    const w = wyniki[g.id];
    w.premia = premia[g.id] || 0;
    if (koniec) w.punkty += w.premia;
  });
  return wyniki;
}

/** POST gra-zdarzenie: walidacja spójności + append (kolejnosc, tSerwera) + auto-koniec. */
function przyjmijZdarzenie(dane) {
  return zBlokada(() => {
    const z = dane && dane.zdarzenie;
    if (!z || z.schemat !== SCHEMAT_ZDARZENIA) return { ok: false, blad: 'oczekiwałem zdarzenia ' + SCHEMAT_ZDARZENIA };
    if (TYPY_ZDARZEN.indexOf(z.typ) < 0) return { ok: false, blad: 'nieznany typ zdarzenia: ' + z.typ };
    const znaleziona = znajdzGre(z.kod, z.idGry);
    if (!znaleziona) return { ok: false, blad: 'nie ma takiej gry' };
    const gra = znaleziona.gra;
    if (gra.stan !== 'trwa') return { ok: false, blad: 'gra się nie toczy (stan: ' + gra.stan + ')' };
    const gracz = gra.gracze.filter((g) => g.id === z.graczId)[0];
    if (!gracz) return { ok: false, blad: 'nie ma takiego gracza w tej grze' };
    const zrezygnowal = gra.zdarzenia.some((e) => e.graczId === z.graczId && e.typ === 'rezygnacja');
    if (zrezygnowal && (z.typ === 'dojscie' || z.typ === 'odpowiedz')) {
      return { ok: false, blad: 'ten gracz zrezygnował — zdarzenia dojścia/odpowiedzi są odrzucane' };
    }
    if (z.typ === 'dojscie' || z.typ === 'odpowiedz') {
      const n = Number(z.stacjaId);
      if (!(n >= 1 && n <= gra.konfiguracja.liczbaStacji)) return { ok: false, blad: 'stacjaId poza zakresem gry (1–' + gra.konfiguracja.liczbaStacji + ')' };
      if (z.typ === 'odpowiedz') {
        const byloDojscie = gra.zdarzenia.some((e) => e.typ === 'dojscie' && e.graczId === z.graczId && Number(e.stacjaId) === n);
        if (!byloDojscie) return { ok: false, blad: 'odpowiedź bez dojścia do tej stacji — niewłaściwa kolejność zdarzeń' };
        const bylaOdpowiedz = gra.zdarzenia.some((e) => e.typ === 'odpowiedz' && e.graczId === z.graczId && Number(e.stacjaId) === n);
        if (bylaOdpowiedz) return { ok: false, blad: 'ta stacja jest już przez Ciebie odpowiedziana' };
      }
    }
    const zdarzenieDane = (z.dane && typeof z.dane === 'object') ? z.dane : {};
    POLA_ZAKAZANE_W_ZDARZENIU.forEach((pole) => { delete zdarzenieDane[pole]; }); // współrzędne NIGDY (ADR 0019 pkt 3)
    const zdarzenie = {
      kolejnosc: gra.zdarzenia.length + 1,
      graczId: z.graczId,
      typ: z.typ,
      stacjaId: z.stacjaId != null ? Number(z.stacjaId) : null,
      dane: zdarzenieDane,
      tSerwera: new Date().toISOString(),
    };
    gra.zdarzenia.push(zdarzenie);
    if (z.typ !== 'rezygnacja' && z.typ !== 'koniec' && czyKompletna(gra)) {
      gra.stan = 'zakonczona'; // stan PRZED wynikami: premia wchodzi do punktów (ADR 0027 pkt 5)
      gra.wyniki = przeliczWyniki(gra);
    }
    zapiszGre(znaleziona.plik, gra);
    if (gra.stan === 'zakonczona') przenies(znaleziona.plik.getId(), FOLDERY.gryZakonczone);
    return { ok: true, kolejnosc: zdarzenie.kolejnosc, stan: gra.stan, wyniki: gra.wyniki };
  });
}

/** POST gra-zakoncz: organizator kończy przedwcześnie (np. wszyscy rezygnują). */
function zakonczGre(dane) {
  return zBlokada(() => {
    const znaleziona = znajdzGre(dane && dane.kod, dane && dane.idGry);
    if (!znaleziona) return { ok: false, blad: 'nie ma takiej gry' };
    const gra = znaleziona.gra;
    if (gra.stan === 'zakonczona' || gra.stan === 'archiwum') return { ok: true, gra };
    if (String(dane && dane.graczId) !== gra.organizatorId) return { ok: false, blad: 'tylko organizator może zakończyć grę przed czasem' };
    gra.stan = 'zakonczona';
    gra.wyniki = przeliczWyniki(gra);
    zapiszGre(znaleziona.plik, gra);
    przenies(znaleziona.plik.getId(), FOLDERY.gryZakonczone);
    return { ok: true, gra };
  });
}

/* ------------- hot-seat: gra z jednego telefonu na Drive (ADR 0026 aneks) --- */

const MAKS_ZDARZEN_HOTSEAT = 400; // 8 graczy × 8 stacji × (dojście + odpowiedź) z zapasem

/**
 * Nazwa pliku gry hot-seat.
 *
 * Z odciskiem (klucz idempotencji z aplikacji) nazwa jest STAŁA dla danej gry —
 * powtórna wysyłka trafia na istniejący plik i most jej nie duplikuje. Bez
 * odcisku (stara wersja aplikacji) zostaje nazwa losowa jak dotąd.
 */
function nazwaPlikuHotseat(odcisk) {
  const o = String(odcisk == null ? '' : odcisk).replace(/[^a-z0-9]/gi, '').slice(0, 16);
  if (o) return 'gra-hotseat-' + o + '.json';
  return 'gra-hotseat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.json';
}

/**
 * Walidacja gry hot-seat — lustro `graHotseatDoWysylki` z `app/wieloosobowa.js`
 * (Apps Script nie może importować modułów, więc reguły są po dwóch stronach).
 * Zestawu ani pytań NIE przyjmujemy: paczka zostaje na telefonie, na Drive
 * jedzie wyłącznie wynik (ADR 0013, ADR 0019 pkt 3).
 */
function bledyGryHotseat(dane) {
  const bledy = [];
  if (!dane || dane.tryb !== 'hotseat') bledy.push('tryb musi być „hotseat”');
  const k = dane && dane.konfiguracja;
  if (!k || !(k.liczbaStacji > 0) || !(k.pytaniaNaStacje > 0) || typeof k.wiek !== 'string'
    || !Array.isArray(k.tematy) || !k.tematy.length || typeof k.miejsce !== 'string'
    || typeof k.geohash5 !== 'string' || k.geohash5.length !== 5) {
    bledy.push('konfiguracja gry niekompletna (liczbaStacji, pytaniaNaStacje, wiek, tematy, miejsce, geohash5)');
  }
  const gracze = (dane && dane.gracze) || [];
  if (!Array.isArray(gracze) || gracze.length < 1) bledy.push('gra wymaga co najmniej jednego gracza');
  else if (gracze.length > MAKS_GRACZY) bledy.push('maksymalnie ' + MAKS_GRACZY + ' graczy w jednej grze');
  const pseudonimy = {};
  for (let i = 0; i < (Array.isArray(gracze) ? gracze.length : 0); i += 1) {
    const g = gracze[i];
    const pseudo = g && typeof g.pseudonim === 'string' ? g.pseudonim.trim() : '';
    if (!pseudo) { bledy.push('gracz ' + (i + 1) + ' nie ma pseudonimu'); continue; }
    if (pseudo.length > 24) bledy.push('pseudonim maks. 24 znaki');
    const klucz = pseudo.toLowerCase();
    if (pseudonimy[klucz]) bledy.push('pseudonim „' + pseudo + '” jest na liście dwa razy');
    pseudonimy[klucz] = true;
  }
  const zdarzenia = (dane && dane.zdarzenia) || [];
  if (!Array.isArray(zdarzenia) || !zdarzenia.length) bledy.push('gra bez dojść i odpowiedzi nie ma wyniku');
  else if (zdarzenia.length > MAKS_ZDARZEN_HOTSEAT) bledy.push('za dużo zdarzeń (maksymalnie ' + MAKS_ZDARZEN_HOTSEAT + ')');
  return bledy;
}

/**
 * POST gra-hotseat: telefon przysyła SKOŃCZONĄ grę z jednego urządzenia. Most
 * zapisuje ją jako grę zakończoną (RO-gra/1) w katalogu gier zakończonych, więc
 * GET ranking czyta ją bez zmian — rankingi hot-seat i gier na wielu telefonach
 * liczą się razem, bez osobnej ścieżki (ADR 0026 aneks).
 *
 * Punkty liczy most (`przeliczWyniki`), nie telefon: klient przysyła fakty
 * (dojścia i odpowiedzi), więc ranking nie zależy od wersji aplikacji.
 */
function przyjmijGreHotseat(dane) {
  return zBlokada(() => {
    const bledy = bledyGryHotseat(dane);
    if (bledy.length) return { ok: false, blad: bledy.join('; ') };
    const k = dane.konfiguracja;
    const konfiguracja = {
      miejsce: String(k.miejsce).slice(0, 80),
      geohash5: String(k.geohash5),
      wiek: String(k.wiek).slice(0, 24),
      tematy: k.tematy.map(String).slice(0, 12),
      liczbaStacji: Number(k.liczbaStacji),
      pytaniaNaStacje: Number(k.pytaniaNaStacje),
    };
    const teraz = new Date().toISOString();
    const naLiscie = {};
    const gracze = dane.gracze.map((g) => {
      const id = String(g.id != null ? g.id : '').trim().slice(0, 12);
      naLiscie[id] = true;
      return { id: id, pseudonim: String(g.pseudonim).trim().slice(0, 24), dolaczyl: teraz };
    });
    const zdarzenia = [];
    for (let i = 0; i < dane.zdarzenia.length; i += 1) {
      const z = dane.zdarzenia[i] || {};
      if (z.schemat !== SCHEMAT_ZDARZENIA) return { ok: false, blad: 'zdarzenie ' + (i + 1) + ' nie jest ' + SCHEMAT_ZDARZENIA };
      if (z.typ !== 'dojscie' && z.typ !== 'odpowiedz') {
        return { ok: false, blad: 'hot-seat przyjmuje tylko dojścia i odpowiedzi (dostałem „' + z.typ + '”)' };
      }
      const graczId = String(z.graczId != null ? z.graczId : '').trim().slice(0, 12);
      if (!naLiscie[graczId]) return { ok: false, blad: 'zdarzenie ' + (i + 1) + ' dotyczy gracza spoza listy' };
      const stacjaId = Number(z.stacjaId);
      if (!(stacjaId >= 1 && stacjaId <= konfiguracja.liczbaStacji)) {
        return { ok: false, blad: 'stacjaId poza zakresem gry (1–' + konfiguracja.liczbaStacji + ')' };
      }
      const daneZdarzenia = (z.dane && typeof z.dane === 'object') ? z.dane : {};
      POLA_ZAKAZANE_W_ZDARZENIU.forEach((pole) => { delete daneZdarzenia[pole]; }); // współrzędne NIGDY (ADR 0019 pkt 3)
      zdarzenia.push({
        kolejnosc: zdarzenia.length + 1,
        graczId: graczId,
        typ: z.typ,
        stacjaId: stacjaId,
        dane: daneZdarzenia,
        tSerwera: teraz,
      });
    }
    const gra = {
      schemat: SCHEMAT_GRY,
      kod: null,          // hot-seat nie ma lobby — nie ma kodu do podyktowania
      idGry: null,
      tryb: 'hotseat',
      stan: 'zakonczona',
      utworzono: teraz,
      organizatorId: gracze[0].id,
      gracze: gracze,
      konfiguracja: konfiguracja,
      zestaw: null,       // paczka i pytania zostają na telefonie (ADR 0013)
      zdarzenia: zdarzenia,
      wyniki: {},
    };
    gra.wyniki = przeliczWyniki(gra); // premia hot-seat = 0 (gracze idą razem)
    // Idempotencja (zgłoszenie właściciela 2026-09-09): telefon wysyła kolejkę
    // przy KAŻDYM starcie aplikacji, więc ta sama gra potrafi przyjść wiele
    // razy. Plik o nazwie z odciskiem gry nadpisujemy zamiast zakładać drugi —
    // inaczej katalog gier zakończonych puchnie, a ranking liczy grę wielokrotnie.
    const katalog = folder(FOLDERY.gryZakonczone);
    const nazwa = nazwaPlikuHotseat(dane.odcisk);
    const istniejace = katalog.getFilesByName(nazwa);
    const plik = istniejace.hasNext()
      ? istniejace.next()
      : katalog.createFile(nazwa, JSON.stringify(gra, null, 2), 'application/json');
    gra.idGry = plik.getId();
    zapiszGre(plik, gra);
    return { ok: true, idGry: gra.idGry, wyniki: gra.wyniki };
  });
}

/** GET ranking: surowe wiersze z gier zakończonych — agregacje liczy aplikacja (testowalne, czyste). */
function rankingi() {
  const wiersze = [];
  const pliki = folder(FOLDERY.gryZakonczone).getFiles();
  while (pliki.hasNext()) {
    const plik = pliki.next();
    try {
      const gra = JSON.parse(plik.getBlob().getDataAsString('UTF-8'));
      if (gra.schemat !== SCHEMAT_GRY || gra.stan !== 'zakonczona' || !gra.wyniki) continue;
      Object.keys(gra.wyniki).forEach((id) => {
        const w = gra.wyniki[id];
        if (w.zrezygnowal && !(w.stacjeZamkniete > 0)) return; // rezygnacja bez wyniku nie idzie do rankingu
        wiersze.push({
          pseudonim: w.pseudonim,
          punkty: w.punkty,
          poprawne: w.poprawne,
          bledne: w.bledne,
          czasOdcinkowMs: w.czasOdcinkowMs,
          stacjeZamkniete: w.stacjeZamkniete,
          data: gra.utworzono,
          tryb: gra.tryb,
          miejsce: gra.konfiguracja.miejsce,
          geohash5: gra.konfiguracja.geohash5,
          wiek: gra.konfiguracja.wiek,
          tematy: gra.konfiguracja.tematy,
        });
      });
    } catch (err) { /* uszkodzony plik nie psuje rankingu */ }
  }
  return { schemat: 'RO-ranking/1', wiersze };
}

function stanGry(kod, idGry) {
  const znaleziona = znajdzGre(kod, idGry);
  if (!znaleziona) return { ok: false, blad: 'nie ma takiej gry' };
  return { ok: true, gra: znaleziona.gra };
}
