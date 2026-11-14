from rest_framework.authentication import SessionAuthentication


class SessionAuthentication401(SessionAuthentication):
    """Session-Auth mit 401 statt 403 für anonyme Aufrufe."""

    def authenticate_header(self, request):
        return "Session"
