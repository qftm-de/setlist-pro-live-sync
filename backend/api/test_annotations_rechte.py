from annotations.testhelfer import AnnotationTestBasis


class AnnotationRechteTest(AnnotationTestBasis):
    def test_fremde_persoenliche_bleiben_unsichtbar(self):
        angelegt = self.erstelle().json()
        mitglied = self.mitglied_client()
        self.assertEqual(mitglied.get(self.pfad()).json(), [])
        self.assertEqual(
            mitglied.get(self.pfad(annotation_id=angelegt["id"])).status_code, 404
        )

        # Owner der zweiten Band ist nicht Autor und darf den Text nicht sehen.
        zweite = self.erstelle(
            band=self.zweite_band,
            song=self.zweiter_song,
            version=self.zweite_version,
            text="Nur fuer den Autor",
        )
        self.assertEqual(zweite.status_code, 201)
        pfad = self.pfad(
            band=self.zweite_band,
            song=self.zweiter_song,
            version=self.zweite_version,
        )
        mitglied = self.mitglied_client()
        self.assertEqual(mitglied.get(pfad).json(), [])
        self.assertEqual(
            mitglied.get(f"{pfad}{zweite.json()['id']}/").status_code, 404
        )

    def test_bandweite_anmerkung_rechte_matrix(self):
        angelegt = self.erstelle(visibility="band").json()
        mitglied = self.mitglied_client()
        liste = mitglied.get(self.pfad()).json()
        self.assertEqual(len(liste), 1)
        self.assertFalse(liste[0]["can_edit"])
        self.assertFalse(liste[0]["can_delete"])

        aendern = mitglied.patch(
            self.pfad(annotation_id=angelegt["id"]),
            data={"revision": 0, "text": "Fremder Versuch"},
            content_type="application/json",
        )
        self.assertEqual(aendern.status_code, 403)
        loeschen = mitglied.delete(
            f"{self.pfad(annotation_id=angelegt['id'])}?revision=0"
        )
        self.assertEqual(loeschen.status_code, 403)

        autor = self.client.patch(
            self.pfad(annotation_id=angelegt["id"]),
            data={"revision": 0, "text": "Autor aendert"},
            content_type="application/json",
        )
        self.assertEqual(autor.status_code, 200)
        self.assertEqual(
            self.client.delete(
                f"{self.pfad(annotation_id=angelegt['id'])}?revision=1"
            ).status_code,
            204,
        )

    def test_owner_loescht_bandweite_anmerkung_ohne_autor_zu_sein(self):
        angelegt = self.erstelle(
            band=self.zweite_band,
            song=self.zweiter_song,
            version=self.zweite_version,
            visibility="band",
            text="Geteilter Text",
        ).json()
        pfad = self.pfad(
            band=self.zweite_band,
            song=self.zweiter_song,
            version=self.zweite_version,
        )
        mitglied = self.mitglied_client()
        detail = mitglied.get(f"{pfad}{angelegt['id']}/").json()
        self.assertFalse(detail["can_edit"])
        self.assertTrue(detail["can_delete"])

        aendern = mitglied.patch(
            f"{pfad}{angelegt['id']}/",
            data={"revision": 0, "text": "Owner versucht zu aendern"},
            content_type="application/json",
        )
        self.assertEqual(aendern.status_code, 403)
        self.assertEqual(
            mitglied.delete(f"{pfad}{angelegt['id']}/?revision=0").status_code,
            204,
        )

    def test_owner_sieht_privates_autor_weiterhin_nicht(self):
        angelegt = self.erstelle(
            band=self.zweite_band,
            song=self.zweiter_song,
            version=self.zweite_version,
            text="Privat",
        ).json()
        pfad = self.pfad(
            band=self.zweite_band,
            song=self.zweiter_song,
            version=self.zweite_version,
        )
        mitglied = self.mitglied_client()
        self.assertEqual(mitglied.get(f"{pfad}{angelegt['id']}/").status_code, 404)
        self.assertEqual(
            mitglied.delete(f"{pfad}{angelegt['id']}/?revision=0").status_code,
            404,
        )

    def test_autor_rechte_und_mitgliedschaft(self):
        angelegt = self.erstelle(visibility="band").json()
        detail = self.client.get(self.pfad(annotation_id=angelegt["id"])).json()
        self.assertTrue(detail["can_edit"])
        self.assertTrue(detail["can_delete"])
        self.assertEqual(detail["author_id"], self.benutzer.id)
