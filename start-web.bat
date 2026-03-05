@echo off
title APK Extractor - Web Interface
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║         APK EXTRACTOR  ^|  Interfaz Web              ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: Verificar si Node.js está instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Node.js no está instalado.
    echo.
    echo  Descarga e instala Node.js desde:
    echo    https://nodejs.org/
    echo.
    echo  Una vez instalado, vuelve a ejecutar este script.
    echo.
    pause
    exit /b 1
)

:: Instalar dependencias si no existen
if not exist "node_modules\express" (
    echo  Instalando dependencias...
    echo.
    call npm install --silent
    if %errorlevel% neq 0 (
        echo.
        echo  [!] Error al instalar dependencias.
        pause
        exit /b 1
    )
    echo  [OK] Dependencias instaladas.
    echo.
)

echo  Iniciando servidor en http://localhost:3000
echo  Presiona Ctrl+C para detener el servidor.
echo.

:: Abrir el navegador tras 1.5 segundos
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: Iniciar servidor
node server.js

pause
