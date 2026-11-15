#!/bin/sh
# Leitet die nginx-Groessengrenze aus demselben Wert wie die API ab.
set -eu

wert="${PDF_MAX_UPLOAD_BYTES:-20971520}"
case "$wert" in
  ''|*[!0-9]*)
    echo "PDF_MAX_UPLOAD_BYTES muss eine nichtnegative ganze Zahl sein." >&2
    exit 1
    ;;
esac

if [ "$wert" -eq 0 ]; then
  grenze=0
else
  # Dateilimit plus Spielraum fuer Multipart-Metadaten.
  grenze=$((wert + 65536))
fi

sed "s/__PDF_PROXY_MAX_BODY__/$grenze/" /etc/nginx/pdf.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
