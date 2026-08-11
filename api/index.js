import { app, ensureDbConnected } from '../backend/src/index.js'

export default async function handler(req, res) {
  await ensureDbConnected()
  return app(req, res)
}
