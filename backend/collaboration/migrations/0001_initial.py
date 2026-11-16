from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="TextState",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("object_type", models.CharField(choices=[("setlist", "Setlist"), ("section", "Abschnitt"), ("entry", "Eintrag"), ("annotation", "Anmerkung")], max_length=16)),
                ("object_uuid", models.UUIDField()),
                ("field", models.CharField(choices=[("name", "Name"), ("label", "Bezeichnung"), ("text", "Text")], max_length=16)),
                ("epoch", models.PositiveIntegerField(default=0)),
                ("revision", models.PositiveBigIntegerField(default=0)),
                ("state", models.BinaryField(default=b"")),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="RemovedId",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("object_type", models.CharField(choices=[("setlist", "Setlist"), ("section", "Abschnitt"), ("entry", "Eintrag"), ("annotation", "Anmerkung")], max_length=16)),
                ("object_uuid", models.UUIDField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.AddConstraint(
            model_name="textstate",
            constraint=models.UniqueConstraint(fields=("object_type", "object_uuid", "field"), name="textzustand_feld_einmal"),
        ),
        migrations.AddConstraint(
            model_name="removedid",
            constraint=models.UniqueConstraint(fields=("object_type", "object_uuid"), name="loeschmarke_einmal"),
        ),
    ]
