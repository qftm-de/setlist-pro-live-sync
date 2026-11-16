"""Fachfehler der Bühnensitzung."""


class BuehnenFehler(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


class NichtGefunden(BuehnenFehler):
    def __init__(self, detail: str = "Nicht sichtbar."):
        super().__init__(404, detail)


class NichtErlaubt(BuehnenFehler):
    def __init__(self, detail: str = "Kein Zugriff."):
        super().__init__(403, detail)


class Konflikt(BuehnenFehler):
    def __init__(self, detail: str = "Der Stand wurde inzwischen geändert."):
        super().__init__(409, detail)
