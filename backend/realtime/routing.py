from django.urls import path

from .consumers import BandConsumer

websocket_urlpatterns = [
    path("ws/bands/<int:band_id>/", BandConsumer.as_asgi()),
]
