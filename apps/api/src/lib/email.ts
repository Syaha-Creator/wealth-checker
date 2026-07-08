import { Resend } from "resend";

// TODO: Set RESEND_FROM_EMAIL ke alamat domain yang sudah diverifikasi di Resend
// (mis. noreply@wealth.velrox.cloud) saat production. Default onboarding@resend.dev
// hanya untuk development/testing Resend.
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY tidak diset — tidak bisa mengirim email reset password",
    );
  }
  return new Resend(apiKey);
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
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Reset Kata Sandi Wealth Checker",
    html: buildPasswordResetHtml(resetUrl),
  });

  if (error) {
    throw new Error(`Gagal mengirim email reset password: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(
      "Gagal mengirim email reset password: Resend tidak mengembalikan ID email",
    );
  }
}
