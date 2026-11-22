# Design Doc: <Kurztitel>

- Status: Entwurf | In Review | Akzeptiert | Abgelöst
- Datum: YYYY-MM-DD
- Verantwortlich: <Rolle / Team>
- Bezug: `REQUIREMENTS.md` (`R…`), ADRs (`docs/adr/…`)

## 1. Problem, Appetite und Nicht-Ziele

- **Problem:** Wer hat das Problem, was kostet es heute?
- **Ziel & Erfolgsnachweis:** Woran messen wir, dass es gelöst ist?
- **Appetite & Abbruchkriterium (Circuit Breaker):** Zeitbudget und wann gestoppt statt verlängert wird.
- **Nicht-Ziele:** Was bewusst außerhalb des Scopes bleibt.

## 2. Kontext und Architektur (C4)

- **System Context:** Akteure und Nachbarsysteme.
- **Container / Komponenten:** Betroffene Dienste, Module, Datenspeicher, Verantwortlichkeiten (keine Durchreich-Schichten).
- **Schnittstellen & Datenmodell:** Verträge, einfaches integeres Schema (Constraints/Keys), Rückwärtskompatibilität, Migrationspfad.
- **Fehlerfälle, Zustand & Nebenläufigkeit:** Explizite Entscheidungen für Timeout, Retry, Teilausfall, leere Antwort, doppelter Submit / Idempotenz und Zustandsübergänge.

## 3. Alternativen und Trade-offs

| Option | Vorteile | Nachteile / Risiken | Entscheidung |
|---|---|---|---|
| Option A | … | … | … |
| Option B | … | … | … |

Schwer reversible Entscheidungen als eigenes ADR unter `docs/adr/` festhalten und in `DECISIONS.md` verlinken.

## 4. Qualitätsanforderungen (ISO/IEC 25010:2023)

Nur relevante Merkmale mit messbaren Zielwerten ausfüllen:

- Performance Efficiency (Latenz, Durchsatz, Ressourcen):
- Reliability (Verfügbarkeit, Wiederanlauf):
- Interaction Capability / Barrierefreiheit (WCAG 2.2 AA):
- Maintainability & Flexibility:
- Compatibility & Safety:

## 5. Security und Privacy

- **STRIDE-Kurzcheck** (Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation of Privilege):
- **OWASP ASVS 5.0.0 Prüfniveau:** Stufe 1 | 2 | 3 + relevante Kontrollen.
- **DSGVO:** Zweckbindung/Datenminimierung (Art. 5), Privacy by Design/Default (Art. 25), Löschkonzept (Art. 17), AVV (Art. 28).
- **Lieferkette:** Neue Abhängigkeiten, Lizenzen, SBOM-Auswirkung.

## 6. Teststrategie und Auslieferung

- **Testing Trophy nach Risiko:** Statische Checks, Integrationstests, Unit-Tests für verzweigte Logik, E2E für kritische Wege.
- **Rollout & Betrieb:** Feature Flag (inkl. Ablaufdatum), Canary/Staging, Rollback-Pfad, SLI/SLO-Auswirkung.
