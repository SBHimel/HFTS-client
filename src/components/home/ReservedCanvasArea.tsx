export default function ReservedCanvasArea() {
  return (
    <div className="absolute inset-0 pointer-events-none z-5 overflow-hidden">
      {/* Reserved fireworks and sky lantern canvas placeholder backdrop */}
      <div className="absolute inset-0 flex items-center justify-center opacity-40">
        <div className="w-[800px] h-[800px] rounded-full bg-gradient-to-tr from-amber-500/5 via-cyan-500/5 to-purple-500/5 blur-3xl animate-pulse [animation-duration:8s]" />
      </div>

      {/* Floating lantern ambient placeholders */}
      <div className="absolute bottom-[28%] left-[10%] w-7 h-10 rounded-t-lg rounded-b-md bg-gradient-to-t from-amber-500/70 to-amber-300/40 shadow-[0_0_20px_#f59e0b] opacity-75 blur-[0.5px]" />
      <div className="absolute bottom-[45%] left-[22%] w-5 h-7 rounded-t-lg rounded-b-md bg-gradient-to-t from-orange-500/60 to-amber-300/30 shadow-[0_0_15px_#f97316] opacity-60 blur-[0.5px]" />
      <div className="absolute bottom-[35%] right-[14%] w-6 h-9 rounded-t-lg rounded-b-md bg-gradient-to-t from-amber-500/70 to-yellow-200/40 shadow-[0_0_20px_#f59e0b] opacity-70 blur-[0.5px]" />
      <div className="absolute bottom-[58%] right-[25%] w-4 h-6 rounded-t-lg rounded-b-md bg-gradient-to-t from-purple-500/60 to-pink-300/30 shadow-[0_0_15px_#a855f7] opacity-50 blur-[0.5px]" />
      <div className="absolute top-[20%] right-[32%] w-3 h-5 rounded-t-lg rounded-b-md bg-gradient-to-t from-cyan-500/50 to-blue-300/30 shadow-[0_0_12px_#06b6d4] opacity-45 blur-[0.5px]" />
    </div>
  );
}
