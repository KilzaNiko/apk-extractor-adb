# APK Extractor

Herramienta local para extraer APKs e XAPKs de dispositivos Android conectados via ADB. Disponible como **interfaz web moderna** y como **script de consola** (`.bat`).

---

## ✨ Características

### Gestión de Dispositivos
- **Detección automática** de dispositivos Android conectados por USB
- **Depuración inalámbrica** (WiFi) — emparejar y conectar dispositivos sin cable
- **Dispositivos guardados** — los dispositivos vinculados por WiFi se guardan automáticamente para reconexión con un solo clic

### Extracción de Aplicaciones
- **Listado de apps** con nombre, paquete, formato y tamaño
- **Filtrado** por tipo: usuario, sistema o todas
- **Búsqueda** por nombre o paquete
- **Extracción de APK** — descarga directa del archivo `.apk`
- **Compilación de XAPK** — empaqueta Split APKs (apps con múltiples archivos) en un único `.xapk` instalable

### ADB Integrado
- **Descarga automática** de Android Platform Tools si no está instalado
- **Configuración manual** de ruta si ya tenés ADB instalado
- La ruta se guarda en `config.txt` para futuros usos

### Interfaz Web
- Diseño moderno con tema **claro y oscuro**
- Carga progresiva de información (batch loading)
- Feedback visual en tiempo real durante extracciones

---

## 📋 Requisitos

- **Windows 10/11**
- **Node.js** (v16+) — solo para la interfaz web
- **Dispositivo Android** con depuración USB activada

> **Nota:** ADB (Android Debug Bridge) se puede descargar automáticamente desde la app si no está instalado.

---

## 🚀 Uso

### Interfaz Web (recomendada)

```
start-web.bat
```

Esto:
1. Verifica que Node.js esté instalado
2. Instala dependencias automáticamente (`npm install`)
3. Inicia el servidor en `http://localhost:3000`
4. Abre el navegador automáticamente

### Consola (sin Node.js)

```
apk-downloader.bat
```

Interfaz interactiva por línea de comandos con menús, paginación y las mismas funcionalidades de extracción.

---

## 📁 Estructura

```
apk-downloader/
├── server.js             # Backend Express (API REST + ADB)
├── public/
│   ├── index.html        # Estructura de la interfaz web
│   ├── app.js            # Lógica frontend (dispositivos, apps, modals)
│   └── style.css         # Estilos (temas claro/oscuro, componentes)
├── apk-downloader.bat    # Versión de consola (standalone)
├── start-web.bat         # Launcher de la interfaz web
├── config.txt            # Ruta guardada de adb.exe
├── devices.json          # Dispositivos WiFi guardados
└── package.json
```

---

## 🔌 API REST

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/status` | Estado de configuración de ADB |
| `GET` | `/api/devices` | Lista de dispositivos conectados |
| `GET` | `/api/devices/:serial/info` | Info del dispositivo (marca, modelo, Android) |
| `GET` | `/api/devices/:serial/apps` | Lista de apps instaladas |
| `POST` | `/api/devices/:serial/apps/batch-info` | Info en lote (formato, tamaño, nombre) |
| `GET` | `/api/devices/:serial/apps/:pkg/info` | Detalle completo de una app |
| `POST` | `/api/devices/:serial/apps/:pkg/extract` | Extraer APK (descarga directa) |
| `GET` | `/api/devices/:serial/apps/:pkg/compile-xapk` | Compilar XAPK (SSE con progreso) |
| `POST` | `/api/adb/pair` | Emparejar dispositivo por WiFi |
| `POST` | `/api/adb/connect` | Conectar a dispositivo por WiFi |
| `GET` | `/api/saved-devices` | Lista de dispositivos guardados |
| `DELETE` | `/api/saved-devices/:id` | Eliminar dispositivo guardado |

---

## 📝 Notas

- Los APKs extraídos se descargan directamente al navegador y no se almacenan en el servidor.
- Las apps con **Split APK** no pueden exportarse como `.apk` simple — usa la opción **Compilar XAPK** para empaquetar todos los archivos en un `.xapk`.
- Los archivos `.xapk` se pueden instalar con [SAI (Split APKs Installer)](https://github.com/nicholasgasior/sai), APKPure o APKMirror Installer.
