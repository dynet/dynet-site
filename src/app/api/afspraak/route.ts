import { NextResponse } from "next/server";
import { getResend } from "@/lib/resend";
import {
  escapeHtml,
  checkRateLimit,
  getClientIp,
  isHoneypotFilled,
  isAllowedOrigin,
  isValidEmail,
  isValidPhone,
} from "@/lib/security";

const EMAIL_FROM = process.env.EMAIL_FROM || "Dynet Website <onboarding@resend.dev>";
const AFSPRAAK_EMAIL_TO = process.env.AFSPRAAK_EMAIL_TO || "bevestigingen@dynet.nl";

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const ip = getClientIp(request);
    const rate = checkRateLimit(ip);
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Te veel aanvragen, probeer het later opnieuw" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
      );
    }
    const data = await request.json();
    if (isHoneypotFilled(data)) {
      return NextResponse.json({ success: true });
    }
    const { voornaam, achternaam, telefoon, email, straatnaam, huisnr, postcode, woonplaats, eigenaar, bevestiging } = data;

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Ongeldig e-mailadres" }, { status: 400 });
    }
    if (telefoon && !isValidPhone(telefoon)) {
      return NextResponse.json({ error: "Ongeldig telefoonnummer" }, { status: 400 });
    }

    const html = `
      <h2>Afspraakbevestiging ontvangen</h2>
      <p><strong>Naam:</strong> ${escapeHtml(voornaam)} ${escapeHtml(achternaam)}</p>
      <p><strong>Telefoon:</strong> ${escapeHtml(telefoon || "-")}</p>
      <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
      <p><strong>Adres:</strong> ${escapeHtml(straatnaam)} ${escapeHtml(huisnr)}, ${escapeHtml(postcode)} ${escapeHtml(woonplaats)}</p>
      <p><strong>Eigenaar / Huurder:</strong> ${escapeHtml(eigenaar || "-")}</p>
      <p><strong>Afspraak bevestigd:</strong> ${escapeHtml(bevestiging || "-")}</p>
    `;

    const { error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to: AFSPRAAK_EMAIL_TO,
      replyTo: email,
      subject: `Afspraakbevestiging — ${voornaam} ${achternaam}`,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Versturen mislukt" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Afspraak API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
