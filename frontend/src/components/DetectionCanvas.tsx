import { useCallback, useEffect, useRef, useState } from "react"
import type { Detection } from "../types/garbageDetectionApi"
import { drawDetections } from "../utils/drawDetections"

type DetectionCanvasProps = {
  imageUrl: string
  detections: Detection[]
  hoveredId: number | null
}

export default function DetectionCanvas({
  imageUrl,
  detections,
  hoveredId,
}: DetectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const image = new Image()
    image.onload = () => {
      if (!active) return
      imageRef.current = image
      setLoadedImageUrl(imageUrl)
    }
    image.src = imageUrl

    return () => {
      active = false
      image.onload = null
      imageRef.current = null
      setLoadedImageUrl(null)
    }
  }, [imageUrl])

  const redraw = useCallback(() => {
    if (canvasRef.current && imageRef.current && loadedImageUrl === imageUrl) {
      drawDetections(canvasRef.current, imageRef.current, detections, hoveredId)
    }
  }, [detections, hoveredId, imageUrl, loadedImageUrl])

  useEffect(() => {
    redraw()
  }, [redraw])

  useEffect(() => {
    const handleResize = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      animationFrameRef.current = requestAnimationFrame(redraw)
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [redraw])

  return (
    <canvas
      ref={canvasRef}
      className="block size-full"
      aria-label="Detected objects and bounding boxes"
    />
  )
}
