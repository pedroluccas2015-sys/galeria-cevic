import { isConfigured, isAdmin, checkPassword, sign, sameOrigin, jsonError } from '../server/drive.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.json({ authenticated: isAdmin(req) });
  if (!sameOrigin(req)) return jsonError(res, 403, 'Origem não autorizada.');
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', 'cevic_admin=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
    return res.json({ authenticated: false });
  }
  if (req.method !== 'POST') return res.status(405).end();
  if (!isConfigured()) return jsonError(res, 503, 'A integração com o Google Drive ainda não foi ativada.');
  if (!checkPassword(req.body?.password)) {
    // Apply the same delay to failed login attempts; never expose the password in the client bundle.
    await new Promise(resolve => setTimeout(resolve, 1000));
    return jsonError(res, 401, 'Senha incorreta.');
  }
  const token = sign({ role: 'admin', exp: Date.now() + 8 * 60 * 60 * 1000 });
  res.setHeader('Set-Cookie', `cevic_admin=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);
  return res.json({ authenticated: true });
}
