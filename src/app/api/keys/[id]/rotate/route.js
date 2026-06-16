import { NextResponse } from "next/server";
import { getApiKeyById, rotateApiKey, markApiKeyNotified } from "@/lib/localDb";
import { sendKeyRotationEmail } from "@/lib/email/mailer";

// POST /api/keys/[id]/rotate - Generate a new key value, keep metadata, and
// notify the key manager by email (if configured) with the new key.
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    const existing = await getApiKeyById(id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const rotated = await rotateApiKey(id);
    if (!rotated) {
      return NextResponse.json({ error: "Failed to rotate key" }, { status: 500 });
    }

    const current = rotated.current;

    // Notify the manager with the new key. Rotation succeeds regardless of
    // email outcome; we surface the email status in the response.
    let notification = { attempted: false, ok: false, error: null };
    if (current.managerEmail) {
      notification.attempted = true;
      const result = await sendKeyRotationEmail({
        to: current.managerEmail,
        managerName: current.managerName,
        keyName: current.name,
        newKey: current.key,
        expiresAt: current.expiresAt,
      });
      notification.ok = result.ok;
      notification.error = result.error || null;
      if (result.ok) {
        await markApiKeyNotified(id);
        current.lastNotifiedAt = new Date().toISOString();
      }
    }

    return NextResponse.json({
      key: current,
      newKey: current.key,
      notification,
    });
  } catch (error) {
    console.log("Error rotating key:", error);
    return NextResponse.json({ error: "Failed to rotate key" }, { status: 500 });
  }
}
