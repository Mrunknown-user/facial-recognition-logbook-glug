"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CalendarDays, Clock, Trash2, Users, Timer } from "lucide-react"

interface AttendanceLog {
  id: string
  user_id: string
  action: "enter" | "exit"
  timestamp: string
  confidence_score: number
  users: {
    user_id: string
    name: string
    image_url: string
  }
}

interface Session {
  entered: string
  exited?: string
  confidence_score: number
}

export default function AdminAttendanceManagement() {
  const [attendance, setAttendance] = useState<AttendanceLog[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState(false)

  const loadAttendance = async (date: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/attendance?date=${date}`)
      if (response.ok) {
        const data = await response.json()
        setAttendance(data)
      }
    } catch (error) {
      console.error("Failed to load attendance:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAttendance(selectedDate)
  }, [selectedDate])

  const formatTime = (timeString?: string) => {
    if (!timeString) return "—"
    return new Date(timeString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  const formatDuration = (start?: string, end?: string) => {
    if (!start || !end) return "—"
    const diffMs = new Date(end).getTime() - new Date(start).getTime()
    if (diffMs <= 0) return "—"
    const mins = Math.floor(diffMs / 60000)
    const hrs = Math.floor(mins / 60)
    const remMins = mins % 60
    return hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800"
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800"
    return "bg-red-100 text-red-800"
  }

  // Group raw logs into enter/exit sessions
  const groupSessions = (logs: AttendanceLog[]): Session[] => {
    const sessions: Session[] = []
    let current: Session | null = null

    for (const log of logs) {
      if (log.action === "enter") {
        if (current) sessions.push(current)
        current = { entered: log.timestamp, confidence_score: log.confidence_score }
      }
      if (log.action === "exit" && current) {
        current.exited = log.timestamp
        sessions.push(current)
        current = null
      }
    }
    if (current) sessions.push(current)
    return sessions
  }

  const deleteRecord = async (id: string) => {
    if (!confirm("Are you sure you want to delete this attendance log?")) return
    try {
      const response = await fetch(`/api/attendance/${id}`, { method: "DELETE" })
      if (response.ok) loadAttendance(selectedDate)
    } catch (error) {
      console.error("Failed to delete attendance:", error)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Attendance Management
          </CardTitle>
          <CardDescription>View and manage daily attendance records</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Select Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto"
              />
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{attendance.length} Logs</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading attendance records...</div>
          ) : attendance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No attendance logs found for {selectedDate}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.values(
                attendance.reduce((acc: Record<string, AttendanceLog[]>, log) => {
                  const key = log.user_id
                  if (!acc[key]) acc[key] = []
                  acc[key].push(log)
                  return acc
                }, {})
              ).map((logs) => {
                const user = logs[0].users
                const sessions = groupSessions(
                  logs.sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))
                )

                return (
                  <Card key={user.user_id} className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.image_url || "/placeholder.svg"} alt={user.name} />
                        <AvatarFallback>
                          {user.name.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold">{user.name}</div>
                        <div className="text-sm text-muted-foreground">ID: {user.user_id}</div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {sessions.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between border-b pb-1">
                          <div className="flex flex-col text-sm">
                            <span>
                              <Clock className="inline h-3 w-3 mr-1" />
                              Entered: {formatTime(s.entered)}
                            </span>
                            <span>
                              <Clock className="inline h-3 w-3 mr-1" />
                              Exited: {formatTime(s.exited)}
                            </span>
                            <span>
                              <Timer className="inline h-3 w-3 mr-1" />
                              Stayed: {formatDuration(s.entered, s.exited)}
                            </span>
                          </div>
                          <Badge variant="secondary" className={getConfidenceColor(s.confidence_score)}>
                            {(s.confidence_score * 100).toFixed(1)}% confidence
                          </Badge>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 flex gap-2">
                      {logs.map((log) => (
                        <Button
                          key={log.id}
                          onClick={() => deleteRecord(log.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ))}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
