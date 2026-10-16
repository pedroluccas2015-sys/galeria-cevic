// Initial owner authorization is complete. Reconnection is a maintenance action,
// not a capability available to gallery administrators. Keep this route closed.
export default function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(404).end();
}
