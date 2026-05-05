export default function handler(req, res) {
  res.status(200).json({
    region: process.env.VERCEL_REGION || 'not set',
    node_env: process.env.NODE_ENV || 'not set'
  });
}
