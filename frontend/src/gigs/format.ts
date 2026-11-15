export function formatiereDatum(iso: string): string {
  const [jahr, monat, tag] = iso.split("-");
  if (!jahr || !monat || !tag) {
    return iso;
  }
  return `${tag}.${monat}.${jahr}`;
}

export function formatiereUhrzeit(zeit: string): string {
  return zeit.slice(0, 5);
}
