// Public license STATUS endpoint — powers the /license lock screen and lets
// the visitor-facing page self-recover as soon as the gate reopens.

import { NextResponse } from "next/server";
import { describeGate, describeTrial } from "@/lib/licensing";

export async function GET() {
  const gate = await describeGate();
  const trial = await describeTrial().catch(() => null);
  return NextResponse.json(
    { ok: true, ...gate, trial: trial ?? undefined },
    { headers: { "Cache-Control": "no-store" } }
  );
}
