import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-session-file',
      configureServer(server) {
        const sessionDirectory = resolve(process.cwd(), 'session')
        const sessionFile = resolve(sessionDirectory, 'session.json')

        server.middlewares.use('/api/session', async (request, response) => {
          if (request.method === 'GET') {
            try {
              const contents = await readFile(sessionFile, 'utf8')
              response.statusCode = 200
              response.setHeader('Content-Type', 'application/json')
              response.end(contents)
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                response.statusCode = 404
                response.end()
                return
              }
              response.statusCode = 500
              response.end('Unable to read session file')
            }
            return
          }

          if (request.method !== 'POST') {
            response.statusCode = 405
            response.end()
            return
          }

          const chunks: Buffer[] = []
          for await (const chunk of request) chunks.push(Buffer.from(chunk))
          try {
            const session = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            await mkdir(sessionDirectory, { recursive: true })
            await writeFile(sessionFile, JSON.stringify(session, null, 2), 'utf8')
            response.statusCode = 204
            response.end()
          } catch {
            response.statusCode = 400
            response.end('Invalid session data')
          }
        })
      },
    },
  ],
})
