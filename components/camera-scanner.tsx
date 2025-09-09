// components/camera-scanner.tsx
"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { detectFaces, loadFaceAPI } from "@/lib/face-recognition"
import { Camera, CameraOff, UserCheck, UserX } from "lucide-react"

// --- Interfaces ---
interface User {
  user_id: string
  name: string
  image_url: string
  face_encoding: number[]
}

interface RecognizedFace {
  user: User
  confidence: number
}

type DisplayInfo = {
  face: RecognizedFace
  action: "enter" | "exit"
}

export default function CameraScanner() {
  // --- State ---
  const [users, setUsers] = useState<User[]>([])
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null)
  const [displayedInfo, setDisplayedInfo] = useState<DisplayInfo | null>(null)
  const [userStatus, setUserStatus] = useState(new Map<string, { status: "entered" | "exited" }>())
  const [actionCooldown, setActionCooldown] = useState(new Map<string, boolean>())

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isScanningRef = useRef(false)

  // --- Constants ---
  const FACE_MATCH_THRESHOLD = 0.4 // Lower is more strict

  // --- Load Users ---
  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users")
      if (res.ok) setUsers(await res.json())
    } catch (err) {
      console.error("Failed to load users:", err)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // --- Camera Management ---
  const startCamera = async () => {
    setLoading(true)
    setMessage({ type: "success", text: "Loading face models..." })
    await loadFaceAPI()
    setIsCameraActive(true)
    setLoading(false)
    setMessage(null)
  }

  const stopCamera = () => {
    setIsCameraActive(false)
    setMessage(null)
    setDisplayedInfo(null)
  }

  // --- Main useEffect for Camera Lifecycle ---
  useEffect(() => {
    const enableCameraAndStartScanner = async () => {
      if (!isCameraActive || !videoRef.current) return

      try {
        streamRef.current?.getTracks().forEach(track => track.stop())
        const constraints = selectedCamera
          ? { video: { deviceId: { exact: selectedCamera } } }
          : { video: true }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        streamRef.current = stream

        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(d => d.kind === "videoinput")
        setCameras(videoDevices)
        if (!selectedCamera && videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId)
        }

        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            setMessage({ type: "success", text: "Scanning automatically..." })
            if (intervalRef.current) clearInterval(intervalRef.current)
            intervalRef.current = setInterval(runContinuousScan, 1200)
          }
        }
      } catch (err) {
        console.error("Camera access error:", err)
        setMessage({ type: "error", text: "Camera access denied or not available." })
        setIsCameraActive(false)
      }
    }

    enableCameraAndStartScanner()

    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop())
      if (videoRef.current) videoRef.current.srcObject = null
      streamRef.current = null
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // No dependency on userStatus to avoid re-initializing the camera
  }, [isCameraActive, selectedCamera])

  // --- Attendance Logging ---
  const logUserAction = async (user: User, action: "enter" | "exit", confidence: number) => {
    try {
      await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.user_id,
          confidence_score: confidence / 100,
          action,
        }),
      })
      console.log(`Successfully marked '${action}' for ${user.name}`)
    } catch (error) {
      console.error(`Failed to mark '${action}' for ${user.name}:`, error)
    }
  }

  // --- Recognition & Action Logic ---
  const handleSuccessfulRecognition = (recognized: RecognizedFace) => {
    const userId = recognized.user.user_id
    if (actionCooldown.has(userId)) return

    // **FIX**: Use the functional update form of useState
    // This provides the most up-to-date state, avoiding the "stale closure" problem.
    setUserStatus(currentStatusMap => {
      const prevStatus = currentStatusMap.get(userId)?.status || "exited"
      const nextAction = prevStatus === "entered" ? "exit" : "enter"

      // Perform side-effects like logging and showing UI feedback
      logUserAction(recognized.user, nextAction, recognized.confidence)
      setDisplayedInfo({ face: recognized, action: nextAction })
      setTimeout(() => setDisplayedInfo(null), 2000)

      // Create and return the new map for the state update
      const newMap = new Map(currentStatusMap)
      newMap.set(userId, { status: nextAction === "enter" ? "entered" : "exited" })
      return newMap
    })

    // Cooldown logic remains the same
    setActionCooldown(prev => new Map(prev).set(userId, true))
    setTimeout(() => {
      setActionCooldown(prev => {
        const newMap = new Map(prev)
        newMap.delete(userId)
        return newMap
      })
    }, 3000)
  }

  // --- Continuous Scan Loop ---
  const runContinuousScan = async () => {
    if (isScanningRef.current || !videoRef.current || !canvasRef.current || users.length === 0) {
      return
    }
    isScanningRef.current = true
    try {
      const faceapi = await loadFaceAPI()
      if (!videoRef.current || !canvasRef.current) return

      const detections = await detectFaces(videoRef.current)
      const canvas = canvasRef.current
      const video = videoRef.current

      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      if (detections.length > 0) {
        faceapi.draw.drawDetections(canvas, detections)
        for (const detection of detections) {
          let bestMatch: RecognizedFace | null = null
          let bestDistance = Infinity

          for (const user of users) {
            const descriptor = new Float32Array(user.face_encoding)
            const distance = faceapi.euclideanDistance(detection.descriptor, descriptor)
            if (distance < bestDistance && distance < FACE_MATCH_THRESHOLD) {
              bestDistance = distance
              bestMatch = {
                user,
                confidence: Math.max(0, (1 - distance / FACE_MATCH_THRESHOLD) * 100),
              }
            }
          }
          if (bestMatch) {
            handleSuccessfulRecognition(bestMatch)
          }
        }
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    } catch (error) {
      console.error("Error during scan:", error)
    } finally {
      isScanningRef.current = false
    }
  }

  // --- JSX ---
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Camera className="h-6 w-6" />
          Face Recognition Scanner
        </CardTitle>
        <CardDescription>
          {isCameraActive ? "Scanning automatically..." : "Start the camera to begin automatic scanning."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center gap-2">
          {!isCameraActive ? (
            <Button onClick={startCamera} disabled={loading}>
              <Camera className="mr-2 h-5 w-5" />
              {loading ? "Loading Models..." : "Start Camera"}
            </Button>
          ) : (
            <Button onClick={stopCamera} variant="outline">
              <CameraOff className="mr-2 h-5 w-5" />
              Stop Camera
            </Button>
          )}
        </div>
        {isCameraActive && cameras.length > 1 && (
          <div className="flex justify-center">
            <select
              className="p-2 border rounded-md bg-background text-foreground"
              value={selectedCamera || ""}
              onChange={e => setSelectedCamera(e.target.value)}
              aria-label="Select camera"
            >
              {cameras.map(cam => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label || `Camera ${cam.deviceId}`}
                </option>
              ))}
            </select>
          </div>
        )}
        {isCameraActive && (
          <div className="relative">
            <video ref={videoRef} autoPlay muted playsInline className="w-full max-h-96 object-cover rounded-lg" />
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
          </div>
        )}
        {displayedInfo && (
          <Alert
            variant="default"
            className={
              displayedInfo.action === "enter"
                ? "bg-green-100 dark:bg-green-900 border-green-400 dark:border-green-600"
                : "bg-blue-100 dark:bg-blue-900 border-blue-400 dark:border-blue-600"
            }
          >
            {displayedInfo.action === "enter" ? (
              <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <UserX className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            )}
            <AlertDescription
              className={
                displayedInfo.action === "enter"
                  ? "text-center font-semibold text-green-800 dark:text-green-200"
                  : "text-center font-semibold text-blue-800 dark:text-blue-200"
              }
            >
              {displayedInfo.action === "enter" ? "Welcome" : "Goodbye"},{" "}
              {displayedInfo.face.user.name}!
            </AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert variant={message.type === "error" ? "destructive" : "default"}>
            <AlertDescription className="text-center">{message.text}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}