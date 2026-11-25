import { useEffect, useRef, useState } from "react";
import { behandleFehler, istApiFehler } from "../api/client";
import { beitrittApi, type BeitrittAdapter, type BeitrittVorschau } from "./beitritt";
import { EinladungFormular } from "./EinladungFormular";
import { StatusAnzeige } from "../ui/StatusAnzeige";
import "./bandVerwaltung.css";

interface Props {
  token: string;
  onFertig: () => void;
  api?: BeitrittAdapter;
  onSitzungAbgelaufen?: () => void;
}

type Zustand =
  | { status: "laedt" }
  | { status: "fehler"; text: string }
  | { status: "bereit"; vorschau: BeitrittVorschau };

const ZEIT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function zeitpunkt(wert: string): string {
  const datum = new Date(wert);
  return Number.isNaN(datum.getTime()) ? wert : ZEIT.format(datum);
}

/** Öffentliche Seite einer Instanz-Einladung: legt nur ein Konto an. */
export function BeitrittAnsicht({
  token,
  onFertig,
  api = beitrittApi,
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
  const montiertRef = useRef(true);

  useEffect(() => {
    montiertRef.current = true;
    return () => {
      montiertRef.current = false;
    };
  }, []);

  useEffect(() => {
    let aktiv = true;
    setZustand({ status: "laedt" });
    setFehler(null);
    api
      .pruefe(token)
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
  }, [api, onSitzungAbgelaufen, token]);

  async function absenden(): Promise<void> {
    setFehler(null);
    if (!benutzername.trim() || !passwort) {
      setFehler("Benutzername und Passwort sind Pflicht.");
      return;
    }
    if (modus === "register" && passwort !== passwortWiederholung) {
      setFehler("Die Passwörter stimmen nicht überein.");
      return;
    }
    setLaeuft(true);
    try {
      await api.akzeptiere(
        token,
        modus === "register"
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
      if (montiertRef.current) {
        onFertig();
      }
    } catch (ursache) {
      if (!montiertRef.current) {
        return;
      }
      // Der Link kann zwischen Vorschau und Absenden ungültig werden, etwa bei
      // ausgeschöpftem Kontingent. Dann gilt derselbe Hinweis wie bei der
      // Vorschau, nicht der generische Text aus behandleFehler.
      if (istApiFehler(ursache) && ursache.code === "not_found") {
        setFehler("Dieser Einladungslink ist ungültig oder abgelaufen.");
        return;
      }
      setFehler(
        behandleFehler(ursache, onSitzungAbgelaufen) ??
          (modus === "register"
            ? "Konto konnte nicht angelegt werden. Bitte erneut versuchen."
            : "Anmeldung fehlgeschlagen. Bitte erneut versuchen."),
      );
    } finally {
      if (montiertRef.current) {
        setLaeuft(false);
      }
    }
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
      <section className="einladung-ansicht" aria-labelledby="beitritt-titel">
        <h1 id="beitritt-titel">Einladung zum Server</h1>
        <p role="alert">{zustand.text}</p>
      </section>
    );
  }

  const { vorschau } = zustand;

  if (vorschau.authenticated) {
    return (
      <section className="einladung-ansicht" aria-labelledby="beitritt-titel">
        <h1 id="beitritt-titel">Einladung zum Server</h1>
        <p>Du bist bereits angemeldet. Lege jetzt deine Band an.</p>
        <button type="button" onClick={onFertig}>
          Weiter zur Band
        </button>
      </section>
    );
  }

  return (
    <section className="einladung-ansicht" aria-labelledby="beitritt-titel">
      <h1 id="beitritt-titel">Einladung zum Server</h1>
      <p>
        Diese Einladung legt nur ein Konto an. Deine Band legst du danach selbst
        an.
      </p>
      <p>Gültig bis {zeitpunkt(vorschau.expires_at)}.</p>
      {vorschau.note ? <p>{vorschau.note}</p> : null}
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
        onSubmit={() => void absenden()}
        aktion="konto"
      />
      {fehler ? <p role="alert">{fehler}</p> : null}
    </section>
  );
}
