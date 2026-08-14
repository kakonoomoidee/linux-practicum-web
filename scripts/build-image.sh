#!/bin/bash
set -e
cd "$(dirname "$0")/../docker"
echo "🔨 Building image praktikum-linux:latest ..."
docker build -f Dockerfile.student -t praktikum-linux:latest .
echo "✅ Selesai. Cek dengan: docker images | grep praktikum-linux"
