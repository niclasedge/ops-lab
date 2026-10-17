# Gate 2 — pruefstand-tiefe

- Datum: 2026-09-20T13:30:51.650Z
- Person: niclasedge
- Branch: change/pruefstand-tiefe
- Commit: f74a9516fa513ac9ff43f9025afc162680d27d11
- Arbeitsstand: f74a951+0662fb7b1be5

## Pruefungen

- bestanden — G2-1: Gate 1 ist bestanden (gate1.md liegt vor)
- bestanden — G2-2: die in tasks.md zugesagten Testdateien existieren
- bestanden — G2-3: mindestens eine Testdatei ist neu oder geaendert gegenueber main
- bestanden — G2-4: der Testlauf schlaegt fehl (roter Test vor der Umsetzung)

## Belege

- Testlauf: node --test --test-reporter=tap tests/*.test.mjs — Exit 1, 2 Fehlschlaege
- Geaenderte Testdateien: tests/lagebild-web.test.mjs
