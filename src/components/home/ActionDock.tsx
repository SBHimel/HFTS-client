import { Flame, Compass, Sparkles, RotateCcw } from "lucide-react";

interface ActionDockProps {
  isCelebrating?: boolean;
  isCountingDown?: boolean;
  onToggleCelebration?: () => void;
  onOpenReleaseModal?: () => void;
  onOpenVaultModal?: () => void;
}

export default function ActionDock({
  isCelebrating = false,
  isCountingDown = false,
  onToggleCelebration,
  onOpenReleaseModal,
  onOpenVaultModal,
}: ActionDockProps) {
  return (
    <footer className="relative z-20 w-full px-3 sm:px-4 pb-4 sm:pb-6 pt-1 sm:pt-2 max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
      {/* Primary CTA: Release Lantern */}
      <button
        type="button"
        onClick={onOpenReleaseModal}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 font-bold text-sm tracking-wide shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:shadow-[0_0_35px_rgba(245,158,11,0.6)] transition-all hover:scale-105 active:scale-95 cursor-pointer"
      >
        <Flame className="w-4 h-4 fill-slate-950" />
        <span>Release a Lantern</span>
      </button>

      {/* Secondary CTAs */}
      <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
        <button
          type="button"
          onClick={onOpenVaultModal}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl glass-card text-xs font-semibold text-slate-200 hover:text-white hover:border-cyan-400/40 transition-all cursor-pointer"
        >
          <Compass className="w-4 h-4 text-cyan-400" />
          <span>Memories Vault</span>
        </button>

        <button
          type="button"
          onClick={onToggleCelebration}
          disabled={isCountingDown}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl glass-card text-xs font-semibold transition-all cursor-pointer ${
            isCelebrating
              ? "border-amber-400 text-amber-200 glow-box-gold shadow-[0_0_20px_rgba(245,158,11,0.3)] bg-amber-500/10"
              : isCountingDown
              ? "border-amber-500/50 text-amber-300 animate-pulse"
              : "text-slate-200 hover:text-white hover:border-amber-400/40"
          }`}
        >
          {isCelebrating ? (
            <>
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Reset Live</span>
            </>
          ) : isCountingDown ? (
            <>
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
              <span>Transitioning...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Preview Midnight</span>
            </>
          )}
        </button>
      </div>
    </footer>
  );
}
