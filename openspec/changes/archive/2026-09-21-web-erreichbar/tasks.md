# Aufgaben — web-erreichbar

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] Test `tests/lagebild-web.test.mjs` erwartet `--web-host`, die Startmeldung beider
      Fälle und den verständlichen Abbruch bei belegtem Port
- [x] `just gate2 web-erreichbar` bestaetigt den roten Lauf

## Umsetzung (gruen)

- [x] `--web-host` im Argumentparser von `ops.py`, Vorgabe `127.0.0.1`, bis in `starte_web`
      durchgereicht
- [x] Reine Funktion `web_meldung(host, port)` bildet die Startzeile samt Netz-Hinweis und
      wird von `--selftest` geprüft
- [x] `port_belegt(host, port)` prüft mit der Standardbibliothek vor dem Import von FastAPI;
      belegter Port endet mit eigenem Exit-Code und Hinweis auf `--web-port`
- [x] `docs/beobachtungen.md` hält fest, dass `8765` auf dieser Maschine dem Dienst
      `git-planner-go` gehört

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig web-erreichbar` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kaestchen "just fertig laeuft durch" muesste man
abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
