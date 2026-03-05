# APK Extractor

Herramienta local para extraer archivos APK y XAPK de dispositivos Android conectados vía ADB. Disponible como **interfaz web moderna** y como **script de consola** (`.bat`).

---

## ✨ Características

### Gestión de Dispositivos
- **Detección automática** de dispositivos Android conectados por USB o WiFi.
- **Monitoreo en tiempo real** (Web) — detecta automáticamente conexiones y desconexiones (polling cada 4 segundos).
- **Soporte mDNS** — detecta dispositivos auto-conectados por depuración inalámbrica (formato `adb-*._adb-tls-connect._tcp`), resuelve su IP y muestra marca/modelo.
- **Depuración inalámbrica** (WiFi) — emparejar y conectar dispositivos sin cable USB. Disponible tanto en la interfaz web como en la consola.
- **Dispositivos guardados** — los dispositivos WiFi se guardan automáticamente para reconexión rápida. Si los puertos caducan, se ofrece un asistente de re-vinculación con la IP pre-cargada.
- **Nombres personalizados** — se puede asignar un nombre a cualquier dispositivo (por serial) que persiste entre sesiones. El nombre se muestra en la interfaz web y en la consola para identificar dispositivos fácilmente.
- **Indicador WiFi** (Web) — los dispositivos inalámbricos se identifican con un ícono 📶 en la barra lateral.

### Extracción de Aplicaciones
- **Listado de apps** con nombre, paquete, formato y tamaño.
- **Filtrado** por tipo: usuario, sistema o todas.
- **Búsqueda** por nombre o paquete.
- **Copiar paquete** (Web) — botón para copiar el nombre del paquete al portapapeles desde la lista o el detalle.
- **Extracción de APK** — descarga directa del archivo `.apk`.
- **Compilación de XAPK** — empaqueta Split APKs en un único archivo `.xapk` instalable.

### ADB Integrado
- **Descarga automática** de Android Platform Tools si no se encuentra instalado.
- **Configuración manual** de la ruta si ya cuenta con ADB instalado.
- La ruta se guarda en `config.txt` para usos futuros.

### Interfaz Web
- Diseño moderno con modo **claro y oscuro**.
- Carga progresiva de información (batch loading).
- Feedback visual en tiempo real durante las extracciones.
- Notificaciones toast para conexiones, desconexiones y errores.

### Consola (CLI)
- Menú interactivo con las mismas funcionalidades principales.
- **Depuración inalámbrica** — vincular y conectar dispositivos por WiFi.
- **Dispositivos guardados** — reconexión rápida, re-vinculación y eliminación.
- **Nombres personalizados** — asignar y mostrar nombres desde el menú del dispositivo.

---

## 🌐 Conexión Remota (Opcional)

Si bien APK Extractor es una herramienta local, es posible conectarse a dispositivos a distancia utilizando **[Tailscale](https://tailscale.com/)** (una VPN P2P gratuita y fácil de usar) como intermediario.

Para hacerlo:
1. Instale Tailscale tanto en la **PC** como en el **dispositivo Android** remoto.
2. Asegúrese de iniciar sesión con la **misma cuenta** en ambos equipos.
3. En la PC, abra la interfaz web de APK Extractor.
4. En el dispositivo Android remoto, active la depuración inalámbrica.
5. Utilice la **IP de Tailscale** del dispositivo Android (100.x.y.z) y el puerto de depuración inalámbrica para emparejar y conectar desde la interfaz web.

> **Nota:** Esta no es una función nativa de la aplicación, pero funciona perfectamente al estar ambos equipos en la misma red virtual privada protegida.

---

## 📋 Requisitos

- **Windows 10/11**
- **Node.js** (v16 o superior) — solo para la interfaz web.
- **Dispositivo Android** con la depuración USB activada.

> **Nota:** ADB (Android Debug Bridge) se puede descargar automáticamente desde la herramienta si no está instalado.

---

## 🚀 Uso

### Interfaz Web (Recomendada)

```
start-web.bat
```

Este script:
1. Verifica que Node.js esté instalado.
2. Instala las dependencias automáticamente (`npm install`).
3. Inicia el servidor en `http://localhost:3000`.
4. Abre el navegador de forma automática.

### Consola (Sin Node.js)

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
├── device-names.json     # Nombres personalizados por serial
└── package.json
```

---

## 🔌 API REST

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/status` | Estado de configuración de ADB |
| `GET` | `/api/devices` | Lista de dispositivos conectados (con marca, modelo, IP y nombre) |
| `GET` | `/api/devices/poll` | Lista rápida de seriales (para polling de cambios) |
| `GET` | `/api/devices/:serial/info` | Info del dispositivo (marca, modelo, versión de Android) |
| `GET` | `/api/devices/:serial/apps` | Lista de aplicaciones instaladas |
| `POST` | `/api/devices/:serial/apps/batch-info` | Información en lote (formato, tamaño, nombre) |
| `GET` | `/api/devices/:serial/apps/:pkg/info` | Detalles completos de una aplicación |
| `POST` | `/api/devices/:serial/apps/:pkg/extract` | Extraer APK (descarga directa) |
| `GET` | `/api/devices/:serial/apps/:pkg/compile-xapk` | Compilar XAPK (SSE con progreso) |
| `POST` | `/api/adb/pair` | Emparejar dispositivo por WiFi |
| `POST` | `/api/adb/connect` | Conectar al dispositivo por WiFi |
| `GET` | `/api/saved-devices` | Lista de dispositivos guardados |
| `POST` | `/api/saved-devices` | Guardar/actualizar un dispositivo |
| `DELETE` | `/api/saved-devices/:id` | Eliminar dispositivo guardado |
| `GET` | `/api/device-names` | Obtener todos los nombres personalizados |
| `PUT` | `/api/device-names/:serial` | Asignar nombre a un dispositivo |
| `DELETE` | `/api/device-names/:serial` | Eliminar nombre personalizado |

---

## 📝 Notas

- Los archivos APK extraídos se descargan directamente en el navegador y no se almacenan en el servidor.
- Las aplicaciones con **Split APK** (múltiples archivos) no pueden exportarse como un archivo `.apk` simple — utilice la opción **Compilar XAPK** para empaquetar todos los archivos en un solo `.xapk`.
- Los archivos `.xapk` se pueden instalar utilizando [SAI (Split APKs Installer)](https://github.com/nicholasgasior/sai), APKPure o APKMirror Installer.
- Los nombres de dispositivos se almacenan en `device-names.json` y son compartidos entre la interfaz web y la consola.

