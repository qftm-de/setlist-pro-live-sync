import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("bands", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="band",
            name="description",
            field=models.TextField(blank=True, default="", verbose_name="Beschreibung"),
        ),
        migrations.AddField(
            model_name="band",
            name="genre",
            field=models.CharField(
                blank=True, default="", max_length=120, verbose_name="Genre"
            ),
        ),
        migrations.AddField(
            model_name="band",
            name="internal_notes",
            field=models.TextField(
                blank=True, default="", verbose_name="Interne Band-Notiz"
            ),
        ),
        migrations.AddField(
            model_name="band",
            name="location",
            field=models.CharField(
                blank=True, default="", max_length=200, verbose_name="Ort / Proberaum"
            ),
        ),
        migrations.CreateModel(
            name="BandInvitation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("token_hash", models.CharField(max_length=64, unique=True)),
                (
                    "note",
                    models.CharField(
                        blank=True, default="", max_length=120, verbose_name="Hinweis"
                    ),
                ),
                ("expires_at", models.DateTimeField()),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                ("uses_count", models.PositiveIntegerField(default=0)),
                ("max_uses", models.PositiveIntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("last_used_at", models.DateTimeField(blank=True, null=True)),
                (
                    "band",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="invitations",
                        to="bands.band",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="erstellte_einladungen",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
    ]
