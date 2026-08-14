# GenI

App de escritorio (Electron) que envuelve **ComfyUI** en una interfaz de chat:
se escribe un prompt, se ajustan parametros, y las imagenes aparecen en la
conversacion. **Todo corre local.** No hay backend, ni cuentas, ni telemetria.
Un solo usuario, Windows.

`README.md` tiene los comandos de desarrollo. `DISENO.md` tiene los flujos de
usuario. Este archivo es el resto: como esta armado y por que, con las
decisiones que no se deducen leyendo el codigo.

---

## Que es y que no es

- **Es** un cliente de ComfyUI. ComfyUI hace el trabajo pesado; GenI arma el
  grafo, lo encola y ordena los resultados.
- **No** reimplementa inferencia, ni sube nada a ningun lado.
- El unico proceso externo que se lanza es ComfyUI, en localhost.

---

## Arquitectura

Tres procesos, el modelo estandar de Electron. El limite entre ellos es real,
no una formalidad.

```
src/
  main/      Node completo. Unico con privilegios.
  preload/   Puente. Expone window.geni por contextBridge.
  renderer/  React. Sin Node, sin acceso a disco.
  shared/    Tipos y nombres de canal. Lo unico que importan los tres.
```

**El renderer nunca toca el sistema.** `contextIsolation: true`,
`nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, y una CSP
estricta en `index.html`. Todo lo que necesita pasa por `window.geni`.

### Contrato IPC

- `src/shared/channels.ts` — lista blanca de canales. `CH` = invoke
  (renderer→main), `EV` = push (main→renderer). Un canal que no este aca no
  existe.
- `src/shared/types.ts` — la interfaz `GenIApi` es **el contrato**. Agregar una
  operacion es: canal en `channels.ts` → metodo en `GenIApi` → handler en
  `main/ipc/index.ts` → implementacion en `preload/index.ts`. Si falta un paso,
  TypeScript avisa.
- Todo argumento que cruza el IPC se valida en el handler (`asString`, `asId`,
  etc. en `main/ipc/index.ts`). El renderer no es de fiar aunque sea propio.

---

## Modulos del main

| Modulo | Responsabilidad |
|---|---|
| `comfy/process.ts` | Lanza y supervisa el proceso de ComfyUI |
| `comfy/client.ts` | HTTP + WebSocket contra ComfyUI |
| `comfy/builder.ts` | Arma el grafo de nodos desde cero |
| `comfy/recipes.ts` | Deriva las recetas del catalogo de modelos |
| `comfy/generator.ts` | Une base de datos, builder y cliente; sigue el avance |
| `comfy/installer.ts` | Instala ComfyUI desde cero si el usuario no lo tiene |
| `comfy/workflow-import.ts` | Lee un `.json` exportado y dice que modelos faltan |
| `comfy/webp.ts` | Recomprime el PNG de salida a WEBP |
| `comfy/params.ts` | Normaliza parametros viejos al leerlos |
| `models/detect.ts` | Clasifica `.safetensors` leyendo su cabecera |
| `models/manager.ts` | Catalogo: escanear, importar, borrar |
| `models/download.ts` | Descarga por URL desde Civitai / Hugging Face |
| `collections/manager.ts` | Albumes de imagenes con su receta |
| `presets/manager.ts` | Configuraciones guardadas con imagen de referencia |
| `conversations/archive.ts` | Comprime/descomprime imagenes por conversacion |
| `translate/translate.ts` | Traduccion ES→EN local (opus-mt) |
| `db/` | SQLite y migraciones |

---

## Decisiones que no se deducen del codigo

### El grafo se construye, no se rellena

`comfy/builder.ts` arma el workflow nodo por nodo segun la arquitectura
(`sdxl`, `flux`, `flux-kontext`). **No** hay plantillas JSON con valores que se
pisan.

Motivo: con plantillas fijas, agregar o quitar una LoRA obliga a reconectar
enlaces a mano. Construyendolo, la cadena de LoRAs es un bucle
(`chainLoras()`).

### Las recetas se derivan, los presets se guardan

- **Receta** = "que modelos usar y como conectarlos". Se calcula de los modelos
  instalados en cada llamada (`recipes.ts`). Instalar un checkpoint hace
  aparecer su receta; borrarlo la hace desaparecer. No hay estado que se
  desincronice del disco.
- **Preset** = una configuracion completa que el usuario guardo con nombre e
  imagen. Ese si vive en la base.

`Recipe.architecture` dice **como armar el grafo**; `Recipe.baseArchitecture`
dice **con que LoRAs es compatible**. No son lo mismo: SD 1.5 y SDXL se arman
igual pero no comparten LoRAs.

### Tipo de modelo por cabecera, no por carpeta

`models/detect.ts` lee los primeros bytes del `.safetensors` (8 bytes de largo
+ cabecera JSON) y clasifica por nombres de tensores. Nunca carga los pesos.

Si los tensores no alcanzan (arquitecturas nuevas tipo Qwen-Image), cae a
heuristicas por nombre de archivo. Para LoRAs sin metadatos, deduce la
arquitectura por el ancho del vector de contexto en los bloques de atencion
cruzada: **768 = SD 1.5, 2048 = SDXL, 4096 = FLUX**.

Las LoRAs que quedan en `unknown` **no se ocultan**: no se probo que sean
incompatibles, y esconderlas haria desaparecer LoRAs que funcionan. Se marcan.

### Un `.zip` por conversacion

Solo la conversacion activa tiene sus imagenes sueltas en disco; el resto vive
comprimido (`conversations/archive.ts`). Cambiar de conversacion comprime la
anterior y descomprime la nueva. Al cerrar la app se comprime la ultima activa.

Esto funciona porque `filename_prefix` de ComfyUI acepta barras y crea
subcarpetas solo (`geni/<conversationId>/GenI`) — verificado contra la API
real. Sin eso habria que mover archivos despues de cada generacion.

El protocolo `geni-file://` sabe leer una entrada suelta del zip, asi que las
miniaturas de conversaciones inactivas se ven sin descomprimir todo.

### Salida en WEBP, exportacion en PNG

ComfyUI escribe PNG (su unico formato nativo). `comfy/webp.ts` lo recomprime a
WEBP calidad 90 y borra el PNG: 60-80% menos peso, sin diferencia visible.

No se usa el nodo `SaveAnimatedWEBP` de ComfyUI porque trata el batch entero
como frames de **un** video: 4 imagenes terminarian en un archivo animado en
vez de 4 sueltos.

Al descargar se convierte a PNG (o JPEG/WEBP, segun la extension que elija el
usuario en el dialogo). `nativeImage` de Electron **no decodifica WEBP** — solo
PNG/JPEG — asi que copiar al portapapeles pasa por `sharp` primero.

### `node:sqlite`, no better-sqlite3

Electron 43 trae Node 24, que incluye `node:sqlite`. Evita compilacion nativa
y el ciclo de rebuild por version de Electron.

Migraciones en `db/migrations.ts`, numeradas y correlativas. **Nunca editar una
publicada**: agregar una nueva al final. Cada una tiene que poder correr sobre
una base con datos reales.

---

## Renderer

- **zustand** (`store/useStore.ts`) para el estado. Un solo store.
- **motion** (sucesor de framer-motion) para animaciones.
- **Tailwind v4**, con los tokens de diseño en `styles/index.css`.

### Tema: tokens, no clases condicionales

Claro y oscuro se resuelven **intercambiando variables CSS**, no escribiendo
`dark:` en cada componente. `applyTheme()` pone `data-theme` en `<html>` y el
bloque `html[data-theme='oscuro']` redefine los tokens.

Los nombres `cobalt-*` / `cielo-*` quedaron del azul original; hoy el tema
claro es **carmesi**. Son los tokens de "lo activo" en toda la app y renombrarlos
tocaria cada componente. En oscuro se redefinen a crema.

El rojo de peligro (`rose-*`) esta corrido al **bermellon** a proposito, para no
confundirse con el carmesi de la marca: borrar y generar no pueden verse igual.
Los valores estan bajados de croma para entrar en el gamut sRGB — mas saturado,
el navegador los recorta y el rojo se vuelve marron.

### Trampas del CSS que ya costaron caro

Estan documentadas en el codigo, pero conviene saberlas antes de tocar UI:

1. **`backdrop-filter` crea un containing block** para `position: fixed`, igual
   que `transform`. Por eso Select, Tooltip y Modal se portan a `document.body`
   con `createPortal`: adentro de un panel `.glass` quedaban recortados o mal
   posicionados.

2. **Tailwind "hornea" el color de las sombras.** `shadow-soft`, `shadow-lift`,
   etc. compilan a `var(--tw-shadow-color, <color literal>)` con el valor del
   tema **claro** incrustado como texto. Redefinir `--shadow-soft` en el bloque
   oscuro no le llega. Hay overrides explicitos al final de `index.css` que
   pisan `--tw-shadow-color`.

3. **`-webkit-app-region: drag` no lo decide el z-index ni el DOM.** La barra de
   titulo declara una franja arrastrable que el sistema operativo lee por pixel.
   Los modales se portan a `document.body` (otro arbol) y se pintan encima, pero
   no la apagan: hace falta `no-drag` explicito, si no un click ahi arrastra la
   ventana en vez de tocar el modal.

4. **Los glifos de Material Symbols traen su propia caja em con aire.** A tamaños
   chicos no hay `font-size` que los acomode. Las flechas del contador numerico y
   la linea de "minimizar" se dibujan como SVG/CSS por eso.

5. **Una imagen cacheada puede disparar `load` antes de que React enganche el
   handler.** `ImageWithSkeleton` consulta `img.complete` al montar; si no, la
   imagen queda invisible detras del esqueleto para siempre.

### Componentes compartidos

`ParamFields` y `LoraFields` los usan **el panel de Generar y el dialogo de
nuevo preset**. Estaban duplicados y se desincronizaban: el preset guardaba
parametros que el usuario no podia ver ni tocar desde ahi.

---

## Convenciones

- **Todo en español neutro**, sin voseo. Comentarios, UI y mensajes de commit.
  Sin acentos en comentarios de codigo.
- Los comentarios explican **por que**, no que. Si un valor raro tiene una razon
  (una version, un tamaño, un orden), esa razon va escrita.
- Los errores que ve el usuario dicen que paso y que hacer, no el stack.
- Antes de dar algo por hecho, verificarlo: la API real, el CSS compilado, la
  migracion sobre datos de prueba. Varios de los arreglos de arriba salieron de
  ahi, y varios diagnosticos "obvios" resultaron equivocados.

---

## Versiones que no se pueden mover a ciegas

| Paquete | Version | Por que importa |
|---|---|---|
| `electron` | 43.4.0 | Trae Node 24 → `node:sqlite` |
| `vite` | 7.3.6 | **No** 8: incompatible con electron-vite 5 |
| `@vitejs/plugin-react` | 5.2.0 | **No** 6.x: pide Vite 8 |
| `tailwindcss` | 4.3.3 | Sintaxis v4 (`@theme`, `@utility`) |

`pnpm-workspace.yaml` declara en `allowBuilds` los paquetes autorizados a
correr scripts de instalacion (electron, esbuild, onnxruntime-node, sharp).
Sin eso, pnpm los bloquea y el binario de Electron no se descarga.

`sharp` y `onnxruntime-node` traen binarios nativos: van en `asarUnpack` de
`electron-builder.yml`, porque un `.node` no se puede requerir desde adentro
del asar.

---

## Estado y limitaciones conocidas

- El **instalador de ComfyUI** (`comfy/installer.ts`) esta implementado pero no
  se corrio de punta a punta. El indice de PyTorch para AMD apunta a ruedas de
  Linux; en Windows la ruta real es DirectML o las nightly de TheRock. Ajustar
  antes de confiar en el.
- La **actualizacion silenciosa** (`quitAndInstall(true, true)`) pasa `/S` al
  instalador NSIS. Se confirma recien en una actualizacion real.
- La traduccion local descarga ~300MB la primera vez y los cachea en
  `userData/translate-cache`.
