import { useState } from "react";
import { behandleFehler } from "../api/client";
import type { BandMitglied } from "./verwaltung";

interface Props {
  mitglieder: BandMitglied[];
  kannVerwalten: boolean;
  onRolleAendern: (mitgliedId: number, rolle: "owner" | "member") => Promise<void>;
  onEntfernen: (mitgliedId: number) => Promise<void>;
  onSitzungAbgelaufen?: () => void;
}

const ROLLEN: Record<BandMitglied["role"], string> = {
  owner: "Owner",
  member: "Mitglied",
};

export function MitgliederListe({
  mitglieder,
  kannVerwalten,
  onRolleAendern,
  onEntfernen,
  onSitzungAbgelaufen,
}: Props) {
  const [bestaetigung, setBestaetigung] = useState<number | null>(null);
  const [laeuft, setLaeuft] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function rolleAendern(mitglied: BandMitglied) {
    const ziel = mitglied.role === "owner" ? "member" : "owner";
    setLaeuft(mitglied.id);
    setFehler(null);
    try {
      await onRolleAendern(mitglied.id, ziel);
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
    } finally {
      setLaeuft(null);
    }
  }

  async function entfernen(mitglied: BandMitglied) {
    setLaeuft(mitglied.id);
    setFehler(null);
    try {
      await onEntfernen(mitglied.id);
      setBestaetigung(null);
    } catch (ursache) {
      setFehler(behandleFehler(ursache, onSitzungAbgelaufen));
    } finally {
      setLaeuft(null);
    }
  }

  return (
    <section className="band-verwaltung-block" aria-labelledby="mitglieder-titel">
      <h3 id="mitglieder-titel">Mitglieder</h3>
      <ul className="mitglieder-liste">
        {mitglieder.map((mitglied) => {
          const beschaeftigt = laeuft === mitglied.id;
          return (
            <li key={mitglied.id} className="mitglied">
              <div className="mitglied-kopf">
                <strong>{mitglied.display_name}</strong>
                <span className="mitglied-benutzer">@{mitglied.username}</span>
                <span className={`rolle rolle-${mitglied.role}`}>
                  {ROLLEN[mitglied.role]}
                </span>
                {mitglied.is_self ? <span className="du-kennung">Du</span> : null}
              </div>
              {kannVerwalten || mitglied.is_self ? (
                <div className="mitglied-aktionen">
                  {mitglied.can_change_role ? (
                    <button
                      type="button"
                      disabled={beschaeftigt}
                      onClick={() => void rolleAendern(mitglied)}
                    >
                      {mitglied.role === "owner"
                        ? "Zum Mitglied machen"
                        : "Zum Owner machen"}
                    </button>
                  ) : null}
                  {mitglied.can_remove ? (
                    <button
                      type="button"
                      className="gefahr"
                      disabled={beschaeftigt}
                      onClick={() => setBestaetigung(mitglied.id)}
                    >
                      {mitglied.is_self ? "Austreten" : "Entfernen"}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {bestaetigung === mitglied.id ? (
                <div className="bestaetigung" role="alert">
                  <p>
                    {mitglied.is_self
                      ? "Band wirklich verlassen?"
                      : `${mitglied.display_name} wirklich entfernen?`}
                  </p>
                  <button
                    type="button"
                    className="gefahr"
                    disabled={beschaeftigt}
                    onClick={() => void entfernen(mitglied)}
                  >
                    Ja, {mitglied.is_self ? "austreten" : "entfernen"}
                  </button>
                  <button
                    type="button"
                    disabled={beschaeftigt}
                    onClick={() => setBestaetigung(null)}
                  >
                    Abbrechen
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {fehler ? <p role="alert">{fehler}</p> : null}
    </section>
  );
}
