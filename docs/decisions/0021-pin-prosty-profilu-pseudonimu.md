# 0021 — PIN-prosty pseudonimu: przypięcie imienia z rankingu bez kont

- Status: Zaakceptowana
- Data: 2026-09-07

## Kontekst

Wyniki lądują w rankingu pod pseudonimem (ADR 0019 pkt 7), a setup wymaga
ręcznego wpisywania imienia — literówka rozdwaja historię. Pełne konta to za
dużo na grę towarzyską (B17), a most Drive i tak nie ma bezpiecznego miejsca
na sekrety (anonimowa web app, ADR 0016).

## Decyzja

1. Pseudonim można **przypiąć PIN-em**: 4–8 cyfr, plik `RO-profil/1`
   (`profil-<id>.json`: `{ schemat, pseudonim, pin, utworzono }`) w katalogu
   `okolica-profile` na Dysku właściciela.
2. PIN jest **jawnym tekstem** — decyzja właściciela (`pin-prosty`): chroni
   przed cudzą literówką i przypadkową podszywką, NIE przed atakującym
   z dostępem do Dysku. Zakaz używania ważnych haseł jako PIN-u.
3. Akcje mostu: `profil-ustaw` (utwórz albo potwierdź), `profil-sprawdz`
   (tylko potwierdź, bez tworzenia — literówka nie zakłada profilu).
4. Odmowy kodami R19 (nieznany pseudonim) / R20 (zły PIN) w polu `blad`
   (PROTOKOL §9.4); UI setupu pokazuje przycisk „Zapisz jako nowy" po R19.
5. UI: przycisk „To ja" w setupie wpisuje pseudonim w pierwsze wolne imię.
   Pseudonim multi (`multi-pseudonim`) na razie bez weryfikacji.

## Konsekwencje

- Plus: jedno kliknięcie zamiast przepisywania; spójna historia w rankingu.
- Minus: jawny PIN czyta każdy z dostępem do Dysku — ryzyko zaakceptowane
  (niski próg szkody: cudze imię w rankingu gry towarzyskiej).
- Most wymaga ponownego wdrożenia (nowe akcje + katalog).

## Powiązania

- ADR 0019 (gra wieloosobowa, pseudonim w rankingu), ADR 0016 (most Drive),
  PROTOKOL §9.3–§9.4 (`RO-profil/1`, kody R19–R20).
