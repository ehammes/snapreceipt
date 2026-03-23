import { Resend } from 'resend';

// From address — update to your verified Resend domain in production
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || 'SnapReceipt <onboarding@resend.dev>';

export const sendMagicLink = async (email: string, link: string): Promise<void> => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: 'Your SnapReceipt login link',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 28px; font-weight: 800; color: #1e293b; margin: 0;">
            Snap<span style="color: #2563eb;">Receipt</span>
          </h1>
        </div>
        <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Log in to your account</h2>
        <p style="color: #64748b; margin-bottom: 32px; line-height: 1.6;">
          Click the button below to log in. This link expires in <strong>1 hour</strong> and can only be used once.
        </p>
        <a href="${link}" style="display: inline-block; background: #2563eb; color: #ffffff; font-weight: 600; font-size: 16px; text-decoration: none; padding: 14px 32px; border-radius: 10px; margin-bottom: 32px;">
          Log in to SnapReceipt
        </a>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          If you didn't request this, you can safely ignore this email.
          <br />This link will expire in 1 hour.
        </p>
      </div>
    `,
  });
};
