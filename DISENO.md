# GenI — Diseño

App de escritorio que envuelve ComfyUI con una interfaz tipo chat.
Un solo usuario, todo local. Sin backend remoto.

---

## 1. Flujos de usuario

### F1 — Primer arranque
1. Abre la app → busca configuración en la base local.
2. Sin configurar → pantalla de bienvenida. Autodetecta `C:\Users\manue\AI\ComfyUI`;
   si no aparece, el usuario elige la carpeta a mano.
3. Valida que exista `main.py`. Si no, error claro y vuelve a pedir.
4. Lanza ComfyUI y muestra el log en vivo mientras arranca.
5. Cuando `/system_stats` responde, muestra GPU y VRAM detectadas.
6. Carga los presets incluidos y abre un chat vacío.

### F2 — Generar (bucle principal)
1. El usuario elige un preset arriba del panel de parámetros.
2. El panel carga los valores por defecto de ese preset.
3. Escribe el prompt positivo; opcionalmente el negativo.
4. Ajusta parámetros: resolución, pasos, CFG, sampler, seed, fuerza de LoRAs.
5. Envía con el botón o `Ctrl+Enter`.
6. Aparece su mensaje con el prompt y chips de los parámetros usados.
7. La app arma el workflow y lo encola en ComfyUI.
8. Aparece la respuesta con barra de progreso en vivo (nodo actual y % de pasos).
9. Al terminar se muestran las imágenes. Todo queda guardado.

### F3 — Repetir y variar
- **Re-roll**: mismos parámetros, seed nueva.
- **Editar parámetros**: recarga en el panel los valores de ese mensaje para retocarlos.
- **Copiar parámetros**: los deja en el portapapeles como texto.

### F4 — Conversaciones (panel derecho)
Nueva, renombrar (autotítulo desde el primer prompt), borrar con confirmación,
buscar por texto. Cada una recuerda su preset.

### F5 — Acciones sobre un resultado
Ver en grande, copiar al portapapeles, abrir carpeta contenedora,
guardar copia en otra ubicación, borrar.

### F6 — Ajustes
Ruta de ComfyUI y de Python, argumentos de arranque
(por defecto `--disable-pinned-memory`, ver LEEME del proyecto ComfyUI),
carpeta de salida, arrancar ComfyUI automáticamente sí/no, tema, buscar updates.

### F7 — Errores (cada uno con mensaje propio, no un stacktrace)
| Situación | Qué ve el usuario |
|---|---|
| ComfyUI no arranca | Últimas líneas del log + botón reintentar |
| `HIP out of memory` | Aviso y sugerencia de bajar resolución |
| `paging file is too small` | Explicación y cómo activar el archivo de paginación |
| ComfyUI muere generando | Mensaje marcado como fallido + reintentar |
| Falta un modelo | Lista de archivos faltantes y dónde van |

### F8 — Actualización
Al abrir (con retraso, para no competir con el arranque de ComfyUI) consulta
GitHub Releases. Si hay versión nueva muestra un aviso discreto; el usuario decide
cuándo descargar e instalar. **La base de datos y los ajustes viven en `userData`,
fuera de la carpeta del programa, así que el instalador nunca los toca.**

---

## 2. Arquitectura

Tres procesos, el modelo estándar de Electron:

```
┌─────────────────────────────────────────────────────────┐
│ MAIN  (Node 24, privilegios completos)                  │
│  · ciclo de vida de la ventana                          │
│  · gestor del proceso ComfyUI (lanzar/vigilar/apagar)   │
│  · cliente ComfyUI (HTTP + WebSocket)                   │
│  · base de datos SQLite (node:sqlite)                   │
│  · auto-updater                                         │
└───────────────┬─────────────────────────────────────────┘
                │ IPC con canales permitidos y validación
┌───────────────┴─────────────────────────────────────────┐
│ PRELOAD  (aislado, solo contextBridge)                  │
│  expone `window.geni` tipado — nunca ipcRenderer crudo  │
└───────────────┬─────────────────────────────────────────┘
                │
┌───────────────┴─────────────────────────────────────────┐
│ RENDERER  (React 19, sandbox, sin acceso a Node)        │
│  UI + estado. Habla solo por `window.geni`.             │
└─────────────────────────────────────────────────────────┘
```

### Idea central: presets con mapa de parámetros

Un preset guarda el workflow en formato API **y** un mapa que dice qué nodo e input
toca cada control de la interfaz:

```json
{
  "positive": { "node": "4", "input": "text" },
  "seed":     [{ "node": "7", "input": "seed" }, { "node": "9", "input": "seed" }],
  "width":    [{ "node": "6", "input": "width" }],
  "loras":    [{ "node": "2", "label": "Sparrow" }]
}
```

Un mismo parámetro puede escribir en varios nodos a la vez — necesario porque
el hires fix usa la misma seed en las dos pasadas. Agregar un workflow nuevo es
agregar su JSON y su mapa: la interfaz se genera sola, sin tocar código de UI.

### Estructura de carpetas

```
GenI/
├─ src/
│  ├─ main/
│  │  ├─ index.ts            arranque, ventana, ciclo de vida
│  │  ├─ ipc/                un archivo por dominio
│  │  ├─ db/                 conexión, migraciones, repositorios
│  │  ├─ comfy/              proceso, cliente HTTP, WebSocket, armado de workflows
│  │  ├─ updater.ts
│  │  └─ settings.ts
│  ├─ preload/index.ts
│  ├─ renderer/
│  │  ├─ index.html
│  │  └─ src/  (App, components, store, hooks, styles)
│  └─ shared/                tipos y contrato IPC, compartido por los tres
├─ resources/presets/        los 4 workflows
├─ electron.vite.config.ts
├─ electron-builder.yml
└─ package.json
```

### Modelo de datos

`settings(key, value)` · `presets(id, name, workflow_json, param_map_json, defaults_json, builtin)`
· `conversations(id, title, preset_id, created_at, updated_at)`
· `messages(id, conversation_id, role, prompt, negative, params_json, status, error, prompt_id, created_at)`
· `generations(id, message_id, filename, abs_path, width, height, seed, created_at)`

Borrado en cascada de conversación → mensajes → generaciones.
Las imágenes en disco **no** se borran salvo que el usuario lo pida.

Migraciones numeradas y aplicadas en orden al abrir; la versión vive en `schema_version`.
Esto es lo que permite actualizar la app sin perder datos.

---

## 3. Decisiones técnicas verificadas

| Pieza | Versión | Por qué |
|---|---|---|
| Electron | 43.4.0 | Trae Node 24 → `node:sqlite` estable |
| electron-vite | 5.0.0 | Acepta Vite 5/6/7 |
| Vite | **7.3.6** | electron-vite 5 **no** soporta Vite 8 |
| @vitejs/plugin-react | **5.2.0** | La 6.x exige Vite 8; la 5.2.0 cubre 4→8 |
| @tailwindcss/vite | 4.3.3 | Acepta Vite 7 |
| React | 19.2.8 | |
| zustand | 5.0.14 | Estado simple, sin boilerplate |
| electron-builder | 26.15.3 | Instalador NSIS + publicación a GitHub |
| electron-updater | 6.8.9 | Updates desde GitHub Releases |

**SQLite sin compilar nada.** Esta máquina no tiene compilador C++ ni Rust, así que
`better-sqlite3` (módulo nativo) quedaba descartado: exigiría Visual Studio Build
Tools. Se usa `node:sqlite`, incluido en Node 24 y por lo tanto en Electron 43.

### Seguridad

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- El renderer nunca ve `ipcRenderer`; solo la superficie mínima de `window.geni`.
- Canales IPC con lista blanca y validación de tipos en cada handler.
- CSP restrictiva: solo origen propio más `127.0.0.1:8188` para las imágenes.
- ComfyUI se lanza con los argumentos como arreglo, nunca `shell: true`
  (evita inyección si la ruta tiene caracteres raros).
- Navegación externa y ventanas nuevas bloqueadas.
- La ruta de ComfyUI se valida antes de ejecutar nada.
