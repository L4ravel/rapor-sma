"use client";

import { motion } from "framer-motion";
import { Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import Image from "next/image";

export default function ProfessionalVideoFrame() {
  const [mounted, setMounted] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-50 via-sky-50 to-blue-100 flex flex-col items-center justify-center p-6 overflow-hidden relative">
      
      {/* Background Decorative Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-blue-200/30 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-indigo-200/30 rounded-full blur-[120px] animate-pulse delay-1000" />
      </div>

      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center -mt-3"
      >
        
        {/* Logo Section */}
      <motion.div
  initial={{ opacity: 0, y: -24 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.3, duration: 0.6 }}
  className="mb-4 relative flex flex-col items-center"
>
  {/* ===== FRAME LOGO ===== */}
  <div className="relative flex items-center justify-center">
    {/* Outer Glow Frame */}
    <div className="absolute -inset-3 bg-gradient-to-br from-blue-400 via-cyan-300 to-indigo-400 rounded-2xl blur-2xl opacity-40 animate-pulse" />

    {/* Rotating Tech Ring */}
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
      className="absolute w-[108px] h-[108px] rounded-2xl border border-dashed border-blue-300/60"
    />

    {/* Logo Container */}
    <div className="relative w-[92px] h-[92px] rounded-2xl bg-white shadow-[0_12px_30px_rgba(0,0,0,0.15)] border border-slate-200 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-1 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100" />
      <Image
        src="/logo.jpeg"
        alt="Logo SMA Islam As Sunnah"
        width={72}
        height={72}
        className="relative z-10 object-contain"
      />
    </div>
  </div>

  {/* ===== TEKS TUTORIAL ===== */}
  <div className="mt-3 text-center">
   <p className="text-[11px] font-black tracking-widest uppercase
  bg-gradient-to-r from-white via-slate-300 to-white
  bg-[length:200%_100%]
  bg-clip-text text-transparent
  animate-[shimmer_2.5s_linear_infinite]
">
  Tutorial Akses Rapor Online
</p>

    <div className="mt-1 h-[2px] w-16 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full" />
  </div>
</motion.div>



        <div className="relative group">
          {/* Main Frame Glow */}
          <div className="absolute -inset-1.5 bg-gradient-to-b from-blue-200 to-indigo-200 rounded-[3rem] opacity-40 blur-2xl group-hover:opacity-60 transition duration-500"></div>

          {/* Smartphone Frame */}
          <motion.div
  whileHover={{ y: -5 }}
  className="relative w-[360px] h-[640px] bg-[#F8FAFC] border-[12px] border-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] rounded-[3rem] overflow-hidden"
>
            {/* Dynamic Island / Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-white z-40 rounded-b-2xl border-x border-b border-slate-100 flex items-center justify-center gap-2 px-4 shadow-sm">
                <div className="w-2 h-2 bg-slate-200 rounded-full"></div>
                <div className="w-10 h-1.5 bg-slate-100 rounded-full"></div>
            </div>

            {/* Video Content */}
            <div className="relative w-full h-full rounded-[2.2rem] overflow-hidden bg-slate-100">
              <video
                src="/smp.mp4"
                autoPlay
                muted={isMuted}
                loop
                playsInline
                className="w-full h-full object-cover scale-[1.01]"
              />
              
              {/* Refined Video Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

              {/* Mute Toggle Overlay */}
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="absolute bottom-6 right-6 p-3 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-white hover:bg-white/40 transition-all z-50"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            </div>

            {/* Home Bar */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1.5 bg-slate-200/50 rounded-full z-40 backdrop-blur-sm" />
          </motion.div>

          {/* Side Buttons Visual Only */}
          <div className="absolute -right-[14px] top-32 w-[3px] h-16 bg-white/80 rounded-r-lg shadow-sm" />
          <div className="absolute -left-[14px] top-24 w-[3px] h-10 bg-white/80 rounded-l-lg shadow-sm" />
          <div className="absolute -left-[14px] top-40 w-[3px] h-10 bg-white/80 rounded-l-lg shadow-sm" />
        </div>

        {/* Branding Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center mt-10 space-y-2"
        >
          <h2 className="text-slate-800 text-lg font-bold tracking-[0.2em] uppercase">
            SMA Islam As Sunnah
          </h2>
          <div className="flex items-center justify-center gap-2">
            <span className="h-[1px] w-8 bg-blue-300"></span>
            <p className="text-slate-500 text-[10px] font-medium tracking-[0.3em] uppercase">
              Bagik Nyaka • Indonesia
            </p>
            <span className="h-[1px] w-8 bg-blue-300"></span>
          </div>
        </motion.div>

        
      </motion.section>
      
    </main>
  );
}