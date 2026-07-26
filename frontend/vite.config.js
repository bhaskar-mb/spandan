import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const basePath = env.VITE_BASE_PATH || ''
  const formattedBasePath = basePath ? '/' + basePath.replace(/^\//, '').replace(/\/+$/, '') : ''

  const apiPath = formattedBasePath ? formattedBasePath + '/api' : '/api'
  const socketPath = formattedBasePath ? formattedBasePath + '/socket.io' : '/socket.io'

  // Redirect /spandan -> /spandan/ so users don't see the raw Vite base-path warning
  const baseRedirectPlugin = () => ({
    name: 'base-redirect',
    configureServer(server) {
      if (formattedBasePath) {
        server.middlewares.use((req, res, next) => {
          if (req.url === formattedBasePath) {
            res.writeHead(302, { Location: formattedBasePath + '/' });
            res.end();
            return;
          }
          next();
        });
      }
    }
  });

  return {
    plugins: [baseRedirectPlugin(), react()],
    root: '.',
    base: formattedBasePath ? formattedBasePath + '/' : './',
    build: {
      outDir: '../dist',
      emptyOutDir: true
    },
    server: {
      port: 5173,
      proxy: {
        [apiPath]: {
          target: 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (path) => formattedBasePath ? path.replace(new RegExp('^' + formattedBasePath + '/api'), '/api') : path
        },
        [socketPath]: {
          target: 'http://localhost:3001',
          ws: true,
          rewrite: (path) => formattedBasePath ? path.replace(new RegExp('^' + formattedBasePath + '/socket.io'), '/socket.io') : path
        }
      }
    }
  }
})
