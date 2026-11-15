from rest_framework import serializers

from documents.models import DocumentVersion


class DocumentVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentVersion
        fields = [
            "id",
            "number",
            "upload_id",
            "original_name",
            "byte_size",
            "page_count",
            "sha256",
            "created_at",
        ]
        read_only_fields = fields


class AktivierungSerializer(serializers.Serializer):
    revision = serializers.IntegerField(min_value=0)
    active_version_id = serializers.IntegerField(
        allow_null=True, min_value=1, required=True
    )
