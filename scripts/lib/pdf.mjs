/**
 * Erzeugt harmlose synthetische PDFs zur Laufzeit. Keine echten Unterlagen
 * und keine Angriffspayloads. Seiten unterscheiden sich in Format, CropBox
 * und intrinsischer Drehung, damit der Viewer echte Pfade prüft.
 */

export const SEITEN_ABWEICHEND = [
  { width: 595, height: 842, rotate: 0 },
  { width: 595, height: 842, rotate: 90 },
  { width: 500, height: 700, rotate: 0, crop: [20, 20, 480, 680] },
];

function seitenInhalt(index, fuellung = 0) {
  const links = 20 + index * 10;
  const inhalt = [
    "0 0 0 rg",
    `${links} ${links} 120 80 re f`,
    "0.15 0.35 0.75 rg",
    `${links + 40} ${links + 120} 90 60 re f`,
    "0.9 0.2 0.2 rg",
    `${links + 150} ${links + 40} 40 40 re f`,
  ];
  if (fuellung > 0) {
    inhalt.push(`%${"x".repeat(fuellung)}`);
  }
  return inhalt.join("\n");
}

export function pdfBytes({
  seiten = SEITEN_ABWEICHEND,
  fuellung = 0,
  formular = false,
  anhang = false,
} = {}) {
  const objekte = [];
  const setze = (nummer, inhalt) => {
    objekte[nummer] = inhalt;
  };
  const seitenNummern = [];
  const seitenInfos = [];
  let naechste = 3;

  for (const [index, seite] of seiten.entries()) {
    const seitenNummer = naechste;
    const inhaltNummer = naechste + 1;
    naechste += 2;
    const inhalt = seitenInhalt(index, fuellung);
    setze(
      inhaltNummer,
      `<< /Length ${Buffer.byteLength(inhalt, "ascii")} >>\nstream\n${inhalt}\nendstream`,
    );
    seitenInfos.push({ seite, seitenNummer, inhaltNummer });
    seitenNummern.push(seitenNummer);
  }

  let feldNummer = null;
  let anhangStrom = null;
  let anhangDatei = null;
  if (formular) {
    feldNummer = naechste;
    naechste += 1;
  }
  if (anhang) {
    anhangStrom = naechste;
    anhangDatei = naechste + 1;
    naechste += 2;
  }

  for (const [index, info] of seitenInfos.entries()) {
    const crop = info.seite.crop ? `/CropBox [${info.seite.crop.join(" ")}]` : "";
    const annots =
      formular && index === 0 ? `/Annots [${feldNummer} 0 R]` : "";
    setze(
      info.seitenNummer,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${info.seite.width} ${info.seite.height}] ` +
        `${crop} /Rotate ${info.seite.rotate ?? 0} ${annots} /Contents ${info.inhaltNummer} 0 R >>`,
    );
  }
  setze(
    2,
    `<< /Type /Pages /Kids [${seitenNummern
      .map((nummer) => `${nummer} 0 R`)
      .join(" ")}] /Count ${seitenNummern.length} >>`,
  );

  if (formular) {
    setze(
      feldNummer,
      `<< /Type /Annot /Subtype /Widget /FT /Tx /T (Feld) /Rect [50 50 220 80] ` +
        `/P ${seitenNummern[0]} 0 R /F 4 /DA (/Helv 10 Tf 0 g) >>`,
    );
  }
  if (anhang) {
    const inhalt = "Inhalt des Anhangs, nur Text.";
    setze(
      anhangStrom,
      `<< /Type /EmbeddedFile /Length ${Buffer.byteLength(inhalt, "ascii")} >>\n` +
        `stream\n${inhalt}\nendstream`,
    );
    setze(
      anhangDatei,
      `<< /Type /Filespec /F (Anhang.txt) /UF (Anhang.txt) /EF << /F ${anhangStrom} 0 R >> >>`,
    );
  }
  const acroForm = formular
    ? `/AcroForm << /Fields [${feldNummer} 0 R] /DR << /Font << /Helv << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>`
    : "";
  const namen = anhang
    ? `/Names << /EmbeddedFiles << /Names [(Anhang.txt) ${anhangDatei} 0 R] >> >>`
    : "";
  setze(1, `<< /Type /Catalog /Pages 2 0 R ${acroForm} ${namen} >>`);

  const teile = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  let laenge = teile[0].length;
  const offsets = [0];
  for (let nummer = 1; nummer < objekte.length; nummer += 1) {
    offsets[nummer] = laenge;
    const text = `${nummer} 0 obj\n${objekte[nummer]}\nendobj\n`;
    const puffer = Buffer.from(text, "latin1");
    teile.push(puffer);
    laenge += puffer.length;
  }
  const xrefStart = laenge;
  let xref = `xref\n0 ${objekte.length}\n0000000000 65535 f \n`;
  for (let nummer = 1; nummer < objekte.length; nummer += 1) {
    xref += `${String(offsets[nummer]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objekte.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  teile.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(teile);
}

/** Gültige PDF, auf eine exakte Bytegröße aufgefüllt. */
export function pdfBytesMitGroesse(ziel) {
  const basis = pdfBytes({
    seiten: [{ width: 595, height: 842, rotate: 0 }],
    fuellung: Math.max(0, ziel - 4000),
  });
  if (basis.length >= ziel) {
    return basis;
  }
  const rest = ziel - basis.length;
  if (rest < 3) {
    return basis;
  }
  return Buffer.concat([
    basis,
    Buffer.from("\n%", "ascii"),
    Buffer.alloc(rest - 3, 0x78),
    Buffer.from("\n", "ascii"),
  ]);
}
