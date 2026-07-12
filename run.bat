@echo off
cd /d "%~dp0"
if not exist venv (
  echo Setting up - first run only...
  python -m venv venv
  venv\Scripts\pip install -r requirements.txt
)
if not exist tools\mozjpeg\cjpeg.exe (
  echo Downloading mozjpeg - used to compress cover photos - first run only...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; New-Item -ItemType Directory -Force -Path 'tools\mozjpeg' | Out-Null; Invoke-WebRequest -Uri 'https://mozjpeg.codelove.de/bin/mozjpeg_4.1.1_x64.zip' -OutFile 'tools\mozjpeg\mozjpeg.zip'; Expand-Archive -Path 'tools\mozjpeg\mozjpeg.zip' -DestinationPath 'tools\mozjpeg' -Force; Copy-Item 'tools\mozjpeg\mozjpeg_4.1.1_x64\static\tools\cjpeg.exe' 'tools\mozjpeg\cjpeg.exe' -Force; Remove-Item 'tools\mozjpeg\mozjpeg_4.1.1_x64' -Recurse -Force; Remove-Item 'tools\mozjpeg\mozjpeg.zip' -Force"
  if not exist tools\mozjpeg\cjpeg.exe (
    echo WARNING: could not download mozjpeg - cover photos will be saved uncompressed until this succeeds.
  )
)
echo Starting My Library at http://localhost:5000
echo Find "Other devices on your WiFi" instructions in README.md
venv\Scripts\python app.py
pause
