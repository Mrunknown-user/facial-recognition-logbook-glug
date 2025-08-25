import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// GET all attendance for a given date (default: today)
export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: attendance, error } = await supabase
    .from("attendance")
    .select(`
      *,
      users (
        user_id,
        name,
        image_url
      )
    `)
    .gte("timestamp", startOfDay.toISOString())
    .lte("timestamp", endOfDay.toISOString())
    .order("timestamp", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(attendance);
}

/**
 * POST body:
 * {
 *   user_id: string,
 *   confidence_score?: number,
 *   action: "enter" | "exit"
 * }
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  try {
    const { user_id, confidence_score, action } = await request.json();
    if (!user_id || !["enter", "exit"].includes(action)) {
      return NextResponse.json({ error: "user_id and valid action are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("attendance")
      .insert([{
        user_id,
        confidence_score: confidence_score ?? null,
        action,
        timestamp: new Date().toISOString()
      }])
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data?.[0] ?? null);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
