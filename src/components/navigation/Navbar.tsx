import { Sparkles, Volume2, VolumeX, Flame, Compass } from "lucide-react";

interface NavbarProps {
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onOpenReleaseModal?: () => void;
  onOpenVaultModal?: () => void;
}

export default function Navbar({
  soundEnabled = false,
  onToggleSound,
  onOpenReleaseModal,
  onOpenVaultModal,
}: NavbarProps) {
  return (
    <header className="relative z-20 w-full px-4 py-3.5 sm:px-6 sm:py-5 max-w-7xl mx-auto flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl glass-card flex items-center justify-center text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
        </div>
        <div>
          <span className="text-lg sm:text-xl font-bold tracking-wider sm:tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-cyan-200">
            HFTS HORIZON
          </span>
          <span className="hidden sm:inline-block ml-3 px-2 py-0.5 text-[10px] tracking-widest uppercase rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Evergreen 2027
          </span>
        </div>
      </div>

      {/* Navigation Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button 
          type="button" 
          onClick={onOpenReleaseModal}
          className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-lg glass-card text-xs font-medium text-slate-300 hover:text-white hover:border-amber-500/40 transition-colors cursor-pointer"
        >
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span>Sky Lanterns</span>
        </button>

        <button 
          type="button" 
          onClick={onOpenVaultModal}
          className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-lg glass-card text-xs font-medium text-slate-300 hover:text-white hover:border-cyan-500/40 transition-colors cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>Memory Vault</span>
        </button>

        {/* Sound Toggle Button */}
        <button 
          type="button"
          onClick={onToggleSound}
          aria-label={soundEnabled ? "Mute audio effects" : "Enable audio effects"}
          title={soundEnabled ? "Sound enabled (Click to mute)" : "Sound muted (Click to enable)"}
          className={`p-2 sm:p-2.5 rounded-xl glass-card transition-all cursor-pointer ${
            soundEnabled
              ? "border-amber-400/60 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] bg-amber-500/10"
              : "border-white/10 text-slate-400 hover:text-white"
          }`}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 animate-pulse" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
}
