import { NextRequest, NextResponse } from "next/server";
import {
  generateTotpSecret,
  getAuthSettings,
  isAuthenticated,
  setTwoFactor,
  updateAdminPassword,
  verifyAdminPassword,
  verifyTotp,
} from "@/lib/auth";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getAuthSettings();
  return NextResponse.json({
    ok: true,
    twoFactorEnabled: settings.twoFactorEnabled && !!settings.twoFactorSecret,
    passwordManagedInDatabase: !!settings.passwordHash,
  });
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const action = body?.action;

  if (action === "generate-2fa") {
    const secret = generateTotpSecret();
    const issuer = "Portfolio CMS";
    const account = "admin";
    const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    return NextResponse.json({ ok: true, secret, uri });
  }

  if (action === "enable-2fa") {
    const secret = typeof body.secret === "string" ? body.secret : "";
    const code = typeof body.code === "string" ? body.code : "";
    if (!secret || !verifyTotp(code, secret)) {
      return NextResponse.json({ ok: false, error: "Invalid verification code" }, { status: 400 });
    }
    await setTwoFactor(secret, true);
    return NextResponse.json({ ok: true });
  }

  if (action === "disable-2fa") {
    const settings = await getAuthSettings();
    const code = typeof body.code === "string" ? body.code : "";
    if (settings.twoFactorEnabled && settings.twoFactorSecret && !verifyTotp(code, settings.twoFactorSecret)) {
      return NextResponse.json({ ok: false, error: "Invalid verification code" }, { status: 400 });
    }
    await setTwoFactor(null, false);
    return NextResponse.json({ ok: true });
  }

  if (action === "change-password") {
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!(await verifyAdminPassword(currentPassword))) {
      return NextResponse.json({ ok: false, error: "Current password is incorrect" }, { status: 401 });
    }
    if (newPassword.length < 12) {
      return NextResponse.json({ ok: false, error: "Password must be at least 12 characters" }, { status: 400 });
    }
    await updateAdminPassword(newPassword);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
