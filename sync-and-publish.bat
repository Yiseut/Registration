@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "SRC_CSV=E:\shared\code\registration\output\master\registration_records_master.csv"
set "DST_CSV=data\registration_records_master.csv"
set "PAGES_URL=https://yiseut.github.io/Registration/"

title Registration Insights -- Sync and Publish
echo.
echo =====================================================
echo   Registration Insights -- Sync and Publish
echo   %date% %time%
echo =====================================================
echo.

if not exist "%SRC_CSV%" (
  echo [ERROR] Source CSV not found:
  echo         %SRC_CSV%
  echo.
  echo Did the codex project move? Edit this batch file to update SRC_CSV.
  goto error
)

echo [1/5] Copying master CSV from codex project (preserving mtime)...
rem xcopy preserves source mtime, unlike copy /Y, so unchanged data
rem produces byte-identical JSON downstream and avoids commit noise.
xcopy /Y /Q "%SRC_CSV%" "%DST_CSV%*" >nul || goto error
echo       OK
echo.

echo [2/5] Rebuilding JSON via scripts\build_data.py ...
python scripts\build_data.py
if errorlevel 1 goto error
echo.

echo [3/5] Staging changes...
git add data\registration_records_master.csv docs\assets\data
echo.

echo [4/5] Checking for changes...
git diff --cached --quiet
if not errorlevel 1 (
  echo       No data changes since last sync. Nothing to publish.
  goto done_no_change
)
git status --short
echo.
for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set "STAMP=%%c-%%a-%%b"
git commit -m "Refresh data (%STAMP%)" >nul
if errorlevel 1 goto error
echo       Commit created.
echo.

echo [5/5] Pushing to GitHub...
git push
if errorlevel 1 goto error
echo       Pushed. GitHub Pages will rebuild in 1-2 minutes.
echo.

:done_open
echo Opening %PAGES_URL% in your default browser...
start "" "%PAGES_URL%"
echo.
echo Done. Pages may take ~90s to reflect the new data.
echo Press any key to close.
pause >nul
exit /b 0

:done_no_change
echo.
echo Opening %PAGES_URL% in your default browser...
start "" "%PAGES_URL%"
echo.
echo Press any key to close.
pause >nul
exit /b 0

:error
echo.
echo *** SYNC FAILED at the previous step. ***
echo.
pause
exit /b 1
