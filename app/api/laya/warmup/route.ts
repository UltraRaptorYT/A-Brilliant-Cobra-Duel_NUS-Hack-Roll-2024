import { NextResponse } from "next/server";
import { loadLaya } from "@/lib/laya";
export const runtime = "nodejs";
export async function POST() {
  try {
    await loadLaya();
    return NextResponse.json({ ready: true });
  } catch {
    return NextResponse.json(
      { error: "Could not load the local Laya model." },
      { status: 503 },
    );
  }
}
