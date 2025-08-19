"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarDays, Clock, Edit, Trash2, Users } from "lucide-react"

interface AttendanceRecord {
  id: string
  user_id: string
  date: string
  time_in: string
  time_out: string | null
  status: string
  confidence_score: number
  users: {
    user_id: string
    name: string
    image_url: string
  }
}

export default function AdminAttendanceManagement() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState(false)
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null)
  const [editStatus, setEditStatus] = useState("")
  const [editTimeIn, setEditTimeIn] = useState("")
  const [editTimeOut, setEditTimeOut] = useState("")

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

  const formatTime = (timeString?: string | null) => {
    if (!timeString) return "—"
    return new Date(timeString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800"
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800"
    return "bg-red-100 text-red-800"
  }

  const handleEdit = (record: AttendanceRecord) => {
    setEditingRecord(record)
    setEditStatus(record.status)
    setEditTimeIn(new Date(record.time_in).toTimeString().slice(0, 5))
    setEditTimeOut(record.time_out ? new Date(record.time_out).toTimeString().slice(0, 5) : "")
  }

  const saveEdit = async () => {
    if (!editingRecord) return

    try {
      const timeInIso = new Date(`${editingRecord.date}T${editTimeIn || "00:00"}:00`).toISOString()
      const timeOutIso = editTimeOut ? new Date(`${editingRecord.date}T${editTimeOut}:00`).toISOString() : null

      const response = await fetch(`/api/attendance/${editingRecord.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: editStatus,
          time_in: timeInIso,
          time_out: timeOutIso,
        }),
      })

      if (response.ok) {
        loadAttendance(selectedDate)
        setEditingRecord(null)
      }
    } catch (error) {
      console.error("Failed to update attendance:", error)
    }
  }

  const deleteRecord = async (id: string) => {
    if (!confirm("Are you sure you want to delete this attendance record?")) return

    try {
      const response = await fetch(`/api/attendance/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        loadAttendance(selectedDate)
      }
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
                <span>{attendance.length} Records</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading attendance records...</div>
          ) : attendance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No attendance records found for {selectedDate}</div>
          ) : (
            <div className="space-y-3">
              {attendance.map((record) => (
                <Card key={record.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={record.users.image_url || "/placeholder.svg"} alt={record.users.name} />
                        <AvatarFallback>
                          {record.users.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold">{record.users.name}</div>
                        <div className="text-sm text-muted-foreground">ID: {record.users.user_id}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          Entered: {formatTime(record.time_in)}
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          Exited: {formatTime(record.time_out)}
                        </div>
                        <Badge variant="secondary" className={getConfidenceColor(record.confidence_score)}>
                          {(record.confidence_score * 100).toFixed(1)}% confidence
                        </Badge>
                      </div>

                      <Badge variant="default" className={record.status === "exited" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                        {record.status}
                      </Badge>

                      <div className="flex gap-1">
                        <Dialog open={editingRecord?.id === record.id} onOpenChange={(open) => !open && setEditingRecord(null)}>
                          <DialogTrigger asChild>
                            <Button onClick={() => handleEdit(record)} variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Attendance</DialogTitle>
                              <DialogDescription>Modify attendance record for {record.users.name}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={editStatus} onValueChange={setEditStatus}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="entered">Entered</SelectItem>
                                    <SelectItem value="exited">Exited</SelectItem>
                                    <SelectItem value="present">Present</SelectItem>
                                    <SelectItem value="late">Late</SelectItem>
                                    <SelectItem value="absent">Absent</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Entered Time</Label>
                                  <Input type="time" value={editTimeIn} onChange={(e) => setEditTimeIn(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Exited Time (optional)</Label>
                                  <Input type="time" value={editTimeOut} onChange={(e) => setEditTimeOut(e.target.value)} />
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <Button onClick={saveEdit} className="w-full">
                                  Save Changes
                                </Button>
                                <Button variant="outline" className="w-full" onClick={() => setEditingRecord(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Button
                          onClick={() => deleteRecord(record.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
