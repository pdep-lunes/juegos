# Juegos de PdeP Lunes

Los juegos en Wollok de los TPs de objetos, jugables en el navegador en
**https://pdep-lunes.github.io/juegos/**.

## Cómo funciona

`wollok run` levanta un servidor Node que corre el intérprete y le manda el estado del
tablero a la página por socket.io, así que no se puede publicar tal cual en un hosting estático.
Pero la librería del cliente (`game-index.js`, que viene con `wollok-ts-cli`) también trae
`LocalGame`, que corre el intérprete **en el navegador**. El build arma, por cada grupo:

```
dist/
  index.html            ← listado de juegos
  lib/                  ← p5 + wollok-ts + LocalGame (copiados de wollok-ts-cli)
  grupo-NN/
    index.html          ← carga game.json y arranca LocalGame
    game.json           ← fuentes .wlk/.wpgm + lista de imágenes/sonidos
    assets/             ← la carpeta resourceFolder del proyecto
```

Las fuentes se toman de lo **commiteado en `origin/main`** de cada repo de grupo (con
`git archive`), no de la copia local, para no publicar cambios sin commitear.

## Requisitos

- Node y `wollok-ts-cli` instalado globalmente (`npm i -g wollok-ts-cli`)
- Los repos de los grupos clonados al lado de este (ver rutas en `juegos.json`)

## Uso

```sh
npm run build    # genera dist/
npm run serve    # http://localhost:8765 para probar
npm run deploy   # build + push de dist/ a la rama gh-pages
```

## Agregar un juego

Sumar una entrada en `juegos.json`:

```json
{ "id": "grupo-NN", "repo": "../grupo-NN-2026", "path": "carpeta/del/juego" }
```

`path` es la carpeta que tiene el `package.json` del proyecto Wollok (con `resourceFolder`) y
exactamente un `.wpgm`. Opcional: `"ref"` para publicar otra rama o commit (por defecto `origin/main`).
