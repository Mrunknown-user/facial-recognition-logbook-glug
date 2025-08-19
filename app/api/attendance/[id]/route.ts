import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const id = params.id

  try {
    const body = await request.json() as {
      status?: string
      time_in?: string
      time_out?: string | null
      confidence_score?: number
    }

    const payload: Record<string, any> = {}
    if (typeof body.status === "string") payload.status = body.status
    if (typeof body.time_in === "string") payload.time_in = body.time_in
    // allow clearing or setting time_out
    if (body.time_out === null) payload.time_out = null
    if (typeof body.time_out === "string") payload.time_out = body.time_out
    if (typeof body.confidence_score === "number") payload.confidence_score = body.confidence_score

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("attendance")
      .update(payload)
      .eq("id", id)
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data?.[0] ?? null)
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const id = params.id

  const { error } = await supabase.from("attendance").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
