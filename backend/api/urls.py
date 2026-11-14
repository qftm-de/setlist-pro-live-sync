from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health),
    path("config/", views.konfiguration),
    path("session/", views.SitzungView.as_view()),
]
