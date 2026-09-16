# 0051 — Status graczy multi w Informacjach i pod wspólnym wynikiem

- Status: Zaakceptowana (2026-09-16, uwaga terenowa właściciela)
- Data: 2026-09-16

W grze multi (nie hotseat!) panel Informacje pokazuje tabelę: Imię, zaliczone
stacje, poprawne, status (Aktywny / Opuścił grę / Zakończył trasę); ten sam
przebieg pod wspólnym wynikiem. `tabelaPrzebieguMulti()`: `zaliczone/N`,
`poprawne/udzielone`, rezygnacja → Opuścił, zaliczone ≥ N → Zakończył. Render
z ostatniego stanu, bez żądań; tylko przy `STAN.multi?.gra`. Hot-seat: `hidden`.
