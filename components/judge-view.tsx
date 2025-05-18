"use client"

import { useState, useRef, useEffect } from "react"
import {
  Clock,
  MessageSquare,
  Eye,
  Star,
  AlertTriangle,
  BarChart,
  Mic,
  Smile,
  Code,
  Zap,
  AlertCircle,
  Video,
  VideoOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import Image from "next/image"
import PixelBorder from "./pixel-border"

// Mock data for the judge view
const mockSubmission = {
  teamName: "Pixel Pioneers",
  members: ["Alex Chen", "Jordan Smith", "Taylor Wong"],
  projectName: "EcoTracker",
  submissionTime: "2025-05-17T08:30:00Z",
  codeStartTime: "2025-05-16T23:45:00Z", // Before competition start
  competitionStartTime: "2025-05-17T00:00:00Z",
  repositoryUrl: "https://github.com/pixel-pioneers/eco-tracker",
}

// Mock rubric items
const rubricItems = [
  {
    id: 1,
    criteria: "Originality & Innovation",
    description: "Project demonstrates unique and creative ideas",
    maxScore: 10,
  },
  {
    id: 2,
    criteria: "Technical Complexity",
    description: "Implementation shows advanced technical skills",
    maxScore: 10,
  },
  { id: 3, criteria: "User Experience", description: "Interface is intuitive and user-friendly", maxScore: 10 },
  { id: 4, criteria: "Presentation Quality", description: "Clear explanation of project and features", maxScore: 10 },
  { id: 5, criteria: "Adherence to Theme", description: "Project aligns well with hackathon theme", maxScore: 10 },
]

// Mock auto judge scores - now out of 10
const autoJudgeScores = {
  expression: 8.7,
  tone: 9.2,
  gestures: 7.8,
  codeMatch: 9.5,
  overall: 8.8,
  feedback: [
    "Strong enthusiasm detected in presentation",
    "Good vocal variety and emphasis on key points",
    "Consider more hand gestures to emphasize important features",
    "Excellent correlation between code explanation and implementation",
  ],
}

// Mock video data for demo purposes
const mockVideoUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"

export default function JudgeView() {
  const [time, setTime] = useState(300) // 5 minutes in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [transcript, setTranscript] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const [streamActive, setStreamActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [useMockVideo, setUseMockVideo] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [rubricScores, setRubricScores] = useState<{ [key: number]: number }>(
    rubricItems.reduce((acc, item) => ({ ...acc, [item.id]: 0 }), {}),
  )
  const [comments, setComments] = useState("")
  const [checkedRules, setCheckedRules] = useState<{ [key: string]: boolean }>({
    codeOfConduct: false,
    originalWork: false,
    followedTheme: false,
  })

  // Calculate if coding started before competition
  const startedEarly = new Date(mockSubmission.codeStartTime) < new Date(mockSubmission.competitionStartTime)

  // Calculate total score
  const totalScore = Object.values(rubricScores).reduce((sum, score) => sum + score, 0)
  const maxPossibleScore = rubricItems.reduce((sum, item) => sum + item.maxScore, 0)

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

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
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

  // Handle rubric score change
  const handleScoreChange = (id: number, value: number[]) => {
    setRubricScores((prev) => ({ ...prev, [id]: value[0] }))
  }

  // Handle checkbox change
  const handleCheckboxChange = (key: string, checked: boolean) => {
    setCheckedRules((prev) => ({ ...prev, [key]: checked }))
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
            <div className="bg-purple-accent px-4 py-2 ml-4 text-white pixel-text">JUDGE VIEW</div>
          </div>
        </div>
      </PixelBorder>

      {/* Team Information */}
      <PixelBorder className="mb-8" variant="medium" color="dark">
        <div className="bg-light-blue">
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
            <h2 className="text-white font-bold pixel-text">Team Information</h2>
          </div>
          <div className="p-4 bg-light-blue">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-dark-blue font-bold text-lg mb-2">Team Name</h3>
                <p className="bg-white p-3 border-2 border-medium-blue">{mockSubmission.teamName}</p>

                <h3 className="text-dark-blue font-bold text-lg mt-4 mb-2">Project Name</h3>
                <p className="bg-white p-3 border-2 border-medium-blue">{mockSubmission.projectName}</p>

                <h3 className="text-dark-blue font-bold text-lg mt-4 mb-2">Submission Time</h3>
                <p className="bg-white p-3 border-2 border-medium-blue">{formatDate(mockSubmission.submissionTime)}</p>
              </div>

              <div>
                <h3 className="text-dark-blue font-bold text-lg mb-2">Team Members</h3>
                <div className="bg-white p-3 border-2 border-medium-blue">
                  <ul className="list-disc pl-5">
                    {mockSubmission.members.map((member, index) => (
                      <li key={index}>{member}</li>
                    ))}
                  </ul>
                </div>

                <h3 className="text-dark-blue font-bold text-lg mt-4 mb-2">Repository URL</h3>
                <p className="bg-white p-3 border-2 border-medium-blue flex items-center">
                  <a href={mockSubmission.repositoryUrl} className="text-purple-accent hover:underline truncate">
                    {mockSubmission.repositoryUrl}
                  </a>
                  <Button className="ml-2 bg-purple-accent hover:bg-light-blue text-white p-1 h-8">
                    <Eye size={16} className="mr-1" /> View
                  </Button>
                </p>

                <h3 className="text-dark-blue font-bold text-lg mt-4 mb-2">Code Start Time</h3>
                <div className="bg-white p-3 border-2 border-medium-blue flex items-center">
                  <span>{formatDate(mockSubmission.codeStartTime)}</span>
                  {startedEarly && (
                    <div className="ml-2 bg-red-100 text-red-800 px-2 py-1 flex items-center">
                      <AlertTriangle size={16} className="mr-1" /> Started before competition
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </PixelBorder>

      {/* Video and Transcript Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        {/* Video Feed */}
        <div className="lg:col-span-7">
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
        </div>

        {/* Transcript - Now beside the video */}
        <div className="lg:col-span-5">
          <PixelBorder variant="medium" color="dark" className="h-full">
            <div className="bg-light-blue h-full flex flex-col">
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
              <div className="p-4 bg-light-blue flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-4 bg-medium-blue p-2">
                  <div className="bg-dark-blue p-2">
                    <MessageSquare className="text-teal-accent" size={24} />
                  </div>
                  <h3 className="text-white font-bold pixel-text">PITCH TRANSCRIPT</h3>
                </div>
                <Textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Pitch transcript will appear here as the team speaks..."
                  className="flex-1 bg-white border-medium-blue text-dark-blue resize-none font-medium rounded-none text-base min-h-[200px]"
                />
              </div>
            </div>
          </PixelBorder>
        </div>
      </div>

      {/* Auto Judge Section - Modified to use scores out of 10 */}
      <PixelBorder variant="medium" color="dark" className="mb-8">
        <div className="bg-light-blue">
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
            <h2 className="text-white font-bold pixel-text">Auto Judge</h2>
            <div className="ml-auto bg-dark-blue px-3 py-1 text-white pixel-text text-sm flex items-center">
              <Zap className="mr-1 h-4 w-4 text-yellow-400" /> AI POWERED
            </div>
          </div>
          <div className="p-4 bg-light-blue">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Score Metrics */}
              <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Expression Score */}
                <div className="bg-white p-4 border-2 border-medium-blue flex flex-col items-center justify-center text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Smile className="h-5 w-5 text-purple-accent mr-2" />
                    <h3 className="text-dark-blue font-bold">Expression</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Facial expressions and engagement</p>
                  <Progress value={(autoJudgeScores.expression / 10) * 100} className="h-3 mb-2 w-full" />
                  <div className="flex justify-between items-center mt-3 w-full">
                    <span className="text-xs text-gray-500">0</span>
                    <span className="text-lg font-bold text-dark-blue">{autoJudgeScores.expression.toFixed(1)}</span>
                    <span className="text-xs text-gray-500">10</span>
                  </div>
                </div>

                {/* Tone Score */}
                <div className="bg-white p-4 border-2 border-medium-blue flex flex-col items-center justify-center text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Mic className="h-5 w-5 text-purple-accent mr-2" />
                    <h3 className="text-dark-blue font-bold">Tone</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Voice modulation and clarity</p>
                  <Progress value={(autoJudgeScores.tone / 10) * 100} className="h-3 mb-2 w-full" />
                  <div className="flex justify-between items-center mt-3 w-full">
                    <span className="text-xs text-gray-500">0</span>
                    <span className="text-lg font-bold text-dark-blue">{autoJudgeScores.tone.toFixed(1)}</span>
                    <span className="text-xs text-gray-500">10</span>
                  </div>
                </div>

                {/* Gestures Score */}
                <div className="bg-white p-4 border-2 border-medium-blue flex flex-col items-center justify-center text-center">
                  <div className="flex items-center justify-center mb-2">
                    <BarChart className="h-5 w-5 text-purple-accent mr-2" />
                    <h3 className="text-dark-blue font-bold">Gestures</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Hand movements and body language</p>
                  <Progress value={(autoJudgeScores.gestures / 10) * 100} className="h-3 mb-2 w-full" />
                  <div className="flex justify-between items-center mt-3 w-full">
                    <span className="text-xs text-gray-500">0</span>
                    <span className="text-lg font-bold text-dark-blue">{autoJudgeScores.gestures.toFixed(1)}</span>
                    <span className="text-xs text-gray-500">10</span>
                  </div>
                </div>

                {/* Code Match Score */}
                <div className="bg-white p-4 border-2 border-medium-blue flex flex-col items-center justify-center text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Code className="h-5 w-5 text-purple-accent mr-2" />
                    <h3 className="text-dark-blue font-bold">Code Match</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Alignment between code and explanation</p>
                  <Progress value={(autoJudgeScores.codeMatch / 10) * 100} className="h-3 mb-2 w-full" />
                  <div className="flex justify-between items-center mt-3 w-full">
                    <span className="text-xs text-gray-500">0</span>
                    <span className="text-lg font-bold text-dark-blue">{autoJudgeScores.codeMatch.toFixed(1)}</span>
                    <span className="text-xs text-gray-500">10</span>
                  </div>
                </div>
              </div>

              {/* Overall Score and Feedback */}
              <div className="lg:col-span-2">
                <div className="bg-white p-4 border-2 border-medium-blue h-full">
                  <h3 className="text-dark-blue font-bold text-lg mb-3">Overall AI Assessment</h3>
                  <div className="mb-4">
                    <div className="w-full h-4 bg-gray-200 rounded-none">
                      <div
                        className="h-4 bg-gradient-to-r from-purple-accent to-teal-accent"
                        style={{ width: `${(autoJudgeScores.overall / 10) * 100}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">0</span>
                      <span className="text-2xl font-bold text-dark-blue">{autoJudgeScores.overall.toFixed(1)}</span>
                      <span className="text-xs text-gray-500">10</span>
                    </div>
                  </div>
                  <h4 className="text-dark-blue font-medium mb-2 mt-4">AI Feedback:</h4>
                  <ul className="space-y-2 text-sm">
                    {autoJudgeScores.feedback.map((item, index) => (
                      <li key={index} className="flex items-start">
                        <div className="bg-light-blue p-1 mr-2 mt-0.5">
                          <Zap className="h-3 w-3 text-purple-accent" />
                        </div>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PixelBorder>

      {/* Judging Rubric - Now at the bottom */}
      <PixelBorder variant="medium" color="dark" className="mb-8">
        <div className="bg-light-blue">
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
            <h2 className="text-white font-bold pixel-text">Judging Rubric</h2>
          </div>
          <div className="p-4 bg-light-blue">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Rubric Items */}
              {rubricItems.map((item) => (
                <div key={item.id} className="bg-white p-4 border-2 border-medium-blue">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-dark-blue font-bold">{item.criteria}</h3>
                    <div className="bg-medium-blue text-white px-2 py-1 text-sm">
                      {rubricScores[item.id]}/{item.maxScore}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">0</span>
                    <Slider
                      value={[rubricScores[item.id]]}
                      max={item.maxScore}
                      step={1}
                      onValueChange={(value) => handleScoreChange(item.id, value)}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium">{item.maxScore}</span>
                  </div>
                </div>
              ))}

              {/* Rule Compliance */}
              <div className="bg-white p-4 border-2 border-medium-blue">
                <h3 className="text-dark-blue font-bold mb-4">Rule Compliance</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="codeOfConduct"
                      checked={checkedRules.codeOfConduct}
                      onCheckedChange={(checked) => handleCheckboxChange("codeOfConduct", checked as boolean)}
                    />
                    <label
                      htmlFor="codeOfConduct"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Team followed code of conduct
                    </label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="originalWork"
                      checked={checkedRules.originalWork}
                      onCheckedChange={(checked) => handleCheckboxChange("originalWork", checked as boolean)}
                    />
                    <label
                      htmlFor="originalWork"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Project is original work
                    </label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="followedTheme"
                      checked={checkedRules.followedTheme}
                      onCheckedChange={(checked) => handleCheckboxChange("followedTheme", checked as boolean)}
                    />
                    <label
                      htmlFor="followedTheme"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Project follows hackathon theme
                    </label>
                  </div>
                </div>
              </div>

              {/* Judge Comments */}
              <div className="bg-white p-4 border-2 border-medium-blue">
                <h3 className="text-dark-blue font-bold mb-2">Judge Comments</h3>
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Enter your feedback and comments here..."
                  className="h-32 bg-white border-medium-blue text-dark-blue resize-none font-medium rounded-none text-base"
                />
              </div>
            </div>
          </div>
        </div>
      </PixelBorder>

      {/* Submit Score Section */}
      <PixelBorder variant="large" color="dark">
        <div className="bg-light-blue">
          <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-medium-blue">
            <div className="text-center md:text-left">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 relative">
                  <Image
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot_2025-05-17_at_2.09.30_AM-removebg-preview%20%281%29-pfyTzUZGMwuxInBnUWYZKuu1Khp0PM.png"
                    alt="Jam Icon"
                    width={32}
                    height={32}
                    className="pixelated"
                  />
                </div>
                <h3 className="text-white font-bold pixel-text text-2xl">TOTAL SCORE</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-dark-blue p-4 text-white pixel-text text-3xl">{totalScore}</div>
                <span className="text-white pixel-text text-xl">/ {maxPossibleScore}</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-8 w-8 ${
                        totalScore / maxPossibleScore >= star / 5 ? "text-yellow-400 fill-yellow-400" : "text-gray-400"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <PixelBorder variant="medium" color="purple">
              <Button className="bg-purple-accent hover:bg-light-blue text-white px-12 py-6 text-2xl pixel-text transition-colors duration-200">
                SAVE SCORE
              </Button>
            </PixelBorder>
          </div>
        </div>
      </PixelBorder>
    </div>
  )
}
