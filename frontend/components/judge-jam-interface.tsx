"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import {
  Upload,
  Clock,
  FileText,
  Trophy,
  MessageSquare,
  AlertCircle,
  Github,
  Link,
  Video,
  VideoOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import PixelBorder from "./pixel-border"

export default function JudgeJamInterface() {
  const [time, setTime] = useState(300) // 5 minutes in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [githubUrl, setGithubUrl] = useState("")
  const [selectedRubric, setSelectedRubric] = useState<File | null>(null)
  const rubricInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [streamActive, setStreamActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [useMockVideo, setUseMockVideo] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)

  // Mock video data for demo purposes
  const mockVideoUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"

  // Timer functionality
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isTimerRunning && time > 0) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime - 1)
      }, 1000)
    } else if (time === 0) {
      setIsTimerRunning(false)
    }

    return () => clearInterval(interval)
  }, [isTimerRunning, time])

  // Cleanup camera stream when component unmounts
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Handle rubric selection
  const handleRubricChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedRubric(e.target.files[0])
    }
  }

  // Validate GitHub URL
  const isValidGithubUrl = (url: string) => {
    return (
      url.trim() !== "" &&
      (url.startsWith("https://github.com/") || url.startsWith("http://github.com/") || url.startsWith("github.com/"))
    )
  }

  // Handle camera access with improved error handling
  const startCamera = async () => {
    try {
      // Reset any previous errors
      setCameraError(null)

      // If using mock video for demo purposes
      if (useMockVideo) {
        setStreamActive(true)
        return
      }

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access not supported in this browser")
      }

      // Request camera access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      })

      // Store the stream for cleanup later
      setStream(mediaStream)

      // Set the stream as the source for the video element
      // This will work even if the video element is initially hidden
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream

        // Set up event handlers for the video element
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current
              .play()
              .then(() => {
                setStreamActive(true)
              })
              .catch((err) => {
                console.error("Error playing video:", err)
                setCameraError(`Error playing video: ${err.message}`)
              })
          }
        }
      } else {
        // If videoRef.current is null, we'll set a timeout to try again
        // This can happen if the component hasn't fully rendered yet
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream
            videoRef.current.onloadedmetadata = () => {
              if (videoRef.current) {
                videoRef.current
                  .play()
                  .then(() => {
                    setStreamActive(true)
                  })
                  .catch((err) => {
                    console.error("Error playing video:", err)
                    setCameraError(`Error playing video: ${err.message}`)
                  })
              }
            }
          } else {
            console.error("Video element still not found after timeout")
            setCameraError("Could not find video element. Please try again.")
          }
        }, 500) // Wait 500ms for the DOM to update
      }
    } catch (err) {
      console.error("Error accessing camera:", err)

      // Handle specific error types
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setCameraError("Camera access denied. Please allow camera access in your browser settings.")
        } else if (err.name === "NotFoundError") {
          setCameraError("No camera detected. Please connect a camera and try again.")
        } else if (err.name === "NotReadableError") {
          setCameraError("Camera is in use by another application.")
        } else {
          setCameraError(`Camera error: ${err.message}`)
        }
      } else {
        setCameraError(`Camera error: ${err instanceof Error ? err.message : "Unknown error"}`)
      }
    }
  }

  // Stop camera stream
  const stopCamera = () => {
    // Stop all tracks in the stream
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop()
      })
      setStream(null)
    }

    // Clear the video element
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.onloadedmetadata = null
    }

    setStreamActive(false)
    setUseMockVideo(false)
  }

  // Use mock video for demo purposes
  const useDemoVideo = () => {
    stopCamera() // Stop any existing camera first
    setUseMockVideo(true)
    setStreamActive(true)
  }

  // Start/stop timer
  const toggleTimer = () => {
    setIsTimerRunning(!isTimerRunning)
    if (!streamActive && !cameraError) {
      startCamera()
    }
  }

  // Calculate submission progress
  const getSubmissionProgress = () => {
    const hasGithub = isValidGithubUrl(githubUrl)
    const hasRubric = selectedRubric !== null

    if (hasGithub && hasRubric) return "100%"
    if (hasGithub || hasRubric) return "50%"
    return "0%"
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <PixelBorder className="mb-8" variant="large" color="medium">
        <div className="flex justify-center items-center p-4 bg-light-blue">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 pixel-image">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot_2025-05-17_at_2.09.30_AM-removebg-preview%20%281%29-pfyTzUZGMwuxInBnUWYZKuu1Khp0PM.png"
                alt="Jam Jar Icon"
                width={64}
                height={64}
                className="pixelated"
              />
            </div>
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-EKkRe5I2OKNvHsq92wMBUspg7WLYvm.png"
              alt="JudgeJam Logo"
              width={280}
              height={70}
              className="pixelated"
            />
          </div>
        </div>
      </PixelBorder>

      {/* Main Content - Restructured to use grid with auto heights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Video Feed and Transcript */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          {/* Video Feed */}
          <PixelBorder variant="medium" color="dark">
            <div className="bg-light-blue">
              <div className="p-4 bg-medium-blue flex items-center justify-between text-xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 relative">
                    <Image
                      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot_2025-05-17_at_2.09.30_AM-removebg-preview%20%281%29-pfyTzUZGMwuxInBnUWYZKuu1Khp0PM.png"
                      alt="Jam Icon"
                      width={32}
                      height={32}
                      className="pixelated"
                    />
                  </div>
                  <h2 className="text-white font-bold pixel-text">Live Pitch Feed</h2>
                </div>
                <div className="pixel-text text-sm bg-dark-blue px-3 py-2 text-white">CAM-01</div>
              </div>

              {/* Video Container */}
              <div className="aspect-video bg-dark-blue relative">
                {/* Always render the video element, but hide it when not active */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover ${
                    streamActive && !useMockVideo ? "block" : "hidden"
                  }`}
                  style={{ transform: "scaleX(-1)" }}
                />

                {/* Demo Video */}
                {streamActive && useMockVideo && (
                  <video
                    src={mockVideoUrl}
                    autoPlay
                    loop
                    muted
                    controls
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}

                {/* Camera Controls or Start Button */}
                <div
                  className={`absolute inset-0 flex items-center justify-center ${streamActive ? "bg-transparent" : "bg-dark-blue"}`}
                >
                  {streamActive ? (
                    <div className="absolute top-3 right-3">
                      <Button
                        onClick={stopCamera}
                        className="bg-dark-blue hover:bg-red-600 p-2 h-auto"
                        title="Stop camera"
                      >
                        <VideoOff size={20} className="text-white" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      {cameraError ? (
                        <div className="text-center p-6 max-w-md">
                          <div className="bg-red-100 border-2 border-red-400 p-4 mb-4 text-red-800 flex items-start">
                            <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                            <p>{cameraError}</p>
                          </div>
                          <div className="flex flex-col gap-3">
                            <PixelBorder variant="small" color="purple">
                              <Button
                                onClick={startCamera}
                                className="bg-purple-accent hover:bg-light-blue text-white px-8 py-4 text-lg pixel-text transition-colors duration-200"
                              >
                                TRY AGAIN
                              </Button>
                            </PixelBorder>
                            <PixelBorder variant="small" color="teal">
                              <Button
                                onClick={useDemoVideo}
                                className="bg-teal-accent hover:bg-light-blue text-white px-8 py-4 text-lg pixel-text transition-colors duration-200"
                              >
                                USE DEMO VIDEO
                              </Button>
                            </PixelBorder>
                          </div>
                          <p className="mt-4 text-white text-sm">
                            For demo purposes, you can use a sample video instead.
                          </p>
                        </div>
                      ) : (
                        <PixelBorder variant="small" color="purple">
                          <Button
                            onClick={startCamera}
                            className="bg-purple-accent hover:bg-light-blue text-white px-8 py-6 text-xl pixel-text transition-colors duration-200 flex items-center gap-2"
                          >
                            <Video className="h-6 w-6" /> START VIDEO
                          </Button>
                        </PixelBorder>
                      )}
                    </>
                  )}
                </div>

                {/* Status Indicator */}
                <div className="absolute bottom-3 left-3 z-10 text-white pixel-text text-sm bg-medium-blue bg-opacity-80 px-3 py-2">
                  {streamActive ? (useMockVideo ? "DEMO" : "LIVE") : "STANDBY"}
                </div>
              </div>

              <div className="p-4 flex justify-between items-center bg-medium-blue">
                <div className="flex items-center gap-3">
                  <div className="bg-dark-blue p-3 rounded-none">
                    <Clock className="text-teal-accent" size={24} />
                  </div>
                  <span className="text-white font-mono text-2xl pixel-text">{formatTime(time)}</span>
                </div>
                <PixelBorder variant="small" color={isTimerRunning ? "teal" : "purple"}>
                  <Button
                    onClick={toggleTimer}
                    className={`${
                      isTimerRunning ? "bg-teal-accent hover:bg-light-blue" : "bg-purple-accent hover:bg-light-blue"
                    } text-white pixel-text text-lg px-6 py-4 transition-colors duration-200`}
                  >
                    {isTimerRunning ? "PAUSE" : "START"} TIMER
                  </Button>
                </PixelBorder>
              </div>
            </div>
          </PixelBorder>

          {/* Transcript - Moved from right column to below video */}
          <PixelBorder variant="medium" color="dark">
            <div className="bg-light-blue">
              <div className="p-4 bg-medium-blue flex items-center text-xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 relative">
                    <Image
                      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot_2025-05-17_at_2.09.30_AM-removebg-preview%20%281%29-pfyTzUZGMwuxInBnUWYZKuu1Khp0PM.png"
                      alt="Jam Icon"
                      width={32}
                      height={32}
                      className="pixelated"
                    />
                  </div>
                  <h2 className="text-white font-bold pixel-text">Live Transcript</h2>
                </div>
              </div>
              <div className="p-4 bg-light-blue">
                <div className="flex items-center gap-3 mb-4 bg-medium-blue p-2">
                  <div className="bg-dark-blue p-2">
                    <MessageSquare className="text-teal-accent" size={24} />
                  </div>
                  <h3 className="text-white font-bold pixel-text">PITCH TRANSCRIPT</h3>
                </div>
                <Textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Your pitch transcript will appear here as you speak..."
                  className="h-32 bg-white border-medium-blue text-dark-blue resize-none font-medium rounded-none text-base"
                />
              </div>
            </div>
          </PixelBorder>
        </div>

        {/* Right Column - Submission Forms */}
        <div className="lg:col-span-5">
          <PixelBorder variant="medium" color="dark" className="h-full">
            <div className="bg-light-blue h-full flex flex-col">
              <div className="p-4 bg-medium-blue flex items-center text-xl">
                <div className="w-8 h-8 relative mr-2">
                  <Image
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot_2025-05-17_at_2.09.30_AM-removebg-preview%20%281%29-pfyTzUZGMwuxInBnUWYZKuu1Khp0PM.png"
                    alt="Jam Icon"
                    width={32}
                    height={32}
                    className="pixelated"
                  />
                </div>
                <h2 className="text-white font-bold pixel-text">Submission</h2>
              </div>
              <div className="p-4 flex-1 flex flex-col gap-6">
                {/* GitHub Repository URL */}
                <PixelBorder variant="small" color="medium">
                  <div className="bg-light-blue p-4">
                    <div className="flex items-center gap-3 mb-4 bg-medium-blue p-2">
                      <div className="bg-dark-blue p-2">
                        <Github className="text-teal-accent" size={24} />
                      </div>
                      <h3 className="text-white font-bold pixel-text text-lg">GITHUB REPOSITORY</h3>
                    </div>
                    <div className="border-4 border-dashed border-medium-blue p-6 text-center bg-white">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 bg-light-blue p-2 border-2 border-medium-blue">
                          <Link size={20} className="text-dark-blue" />
                          <Input
                            value={githubUrl}
                            onChange={(e) => setGithubUrl(e.target.value)}
                            placeholder="https://github.com/username/repository"
                            className="border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-dark-blue"
                          />
                        </div>
                        <p className="text-dark-blue text-sm font-medium">
                          {isValidGithubUrl(githubUrl)
                            ? "✓ Valid GitHub repository URL"
                            : "Enter the URL to your GitHub repository"}
                        </p>
                      </div>
                    </div>
                  </div>
                </PixelBorder>

                {/* Rubric Upload */}
                <PixelBorder variant="small" color="medium">
                  <div className="bg-light-blue p-4">
                    <div className="flex items-center gap-3 mb-4 bg-medium-blue p-2">
                      <div className="bg-dark-blue p-2">
                        <FileText className="text-teal-accent" size={24} />
                      </div>
                      <h3 className="text-white font-bold pixel-text text-lg">UPLOAD RUBRIC</h3>
                    </div>
                    <div className="border-4 border-dashed border-medium-blue p-6 text-center bg-white">
                      <input
                        type="file"
                        ref={rubricInputRef}
                        onChange={handleRubricChange}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.txt"
                      />
                      <Button
                        onClick={() => rubricInputRef.current?.click()}
                        className="bg-purple-accent hover:bg-light-blue text-white pixel-text text-lg px-6 py-4 transition-colors duration-200"
                      >
                        <Upload className="mr-2 h-5 w-5" /> SELECT RUBRIC
                      </Button>
                      <p className="text-dark-blue text-sm mt-4 font-medium">
                        {selectedRubric
                          ? `Selected: ${selectedRubric.name}`
                          : "Upload your judging rubric here (.pdf, .doc, .txt)"}
                      </p>
                    </div>
                  </div>
                </PixelBorder>

                {/* Progress Indicator */}
                <PixelBorder variant="small" color="medium" className="mt-auto">
                  <div className="bg-light-blue p-4">
                    <div className="flex items-center gap-3 mb-4 bg-medium-blue p-2">
                      <div className="bg-dark-blue p-2">
                        <Trophy className="text-teal-accent" size={24} />
                      </div>
                      <h3 className="text-white font-bold pixel-text text-lg">SUBMISSION STATUS</h3>
                    </div>
                    <div className="w-full bg-white rounded-none h-8 border-4 border-medium-blue">
                      <div
                        className="h-8 bg-gradient-to-r from-purple-accent to-teal-accent pixelated"
                        style={{ width: getSubmissionProgress() }}
                      ></div>
                    </div>
                    <p className="text-dark-blue text-sm mt-4 text-center font-medium">
                      SUBMISSION PROGRESS: {getSubmissionProgress()} COMPLETE
                    </p>
                  </div>
                </PixelBorder>
              </div>
            </div>
          </PixelBorder>
        </div>
      </div>

      {/* Submit Section */}
      <div className="mt-8">
        <PixelBorder variant="large" color="dark">
          <div className="bg-light-blue">
            <div className="p-6 flex flex-col items-center gap-6 bg-medium-blue">
              <div className="text-center">
                <div className="flex justify-center items-center gap-3 mb-4">
                  <div className="w-8 h-8 relative">
                    <Image
                      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot_2025-05-17_at_2.09.30_AM-removebg-preview%20%281%29-pfyTzUZGMwuxInBnUWYZKuu1Khp0PM.png"
                      alt="Jam Icon"
                      width={32}
                      height={32}
                      className="pixelated"
                    />
                  </div>
                  <h3 className="text-white font-bold pixel-text text-2xl">READY TO SUBMIT?</h3>
                </div>
                <p className="text-white pixel-text text-lg">
                  MAKE SURE YOU'VE ADDED YOUR GITHUB REPO AND COMPLETED YOUR PITCH!
                </p>
              </div>
              <PixelBorder variant="medium" color="purple">
                <Button
                  className="bg-purple-accent hover:bg-light-blue text-white px-12 py-6 text-2xl pixel-text transition-colors duration-200"
                  disabled={!isValidGithubUrl(githubUrl)}
                >
                  SUBMIT PROJECT
                </Button>
              </PixelBorder>
              {!isValidGithubUrl(githubUrl) && (
                <p className="text-white text-sm">Please add a valid GitHub repository URL to submit</p>
              )}
            </div>
          </div>
        </PixelBorder>
      </div>
    </div>
  )
}
