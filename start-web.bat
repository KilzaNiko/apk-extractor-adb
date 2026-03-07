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

echo  Iniciando servidor en segundo plano...
echo  Se abrirá una interfaz web en unos segundos.
echo.

:: Crear un script VBS temporal para ejecutar node de forma invisible
set "VBS_FILE=%TEMP%\start_apk_extractor.vbs"
echo Set WshShell = CreateObject("WScript.Shell") > "%VBS_FILE%"
echo WshShell.Run "cmd.exe /c node ""%~dp0server.js""", 0, False >> "%VBS_FILE%"

:: Ejecutar el servidor en segundo plano
cscript //nologo "%VBS_FILE%"

:: Abrir el navegador
timeout /t 2 /nobreak >nul
start http://localhost:3000

:: Eliminar el script temporal
del "%VBS_FILE%"
exit
