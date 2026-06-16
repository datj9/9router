import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";
import { sendEmail } from "@/lib/email/mailer";

export const dynamic = "force-dynamic";

// POST /api/settings/email-test - Send a test email using either the saved
// email settings or unsaved values supplied in the request body. Secrets left
// blank in the body fall back to the stored value so the user can test without
// re-entering them.
export async function POST(request) {
  try {
    const body = await request.json();
    const { to } = body;

    if (!to) {
      return NextResponse.json({ error: "Recipient address is required" }, { status: 400 });
    }

    const stored = await getSettings();
    const overrideSettings = {
      ...stored,
      emailEnabled: true,
      emailProvider: body.emailProvider || stored.emailProvider,
      emailFromAddress: body.emailFromAddress ?? stored.emailFromAddress,
      emailFromName: body.emailFromName ?? stored.emailFromName,
      resendApiKey: body.resendApiKey?.trim() || stored.resendApiKey,
      smtpHost: body.smtpHost ?? stored.smtpHost,
      smtpPort: body.smtpPort ?? stored.smtpPort,
      smtpSecure: body.smtpSecure ?? stored.smtpSecure,
      smtpUser: body.smtpUser ?? stored.smtpUser,
      smtpPassword: body.smtpPassword?.trim() || stored.smtpPassword,
    };

    const result = await sendEmail(
      {
        to,
        subject: "9Router email test",
        html: "<p>This is a test email from 9Router. Your email configuration works.</p>",
        text: "This is a test email from 9Router. Your email configuration works.",
      },
      overrideSettings
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Failed to send test email" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.log("Error sending test email:", error);
    return NextResponse.json({ error: "Failed to send test email" }, { status: 500 });
  }
}
