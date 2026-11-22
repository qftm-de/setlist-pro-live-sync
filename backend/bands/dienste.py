"""Fachlogik für Bandmitglieder. Schreibvorgänge laufen unter Zeilensperre."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from realtime.services import band_ereignis
from stage.models import StageConnection

from .models import Band, Membership

GUELTIGE_ROLLEN = {Membership.ROLE_OWNER, Membership.ROLE_MEMBER}


class MitgliedNichtGefunden(Exception):
    """Die Mitgliedschaft gehört nicht zu dieser Band."""


class MitgliedNichtErlaubt(Exception):
    """Ein normales Mitglied versucht, einen anderen Eintrag zu ändern."""


class LetzterOwnerFehler(Exception):
    """Die letzte Owner-Zeile bleibt geschützt."""


class UngueltigeRolle(Exception):
    """Rolle außerhalb von owner und member."""


class KontoInaktivFehler(Exception):
    """Ein gesperrtes Konto kann nicht als aktiver Owner eingesetzt werden."""


def ist_owner(band: Band, user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    return Membership.objects.filter(
        band=band, user=user, role=Membership.ROLE_OWNER
    ).exists()


def _sperren(band: Band) -> list[Membership]:
    return list(
        Membership.objects.select_for_update(of=("self",))
        .select_related("user")
        .filter(band=band)
        .order_by("id")
    )


def _ziel(mitglieder: list[Membership], ziel_id: int) -> Membership:
    for mitglied in mitglieder:
        if mitglied.id == ziel_id:
            return mitglied
    raise MitgliedNichtGefunden


def aktive_owner_anzahl(mitglieder: list[Membership]) -> int:
    return sum(
        1
        for m in mitglieder
        if m.role == Membership.ROLE_OWNER and m.user.is_active
    )


def ist_letzter_aktiver_owner(
    mitglieder: list[Membership], ziel: Membership
) -> bool:
    return (
        ziel.role == Membership.ROLE_OWNER
        and ziel.user.is_active
        and aktive_owner_anzahl(mitglieder) <= 1
    )


def _akteur_zeile(mitglieder: list[Membership], akteur) -> Membership:
    zeile = next(
        (m for m in mitglieder if m.user_id == getattr(akteur, "id", None)), None
    )
    if zeile is None:
        raise MitgliedNichtGefunden
    return zeile


def _owner_zeile(mitglieder: list[Membership], akteur) -> Membership:
    zeile = _akteur_zeile(mitglieder, akteur)
    if zeile.role != Membership.ROLE_OWNER:
        raise MitgliedNichtErlaubt
    return zeile


@transaction.atomic
def rolle_aendern(band: Band, akteur, ziel_id: int, neue_rolle: str) -> Membership:
    if neue_rolle not in GUELTIGE_ROLLEN:
        raise UngueltigeRolle
    mitglieder = _sperren(band)
    _owner_zeile(mitglieder, akteur)
    ziel = _ziel(mitglieder, ziel_id)
    if ziel.role == neue_rolle:
        return ziel
    if (
        neue_rolle == Membership.ROLE_MEMBER
        and ist_letzter_aktiver_owner(mitglieder, ziel)
    ):
        raise LetzterOwnerFehler
    ziel.role = neue_rolle
    ziel.save(update_fields=["role"])
    band_ereignis(band, "band.members.updated")
    return ziel


@transaction.atomic
def band_owner_sperren(band: Band, akteur) -> Membership:
    """Erneut prüfen, ob der Aufrufer nach der Zeilensperre noch Owner ist."""
    return _owner_zeile(_sperren(band), akteur)


@transaction.atomic
def betreiber_owner_setzen(band: Band, konto) -> Membership:
    """Autorisierte Betreiber-Wiederherstellung eines aktiven Band-Owners."""
    if not getattr(konto, "is_active", False):
        raise KontoInaktivFehler
    mitglieder = _sperren(band)
    vorhanden = next((m for m in mitglieder if m.user_id == konto.id), None)
    if vorhanden is None:
        zeile = Membership.objects.create(
            band=band, user=konto, role=Membership.ROLE_OWNER
        )
    elif vorhanden.role != Membership.ROLE_OWNER:
        vorhanden.role = Membership.ROLE_OWNER
        vorhanden.save(update_fields=["role"])
        zeile = vorhanden
    else:
        return vorhanden
    band_ereignis(band, "band.members.updated")
    return zeile


@transaction.atomic
def mitglied_entfernen(band: Band, akteur, ziel_id: int) -> int:
    mitglieder = _sperren(band)
    ziel = _ziel(mitglieder, ziel_id)
    akteur_zeile = _akteur_zeile(mitglieder, akteur)
    ist_selbst = akteur_zeile.id == ziel.id
    if akteur_zeile.role != Membership.ROLE_OWNER and not ist_selbst:
        raise MitgliedNichtErlaubt
    if ist_letzter_aktiver_owner(mitglieder, ziel):
        raise LetzterOwnerFehler
    entfernte_user_id = ziel.user_id
    StageConnection.objects.filter(
        band=band, user_id=entfernte_user_id, closed_at__isnull=True
    ).update(closed_at=timezone.now())
    ziel.delete()
    band_ereignis(band, "band.members.updated", removed_user_id=entfernte_user_id)
    return entfernte_user_id
