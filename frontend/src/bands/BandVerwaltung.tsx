import { useEffect, useRef, useState } from "react";
import { behandleFehler, istApiFehler } from "../api/client";
import type { Band, BandEingabe } from "./bands";
import type {
  BandMitglied,
  BandVerwaltungAdapter,
  Einladung,
  EinladungEingabe,
  EinladungErstellt,
} from "./verwaltung";
import { BandEinstellungenFormular } from "./BandEinstellungenFormular";
import { EinladungenBereich } from "./EinladungenBereich";
import { MitgliederListe } from "./MitgliederListe";
import { BandFormular } from "../ui/BandFormular";
import { FehlerAnzeige } from "../ui/FehlerAnzeige";
import { StatusAnzeige } from "../ui/StatusAnzeige";
import "./bandVerwaltung.css";

interface Props {
  band: Band;
  verwaltung: BandVerwaltungAdapter;
  aktualisierung: number;
  onBandGeaendert: () => void | Promise<void>;
  onBandVerlassen: (bandId: string) => void | Promise<void>;
  onBandAnlegen: (name: string) => Promise<void>;
  onSitzungAbgelaufen?: () => void;
}

export function BandVerwaltung({
  band,
  verwaltung,
  aktualisierung,
  onBandGeaendert,
  onBandVerlassen,
  onBandAnlegen,
  onSitzungAbgelaufen,
}: Props) {
  const kannVerwalten = Boolean(band.can_manage || band.role === "owner");
  const [mitglieder, setMitglieder] = useState<BandMitglied[]>([]);
  const [mitgliederGeladen, setMitgliederGeladen] = useState(false);
  const [mitgliederFehler, setMitgliederFehler] = useState<string | null>(null);
  const [einladungen, setEinladungen] = useState<Einladung[]>([]);
  const [einladungenFehler, setEinladungenFehler] = useState<string | null>(null);
  const mitgliederLauf = useRef(0);
  const einladungenLauf = useRef(0);

  useEffect(() => {
    const lauf = ++mitgliederLauf.current;
    setMitgliederFehler(null);
    verwaltung
      .ladeMitglieder(band.id)
      .then((geladene) => {
        if (lauf !== mitgliederLauf.current) {
          return;
        }
        setMitglieder(geladene);
        setMitgliederGeladen(true);
      })
      .catch((ursache: unknown) => {
        if (lauf === mitgliederLauf.current) {
          setMitgliederFehler(behandleFehler(ursache, onSitzungAbgelaufen));
        }
      });
    return () => {
      mitgliederLauf.current += 1;
    };
  }, [band.id, aktualisierung, onSitzungAbgelaufen, verwaltung]);

  useEffect(() => {
    const lauf = ++einladungenLauf.current;
    if (!kannVerwalten) {
      setEinladungen([]);
      setEinladungenFehler(null);
      return;
    }
    setEinladungenFehler(null);
    verwaltung
      .ladeEinladungen(band.id)
      .then((geladene) => {
        if (lauf === einladungenLauf.current) {
          setEinladungen(geladene);
        }
      })
      .catch((ursache: unknown) => {
        if (lauf !== einladungenLauf.current) {
          return;
        }
        if (
          istApiFehler(ursache) &&
          (ursache.code === "forbidden" || ursache.code === "not_found")
        ) {
          setEinladungen([]);
          return;
        }
        setEinladungenFehler(behandleFehler(ursache, onSitzungAbgelaufen));
      });
    return () => {
      einladungenLauf.current += 1;
    };
  }, [band.id, aktualisierung, kannVerwalten, onSitzungAbgelaufen, verwaltung]);

  async function speichern(eingabe: BandEingabe): Promise<Band> {
    const gespeichert = await verwaltung.aktualisiereBand(band.id, eingabe);
    await onBandGeaendert();
    return gespeichert;
  }

  async function rolleAendern(mitgliedId: number, rolle: "owner" | "member") {
    const liste = await verwaltung.aendereMitgliedRolle(band.id, mitgliedId, rolle);
    mitgliederLauf.current += 1;
    setMitglieder(liste);
    await onBandGeaendert();
  }

  async function entfernen(mitgliedId: number) {
    const eigen = mitglieder.some((m) => m.id === mitgliedId && m.is_self);
    await verwaltung.entferneMitglied(band.id, mitgliedId);
    if (eigen) {
      await onBandVerlassen(band.id);
      return;
    }
    const lauf = ++mitgliederLauf.current;
    setMitglieder((vorher) => vorher.filter((eintrag) => eintrag.id !== mitgliedId));
    setMitgliederFehler(null);
    try {
      const frisch = await verwaltung.ladeMitglieder(band.id);
      if (lauf === mitgliederLauf.current) {
        setMitglieder(frisch);
      }
    } catch (ursache: unknown) {
      if (lauf === mitgliederLauf.current) {
        setMitgliederFehler(behandleFehler(ursache, onSitzungAbgelaufen));
      }
    }
  }

  async function einladungErstellen(
    eingabe: EinladungEingabe,
  ): Promise<EinladungErstellt> {
    const neu = await verwaltung.erstelleEinladung(band.id, eingabe);
    einladungenLauf.current += 1;
    setEinladungen((vorher) => [
      neu,
      ...vorher.filter((eintrag) => eintrag.id !== neu.id),
    ]);
    return neu;
  }

  async function einladungWiderrufen(id: number): Promise<Einladung> {
    const ergebnis = await verwaltung.widerrufeEinladung(band.id, id);
    einladungenLauf.current += 1;
    setEinladungen((vorher) =>
      vorher.map((eintrag) => (eintrag.id === ergebnis.id ? ergebnis : eintrag)),
    );
    return ergebnis;
  }

  return (
    <section className="band-verwaltung" aria-labelledby="band-verwaltung-titel">
      <h2 id="band-verwaltung-titel">Band &amp; Mitglieder</h2>
      <p className="band-rolle">
        Deine Rolle: {kannVerwalten ? "Owner" : "Mitglied"}
      </p>

      <BandEinstellungenFormular
        band={band}
        kannBearbeiten={kannVerwalten}
        onSpeichern={speichern}
        onSitzungAbgelaufen={onSitzungAbgelaufen}
      />

      {!mitgliederGeladen && !mitgliederFehler ? (
        <StatusAnzeige zustand="laedt" />
      ) : null}
      {mitgliederFehler ? <FehlerAnzeige text={mitgliederFehler} /> : null}

      {mitgliederGeladen ? (
        <MitgliederListe
          mitglieder={mitglieder}
          kannVerwalten={kannVerwalten}
          onRolleAendern={rolleAendern}
          onEntfernen={entfernen}
          onSitzungAbgelaufen={onSitzungAbgelaufen}
        />
      ) : null}

      {einladungenFehler ? <p role="alert">{einladungenFehler}</p> : null}
      {kannVerwalten ? (
        <EinladungenBereich
          einladungen={einladungen}
          onErstellen={einladungErstellen}
          onWiderrufen={einladungWiderrufen}
          onSitzungAbgelaufen={onSitzungAbgelaufen}
        />
      ) : null}

      <details className="anlegen-menue">
        <summary>Weitere Band anlegen</summary>
        <BandFormular
          onAnlegen={onBandAnlegen}
          onSitzungAbgelaufen={onSitzungAbgelaufen}
        />
      </details>
    </section>
  );
}
