from pathlib import Path

from .config import cookie_secure, load_runtime_config

BASE_DIR = Path(__file__).resolve().parent.parent

konfiguration = load_runtime_config()

SECRET_KEY = konfiguration.secret_key
DEBUG = konfiguration.debug
ALLOWED_HOSTS = list(konfiguration.allowed_hosts)

APP_MODE = konfiguration.modus
INSTANCE_NAME = konfiguration.instanzname
COMMUNITY_URL = konfiguration.community_url

CSRF_TRUSTED_ORIGINS = list(konfiguration.csrf_trusted_origins)
USE_X_FORWARDED_HOST = konfiguration.trust_proxy_headers
if konfiguration.trust_proxy_headers:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

COOKIE_SECURE = cookie_secure(DEBUG, konfiguration.trust_proxy_headers)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = COOKIE_SECURE
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = COOKIE_SECURE

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
if not DEBUG:
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "accounts",
    "bands",
    "library",
    "setlists",
    "gigs",
    "documents",
    "annotations",
    "realtime",
    "api",
]

AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"
ASGI_APPLICATION = "core.asgi.application"

REDIS_URL = konfiguration.redis_url
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}
REALTIME_CHECK_SECONDS = 15
REALTIME_MAX_CONNECTIONS_PER_USER = 20
REALTIME_MIN_PING_SECONDS = 5

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": konfiguration.db_name,
        "USER": konfiguration.db_user,
        "PASSWORD": konfiguration.db_password,
        "HOST": konfiguration.db_host,
        "PORT": konfiguration.db_port,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "api.authentication.SessionAuthentication401",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}

LANGUAGE_CODE = "de"
TIME_ZONE = "Europe/Berlin"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DOCUMENTS_ROOT = (
    Path(konfiguration.documents_root)
    if konfiguration.documents_root
    else BASE_DIR / "documents"
)
PDF_MAX_UPLOAD_BYTES = konfiguration.pdf_max_upload_bytes
PDF_MAX_PAGES = konfiguration.pdf_max_pages
PDF_CHECK_TIMEOUT_SECONDS = konfiguration.pdf_check_timeout_seconds
PDF_CHECK_MEMORY_MB = konfiguration.pdf_check_memory_mb

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
