from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("annotations", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="annotation",
            name="permission_generation",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
