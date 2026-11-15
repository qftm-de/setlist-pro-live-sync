import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { anmerkungTestAdapter } from "../annotations/testhelfer";
import {
  dokumentTestAdapter,
  FakePdfViewer,
  testDokument,
  testVersion,
} from "./testhelfer";
import { DokumentAnsicht } from "./DokumentAnsicht";

describe("DokumentAnsicht", () => {
  it("zeigt eine neu aktivierte Version als Hinweis, ohne die Ansicht zu wechseln", async () => {
    let aufrufe = 0;
    const adapter = dokumentTestAdapter(
      testDokument([testVersion(1), testVersion(2)], 1),
      undefined,
      {
        async lade() {
          aufrufe += 1;
          return testDokument(
            [testVersion(1), testVersion(2)],
            aufrufe === 1 ? 1 : 2,
          );
        },
      },
    );
    const { rerender } = render(
      <DokumentAnsicht
        bandId="a"
        songId={1}
        adapter={adapter}
        anmerkungAdapter={anmerkungTestAdapter()}
        viewer={FakePdfViewer}
      />,
    );
    expect(await screen.findByTestId("pdf-viewer")).toBeInTheDocument();

    rerender(
      <DokumentAnsicht
        bandId="a"
        songId={1}
        adapter={adapter}
        anmerkungAdapter={anmerkungTestAdapter()}
        viewer={FakePdfViewer}
        aktualisierung={1}
      />,
    );

    expect(
      await screen.findByText(
        "Eine neue PDF-Version wurde aktiviert. Die geöffnete Ansicht bleibt.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Version 2 ist aktiv" }),
    ).toBeDisabled();
  });
});
