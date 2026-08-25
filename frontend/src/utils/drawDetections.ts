import type { Detection } from "../types/garbageDetectionApi"

export function drawDetections(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  detections: Detection[],
  hoveredId: number | null,
) {
  const context = canvas.getContext("2d")
  if (!context) return

  const devicePixelRatio = window.devicePixelRatio || 1
  const rectangle = canvas.getBoundingClientRect()
  canvas.width = rectangle.width * devicePixelRatio
  canvas.height = rectangle.height * devicePixelRatio
  context.scale(devicePixelRatio, devicePixelRatio)

  const canvasWidth = rectangle.width
  const canvasHeight = rectangle.height
  const imageAspect = image.naturalWidth / image.naturalHeight
  const canvasAspect = canvasWidth / canvasHeight

  let drawWidth: number
  let drawHeight: number
  let offsetX: number
  let offsetY: number

  if (imageAspect > canvasAspect) {
    drawWidth = canvasWidth
    drawHeight = canvasWidth / imageAspect
    offsetX = 0
    offsetY = (canvasHeight - drawHeight) / 2
  } else {
    drawHeight = canvasHeight
    drawWidth = canvasHeight * imageAspect
    offsetX = (canvasWidth - drawWidth) / 2
    offsetY = 0
  }

  context.clearRect(0, 0, canvasWidth, canvasHeight)
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)

  const vignette = context.createRadialGradient(
    canvasWidth / 2,
    canvasHeight / 2,
    Math.min(canvasWidth, canvasHeight) * 0.3,
    canvasWidth / 2,
    canvasHeight / 2,
    Math.max(canvasWidth, canvasHeight) * 0.75,
  )
  vignette.addColorStop(0, "rgba(244,247,245,0)")
  vignette.addColorStop(1, "rgba(244,247,245,0.25)")
  context.fillStyle = vignette
  context.fillRect(0, 0, canvasWidth, canvasHeight)

  detections.forEach((detection) => {
    drawDetection(
      context,
      detection,
      detection.id === hoveredId,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight,
    )
  })
}

function drawDetection(
  context: CanvasRenderingContext2D,
  detection: Detection,
  isHovered: boolean,
  offsetX: number,
  offsetY: number,
  drawWidth: number,
  drawHeight: number,
) {
  const boxX = offsetX + detection.box.x * drawWidth
  const boxY = offsetY + detection.box.y * drawHeight
  const boxWidth = detection.box.w * drawWidth
  const boxHeight = detection.box.h * drawHeight
  const alpha = isHovered ? 1 : 0.75
  const lineWidth = isHovered ? 2 : 1.5

  context.strokeStyle =
    detection.color +
    Math.round(alpha * 255)
      .toString(16)
      .padStart(2, "0")
  context.lineWidth = lineWidth
  context.strokeRect(boxX, boxY, boxWidth, boxHeight)

  if (isHovered) {
    context.strokeStyle = `${detection.color}30`
    context.lineWidth = 8
    context.strokeRect(boxX + 1, boxY + 1, boxWidth - 2, boxHeight - 2)
  }

  drawCorners(context, detection.color, boxX, boxY, boxWidth, boxHeight)
  drawLabel(context, detection, boxX, boxY)
}

function drawCorners(
  context: CanvasRenderingContext2D,
  color: string,
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number,
) {
  const cornerLength = 10
  const corners = [
    [boxX, boxY, boxX + cornerLength, boxY, boxX, boxY + cornerLength],
    [
      boxX + boxWidth,
      boxY,
      boxX + boxWidth - cornerLength,
      boxY,
      boxX + boxWidth,
      boxY + cornerLength,
    ],
    [
      boxX,
      boxY + boxHeight,
      boxX + cornerLength,
      boxY + boxHeight,
      boxX,
      boxY + boxHeight - cornerLength,
    ],
    [
      boxX + boxWidth,
      boxY + boxHeight,
      boxX + boxWidth - cornerLength,
      boxY + boxHeight,
      boxX + boxWidth,
      boxY + boxHeight - cornerLength,
    ],
  ]

  context.strokeStyle = color
  context.lineWidth = 2
  corners.forEach(([x1, y1, x2, y2, x3, y3]) => {
    context.beginPath()
    context.moveTo(x2, y2)
    context.lineTo(x1, y1)
    context.lineTo(x3, y3)
    context.stroke()
  })
}

function drawLabel(
  context: CanvasRenderingContext2D,
  detection: Detection,
  boxX: number,
  boxY: number,
) {
  const label = `${detection.label}  ${Math.round(detection.confidence * 100)}%`
  const chipHeight = 20
  context.font = "500 11px 'JetBrains Mono', monospace"

  const textWidth = context.measureText(label).width
  const chipY = boxY - chipHeight - 3 < 0 ? boxY + 3 : boxY - chipHeight - 3

  context.fillStyle = `${detection.color}ee`
  context.fillRect(boxX, chipY, textWidth + 12, chipHeight)
  context.fillStyle = "#ffffff"
  context.fillText(label, boxX + 6, chipY + 13.5)
}
