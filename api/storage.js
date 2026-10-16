import { isConfigured } from '../server/drive.js';
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  return res.status(200).json({ provider: 'google-drive', ready: isConfigured(), maxFileSize: 512 * 1024 * 1024 });
}
