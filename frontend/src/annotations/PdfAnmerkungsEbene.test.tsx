import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PageViewport } from "pdfjs-dist";
import type { Anmerkung } from "./annotations";
import { PdfAnmerkungsEbene } from "./PdfAnmerkungsEbene";
const viewport = {width:100,height:100,scale:1,convertToPdfPoint:(x:number,y:number)=>[x,y],convertToViewportPoint:(x:number,y:number)=>[x,y]} as PageViewport;
const annotation = {id:1,kind:"text",text:"Refrain",geometry:{x:.2,y:.2,width:.3,height:.1},color:"gelb",can_edit:true} as Anmerkung;
afterEach(() => vi.useRealTimers());
function aufbau(canEdit = true, werkzeug: "lesen" | "marker" | "text" = "lesen") {
  vi.useFakeTimers();
  const auswahl = vi.fn(), aendern = vi.fn(), markierung = vi.fn(), textPlatzieren = vi.fn();
  render(<PdfAnmerkungsEbene annotationen={[{...annotation,can_edit:canEdit}]} basis={viewport} aktuell={viewport} breite={100} hoehe={100} werkzeug={werkzeug} ausgewaehlteId={1} onAuswahl={auswahl} onGeometrie={aendern} onMarkierung={markierung} onTextPlatzieren={textPlatzieren} />);
  vi.spyOn(screen.getByTestId("pdf-ebene"),"getBoundingClientRect").mockReturnValue({left:0,top:0,width:100,height:100} as DOMRect);
  // jsdom benötigt für PointerEvent die Koordinaten des MouseEvent-Konstruktors.
  vi.stubGlobal("PointerEvent", MouseEvent);
  return {knopf:screen.getByRole("button",{name:"Textanmerkung 1"}),auswahl,aendern,markierung,textPlatzieren};
}
afterEach(() => vi.unstubAllGlobals());
describe("Gedrückt halten und ziehen", () => {
  it("verschiebt nach 400 ms ohne Sprung und verwirft eine abgebrochene Bewegung", () => {
    const {knopf,auswahl,aendern} = aufbau();
    fireEvent.pointerDown(knopf,{clientX:25,clientY:25});
    act(() => vi.advanceTimersByTime(399)); expect(auswahl).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1)); expect(auswahl).toHaveBeenCalledWith(1);
    fireEvent.pointerMove(knopf,{clientX:35,clientY:45});
    expect(aendern).toHaveBeenLastCalledWith(1,expect.objectContaining({x:expect.closeTo(.3),y:expect.closeTo(.4)}));
    fireEvent.pointerCancel(knopf);
    expect(aendern).toHaveBeenLastCalledWith(1,annotation.geometry);
  });
  it("lässt frühes Scrollen ohne Positionsänderung zu", () => {
    const {knopf,auswahl,aendern} = aufbau();
    fireEvent.pointerDown(knopf,{clientX:25,clientY:25});
    fireEvent.pointerMove(knopf,{clientX:25,clientY:40});
    act(() => vi.advanceTimersByTime(500));
    expect(auswahl).not.toHaveBeenCalled(); expect(aendern).not.toHaveBeenCalled();
  });
  it("bietet bei fehlendem Bearbeitungsrecht keine Griffe und keine Verschiebung", () => {
    const {knopf,auswahl} = aufbau(false);
    fireEvent.pointerDown(knopf,{clientX:25,clientY:25}); act(() => vi.advanceTimersByTime(500));
    expect(auswahl).not.toHaveBeenCalled(); expect(screen.queryByRole("button",{name:"Anmerkung verschieben"})).not.toBeInTheDocument();
  });
  it("zeichnet im Markermodus über einer vorhandenen Anmerkung", () => {
    const {knopf,auswahl,markierung} = aufbau(true,"marker");
    fireEvent.pointerDown(knopf,{clientX:20,clientY:20});
    fireEvent.pointerUp(knopf,{clientX:40,clientY:40});
    expect(markierung).toHaveBeenCalledTimes(1);
    expect(auswahl).not.toHaveBeenCalled();
  });
  it("setzt Text im Textmodus über einer vorhandenen Anmerkung", () => {
    const {knopf,auswahl,textPlatzieren} = aufbau(true,"text");
    fireEvent.pointerDown(knopf,{clientX:20,clientY:20});
    fireEvent.pointerUp(knopf,{clientX:20,clientY:20});
    expect(textPlatzieren).toHaveBeenCalledTimes(1);
    expect(auswahl).not.toHaveBeenCalled();
  });
});
