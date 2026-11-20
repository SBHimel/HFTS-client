"use client";

import { useState, useEffect, useRef } from "react";
import StarryBackground from "@/components/ui/StarryBackground";
import Navbar from "@/components/navigation/Navbar";
import StaticCountdown from "@/components/countdown/StaticCountdown";
import FireworksCanvas from "@/components/canvas/FireworksCanvas";
import SkyLanternLayer from "@/components/lanterns/SkyLanternLayer";
import ActionDock from "@/components/home/ActionDock";
import MemoryVaultModal from "@/components/memories/MemoryVaultModal";
import { getEvergreenTarget } from "@/lib/dateUtils";
import { isSoundEnabled, toggleSound, setupAutoPlay } from "@/lib/soundEngine";

export default function HomePage() {
  // Live celebration (real New Year arrival)
  const [liveCelebrating, setLiveCelebrating] = useState(false);
  const [liveGrandFinale, setLiveGrandFinale] = useState(false);

  // Preview Midnight simulation state
  const [previewPhase, setPreviewPhase] = useState<"idle" | "countdown" | "celebration">("idle");
  const [simulationSeconds, setSimulationSeconds] = useState<number | null>(null);
  const [grandFinaleActive, setGrandFinaleActive] = useState(false);

  // Other UI state
  const [isReleaseOpen, setIsReleaseOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Refs to allow cleanup of preview timers
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSoundEnabled(isSoundEnabled());
    const cleanupAutoPlay = setupAutoPlay();

    // Track live celebration and grand-finale (first 60s of New Year)
    const liveFinaleStartRef = { ts: 0 };

    const checkLive = () => {
      const target = getEvergreenTarget();
      if (target.isCelebrating) {
        setLiveCelebrating(true);
        const now = Date.now();
        if (liveFinaleStartRef.ts === 0) {
          liveFinaleStartRef.ts = now;
        }
        // Grand finale for the first 60 seconds of the new year
        setLiveGrandFinale(now - liveFinaleStartRef.ts < 60_000);
      } else {
        setLiveCelebrating(false);
        setLiveGrandFinale(false);
        liveFinaleStartRef.ts = 0;
      }
    };
    checkLive();
    const liveInterval = setInterval(checkLive, 1000);

    return () => {
      cleanupAutoPlay();
      clearInterval(liveInterval);
    };
  }, []);

  const handleToggleSound = () => {
    const active = toggleSound();
    setSoundEnabled(active);
  };

  // Preview Midnight: 6-second rapid countdown → celebration → 15s grand finale → auto-reset
  const handleToggleCelebration = () => {
    // Reset if already running
    if (previewPhase !== "idle") {
      if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      previewIntervalRef.current = null;
      previewTimeoutRef.current = null;
      setPreviewPhase("idle");
      setSimulationSeconds(null);
      setGrandFinaleActive(false);
      return;
    }

    // Start 6-second countdown phase
    let count = 6;
    setPreviewPhase("countdown");
    setSimulationSeconds(count);

    previewIntervalRef.current = setInterval(() => {
      count -= 1;
      setSimulationSeconds(count);

      if (count <= 0) {
        // Stop countdown interval
        if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);
        previewIntervalRef.current = null;

        // Enter celebration / grand finale
        setSimulationSeconds(0);
        setPreviewPhase("celebration");
        setGrandFinaleActive(true);

        // Auto-reset after 15 seconds of grand finale
        previewTimeoutRef.current = setTimeout(() => {
          setPreviewPhase("idle");
          setSimulationSeconds(null);
          setGrandFinaleActive(false);
          previewTimeoutRef.current = null;
        }, 15_000);
      }
    }, 1000);
  };

  // Derived flags passed to children
  const isCelebrating = liveCelebrating || previewPhase === "celebration";
  const isCountingDown = previewPhase === "countdown";
  const isGrandFinale = grandFinaleActive || liveGrandFinale;

  return (
    <main className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden bg-[#05060f] text-slate-100 select-none">
      {/* Background Starry Sky & Atmospheric Effects */}
      <StarryBackground />

      {/* Interactive Fireworks Canvas */}
      <FireworksCanvas
        isCelebrating={isCelebrating}
        isGrandFinale={isGrandFinale}
      />

      {/* Interactive Floating Sky Lanterns Layer */}
      <SkyLanternLayer
        isReleaseOpen={isReleaseOpen}
        onCloseRelease={() => setIsReleaseOpen(false)}
        isCelebrating={isCelebrating}
      />

      {/* Top Header / Navbar */}
      <Navbar
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenReleaseModal={() => setIsReleaseOpen(true)}
        onOpenVaultModal={() => setIsVaultOpen(true)}
      />

      {/* Central Large Countdown Display */}
      <StaticCountdown
        isCelebrating={isCelebrating}
        simulationSeconds={isCountingDown || previewPhase === "celebration" ? simulationSeconds : null}
      />

      {/* Bottom Interactive Action Dock */}
      <ActionDock
        isCelebrating={previewPhase === "celebration"}
        isCountingDown={isCountingDown}
        onToggleCelebration={handleToggleCelebration}
        onOpenReleaseModal={() => setIsReleaseOpen(true)}
        onOpenVaultModal={() => setIsVaultOpen(true)}
      />

      {/* Memory Vault Modal */}
      <MemoryVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
      />
    </main>
  );
}
