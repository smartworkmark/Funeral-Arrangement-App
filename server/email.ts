import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY environment variable not set - email functionality disabled");
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('SendGrid API key not configured');
    return false;
  }

  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      html: params.html,
    });
    return true;
  } catch (error: any) {
    console.error('SendGrid email error:', error);
    if (error.response && error.response.body && error.response.body.errors) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body.errors, null, 2));
    }
    return false;
  }
}

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
  const frontendUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
    : 'http://localhost:5000';
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
  
  const htmlContent = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
      <div style="background-color: #f8fafc; padding: 20px; text-align: center;">
        <h1 style="color: #1e293b; margin: 0;">FuneralFlow</h1>
      </div>
      <div style="padding: 20px; background-color: white;">
        <h2 style="color: #1e293b;">Password Reset Request</h2>
        <p>You requested to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
        </div>
        <p>If you didn't request this password reset, you can safely ignore this email.</p>
        <p>This link will expire in 1 hour.</p>
      </div>
      <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px;">
        <p>This email was sent from Funeralflow</p>
      </div>
    </div>
  `;

  const textContent = `
    Password Reset Request

    You requested to reset your password for FuneralFlow.
    
    Click this link to reset your password: ${resetUrl}
    
    If you didn't request this password reset, you can safely ignore this email.
    This link will expire in 1 hour.
  `;

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'mark@smartworkautomation.com';
  
  return await sendEmail({
    to: email,
    from: fromEmail,
    subject: 'Reset Your Password - FuneralFlow',
    text: textContent,
    html: htmlContent,
  });
}