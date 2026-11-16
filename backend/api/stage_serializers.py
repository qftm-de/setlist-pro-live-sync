from rest_framework import serializers


class StartEingabeSerializer(serializers.Serializer):
    setlist_id = serializers.IntegerField(min_value=1)
    connection_id = serializers.UUIDField()


class VerbindungEingabeSerializer(serializers.Serializer):
    connection_id = serializers.UUIDField()


class UebergabeEingabeSerializer(serializers.Serializer):
    connection_id = serializers.UUIDField()
    target_user_id = serializers.IntegerField(min_value=1)
