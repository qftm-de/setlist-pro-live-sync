import { AnmerkungLesen } from "./AnmerkungLesen";
import { testAnmerkung } from "./testhelfer";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnmerkungsGriff } from "./AnmerkungsGriff";
import { AnmerkungsFormular } from "./AnmerkungsFormular";

const geometry = {x:.2,y:.3,width:.3,height:.1};
describe("Direkte Positionsbearbeitung", () => {
  it("verschiebt per Tastatur und begrenzt an der Seitenkante", () => {
    const aendern = vi.fn();
    render(<AnmerkungsGriff geometrie={{...geometry,x:.7}} punkt={() => null} onAendern={aendern} />);
    fireEvent.keyDown(screen.getByRole("button",{name:"Anmerkung verschieben"}), {key:"ArrowRight"});
    expect(aendern).toHaveBeenLastCalledWith({...geometry,x:.7});
    fireEvent.keyDown(screen.getByRole("button",{name:"Anmerkung verschieben"}), {key:"ArrowLeft"});
    expect(aendern).toHaveBeenLastCalledWith({...geometry,x:.695});
  });
  it("hält vergrößerte Marker vollständig auf der Seite", () => {
    const aendern = vi.fn();
    render(<AnmerkungsGriff groesse geometrie={{...geometry,width:.8}} punkt={() => null} onAendern={aendern} />);
    fireEvent.keyDown(screen.getByRole("button",{name:"Größe ändern"}), {key:"ArrowRight"});
    expect(aendern).toHaveBeenLastCalledWith({...geometry,width:.8});
  });
  it("vergrößert einen schmalen Randmarker nicht über den Seitenrand", () => {
    const aendern = vi.fn();
    render(<AnmerkungsGriff groesse geometrie={{x:.99,y:.99,width:.01,height:.01}} punkt={() => null} onAendern={aendern} />);
    fireEvent.keyDown(screen.getByRole("button",{name:"Größe ändern"}), {key:"ArrowRight"});
    const g = aendern.mock.calls[0][0];
    expect(g.x + g.width).toBeLessThanOrEqual(1);
    expect(g.y + g.height).toBeLessThanOrEqual(1);
  });
  it("bestätigt auch moderierendes Löschen und zeigt einen fehlgeschlagenen Versuch", async () => {
    const loeschen = vi.fn().mockRejectedValue(new Error("Fehler"));
    render(<AnmerkungLesen anmerkung={testAnmerkung({can_edit:false,can_delete:true})} onLoeschen={loeschen} onSchliessen={vi.fn()} />);
    fireEvent.click(screen.getByRole("button",{name:"Anmerkung löschen"}));
    expect(loeschen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Löschen bestätigen"}));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("button",{name:"Löschen bestätigen"})).toBeEnabled();
  });
  it("speichert eine neue Position erst ausdrücklich und behält eingegebenen Text", async () => {
    const speichern = vi.fn().mockResolvedValue(undefined), dirty = vi.fn();
    const props = {art:"neu" as const, anmerkung:null, seiten:2, start:{page_number:1,color:"gelb" as const,visibility:"private" as const,geometry,text:"",font_size:.0225},onSpeichern:speichern,onAbbrechen:vi.fn(),onDirtyChange:dirty};
    const {rerender} = render(<AnmerkungsFormular {...props} />);
    fireEvent.change(screen.getByLabelText("Text"), {target:{value:"Refrain leiser"}});
    const ziel = {...geometry,x:.4};
    rerender(<AnmerkungsFormular {...props} bewegung={ziel} />);
    expect(speichern).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("x (0–1)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Anmerkung speichern"}));
    expect(speichern).toHaveBeenCalledWith(expect.objectContaining({geometry:ziel,text:"Refrain leiser"}));
  });
});
