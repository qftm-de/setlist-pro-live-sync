import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("documents", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Annotation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uuid", models.UUIDField(default=uuid.uuid4, unique=True)),
                ("page_number", models.PositiveIntegerField()),
                (
                    "kind",
                    models.CharField(
                        choices=[("text", "Text"), ("marker", "Marker")], max_length=16
                    ),
                ),
                (
                    "visibility",
                    models.CharField(
                        choices=[("private", "Persönlich"), ("band", "Band")],
                        default="private",
                        max_length=16,
                    ),
                ),
                ("geometry", models.JSONField()),
                (
                    "color",
                    models.CharField(
                        choices=[
                            ("gelb", "Gelb"),
                            ("orange", "Orange"),
                            ("blau", "Blau"),
                            ("gruen", "Grün"),
                        ],
                        default="gelb",
                        max_length=16,
                    ),
                ),
                ("text", models.TextField(blank=True, default="")),
                ("font_size", models.FloatField(blank=True, null=True)),
                ("revision", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "document_version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="annotations",
                        to="documents.documentversion",
                    ),
                ),
            ],
            options={"ordering": ["id"]},
        ),
    ]
