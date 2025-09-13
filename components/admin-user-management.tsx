"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { getFaceDescriptor } from "@/lib/face-recognition"
import { supabase } from "@/lib/supabase"
import { UserPlus, Upload, Trash2, Users, Camera } from "lucide-react"
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs"

const supabaseClient = createPagesBrowserClient()

interface User {
  id: string
  user_id: string
  name: string
  image_url: string
  face_encoding: number[]
  created_at: string
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [userId, setUserId] = useState("")
  const [name, setName] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Load users from API
  const loadUsers = async () => {
    try {
      const response = await fetch("/api/users")
      if (response.ok) {
        const userData = await response.json()
        setUsers(userData)
      }
    } catch (error) {
      console.error("Failed to load users:", error)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // Image upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // ---------------- Camera Lifecycle ----------------
  useEffect(() => {
    if (!isCameraOpen) return

    console.log("🎥 Starting camera...")

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadeddata = () => {
            console.log("✅ Video ready:", videoRef.current?.videoWidth, "x", videoRef.current?.videoHeight)
            setIsReady(true)
          }
          videoRef.current.play().catch((err) => {
            console.warn("⚠️ Autoplay prevented:", err)
          })
          console.log("✅ Camera stream set")
        }
      })
      .catch((err) => {
        console.error("❌ Camera error:", err)
        setMessage({ type: "error", text: "Unable to access camera" })
      })

    return () => {
      console.log("🛑 Stopping camera...")
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setIsReady(false)
    }
  }, [isCameraOpen])

  const startCamera = () => setIsCameraOpen(true)
  const stopCamera = () => setIsCameraOpen(false)

  // ---------------- Capture Passport Image ----------------
  const captureImage = () => {
    if (!videoRef.current) {
      console.error("❌ No video element found")
      return
    }
    const video = videoRef.current

    console.log("📸 Attempting capture...")
    console.log("Video ready state:", video.readyState)
    console.log("Video dimensions:", video.videoWidth, "x", video.videoHeight)

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn("⚠️ Camera not ready yet, please try again")
      setMessage({ type: "error", text: "Camera not ready yet, please try again" })
      return
    }

    const targetWidth = 700
    const targetHeight = 900
    const canvas = document.createElement("canvas")
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext("2d")

    if (ctx) {
      console.log("🖼 Cropping with aspect ratio 7:9")
      const videoAspect = video.videoWidth / video.videoHeight
      const targetAspect = targetWidth / targetHeight

      let sx = 0,
        sy = 0,
        sWidth = video.videoWidth,
        sHeight = video.videoHeight

      if (videoAspect > targetAspect) {
        sWidth = video.videoHeight * targetAspect
        sx = (video.videoWidth - sWidth) / 2
        console.log("➡️ Cropping sides:", { sx, sWidth })
      } else {
        sHeight = video.videoWidth / targetAspect
        sy = (video.videoHeight - sHeight) / 2
        console.log("⬆️ Cropping top/bottom:", { sy, sHeight })
      }

      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight)
    }

    canvas.toBlob((blob) => {
      if (blob) {
        console.log("✅ Blob created:", blob.size, "bytes")
        const file = new File([blob], "passport-photo.jpg", { type: "image/jpeg" })
        setImage(file)
        const previewUrl = URL.createObjectURL(file)
        console.log("🖼 Preview URL:", previewUrl)
        setImagePreview(previewUrl)
      } else {
        console.error("❌ Failed to create blob")
      }
    }, "image/jpeg")

    stopCamera()
  }

  // ---------------- Register User ----------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !name || !image) {
      setMessage({ type: "error", text: "Please fill all fields and upload/capture an image" })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const checkResponse = await fetch(`/api/users/check/${userId}`)
      if (checkResponse.ok) {
        const { exists } = await checkResponse.json()
        if (exists) {
          setMessage({ type: "error", text: "User ID already exists. Please choose a different ID." })
          setLoading(false)
          return
        }
      }

      const fileExt = image.name.split(".").pop()
      const fileName = `${userId}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from("user-images").upload(fileName, image, { upsert: true })
      if (uploadError) {
        console.error("Upload error:", uploadError)
        setMessage({ type: "error", text: `Image upload failed: ${uploadError.message}` })
        setLoading(false)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("user-images").getPublicUrl(fileName)

      if (imageRef.current) {
        try {
          const descriptor = await getFaceDescriptor(imageRef.current)
          if (!descriptor) {
            setMessage({ type: "error", text: "No face detected. Please upload a clear face photo." })
            setLoading(false)
            return
          }

          const response = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: userId,
              name,
              image_url: publicUrl,
              face_encoding: Array.from(descriptor),
            }),
          })

          const responseData = await response.json()

          if (response.ok) {
            setMessage({ type: "success", text: "User registered successfully!" })
            setUserId("")
            setName("")
            setImage(null)
            setImagePreview(null)
            if (fileInputRef.current) fileInputRef.current.value = ""
            setIsDialogOpen(false)
            loadUsers()
          } else {
            console.error("API error:", responseData)
            setMessage({ type: "error", text: responseData.error || "Failed to register user" })
          }
        } catch (faceError) {
          console.error("Face detection error:", faceError)
          setMessage({ type: "error", text: "Face detection failed. Please ensure the image shows a clear face." })
        }
      }
    } catch (error) {
      console.error("Registration error:", error)
      setMessage({ type: "error", text: "An unexpected error occurred during registration" })
    } finally {
      setLoading(false)
    }
  }

  // ---------------- Delete User ----------------
  const deleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return
    try {
      const response = await fetch(`/api/users/${userId}`, { method: "DELETE" })
      if (response.ok) {
        setMessage({ type: "success", text: "User deleted successfully" })
        loadUsers()
      } else {
        setMessage({ type: "error", text: "Failed to delete user" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error deleting user" })
    }
  }

  // ---------------- UI ----------------
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>Manage registered users in the system</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Register New User</DialogTitle>
                  <DialogDescription>Add a new user to the facial recognition system</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="userId">User ID</Label>
                    <Input id="userId" value={userId} onChange={(e) => setUserId(e.target.value)} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>

                  <div className="space-y-2">
                    <Label>Profile Image</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        ref={fileInputRef}
                        className="hidden"
                      />
                      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4" /> Upload
                      </Button>
                      <Button type="button" variant="outline" onClick={startCamera}>
                        <Camera className="h-4 w-4" /> Capture
                      </Button>
                    </div>
                  </div>

                  {isCameraOpen && (
                    <div className="space-y-2">
                      <Label>Camera Preview</Label>
                      <div className="relative w-full h-64">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover border rounded-md bg-black"
                        />
                        {/* Face grid overlay */}
                        <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border-2 border-white/50">
                          {[...Array(9)].map((_, i) => (
                            <div key={i} className="border border-white/30"></div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" onClick={captureImage} className="w-full" disabled={!isReady}>
                          Capture Photo
                        </Button>
                        <Button type="button" onClick={stopCamera} variant="outline" className="w-full">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {imagePreview && (
                    <div className="space-y-2">
                      <Label>Preview</Label>
                      <img
                        ref={imageRef}
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-contain border rounded-md bg-white"
                        crossOrigin="anonymous"
                      />
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Registering..." : "Register User"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {message && (
            <Alert variant={message.type === "error" ? "destructive" : "default"} className="mb-4">
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No users registered yet</div>
            ) : (
              users.map((user) => (
                <Card key={user.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.image_url || "/placeholder.svg"} alt={user.name} />
                        <AvatarFallback>
                          {user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold">{user.name}</div>
                        <div className="text-sm text-muted-foreground">ID: {user.user_id}</div>
                        <Badge variant="secondary" className="text-xs">
                          Registered: {new Date(user.created_at).toLocaleDateString()}
                        </Badge>
                      </div>
                    </div>

                    <Button
                      onClick={() => deleteUser(user.user_id)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
