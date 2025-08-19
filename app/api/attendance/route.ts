import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0]

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
    .eq("date", date)
    .order("time_in", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(attendance)
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
  const supabase = createServerClient()

  try {
    const { user_id, confidence_score, action } = await request.json()
    if (!user_id || !action) {
      return NextResponse.json({ error: "user_id and action are required" }, { status: 400 })
    }

    const today = new Date().toISOString().split("T")[0]

    if (action === "enter") {
      // Prevent duplicate entry for the same day
      const { data: existing } = await supabase
        .from("attendance")
        .select("id")
        .eq("user_id", user_id)
        .eq("date", today)
        .single()

      if (existing) {
        return NextResponse.json({ message: "Already marked entered today" }, { status: 200 })
      }

      const { data, error } = await supabase
        .from("attendance")
        .insert([{
          user_id,
          confidence_score: confidence_score ?? null,
          status: "entered",
          time_in: new Date().toISOString(),
          date: today
        }])
        .select()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data?.[0] ?? null)
    }

    if (action === "exit") {
      // Find today's entry record
      const { data: existing, error: findErr } = await supabase
        .from("attendance")
        .select("id, time_out")
        .eq("user_id", user_id)
        .eq("date", today)
        .single()

      if (findErr || !existing) {
        return NextResponse.json({ error: "No entry record found to mark exit" }, { status: 400 })
      }
      if (existing.time_out) {
        return NextResponse.json({ message: "Already marked exited today" }, { status: 200 })
      }

      const { data, error } = await supabase
        .from("attendance")
        .update({
          status: "exited",
          time_out: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data?.[0] ?? null)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}
