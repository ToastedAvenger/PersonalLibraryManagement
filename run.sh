#!/bin/bash
# Run this from inside the library_app folder: ./run.sh
cd "$(dirname "$0")"
if [ ! -d "venv" ]; then
  echo "Setting up (first run only)..."
  python3 -m venv venv
  ./venv/bin/pip install -r requirements.txt
fi

if [ ! -x "tools/mozjpeg/cjpeg" ]; then
  echo "Building mozjpeg (used to compress cover photos) - first run only, this can take a minute or two..."
  if ! command -v cmake >/dev/null 2>&1 || ! command -v nasm >/dev/null 2>&1 || ! command -v gcc >/dev/null 2>&1; then
    echo "Installing build tools (cmake, nasm, build-essential) - you may be asked for your password..."
    sudo apt-get update && sudo apt-get install -y cmake nasm build-essential
  fi
  MOZJPEG_TMP="$(mktemp -d)"
  if curl -fsSL "https://github.com/mozilla/mozjpeg/archive/refs/tags/v4.1.1.tar.gz" -o "$MOZJPEG_TMP/mozjpeg.tar.gz" \
     && tar -xzf "$MOZJPEG_TMP/mozjpeg.tar.gz" -C "$MOZJPEG_TMP" \
     && mkdir -p "$MOZJPEG_TMP/build" \
     && (cd "$MOZJPEG_TMP/build" && cmake -G"Unix Makefiles" "$MOZJPEG_TMP/mozjpeg-4.1.1" && make -j"$(nproc)" cjpeg); then
    mkdir -p tools/mozjpeg
    cp "$MOZJPEG_TMP/build/cjpeg" tools/mozjpeg/cjpeg
    chmod +x tools/mozjpeg/cjpeg
    echo "mozjpeg built successfully."
  else
    echo "WARNING: could not build mozjpeg - cover photos will be saved uncompressed until this succeeds."
  fi
  rm -rf "$MOZJPEG_TMP"
fi

echo "Starting My Library at http://localhost:5000"
echo "Other devices on your WiFi can use: http://$(hostname -I | awk '{print $1}'):5000"
./venv/bin/python app.py
