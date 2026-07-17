import { Resend } from "resend";

// TODO: Set RESEND_FROM_EMAIL ke alamat domain yang sudah diverifikasi di Resend
// (mis. noreply@wealth.velrox.cloud) saat production. Default onboarding@resend.dev
// hanya untuk development/testing Resend.
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY tidak diset — tidak bisa mengirim email",
    );
  }
  return new Resend(apiKey);
}

async function sendResendEmail({
  to,
  subject,
  html,
  failureLabel,
}: {
  to: string;
  subject: string;
  html: string;
  failureLabel: string;
}): Promise<void> {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Gagal mengirim ${failureLabel}: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(
      `Gagal mengirim ${failureLabel}: Resend tidak mengembalikan ID email`,
    );
  }
}

function buildPasswordResetHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="id">
  <body style="font-family: sans-serif; line-height: 1.5; color: #111;">
    <p>Halo,</p>
    <p>Kami menerima permintaan untuk mereset kata sandi akun Wealth Checker Anda.</p>
    <p>
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 16px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
        Reset Kata Sandi
      </a>
    </p>
    <p>Atau salin tautan berikut ke browser:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>Tautan ini berlaku selama 1 jam. Jika Anda tidak meminta reset, abaikan email ini.</p>
  </body>
</html>`;
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  await sendResendEmail({
    to,
    subject: "Reset Kata Sandi Wealth Checker",
    html: buildPasswordResetHtml(resetUrl),
    failureLabel: "email reset password",
  });
}

function buildVerificationHtml(verifyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="id">
  <body style="font-family: sans-serif; line-height: 1.5; color: #111;">
    <p>Halo,</p>
    <p>Terima kasih sudah mendaftar di Wealth Checker. Silakan verifikasi email kamu untuk mengaktifkan akun.</p>
    <p>
      <a href="${verifyUrl}" style="display: inline-block; padding: 10px 16px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
        Verifikasi Email
      </a>
    </p>
    <p>Atau salin tautan berikut ke browser:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>Tautan ini berlaku selama 1 jam. Jika kamu tidak mendaftar, abaikan email ini.</p>
  </body>
</html>`;
}

export async function sendVerificationEmail({
  to,
  verifyUrl,
}: {
  to: string;
  verifyUrl: string;
}): Promise<void> {
  await sendResendEmail({
    to,
    subject: "Verifikasi Email Wealth Checker",
    html: buildVerificationHtml(verifyUrl),
    failureLabel: "email verifikasi",
  });
}
