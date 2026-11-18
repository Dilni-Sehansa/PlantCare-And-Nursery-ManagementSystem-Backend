
import * as nodemailer from "nodemailer";

export const sendVerificationEmail = async (
  email: string,
  firstName: string,
  verificationLink: string
): Promise<void> => {

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    EMAIL_FROM,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
    throw new Error("Email configuration is missing");
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const safeName = firstName.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });

  await transporter.sendMail({

    from: `"NURIX Plant Care" <${EMAIL_FROM}>`,

    to: email,

    subject: "Verify Your NURIX Account",

    html: `
      <!DOCTYPE html>
      <html>
      <body style="
        font-family: Arial, sans-serif;
        background-color: #f4f7f4;
        padding: 30px;
      ">

        <div style="
          max-width: 550px;
          margin: auto;
          background: white;
          padding: 30px;
          border-radius: 12px;
        ">

          <h1 style="
            color: #2e7d32;
            text-align: center;
          ">
            NURIX 🌱
          </h1>

          <h2>Hello ${safeName},</h2>

          <p>
            Thank you for registering with NURIX
            Plant Care and Nursery Management System.
          </p>

          <p>
            Please verify your email address
            by clicking the button below.
          </p>

          <div style="text-align: center; margin: 30px 0;">

            <a
              href="${verificationLink}"
              style="
                background-color: #2e7d32;
                color: white;
                padding: 14px 28px;
                text-decoration: none;
                border-radius: 6px;
                display: inline-block;
                font-weight: bold;
              "
            >
              Verify My Email
            </a>

          </div>

          <p style="color: #666;">
            This verification link will expire in 15 minutes.
          </p>

          <p>
            If you did not create this account,
            please ignore this email.
          </p>

          <hr style="border: 1px solid #eee;">

          <p style="
            color: #777;
            text-align: center;
            font-size: 12px;
          ">
            © NURIX Plant Care and Nursery Management System
          </p>

        </div>

      </body>
      </html>
    `,
  });
};
