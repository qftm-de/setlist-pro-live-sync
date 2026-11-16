import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { CrdtTextFeld } from "./CrdtTextFeld";
import { stand } from "./crdtTestHelfer";
import { base64AusBytes, type TextStand } from "./texte";

function Host({
  standWert,
  remote,
}: {
  standWert: TextStand | null;
  remote: { update: string; epoch: number } | null;
}) {
  const [wert, setWert] = useState("Alt");
  return (
    <CrdtTextFeld
      label="Name"
      wert={wert}
      stand={standWert}
      aktiv
      senden={async (_update, epoch) => ({
        text: wert,
        epoch,
        revision: 0,
        update: "",
      })}
      onWert={setWert}
      onStand={setWert}
      remote={remote}
      maxLength={120}
    />
  );
}

function eingabe(): HTMLInputElement {
  return screen.getByRole("textbox", { name: /Name/ }) as HTMLInputElement;
}

describe("CrdtTextFeld", () => {
  it("übernimmt ein Remote-Ereignis vor dem ersten Serverstand", () => {
    const fern = new Y.Doc();
    fern.getText("t").insert(0, "Neu");
    const remote = {
      update: base64AusBytes(Y.encodeStateAsUpdate(fern)),
      epoch: 0,
    };
    const { rerender } = render(<Host standWert={null} remote={null} />);
    expect(eingabe().value).toBe("Alt");
    rerender(<Host standWert={null} remote={remote} />);
    expect(eingabe().value).toBe("Neu");
    rerender(<Host standWert={stand("Neu")} remote={remote} />);
    expect(eingabe().value).toBe("Neu");
  });
});
