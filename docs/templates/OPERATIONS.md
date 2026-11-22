# Betrieb & Observability (Vorlage)

Vor dem ersten Produktivgang als `docs/operations.md` im Projekt ausfüllen und pflegen.

## 1. Dienstüberblick

- Dienst / System: `setlist-pro-live-sync`
- Kritikalität & Betriebszeiten:
- Verantwortlich / Bereitschaft / Eskalationsweg:

## 2. SLI, SLO und Fehlerbudget

| Nutzerweg / Endpunkt | SLI (Messgröße) | SLO (Ziel) | Fehlerbudget (Zeitraum) | Maßnahme bei Budgetverbrauch |
|---|---|---|---|---|
| Beispiel: Kern-API | Anteil 2xx/3xx < 300 ms | 99,9 % / 30 Tage | 43 Min. / 30 Tage | Feature-Freeze, Stabilität priorisieren |

## 3. Alarmierung und Telemetrie

- **Symptom-Alarme:** Alarme feuern auf Nutzer-Symptome (Fehlerquote, Latenz, Burn-Rate), nicht auf isolierte Ursachen wie CPU-Spitzen.
- **Strukturierte Logs:** JSON/Key-Value mit Request-/Correlation-ID. Keine Secrets, Tokens oder personenbezogenen Daten loggen.
- **Metriken & Traces:** Wo abrufbar (Dashboard-Link / Service-Name)?

## 4. Auslieferung, Feature Flags und Rollback

- **Pipeline:** Ein Artefakt durch alle Stufen (Build → Staging → Smoke → Canary → Produktion).
- **Feature Flags:** Name, Zweck, Besitzer, geplantes Entfernungsdatum.
- **Rollback:** Dokumentierter, getesteter Rückweg inkl. Datenbank-Migrationsverträglichkeit (Expand/Contract).

## 5. Runbooks (Störungsbilder)

Für jedes wahrscheinliche Ausfallbild: Symptom → Diagnosebefehl → Sofortmaßnahme → Verifikation.

## 6. Blameless Postmortem und Design-Iteration

Bei jedem größeren Vorfall oder SLO-Verstoß anlegen:
- Zusammenfassung & Nutzer-Auswirkung (Dauer, Umfang)
- Zeitstrahl (Erkennung, Eingrenzung, Behebung)
- Systemische Ursachen (keine Schuldzuweisung an Personen)
- **Design-Iteration:** Welche Abstraktionsgrenze, Annahme oder Fehlerbehandlung (Timeout, Retry, Idempotenz, Zustand) hat sich im Betrieb als falsch erwiesen und wird gezielt vereinfacht?
- Konkrete Maßnahmen mit Verantwortlichkeit und Termin

## 7. DORA-Lernmetriken (Anti-Goodhart)

Nur als Lerninstrument für das Team erheben, nie als personen- oder teambezogene Zielquote:
- Throughput: Deployment Frequency, Change Lead Time, Failed Deployment Recovery Time
- Instability: Change Fail Rate, Deployment Rework Rate
