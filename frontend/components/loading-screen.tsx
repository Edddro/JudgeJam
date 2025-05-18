"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import PixelBorder from "./pixel-border"

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0)
  const [bounceHeight, setBounceHeight] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [arcadeFlash, setArcadeFlash] = useState(false)
  const [arcadeScale, setArcadeScale] = useState(1)

  // Loading messages for the jam theme
  const loadingMessages = [
    "PREPARING JAM...",
    "MIXING INGREDIENTS...",
    "STIRRING THE POT...",
    "ADDING SUGAR...",
    "HEATING UP...",
    "ALMOST READY...",
  ]

  // Simulate loading progress
  useEffect(() => {
    const timer = setTimeout(() => {
      if (progress < 100) {
        setProgress((prev) => Math.min(prev + Math.random() * 10, 100))
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [progress])

  // No typewriter effect, just display the current message based on progress
  useEffect(() => {
    // This is just to trigger a re-render when progress changes
    // The actual message is selected directly in the render
  }, [progress])

  // Bouncing animation for the jam jar
  useEffect(() => {
    const bounceInterval = setInterval(() => {
      setBounceHeight((prev) => {
        // Create a bouncing effect between 0 and -20px
        const newHeight = prev - 2
        return newHeight <= -20 ? 0 : newHeight
      })

      setRotation((prev) => {
        // Slight rotation for a wobble effect
        return prev === 0 ? 3 : prev === 3 ? -3 : 0
      })
    }, 50)

    return () => clearInterval(bounceInterval)
  }, [])

  // Arcade-style flashing and scaling effects
  useEffect(() => {
    // Flash effect
    const flashInterval = setInterval(() => {
      setArcadeFlash((prev) => !prev)
    }, 500)

    // Pulsing scale effect
    const scaleInterval = setInterval(() => {
      setArcadeScale((prev) => (prev === 1 ? 1.05 : 1))
    }, 800)

    return () => {
      clearInterval(flashInterval)
      clearInterval(scaleInterval)
    }
  }, [])

  return (
    <div className="min-h-screen bg-light-blue flex flex-col items-center justify-center p-4">
      {/* Header */}
      <PixelBorder className="mb-16" variant="large" color="medium">
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

      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[15%] left-[10%] w-8 h-8">
          <div className="w-full h-full bg-purple-accent opacity-20 rounded-full animate-float"></div>
        </div>
        <div className="absolute top-[25%] right-[15%] w-12 h-12">
          <div
            className="w-full h-full bg-teal-accent opacity-20 rounded-full animate-float"
            style={{ animationDelay: "1s" }}
          ></div>
        </div>
        <div className="absolute bottom-[20%] left-[20%] w-10 h-10">
          <div
            className="w-full h-full bg-purple-accent opacity-20 rounded-full animate-float"
            style={{ animationDelay: "1.5s" }}
          ></div>
        </div>
        <div className="absolute bottom-[30%] right-[25%] w-6 h-6">
          <div
            className="w-full h-full bg-teal-accent opacity-20 rounded-full animate-float"
            style={{ animationDelay: "0.5s" }}
          ></div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="w-full max-w-3xl flex flex-col items-center">
        {/* Arcade-Style Loading Animation - Smaller size */}
        <div className="mb-16 relative">
          <div
            className="transition-all duration-100 ease-in-out"
            style={{
              transform: `translateY(${bounceHeight}px) rotate(${rotation}deg) scale(${arcadeScale})`,
            }}
          >
            {/* Arcade-style border with flashing effect */}
            <div
              className={`absolute -inset-4 rounded-lg ${arcadeFlash ? "bg-purple-accent" : "bg-teal-accent"} opacity-30 blur-md`}
            ></div>

            {/* Pixel corners - arcade style */}
            <div className="absolute -top-6 -left-6 w-12 h-12 border-t-4 border-l-4 border-purple-accent"></div>
            <div className="absolute -top-6 -right-6 w-12 h-12 border-t-4 border-r-4 border-teal-accent"></div>
            <div className="absolute -bottom-6 -left-6 w-12 h-12 border-b-4 border-l-4 border-teal-accent"></div>
            <div className="absolute -bottom-6 -right-6 w-12 h-12 border-b-4 border-r-4 border-purple-accent"></div>

            <PixelBorder variant="medium" color="dark">
              <div className="bg-light-blue p-8 flex justify-center items-center relative overflow-hidden">
                {/* Arcade scanlines effect */}
                <div className="absolute inset-0 bg-scanlines opacity-10 pointer-events-none"></div>

                {/* Arcade-style flashing background */}
                <div
                  className={`absolute inset-0 ${arcadeFlash ? "bg-purple-accent" : "bg-teal-accent"} opacity-10`}
                ></div>

                <div className="relative w-32 h-32 pixel-image">
                  {/* Glowing effect */}
                  <div className="absolute inset-0 bg-purple-accent opacity-20 animate-pulse rounded-full"></div>

                  {/* Arcade-style rotating halo */}
                  <div
                    className="absolute inset-0 border-4 border-dashed border-teal-accent rounded-full animate-spin opacity-40"
                    style={{ animationDuration: "10s" }}
                  ></div>

                  {/* The jam jar icon */}
                  <Image
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot_2025-05-17_at_2.09.30_AM-removebg-preview%20%281%29-pfyTzUZGMwuxInBnUWYZKuu1Khp0PM.png"
                    alt="Jam Jar Icon"
                    width={128}
                    height={128}
                    className="pixelated relative z-10"
                  />

                  {/* Power-up style particles */}
                  <div
                    className="absolute bottom-0 left-1/4 w-2 h-2 bg-yellow-300 rounded-full animate-float"
                    style={{ animationDuration: "1.5s" }}
                  ></div>
                  <div
                    className="absolute bottom-4 right-1/4 w-3 h-3 bg-yellow-300 rounded-full animate-float"
                    style={{ animationDuration: "2s", animationDelay: "0.3s" }}
                  ></div>
                  <div
                    className="absolute top-1/4 left-0 w-2 h-2 bg-yellow-300 rounded-full animate-float"
                    style={{ animationDuration: "1.8s", animationDelay: "0.5s" }}
                  ></div>
                </div>
              </div>
            </PixelBorder>

            {/* Arcade-style score display */}
            <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 bg-dark-blue px-4 py-1 text-yellow-300 pixel-text text-sm">
              SCORE: {Math.round(progress * 100)}
            </div>
          </div>
        </div>

        {/* Loading Text Display - Directly above progress bar */}
        <div className="w-full mb-4">
          <h2 className="text-dark-blue font-bold pixel-text text-2xl text-center mb-2">
            {loadingMessages[Math.floor((progress / 100) * loadingMessages.length)] ||
              loadingMessages[loadingMessages.length - 1]}
          </h2>
        </div>

        {/* Loading Progress - Wider and more detailed */}
        <div className="w-full mb-16">
          <PixelBorder variant="medium" color="medium">
            <div className="bg-light-blue p-6">
              <div className="w-full bg-white rounded-none h-12 border-4 border-medium-blue overflow-hidden">
                <div
                  className="h-12 bg-purple-accent pixelated transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-center mt-6 text-medium-blue font-medium pixel-text">
                LOADING: {Math.round(progress)}%
              </p>
            </div>
          </PixelBorder>
        </div>
      </div>
    </div>
  )
}
