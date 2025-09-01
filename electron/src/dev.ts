import { spawn } from 'node:child_process'
import path from 'node:path'

// Simple dev runner: run Electron pointing to Vite dev server using ts-node
const electronBin = path.join(process.cwd(), 'node_modules', '.bin', 'electron')

const child = spawn(electronBin, [path.join('src', 'main.ts')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: 'http://localhost:5173',
    NODE_OPTIONS: '--loader ts-node/esm'
  }
})

child.on('exit', code => {
  process.exit(code ?? 0)
})


