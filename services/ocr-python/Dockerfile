FROM python:3.10-slim-bookworm

ARG APT_MIRROR=
ARG PIP_INDEX_URL=

RUN set -eux; \
    if [ -n "$APT_MIRROR" ]; then \
      for f in /etc/apt/sources.list /etc/apt/sources.list.d/debian.sources; do \
        [ -f "$f" ] || continue; \
        sed -i \
          -e "s|http://deb.debian.org|$APT_MIRROR|g" \
          -e "s|http://security.debian.org|$APT_MIRROR|g" \
          "$f"; \
      done; \
    fi; \
    apt-get update; \
    apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 libgl1; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN set -eux; \
    if [ -n "$PIP_INDEX_URL" ]; then \
      host=$(printf '%s' "$PIP_INDEX_URL" | sed -E 's#^[a-z]+://([^/:]+).*#\1#'); \
      pip install --no-cache-dir -i "$PIP_INDEX_URL" --trusted-host "$host" -r requirements.txt; \
    else \
      pip install --no-cache-dir -r requirements.txt; \
    fi
COPY app.py .

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
