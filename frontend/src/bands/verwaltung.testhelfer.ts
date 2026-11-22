import type {
  BandMitglied,
  BandVerwaltungAdapter,
  Einladung,
  EinladungErstellt,
} from "./verwaltung";

const EINLADUNG_BASIS: Einladung = {
  id: 1,
  note: "",
  expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  revoked_at: null,
  uses_count: 0,
  max_uses: null,
  status: "active",
  created_at: new Date().toISOString(),
  last_used_at: null,
  created_by: "Test",
};

export function erstelleVerwaltungTestAdapter(
  vorgaben: Partial<BandVerwaltungAdapter> = {},
): BandVerwaltungAdapter {
  return {
    async aktualisiereBand(bandId, eingabe) {
      return { id: bandId, name: eingabe.name ?? "Band", ...eingabe };
    },
    async ladeMitglieder() {
      return [];
    },
    async aendereMitgliedRolle() {
      return [];
    },
    async entferneMitglied() {},
    async ladeEinladungen() {
      return [];
    },
    async erstelleEinladung(_bandId, eingabe) {
      return {
        ...EINLADUNG_BASIS,
        note: eingabe.note ?? "",
        max_uses: eingabe.max_uses ?? null,
        token: "test-token",
        invite_path: "/einladung/test-token",
      };
    },
    async widerrufeEinladung(_bandId, einladungId) {
      return {
        ...EINLADUNG_BASIS,
        id: einladungId,
        revoked_at: new Date().toISOString(),
        status: "revoked",
      };
    },
    async pruefeEinladung() {
      return {
        band_name: "Testband",
        expires_at: EINLADUNG_BASIS.expires_at,
        authenticated: false,
        already_member: false,
      };
    },
    async akzeptiereEinladung() {
      return { band: { id: 1, name: "Testband" }, joined: true };
    },
    ...vorgaben,
  };
}

export const OWNER_TEST: BandMitglied[] = [
  {
    id: 1,
    user_id: 1,
    username: "owner",
    display_name: "Owner Olaf",
    role: "owner",
    is_self: true,
    can_change_role: false,
    can_remove: false,
  },
  {
    id: 2,
    user_id: 2,
    username: "mitglied",
    display_name: "Mitglied Mia",
    role: "member",
    is_self: false,
    can_change_role: false,
    can_remove: false,
  },
];

export const MITGLIED_TEST: BandMitglied[] = [
  OWNER_TEST[0],
  {
    ...OWNER_TEST[1],
    is_self: true,
    can_remove: true,
  },
];

export const EINLADUNG_TEST: EinladungErstellt = {
  id: 5,
  note: "Probe",
  expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  revoked_at: null,
  uses_count: 0,
  max_uses: null,
  status: "active",
  created_at: new Date().toISOString(),
  last_used_at: null,
  created_by: "Owner Olaf",
  token: "test-token",
  invite_path: "/einladung/test-token",
};
