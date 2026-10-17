# lagebild

## MODIFIED Requirements

### Requirement: Belege werden lesend ausgeliefert

Die Web-Ansicht SHALL eine nur lesende Route anbieten, die die Datei eines Belegs
ausliefert. Sie SHALL ausschließlich Adressen bedienen, die in der erhobenen Nutzlast
stehen, und jede andere Anfrage mit 404 beantworten — auch eine, die über
Verzeichniswechsel aus dem Repo herausführt. Sie SHALL keinen Schreibzugriff anbieten.

Die Antwort SHALL einen Inhaltstyp nennen, den dieses Programm bestimmt. Für die
Endungen, die das Lagebild selbst erzeugt, SHALL er festliegen; ein Graph in der Form
`.dot` SHALL als Text ausgeliefert werden und nicht als Textverarbeitungsdokument. Wo
keine Regel greift, SHALL Text ausgeliefert werden: ein Beleg ist Bild oder Text.

#### Scenario: Ein bekannter Beleg wird abgerufen

- **Given** ein Beleg, dessen Adresse in der Nutzlast steht
- **When** diese Adresse abgerufen wird
- **Then** kommt der Inhalt der Datei zurück

#### Scenario: Eine Adresse, die aus dem Repo führt

- **Given** eine Adresse, die über `..` auf eine Datei außerhalb der Belegordner zeigt
- **When** sie abgerufen wird
- **Then** antwortet die Ansicht mit 404 und liefert keinen Inhalt

#### Scenario: Ein Graph in der Form `.dot`

- **Given** ein Beleg mit der Endung `.dot`
- **When** sein Inhaltstyp bestimmt wird
- **Then** ist es ein Texttyp und kein Textverarbeitungsdokument

#### Scenario: Ein Bild behält seinen Typ

- **Given** ein Beleg mit der Endung `.png` und einer mit der Endung `.svg`
- **When** ihr Inhaltstyp bestimmt wird
- **Then** ist es `image/png` beziehungsweise `image/svg+xml`

#### Scenario: Eine Endung, zu der es nichts zu wissen gibt

- **Given** ein Beleg ohne Endung oder mit einer, die die Standardbibliothek nicht kennt
- **When** sein Inhaltstyp bestimmt wird
- **Then** ist es ein Texttyp, und die Antwort bleibt ohne Fremdentscheidung
