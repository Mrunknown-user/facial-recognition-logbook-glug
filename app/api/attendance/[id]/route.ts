import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// GET all attendance logs for a specific user (optionally filter by date)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  let query = supabase
    .from("attendance")
    .select("*")
    .eq("user_id", params.id)
    .order("timestamp", { ascending: true });

  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    query = query
      .gte("timestamp", startOfDay.toISOString())
      .lte("timestamp", endOfDay.toISOString());
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// PUT: only for fixing wrong logs (optional)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const id = params.id;

  try {
    const body = await request.json() as {
      action?: "enter" | "exit";
      confidence_score?: number;
      timestamp?: string;
    };

    const payload: Record<string, any> = {};
    if (body.action) payload.action = body.action;
    if (typeof body.confidence_score === "number") payload.confidence_score = body.confidence_score;
    if (typeof body.timestamp === "string") payload.timestamp = body.timestamp;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("attendance")
      .update(payload)
      .eq("id", id)
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data?.[0] ?? null);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

// DELETE: remove a wrong log
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const id = params.id;

  const { error } = await supabase.from("attendance").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
