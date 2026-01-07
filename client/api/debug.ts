export default function handler(req: any, res: any) {
  return res.json({
    ok: true,
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      hasJwt: !!process.env.JWT_SECRET,
      hasGoogle: !!process.env.GOOGLE_CREDENTIALS_JSON,
    },
    time: new Date().toISOString()
  });
}
