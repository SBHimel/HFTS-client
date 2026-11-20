"use client";

import { useState, useEffect } from "react";
import {
  getEvergreenTarget,
  getRemainingParts,
  type EvergreenTarget,
  type RemainingTime,
} from "@/lib/dateUtils";

interface CountdownUnitProps {
  value: string;
  label: string;
  highlight?: boolean;
}

function CountdownUnit({ value, label, highlight }: CountdownUnitProps) {
  return (
    <div className="flex flex-col items-center">
      <div 
        className={`glass-card relative flex items-center justify-center w-16 h-20 sm:w-24 sm:h-28 md:w-32 md:h-36 rounded-2xl border transition-all duration-300 ${
          highlight 
            ? "border-amber-400/50 glow-box-gold text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.25)]" 
            : "border-white/15 text-slate-100 hover:border-cyan-400/30"
        }`}
      >
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.07] to-transparent pointer-events-none" />
        <span className="text-2xl sm:text-4xl md:text-6xl font-extrabold tracking-tight tabular-nums drop-shadow-md">
          {value}
        </span>
      </div>
      <span className="mt-2 sm:mt-3 text-[10px] sm:text-xs tracking-widest uppercase font-semibold text-slate-400">
        {label}
      </span>
    </div>
  );
}

interface StaticCountdownProps {
  isCelebrating?: boolean;
  simulationSeconds?: number | null;
}

// Initial deterministic state for server and initial client render to avoid hydration mismatch
const INITIAL_TARGET: EvergreenTarget = {
  targetYear: 2027,
  targetDate: new Date(Date.UTC(2027, 0, 1, 0, 0, 0) - 6 * 60 * 60 * 1000),
  isCelebrating: false,
  celebrationYear: 2027,
};

export default function StaticCountdown({
  isCelebrating: propCelebrating = false,
  simulationSeconds = null,
}: StaticCountdownProps) {
  const [mounted, setMounted] = useState(false);
  const [target, setTarget] = useState<EvergreenTarget>(INITIAL_TARGET);
  const [remaining, setRemaining] = useState<RemainingTime | null>(null);

  useEffect(() => {
    setMounted(true);

    const updateTime = () => {
      const now = new Date();
      const currentTarget = getEvergreenTarget(now);
      setTarget(currentTarget);
      setRemaining(getRemainingParts(currentTarget.targetDate, now));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);

    return () => clearInterval(timer);
  }, []);

  const isRapidCountdown = simulationSeconds !== null && simulationSeconds > 0;
  const isCelebrationActive = (mounted && target.isCelebrating) || propCelebrating || simulationSeconds === 0;
  const celebrationYear = target.isCelebrating ? target.celebrationYear : target.targetYear;

  // Determine displayed numbers
  let daysStr = "00";
  let hoursStr = "00";
  let minutesStr = "00";
  let secondsStr = "00";

  if (isRapidCountdown && simulationSeconds !== null) {
    daysStr = "00";
    hoursStr = "00";
    minutesStr = "00";
    secondsStr = String(simulationSeconds).padStart(2, "0");
  } else if (isCelebrationActive) {
    daysStr = "00";
    hoursStr = "00";
    minutesStr = "00";
    secondsStr = "00";
  } else if (remaining) {
    daysStr = String(remaining.days).padStart(2, "0");
    hoursStr = String(remaining.hours).padStart(2, "0");
    minutesStr = String(remaining.minutes).padStart(2, "0");
    secondsStr = String(remaining.seconds).padStart(2, "0");
  }

  return (
    <section className="relative z-10 flex flex-col items-center text-center px-4 max-w-4xl mx-auto my-auto">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full glass-card border-white/10 text-xs tracking-widest uppercase text-amber-300 mb-6 transition-all">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
        <span>
          {isCelebrationActive
            ? "✦ CELEBRATION LIVE ✦"
            : isRapidCountdown
            ? "✦ MIDNIGHT IMMINENT ✦"
            : "New Year Horizon"}
        </span>
      </div>

      {/* Main Title / Cinematic Reveal */}
      <div className="mb-3 min-h-[3rem] sm:min-h-[4.5rem] flex items-center justify-center">
        {isCelebrationActive ? (
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tight text-white animate-pulse-glow">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-300 to-amber-200 glow-gold drop-shadow-[0_0_40px_rgba(251,191,36,0.6)]">
              HAPPY NEW YEAR {celebrationYear}!
            </span>
          </h1>
        ) : (
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tight text-white">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400">
              COUNTDOWN TO
            </span>{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-300 to-amber-200 glow-gold">
              {target.targetYear}
            </span>
          </h1>
        )}
      </div>

      <p className="text-xs sm:text-base text-slate-400 max-w-xl mb-8 sm:mb-10 px-2 sm:px-0">
        {isCelebrationActive
          ? `Welcome to ${celebrationYear}! May this year bring light, peace, and glorious memories across the world.`
          : isRapidCountdown
          ? "Brace for midnight! Transitioning into the new dawn..."
          : "An evergreen beacon for wishes, memories, and celebration across the midnight horizon."}
      </p>

      {/* Countdown Grid */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 md:gap-6 mb-8 sm:mb-10 w-full max-w-2xl px-1 sm:px-0">
        <CountdownUnit value={daysStr} label="Days" />
        <CountdownUnit value={hoursStr} label="Hours" />
        <CountdownUnit value={minutesStr} label="Minutes" />
        <CountdownUnit
          value={secondsStr}
          label="Seconds"
          highlight={isRapidCountdown || isCelebrationActive}
        />
      </div>

      {/* Target Marker */}
      <div className="flex items-center gap-2 text-xs text-slate-400 glass-card px-4 py-2 rounded-xl">
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
        <span>
          {isCelebrationActive
            ? `✦ ${celebrationYear} Horizon Reached • Celebration in Progress ✦`
            : `Target: January 1, ${target.targetYear} • 00:00:00 BST (UTC+6)`}
        </span>
      </div>
    </section>
  );
}
