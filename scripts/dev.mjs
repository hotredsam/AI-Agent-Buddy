import { spawn } from 'child_process'
import { createServer } from 'vite'
import { execSync } from 'child_process'
import { createRequire } from 'module'

async function main() {
  // Build main process and preload
  console.log('Building main process...')
  execSync('npx tsc -p tsconfig.main.json', { stdio: 'inherit' })
  console.log('Building preload script...')
  execSync('npx tsc -p tsconfig.preload.json', { stdio: 'inherit' })

  // Start Vite dev server
  const server = await createServer({
    configFile: 'vite.config.ts',
  })
  await server.listen()
  const address = server.httpServer.address()
  const port = typeof address === 'object' ? address.port : 5173
  console.log(`Vite dev server running on http://localhost:${port}`)

  // Resolve electron binary directly — avoids shell:true deprecation warning
  const require = createRequire(import.meta.url)
  const electronPath = require('electron')

  // Start Electron, pass actual port via env
  const electron = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development', DEV_SERVER_PORT: String(port) },
  })

  electron.on('close', () => {
    server.close()
    process.exit()
  })
}

main().catch(console.error)
