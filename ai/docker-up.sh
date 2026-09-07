#!/usr/bin/env bash
# EC2(Amazon Linux 등)에서 docker compose build 시 buildx 0.17+ 요구 오류를 해결하고 AI 서버를 기동한다.
# .env는 수정하지 않으며, docker-compose.yml의 env_file 설정을 그대로 사용한다.
set -euo pipefail

cd "$(dirname "$0")"

MIN_BUILDX="0.17.0"
BUILDX_INSTALL_VERSION="0.19.3"
IMAGE_NAME="ai-ai"

get_buildx_version() {
  docker buildx version 2>/dev/null \
    | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' \
    | head -1 \
    | tr -d 'v' || true
}

version_ge() {
  local current="$1"
  local required="$2"
  if [[ -z "${current}" ]]; then
    return 1
  fi
  local highest
  highest="$(printf '%s\n%s\n' "${required}" "${current}" | sort -V | tail -1)"
  [[ "${highest}" == "${current}" && "${current}" != "${required}" || "${current}" == "${required}" ]]
}

ensure_buildx() {
  local current
  current="$(get_buildx_version)"
  if version_ge "${current}" "${MIN_BUILDX}"; then
    echo "[ok] docker buildx ${current:-unknown} (>= ${MIN_BUILDX})"
    return
  fi

  echo "[fix] buildx ${current:-not found} < ${MIN_BUILDX}, installing v${BUILDX_INSTALL_VERSION} for ec2-user..."
  local arch plugin_dir plugin_path
  arch="$(uname -m | sed 's/aarch64/arm64/;s/x86_64/amd64/')"
  plugin_dir="${HOME}/.docker/cli-plugins"
  plugin_path="${plugin_dir}/docker-buildx"
  mkdir -p "${plugin_dir}"
  curl -fsSL \
    "https://github.com/docker/buildx/releases/download/v${BUILDX_INSTALL_VERSION}/buildx-v${BUILDX_INSTALL_VERSION}.linux-${arch}" \
    -o "${plugin_path}"
  chmod +x "${plugin_path}"
  docker buildx version
}

build_image() {
  if docker compose build; then
    echo "[ok] docker compose build succeeded"
    return
  fi

  echo "[fallback] docker compose build failed; using legacy docker build..."
  docker build -t "${IMAGE_NAME}" .
}

start_service() {
  docker compose up -d
  echo "[wait] health check..."
  for _ in $(seq 1 20); do
    if curl -sf "http://127.0.0.1:8000/health" >/dev/null; then
      curl -s "http://127.0.0.1:8000/health"
      echo
      docker compose ps
      return 0
    fi
    sleep 1
  done

  echo "[error] health check failed"
  docker compose logs --tail=50
  return 1
}

main() {
  if [[ ! -f .env ]]; then
    echo "[error] .env not found. copy from .env.example and fill required keys first."
    exit 1
  fi

  ensure_buildx
  build_image
  start_service
}

main "$@"
