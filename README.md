# GenI

Aplicacion de escritorio que envuelve ComfyUI en una interfaz de chat.
Escribis un prompt, ajustas los parametros y las imagenes aparecen en la
conversacion. Todo corre local: no hay servidor ni cuenta.

## Requisitos

- Windows 10/11
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) instalado y funcionando
- Node 20 o superior y [pnpm](https://pnpm.io) (solo para desarrollar)

## Desarrollo

```bash
pnpm install
pnpm dev
```

`pnpm install` descarga el binario de Electron. Si pnpm avisa que bloqueo
scripts de instalacion, revisa `pnpm-workspace.yaml`: ahi estan declarados los
paquetes autorizados a ejecutarlos.

Otros comandos:

| Comando | Que hace |
|---|---|
| `pnpm dev` | Arranca en modo desarrollo con recarga en caliente |
| `pnpm typecheck` | Comprueba tipos de los tres procesos |
| `pnpm build` | Compila main, preload y renderer |
| `pnpm dist` | Genera el instalador en `release/` |
| `pnpm release` | Compila y publica en GitHub Releases |

## Como esta armado

Tres procesos, el modelo estandar de Electron:

- **main** — ciclo de vida de la ventana, proceso de ComfyUI, base SQLite,
  actualizaciones. Es el unico con privilegios.
- **preload** — expone `window.geni`, una superficie acotada y tipada.
  El renderer nunca ve `ipcRenderer` ni Node.
- **renderer** — React 19 en sandbox. Solo interfaz.

El detalle del diseno, los flujos de usuario y las decisiones tecnicas estan en
[DISENO.md](DISENO.md).

### Presets

Un preset son tres cosas: el workflow de ComfyUI en formato API, un mapa que
dice que control de la interfaz escribe en que nodo, y unos valores por defecto.
Viven en `resources/presets/`.

Agregar un modelo nuevo es agregar su JSON: la interfaz se arma sola a partir
del mapa, sin tocar codigo de React.

### Datos

La base SQLite y los ajustes se guardan en `%APPDATA%\geni`, **fuera** de la
carpeta del programa. Por eso una actualizacion no borra conversaciones ni
configuracion. Los cambios de esquema los resuelven las migraciones numeradas de
`src/main/db/migrations.ts`, que se aplican al abrir.

Para agregar una migracion: sumala al final del arreglo con el numero siguiente.
Nunca edites una que ya se publico.

## Actualizaciones

La app consulta GitHub Releases al arrancar y avisa si hay version nueva. No
descarga ni instala nada sin que el usuario lo pida.

Para publicar una version:

```bash
# subi la version en package.json, despues:
pnpm release
```

Necesita la variable de entorno `GH_TOKEN` con permiso sobre el repositorio.

El instalador no esta firmado, asi que Windows SmartScreen va a advertir la
primera vez. Es lo esperable sin un certificado de firma de codigo.

## Licencia

MIT
