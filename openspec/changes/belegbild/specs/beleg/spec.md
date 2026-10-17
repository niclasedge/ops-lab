# beleg

## ADDED Requirements

### Requirement: Kurve aus einer Funktion rendern

Das System SHALL aus einem Modulpfad und einem Funktionsnamen eine Kurve rendern.
Es SHALL die Funktion an gleichverteilten Stellen zwischen einer unteren und einer
oberen Grenze aufrufen und die endlichen Werte als Linie in ein SVG zeichnen. Nicht
endliche Werte SHALL das System als Luecke behandeln und nicht ueber sie hinweg
verbinden.

#### Scenario: Jeder Punkt der Kurve ist ein Aufruf

- **Given** eine Funktion `quadrat(x)`, die ihr Argument quadriert, und die Grenzen 0 und 4
- **When** die Kurve mit vier Schritten gerendert wird
- **Then** traegt sie fuenf Punkte mit den Werten 0, 1, 4, 9 und 16
- **And** kein Wert im Bild stammt aus einer zweiten Rechnung

#### Scenario: Ein nicht endlicher Wert bleibt eine Luecke

- **Given** eine Funktion `kehrwert(x)`, die fuer x gleich 0 unendlich ergibt
- **When** die Kurve ueber die Stelle x gleich 0 hinweg gerendert wird
- **Then** besteht die Linie aus zwei getrennten Stuecken
- **And** kein Punkt der Linie liegt bei x gleich 0

### Requirement: Feste Argumente stehen vor dem Kurvenwert

Das System SHALL vor dem Kurvenwert beliebig viele feste Argumente an die Funktion
uebergeben, die der Aufrufer als `--argument` nennt. Ohne feste Argumente SHALL der
Kurvenwert das einzige Argument sein.

#### Scenario: Eine Funktion mit zwei Argumenten wird zur Kurve

- **Given** eine Funktion `dauer(investition, rueckfluss)` und das feste Argument 10000
- **When** die Kurve gerendert wird
- **Then** wird die Funktion an jeder Stelle als `dauer(10000, x)` aufgerufen

### Requirement: Einzelfaelle werden frisch gerechnet

Das System SHALL jeden als `--fall` genannten Wert einzeln aufrufen und das Ergebnis
im Bild ausweisen. Wirft ein Fall einen Fehler, SHALL das System den Namen des
Fehlers ausweisen statt den Lauf abzubrechen. Ein Fall, dessen Wert ausserhalb der
Achsen liegt, SHALL nicht gezeichnet werden — die Achse ist die Aussage des Bildes.

#### Scenario: Ein geworfener Fehler wird beim Namen genannt

- **Given** eine Funktion, die fuer negative Eingaben einen RangeError wirft
- **When** ein negativer Fall gerendert wird
- **Then** steht `RangeError` im Bild
- **And** der Befehl endet ohne Fehler

#### Scenario: Ein Fall ausserhalb der Achse wird nicht gezeichnet

- **Given** eine Kurve, deren Werte zwischen 0 und 25 liegen
- **And** ein Fall mit dem Wert 100
- **When** das Bild gerendert wird
- **Then** steht die Zahl 100 nicht im Bild

### Requirement: Die Werteachse kommt aus den Werten

Das System SHALL die Werteachse aus den endlichen Werten der Kurve spannen, sofern
der Aufrufer keine Grenze vorgibt. Eine flache Spanne SHALL das System weiten, statt
eine Achse ohne Ausdehnung zu zeichnen. Eine vorgegebene Grenze SHALL abschneiden,
was darueber liegt.

#### Scenario: Eine flache Spanne wird geweitet

- **Given** eine konstante Funktion, die an jeder Stelle 5 ergibt
- **When** die Kurve gerendert wird
- **Then** umfasst die Werteachse mehr als den einzelnen Wert 5

#### Scenario: Eine vorgegebene Grenze schneidet ab

- **Given** eine Funktion, deren Werte von 0 bis 100 steigen
- **And** die vorgegebene Obergrenze 25
- **When** die Kurve gerendert wird
- **Then** zeigt das Bild keine Marke oberhalb von 25
