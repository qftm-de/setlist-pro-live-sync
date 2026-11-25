interface EinladungFormularProps {
  modus: "register" | "login";
  setModus: (modus: "register" | "login") => void;
  benutzername: string;
  setBenutzername: (wert: string) => void;
  anzeigename: string;
  setAnzeigename: (wert: string) => void;
  email: string;
  setEmail: (wert: string) => void;
  passwort: string;
  setPasswort: (wert: string) => void;
  passwortWiederholung: string;
  setPasswortWiederholung: (wert: string) => void;
  laeuft: boolean;
  onSubmit: () => void;
  /** "konto" fuer Einladungen ohne Band, sonst "beitreten". */
  aktion?: "beitreten" | "konto";
}

export function EinladungFormular({
  modus,
  setModus,
  benutzername,
  setBenutzername,
  anzeigename,
  setAnzeigename,
  email,
  setEmail,
  passwort,
  setPasswort,
  passwortWiederholung,
  setPasswortWiederholung,
  laeuft,
  onSubmit,
  aktion = "beitreten",
}: EinladungFormularProps) {
  return (
    <>
      <div className="einladung-umschalter" role="group" aria-label="Zugang">
        <button
          type="button"
          aria-pressed={modus === "register"}
          onClick={() => setModus("register")}
        >
          Neues Konto anlegen
        </button>
        <button
          type="button"
          aria-pressed={modus === "login"}
          onClick={() => setModus("login")}
        >
          Mit bestehendem Konto anmelden
        </button>
      </div>
      <form
        onSubmit={(ereignis) => {
          ereignis.preventDefault();
          onSubmit();
        }}
      >
        <label>
          Benutzername
          <input
            name="username"
            value={benutzername}
            required
            maxLength={150}
            autoComplete="username"
            onChange={(e) => setBenutzername(e.target.value)}
          />
        </label>
        {modus === "register" ? (
          <>
            <label>
              Anzeigename
              <input
                name="display_name"
                value={anzeigename}
                maxLength={120}
                onChange={(e) => setAnzeigename(e.target.value)}
              />
            </label>
            <label>
              E-Mail
              <input
                name="email"
                type="email"
                value={email}
                required
                maxLength={254}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          </>
        ) : null}
        <label>
          Passwort
          <input
            name="password"
            type="password"
            value={passwort}
            required
            autoComplete={modus === "register" ? "new-password" : "current-password"}
            onChange={(e) => setPasswort(e.target.value)}
          />
        </label>
        {modus === "register" ? (
          <label>
            Passwort wiederholen
            <input
              name="password_wiederholung"
              type="password"
              value={passwortWiederholung}
              required
              autoComplete="new-password"
              onChange={(e) => setPasswortWiederholung(e.target.value)}
            />
          </label>
        ) : null}
        <button type="submit" disabled={laeuft}>
          {laeuft
            ? aktion === "konto"
              ? "Wird angelegt …"
              : "Beitritt läuft …"
            : modus === "register"
              ? aktion === "konto"
                ? "Konto anlegen"
                : "Konto anlegen und beitreten"
              : aktion === "konto"
                ? "Anmelden"
                : "Anmelden und beitreten"}
        </button>
      </form>
    </>
  );
}
