@echo off
setlocal
set "DOCS_DIR=%~dp0docs"
set "PORT=8781"
set "URL=http://127.0.0.1:%PORT%/"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$port = %PORT%;" ^
  "$url = '%URL%';" ^
  "$docs = [IO.Path]::GetFullPath('%DOCS_DIR%');" ^
  "$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1;" ^
  "if ($listener) {" ^
  "  $isCurrentPage = $false;" ^
  "  try {" ^
  "    $html = (Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2).Content;" ^
  "    $isCurrentPage = $html -like '*Registration Landscape*' -and $html -like '*assets/js/integrated.js*';" ^
  "  } catch { $isCurrentPage = $false }" ^
  "  if (-not $isCurrentPage) {" ^
  "    $proc = Get-CimInstance Win32_Process -Filter \"ProcessId=$($listener.OwningProcess)\" -ErrorAction SilentlyContinue;" ^
  "    if ($proc -and $proc.CommandLine -like '*http.server*') { Stop-Process -Id $listener.OwningProcess -Force; Start-Sleep -Milliseconds 500; $listener = $null }" ^
  "  }" ^
  "}" ^
  "if (-not $listener) {" ^
  "  Start-Process -FilePath 'python' -ArgumentList @('-m','http.server', [string]$port, '--bind', '127.0.0.1') -WorkingDirectory $docs -WindowStyle Hidden;" ^
  "  Start-Sleep -Milliseconds 900;" ^
  "}" ^
  "Start-Process $url;"
if errorlevel 1 (
  echo Failed to start Registration Landscape.
  echo Make sure Python is installed, then try again.
  pause
  exit /b 1
)
