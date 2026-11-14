from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET
from rest_framework.response import Response
from rest_framework.views import APIView


def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        return JsonResponse({"status": "error"}, status=503)
    return JsonResponse({"status": "ok"})


@require_GET
@ensure_csrf_cookie
def konfiguration(request):
    return JsonResponse(
        {
            "mode": settings.APP_MODE,
            "instance_name": settings.INSTANCE_NAME,
            "community_url": settings.COMMUNITY_URL,
        }
    )


class SitzungView(APIView):
    def get(self, request):
        return Response(
            {
                "authenticated": True,
                "username": request.user.get_username(),
            }
        )
