import { useState, useRef, useCallback, useEffect } from "react";

type Detection = {
  id: number;
  label: string;
  confidence: number;
  box: { x: number; y: number; w: number; h: number }; // normalized 0-1
  color: string;
  category: string;
};

const DEMO_DETECTIONS: Detection[] = [
  { id: 1, label: "Plastic Bottle", confidence: 0.96, box: { x: 0.08, y: 0.12, w: 0.18, h: 0.42 }, color: "#15803d", category: "Plastic" },
  { id: 2, label: "Aluminum Can", confidence: 0.91, box: { x: 0.38, y: 0.25, w: 0.16, h: 0.35 }, color: "#0891b2", category: "Metal" },
  { id: 3, label: "Cardboard Box", confidence: 0.88, box: { x: 0.60, y: 0.08, w: 0.30, h: 0.48 }, color: "#d97706", category: "Paper" },
  { id: 4, label: "Glass Jar", confidence: 0.79, box: { x: 0.22, y: 0.55, w: 0.14, h: 0.30 }, color: "#7c3aed", category: "Glass" },
  { id: 5, label: "Plastic Bag", confidence: 0.74, box: { x: 0.62, y: 0.60, w: 0.22, h: 0.28 }, color: "#15803d", category: "Plastic" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Plastic: "#15803d",
  Metal: "#0891b2",
  Paper: "#d97706",
  Glass: "#7c3aed",
  Organic: "#65a30d",
  Electronic: "#dc2626",
  Other: "#4a6859",
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "#15803d" : pct >= 75 ? "#d97706" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div style={{ width: 72, height: 3, background: "#d4e0d9", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.8s ease" }} />
      </div>
      <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color, letterSpacing: "0.04em", minWidth: 36 }}>
        {pct}%
      </span>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
  return (
    <span style={{
      fontFamily: "JetBrains Mono",
      fontSize: 9,
      letterSpacing: "0.12em",
      color,
      background: `${color}18`,
      border: `1px solid ${color}40`,
      borderRadius: 2,
      padding: "1px 6px",
      textTransform: "uppercase",
    }}>
      {category}
    </span>
  );
}

function drawDetections(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  detections: Detection[],
  hoveredId: number | null
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;

  // Letterbox fit
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const canvasAspect = W / H;
  let drawW: number, drawH: number, offsetX: number, offsetY: number;
  if (imgAspect > canvasAspect) {
    drawW = W;
    drawH = W / imgAspect;
    offsetX = 0;
    offsetY = (H - drawH) / 2;
  } else {
    drawH = H;
    drawW = H * imgAspect;
    offsetX = (W - drawW) / 2;
    offsetY = 0;
  }

  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

  // Dark vignette overlay
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  grad.addColorStop(0, "rgba(244,247,245,0)");
  grad.addColorStop(1, "rgba(244,247,245,0.25)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  detections.forEach((det) => {
    const bx = offsetX + det.box.x * drawW;
    const by = offsetY + det.box.y * drawH;
    const bw = det.box.w * drawW;
    const bh = det.box.h * drawH;
    const isHovered = hoveredId === det.id;
    const alpha = isHovered ? 1 : 0.75;
    const lineW = isHovered ? 2 : 1.5;

    // Box
    ctx.strokeStyle = det.color + Math.round(alpha * 255).toString(16).padStart(2, "0");
    ctx.lineWidth = lineW;
    ctx.strokeRect(bx, by, bw, bh);

    // Inner glow
    if (isHovered) {
      ctx.strokeStyle = det.color + "30";
      ctx.lineWidth = 8;
      ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
      ctx.lineWidth = lineW;
    }

    // Corner marks
    const cm = 10;
    ctx.strokeStyle = det.color;
    ctx.lineWidth = 2;
    const corners = [
      [bx, by, bx + cm, by, bx, by + cm],
      [bx + bw, by, bx + bw - cm, by, bx + bw, by + cm],
      [bx, by + bh, bx + cm, by + bh, bx, by + bh - cm],
      [bx + bw, by + bh, bx + bw - cm, by + bh, bx + bw, by + bh - cm],
    ];
    corners.forEach(([x1, y1, x2, y2, x3, y3]) => {
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x3, y3);
      ctx.stroke();
    });

    // Label chip
    const label = `${det.label}  ${Math.round(det.confidence * 100)}%`;
    ctx.font = `500 11px 'JetBrains Mono', monospace`;
    const textW = ctx.measureText(label).width;
    const chipH = 20;
    const chipY = by - chipH - 3 < 0 ? by + 3 : by - chipH - 3;
    const chipX = bx;

    ctx.fillStyle = det.color + "ee";
    ctx.fillRect(chipX, chipY, textW + 12, chipH);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, chipX + 6, chipY + 13.5);
  });
}

type Stage = "idle" | "processing" | "done";

export default function App() {
  const [stage, setStage] = useState<Stage>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animFrameRef = useRef<number>(0);

  const redraw = useCallback(() => {
    if (canvasRef.current && imgRef.current) {
      drawDetections(canvasRef.current, imgRef.current, detections, hoveredId);
    }
  }, [detections, hoveredId]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    const handleResize = () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); animFrameRef.current = requestAnimationFrame(redraw); };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [redraw]);

  const processImage = useCallback((url: string) => {
    setImageUrl(url);
    setStage("processing");
    setProgress(0);
    setDetections([]);

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Simulate progressive inference
      let p = 0;
      const tick = setInterval(() => {
        p += Math.random() * 18 + 4;
        if (p >= 100) {
          p = 100;
          clearInterval(tick);
          setTimeout(() => {
            setDetections(DEMO_DETECTIONS);
            setStage("done");
          }, 300);
        }
        setProgress(Math.min(p, 100));
      }, 120);
    };
    img.src = url;
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    processImage(url);
  }, [processImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

  const reset = () => {
    setStage("idle");
    setImageUrl(null);
    setDetections([]);
    setHoveredId(null);
    setProgress(0);
    imgRef.current = null;
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const categoryGroups = detections.reduce<Record<string, Detection[]>>((acc, d) => {
    (acc[d.category] ||= []).push(d);
    return acc;
  }, {});

  const topScore = detections.length ? Math.max(...detections.map(d => d.confidence)) : 0;
  const avgScore = detections.length ? detections.reduce((s, d) => s + d.confidence, 0) / detections.length : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f4f7f5", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid #d4e0d9",
        padding: "0 32px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#f4f7f5",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 28, height: 28,
            border: "1.5px solid #15803d",
            borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            <div style={{ width: 12, height: 12, border: "1.5px solid #15803d", borderRadius: 2 }} />
            <div style={{ position: "absolute", top: 3, left: 3, width: 4, height: 4, background: "#15803d", borderRadius: "50%" }} />
          </div>
          <span style={{ fontFamily: "Outfit", fontSize: 15, fontWeight: 600, color: "#0f1f17", letterSpacing: "-0.01em" }}>
            GOD
          </span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 9, color: "#8aab98", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 1 }}>
            Garbage Object Detection
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", boxShadow: "0 0 6px #16a34a60" }} />
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#4a6859", letterSpacing: "0.08em" }}>MODEL ACTIVE</span>
          </div>
          {stage === "done" && (
            <button
              onClick={reset}
              style={{
                fontFamily: "JetBrains Mono", fontSize: 10, letterSpacing: "0.08em",
                color: "#4a6859", background: "transparent", border: "1px solid #d4e0d9",
                borderRadius: 3, padding: "4px 10px", cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = "#0f1f17"; (e.target as HTMLElement).style.borderColor = "#b6cfc2"; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = "#4a6859"; (e.target as HTMLElement).style.borderColor = "#d4e0d9"; }}
            >
              NEW IMAGE
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, padding: "32px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1400, margin: "0 auto", width: "100%" }}>

        {/* Idle upload state */}
        {stage === "idle" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 48 }}>
            {/* Hero text */}
            <div style={{ textAlign: "center", maxWidth: 520 }}>
              <div style={{
                fontFamily: "JetBrains Mono", fontSize: 10, letterSpacing: "0.2em",
                color: "#15803d", textTransform: "uppercase", marginBottom: 16,
              }}>
                CV / Object Detection v2.4
              </div>
              <h1 style={{
                fontFamily: "Outfit", fontSize: "clamp(32px, 5vw, 52px)",
                fontWeight: 600, color: "#0f1f17", lineHeight: 1.1,
                letterSpacing: "-0.03em", margin: "0 0 16px",
              }}>
                Identify waste.<br />
                <span style={{ color: "#15803d" }}>Classify instantly.</span>
              </h1>
              <p style={{ fontFamily: "Inter", fontSize: 15, color: "#4a6859", lineHeight: 1.6, margin: 0 }}>
                Upload an image containing waste items. The model detects each object, draws bounding boxes, and returns category labels with confidence scores.
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%", maxWidth: 560,
                border: `1.5px dashed ${dragOver ? "#15803d" : "#b6cfc2"}`,
                borderRadius: 8,
                padding: "52px 32px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
                cursor: "pointer",
                background: dragOver ? "#15803d08" : "#ffffff",
                transition: "all 0.2s",
              }}
            >
              {/* Upload icon */}
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="1" y="1" width="38" height="38" rx="6" stroke={dragOver ? "#15803d" : "#b6cfc2"} strokeWidth="1.5" />
                <path d="M20 26V14M20 14L14 20M20 14L26 20" stroke={dragOver ? "#15803d" : "#4a6859"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13 29H27" stroke={dragOver ? "#15803d" : "#8aab98"} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div>
                <p style={{ fontFamily: "Outfit", fontSize: 15, fontWeight: 500, color: "#0f1f17", margin: "0 0 4px", textAlign: "center" }}>
                  Drop image here or click to browse
                </p>
                <p style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#8aab98", letterSpacing: "0.08em", textAlign: "center", margin: 0 }}>
                  PNG · JPG · WEBP · up to 20 MB
                </p>
              </div>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileInput} />

            {/* Supported categories */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 480 }}>
              {Object.entries(CATEGORY_COLORS).filter(([k]) => k !== "Other").map(([cat, color]) => (
                <span key={cat} style={{
                  fontFamily: "JetBrains Mono", fontSize: 9, letterSpacing: "0.12em",
                  color, background: `${color}14`, border: `1px solid ${color}30`,
                  borderRadius: 2, padding: "3px 8px", textTransform: "uppercase",
                }}>
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Processing */}
        {stage === "processing" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32 }}>
            <div style={{ width: "100%", maxWidth: 560 }}>
              {/* Image preview */}
              {imageUrl && (
                <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", marginBottom: 28, position: "relative", background: "#ffffff" }}>
                  <img src={imageUrl} alt="Processing" style={{ width: "100%", height: "100%", objectFit: "contain", opacity: 0.5, filter: "grayscale(0.4)" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, transparent 40%, #f4f7f530)" }} />
                  {/* Scan line */}
                  <div style={{
                    position: "absolute", left: 0, right: 0,
                    height: 2,
                    background: "linear-gradient(90deg, transparent, #15803d, transparent)",
                    boxShadow: "none",
                    top: `${progress}%`,
                    transition: "top 0.1s linear",
                  }} />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#4a6859", letterSpacing: "0.1em" }}>
                  RUNNING INFERENCE
                </span>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#15803d" }}>
                  {Math.round(progress)}%
                </span>
              </div>
              <div style={{ width: "100%", height: 2, background: "#d4e0d9", borderRadius: 1 }}>
                <div style={{ height: "100%", background: "#15803d", borderRadius: 1, width: `${progress}%`, transition: "width 0.12s ease", boxShadow: "none" }} />
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 24 }}>
                {["Loading model weights", "Running NMS", "Classifying objects"].map((step, i) => (
                  <div key={step} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: progress > i * 33 ? "#15803d" : "#d4e0d9",
                      boxShadow: "none",
                      transition: "all 0.3s",
                    }} />
                    <span style={{ fontFamily: "JetBrains Mono", fontSize: 9, color: progress > i * 33 ? "#4a6859" : "#8aab98", letterSpacing: "0.08em" }}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {stage === "done" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, flex: 1, minHeight: 0 }}>

            {/* Canvas panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#4a6859", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    Detection Output
                  </span>
                  <span style={{
                    fontFamily: "JetBrains Mono", fontSize: 9, color: "#15803d",
                    background: "#15803d14", border: "1px solid #15803d30",
                    borderRadius: 2, padding: "1px 6px",
                  }}>
                    {detections.length} objects
                  </span>
                </div>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 9, color: "#8aab98", letterSpacing: "0.08em" }}>
                  hover detections to highlight
                </span>
              </div>

              <div style={{
                flex: 1, minHeight: 420, background: "#ffffff",
                border: "1px solid #d4e0d9", borderRadius: 6, overflow: "hidden",
                position: "relative",
              }}>
                <canvas
                  ref={canvasRef}
                  style={{ width: "100%", height: "100%", display: "block" }}
                />
              </div>
            </div>

            {/* Right panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0, overflow: "auto" }}>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "DETECTED", value: detections.length.toString(), unit: "obj" },
                  { label: "TOP CONF", value: `${Math.round(topScore * 100)}`, unit: "%" },
                  { label: "AVG CONF", value: `${Math.round(avgScore * 100)}`, unit: "%" },
                ].map(({ label, value, unit }) => (
                  <div key={label} style={{
                    background: "#ffffff", border: "1px solid #d4e0d9", borderRadius: 6,
                    padding: "12px 10px",
                  }}>
                    <div style={{ fontFamily: "JetBrains Mono", fontSize: 8, color: "#8aab98", letterSpacing: "0.14em", marginBottom: 6 }}>{label}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                      <span style={{ fontFamily: "Outfit", fontSize: 22, fontWeight: 600, color: "#0f1f17", lineHeight: 1 }}>{value}</span>
                      <span style={{ fontFamily: "JetBrains Mono", fontSize: 9, color: "#4a6859" }}>{unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Detection list */}
              <div style={{ background: "#ffffff", border: "1px solid #d4e0d9", borderRadius: 6, overflow: "hidden", flex: 1 }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #d4e0d9", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 9, color: "#4a6859", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    Detections
                  </span>
                </div>
                <div style={{ padding: 8 }}>
                  {detections
                    .sort((a, b) => b.confidence - a.confidence)
                    .map((det, idx) => (
                      <div
                        key={det.id}
                        onMouseEnter={() => setHoveredId(det.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        style={{
                          padding: "10px 10px",
                          borderRadius: 4,
                          background: hoveredId === det.id ? "#eef2ef" : "transparent",
                          border: `1px solid ${hoveredId === det.id ? "#b6cfc2" : "transparent"}`,
                          cursor: "default",
                          transition: "all 0.12s",
                          marginBottom: 2,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          {/* Index + color indicator */}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 2 }}>
                            <span style={{ fontFamily: "JetBrains Mono", fontSize: 9, color: "#8aab98" }}>
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                            <div style={{ width: 2, height: 24, background: det.color, borderRadius: 1, opacity: 0.7 }} />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 5 }}>
                              <span style={{ fontFamily: "Outfit", fontSize: 13, fontWeight: 500, color: "#0f1f17", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {det.label}
                              </span>
                              <CategoryBadge category={det.category} />
                            </div>
                            <ConfidenceBar value={det.confidence} />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Category breakdown */}
              <div style={{ background: "#ffffff", border: "1px solid #d4e0d9", borderRadius: 6, padding: "14px 16px" }}>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 9, color: "#4a6859", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                  Category Breakdown
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(categoryGroups).map(([cat, items]) => {
                    const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other;
                    const pct = Math.round((items.length / detections.length) * 100);
                    return (
                      <div key={cat}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontFamily: "JetBrains Mono", fontSize: 9, color, letterSpacing: "0.1em", textTransform: "uppercase" }}>{cat}</span>
                          <span style={{ fontFamily: "JetBrains Mono", fontSize: 9, color: "#4a6859" }}>{items.length} · {pct}%</span>
                        </div>
                        <div style={{ height: 2, background: "#d4e0d9", borderRadius: 1 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 1, opacity: 0.8, transition: "width 0.6s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action */}
              <button
                onClick={reset}
                style={{
                  fontFamily: "Outfit", fontSize: 13, fontWeight: 500,
                  color: "#ffffff", background: "#16a34a",
                  border: "none", borderRadius: 5, padding: "11px 0",
                  cursor: "pointer", width: "100%",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.target as HTMLElement).style.background = "#15803d"}
                onMouseLeave={e => (e.target as HTMLElement).style.background = "#16a34a"}
              >
                Analyze Another Image
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #d4e0d9", padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "JetBrains Mono", fontSize: 9, color: "#8aab98", letterSpacing: "0.1em" }}>
          GOD · Garbage Object Detection System
        </span>
        <span style={{ fontFamily: "JetBrains Mono", fontSize: 9, color: "#8aab98", letterSpacing: "0.08em" }}>
          YOLOv8 · ResNet-50 backbone · COCO-Waste dataset
        </span>
      </footer>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 960px) {
          main > div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 600px) {
          header { padding: 0 16px !important; }
          main { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}
