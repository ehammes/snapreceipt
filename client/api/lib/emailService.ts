import { Resend } from 'resend';

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

export interface SpendingSummaryData {
  totalSpent: number;
  receiptCount: number;
  categoryBreakdown: Array<{ category: string; totalSpent: number }>;
  topItems: Array<{ name: string; totalSpent: number; purchaseCount: number }>;
  frontendUrl: string;
}

export const sendSpendingSummary = async (email: string, data: SpendingSummaryData): Promise<void> => {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const topCats = data.categoryBreakdown.slice(0, 5);
  const topItems = data.topItems.slice(0, 3);

  const categoryRows = topCats
    .map(c => `<tr><td style="padding: 6px 0; color: #374151;">${c.category}</td><td style="padding: 6px 0; text-align: right; color: #374151; font-weight: 600;">$${c.totalSpent.toFixed(2)}</td></tr>`)
    .join('');

  const itemRows = topItems
    .map(i => `<li style="margin-bottom: 6px; color: #374151;">${i.name} <span style="color: #6b7280;">— $${i.totalSpent.toFixed(2)}</span></li>`)
    .join('');

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: 'Your SnapReceipt Spending Summary',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 28px; font-weight: 800; color: #1e293b; margin: 0;">
            Snap<span style="color: #2563eb;">Receipt</span>
          </h1>
        </div>
        <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 24px;">Your Spending Summary</h2>

        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
          <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">Total Spent</div>
          <div style="font-size: 36px; font-weight: 800; color: #1e293b;">$${data.totalSpent.toFixed(2)}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 8px;">${data.receiptCount} receipt${data.receiptCount !== 1 ? 's' : ''} scanned</div>
        </div>

        ${topCats.length > 0 ? `
        <h3 style="font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 12px;">Top Categories</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          ${categoryRows}
        </table>
        ` : ''}

        ${topItems.length > 0 ? `
        <h3 style="font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 12px;">Top Items</h3>
        <ul style="padding-left: 16px; margin-bottom: 24px;">
          ${itemRows}
        </ul>
        ` : ''}

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${data.frontendUrl}/receipts" style="display: inline-block; background: #2563eb; color: #ffffff; font-weight: 600; font-size: 16px; text-decoration: none; padding: 14px 32px; border-radius: 10px;">
            View Your Receipts
          </a>
        </div>

        <p style="color: #94a3b8; font-size: 13px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
          You received this because you requested a spending summary from SnapReceipt.
        </p>
      </div>
    `,
  });
};
