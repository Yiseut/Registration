@echo off
setlocal
cd /d "%~dp0"
npx wrangler pages deploy docs --project-name chinaar --branch main --commit-dirty=true
pause
