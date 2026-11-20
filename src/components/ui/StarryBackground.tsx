export default function StarryBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Deep midnight ambient gradient layers */}
      <div 
        className="absolute inset-0" 
        style={{
          background: "radial-gradient(ellipse at 50% 0%, #151a3a 0%, #080a18 50%, #03040a 100%)"
        }} 
      />

      {/* Subtle nebula glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-900/15 blur-3xl" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 rounded-full bg-cyan-900/15 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 w-[600px] h-64 rounded-full bg-amber-900/10 blur-3xl" />

      {/* Glowing Celestial Moon with Atmospheric Halo */}
      <div className="absolute top-[6%] sm:top-[8%] right-[8%] sm:right-[14%] z-1">
        {/* Deep outer moonlight radiance */}
        <div className="absolute -inset-16 sm:-inset-24 rounded-full bg-amber-100/10 blur-3xl pointer-events-none" />
        <div className="absolute -inset-8 sm:-inset-12 rounded-full bg-amber-200/15 blur-2xl pointer-events-none" />

        {/* Moon Disc */}
        <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-full shadow-[0_0_35px_rgba(254,243,199,0.5),0_0_80px_rgba(254,243,199,0.25),0_0_140px_rgba(254,243,199,0.12)] overflow-hidden border border-amber-100/30">
          {/* Base Lunar Surface Gradient */}
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle at 35% 35%, #fffdf7 0%, #fef3c7 38%, #e2e8f0 72%, #cbd5e1 100%)"
            }}
          />

          {/* Maria & Crater Textures */}
          <div className="absolute top-[22%] left-[45%] w-7 h-5 rounded-full bg-slate-400/20 blur-[1px]" />
          <div className="absolute top-[48%] left-[28%] w-9 h-7 rounded-full bg-slate-400/25 blur-[1.5px]" />
          <div className="absolute top-[38%] left-[60%] w-6 h-6 rounded-full bg-slate-400/20 blur-[1px]" />
          <div className="absolute bottom-[20%] left-[42%] w-8 h-4 rounded-full bg-slate-400/15 blur-[1px]" />
          <div className="absolute top-[15%] left-[25%] w-3 h-3 rounded-full bg-slate-400/30 blur-[0.5px]" />
          
          {/* Limb Darkening / Spherical Shadow */}
          <div 
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle at 35% 35%, transparent 55%, rgba(15, 23, 42, 0.45) 100%)"
            }}
          />
        </div>

        {/* Wispy Atmospheric Clouds drifting across the moon */}
        <div className="absolute -bottom-2 -left-10 w-44 sm:w-56 h-6 rounded-full bg-gradient-to-r from-transparent via-slate-300/20 to-transparent blur-sm pointer-events-none" />
        <div className="absolute top-4 -right-8 w-36 sm:w-48 h-4 rounded-full bg-gradient-to-r from-transparent via-slate-200/15 to-transparent blur-sm pointer-events-none" />
        <div className="absolute -top-3 left-2 w-32 sm:w-40 h-3 rounded-full bg-gradient-to-r from-transparent via-slate-100/10 to-transparent blur-sm pointer-events-none" />
      </div>

      {/* Decorative stars */}
      <div className="absolute inset-0 opacity-60">
        <span className="absolute top-[8%] left-[12%] w-1 h-1 bg-white rounded-full animate-ping [animation-duration:4s]" />
        <span className="absolute top-[15%] left-[45%] w-1.5 h-1.5 bg-amber-200 rounded-full shadow-[0_0_8px_#fde68a]" />
        <span className="absolute top-[22%] left-[40%] w-1 h-1 bg-cyan-200 rounded-full" />
        <span className="absolute top-[35%] left-[70%] w-1 h-1 bg-white rounded-full opacity-80" />
        <span className="absolute top-[48%] left-[18%] w-1.5 h-1.5 bg-cyan-300 rounded-full shadow-[0_0_6px_#67e8f9]" />
        <span className="absolute top-[60%] left-[88%] w-1 h-1 bg-white rounded-full" />
        <span className="absolute top-[72%] left-[30%] w-1.5 h-1.5 bg-amber-100 rounded-full shadow-[0_0_8px_#fef3c7]" />
        <span className="absolute top-[80%] left-[62%] w-1 h-1 bg-cyan-100 rounded-full" />
        <span className="absolute top-[90%] left-[15%] w-1 h-1 bg-white rounded-full opacity-70" />
        <span className="absolute top-[18%] left-[60%] w-0.5 h-0.5 bg-white rounded-full" />
        <span className="absolute top-[28%] left-[25%] w-0.5 h-0.5 bg-white rounded-full" />
        <span className="absolute top-[42%] left-[92%] w-0.5 h-0.5 bg-white rounded-full" />
        <span className="absolute top-[55%] left-[5%] w-0.5 h-0.5 bg-white rounded-full" />
        <span className="absolute top-[68%] left-[45%] w-0.5 h-0.5 bg-white rounded-full" />
        <span className="absolute top-[85%] left-[78%] w-0.5 h-0.5 bg-white rounded-full" />
      </div>

      {/* Horizon atmospheric vignette */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#020308] via-transparent to-transparent opacity-90" />
    </div>
  );
}
