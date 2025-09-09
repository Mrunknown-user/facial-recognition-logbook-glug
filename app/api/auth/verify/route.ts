// app/api/auth/verify/route.ts

import { type NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"



const secret = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key")

export async function GET(request: NextRequest) {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser();
  try {
    const token = request.cookies.get("admin-token")?.value

    if (!token) {
      return NextResponse.json({ error: "No token found" }, { status: 401 })
    }

    const { payload } = await jwtVerify(token, secret)
    return NextResponse.json({ admin: { id: payload.adminId, username: payload.username } })
  } catch (error) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }
}
