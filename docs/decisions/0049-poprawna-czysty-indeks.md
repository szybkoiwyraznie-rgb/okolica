# 0049 — Numer poprawnej odpowiedzi jest czystym indeksem

- Status: Zaakceptowana (decyzja właściciela 2026-09-15)
- Data: 2026-09-15
- Dotyczy: PROTOKOL §2, §2.2, §3.2, §3.4, §7, ADR 0033 pkt 2, `app/protokol.js`

## Kontekst

ADR 0033 zostawił kod pozycyjny `poprawna` (indeks + stacja + numer pytania + 17),
żeby zerknięcie w JSON nie zdradzało dobrej odpowiedzi. Właściciel po kolejnych
generacjach:

> Dla AI za trudne jest to liczenie kodu poprawnej odpowiedzi — usuńmy to
> kodowanie w ogóle. Niech ten numer poprawnej odpowiedzi będzie czystym
> numerem w JSONie. Host musi być uczciwy.

Stare paczki kasuje sam — konwersja nie jest wymagana.

## Decyzja

1. **Bieżące rev4/rev5:** `poprawna` to indeks `0..3` na liście `odpowiedzi`.
   Szablon pokazuje przykład `2` i każe czysty numer, bez wzoru z +17.
2. **Host jest uczciwy:** gra używa tej samej liczby, którą widać w JSON.
3. **Bez migratora.** Właściciel usuwa starą paczkę. Dekoder kodu pozycyjnego
   zostaje wyłącznie dla markerów historycznych rev2/rev3 (testy zapisu).
4. **Łatka szablonu:** `PYT/1.0.9` / `PYT/1.0-nofc.4`. Schemat PYT/1.0 bez
   podbicia — kształt pól ten sam.

## Konsekwencje

- Model nie liczy czterech składników — mniej odrzuconych paczek.
- Gracz zaglądający w wklejkę widzi, która odpowiedź jest dobra. Świadoma
  uczciwość hosta (właściciel). Kontener `TO-paczka/2` nadal maskuje paczkę
  w spoczynku (ADR 0007).
- ADR 0033 pkt 2 („kod zostaje”) zastąpiony tą decyzją; koniec odwracania
  liter z pkt 1 nadal obowiązuje.
