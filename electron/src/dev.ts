import { spawn } from 'node:child_process'
import path from 'node:path'
import { execSync } from 'node:child_process'

// Simple dev runner: compile TypeScript then run Electron
console.log('Compiling TypeScript...')
execSync('tsc -b', { stdio: 'inherit', cwd: process.cwd() })

const electronBin = path.join(process.cwd(), 'node_modules', '.bin', 'electron')

const child = spawn(electronBin, ['dist/main.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: 'http://localhost:5173'
  }
})

child.on('exit', code => {
  process.exit(code ?? 0)
})
