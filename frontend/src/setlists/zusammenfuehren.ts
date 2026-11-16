import type { Block, Zeile } from "./inhalt";

export interface MergeBasis {
  blockUuids: Set<string>;
  zeileUuids: Set<string>;
}

export function mergeBasis(bloecke: Block[]): MergeBasis {
  const blockUuids = new Set<string>();
  const zeileUuids = new Set<string>();
  for (const block of bloecke) {
    if (block.uuid) {
      blockUuids.add(block.uuid);
    }
    for (const zeile of block.zeilen) {
      if (zeile.uuid) {
        zeileUuids.add(zeile.uuid);
      }
    }
  }
  return { blockUuids, zeileUuids };
}

function zeilenZusammenfuehren(
  server: Zeile[],
  lokal: Zeile[],
  basis: MergeBasis | undefined,
): Zeile[] {
  const nachUuid = new Map(
    lokal.filter((zeile) => zeile.uuid).map((zeile) => [zeile.uuid, zeile]),
  );
  const gemischt: Zeile[] = [];
  for (const zeile of server) {
    const eigene = zeile.uuid ? nachUuid.get(zeile.uuid) : undefined;
    if (!eigene && zeile.uuid && basis?.zeileUuids.has(zeile.uuid)) {
      // Lokal gelöscht. Nicht still zurückholen.
      continue;
    }
    gemischt.push(
      eigene ? { ...zeile, titel: eigene.titel, art: eigene.art } : zeile,
    );
  }
  for (const zeile of lokal) {
    if (!zeile.uuid) {
      gemischt.push(zeile);
      continue;
    }
    if (server.some((eintrag) => eintrag.uuid === zeile.uuid)) {
      continue;
    }
    if (basis?.zeileUuids.has(zeile.uuid)) {
      // Auf dem Server gelöscht.
      continue;
    }
    gemischt.push(zeile);
  }
  return gemischt;
}

/** Serverstand und lokaler Entwurf, vereint über UUIDs. */
export function bloeckeZusammenfuehren(
  server: Block[],
  lokal: Block[],
  basis?: MergeBasis,
): Block[] {
  const lokalNachUuid = new Map(
    lokal.filter((block) => block.uuid).map((block) => [block.uuid, block]),
  );
  const gemischt: Block[] = [];
  for (const block of server) {
    const eigener = block.uuid ? lokalNachUuid.get(block.uuid) : undefined;
    if (!eigener && block.uuid && basis?.blockUuids.has(block.uuid)) {
      continue;
    }
    if (!eigener) {
      gemischt.push(block);
      continue;
    }
    gemischt.push({
      ...block,
      name: eigener.name,
      zeilen: zeilenZusammenfuehren(block.zeilen, eigener.zeilen, basis),
    });
  }
  for (const eigener of lokal) {
    if (!eigener.uuid) {
      gemischt.push(eigener);
      continue;
    }
    if (server.some((block) => block.uuid === eigener.uuid)) {
      continue;
    }
    if (basis?.blockUuids.has(eigener.uuid)) {
      continue;
    }
    gemischt.push(eigener);
  }
  return gemischt;
}
