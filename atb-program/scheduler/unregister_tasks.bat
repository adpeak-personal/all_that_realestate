@echo off
REM Remove all AllThat scheduled jobs. Code and data are not touched.

for %%T in ("AllThat\KaptSync" "AllThat\Geocode" "AllThat\PresaleSync") do (
  schtasks /Delete /F /TN %%T >nul 2>&1 && echo [removed] %%~T || echo [not found] %%~T
)
del /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\atb-db-tunnel.cmd" 2>nul && echo [removed] DB tunnel launcher
pause
