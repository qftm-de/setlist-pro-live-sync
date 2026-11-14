export const appName = "Setlist Pro Live Sync";

export function betriebsmodus(communityUrl: string | undefined): "core" | "hub" {
  return communityUrl ? "hub" : "core";
}
