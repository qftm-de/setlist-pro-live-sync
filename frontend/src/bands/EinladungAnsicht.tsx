import { useEffect, useRef, useState } from "react";
import { behandleFehler, istApiFehler } from "../api/client";
import type { BandVerwaltungAdapter, EinladungVorschau } from "./verwaltung";
import { EinladungBestaetigung } from "./EinladungBestaetigung";
import { EinladungFormular } from "./EinladungFormular";
import { StatusAnzeige } from "../ui/StatusAnzeige";
import "./bandVerwaltung.css";

interface Props {
  token: string;
  verwaltung: BandVerwaltungAdapter;
  onBeigetreten: (bandId: string) => void | Promise<void>;
  onSitzungAbgelaufen?: () => void;
}

type Zustand =
  | { status: "laedt" }
  | { status: "fehler"; text: string }
  | { status: "bereit"; vorschau: EinladungVorschau };

const ZEIT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function zeitpunkt(wert: string): string {
  const datum = new Date(wert);
  return Number.isNaN(datum.getTime()) ? wert : ZEIT.format(datum);
}

export function EinladungAnsicht({
  token,
  verwaltung,
  onBeigetreten,
  onSitzungAbgelaufen,
}: Props) {
  const [zustand, setZustand] = useState<Zustand>({ status: "laedt" });
  const [modus, setModus] = useState<"register" | "login">("register");
  const [benutzername, setBenutzername] = useState("");
  const [anzeigename, setAnzeigename] = useState("");
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [passwortWiederholung, setPasswortWiederholung] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [vorschauLauf, setVorschauLauf] = useState(0);
  const [beigetreteneBandId, setBeigetreteneBandId] = useState<string | null>(null);
  const montiertRef = useRef(true);

  useEffect(() => {
    montiertRef.current = true;
    return () => {
      montiertRef.current = false;
    };
  }, []);

  useEffect(() => {
    setBeigetreteneBandId(null);
  }, [token]);

  useEffect(() => {
    let aktiv = true;
    setZustand({ status: "laedt" });
    verwaltung
      .pruefeEinladung(token)
      .then((vorschau) => {
        if (aktiv) {
          setZustand({ status: "bereit", vorschau });
        }
      })
      .catch((ursache: unknown) => {
        if (!aktiv) {
          return;
        }
        if (istApiFehler(ursache) && ursache.code === "not_found") {
          setZustand({
            status: "fehler",
            text: "Dieser Einladungslink ist ungültig oder abgelaufen.",
          });
          return;
        }
        const text = behandleFehler(ursache, onSitzungAbgelaufen);
        setZustand({ status: "fehler", text: text ?? "Beitritt nicht möglich." });
      });
    return () => {
      aktiv = false;
    };
  }, [onSitzungAbgelaufen, token, verwaltung, vorschauLauf]);

  async function oeffneBeigetreteneBand(bandId: string): Promise<void> {
    setFehler(null);
    setLaeuft(true);
    try {
      await onBeigetreten(bandId);
    } catch (ursache) {
      setFehler(
        behandleFehler(ursache, onSitzungAbgelaufen) ??
          "Band konnte nicht geladen werden. Bitte erneut versuchen.",
      );
    } finally {
      setLaeuft(false);
    }
  }

  async function beitreten(authenticated: boolean): Promise<void> {
    setFehler(null);
    if (!authenticated) {
      if (!benutzername.trim() || !passwort) {
        setFehler("Benutzername und Passwort sind Pflicht.");
        return;
      }
      if (modus === "register" && passwort !== passwortWiederholung) {
        setFehler("Die Passwörter stimmen nicht überein.");
        return;
      }
    }
    setLaeuft(true);
    let zielBandId: string;
    try {
      const antwort = await verwaltung.akzeptiereEinladung(
        token,
        authenticated
          ? {}
          : modus === "register"
            ? {
                mode: "register",
                username: benutzername.trim(),
                display_name: anzeigename.trim(),
                email: email.trim(),
                password: passwort,
              }
            : {
                mode: "login",
                username: benutzername.trim(),
                password: passwort,
              },
      );
      zielBandId = String(antwort.band.id);
      if (montiertRef.current) {
        setBeigetreteneBandId(zielBandId);
      }
    } catch (ursache) {
      if (!montiertRef.current) {
        return;
      }
      setLaeuft(false);
      if (istApiFehler(ursache) && ursache.code === "not_found") {
        setZustand({
          status: "fehler",
          text: "Dieser Einladungslink ist ungültig oder abgelaufen.",
        });
        return;
      }
      const anmeldungAbgelaufen =
        authenticated &&
        istApiFehler(ursache) &&
        (ursache.code === "unauthenticated" ||
          (ursache.status === 400 &&
            typeof ursache.daten?.mode === "string"));
      if (anmeldungAbgelaufen) {
        onSitzungAbgelaufen?.();
        setFehler("Deine Anmeldung ist abgelaufen. Bitte erneut anmelden.");
        setZustand({ status: "laedt" });
        setVorschauLauf((wert) => wert + 1);
        return;
      }
      setFehler(
        behandleFehler(ursache, onSitzungAbgelaufen) ??
          "Anmeldung erforderlich. Bitte Seite neu laden.",
      );
      return;
    }
    try {
      await onBeigetreten(zielBandId);
    } catch (ursache) {
      if (montiertRef.current) {
        setFehler(
          behandleFehler(ursache, onSitzungAbgelaufen) ??
            "Band konnte nicht geladen werden. Bitte erneut versuchen.",
        );
      }
    } finally {
      if (montiertRef.current) {
        setLaeuft(false);
      }
    }
  }

  if (beigetreteneBandId !== null) {
    return (
      <EinladungBestaetigung
        laeuft={laeuft}
        fehler={fehler}
        onOeffnen={() => void oeffneBeigetreteneBand(beigetreteneBandId)}
      />
    );
  }

  if (zustand.status === "laedt") {
    return (
      <section className="einladung-ansicht" aria-label="Einladung">
        <StatusAnzeige zustand="laedt" />
      </section>
    );
  }

  if (zustand.status === "fehler") {
    return (
      <section className="einladung-ansicht" aria-labelledby="einladung-titel">
        <h1 id="einladung-titel">Band-Einladung</h1>
        <p role="alert">{zustand.text}</p>
      </section>
    );
  }

  const { vorschau } = zustand;

  return (
    <section className="einladung-ansicht" aria-labelledby="einladung-titel">
      <h1 id="einladung-titel">Einladung zu {vorschau.band_name}</h1>
      <p className="hinweis">Gültig bis {zeitpunkt(vorschau.expires_at)}</p>

      {vorschau.authenticated ? (
        <div className="einladung-beitritt">
          {vorschau.already_member ? (
            <p>Du bist bereits Mitglied dieser Band.</p>
          ) : (
            <p>Du bist angemeldet. Tritt der Band mit einem Klick bei.</p>
          )}
          <button type="button" disabled={laeuft} onClick={() => void beitreten(true)}>
            {vorschau.already_member ? "Band öffnen" : "Band beitreten"}
          </button>
        </div>
      ) : (
        <div className="einladung-beitritt">
          <EinladungFormular
            modus={modus}
            setModus={setModus}
            benutzername={benutzername}
            setBenutzername={setBenutzername}
            anzeigename={anzeigename}
            setAnzeigename={setAnzeigename}
            email={email}
            setEmail={setEmail}
            passwort={passwort}
            setPasswort={setPasswort}
            passwortWiederholung={passwortWiederholung}
            setPasswortWiederholung={setPasswortWiederholung}
            laeuft={laeuft}
            onSubmit={() => void beitreten(false)}
          />
        </div>
      )}

      {fehler ? <p role="alert">{fehler}</p> : null}
    </section>
  );
}
