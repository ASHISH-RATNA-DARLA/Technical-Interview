"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface VoiceAnimationProps {
  isActive: boolean
  size?: "sm" | "md" | "lg"
}

export function VoiceAnimation({ isActive, size = "md" }: VoiceAnimationProps) {
  const [audioData, setAudioData] = useState<number[]>([])

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isActive) {
      // Simulate audio frequency data for animation
      interval = setInterval(() => {
        const newData = Array.from({ length: 12 }, () => Math.random() * 100)
        setAudioData(newData)
      }, 100)
    } else {
      setAudioData(Array(12).fill(0))
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive])

  const sizeClasses = {
    sm: "w-32 h-32",
    md: "w-40 h-40",
    lg: "w-48 h-48",
  }

  const barHeights = {
    sm: "h-8",
    md: "h-12",
    lg: "h-16",
  }

  return (
    <div className={cn("relative flex items-center justify-center", sizeClasses[size])}>
      {/* Outer glow ring */}
      <div
        className={cn(
          "absolute inset-0 rounded-full transition-all duration-300",
          isActive
            ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 animate-pulse shadow-lg shadow-blue-500/25"
            : "bg-slate-200/50 dark:bg-slate-700/50",
        )}
      />

      {/* Inner voice visualization */}
      <div className="relative flex items-end justify-center gap-1 z-10">
        {audioData.map((height, index) => (
          <div
            key={index}
            className={cn(
              "w-1 bg-gradient-to-t from-blue-600 to-purple-600 rounded-full transition-all duration-100 ease-out",
              barHeights[size],
            )}
            style={{
              height: isActive ? `${Math.max(height * 0.6, 10)}%` : "10%",
              animationDelay: `${index * 50}ms`,
            }}
          />
        ))}
      </div>

      {/* Center dot */}
      <div className={cn("absolute inset-0 flex items-center justify-center")}>
        <div
          className={cn(
            "w-3 h-3 rounded-full transition-all duration-300",
            isActive ? "bg-white shadow-lg animate-pulse" : "bg-slate-400 dark:bg-slate-600",
          )}
        />
      </div>

      {/* Ripple effects */}
      {isActive && (
        <>
          <div className="absolute inset-0 rounded-full border-2 border-blue-400/30 animate-ping" />
          <div className="absolute inset-2 rounded-full border border-purple-400/20 animate-ping animation-delay-200" />
        </>
      )}
    </div>
  )
}
