type SendResetArgs = {
  to: string;
  resetLink: string;
};

export async function sendPasswordResetEmail({ to, resetLink }: SendResetArgs) {
  // Replace this with your provider implementation
  // Example HTML template:
  const html = `
    <p>You requested a password reset.</p>
    <p><a href="${resetLink}">Reset Your Password</a></p>
    <p>If you didn’t request this, you can ignore this email.</p>
  `;

  // TODO: send via your email service
  // e.g. nodemailer / resend / postmark
  console.log("[RESET EMAIL]", { to, resetLink });

  // Throw if provider fails (so you can log/monitor)
}
