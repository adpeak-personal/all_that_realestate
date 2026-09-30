@echo off
REM ============================================================
REM  DB tunnel keeper.
REM
REM  The collectors run on this machine but the database lives on another
REM  server. Opening MySQL (3306) to the internet for a home IP that keeps
REM  changing is a bad trade, so we forward it over SSH instead:
REM
REM    localhost:3307  ->  (DB server) 127.0.0.1:3306
REM
REM  Set MYSQL_HOST=127.0.0.1 and MYSQL_PORT=3307 in atb-program\.env
REM
REM  The loop matters: laptops sleep, wifi drops, the server reboots. Without
REM  it the tunnel dies once and every collection after that fails silently.
REM ============================================================

set DB_HOST=158.247.244.167
set DB_USER=root
set KEY=%USERPROFILE%\.sshtb_tunnel

:loop
echo [%date% %time%] connecting...
ssh -i "%KEY%" -N -T ^
    -o ExitOnForwardFailure=yes ^
    -o ServerAliveInterval=30 ^
    -o ServerAliveCountMax=3 ^
    -o StrictHostKeyChecking=accept-new ^
    -L 3307:127.0.0.1:3306 %DB_USER%@%DB_HOST%
echo [%date% %time%] disconnected. retrying in 15s...
timeout /t 15 /nobreak >/dev/null
goto loop
