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

Insgesamt **32 Testfälle** (TC-G7-001 bis TC-G7-032) auf vier Ebenen.
Details: siehe Test-Strategy-Document.

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

## Test-Reports lesen

| Report | Pfad / Befehl |
|---|---|
| Playwright HTML-Report | `npm run test:report` (öffnet im Browser) |
| Playwright Raw-Output | `playwright-report/` |
| JUnit XML (Playwright) | `test-results/junit.xml` |
| JUnit XML (Vitest) | `test-results/vitest-junit.xml` |

In der CI werden HTML- und JUnit-Reports als Artefakte des Pipeline-Laufs
veröffentlicht und können dort heruntergeladen werden.

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
