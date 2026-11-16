import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def uuids_nachtragen(apps, schema_editor):
    Setlist = apps.get_model("setlists", "Setlist")
    Section = apps.get_model("setlists", "Section")
    Entry = apps.get_model("setlists", "Entry")
    for model in (Setlist, Section, Entry):
        for zeile in model.objects.filter(uuid__isnull=True).only("id").iterator():
            model.objects.filter(pk=zeile.pk).update(uuid=uuid.uuid4())


class Migration(migrations.Migration):
    dependencies = [
        ("setlists", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="setlist",
            name="revision",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="setlist",
            name="uuid",
            field=models.UUIDField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="section",
            name="uuid",
            field=models.UUIDField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="entry",
            name="uuid",
            field=models.UUIDField(null=True, blank=True),
        ),
        migrations.RunPython(uuids_nachtragen, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="setlist",
            name="uuid",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="section",
            name="uuid",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="entry",
            name="uuid",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.CreateModel(
            name="SetlistCommand",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("command_id", models.UUIDField()),
                ("kind", models.CharField(max_length=32)),
                ("signature", models.CharField(max_length=64)),
                ("result", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("setlist", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="befehle", to="setlists.setlist")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="+", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["id"]},
        ),
        migrations.AddConstraint(
            model_name="setlistcommand",
            constraint=models.UniqueConstraint(fields=("setlist", "command_id"), name="befehl_kennung_einmal"),
        ),
    ]
