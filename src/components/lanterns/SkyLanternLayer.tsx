"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, X, Sparkles, Heart, Loader2 } from "lucide-react";
import { playLanternReleaseSound, playSparkSound } from "@/lib/soundEngine";
import { getEvergreenTarget } from "@/lib/dateUtils";

export type LanternColor = "gold" | "ruby" | "cyan" | "violet";

export interface LanternItem {
  id: string;
  senderName: string;
  message: string;
  color: LanternColor;
  x: number; // percentage left
  duration: number;
  delay: number;
  scale: number;
  isUserCreated?: boolean;
}

// Per-color SVG fill/glow values for the realistic paper lantern
const COLOR_CONFIGS: Record<
  LanternColor,
  {
    // translucent paper fill colour
    paperFill: string;
    // inner radial glow colour (the candle light blooming through paper)
    innerGlow: string;
    // outer CSS drop-shadow colour
    outerGlow: string;
    // rim / wire stroke colour
    rimStroke: string;
    // flame base colour
    flameColor: string;
    // sender badge text colour (Tailwind class)
    text: string;
    // selector colour for modal badge (gradient)
    gradient: string;
    shadow: string;
    border: string;
  }
> = {
  gold: {
    paperFill:  "rgba(234, 88, 12, 0.78)",
    innerGlow:  "rgba(254, 240, 138, 0.95)",
    outerGlow:  "rgba(249, 115, 22, 0.85)",
    rimStroke:  "rgba(120, 53, 15, 0.85)",
    flameColor: "#fef08a",
    text:       "text-amber-200",
    gradient:   "from-amber-500/90 via-orange-400/65 to-amber-200/40",
    shadow:     "shadow-[0_0_22px_rgba(245,158,11,0.75)]",
    border:     "border-amber-400/70",
  },
  ruby: {
    paperFill:  "rgba(244,63,94,0.65)",
    innerGlow:  "rgba(255,140,140,0.85)",
    outerGlow:  "rgba(244,63,94,0.80)",
    rimStroke:  "rgba(140,20,40,0.70)",
    flameColor: "#ff9966",
    text:       "text-rose-200",
    gradient:   "from-rose-600/90 via-red-500/65 to-pink-200/40",
    shadow:     "shadow-[0_0_22px_rgba(244,63,94,0.75)]",
    border:     "border-rose-400/70",
  },
  cyan: {
    paperFill:  "rgba(6,182,212,0.60)",
    innerGlow:  "rgba(150,240,255,0.85)",
    outerGlow:  "rgba(6,182,212,0.80)",
    rimStroke:  "rgba(10,100,130,0.70)",
    flameColor: "#77eeff",
    text:       "text-cyan-200",
    gradient:   "from-cyan-500/90 via-sky-400/65 to-blue-200/40",
    shadow:     "shadow-[0_0_22px_rgba(6,182,212,0.75)]",
    border:     "border-cyan-400/70",
  },
  violet: {
    paperFill:  "rgba(168,85,247,0.65)",
    innerGlow:  "rgba(220,160,255,0.85)",
    outerGlow:  "rgba(168,85,247,0.80)",
    rimStroke:  "rgba(80,20,130,0.70)",
    flameColor: "#dd99ff",
    text:       "text-purple-200",
    gradient:   "from-purple-600/90 via-fuchsia-500/65 to-purple-200/40",
    shadow:     "shadow-[0_0_22px_rgba(168,85,247,0.75)]",
    border:     "border-purple-400/70",
  },
};

// Inject lantern-specific CSS keyframes once
const LANTERN_STYLES = `
@keyframes lanternFlicker {
  0%,100% { opacity:1;    transform:scaleX(1)    scaleY(1);    }
  15%      { opacity:0.75; transform:scaleX(0.82) scaleY(1.18); }
  35%      { opacity:0.92; transform:scaleX(1.12) scaleY(0.88); }
  55%      { opacity:0.70; transform:scaleX(0.88) scaleY(1.12); }
  75%      { opacity:1;    transform:scaleX(1.06) scaleY(0.94); }
}
@keyframes lanternGlowPulse {
  0%,100% { opacity:0.70; }
  40%     { opacity:1;    }
  70%     { opacity:0.82; }
}
@keyframes lanternSway {
  0%     { transform: rotate(-3deg) translateX(0px);  }
  25%    { transform: rotate(1.5deg) translateX(2px); }
  50%    { transform: rotate(3deg)  translateX(0px);  }
  75%    { transform: rotate(-1deg) translateX(-2px); }
  100%   { transform: rotate(-3deg) translateX(0px);  }
}
@keyframes lanternDrift {
  0%,100% { transform: rotate(-1.5deg); }
  50%     { transform: rotate( 1.5deg); }
}
`;

const INITIAL_LANTERNS: LanternItem[] = [
  {
    id: "init-1",
    senderName: "S.B. Himel",
    message: "Memories draw me near. while reality sets me apart. Some souls dwall closest within the heart.",
    color: "ruby",
    x: 12,
    duration: 36,
    delay: 0,
    scale: 0.9,
  },
  {
    id: "init-2",
    senderName: "Afra",
    message: "Sending light and warmth to my family and friends across the miles.",
    color: "cyan",
    x: 26,
    duration: 42,
    delay: 7,
    scale: 0.8,
  },
  {
    id: "init-3",
    senderName: "Sadia",
    message: "Leaving all doubts in 2026. Embracing courage, purpose, and joy in 2027!",
    color: "ruby",
    x: 74,
    duration: 34,
    delay: 3,
    scale: 0.95,
  },
  {
    id: "init-4",
    senderName: "Hamim909",
    message: "May every quiet dream we whispered to the stars find wings this coming year.",
    color: "gold",
    x: 86,
    duration: 40,
    delay: 12,
    scale: 0.85,
  },
  {
    id: "init-5",
    senderName: "Samia",
    message: "Lighting this lantern for peace, healing, and gratitude under the midnight sky.",
    color: "violet",
    x: 52,
    duration: 38,
    delay: 16,
    scale: 0.75,
  },
];

interface SkyLanternLayerProps {
  isReleaseOpen: boolean;
  onCloseRelease: () => void;
  isCelebrating?: boolean;
}

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:5000";

interface BackendLantern {
  _id: string;
  senderName: string;
  recipientName?: string;
  message: string;
  color: LanternColor;
  targetYear: number;
  isLocked?: boolean;
  unlockAt?: string;
  sparks?: number;
  userId?: string | null;
  createdAt?: string;
}

function mapBackendToLantern(item: BackendLantern, index: number): LanternItem {
  const spreadPositions = [12, 26, 74, 86, 52, 38, 64, 20, 80, 45, 68, 15, 82, 30, 60];
  const x = spreadPositions[index % spreadPositions.length] ?? ((index * 23) % 76 + 12);
  const duration = 34 + (index % 5) * 3;
  const delay = (index % 6) * 2.5;
  const scale = 0.8 + (index % 4) * 0.08;

  return {
    id: item._id,
    senderName: item.senderName,
    message: item.message,
    color: (["gold", "ruby", "cyan", "violet"].includes(item.color) ? item.color : "gold") as LanternColor,
    x,
    duration,
    delay,
    scale,
  };
}

export default function SkyLanternLayer({
  isReleaseOpen,
  onCloseRelease,
  isCelebrating = false,
}: SkyLanternLayerProps) {
  const [lanterns, setLanterns] = useState<LanternItem[]>(INITIAL_LANTERNS);
  const [selectedLantern, setSelectedLantern] = useState<LanternItem | null>(null);
  const [sparksCount, setSparksCount] = useState<Record<string, number>>({});
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setIsLoading] = useState(true);
  const [isSparking, setIsSparking] = useState(false);

  // Fetch existing lanterns from backend API on mount
  useEffect(() => {
    let isMounted = true;
    const target = getEvergreenTarget();
    const targetYear = target.targetYear;

    async function loadLanterns() {
      try {
        setIsLoading(true);
        const res = await fetch(`${SERVER_URL}/api/lanterns?year=${targetYear}`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch lanterns: ${res.statusText}`);
        }

        const data: BackendLantern[] = await res.json();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          const mapped = data.map((item, idx) => mapBackendToLantern(item, idx));
          setLanterns(mapped);

          const initialSparks: Record<string, number> = {};
          data.forEach((item) => {
            if (item._id && typeof item.sparks === "number") {
              initialSparks[item._id] = item.sparks;
            }
          });
          setSparksCount((prev) => ({ ...initialSparks, ...prev }));
        }
      } catch (err) {
        console.error("Could not fetch lanterns from API, using fallback lanterns:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadLanterns();

    return () => {
      isMounted = false;
    };
  }, []);

  // When celebration mode activates, release special celebration lanterns rising together
  useEffect(() => {
    if (isCelebrating) {
      const celebrationLanterns: LanternItem[] = [
        {
          id: `celeb-1-${Date.now()}`,
          senderName: "2027 Horizon",
          message: "Welcome to 2027! May this year be filled with wonder and boundless light.",
          color: "gold",
          x: 38,
          duration: 26,
          delay: 0.4,
          scale: 1.15,
          isUserCreated: true,
        },
        {
          id: `celeb-2-${Date.now()}`,
          senderName: "Midnight Wishes",
          message: "Peace, prosperity, and radiant joy for everyone across the globe!",
          color: "ruby",
          x: 64,
          duration: 28,
          delay: 1.2,
          scale: 1.05,
          isUserCreated: true,
        },
        {
          id: `celeb-3-${Date.now()}`,
          senderName: "Starlight 2027",
          message: "May all our hopes rise and shine as brightly as the midnight stars.",
          color: "cyan",
          x: 22,
          duration: 30,
          delay: 2.0,
          scale: 1.0,
          isUserCreated: true,
        },
      ];
      setLanterns((prev) => [
        ...celebrationLanterns,
        ...prev.filter((l) => !l.id.startsWith("celeb-")),
      ]);
    }
  }, [isCelebrating]);

  // Form states for release modal
  const [senderName, setSenderName] = useState("");
  const [message, setMessage] = useState("");
  const [selectedColor, setSelectedColor] = useState<LanternColor>("gold");
  const [formError, setFormError] = useState("");

  const handleReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim()) {
      setFormError("Please enter your name");
      return;
    }
    if (!message.trim()) {
      setFormError("Please write a wish or message");
      return;
    }

    const target = getEvergreenTarget();
    const targetYear = target.targetYear;

    try {
      setIsSubmitting(true);
      setFormError("");

      const res = await fetch(`${SERVER_URL}/api/lanterns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          senderName: senderName.trim(),
          message: message.trim(),
          color: selectedColor,
          targetYear,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || "Failed to release lantern. Please try again.");
      }

      const created: BackendLantern = await res.json();

      const newLantern: LanternItem = {
        id: created._id || `user-${Date.now()}`,
        senderName: created.senderName || senderName.trim(),
        message: created.message || message.trim(),
        color: (created.color || selectedColor) as LanternColor,
        x: Math.floor(Math.random() * 45) + 25, // center-ish trajectory (25-70%)
        duration: 30,
        delay: 0,
        scale: 1.15,
        isUserCreated: true,
      };

      setLanterns((prev) => [newLantern, ...prev]);
      setSenderName("");
      setMessage("");
      setFormError("");
      onCloseRelease();

      // Play subtle ethereal chime for lantern ascent
      playLanternReleaseSound();

      // Show ascending confirmation toast
      setSuccessToast(`Your lantern has ascended into the ${targetYear} horizon!`);
      setTimeout(() => {
        setSuccessToast(null);
      }, 4000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to release lantern. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSpark = async (id: string) => {
    if (isSparking) return;

    playSparkSound();

    // Optimistic UI update
    setSparksCount((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));

    // If ID is not a MongoDB ObjectId (e.g. mock or local fallback IDs), keep local update
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(id);
    if (!isMongoId) {
      return;
    }

    try {
      setIsSparking(true);
      const res = await fetch(`${SERVER_URL}/api/lanterns/${id}/spark`, {
        method: "PATCH",
        credentials: "include",
      });

      if (res.ok) {
        const updated: BackendLantern = await res.json();
        if (typeof updated.sparks === "number") {
          const newSparks = updated.sparks;
          setSparksCount((prev) => ({
            ...prev,
            [id]: newSparks,
          }));
        }
      } else {
        console.warn(`Could not sync spark to server for lantern ${id}: ${res.statusText}`);
      }
    } catch (err) {
      console.error("Error sparking lantern:", err);
    } finally {
      setIsSparking(false);
    }
  };

  return (
    <>
      {/* Inject lantern keyframe styles once */}
      <style dangerouslySetInnerHTML={{ __html: LANTERN_STYLES }} />

      {/* Floating Lanterns Layer */}
      <div
        className={`fixed inset-0 pointer-events-none z-15 overflow-hidden transition-all duration-1000 ${
          isCelebrating ? "brightness-125 drop-shadow-[0_0_25px_rgba(245,158,11,0.5)]" : ""
        }`}
      >
        {lanterns.map((lantern) => {
          const cfg = COLOR_CONFIGS[lantern.color];
          // Scale the SVG viewBox size with lantern.scale
          const w = Math.round(52 * lantern.scale);
          const h = Math.round(78 * lantern.scale);

          return (
            <motion.div
              key={lantern.id}
              data-interactive="true"
              className="absolute pointer-events-auto cursor-pointer group"
              style={{ left: `${lantern.x}%` }}
              initial={{ y: "105vh", opacity: 0 }}
              animate={{
                y: "-25vh",
                opacity: [0, 0.95, 0.95, 0],
                x: [0, 14, -14, 10, 0],
              }}
              transition={{
                y: {
                  duration: lantern.duration,
                  ease: "linear",
                  repeat: Infinity,
                  delay: lantern.delay,
                },
                x: {
                  duration: 9,
                  ease: "easeInOut",
                  repeat: Infinity,
                },
                opacity: {
                  duration: lantern.duration,
                  times: [0, 0.08, 0.92, 1],
                  repeat: Infinity,
                  delay: lantern.delay,
                },
              }}
              whileHover={{ scale: 1.25 }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedLantern(lantern);
              }}
            >
              {/* ── Traditional Bangladeshi Paper Sky Lantern (Fanush) ── */}
              <svg
                width={w}
                height={h}
                viewBox="0 0 60 88"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  display: "block",
                  filter: `drop-shadow(0 0 8px ${cfg.outerGlow}) drop-shadow(0 0 20px ${cfg.outerGlow})`,
                  animation: "lanternDrift 7s ease-in-out infinite",
                }}
                aria-hidden="true"
              >
                <defs>
                  {/* Radiant core internal glow - brightest at the lower center above the mouth */}
                  <radialGradient id={`glow-${lantern.id}`} cx="50%" cy="72%" r="65%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                    <stop offset="18%" stopColor={cfg.innerGlow} stopOpacity="0.95" />
                    <stop offset="48%" stopColor={cfg.paperFill} stopOpacity="0.88" />
                    <stop offset="85%" stopColor={cfg.paperFill} stopOpacity="0.75" />
                    <stop offset="100%" stopColor={cfg.paperFill} stopOpacity="0.60" />
                  </radialGradient>

                  {/* 3D cylindrical/spherical shading gradient across panels */}
                  <linearGradient id={`shade-${lantern.id}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#000000" stopOpacity="0.45" />
                    <stop offset="18%" stopColor="#000000" stopOpacity="0.12" />
                    <stop offset="50%" stopColor="#ffffff" stopOpacity="0.10" />
                    <stop offset="82%" stopColor="#000000" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.42" />
                  </linearGradient>

                  {/* Top-down vertical depth gradient - warmth fades slightly toward the pointed top */}
                  <linearGradient id={`vert-${lantern.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#000000" stopOpacity="0.30" />
                    <stop offset="35%" stopColor="#000000" stopOpacity="0.05" />
                    <stop offset="70%" stopColor="#ffffff" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.45" />
                  </linearGradient>

                  {/* Open bottom void seen from slightly below */}
                  <radialGradient id={`mouth-${lantern.id}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                    <stop offset="25%" stopColor={cfg.innerGlow} stopOpacity="0.95" />
                    <stop offset="70%" stopColor="#381002" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#1a0600" stopOpacity="0.95" />
                  </radialGradient>

                  {/* Flame flicker gradient */}
                  <radialGradient id={`flame-${lantern.id}`} cx="50%" cy="80%" r="60%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                    <stop offset="35%" stopColor="#fef08a" stopOpacity="0.95" />
                    <stop offset="75%" stopColor="#f97316" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
                  </radialGradient>

                  {/* Lantern shape clip path for folds & creases */}
                  <clipPath id={`clip-${lantern.id}`}>
                    <path d="M 30,3 C 21,8 7,22 3,42 C 0,55 4,66 16,74 L 17,76 C 20,79 40,79 43,76 L 44,74 C 56,66 60,55 57,42 C 53,22 39,8 30,3 Z" />
                  </clipPath>
                </defs>

                {/* 1. Main Inflated Diamond/Balloon Paper Body */}
                <path
                  d="M 30,3 C 21,8 7,22 3,42 C 0,55 4,66 16,74 L 17,76 C 20,79 40,79 43,76 L 44,74 C 56,66 60,55 57,42 C 53,22 39,8 30,3 Z"
                  fill={`url(#glow-${lantern.id})`}
                  style={{ animation: "lanternGlowPulse 3s ease-in-out infinite" }}
                />

                {/* 2. 3D Lateral Light/Shading for volume */}
                <path
                  d="M 30,3 C 21,8 7,22 3,42 C 0,55 4,66 16,74 L 17,76 C 20,79 40,79 43,76 L 44,74 C 56,66 60,55 57,42 C 53,22 39,8 30,3 Z"
                  fill={`url(#shade-${lantern.id})`}
                  style={{ mixBlendMode: "multiply" }}
                />

                {/* 3. Vertical warmth gradient */}
                <path
                  d="M 30,3 C 21,8 7,22 3,42 C 0,55 4,66 16,74 L 17,76 C 20,79 40,79 43,76 L 44,74 C 56,66 60,55 57,42 C 53,22 39,8 30,3 Z"
                  fill={`url(#vert-${lantern.id})`}
                  style={{ mixBlendMode: "screen" }}
                />

                {/* 4. Realistic Paper Panel Seams / Ribs (curving from apex to mouth) */}
                <g clipPath={`url(#clip-${lantern.id})`} stroke="#ffffff" strokeWidth="0.6" strokeOpacity="0.22" fill="none">
                  {/* Left outer panel seam */}
                  <path d="M 30,3 C 18,18 6,36 18,74" />
                  {/* Left inner panel seam */}
                  <path d="M 30,3 C 24,19 18,40 24,76" />
                  {/* Center fold crease */}
                  <path d="M 30,3 C 30,22 29,48 30,76" strokeOpacity="0.15" />
                  {/* Right inner panel seam */}
                  <path d="M 30,3 C 36,19 42,40 36,76" />
                  {/* Right outer panel seam */}
                  <path d="M 30,3 C 42,18 54,36 42,74" />
                </g>

                {/* 5. Organic Paper Wrinkles & Uneven Fold Creases */}
                <g clipPath={`url(#clip-${lantern.id})`} stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.14" fill="none">
                  <path d="M 12,32 Q 18,35 15,40" />
                  <path d="M 44,28 Q 40,34 46,38" />
                  <path d="M 7,48 Q 14,46 12,54" />
                  <path d="M 49,46 Q 44,50 51,55" />
                  <path d="M 21,58 Q 28,61 24,66" />
                  <path d="M 37,56 Q 32,60 38,65" />
                  <path d="M 19,22 Q 25,25 21,29" />
                  <path d="M 38,20 Q 34,24 39,28" />
                </g>

                {/* 6. Subtle pointed apex tip highlight */}
                <ellipse cx="30" cy="4" rx="2.5" ry="1.2" fill="#ffffff" fillOpacity="0.35" />

                {/* 7. Large Visible Circular Open Underside (viewed from below) */}
                {/* Interior illuminated chamber void */}
                <ellipse cx="30" cy="74.5" rx="14" ry="4.5" fill={`url(#mouth-${lantern.id})`} />
                {/* Thin bamboo/reed structural rim ring */}
                <ellipse cx="30" cy="74.5" rx="14" ry="4.5" stroke={cfg.rimStroke} strokeWidth="1.2" fill="none" strokeOpacity="0.9" />
                {/* Inner highlight on the bamboo rim */}
                <ellipse cx="30" cy="74" rx="13.2" ry="4" stroke="#ffffff" strokeWidth="0.5" fill="none" strokeOpacity="0.3" />

                {/* 8. Metal/Bamboo cross wires supporting the burner pad */}
                <line x1="17" y1="74.5" x2="43" y2="74.5" stroke={cfg.rimStroke} strokeWidth="0.8" strokeOpacity="0.75" />
                <line x1="30" y1="70.5" x2="30" y2="78.5" stroke={cfg.rimStroke} strokeWidth="0.8" strokeOpacity="0.75" />
                {/* Wax burner fuel pad */}
                <rect x="28" y="73.5" width="4" height="2" rx="0.8" fill="#d97706" />

                {/* 9. Small Realistic Flickering Flame inside the open base */}
                <g style={{ animation: "lanternFlicker 1.8s ease-in-out infinite", transformOrigin: "30px 73px" }}>
                  {/* Soft flame glow halo */}
                  <ellipse cx="30" cy="71.5" rx="5" ry="6.5" fill={`url(#flame-${lantern.id})`} />
                  {/* Teardrop flame core */}
                  <path d="M 30,66 C 28.5,69 28,71 30,74 C 32,71 31.5,69 30,66 Z" fill="#ffffff" />
                  {/* Hot yellow center */}
                  <circle cx="30" cy="72" r="1.5" fill="#fef08a" />
                </g>
              </svg>

              {/* Sender Name Badge — always visible, moves with lantern */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full glass-card border border-white/20 text-[9px] sm:text-[10px] font-semibold tracking-wide ${cfg.text} whitespace-nowrap shadow-[0_2px_10px_rgba(0,0,0,0.7)] backdrop-blur-md flex items-center gap-1 group-hover:scale-105 transition-all pointer-events-none`}
                style={{ bottom: `calc(100% + 4px)` }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 shadow-[0_0_4px_currentColor]" />
                <span>{lantern.senderName}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Floating Success Toast */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 glass-card border border-amber-400/50 px-5 py-3 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.4)] flex items-center gap-3 text-sm text-amber-200"
          >
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lantern Details Modal (When clicked) */}
      <AnimatePresence>
        {selectedLantern && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={() => setSelectedLantern(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md glass-panel rounded-3xl border border-white/15 p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedLantern(null)}
                className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white glass-card transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Lantern Badge Header */}
              <div className="flex items-center gap-3 mb-5">
                {/* Mini lantern SVG preview */}
                <svg
                  width="32"
                  height="46"
                  viewBox="0 0 60 88"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{
                    filter: `drop-shadow(0 0 8px ${COLOR_CONFIGS[selectedLantern.color].outerGlow})`,
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  <defs>
                    <radialGradient id="modal-glow" cx="50%" cy="72%" r="65%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                      <stop offset="18%" stopColor={COLOR_CONFIGS[selectedLantern.color].innerGlow} stopOpacity="0.95" />
                      <stop offset="50%" stopColor={COLOR_CONFIGS[selectedLantern.color].paperFill} stopOpacity="0.88" />
                      <stop offset="100%" stopColor={COLOR_CONFIGS[selectedLantern.color].paperFill} stopOpacity="0.65" />
                    </radialGradient>
                    <linearGradient id="modal-shade" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#000000" stopOpacity="0.45" />
                      <stop offset="20%" stopColor="#000000" stopOpacity="0.10" />
                      <stop offset="50%" stopColor="#ffffff" stopOpacity="0.10" />
                      <stop offset="80%" stopColor="#000000" stopOpacity="0.10" />
                      <stop offset="100%" stopColor="#000000" stopOpacity="0.40" />
                    </linearGradient>
                    <radialGradient id="modal-mouth" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                      <stop offset="30%" stopColor={COLOR_CONFIGS[selectedLantern.color].innerGlow} stopOpacity="0.9" />
                      <stop offset="70%" stopColor="#381002" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#1a0600" stopOpacity="0.95" />
                    </radialGradient>
                    <radialGradient id="modal-flame" cx="50%" cy="80%" r="60%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                      <stop offset="40%" stopColor="#fef08a" stopOpacity="0.95" />
                      <stop offset="80%" stopColor="#f97316" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  {/* Balloon body */}
                  <path
                    d="M 30,3 C 21,8 7,22 3,42 C 0,55 4,66 16,74 L 17,76 C 20,79 40,79 43,76 L 44,74 C 56,66 60,55 57,42 C 53,22 39,8 30,3 Z"
                    fill="url(#modal-glow)"
                  />
                  <path
                    d="M 30,3 C 21,8 7,22 3,42 C 0,55 4,66 16,74 L 17,76 C 20,79 40,79 43,76 L 44,74 C 56,66 60,55 57,42 C 53,22 39,8 30,3 Z"
                    fill="url(#modal-shade)"
                    style={{ mixBlendMode: "multiply" }}
                  />
                  {/* Panel seam lines */}
                  <g stroke="#ffffff" strokeWidth="0.6" strokeOpacity="0.25" fill="none">
                    <path d="M 30,3 C 18,18 6,36 18,74" />
                    <path d="M 30,3 C 24,19 18,40 24,76" />
                    <path d="M 30,3 C 36,19 42,40 36,76" />
                    <path d="M 30,3 C 42,18 54,36 42,74" />
                  </g>
                  {/* Circular open underside */}
                  <ellipse cx="30" cy="74.5" rx="14" ry="4.5" fill="url(#modal-mouth)" />
                  <ellipse cx="30" cy="74.5" rx="14" ry="4.5" stroke={COLOR_CONFIGS[selectedLantern.color].rimStroke} strokeWidth="1.2" fill="none" strokeOpacity="0.9" />
                  <line x1="17" y1="74.5" x2="43" y2="74.5" stroke={COLOR_CONFIGS[selectedLantern.color].rimStroke} strokeWidth="0.8" strokeOpacity="0.75" />
                  <line x1="30" y1="70.5" x2="30" y2="78.5" stroke={COLOR_CONFIGS[selectedLantern.color].rimStroke} strokeWidth="0.8" strokeOpacity="0.75" />
                  {/* Small flickering flame */}
                  <g style={{ animation: "lanternFlicker 1.8s ease-in-out infinite", transformOrigin: "30px 73px" }}>
                    <ellipse cx="30" cy="71.5" rx="4.5" ry="6" fill="url(#modal-flame)" />
                    <path d="M 30,66 C 28.5,69 28,71 30,74 C 32,71 31.5,69 30,66 Z" fill="#ffffff" />
                  </g>
                </svg>
                <div>
                  <span className="text-[10px] tracking-widest uppercase font-semibold text-slate-400">
                    Sky Lantern Wish
                  </span>
                  <h3 className="text-xl font-bold text-white">
                    {selectedLantern.senderName}
                  </h3>
                </div>
              </div>

              {/* Message Content */}
              <div className="glass-card rounded-2xl p-5 mb-6 border border-white/10 relative">
                <span className="text-3xl font-serif text-amber-400/40 absolute top-2 left-3">
                  “
                </span>
                <p className="text-slate-200 text-sm sm:text-base leading-relaxed pl-5 pr-2 pt-1 font-light italic">
                  {selectedLantern.message}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={isSparking}
                  onClick={() => handleAddSpark(selectedLantern.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-card text-xs font-semibold text-amber-300 hover:text-white hover:border-amber-400/50 transition-all cursor-pointer group disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  <Heart className={`w-4 h-4 text-rose-400 group-hover:scale-125 transition-transform ${isSparking ? "scale-125 animate-pulse" : ""}`} />
                  <span>
                    Spark Light ({sparksCount[selectedLantern.id] || 0})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLantern(null)}
                  className="px-5 py-2.5 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Release a Lantern Modal */}
      <AnimatePresence>
        {isReleaseOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            onClick={onCloseRelease}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 25 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 25 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg glass-panel rounded-3xl border border-white/15 p-6 sm:p-8 shadow-[0_0_60px_rgba(0,0,0,0.85)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={onCloseRelease}
                className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white glass-card transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Title & Icon */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl glass-card flex items-center justify-center text-amber-400 border border-amber-500/40 shadow-[0_0_18px_rgba(245,158,11,0.3)]">
                  <Flame className="w-5 h-5 fill-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                    Release a Sky Lantern
                  </h2>
                  <p className="text-xs text-slate-400">
                    Send your 2027 prayer or wish into the midnight sky
                  </p>
                </div>
              </div>

              {formError && (
                <div className="mt-4 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleReleaseSubmit} className="mt-5 space-y-4">
                {/* Sender Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => {
                      setSenderName(e.target.value);
                      if (formError) setFormError("");
                    }}
                    placeholder="e.g. Abrar, Maya or Wanderer"
                    maxLength={40}
                    className="w-full px-4 py-2.5 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400/50 transition-colors"
                  />
                </div>

                {/* Wish / Message */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Your New Year Wish or Prayer
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (formError) setFormError("");
                    }}
                    placeholder="Write a message of hope, gratitude, or celebration..."
                    rows={3}
                    maxLength={160}
                    className="w-full px-4 py-2.5 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400/50 transition-colors resize-none"
                  />
                  <div className="text-right text-[10px] text-slate-500 mt-1">
                    {message.length}/160
                  </div>
                </div>

                {/* Lantern Color Picker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                    Lantern Glow
                  </label>
                  <div className="grid grid-cols-4 gap-2.5">
                    {(["gold", "ruby", "cyan", "violet"] as LanternColor[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          selectedColor === c
                            ? `${COLOR_CONFIGS[c].border} ${COLOR_CONFIGS[c].text} glass-panel shadow-[0_0_15px_rgba(255,255,255,0.15)] scale-105`
                            : "border-white/10 text-slate-400 glass-card hover:text-white"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            c === "gold"
                              ? "bg-amber-400"
                              : c === "ruby"
                              ? "bg-rose-500"
                              : c === "cyan"
                              ? "bg-cyan-400"
                              : "bg-purple-400"
                          }`}
                        />
                        <span>{c}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onCloseRelease}
                    className="px-5 py-2.5 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 font-bold text-xs tracking-wide shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Releasing...</span>
                      </>
                    ) : (
                      <>
                        <Flame className="w-4 h-4 fill-slate-950" />
                        <span>Release into Sky</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
