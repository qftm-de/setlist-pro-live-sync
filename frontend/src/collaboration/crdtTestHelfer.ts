import * as Y from "yjs";
import {
  base64AusBytes,
  bytesAusBase64,
  type TextAntwort,
  type TextStand,
} from "./texte";

export function stand(text: string, epoch = 0): TextStand {
  const doc = new Y.Doc();
  doc.getText("t").insert(0, text);
  return {
    object_type: "setlist",
    object_uuid: "u1",
    field: "name",
    epoch,
    revision: 0,
    state: base64AusBytes(Y.encodeStateAsUpdate(doc)),
  };
}

export function serverAus(standWert: TextStand): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, bytesAusBase64(standWert.state));
  return doc;
}

export function antwort(server: Y.Doc, epoch: number, revision: number): TextAntwort {
  const text = server.getText("t").toString();
  return {
    text,
    epoch,
    revision,
    update: base64AusBytes(Y.encodeStateAsUpdate(server)),
  };
}

export function aufschub<T>() {
  let aufloesen!: (wert: T) => void;
  let ablehnen!: (fehler: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    aufloesen = res;
    ablehnen = rej;
  });
  return { promise, aufloesen, ablehnen };
}
