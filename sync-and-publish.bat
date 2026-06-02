@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "SRC_CSV=E:\shared\code\registration\output\master\registration_records_master.csv"
set "DST_CSV=data\registration_records_master.csv"
set "PAGES_URL=https://yiseut.github.io/Registration/"
set "REMOTE_URL=https://github.com/Yiseut/Registration.git"

title Registration Landscape -- Publish Webpage
echo.
echo =====================================================
echo   Registration Landscape -- Publish Webpage
echo   %date% %time%
echo =====================================================
echo.
echo This will publish the integrated dashboard from the current master CSV,
echo commit webpage/data changes,
echo and push to:
echo   %REMOTE_URL%
echo.
echo It does NOT crawl WeChat, extract new leads, or run official verification.
echo.
echo The videos, output, test-results, and Playwright cache folders are excluded.
echo.
if /I "%AUTO_CONFIRM_PUSH%"=="1" (
  set "CONFIRM=PUSH"
  echo Auto-confirming publish because AUTO_CONFIRM_PUSH=1.
) else (
  set /p CONFIRM=Type PUSH to continue, or press Enter to cancel: 
)
if /I not "%CONFIRM%"=="PUSH" (
  echo.
  echo Cancelled. Nothing was changed or pushed.
  if /I not "%AUTO_PUBLISH_QUIET%"=="1" pause
  exit /b 0
)
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

echo [3/6] Ensuring GitHub publish repo is attached...
if not exist ".git" (
  git init || goto error
  git remote add origin "%REMOTE_URL%" || goto error
  git fetch origin main || goto error
  git checkout -B main || goto error
  git reset --mixed origin/main || goto error
) else (
  git remote get-url origin >nul 2>nul
  if errorlevel 1 git remote add origin "%REMOTE_URL%" || goto error
  git fetch origin main || goto error
  git checkout -B main || goto error
)
echo.

echo [4/6] Staging integrated site files...
git add -A .gitignore README.md PROJECT_HANDOFF.md Open-Dashboard.bat sync-and-publish.bat data docs scripts || goto error
git diff --cached --name-only | findstr /I /R "\\videos\\ \\output\\ \\test-results\\ \\.playwright-cli\\" >nul
if not errorlevel 1 (
  echo [ERROR] A generated or video folder was staged. Aborting before commit.
  git diff --cached --name-only
  goto error
)
echo.

echo [5/6] Checking for changes...
git diff --cached --quiet
if not errorlevel 1 (
  echo       No site changes since last sync. Nothing to publish.
  goto done_no_change
)
git status --short
echo.
for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set "STAMP=%%c-%%a-%%b"
git commit -m "Refresh integrated dashboard (%STAMP%)" >nul
if errorlevel 1 goto error
echo       Commit created.
echo.

echo [6/6] Pushing to GitHub...
git push -u origin main
if errorlevel 1 goto error
echo       Pushed. GitHub Pages will rebuild in 1-2 minutes.
echo.

:done_open
if /I "%AUTO_PUBLISH_QUIET%"=="1" (
  echo Done. Pages may take ~90s to reflect the new data.
  exit /b 0
)
echo Opening %PAGES_URL% in your default browser...
start "" "%PAGES_URL%"
echo.
echo Done. Pages may take ~90s to reflect the new data.
echo Press any key to close.
pause >nul
exit /b 0

:done_no_change
echo.
if /I "%AUTO_PUBLISH_QUIET%"=="1" (
  echo No site changes since last sync. Nothing to publish.
  exit /b 0
)
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
if /I not "%AUTO_PUBLISH_QUIET%"=="1" pause
exit /b 1
