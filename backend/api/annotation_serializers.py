import math
from collections.abc import Mapping

from rest_framework import serializers

from annotations.models import Annotation
from collaboration.models import TextState
from collaboration.services import (
    zustand_daten,
    zustand_initial,
    zustand_lesen,
)


def _zahl(wert, feld: str) -> float:
    if isinstance(wert, bool) or not isinstance(wert, (int, float)):
        raise serializers.ValidationError({feld: "Endliche Zahl erwartet."})
    zahl = float(wert)
    if not math.isfinite(zahl):
        raise serializers.ValidationError({feld: "Endliche Zahl erwartet."})
    return zahl


def pruefe_geometrie(wert) -> dict:
    if not isinstance(wert, dict):
        raise serializers.ValidationError({"geometry": "Rechteck erwartet."})
    felder = {}
    for name in ("x", "y", "width", "height"):
        if name not in wert:
            raise serializers.ValidationError({"geometry": f"{name} fehlt."})
        felder[name] = _zahl(wert[name], "geometry")
    x, y = felder["x"], felder["y"]
    breite, hoehe = felder["width"], felder["height"]
    if x < 0 or y < 0:
        raise serializers.ValidationError({"geometry": "x und y dürfen nicht negativ sein."})
    if breite <= 0 or hoehe <= 0:
        raise serializers.ValidationError({"geometry": "Breite und Höhe müssen positiv sein."})
    if x + breite > 1 + 1e-9 or y + hoehe > 1 + 1e-9:
        raise serializers.ValidationError({"geometry": "Rechteck liegt außerhalb der Seite."})
    return {"x": x, "y": y, "width": breite, "height": hoehe}


def pruefe_inhalt(kind: str, text: str | None, font_size: float | None) -> tuple[str, float | None]:
    if kind == Annotation.ART_MARKER:
        if (text or "").strip():
            raise serializers.ValidationError({"text": "Ein Marker hat keinen Text."})
        if font_size is not None:
            raise serializers.ValidationError(
                {"font_size": "Ein Marker hat keine Schriftgröße."}
            )
        return "", None
    inhalt = (text or "").strip()
    if not inhalt:
        raise serializers.ValidationError({"text": "Eine Textanmerkung braucht Text."})
    if len(inhalt) > 2000:
        raise serializers.ValidationError({"text": "Höchstens 2.000 Zeichen."})
    groesse = 0.0225 if font_size is None else float(font_size)
    if not any(abs(groesse - erlaubt) < 1e-9 for erlaubt in Annotation.SCHRIFTGROESSEN):
        raise serializers.ValidationError(
            {"font_size": "Nur 0.015, 0.0225 oder 0.03 sind erlaubt."}
        )
    return inhalt, groesse


class AnnotationSerializer(serializers.ModelSerializer):
    author_id = serializers.IntegerField(read_only=True)
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    can_change_visibility = serializers.SerializerMethodField()
    text_epoch = serializers.SerializerMethodField()
    text_state = serializers.SerializerMethodField()

    class Meta:
        model = Annotation
        fields = [
            "id",
            "uuid",
            "page_number",
            "kind",
            "visibility",
            "geometry",
            "color",
            "text",
            "font_size",
            "revision",
            "permission_generation",
            "text_epoch",
            "text_state",
            "author_id",
            "created_at",
            "updated_at",
            "can_edit",
            "can_delete",
            "can_change_visibility",
        ]
        read_only_fields = fields

    def _zustand(self, obj):
        # Pro Anmerkung genau eine Abfrage je Serializer-Lauf (Liste, Detail).
        cache = getattr(self, "_textzustand_cache", None)
        if cache is None:
            cache = {}
            self._textzustand_cache = cache
        if obj.pk not in cache:
            karte = self.context.get("textzustaende")
            if karte is not None and obj.uuid in karte:
                vorhanden = karte[obj.uuid]
                cache[obj.pk] = vorhanden or zustand_initial(
                    TextState.TYP_ANNOTATION, obj.uuid, "text", obj.text
                )
            else:
                cache[obj.pk] = zustand_lesen(
                    TextState.TYP_ANNOTATION, obj.uuid, "text", obj.text
                )
        return cache[obj.pk]

    def get_text_epoch(self, obj) -> int:
        return self._zustand(obj).epoch

    def get_text_state(self, obj) -> str:
        return zustand_daten(self._zustand(obj))["state"]

    def get_can_edit(self, obj) -> bool:
        if obj.author_id == self.context["request"].user.id:
            return True
        return obj.visibility == Annotation.SICHTBAR_BAND

    def get_can_change_visibility(self, obj) -> bool:
        return obj.author_id == self.context["request"].user.id

    def get_can_delete(self, obj) -> bool:
        if obj.author_id == self.context["request"].user.id:
            return True
        return bool(self.context.get("ist_owner") and obj.visibility == Annotation.SICHTBAR_BAND)


class AnnotationAnlageSerializer(serializers.Serializer):
    uuid = serializers.UUIDField()
    page_number = serializers.IntegerField(min_value=1)
    kind = serializers.ChoiceField(choices=Annotation.ART_CHOICES)
    visibility = serializers.ChoiceField(
        choices=Annotation.SICHTBAR_CHOICES, required=False, default=Annotation.SICHTBAR_PRIVAT
    )
    geometry = serializers.JSONField()
    color = serializers.ChoiceField(
        choices=Annotation.FARBEN, required=False, default="gelb"
    )
    text = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=2000
    )
    font_size = serializers.FloatField(required=False, allow_null=True, default=None)

    def to_internal_value(self, data):
        if not isinstance(data, Mapping):
            raise serializers.ValidationError({"detail": "JSON-Objekt erwartet."})
        for gesperrt in ("author", "author_id", "document_version"):
            if gesperrt in data:
                raise serializers.ValidationError(
                    {gesperrt: "Wird vom Server gesetzt."}
                )
        return super().to_internal_value(data)

    def validate(self, daten):
        version = self.context["version"]
        if daten["page_number"] > version.page_count:
            raise serializers.ValidationError(
                {"page_number": "Seite liegt außerhalb der Dokumentversion."}
            )
        daten["geometry"] = pruefe_geometrie(daten["geometry"])
        text, groesse = pruefe_inhalt(daten["kind"], daten.get("text"), daten.get("font_size"))
        daten["text"] = text
        daten["font_size"] = groesse
        return daten

    def signatur(self) -> dict:
        daten = self.validated_data
        return {
            "page_number": daten["page_number"],
            "kind": daten["kind"],
            "visibility": daten["visibility"],
            "geometry": daten["geometry"],
            "color": daten["color"],
            "text": daten["text"],
            "font_size": daten["font_size"],
        }


class AnnotationAenderungSerializer(serializers.Serializer):
    page_number = serializers.IntegerField(min_value=1, required=False)
    kind = serializers.ChoiceField(choices=Annotation.ART_CHOICES, required=False)
    visibility = serializers.ChoiceField(
        choices=Annotation.SICHTBAR_CHOICES, required=False
    )
    geometry = serializers.JSONField(required=False)
    color = serializers.ChoiceField(choices=Annotation.FARBEN, required=False)
    text = serializers.CharField(
        required=False, allow_blank=True, max_length=2000
    )
    font_size = serializers.FloatField(required=False, allow_null=True)

    def to_internal_value(self, data):
        if not isinstance(data, Mapping):
            raise serializers.ValidationError({"detail": "JSON-Objekt erwartet."})
        for gesperrt in ("author", "author_id", "document_version", "uuid"):
            if gesperrt in data:
                raise serializers.ValidationError(
                    {gesperrt: "Dieses Feld ist unveränderlich."}
                )
        return super().to_internal_value(data)

    def validate(self, daten):
        alte = self.instance
        version = self.context["version"]
        seite = daten.get("page_number", alte.page_number)
        if seite > version.page_count:
            raise serializers.ValidationError(
                {"page_number": "Seite liegt außerhalb der Dokumentversion."}
            )
        kind = daten.get("kind", alte.kind)
        text = daten.get("text", alte.text)
        groesse = daten.get("font_size", alte.font_size)
        if kind == Annotation.ART_MARKER and "font_size" not in daten:
            groesse = None
        if kind == Annotation.ART_TEXT and "font_size" not in daten and alte.kind == Annotation.ART_MARKER:
            groesse = None
        text, groesse = pruefe_inhalt(kind, text, groesse)
        daten["text"] = text
        daten["font_size"] = groesse
        if "geometry" in daten:
            daten["geometry"] = pruefe_geometrie(daten["geometry"])
        return daten
