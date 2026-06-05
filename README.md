# FHB MCCE — Library Management System, Gruppe F (Domain G7)

Test-Suite für die Domäne **Waitlist Promotion, Search & Reports** des
Library Management Systems der FHB-MCCE-Lehrveranstaltung *Test Automation*.

Das System Under Test (SUT) liegt im selben Repository (Verzeichnis `src/`)
und ist nicht Teil unseres Beitrags; wir testen es, ändern es nicht.

## Domänen-Abdeckung

| Bereich | Endpoints |
|---|---|
| Waitlist Promotion | `POST /api/loans/:id/return`, `GET /api/reservations/:id` |
| Search | `GET /api/search/books`, `GET /api/search/members` |
| Reports | `GET /api/reports/members/:id/history`, `…/stats`, `/books/top`, `/loans/overdue` |

Insgesamt **41 Testfälle** (TC-G7-001 bis TC-G7-041) auf vier Ebenen.
Verteilung: 26 Positive, 9 Negative (Fehlerpfade mit erwartetem 4xx),
6 Boundary. Details: siehe Test-Strategy-Document.

## Voraussetzungen

| Werkzeug | Version |
|---|---|
| Node.js | 22 oder neuer |
| npm | mit Node.js mitgeliefert |

Keine Datenbank, kein Docker, kein Python erforderlich.

## Installation

```bash
npm install
npx playwright install --with-deps chromium
```

## SUT starten

```bash
npm run seed     # DB auf bekannten Ausgangszustand zurücksetzen
npm start        # startet den Server auf http://localhost:3000
```

`npm run seed` setzt die SQLite-Datei `library.db` zurück und lädt
Beispiel-Daten. Vor jedem Test-Lauf empfohlen.

## Tests ausführen

### Gesamte Suite

```bash
npm test
```

Führt nacheinander Unit-, API-, Integration- und E2E-Tests aus.
Voraussetzung: SUT läuft auf `http://localhost:3000`.

### Einzelne Test-Ebene

```bash
npm run test:unit          # Vitest, ohne SUT
npm run test:api           # Playwright, tests/api
npm run test:integration   # Playwright, tests/integration
npm run test:e2e           # Playwright, tests/e2e (Chromium headless)
```

### Einzelner Test oder Gruppe

```bash
# Playwright nach Test-Titel filtern (TC-ID oder Stichwort)
npx playwright test -g "TC-G7-007"
npx playwright test -g "FIFO"

# Vitest nach Titel filtern
npx vitest run -t "TC-G7-031"
```

## Test-Ergebnisse einsehen

Was wo sichtbar ist:

### Im GitHub-Browser (kein CLI nötig)

- **Tab „Actions"**: Liste aller Pipeline-Läufe mit grün/rot-Status.
- **Einzelner Run** → Job „Run all test layers": die einzelnen Steps
  (Setup → Seed → Start SUT → unit/api/integration/e2e → Reports). Pro
  Step öffnet ein Klick die vollständigen Live-Logs der Konsole, also
  z.B. die Liste aller 22 API-Tests mit Laufzeit und Pass/Fail.
- **Tab „Checks" am Pull Request**: zeigt den Workflow-Status für den
  PR und linkt direkt zum Run.
- **Im Run-Footer „Artifacts"**: drei ZIP-Pakete zum Herunterladen
  (in der UI nur Download, kein In-Browser-Rendering):
  - `playwright-report` — der vollständige HTML-Bericht aller
    Playwright-Tests (API + Integration + E2E)
  - `junit-results` — JUnit-XML für Playwright und Vitest, für
    maschinelle Weiterverarbeitung
  - `sut-log` — nur vorhanden, falls der Run rot war; enthält die
    Konsolen-Ausgabe des SUT

Der HTML-Report kann von GitHub nicht direkt im Browser angezeigt werden:
ZIP herunterladen, entpacken, `index.html` lokal öffnen.

### Lokal nach `npm test`

| Was | Befehl / Pfad |
|---|---|
| Playwright HTML-Report im Browser öffnen | `npm run test:report` |
| Playwright HTML-Report im Dateisystem | `playwright-report/index.html` |
| JUnit XML (Playwright) | `test-results/junit.xml` |
| JUnit XML (Vitest) | `test-results/vitest-junit.xml` |
| Konsolen-Output aller Tests | Ausgabe direkt von `npm test` im Terminal |

Im Playwright HTML-Report links auf den **Projekt-Filter** klicken
(`api`, `integration`, `e2e-chromium`) und sich auf eine Test-Ebene
einschränken. Tests sind nach TC-ID benannt (`TC-G7-007 …`), sodass
sich Eintrag und Test-Plan-Tabelle eindeutig zuordnen lassen.

### CI-Artefakte per CLI ziehen

Wenn du den HTML-Report aus einem GitHub-Run lokal anschauen willst,
ohne über die Web-UI zu gehen:

```bash
gh run list --limit 5                       # letzte Runs mit IDs
gh run view <run-id>                        # Status + Schritte
gh run view <run-id> --log                  # vollständige Step-Logs
gh run download <run-id> --dir ci-results   # alle Artefakte herunterladen
open ci-results/playwright-report/index.html
```

## Bekannte Limitierungen

- **TC-G7-025** ist mit `test.skip()` markiert. Der Test bräuchte einen
  Test-Helper-Endpoint, um das Fälligkeitsdatum eines Loans rückwirkend zu
  setzen; das SUT bietet keinen solchen Endpoint an. Dokumentiert im
  Test-Strategy-Document, Kapitel 8.3.
- **TC-G7-030** prüft aus demselben Grund nur, dass die Overdue-Liste
  gerendert wird, nicht eine bestimmte Anzahl überfälliger Loans.

## CI/CD

GitHub Actions, definiert in `.github/workflows/test.yml`.
Trigger: Push auf `main`, Pull Request gegen `main`, manuell.

Pipeline-Schritte: Checkout → Node 22 + Playwright-Browser → `npm run seed`
→ SUT im Hintergrund starten → `npm test` (alle vier Ebenen) → HTML- und
JUnit-Reports als Artefakte.

## Repository-Struktur

```
.
├── src/                          # SUT (Vorlage, unverändert)
├── public/                       # SUT-Frontend (Vorlage, unverändert)
├── seed.js                       # SUT-Seed-Skript (Vorlage)
├── helpers/                      # Test-Helper
│   ├── api-helpers.js            # createBook, createLoan, … gegen die API
│   └── promotion.js              # Pure Funktionen für Unit-Tests
├── tests/
│   ├── unit/                     # Vitest (TC-031, 032)
│   ├── api/                      # Playwright, API-Layer (TC-001–022)
│   ├── integration/              # Mehrschritt-Flows (TC-023–027)
│   └── e2e/                      # Browser-E2E (TC-028–030)
├── .github/workflows/test.yml    # CI/CD-Pipeline
├── playwright.config.js
├── vitest.config.js
└── package.json
```

## Gruppe F

Patrick Prohaska, Ronald Ley, Alexander Mihai, Marco Reeh.
