// Genera un sitio estático (dist/) con cada juego Wollok corriendo 100% en el navegador.
// Uso: node build.mjs
// Requiere wollok-ts-cli instalado globalmente (de ahí se toma el runtime web: p5 + wollok-ts + LocalGame).

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(root, 'dist')
const juegos = JSON.parse(fs.readFileSync(path.join(root, 'juegos.json'), 'utf8'))

const SOURCE_EXT = ['.wlk', '.wpgm']
const ASSET_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp3', '.ogg', '.wav']
const IGNORED_DIRS = new Set(['node_modules', '.git', 'log', '.vscode'])

const findRuntime = () => {
  const globalModules = execSync('npm root -g').toString().trim()
  const lib = path.join(globalModules, 'wollok-ts-cli', 'dist', 'public', 'game', 'lib')
  if (!fs.existsSync(path.join(lib, 'game-index.js'))) throw new Error(`No encontré el runtime de Wollok Game en ${lib}`)
  return lib
}

const walk = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return IGNORED_DIRS.has(entry.name) ? [] : walk(full, base)
    return [path.relative(base, full).split(path.sep).join('/')]
  })

const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const gameTitle = sources => {
  for (const { content } of sources) {
    const match = content.match(/game\.title\(\s*"([^"]*)"\s*\)/)
    if (match) return match[1]
  }
  return null
}

// Exporta el proyecto tal como está commiteado en `ref` (por defecto origin/main),
// así cambios locales sin commitear no se cuelan en lo publicado.
const exportProject = ({ id, repo, path: subPath, ref = 'origin/main' }) => {
  const repoDir = path.resolve(root, repo)
  execSync('git fetch --quiet origin', { cwd: repoDir })
  const sha = execSync(`git rev-parse --short ${ref}`, { cwd: repoDir }).toString().trim()
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `juego-${id}-`))
  execSync(`git archive ${ref} ${subPath} | tar -x -C "${tmp}"`, { cwd: repoDir })
  return { projectDir: path.join(tmp, subPath), sha, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) }
}

const buildGame = (juego) => {
  const { id } = juego
  const { projectDir, sha, cleanup } = exportProject(juego)
  try { return buildFrom(id, projectDir, sha) } finally { cleanup() }
}

const buildFrom = (id, projectDir, sha) => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'))
  const assetsFolder = pkg.resourceFolder ?? 'assets'
  const outDir = path.join(dist, id)
  fs.mkdirSync(outDir, { recursive: true })

  const files = walk(projectDir)
  const sources = files
    .filter(f => SOURCE_EXT.includes(path.extname(f)))
    .map(name => ({ name, content: fs.readFileSync(path.join(projectDir, name), 'utf8') }))

  const programs = sources.filter(s => s.name.endsWith('.wpgm'))
  if (programs.length !== 1) throw new Error(`${id}: se esperaba exactamente 1 .wpgm y hay ${programs.length}`)
  const main = programs[0].name.replace(/\.wpgm$/, '').replace(/\//g, '.')

  const assetsDir = path.join(projectDir, assetsFolder)
  const assets = fs.existsSync(assetsDir) ? walk(assetsDir).filter(f => ASSET_EXT.includes(path.extname(f).toLowerCase())) : []
  for (const asset of assets) {
    const target = path.join(outDir, 'assets', asset)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(assetsDir, asset), target)
  }

  const isSound = f => ['.mp3', '.ogg', '.wav'].includes(path.extname(f).toLowerCase())
  const media = f => ({ possiblePaths: [f], url: `assets/${f.split('/').map(encodeURIComponent).join('/')}` })
  const title = gameTitle(sources) ?? id

  const project = {
    main,
    sources,
    description: '',
    images: assets.filter(f => !isSound(f)).map(media),
    sounds: assets.filter(isSound).map(media),
  }
  fs.writeFileSync(path.join(outDir, 'game.json'), JSON.stringify(project))
  fs.writeFileSync(path.join(outDir, 'index.html'), gameHtml(id, title))

  console.log(`✔ ${id}@${sha}: "${title}" — ${sources.length} fuentes, ${assets.length} assets, programa ${main}`)
  return { id, title, sha }
}

const gameHtml = (id, title) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · ${id} · PdeP Lunes</title>
  <link rel="stylesheet" href="../lib/juegos.css" />
  <script src="../lib/p5.min.js"></script>
  <script src="../lib/p5.sound.min.js"></script>
  <script src="../lib/game-index.js"></script>
</head>
<body class="juego">
  <header>
    <a href="../">← Juegos</a>
    <h1>${escapeHtml(title)} <small>${id}</small></h1>
    <span>Hacé click en el juego para darle foco al teclado</span>
  </header>
  <main><div id="game"><p id="estado">Cargando…</p></div></main>
  <script>
    (async () => {
      const estado = document.getElementById('estado')
      try {
        const project = await (await fetch('game.json')).json()
        estado.remove()
        new LocalGame(project).start(document.getElementById('game'))
      } catch (error) {
        console.error(error)
        estado.textContent = 'Error al iniciar el juego: ' + error.message
      }
    })()
  </script>
</body>
</html>
`

const indexHtml = games => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Juegos · PdeP Lunes</title>
  <link rel="stylesheet" href="lib/juegos.css" />
</head>
<body class="indice">
  <main>
    <p><a href="/bitacora">← Bitácora</a></p>
    <h1>Juegos en Wollok</h1>
    <p>Trabajos prácticos de objetos — Paradigmas de Programación, cursada de los lunes.</p>
    <ul>
${games.map(g => `      <li><a href="${g.id}/"><strong>${escapeHtml(g.title)}</strong><span>${g.id}</span></a></li>`).join('\n')}
    </ul>
  </main>
</body>
</html>
`

const css = `:root { color-scheme: light dark; --bg: #f6f6f4; --fg: #1d1d1b; --muted: #6b6b66; --card: #fff; --line: #e2e2dc; --accent: #7a3cff; }
@media (prefers-color-scheme: dark) { :root { --bg: #151514; --fg: #ededea; --muted: #9a9a94; --card: #1f1f1d; --line: #33332f; --accent: #a98bff; } }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--fg); }
a { color: var(--accent); }
.indice main { max-width: 640px; margin: 0 auto; padding: 48px 16px; }
.indice ul { list-style: none; padding: 0; display: grid; gap: 12px; }
.indice li a { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 16px 20px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; text-decoration: none; color: var(--fg); }
.indice li a:hover { border-color: var(--accent); }
.indice li span { color: var(--muted); font-variant-numeric: tabular-nums; }
.juego header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 24px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.juego h1 { margin: 0; font-size: 1.1rem; }
.juego h1 small { color: var(--muted); font-weight: normal; margin-left: 6px; }
.juego header span { color: var(--muted); font-size: .85rem; margin-left: auto; }
.juego main { display: flex; justify-content: center; padding: 16px; }
.juego canvas { width: auto !important; height: auto !important; max-width: 100%; max-height: calc(100dvh - 90px); image-rendering: pixelated; }
.juego #estado { color: var(--muted); }
`

fs.rmSync(dist, { recursive: true, force: true })
fs.mkdirSync(path.join(dist, 'lib'), { recursive: true })
const runtime = findRuntime()
for (const f of ['p5.min.js', 'p5.sound.min.js', 'game-index.js']) fs.copyFileSync(path.join(runtime, f), path.join(dist, 'lib', f))
fs.writeFileSync(path.join(dist, 'lib', 'juegos.css'), css)
fs.writeFileSync(path.join(dist, '.nojekyll'), '')

const built = juegos.map(buildGame)
fs.writeFileSync(path.join(dist, 'index.html'), indexHtml(built))
console.log(`\nListo: ${path.relative(process.cwd(), dist)}/`)
