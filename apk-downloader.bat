@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title APK Extractor - ADB Tool

:: ============================================================
::  APK Extractor - Powered by ADB
::  Extrae APKs de dispositivos Android conectados via USB
:: ============================================================

set "CONFIG_FILE=%~dp0config.txt"
set "ADB_EXE="

:: ----------------------------------------------------------------
:: INICIO: Verificar/Configurar ADB
:: ----------------------------------------------------------------
:CHECK_ADB
cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║            APK EXTRACTOR  ^|  ADB Tool               ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: 1. ¿Existe config.txt?
if exist "%CONFIG_FILE%" (
    set /p ADB_EXE=<"%CONFIG_FILE%"
    :: Verificar que el ejecutable todavía existe
    if exist "!ADB_EXE!" (
        goto MAIN_MENU
    ) else (
        echo  [!] La ruta guardada en config.txt ya no existe:
        echo      !ADB_EXE!
        echo.
        del "%CONFIG_FILE%" >nul 2>&1
        goto SETUP_ADB
    )
)

:: 2. ¿ADB está en el PATH del sistema?
where adb >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('where adb') do set "ADB_EXE=%%i"
    echo  [OK] ADB encontrado en el sistema: !ADB_EXE!
    echo !ADB_EXE!>"%CONFIG_FILE%"
    timeout /t 2 /nobreak >nul
    goto MAIN_MENU
)

:: 3. ¿Existe en C:\platform-tools?
if exist "C:\platform-tools\adb.exe" (
    set "ADB_EXE=C:\platform-tools\adb.exe"
    echo  [OK] ADB encontrado en C:\platform-tools
    echo !ADB_EXE!>"%CONFIG_FILE%"
    timeout /t 2 /nobreak >nul
    goto MAIN_MENU
)

:: ----------------------------------------------------------------
:SETUP_ADB
cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║            APK EXTRACTOR  ^|  Configuracion          ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  No se encontro ADB (Android Debug Bridge) en el sistema.
echo.
echo  ¿Qué deseas hacer?
echo.
echo  [1] Ingresar la ruta donde tengo ADB instalado
echo  [2] Descargar ADB ahora (se instalara en C:\platform-tools)
echo  [3] Salir
echo.
set /p SETUP_CHOICE="  Elige una opcion [1-3]: "

if "%SETUP_CHOICE%"=="1" goto MANUAL_PATH
if "%SETUP_CHOICE%"=="2" goto DOWNLOAD_ADB
if "%SETUP_CHOICE%"=="3" goto EXIT_SCRIPT
goto SETUP_ADB

:: ----------------------------------------------------------------
:MANUAL_PATH
echo.
echo  Ingresa la ruta completa a adb.exe
echo  Ejemplo: C:\Users\User\AppData\Local\Android\Sdk\platform-tools\adb.exe
echo.
set /p USER_ADB="  Ruta: "
if not exist "%USER_ADB%" (
    echo.
    echo  [!] El archivo no existe en esa ruta. Intenta de nuevo.
    pause
    goto MANUAL_PATH
)
set "ADB_EXE=%USER_ADB%"
echo %ADB_EXE%>"%CONFIG_FILE%"
echo.
echo  [OK] Ruta guardada correctamente.
timeout /t 2 /nobreak >nul
goto MAIN_MENU

:: ----------------------------------------------------------------
:DOWNLOAD_ADB
cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║            APK EXTRACTOR  ^|  Descargando ADB        ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Descargando Android Platform Tools desde Google...
echo  URL: https://dl.google.com/android/repository/platform-tools-latest-windows.zip
echo.

:: Verificar curl disponible
where curl >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] curl no esta disponible. Intentando con PowerShell...
    powershell -Command "Invoke-WebRequest -Uri 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip' -OutFile '%TEMP%\platform-tools.zip'" 2>&1
    if %errorlevel% neq 0 (
        echo  [!] Error al descargar. Verifica tu conexion a internet.
        pause
        goto SETUP_ADB
    )
    goto EXTRACT_ADB
)

curl -L -o "%TEMP%\platform-tools.zip" "https://dl.google.com/android/repository/platform-tools-latest-windows.zip" --progress-bar
if %errorlevel% neq 0 (
    echo.
    echo  [!] Error al descargar el archivo. Verifica tu conexion a internet.
    pause
    goto SETUP_ADB
)

:EXTRACT_ADB
echo.
echo  Extrayendo archivos en C:\...
echo.

:: Eliminar carpeta previa si existe
if exist "C:\platform-tools" (
    echo  Eliminando instalacion anterior...
    rd /s /q "C:\platform-tools" >nul 2>&1
)

:: Extraer con tar (disponible desde Windows 10 1803+)
where tar >nul 2>&1
if %errorlevel%==0 (
    tar -xf "%TEMP%\platform-tools.zip" -C "C:\" >nul 2>&1
) else (
    :: Fallback: PowerShell
    powershell -Command "Expand-Archive -Path '%TEMP%\platform-tools.zip' -DestinationPath 'C:\' -Force" 2>&1
)

if not exist "C:\platform-tools\adb.exe" (
    echo  [!] No se pudo extraer correctamente. Intenta descomprimir manualmente en C:\
    echo      Archivo: %TEMP%\platform-tools.zip
    pause
    goto SETUP_ADB
)

set "ADB_EXE=C:\platform-tools\adb.exe"
echo %ADB_EXE%>"%CONFIG_FILE%"
echo.
echo  [OK] ADB instalado correctamente en C:\platform-tools
echo  [OK] Ruta guardada en configuracion.
del "%TEMP%\platform-tools.zip" >nul 2>&1
timeout /t 3 /nobreak >nul
goto MAIN_MENU

:: ================================================================
::  MENU PRINCIPAL
:: ================================================================
:MAIN_MENU
cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║            APK EXTRACTOR  ^|  Menu Principal         ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  ADB: %ADB_EXE%
echo.
echo  [1] Listar dispositivos conectados
echo  [2] Depuracion inalambrica (WiFi)
echo  [3] Dispositivos guardados
echo  [4] Cambiar ruta de ADB
echo  [5] Salir
echo.
set /p MAIN_CHOICE="  Elige una opcion [1-5]: "

if "%MAIN_CHOICE%"=="1" goto LIST_DEVICES
if "%MAIN_CHOICE%"=="2" goto WIRELESS_MENU
if "%MAIN_CHOICE%"=="3" goto SAVED_DEVICES_MENU
if "%MAIN_CHOICE%"=="4" (
    del "%CONFIG_FILE%" >nul 2>&1
    goto SETUP_ADB
)
if "%MAIN_CHOICE%"=="5" goto EXIT_SCRIPT
goto MAIN_MENU

:: ================================================================
::  LISTAR DISPOSITIVOS
:: ================================================================
:LIST_DEVICES
cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║            APK EXTRACTOR  ^|  Dispositivos           ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Buscando dispositivos conectados...
echo.

:: Recolectar seriales — usar temp file con tab delimiter para soportar mDNS
set DEVICE_COUNT=0
set "TMP_DEVLIST=%TEMP%\apk_devices.tmp"
"%ADB_EXE%" devices 2>nul > "%TMP_DEVLIST%"

:: Leer el archivo de nombres si existe
set "NAMES_FILE=%~dp0device-names.json"

for /f "skip=1 usebackq delims=" %%L in ("%TMP_DEVLIST%") do (
    set "LINE=%%L"
    if not "!LINE!"=="" (
        :: Verificar que la linea contiene 'device' (no 'unauthorized' etc)
        echo !LINE! | findstr /c:"	device" >nul 2>&1
        if !errorlevel!==0 (
            :: Extraer serial (todo antes del tab)
            for /f "delims=	" %%s in ("!LINE!") do (
                set /a DEVICE_COUNT+=1
                set "DEVICE_!DEVICE_COUNT!=%%s"
                :: Buscar nombre personalizado
                set "DEVNAME_!DEVICE_COUNT!="
                if exist "!NAMES_FILE!" (
                    for /f "usebackq delims=" %%n in (`findstr /c:"\"%%s\"" "!NAMES_FILE!" 2^>nul`) do (
                        set "NMATCH=%%n"
                        for /f "tokens=2 delims=:" %%v in ("!NMATCH!") do (
                            set "NVAL=%%v"
                            set "NVAL=!NVAL: =!"
                            set "NVAL=!NVAL:"=!"
                            set "NVAL=!NVAL:,=!"
                            if not "!NVAL!"=="" set "DEVNAME_!DEVICE_COUNT!=!NVAL!"
                        )
                    )
                )
            )
        )
    )
)
del "%TMP_DEVLIST%" >nul 2>&1

if %DEVICE_COUNT%==0 (
    echo  No se encontraron dispositivos conectados.
    echo.
    echo  Asegurate de que:
    echo   - El cable USB este bien conectado
    echo   - La depuracion USB este activada en el dispositivo
    echo   - El dispositivo haya autorizado esta PC
    echo   - O conectate por WiFi desde la opcion 2 del menu principal
    echo.
    pause
    goto MAIN_MENU
)

echo  Dispositivos encontrados: %DEVICE_COUNT%
echo.
for /l %%i in (1,1,%DEVICE_COUNT%) do (
    if defined DEVNAME_%%i (
        echo  [%%i] !DEVNAME_%%i!  (!DEVICE_%%i!)
    ) else (
        echo  [%%i] !DEVICE_%%i!
    )
)
echo.
echo  [0] Volver al menu principal
echo.
set /p DEV_CHOICE="  Selecciona un dispositivo [0-%DEVICE_COUNT%]: "

if "%DEV_CHOICE%"=="0" goto MAIN_MENU

:: Validar seleccion
set "SELECTED_SERIAL="
for /l %%i in (1,1,%DEVICE_COUNT%) do (
    if "%DEV_CHOICE%"=="%%i" set "SELECTED_SERIAL=!DEVICE_%%i!"
)

if "%SELECTED_SERIAL%"=="" (
    echo  [!] Opcion invalida.
    pause
    goto LIST_DEVICES
)

set "CURRENT_DEVICE=%SELECTED_SERIAL%"
goto DEVICE_MENU

:: ================================================================
::  MENU DEL DISPOSITIVO
:: ================================================================
:DEVICE_MENU
cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║            APK EXTRACTOR  ^|  Dispositivo            ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: Obtener info del dispositivo
for /f "tokens=*" %%a in ('"%ADB_EXE%" -s "%CURRENT_DEVICE%" shell getprop ro.product.manufacturer 2^>nul') do set "DEV_BRAND=%%a"
for /f "tokens=*" %%a in ('"%ADB_EXE%" -s "%CURRENT_DEVICE%" shell getprop ro.product.model 2^>nul') do set "DEV_MODEL=%%a"
for /f "tokens=*" %%a in ('"%ADB_EXE%" -s "%CURRENT_DEVICE%" shell getprop ro.build.version.release 2^>nul') do set "DEV_ANDROID=%%a"
for /f "tokens=*" %%a in ('"%ADB_EXE%" -s "%CURRENT_DEVICE%" shell getprop ro.build.version.sdk 2^>nul') do set "DEV_SDK=%%a"

:: Buscar nombre personalizado
set "DEV_CUSTOM_NAME="
set "NAMES_FILE=%~dp0device-names.json"
if exist "!NAMES_FILE!" (
    for /f "usebackq delims=" %%n in (`findstr /c:"\"!CURRENT_DEVICE!\"" "!NAMES_FILE!" 2^>nul`) do (
        set "NMATCH=%%n"
        for /f "tokens=2 delims=:" %%v in ("!NMATCH!") do (
            set "NVAL=%%v"
            set "NVAL=!NVAL: =!"
            set "NVAL=!NVAL:"=!"
            set "NVAL=!NVAL:,=!"
            if not "!NVAL!"=="" set "DEV_CUSTOM_NAME=!NVAL!"
        )
    )
)

if defined DEV_CUSTOM_NAME (
    echo  Nombre   : !DEV_CUSTOM_NAME!
)
echo  Serial   : %CURRENT_DEVICE%
echo  Marca    : %DEV_BRAND%
echo  Modelo   : %DEV_MODEL%
echo  Android  : %DEV_ANDROID%  (API %DEV_SDK%)
echo.
echo  ┌─────────────────────────────────────────────────────┐
echo  │  ¿Qué deseas hacer?                                 │
echo  └─────────────────────────────────────────────────────┘
echo.
echo  [1] Listar aplicaciones instaladas
echo  [2] Asignar nombre al dispositivo
echo  [3] Volver a la lista de dispositivos
echo  [4] Volver al menu principal
echo.
set /p DEV_MENU_CHOICE="  Elige una opcion [1-4]: "

if "%DEV_MENU_CHOICE%"=="1" goto LIST_APPS
if "%DEV_MENU_CHOICE%"=="2" goto RENAME_DEVICE
if "%DEV_MENU_CHOICE%"=="3" goto LIST_DEVICES
if "%DEV_MENU_CHOICE%"=="4" goto MAIN_MENU
goto DEVICE_MENU

:: ================================================================
::  RENOMBRAR DISPOSITIVO
:: ================================================================
:RENAME_DEVICE
echo.
if defined DEV_CUSTOM_NAME (
    echo  Nombre actual: !DEV_CUSTOM_NAME!
)
echo  Ingresa el nuevo nombre (dejar vacio para eliminar):
echo.
set "NEW_DEV_NAME="
set /p NEW_DEV_NAME="  Nombre: "

set "NAMES_FILE=%~dp0device-names.json"

:: Leer nombres existentes y reescribir
set "NCOUNT=0"
set "FOUND_SERIAL=0"
if exist "!NAMES_FILE!" (
    for /f "usebackq delims=" %%L in ("!NAMES_FILE!") do (
        set "NLINE=%%L"
        :: Ignorar llaves
        echo !NLINE! | findstr /c:"{" >nul 2>&1 && set "NLINE="
        echo !NLINE! | findstr /c:"}" >nul 2>&1 && set "NLINE="
        if defined NLINE (
            echo !NLINE! | findstr /c:"\"!CURRENT_DEVICE!\"" >nul 2>&1
            if !errorlevel!==0 (
                set "FOUND_SERIAL=1"
            ) else (
                set /a NCOUNT+=1
                set "NENTRY_!NCOUNT!=!NLINE!"
            )
        )
    )
)

:: Reconstruir JSON
(
echo {
if defined NEW_DEV_NAME (
    if not "%NEW_DEV_NAME%"=="" (
        set /a NCOUNT+=1
        set "NENTRY_!NCOUNT!=\"!CURRENT_DEVICE!\": \"!NEW_DEV_NAME!\""
    )
)
set "NWRITTEN=0"
for /l %%i in (1,1,!NCOUNT!) do (
    set /a NWRITTEN+=1
    set "ENTRY=!NENTRY_%%i!"
    :: Limpiar comas trailing
    set "ENTRY=!ENTRY:,=!"
    if !NWRITTEN! lss !NCOUNT! (
        echo   !ENTRY!,
    ) else (
        echo   !ENTRY!
    )
)
echo }
) > "!NAMES_FILE!"

if defined NEW_DEV_NAME (
    if not "%NEW_DEV_NAME%"=="" (
        echo.
        echo  [OK] Dispositivo renombrado a: %NEW_DEV_NAME%
    ) else (
        echo.
        echo  [OK] Nombre eliminado.
    )
) else (
    echo.
    echo  [OK] Nombre eliminado.
)
timeout /t 2 /nobreak >nul
goto DEVICE_MENU

:: ================================================================
::  LISTAR APLICACIONES
:: ================================================================
:LIST_APPS
cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║            APK EXTRACTOR  ^|  Aplicaciones           ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Dispositivo: %DEV_BRAND% %DEV_MODEL%  [%CURRENT_DEVICE%]
echo.
echo  ¿Qué aplicaciones deseas listar?
echo.
echo  [1] Solo aplicaciones de terceros (instaladas por el usuario)
echo  [2] Todas las aplicaciones (incluye sistema)
echo  [0] Volver
echo.
set /p APP_FILTER_CHOICE="  Elige una opcion [0-2]: "

if "%APP_FILTER_CHOICE%"=="0" goto DEVICE_MENU
if "%APP_FILTER_CHOICE%"=="1" (
    set "PM_FLAGS=-3"
    set "APP_TYPE=de terceros"
)
if "%APP_FILTER_CHOICE%"=="2" (
    set "PM_FLAGS="
    set "APP_TYPE=todas"
)
if not "%APP_FILTER_CHOICE%"=="1" if not "%APP_FILTER_CHOICE%"=="2" goto LIST_APPS

cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║            APK EXTRACTOR  ^|  Aplicaciones           ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Dispositivo: %DEV_BRAND% %DEV_MODEL%
echo  Tipo       : Aplicaciones %APP_TYPE%
echo.
echo  Cargando lista (esto puede tardar unos segundos)...
echo.

:: Guardar lista en archivo temporal
set "TMP_PKG=%TEMP%\apk_packages.tmp"
"%ADB_EXE%" -s "%CURRENT_DEVICE%" shell pm list packages %PM_FLAGS% 2>nul | findstr "package:" > "%TMP_PKG%"

:: Contar paquetes
set PKG_COUNT=0
for /f %%a in ('type "%TMP_PKG%" ^| find /c "package:"') do set PKG_COUNT=%%a

if %PKG_COUNT%==0 (
    echo  No se encontraron aplicaciones.
    pause
    goto DEVICE_MENU
)

:: Crear lista indexada con nombre, formato y tamaño
:: Formato: INDEX:PACKAGE:FORMAT:SIZE_KB
set "TMP_IDX=%TEMP%\apk_index.tmp"
if exist "%TMP_IDX%" del "%TMP_IDX%"
set "TMP_NAMES=%TEMP%\apk_names.tmp"
if exist "%TMP_NAMES%" del "%TMP_NAMES%"

echo  Detectando formato y tamaño de cada app...
echo  (Las apps del sistema pueden tardar mas)
echo.

set APP_INDEX=0
for /f "tokens=2 delims=:" %%p in ('type "%TMP_PKG%"') do (
    set /a APP_INDEX+=1
    set "CPKG=%%p"

    :: Contar APKs y calcular tamaño total en el dispositivo
    set "APKC=0"
    set "APKSZ=0"
    for /f "tokens=2 delims=:" %%r in ('"%ADB_EXE%" -s "%CURRENT_DEVICE%" shell pm path !CPKG! 2^>nul') do (
        set /a APKC+=1
        :: Obtener tamaño de cada APK
        for /f "tokens=5" %%s in ('"%ADB_EXE%" -s "%CURRENT_DEVICE%" shell stat -c "%%s" %%r 2^>nul') do (
            set /a APKSZ+=%%s/1024
        )
    )

    :: Determinar formato
    set "FMT=APK"
    if !APKC! gtr 1 set "FMT=Split-APK"
    if !APKC!==0 set "FMT=N/A"

    :: Convertir KB a MB si es grande
    set "SZLABEL=!APKSZ! KB"
    if !APKSZ! geq 1024 (
        set /a SZMB=!APKSZ!/1024
        set "SZLABEL=!SZMB! MB"
    )

    echo !APP_INDEX!:!CPKG!:!FMT!:!SZLABEL!>>"%TMP_IDX%"
)

echo  Total de aplicaciones: %APP_INDEX%
echo.

:: Mostrar en páginas de 15
set "PAGE=1"
set "PAGE_SIZE=15"
goto SHOW_PAGE

:SHOW_PAGE
cls
echo.
echo  ╔══════════════════════════════════════════════════════════════════════╗
echo  ║            APK EXTRACTOR  ^|  Aplicaciones                          ║
echo  ╚══════════════════════════════════════════════════════════════════════╝
echo.
echo  Dispositivo: %DEV_BRAND% %DEV_MODEL%  ^|  Total: %APP_INDEX% apps
echo.
echo  Num  Paquete                                    Formato     Tamaño
echo  ───  ─────────────────────────────────────────  ──────────  ──────────
echo.

set /a "PAGE_START=(%PAGE%-1)*%PAGE_SIZE%+1"
set /a "PAGE_END=%PAGE%*%PAGE_SIZE%"
if %PAGE_END% gtr %APP_INDEX% set PAGE_END=%APP_INDEX%

for /f "tokens=1,2,3,4 delims=:" %%a in ('type "%TMP_IDX%"') do (
    set "NUM=%%a"
    set "PKG=%%b"
    set "FMT=%%c"
    set "SZ=%%d"
    if !NUM! geq %PAGE_START% if !NUM! leq %PAGE_END% (
        :: Formatear con padding
        set "PADPKG=%%b                                         "
        set "PADPKG=!PADPKG:~0,43!"
        set "PADFMT=%%c          "
        set "PADFMT=!PADFMT:~0,10!"
        echo  [%%a] !PADPKG! !PADFMT! %%d
    )
)

echo.
set /a "TOTAL_PAGES=(%APP_INDEX%+%PAGE_SIZE%-1)/%PAGE_SIZE%"
echo  Pagina %PAGE% de %TOTAL_PAGES%
echo.
echo  Ingresa el numero de la app para ver detalles.
if %PAGE% gtr 1 echo  [A] Pagina anterior
if %PAGE% lss %TOTAL_PAGES% echo  [S] Pagina siguiente
echo  [0] Volver
echo.
set /p APP_CHOICE="  Seleccion: "

if /i "%APP_CHOICE%"=="0" goto DEVICE_MENU
if /i "%APP_CHOICE%"=="A" (
    if %PAGE% gtr 1 (
        set /a PAGE-=1
        goto SHOW_PAGE
    )
    goto SHOW_PAGE
)
if /i "%APP_CHOICE%"=="S" (
    if %PAGE% lss %TOTAL_PAGES% (
        set /a PAGE+=1
        goto SHOW_PAGE
    )
    goto SHOW_PAGE
)

:: Buscar el paquete seleccionado
set "SELECTED_PKG="
for /f "tokens=1,2 delims=:" %%a in ('type "%TMP_IDX%"') do (
    if "%%a"=="%APP_CHOICE%" set "SELECTED_PKG=%%b"
)

if "%SELECTED_PKG%"=="" (
    echo  [!] Numero invalido.
    pause
    goto SHOW_PAGE
)

goto APP_DETAIL

:: ================================================================
::  DETALLE DE APLICACION
:: ================================================================
:APP_DETAIL
cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║            APK EXTRACTOR  ^|  Detalle de App         ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Dispositivo : %DEV_BRAND% %DEV_MODEL%
echo  Paquete     : %SELECTED_PKG%
echo.
echo  Obteniendo informacion...
echo.

:: Obtener version
for /f "tokens=2 delims== " %%v in ('"%ADB_EXE%" -s "%CURRENT_DEVICE%" shell dumpsys package %SELECTED_PKG% 2^>nul ^| findstr "versionName"') do (
    if not defined APP_VERSION set "APP_VERSION=%%v"
)
if not defined APP_VERSION set "APP_VERSION=Desconocida"

for /f "tokens=2 delims== " %%v in ('"%ADB_EXE%" -s "%CURRENT_DEVICE%" shell dumpsys package %SELECTED_PKG% 2^>nul ^| findstr "versionCode"') do (
    if not defined APP_VCODE set "APP_VCODE=%%v"
)
if not defined APP_VCODE set "APP_VCODE=Desconocido"

:: Obtener ruta(s) del APK y guardarlas
set "TMP_PATHS=%TEMP%\apk_paths.tmp"
"%ADB_EXE%" -s "%CURRENT_DEVICE%" shell pm path %SELECTED_PKG% 2>nul > "%TMP_PATHS%"

:: Contar cuantos archivos APK existen
set APK_PATH_COUNT=0
for /f %%x in ('type "%TMP_PATHS%" ^| find /c "package:"') do set APK_PATH_COUNT=%%x

:: Obtener nombre de la app (label)
set "APP_LABEL="
for /f "tokens=*" %%L in ('"%ADB_EXE%" -s "%CURRENT_DEVICE%" shell dumpsys package %SELECTED_PKG% 2^>nul ^| findstr "applicationInfo" ^| findstr "label="') do (
    if not defined APP_LABEL (
        for /f "tokens=* delims= " %%X in ("%%L") do set "APP_LABEL=%%X"
    )
)

cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║            APK EXTRACTOR  ^|  Detalle de App         ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Dispositivo : %DEV_BRAND% %DEV_MODEL%
echo  Paquete     : %SELECTED_PKG%
echo  Version     : %APP_VERSION%  (Code: %APP_VCODE%)
echo  Archivos APK: %APK_PATH_COUNT%
echo.

if %APK_PATH_COUNT%==0 (
    echo  ╔══════════════════════════════════════════════════════╗
    echo  ║  [!] ERROR: No se pudo obtener la ruta del APK      ║
    echo  ║  La aplicacion puede ser del sistema sin acceso     ║
    echo  ╚══════════════════════════════════════════════════════╝
    echo.
    set "APP_VERSION="
    set "APP_VCODE="
    pause
    goto SHOW_PAGE
)

if %APK_PATH_COUNT% gtr 1 (
    echo  ┌──────────────────────────────────────────────────────┐
    echo  │  [!]  SPLIT APK / XAPK detectado                    │
    echo  │                                                      │
    echo  │  Esta app contiene %APK_PATH_COUNT% archivos APK separados.          │
    echo  │  Los archivos son:                                   │
    echo  └──────────────────────────────────────────────────────┘
    echo.
    for /f "tokens=2 delims=:" %%p in ('type "%TMP_PATHS%"') do (
        echo    - %%p
    )
    echo.
    echo  ┌─────────────────────────────────────────────────────┐
    echo  │  ¿Qué deseas hacer?                                 │
    echo  └─────────────────────────────────────────────────────┘
    echo.
    echo  [1] Compilar los %APK_PATH_COUNT% APKs en un archivo XAPK
    echo  [0] Volver a la lista
    echo.
    set /p SPLIT_CHOICE="  Elige una opcion [0-1]: "
    if "!SPLIT_CHOICE!"=="1" goto COMPILE_XAPK
    set "APP_VERSION="
    set "APP_VCODE="
    goto SHOW_PAGE
)

:: Es un APK simple - obtener la ruta
for /f "tokens=2 delims=:" %%p in ('type "%TMP_PATHS%"') do set "APK_DEVICE_PATH=%%p"
:: Limpiar espacios/CR
set "APK_DEVICE_PATH=%APK_DEVICE_PATH: =%"

echo  Ruta en dispositivo:
echo    %APK_DEVICE_PATH%
echo.
echo  ┌─────────────────────────────────────────────────────┐
echo  │  ¿Qué deseas hacer?                                 │
echo  └─────────────────────────────────────────────────────┘
echo.
echo  [1] Extraer APK a esta PC
echo  [0] Volver a la lista de aplicaciones
echo.
set /p DETAIL_CHOICE="  Elige una opcion [0-1]: "

if "%DETAIL_CHOICE%"=="0" (
    set "APP_VERSION="
    set "APP_VCODE="
    goto SHOW_PAGE
)
if "%DETAIL_CHOICE%"=="1" goto EXTRACT_APK
goto APP_DETAIL

:: ================================================================
::  EXTRAER APK (simple)
:: ================================================================
:EXTRACT_APK
echo.
echo  ┌─────────────────────────────────────────────────────┐
echo  Carpeta de destino (Enter para usar el escritorio):
set /p DEST_FOLDER="  > "
if "%DEST_FOLDER%"=="" set "DEST_FOLDER=%USERPROFILE%\Desktop"

if not exist "%DEST_FOLDER%" (
    mkdir "%DEST_FOLDER%" >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo  [!] No se pudo crear la carpeta: %DEST_FOLDER%
        pause
        goto APP_DETAIL
    )
)

set "APK_OUT_FILE=%DEST_FOLDER%\%SELECTED_PKG%.apk"

echo.
echo  Extrayendo APK...
echo  Destino: %APK_OUT_FILE%
echo.

"%ADB_EXE%" -s "%CURRENT_DEVICE%" pull "%APK_DEVICE_PATH%" "%APK_OUT_FILE%"

if exist "%APK_OUT_FILE%" (
    echo.
    echo  ╔══════════════════════════════════════════════════════╗
    echo  ║  [OK] APK extraido exitosamente!                    ║
    echo  ╚══════════════════════════════════════════════════════╝
    echo.
    echo  Archivo guardado en:
    echo    %APK_OUT_FILE%
    echo.
    :: Abrir la carpeta de destino
    explorer "%DEST_FOLDER%"
) else (
    echo.
    echo  ╔══════════════════════════════════════════════════════╗
    echo  ║  [!] ERROR al extraer el APK                        ║
    echo  ║  Verifica que tengas permisos en la carpeta         ║
    echo  ║  destino y que el APK no este protegido.            ║
    echo  ╚══════════════════════════════════════════════════════╝
    echo.
)

set "APP_VERSION="
set "APP_VCODE="
pause
goto SHOW_PAGE

:: ================================================================
::  COMPILAR XAPK (multiples APKs -> un .xapk)
:: ================================================================
:COMPILE_XAPK
cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║            APK EXTRACTOR  ^|  Compilar XAPK          ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Paquete: %SELECTED_PKG%
echo  Partes : %APK_PATH_COUNT% archivos APK
echo.
echo  Carpeta de destino (Enter para usar el escritorio):
set /p XAPK_DEST="  > "
if "%XAPK_DEST%"=="" set "XAPK_DEST=%USERPROFILE%\Desktop"

if not exist "%XAPK_DEST%" (
    mkdir "%XAPK_DEST%" >nul 2>&1
)

:: Carpeta temporal para ensamblar el XAPK
set "TMP_XAPK_DIR=%TEMP%\xapk_build_%SELECTED_PKG%"
if exist "%TMP_XAPK_DIR%" rd /s /q "%TMP_XAPK_DIR%" >nul 2>&1
mkdir "%TMP_XAPK_DIR%"

echo.
echo  Paso 1/3: Extrayendo APKs del dispositivo...
echo.

:: Extraer cada APK y renombrarlo para el XAPK
set "PART_NUM=0"
for /f "tokens=2 delims=:" %%p in ('type "%TMP_PATHS%"') do (
    set "REMOTE_PATH=%%p"
    :: Limpiar espacios y CR
    set "REMOTE_PATH=!REMOTE_PATH: =!"

    :: Obtener nombre del archivo en el dispositivo
    for /f "tokens=* delims=/" %%f in ("!REMOTE_PATH!") do set "APK_FNAME=%%f"
    :: Limpiar CR del nombre
    set "APK_FNAME=!APK_FNAME:~0,-1!"
    if "!APK_FNAME!"=="" set "APK_FNAME=split_!PART_NUM!.apk"

    echo    Extrayendo: !APK_FNAME!
    "%ADB_EXE%" -s "%CURRENT_DEVICE%" pull "!REMOTE_PATH!" "%TMP_XAPK_DIR%\!APK_FNAME!" >nul 2>&1

    if exist "%TMP_XAPK_DIR%\!APK_FNAME!" (
        echo    [OK] !APK_FNAME!
    ) else (
        echo    [!] Fallo: !APK_FNAME!
    )
    set /a PART_NUM+=1
)

echo.
echo  Paso 2/3: Creando manifest.json...

:: Obtener info para el manifest
for /f "tokens=2 delims== " %%v in ('"%ADB_EXE%" -s "%CURRENT_DEVICE%" shell dumpsys package %SELECTED_PKG% 2^>nul ^| findstr "versionName"') do (
    if not defined XAPK_VER set "XAPK_VER=%%v"
)
if not defined XAPK_VER set "XAPK_VER=1.0"
for /f "tokens=2 delims== " %%v in ('"%ADB_EXE%" -s "%CURRENT_DEVICE%" shell dumpsys package %SELECTED_PKG% 2^>nul ^| findstr "versionCode"') do (
    if not defined XAPK_VCODE set "XAPK_VCODE=%%v"
)
if not defined XAPK_VCODE set "XAPK_VCODE=1"

:: Min SDK del dispositivo como referencia
set "MIN_SDK=21"
for /f "tokens=2 delims== " %%v in ('"%ADB_EXE%" -s "%CURRENT_DEVICE%" shell dumpsys package %SELECTED_PKG% 2^>nul ^| findstr "minSdk"') do (
    if not defined MIN_SDK set "MIN_SDK=%%v"
)

:: Construir lista de splits para el manifest
set "SPLITS_JSON="
for /f "tokens=*" %%f in ('dir /b "%TMP_XAPK_DIR%\*.apk" 2^>nul') do (
    set "FNAME=%%f"
    for /f "tokens=1 delims=." %%n in ("%%f") do set "FBASE=%%n"
    if "!SPLITS_JSON!"=="" (
        set "SPLITS_JSON={\"file\":\"!FNAME!\",\"id\":\"!FBASE!\"}"
    ) else (
        set "SPLITS_JSON=!SPLITS_JSON!,{\"file\":\"!FNAME!\",\"id\":\"!FBASE!\"}"
    )
)

:: Escribir manifest.json
(
echo {
echo   "xapk_version": 2,
echo   "package_name": "%SELECTED_PKG%",
echo   "name": "%SELECTED_PKG%",
echo   "version_code": "%XAPK_VCODE%",
echo   "version_name": "%XAPK_VER%",
echo   "min_sdk_version": "%MIN_SDK%",
echo   "target_sdk_version": "34",
echo   "split_apks": [%SPLITS_JSON%],
echo   "expansions": []
echo }
) > "%TMP_XAPK_DIR%\manifest.json"

echo    [OK] manifest.json creado

echo.
echo  Paso 3/3: Empaquetando en XAPK...

set "XAPK_OUT=%XAPK_DEST%\%SELECTED_PKG%.xapk"

:: El XAPK es un ZIP renombrado - usamos PowerShell Compress-Archive
powershell -Command "Compress-Archive -Path '%TMP_XAPK_DIR%\*' -DestinationPath '%XAPK_OUT%.zip' -Force" 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [!] Error al comprimir. Intentando con tar...
    tar -a -c -f "%XAPK_OUT%.zip" -C "%TMP_XAPK_DIR%" . >nul 2>&1
)

:: Renombrar .zip a .xapk
if exist "%XAPK_OUT%.zip" (
    if exist "%XAPK_OUT%" del "%XAPK_OUT%"
    rename "%XAPK_OUT%.zip" "%SELECTED_PKG%.xapk" >nul 2>&1
)

:: Limpiar temporal
rd /s /q "%TMP_XAPK_DIR%" >nul 2>&1

set "XAPK_VER="
set "XAPK_VCODE="
set "MIN_SDK="
set "SPLITS_JSON="

if exist "%XAPK_OUT%" (
    echo.
    echo  ╔══════════════════════════════════════════════════════╗
    echo  ║  [OK] XAPK compilado exitosamente!                  ║
    echo  ╚══════════════════════════════════════════════════════╝
    echo.
    echo  Archivo: %XAPK_OUT%
    echo.
    echo  Puedes instalar el .xapk con:
    echo    - XAPK Installer (APKPure)
    echo    - APKMirror Installer
    echo    - Mediante SAI (Split APKs Installer)
    echo.
    explorer "%XAPK_DEST%"
) else (
    echo.
    echo  ╔══════════════════════════════════════════════════════╗
    echo  ║  [!] ERROR al crear el XAPK                         ║
    echo  ║  Verifica permisos en la carpeta de destino         ║
    echo  ╚══════════════════════════════════════════════════════╝
    echo.
)

set "APP_VERSION="
set "APP_VCODE="
pause
goto SHOW_PAGE

:: ================================================================
::  DEPURACION INALAMBRICA
:: ================================================================
:WIRELESS_MENU
cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║            APK EXTRACTOR  ^|  WiFi Debug             ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Para conectar un dispositivo por WiFi necesitas:
echo.
echo  1. Activar "Depuracion inalambrica" en el dispositivo
echo  2. Obtener la IP, puerto de vinculacion y codigo de 6 digitos
echo  3. Obtener el puerto de conexion
echo.
echo  ┌─────────────────────────────────────────────────────┐
echo  │  Paso 1: Emparejamiento                             │
echo  └─────────────────────────────────────────────────────┘
echo.
set /p WIFI_IP="  IP del dispositivo: "
set /p WIFI_PAIR_PORT="  Puerto de vinculacion: "
set /p WIFI_CODE="  Codigo de vinculacion (6 digitos): "
echo.
echo  Emparejando con %WIFI_IP%:%WIFI_PAIR_PORT%...
echo.

"%ADB_EXE%" pair %WIFI_IP%:%WIFI_PAIR_PORT% %WIFI_CODE% 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [!] Error al emparejar. Verifica los datos e intenta de nuevo.
    pause
    goto WIRELESS_MENU
)
echo.
echo  [OK] Emparejamiento exitoso.
echo.
echo  ┌─────────────────────────────────────────────────────┐
echo  │  Paso 2: Conexion                                   │
echo  └─────────────────────────────────────────────────────┘
echo.
set /p WIFI_CONN_PORT="  Puerto de conexion: "
echo.
echo  Conectando a %WIFI_IP%:%WIFI_CONN_PORT%...
echo.

"%ADB_EXE%" connect %WIFI_IP%:%WIFI_CONN_PORT% 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [!] Error al conectar. Verifica el puerto e intenta de nuevo.
    pause
    goto WIRELESS_MENU
)
echo.
echo  [OK] Conectado exitosamente a %WIFI_IP%:%WIFI_CONN_PORT%
echo.

:: Guardar dispositivo en devices.json
set "DEV_FILE=%~dp0devices.json"
set "SAVE_LABEL=%WIFI_IP%:%WIFI_CONN_PORT%"

:: Intentar obtener marca/modelo
for /f "tokens=*" %%a in ('"%ADB_EXE%" -s "%WIFI_IP%:%WIFI_CONN_PORT%" shell getprop ro.product.manufacturer 2^>nul') do set "WF_BRAND=%%a"
for /f "tokens=*" %%a in ('"%ADB_EXE%" -s "%WIFI_IP%:%WIFI_CONN_PORT%" shell getprop ro.product.model 2^>nul') do set "WF_MODEL=%%a"
if defined WF_BRAND if defined WF_MODEL set "SAVE_LABEL=!WF_BRAND! !WF_MODEL!"

:: Agregar a devices.json (append simple)
if not exist "!DEV_FILE!" echo [] > "!DEV_FILE!"

:: Usar PowerShell para manipular JSON
powershell -Command "$f='!DEV_FILE!';$d=Get-Content $f -Raw|ConvertFrom-Json;$exists=$d|Where-Object{$_.ip -eq '!WIFI_IP!'};if($exists){$exists.port='!WIFI_CONN_PORT!';$exists.lastConnected=(Get-Date -Format o);$exists.label='!SAVE_LABEL!'}else{$d+=[pscustomobject]@{id=[string](Get-Date -UFormat '%%s');label='!SAVE_LABEL!';ip='!WIFI_IP!';port='!WIFI_CONN_PORT!';lastConnected=(Get-Date -Format o)}};$d|ConvertTo-Json -Depth 5|Set-Content $f" 2>nul

echo  [OK] Dispositivo guardado para reconexion futura.
echo.
pause
goto MAIN_MENU

:: ================================================================
::  DISPOSITIVOS GUARDADOS
:: ================================================================
:SAVED_DEVICES_MENU
cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║            APK EXTRACTOR  ^|  Dispositivos Guardados ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

set "DEV_FILE=%~dp0devices.json"
if not exist "!DEV_FILE!" (
    echo  No hay dispositivos guardados.
    echo.
    echo  Conecta un dispositivo por WiFi (opcion 2) para guardarlo.
    echo.
    pause
    goto MAIN_MENU
)

:: Leer dispositivos guardados con PowerShell
set SAVED_COUNT=0
for /f "usebackq delims=" %%L in (`powershell -Command "$d=Get-Content '!DEV_FILE!' -Raw|ConvertFrom-Json;$i=0;foreach($dev in $d){$i++;Write-Output \"$i|$($dev.label)|$($dev.ip)|$($dev.port)|$($dev.id)\"}" 2^>nul`) do (
    set "SLINE=%%L"
    for /f "tokens=1-5 delims=|" %%a in ("!SLINE!") do (
        set /a SAVED_COUNT=%%a
        set "SAVED_LABEL_%%a=%%b"
        set "SAVED_IP_%%a=%%c"
        set "SAVED_PORT_%%a=%%d"
        set "SAVED_ID_%%a=%%e"
    )
)

if %SAVED_COUNT%==0 (
    echo  No hay dispositivos guardados.
    echo.
    pause
    goto MAIN_MENU
)

echo  Dispositivos guardados: %SAVED_COUNT%
echo.
for /l %%i in (1,1,%SAVED_COUNT%) do (
    echo  [%%i] !SAVED_LABEL_%%i!  (!SAVED_IP_%%i!:!SAVED_PORT_%%i!)
)
echo.
echo  [C] Conectar a un dispositivo
echo  [D] Eliminar un dispositivo
echo  [0] Volver al menu principal
echo.
set /p SAVED_CHOICE="  Opcion: "

if /i "%SAVED_CHOICE%"=="0" goto MAIN_MENU
if /i "%SAVED_CHOICE%"=="C" goto SAVED_CONNECT
if /i "%SAVED_CHOICE%"=="D" goto SAVED_DELETE
goto SAVED_DEVICES_MENU

:SAVED_CONNECT
echo.
set /p SAVED_SEL="  Numero del dispositivo a conectar [1-%SAVED_COUNT%]: "
set "SC_IP="
for /l %%i in (1,1,%SAVED_COUNT%) do (
    if "%SAVED_SEL%"=="%%i" (
        set "SC_IP=!SAVED_IP_%%i!"
        set "SC_PORT=!SAVED_PORT_%%i!"
        set "SC_LABEL=!SAVED_LABEL_%%i!"
    )
)
if not defined SC_IP (
    echo  [!] Opcion invalida.
    pause
    goto SAVED_DEVICES_MENU
)
echo.
echo  Conectando a !SC_IP!:!SC_PORT!...
"%ADB_EXE%" connect !SC_IP!:!SC_PORT! 2>&1 | findstr /i "connected" >nul 2>&1
if %errorlevel%==0 (
    echo  [OK] Conectado a !SC_LABEL!
    echo.
    pause
    goto LIST_DEVICES
) else (
    echo  [!] No se pudo conectar. Los puertos pueden haber caducado.
    echo.
    echo  ¿Deseas re-vincular este dispositivo? [S/N]
    set /p RELINK_CHOICE="  "
    if /i "!RELINK_CHOICE!"=="S" (
        echo.
        echo  IP: !SC_IP! (no modificable)
        set /p NEW_PAIR_PORT="  Nuevo puerto de vinculacion: "
        set /p NEW_CODE="  Codigo de vinculacion: "
        echo.
        echo  Emparejando...
        "%ADB_EXE%" pair !SC_IP!:!NEW_PAIR_PORT! !NEW_CODE! 2>&1
        echo.
        set /p NEW_CONN_PORT="  Nuevo puerto de conexion: "
        echo.
        echo  Conectando a !SC_IP!:!NEW_CONN_PORT!...
        "%ADB_EXE%" connect !SC_IP!:!NEW_CONN_PORT! 2>&1
        :: Actualizar puerto en devices.json
        powershell -Command "$f='!DEV_FILE!';$d=Get-Content $f -Raw|ConvertFrom-Json;$e=$d|Where-Object{$_.ip -eq '!SC_IP!'};if($e){$e.port='!NEW_CONN_PORT!';$e.lastConnected=(Get-Date -Format o)};$d|ConvertTo-Json -Depth 5|Set-Content $f" 2>nul
        echo.
        echo  [OK] Puertos actualizados.
    )
    pause
    goto SAVED_DEVICES_MENU
)

:SAVED_DELETE
echo.
set /p DEL_SEL="  Numero del dispositivo a eliminar [1-%SAVED_COUNT%]: "
set "DEL_ID="
for /l %%i in (1,1,%SAVED_COUNT%) do (
    if "%DEL_SEL%"=="%%i" set "DEL_ID=!SAVED_ID_%%i!"
)
if not defined DEL_ID (
    echo  [!] Opcion invalida.
    pause
    goto SAVED_DEVICES_MENU
)
powershell -Command "$f='!DEV_FILE!';$d=Get-Content $f -Raw|ConvertFrom-Json;$d=$d|Where-Object{$_.id -ne '!DEL_ID!'};if($d -eq $null){$d=@()};ConvertTo-Json @($d) -Depth 5|Set-Content $f" 2>nul
echo  [OK] Dispositivo eliminado.
timeout /t 2 /nobreak >nul
goto SAVED_DEVICES_MENU

:: ================================================================
::  SALIR
:: ================================================================
:EXIT_SCRIPT
cls
echo.
echo  Hasta luego!
echo.
timeout /t 2 /nobreak >nul
exit /b 0
