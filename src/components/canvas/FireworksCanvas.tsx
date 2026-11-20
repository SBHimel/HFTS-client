"use client";

import { useEffect, useRef, useCallback } from "react";
import { playLaunchSound, playBurstSound } from "@/lib/soundEngine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrailPoint {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  decay: number;
  size: number;
  gravity: number;
  friction: number;
  flicker: boolean;
  trail: TrailPoint[];
  isWillow?: boolean;
}

interface Rocket {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  angle: number;
  color: string;
  explosionType: "willow" | "layered" | "classic";
  trail: TrailPoint[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLOR_PALETTES = [
  ["#f59e0b", "#fbbf24", "#fde047", "#ffffff", "#d97706"],
  ["#06b6d4", "#38bdf8", "#67e8f9", "#e0f2fe", "#ffffff"],
  ["#f43f5e", "#fb7185", "#fda4af", "#ffe4e6", "#e11d48"],
  ["#a855f7", "#c084fc", "#e879f9", "#fae8ff", "#9333ea"],
  ["#10b981", "#34d399", "#6ee7b7", "#d1fae5", "#059669"],
];

// Particle budget — hard limits to prevent browser freeze
const MAX_PARTICLES_NORMAL      = 220;
const MAX_PARTICLES_CELEBRATION = 420;
const MAX_ROCKETS               = 8;

// Frame-time throttle: skip render if last frame was drawn less than MIN_MS ago
// This caps effective fps to ~40 during heavy celebration without stalling rAF
const MIN_MS_NORMAL      = 16;  // ≈ 60 fps
const MIN_MS_CELEBRATION = 24;  // ≈ 40 fps

// Per-explosion particle counts — reduced significantly from previous values
const COUNTS = {
  willow:  { normal: 42, celebration: 56 },
  outer:   { normal: 28, celebration: 38 },
  inner:   { normal: 14, celebration: 18 },
  classic: { normal: 32, celebration: 44 },
  glitter: { normal:  7, celebration: 10 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Detect low-end device: small screen or limited CPU cores */
function isLowEndDevice(): boolean {
  if (typeof window === "undefined") return false;
  const cores = (navigator as { hardwareConcurrency?: number }).hardwareConcurrency ?? 4;
  const smallScreen = window.innerWidth * window.innerHeight < 500_000; // < ~720p
  return cores <= 2 || smallScreen;
}

/** Scale a particle count based on device tier */
function scaled(base: number): number {
  return isLowEndDevice() ? Math.ceil(base * 0.6) : base;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FireworksCanvasProps {
  isCelebrating?: boolean;
  isGrandFinale?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FireworksCanvas({
  isCelebrating = false,
  isGrandFinale = false,
  className = "",
}: FireworksCanvasProps) {
  const canvasRef        = useRef<HTMLCanvasElement | null>(null);
  const rocketsRef       = useRef<Rocket[]>([]);
  const particlesRef     = useRef<Particle[]>([]);
  const animFrameIdRef   = useRef<number | null>(null);
  const clickTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // All salvo stagger timeouts so they can be cancelled when phase ends
  const salvoTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Shared mutable ref for flags the render loop reads without re-subscribing
  const stateRef = useRef({ isCelebrating, isGrandFinale });
  stateRef.current = { isCelebrating, isGrandFinale };

  // ---------------------------------------------------------------------------
  // createExplosion — adds particles with hard-cap enforcement
  // ---------------------------------------------------------------------------
  const createExplosion = useCallback(
    (x: number, y: number, explosionType: "willow" | "layered" | "classic" = "classic", baseColor?: string) => {
      const celebrating = stateRef.current.isCelebrating;
      const maxP = celebrating ? MAX_PARTICLES_CELEBRATION : MAX_PARTICLES_NORMAL;

      // If already at the cap, skip spawning — prevents runaway accumulation
      if (particlesRef.current.length >= maxP) return;

      const palette = baseColor
        ? [baseColor, "#ffffff", baseColor]
        : COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)]!;

      const push = (p: Particle) => {
        if (particlesRef.current.length < maxP) particlesRef.current.push(p);
      };

      // 1. GOLDEN WILLOW — cascading weeping sparks
      if (explosionType === "willow") {
        const count   = scaled(celebrating ? COUNTS.willow.celebration : COUNTS.willow.normal);
        const goldColors = ["#ffd700", "#ffecb3", "#fbbf24", "#f59e0b", "#ffffff"];

        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 5.2 + 1.2;
          push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color:    goldColors[Math.floor(Math.random() * goldColors.length)]!,
            alpha:    1,
            decay:    Math.random() * 0.011 + 0.009, // slightly faster decay = shorter life = fewer active
            size:     Math.random() * 2 + 1,
            gravity:  0.055,
            friction: 0.978,
            flicker:  Math.random() > 0.4,
            trail:    [],
            isWillow: true,
          });
        }
      }
      // 2. LAYERED SPHERE — outer ring + inner pistil
      else if (explosionType === "layered") {
        const outerCount = scaled(celebrating ? COUNTS.outer.celebration : COUNTS.outer.normal);
        const innerCount = scaled(celebrating ? COUNTS.inner.celebration : COUNTS.inner.normal);
        const outerColor = palette[0]!;

        for (let i = 0; i < outerCount; i++) {
          const angle = (i / outerCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
          const speed = Math.random() * 1.5 + 5;
          push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color:    outerColor,
            alpha:    1,
            decay:    Math.random() * 0.016 + 0.014,
            size:     Math.random() * 1.8 + 1,
            gravity:  0.07,
            friction: 0.97,
            flicker:  Math.random() > 0.4,
            trail:    [],
          });
        }
        for (let j = 0; j < innerCount; j++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 2 + 1;
          push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color:    "#ffffff",
            alpha:    1,
            decay:    Math.random() * 0.02 + 0.016,
            size:     1.3,
            gravity:  0.065,
            friction: 0.96,
            flicker:  true,
            trail:    [],
          });
        }
      }
      // 3. CLASSIC CHRYSANTHEMUM
      else {
        const count = scaled(celebrating ? COUNTS.classic.celebration : COUNTS.classic.normal);
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 5.5 + 1.5;
          push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color:    palette[Math.floor(Math.random() * palette.length)]!,
            alpha:    1,
            decay:    Math.random() * 0.018 + 0.013,
            size:     Math.random() * 2 + 1,
            gravity:  0.078,
            friction: 0.97,
            flicker:  Math.random() > 0.4,
            trail:    [],
          });
        }
      }

      // Fine glitter sparks (fewer)
      const glitterCount = scaled(celebrating ? COUNTS.glitter.celebration : COUNTS.glitter.normal);
      for (let j = 0; j < glitterCount; j++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 7 + 2;
        push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color:    "#ffffff",
          alpha:    1,
          decay:    Math.random() * 0.028 + 0.022,
          size:     1,
          gravity:  0.09,
          friction: 0.95,
          flicker:  true,
          trail:    [],
        });
      }

      playBurstSound();
    },
    [] // stateRef.current is read inline — no dep needed
  );

  // ---------------------------------------------------------------------------
  // launchRocket — respects MAX_ROCKETS cap
  // ---------------------------------------------------------------------------
  const launchRocket = useCallback(
    (targetX: number, targetY: number, customColor?: string, customType?: "willow" | "layered" | "classic") => {
      if (!canvasRef.current) return;
      if (rocketsRef.current.length >= MAX_ROCKETS) return; // cap in-flight rockets

      playLaunchSound();

      const startX   = targetX + (Math.random() - 0.5) * 140;
      const startY   = window.innerHeight;
      const dx       = targetX - startX;
      const dy       = targetY - startY;
      const distance = Math.hypot(dx, dy);
      const angle    = Math.atan2(dy, dx);
      const speed    = Math.min(22, Math.max(13, distance / 26));

      const types: ("willow" | "layered" | "classic")[] = ["willow", "layered", "classic"];
      const explosionType = customType || types[Math.floor(Math.random() * types.length)]!;

      const palette = COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)]!;
      const color   = customColor || (explosionType === "willow" ? "#fbbf24" : palette[0]!);

      rocketsRef.current.push({ x: startX, y: startY, targetX, targetY, speed, angle, color, explosionType, trail: [] });
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Main render loop — single rAF, shared by all modes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width  = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    // Shadow blur is expensive — batch by color to minimise state changes
    // We render trails without shadow (cheap), and heads with shadow (one save/restore per particle)
    // but skip shadow on glitter (size === 1) in heavy-load mode

    let lastFrameTime = 0;

    const render = (timestamp: number) => {
      const { isCelebrating: cel } = stateRef.current;
      const minMs = cel ? MIN_MS_CELEBRATION : MIN_MS_NORMAL;

      if (timestamp - lastFrameTime < minMs) {
        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }
      lastFrameTime = timestamp;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const heavy = particlesRef.current.length > (cel ? 280 : 140);

      // --- Rockets ---
      for (let i = rocketsRef.current.length - 1; i >= 0; i--) {
        const rocket = rocketsRef.current[i]!;

        rocket.trail.push({ x: rocket.x, y: rocket.y });
        if (rocket.trail.length > 6) rocket.trail.shift();

        // Trail line (no shadow — cheap)
        if (rocket.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(rocket.trail[0]!.x, rocket.trail[0]!.y);
          for (let t = 1; t < rocket.trail.length; t++) ctx.lineTo(rocket.trail[t]!.x, rocket.trail[t]!.y);
          ctx.strokeStyle  = rocket.color;
          ctx.lineWidth    = 2;
          ctx.lineCap      = "round";
          ctx.globalAlpha  = 0.6;
          ctx.shadowBlur   = 0;
          ctx.stroke();
        }

        // Rocket head glow (single shadow call)
        ctx.beginPath();
        ctx.arc(rocket.x, rocket.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle    = "#ffffff";
        ctx.shadowColor  = rocket.color;
        ctx.shadowBlur   = heavy ? 6 : 12;
        ctx.globalAlpha  = 1;
        ctx.fill();
        ctx.shadowBlur   = 0;

        rocket.x += Math.cos(rocket.angle) * rocket.speed;
        rocket.y += Math.sin(rocket.angle) * rocket.speed;

        if (rocket.y <= rocket.targetY) {
          createExplosion(rocket.targetX, rocket.targetY, rocket.explosionType, rocket.color);
          rocketsRef.current.splice(i, 1);
        }
      }

      // --- Particles ---
      // Batch rendering: group trail draws (no shadow) then head draws (shadow)
      // This avoids per-particle save/restore and shadow state toggling

      // Pass 1: trails only (no shadow)
      ctx.shadowBlur = 0;
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i]!;

        // Physics update
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > (p.isWillow ? 4 : 2)) p.trail.shift();

        p.vx *= p.friction;
        p.vy  = p.vy * p.friction + p.gravity;
        p.x  += p.vx;
        p.y  += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        if (p.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(p.trail[0]!.x, p.trail[0]!.y);
          for (let t = 1; t < p.trail.length; t++) ctx.lineTo(p.trail[t]!.x, p.trail[t]!.y);
          ctx.strokeStyle = p.color;
          ctx.lineWidth   = p.size * 0.8;
          ctx.lineCap     = "round";
          ctx.globalAlpha = Math.max(0, p.alpha * 0.5);
          ctx.stroke();
        }
      }

      // Pass 2: particle heads with glow (shadow on, but skip on tiny glitter when heavy)
      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i]!;
        if (p.alpha <= 0) continue;

        const displayAlpha = p.flicker && Math.random() < 0.25 ? p.alpha * 0.4 : p.alpha;
        ctx.globalAlpha = Math.max(0, displayAlpha);

        const useGlow = !heavy || p.size > 1; // skip glow on glitter (size=1) when heavy
        if (useGlow) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur  = p.isWillow ? 6 : 5;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [createExplosion]);

  // ---------------------------------------------------------------------------
  // Click / tap: launch 2-rocket sequence (reduced from 3)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const launchSequence = (x: number, y: number) => {
      launchRocket(x, y, undefined, "layered");

      const t1 = setTimeout(() => {
        launchRocket(x + (Math.random() - 0.5) * 90, Math.max(60, y + (Math.random() - 0.5) * 50), undefined, "willow");
      }, 160);

      clickTimeoutsRef.current.push(t1);
    };

    const handleClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("button, a, input, select, textarea, [data-interactive]")) return;

      const clientX = "touches" in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? e.touches[0]?.clientY : (e as MouseEvent).clientY;
      if (clientX !== undefined && clientY !== undefined) launchSequence(clientX, clientY);
    };

    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("click", handleClick);
      clickTimeoutsRef.current.forEach(clearTimeout);
      clickTimeoutsRef.current = [];
    };
  }, [launchRocket]);

  // ---------------------------------------------------------------------------
  // Automated launcher — normal / celebration / grand-finale
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Helper: track and cancel all stagger timeouts
    const trackTimeout = (ms: number, fn: () => void) => {
      const id = setTimeout(fn, ms);
      salvoTimeoutsRef.current.push(id);
      return id;
    };
    const clearSalvoTimeouts = () => {
      salvoTimeoutsRef.current.forEach(clearTimeout);
      salvoTimeoutsRef.current = [];
    };

    if (!isCelebrating) {
      // Normal mode: one peaceful rocket every 3.5s
      const timer = setInterval(() => {
        const targetX = window.innerWidth  * (0.15 + Math.random() * 0.7);
        const targetY = window.innerHeight * (0.12 + Math.random() * 0.38);
        const types: ("willow" | "layered" | "classic")[] = ["willow", "layered", "classic"];
        launchRocket(targetX, targetY, undefined, types[Math.floor(Math.random() * types.length)]!);
      }, 3500);

      return () => {
        clearInterval(timer);
        clearSalvoTimeouts();
        // Drain particles gracefully on mode exit — accelerate decay
        particlesRef.current.forEach(p => { p.decay *= 3; });
        rocketsRef.current = [];
      };
    }

    // Celebration / Grand Finale salvos
    // Salvo size: 2 rockets in celebration, up to 3 in grand finale
    const launchSalvo = () => {
      const { isGrandFinale: gf } = stateRef.current;
      const salvoCount = gf ? Math.floor(Math.random() * 2) + 2 : 2; // 2-3 in gf, 2 in celebration

      const heights = [
        window.innerHeight * (0.10 + Math.random() * 0.08),
        window.innerHeight * (0.22 + Math.random() * 0.08),
        window.innerHeight * (0.34 + Math.random() * 0.08),
      ];

      for (let s = 0; s < salvoCount; s++) {
        const sectorWidth = window.innerWidth / salvoCount;
        const targetX = sectorWidth * s + Math.random() * (sectorWidth * 0.8) + sectorWidth * 0.1;
        const targetY = heights[s % heights.length]!;
        const types: ("willow" | "layered" | "classic")[] = ["willow", "layered", "classic"];
        const chosenType = types[s % types.length]!;

        // Stagger within salvo (60ms apart) so they don't all explode simultaneously
        trackTimeout(s * 60 + Math.random() * 20, () => launchRocket(targetX, targetY, undefined, chosenType));
      }
    };

    // Opening barrage: 2 salvos staggered (not 3 simultaneous)
    launchSalvo();
    trackTimeout(300, launchSalvo);

    // Continuous interval — 320ms celebration, 240ms grand finale
    const intervalMs = isGrandFinale ? 240 : 320;
    const celebrationTimer = setInterval(launchSalvo, intervalMs);

    return () => {
      clearInterval(celebrationTimer);
      clearSalvoTimeouts();
      // Drain particles on phase end
      particlesRef.current.forEach(p => { p.decay *= 3; });
      rocketsRef.current = [];
    };
  }, [isCelebrating, isGrandFinale, launchRocket]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-10 ${className}`}
    />
  );
}
