# Release-Reife und Compliance (Vorlage)

Vor jedem produktiven Release oder Kundengolive prüfen (als `docs/release-checklist.md` pflegen).

## 1. Qualität und Pipeline

- [ ] `node scripts/gate.mjs --voll` ist grün (inkl. aktuellem Review-Stand).
- [ ] Alle betroffenen R-Zeilen in `REQUIREMENTS.md` stehen auf `passing`.
- [ ] Pipeline-Kette (Lint, Typen, Unit/Integration, SAST, Dependency-Check, Build) ist grün; genau ein Artefakt wird befördert.
- [ ] Rollback-Pfad und Smoke-Check auf Staging sind geprüft.

## 2. Kompatibilität, Versionierung und Doku

- [ ] Version folgt SemVer 2.0.0; `CHANGELOG.md` (Keep a Changelog) ist aktualisiert.
- [ ] Rückwärtskompatibilität und Datenmigrationen (Expand/Contract) sind geprüft.
- [ ] Deprecation-Hinweise und Fristen sind dokumentiert (falls Schnittstellen abgelöst werden).
- [ ] Nutzer-, API- und Betriebsdoku (`docs/operations.md`) sind aktuell; Status- und Supportweg sind klar.

## 3. Security und Lieferkette

- [ ] OWASP ASVS 5.0.0 Prüfniveau (Stufe 1 / 2 / 3) für den Änderungsbereich verifiziert.
- [ ] Bei `Risk: hoch`: STRIDE-Threat-Model im Design Doc vorhanden und Maßnahmen umgesetzt.
- [ ] Abhängigkeiten geprüft (keine offenen kritischen CVEs ohne begründete Ausnahme), Lizenzen geprüft, SBOM erzeugt.
- [ ] Build-Härtung / Provenienz gemäß Projekt-SLSA-Zielstufe (SLSA v1.2) eingehalten.

## 4. Datenschutz (DSGVO)

- [ ] Zweckbindung, Datenminimierung und Speicherbegrenzung geprüft (Art. 5 DSGVO).
- [ ] Privacy by Design / Default umgesetzt (Art. 25 DSGVO).
- [ ] Lösch- und Auskunftskonzept betriebsbereit (Art. 17 DSGVO).
- [ ] AVV mit allen Auftragsverarbeitern vor dem ersten Nutzer abgeschlossen (Art. 28 DSGVO).

## 5. Barrierefreiheit (UI / EAA / BFSG)

- [ ] Scope geklärt: B2C-Dienst unter EAA/BFSG (seit 28.06.2025 verbindlich) oder Ausnahme dokumentiert.
- [ ] Bei UI: WCAG 2.2 AA (EN 301 549 v4.1.1) für geänderte Nutzerwege geprüft (Kontrast, Tastatur, Fokus, Fehlermeldungen, Screenreader-Semantik).
- [ ] Barrierefreiheitserklärung aktuell (falls pflichtig).

## 6. Cyber Resilience Act (CRA) und Schwachstellenmeldung

- [ ] Scope geklärt: Produkt mit digitalen Elementen / funktional notwendige RDPS vs. reine Website / Standalone-SaaS (Hinweis: EU-PLD beachten).
- [ ] Prozess und Kontaktweg für Schwachstellenmeldungen (`SECURITY.md` / Meldung aktiv ausgenutzter Schwachstellen, CRA-Pflicht seit 11.09.2026) definiert.
- [ ] Falls CRA-pflichtig: Konformitäts-/CE-Fahrplan bis 11.12.2027 dokumentiert.
