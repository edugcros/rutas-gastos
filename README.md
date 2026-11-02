# Rutas & Gastos — Offline-first

Aplicación instalable como PWA para administrar viajes, ingresos y gastos de manera **independiente en cada computadora**. El registro de viajes y movimientos no depende de Internet, Node.js, MongoDB ni Docker en los equipos de uso.

## 1. Arquitectura definitiva

```text
PC A                                     PC B
PWA instalada                           PWA instalada
React + Service Worker                  React + Service Worker
IndexedDB local A                       IndexedDB local B
  viajes A                                viajes B
  gastos A                                gastos B
  rutas guardadas A                      rutas guardadas B

           Internet opcional, solo para planificación nueva
                         |
                         v
          Servicio remoto de planificación (Node/Express)
                  Gemini API + Google Routes API
                  No almacena viajes ni gastos
```

- Cada perfil de navegador/dispositivo tiene una base IndexedDB propia.
- No existe sincronización automática entre computadoras; los datos son deliberadamente independientes.
- Los viajes, gastos, ingresos, liquidaciones y rutas ya guardadas funcionan sin conexión.
- El Service Worker generado durante el build precachea el HTML, todos los chunks JS/CSS de Vite, fuentes, imágenes, iconos y manifest. La instalación offline se considera completa cuando la caché de precarga termina.
- Gemini y Google Routes se invocan cuando hay conexión. El frontend usa por defecto `https://rutas-gastos-route-service.onrender.com/api`; `VITE_ROUTE_API_URL` solo es necesario como override si cambia la URL del servicio.
- Google Maps JavaScript requiere conexión y `VITE_GOOGLE_MAPS_BROWSER_KEY`. La cartografía base se carga independientemente de que exista una ruta calculada o de que el servicio Gemini/Routes esté disponible. Sin conexión se muestra un esquema SVG de las polilíneas guardadas; no se simula cartografía base ni tráfico.

## 2. Instalación para usuarios finales (sin Docker ni Node)

1. Publicar `frontend/dist` en un hosting HTTPS (Vercel, Netlify, Cloudflare Pages o servidor estático).
2. Abrir el dominio desde Chrome o Edge en la PC.
3. Instalar desde el icono de instalación de la barra de direcciones o desde el menú del navegador: **Instalar Rutas & Gastos**.
4. Abrir la aplicación instalada y crear el espacio local del equipo.
5. Usar el sistema. No se instala Docker, MongoDB, Node.js ni una base de datos en la PC.

La primera instalación y la primera descarga del shell requieren Internet. Después de instalar y cargar el shell al menos una vez, la interfaz y el registro local están disponibles offline.

> El navegador puede administrar/quitar el almacenamiento local. La aplicación solicita almacenamiento persistente cuando el navegador lo permite, pero se deben exportar copias de seguridad periódicas. Publicar primero en un dominio HTTPS estable: IndexedDB y el Service Worker están aislados por origen; cambiar de dominio requiere exportar e importar una copia.

## 3. Desarrollo local del frontend

Requisitos solo para desarrollo, no para usuarios finales:

- Node.js 20 o superior.
- npm.

```bash
npm --prefix frontend install
npm run dev
```

Esto levanta únicamente Vite. No hace falta iniciar Docker ni MongoDB para probar la gestión local de viajes y gastos.

Build de producción:

```bash
npm run build
```

Salida: `frontend/dist`.

Vista previa local del build:

```bash
npm run preview
```

Para probar la instalación PWA en modo producción, usar HTTPS o `localhost`; el Service Worker no se activa en cualquier origen HTTP.

## 4. Almacenamiento local

La aplicación crea la base IndexedDB `rutas-gastos-local` con estos object stores:

- `settings`: perfil local y configuración del equipo.
- `trips`: viajes, ganancia inicial y rutas guardadas.
- `expenses`: gastos vinculados a cada viaje.

Los importes se almacenan como enteros en unidades menores (centavos), evitando errores de punto flotante. El resumen de ganancia se calcula a partir del ingreso inicial y los gastos que tienen `deductFromProfit=true`.

No se envían a Gemini ni a Google los gastos, balances, comprobantes ni la base local. El único dato remitido al servicio de planificación es el prompt de recorrido necesario para interpretar origen, destino y preferencias.

## Verificación de conectividad y carga de mapas

- La etiqueta de conexión verifica el acceso real al origen de Vercel mediante `connectivity.txt`; `navigator.onLine` por sí solo no garantiza acceso a Internet.
- Google Maps JavaScript se carga cuando hay conexión y existe `VITE_GOOGLE_MAPS_BROWSER_KEY`, aunque todavía no haya rutas guardadas. La visualización cartográfica es independiente del endpoint que calcula rutas.
- Si Google Maps no responde aunque el sitio esté accesible, la vista vuelve al esquema local de la polilínea guardada y muestra el diagnóstico de configuración.
- El botón personalizado **Instalar app** usa `beforeinstallprompt`: Chrome suprime el aviso nativo automático porque la aplicación presenta su propio botón. El prompt se invoca únicamente cuando el usuario hace clic.
- Se declara `mobile-web-app-capable` y se conserva el meta de Apple para compatibilidad con Safari en iOS.

## 5. Funcionamiento online / offline

### Precarga real del shell

El Service Worker se genera desde `vite.config.js` durante `npm run build`. El manifiesto de precarga incluye `index.html`, todos los assets de producción emitidos por Vite y los recursos públicos PWA. En la instalación, `cache.addAll()` debe completar correctamente antes de activar el worker. La navegación es network-first con fallback al HTML precargado; los assets versionados son cache-first.

Después de publicar una versión nueva:

1. Abrir la URL con Internet y esperar que termine la carga.
2. Esperar el indicador **App offline preparada** en la barra superior.
3. En Chrome/Edge, Application → Service Workers debe mostrar `/sw.js` como activated/running.
4. En Application → Cache Storage debe existir `rutas-gastos-shell-*` con `index.html` y los archivos `/assets/...js` y `/assets/...css`.
5. Recargar una vez online y luego probar offline. No usar “Clear site data” porque también elimina IndexedDB.

Si la pestaña dice “Preparando modo offline”, no asumir que la aplicación ya está lista para abrir sin red. Revisar la instalación del worker y la caché.


| Función | Offline | Online |
|---|---:|---:|
| Crear, editar y eliminar viajes | Sí | Sí |
| Crear y eliminar gastos | Sí | Sí |
| Editar ganancia inicial y recalcular saldo | Sí | Sí |
| Exportar/restaurar respaldo JSON | Sí | Sí |
| Ver rutas previamente guardadas | Sí, esquema SVG | Sí, Google Maps si está configurado |
| Calcular una ruta nueva con Gemini | No | Sí, con servicio remoto configurado |
| Calcular kilómetros y duración nuevos | No | Sí, Google Routes |
| Tráfico/cortes actuales | No | Solo la información que ofrezca la fuente online; verificar con autoridades |

No existe un motor de rutas offline ni mapas vectoriales offline en esta entrega. Implementarlo requeriría distribuir extractos geográficos de OpenStreetMap y un motor local (OSRM/GraphHopper u otro), con tamaño y actualizaciones de datos viales asociados. No debe confundirse con el funcionamiento offline de los registros contables.

## 6. Servicio remoto opcional para Gemini y Google Routes

El servicio está separado del almacenamiento local. Puede desplegarse como proceso Node independiente y **no requiere MongoDB ni JWT**.

Archivos:

- `backend/src/routeServer.js`: servidor independiente.
- `backend/src/routes/publicRouteRoutes.js`: endpoint de planificación con rate limits.
- `backend/src/controllers/routeController.js`: validación y orquestación.
- `backend/src/services/aiRoutePlanner.js`: Gemini.
- `backend/src/services/googleRoutesService.js`: Google Routes.

### Configuración

Crear `backend/.env.routes` copiando `backend/.env.routes.example` y completar. El servicio usa este archivo separado y no lee el `.env` del backend MongoDB antiguo:

```env
NODE_ENV=production
PORT=5100
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.8-flash
GOOGLE_MAPS_API_KEY=...
APP_ORIGINS=https://TU-DOMINIO-PWA
TRUST_PROXY_HOPS=1
ROUTE_LIMIT_PER_MINUTE=5
ROUTE_LIMIT_PER_DAY=25
```

`GOOGLE_MAPS_API_KEY` es privada del servidor y debe restringirse a Routes API y a la IP de salida estable del servicio de hosting. `GEMINI_API_KEY` nunca debe colocarse en variables `VITE_` ni en el bundle frontend.

### Ejecutar el servicio opcional

En `backend/`, copiar primero `.env.routes.example` a `.env.routes`; luego ejecutar:

```bash
npm install
npm run start:routes
```

Health check: `GET /health`.

Planificación: `POST /api/routes/plan`.

### Despliegue en Render

El archivo `render.yaml` contiene el servicio `rutas-gastos-route-service`. Al crear el servicio desde Blueprint:

1. Configurar `GEMINI_API_KEY` y `GOOGLE_MAPS_API_KEY` como secretos.
2. Configurar `APP_ORIGINS` con el origen HTTPS real del frontend.
3. Mantener `TRUST_PROXY_HOPS=1` solo detrás del proxy de Render.
4. Configurar cuotas, alertas de facturación y límites de uso en Google Cloud y Gemini. Restringir la clave de Routes a la IP de salida del servicio; usar un hosting con egreso IP estable o una arquitectura de egreso estático.
5. El frontend incluye la URL pública predeterminada de Render. Si se cambia el nombre/dominio del servicio, configurar el override `VITE_ROUTE_API_URL` en el entorno de compilación.

Variables del frontend en Vercel (Production):

```env
# Opcional: solo si cambia el endpoint predeterminado de Render.
VITE_ROUTE_API_URL=https://tu-servicio.onrender.com/api

# Necesaria para cartografía base de Google Maps en el navegador.
VITE_GOOGLE_MAPS_BROWSER_KEY=CLAVE_PUBLICA_RESTRINGIDA_POR_HTTP_REFERRER
```

Si no se define `VITE_ROUTE_API_URL`, se usa la URL predeterminada del servicio Rutas & Gastos. `VITE_GOOGLE_MAPS_BROWSER_KEY` sí debe configurarse para mostrar Google Maps; restringirla por HTTP referrer y exclusivamente a Maps JavaScript API.

`VITE_GOOGLE_MAPS_BROWSER_KEY` es pública por definición: restringirla por HTTP referrer y exclusivamente a Maps JavaScript API. No colocar claves privadas en el frontend.

**Seguridad y costos:** el endpoint de planificación es público y usa límites por IP en memoria como control básico de MVP. CORS no es autenticación. Antes de un uso comercial/masivo, añadir protección antiabuso (por ejemplo, Turnstile validado en servidor y/o cuotas compartidas en Redis), límites de gasto y alertas de proveedor. El servicio no almacena datos contables.

## 7. Copias de seguridad

En el menú lateral:

- **Exportar copia** descarga un JSON con el perfil local, viajes, ingresos, rutas guardadas y gastos.
- **Restaurar copia** reemplaza los datos de la instalación actual por los de ese archivo, previa confirmación.

La copia puede trasladarse manualmente a otra PC. Al restaurarla, esa PC tendrá los datos de la copia, pero las dos instalaciones seguirán siendo independientes desde ese momento.

El respaldo contiene datos financieros; guardarlo en una ubicación privada y cifrada. No compartirlo públicamente.

## 8. Migrar los datos que ya están en MongoDB

La versión anterior almacenaba la información en MongoDB. Esa base no se importa automáticamente a IndexedDB.

En la computadora donde existe la versión anterior:

1. Mantener disponible `backend/.env` con el `MONGODB_URI` de la base antigua.
2. Ejecutar desde `backend/`:

```bash
npm install
npm run export:legacy -- usuario@correo.com
```

3. Se generará `backend/exports/rutas-gastos-migration-....json` con los viajes y gastos de ese usuario/organización. No contiene contraseña ni JWT.
4. Abrir la PWA nueva en esa PC, crear el perfil local y elegir **Restaurar copia**.
5. Confirmar la importación.

El script exporta solo el tenant asociado al correo indicado. Proteger el JSON porque contiene información económica.

## 9. Independencia entre equipos

La identidad de cada instalación es local. Dos computadoras no comparten datos automáticamente, incluso si usan el mismo nombre de responsable. Para trasladar datos:

- exportar el respaldo en la PC origen;
- transferirlo por un medio seguro;
- restaurarlo en la PC destino.

No restaurar el mismo respaldo repetidamente sobre una instalación con movimientos nuevos sin exportar primero su copia, porque la restauración reemplaza toda la base local.

## 10. Estructura relevante

```text
rutas-gastos/
├── frontend/
│   ├── public/
│   │   ├── manifest.webmanifest
│   │   ├── sw.js
│   │   └── icons/
│   └── src/
│       ├── api/http.js              # Fachada local + planificación remota opcional
│       ├── data/localStore.js       # IndexedDB, movimientos y respaldos
│       ├── components/
│       │   ├── AuthScreen.jsx       # Alta del perfil local
│       │   ├── MapCanvas.jsx        # Google Maps online / polilínea local offline
│       │   └── TripWorkspace.jsx
│       ├── styles/
│       │   ├── global.css
│       │   └── visual-system.css
│       └── App.jsx
├── backend/
│   ├── src/routeServer.js           # Servicio remoto sin MongoDB
│   ├── src/routes/publicRouteRoutes.js
│   ├── src/services/                # Gemini + Google Routes
│   └── scripts/export-local-backup.js
└── render.yaml
```

### Sistema visual

- `frontend/src/styles/global.css` conserva las reglas base y los selectores estructurales existentes.
- `frontend/src/styles/visual-system.css` se carga después y concentra la capa visual de producción (tokens, jerarquía, superficies, controles y breakpoints).
- La capa visual no contiene dependencias remotas ni cambia el árbol de componentes, los flujos, el modelo local o el contrato del servicio de planificación.

## 11. Limitaciones y próximos controles

- IndexedDB no equivale a una base cifrada; el acceso al perfil de Windows y al navegador protege el equipo. Para datos de mayor sensibilidad, habilitar cifrado de disco y respaldos cifrados.
- La persistencia depende de las políticas del navegador y del almacenamiento disponible. Mantener respaldos externos.
- La PWA necesita instalarse y cargar su shell una vez con Internet; luego el core local funciona sin red. El acceso a la base local depende del perfil de navegador/usuario de Windows; IndexedDB no está cifrado por esta aplicación en esta versión.
- La planificación nueva depende de un servicio remoto. Si no está configurado, se deshabilita sin afectar viajes ni gastos.
- La ruta dibujada offline es una representación de la polilínea; no contiene cartografía, instrucciones nuevas, tráfico ni cierres actualizados.
- Se debe probar el build en Chrome y Edge, instalar, desconectar Internet, crear movimientos, cerrar/reabrir y restaurar una copia antes de distribuir.

### Seguridad de almacenamiento local

En esta versión el aislamiento es por perfil local del navegador y por cuenta de Windows; no es autenticación central ni cifrado de los datos dentro de IndexedDB. En computadoras compartidas, usar cuentas de Windows separadas y cifrado de disco (por ejemplo BitLocker). El respaldo JSON es legible; conservarlo en una ubicación segura. Se puede agregar cifrado local con contraseña en una etapa posterior.
