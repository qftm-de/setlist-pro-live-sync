import { ApiFehler, apiFetch } from "./client";

export interface LaufzeitKonfiguration {
  mode: "core";
  instanceName: string;
  communityUrl: string | null;
}

interface KonfigurationsAntwort {
  mode: string;
  instance_name: string;
  community_url: string | null;
}

export async function ladeKonfiguration(): Promise<LaufzeitKonfiguration> {
  const antwort = await apiFetch<KonfigurationsAntwort>("/api/config/");
  if (antwort?.mode !== "core" || typeof antwort.instance_name !== "string") {
    throw new ApiFehler(0, "invalid_response");
  }
  return {
    mode: "core",
    instanceName: antwort.instance_name,
    communityUrl: antwort.community_url ?? null,
  };
}
