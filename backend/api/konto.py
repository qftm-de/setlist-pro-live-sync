"""Gemeinsame Kontoprüfung und Kontoanlage für Anmeldung und Einladungen.

Beide Wege nutzen exakt einen Argon2-Verifikationspfad (auch für unbekannte
oder gesperrte Konten), damit weder Antworttext noch Hash-Aufwand verraten,
ob ein Konto existiert.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction

User = get_user_model()

_VERGLEICHS_HASH = None
_AUTH_BACKEND = "django.contrib.auth.backends.ModelBackend"

FEHLER_EINGABE = {"detail": "Eingaben prüfen."}


def normalisiere_benutzername(roh: object) -> str:
    """Trimmt und normalisiert Benutzernamen per NFKC wie Djangos UserManager."""
    if not isinstance(roh, str):
        return ""
    return get_user_model().normalize_username(roh.strip())


def vergleichs_hash() -> str:
    global _VERGLEICHS_HASH
    if _VERGLEICHS_HASH is None:
        _VERGLEICHS_HASH = make_password("kein-konto")
    return _VERGLEICHS_HASH


def ohne_konto_pruefen(passwort: str) -> None:
    """Rechnet genau einen Argon2-Vergleich gegen einen vorbereiteten Hash."""
    check_password(passwort, vergleichs_hash())


def konto_pruefen(roh_benutzername: object, passwort: str):
    """Prüft Zugangsdaten mit einheitlichem Hash-Vergleich ohne Konto-Hinweis."""
    benutzername = normalisiere_benutzername(roh_benutzername)
    if not benutzername or not passwort:
        ohne_konto_pruefen(passwort or "")
        return None
    user_model = get_user_model()
    try:
        konto = user_model._default_manager.get_by_natural_key(benutzername)
    except user_model.DoesNotExist:
        ohne_konto_pruefen(passwort)
        return None
    if not konto.check_password(passwort):
        return None
    if not konto.is_active:
        return None
    konto.backend = _AUTH_BACKEND
    return konto


def registriere_konto(daten: dict):
    """Legt ein Konto aus Einladungsdaten an.

    Gibt ``(konto, fehler, status)`` zurück. Bei Erfolg ist ``fehler`` None und
    ``status`` 201. Sonst ist ``konto`` None und ``fehler`` die Antwortnutzlast.
    """
    benutzername = normalisiere_benutzername(daten.get("username"))
    passwort = daten.get("password")
    if not benutzername or len(benutzername) > 150 or not isinstance(passwort, str):
        return None, FEHLER_EINGABE, 400
    try:
        UnicodeUsernameValidator()(benutzername)
    except ValidationError:
        return None, FEHLER_EINGABE, 400
    rohe_mail = daten.get("email")
    email = rohe_mail.strip().lower() if isinstance(rohe_mail, str) else ""
    if not email or len(email) > 254:
        return None, FEHLER_EINGABE, 400
    try:
        validate_email(email)
    except ValidationError:
        return None, FEHLER_EINGABE, 400

    # Passwort vor den Datenbankabfragen prüfen. Sonst unterscheiden sich die
    # Antworten für vorhandene und freie Konten, obwohl nichts angelegt wird.
    konto = User(username=benutzername, email=email)
    try:
        validate_password(passwort, konto)
    except ValidationError:
        return None, {"password": "Passwort erfüllt die Regeln nicht."}, 400

    if User.objects.filter(username=benutzername).exists():
        return None, FEHLER_EINGABE, 400
    if User.objects.filter(email__iexact=email).exists():
        return None, FEHLER_EINGABE, 400

    roher_anzeigename = daten.get("display_name")
    if roher_anzeigename is None or (
        isinstance(roher_anzeigename, str) and not roher_anzeigename.strip()
    ):
        anzeigename = benutzername[:120]
    elif not isinstance(roher_anzeigename, str):
        return None, FEHLER_EINGABE, 400
    else:
        anzeigename = roher_anzeigename.strip()
        if len(anzeigename) > 120:
            return None, FEHLER_EINGABE, 400

    try:
        with transaction.atomic():
            konto = User.objects.create_user(
                username=benutzername,
                email=email,
                password=passwort,
                display_name=anzeigename,
            )
    except IntegrityError:
        return None, FEHLER_EINGABE, 400
    return konto, None, 201
