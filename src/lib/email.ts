import nodemailer from 'nodemailer'

function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.EMAIL_HOST) return null
  const host = process.env.EMAIL_HOST
  const port = process.env.EMAIL_PORT
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS
  const portNum = Number(port) || 587
  return nodemailer.createTransport({
    host,
    port: portNum,
    secure: portNum === 465,
    auth: { user, pass },
  })
}

/**
 * Returns the OTP string when no email transporter is configured (dev/no-smtp mode),
 * so callers can include it in the API response for testing. Returns null when email was sent.
 */
export async function sendOTPEmail(
  to: string,
  otp: string,
  type: 'email_verify' | 'login'
): Promise<string | null> {
  const subject =
    type === 'email_verify'
      ? 'Verify your email — SchoolVoting'
      : 'Login verification code — SchoolVoting'

  const purposeText =
    type === 'email_verify' ? 'verify your email address' : 'complete your login'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#4F46E5;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:1.75rem;font-weight:700;letter-spacing:0.02em;">SchoolVoting</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 24px;">
              <p style="margin:0 0 24px;color:#374151;font-size:1rem;line-height:1.6;">
                Your verification code to <strong>${purposeText}</strong>:
              </p>
              <div style="text-align:center;margin:0 0 24px;">
                <div style="display:inline-block;background:#f3f4f6;border-radius:12px;padding:20px 40px;font-size:2.5rem;font-weight:700;letter-spacing:0.3em;color:#1f2937;font-family:monospace;">
                  ${otp}
                </div>
              </div>
              <p style="margin:0 0 8px;color:#6b7280;font-size:0.875rem;text-align:center;">
                This code expires in <strong>10 minutes</strong>.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 40px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:0.8rem;text-align:center;">
                If you did not request this, please ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const transporter = getTransporter()

  if (!transporter) {
    console.log('\n' + '='.repeat(60))
    console.log('  DEV MODE — OTP EMAIL (no EMAIL_HOST configured)')
    console.log('='.repeat(60))
    console.log(`  To:      ${to}`)
    console.log(`  Type:    ${type}`)
    console.log(`  OTP:     ${otp}`)
    console.log('='.repeat(60) + '\n')
    return otp
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to,
      subject,
      html,
    })
  } catch (err) {
    console.error('[sendOTPEmail] SMTP delivery failed:', err)
  }
  return null
}
