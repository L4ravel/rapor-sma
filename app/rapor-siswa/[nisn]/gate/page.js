"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

/* ================== Konfigurasi ================== */
const RELEASE_AT_ISO = "2025-12-20T08:00:00+08:00";
const TITLE = "Sistem Rapor Digital";

/* ================== Util waktu ================== */
const MS = { d: 86400000 }; // 1 hari = 86.400.000 ms

function diffParts(targetMs, nowMs) {
  const ms = Math.max(0, (targetMs || 0) - (nowMs || 0));
  const totalSec = Math.floor(ms / 1000) || 0;
  const days = Math.floor(totalSec / (24 * 3600));
  const hours = Math.floor((totalSec % (24 * 3600)) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return { ms, days, hours, mins, secs };
}

/* ================== Komponen UI ================== */
function CircularStat({ value, max, label }) {
  const r = 50;
  const C = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const offset = C * (1 - pct);
  const valText = Number.isFinite(value) ? String(value).padStart(2, "0") : "00";

  return (
    <div className="flex flex-col items-center">
      <div className="relative grid place-items-center">
        <div className="absolute inset-0 blur-xl rounded-full bg-indigo-500/25" />
        <svg width="140" height="140" viewBox="0 0 140 140" className="rotate-[-90deg]">
          <circle cx="70" cy="70" r={r} stroke="rgb(241 245 249)" strokeWidth="14" fill="none" />
          <circle
            cx="70"
            cy="70"
            r={r}
            stroke="url(#g1)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            fill="none"
            className="transition-all duration-500"
          />
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-26 w-26 rounded-2xl bg-white/75 backdrop-blur grid place-items-center ring-1 ring-white/50 shadow-lg">
            <span className="text-3xl font-extrabold text-slate-900">{valText}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 text-xs tracking-[0.2em] font-semibold text-slate-600 uppercase">{label}</div>
    </div>
  );
}

export default function GatePage() {
  const router = useRouter();
  const { nisn } = useParams();

  const target = useMemo(() => new Date(RELEASE_AT_ISO).getTime(), []);
  // INISIALISASI BENAR: simpan timestamp sekarang (number)
  const [now, setNow] = useState(() => Date.now());

  // recompute left setiap kali now berubah
  const left = useMemo(() => diffParts(target, now), [target, now]);

  // totalDaysAtMount: gunakan nilai tetap di mount (untuk progress hari)
  const totalDaysAtMount = useMemo(() => {
    const raw = Math.ceil(Math.max(0, (target - Date.now())) / MS.d);
    return Math.max(1, raw);
  }, [target]);

  // Timer: update every second *only while countdown active*
  useEffect(() => {
    if (now >= target) return; // sudah lewat -> tidak perlu interval
    const interval = setInterval(() => setNow(() => Date.now()), 1000);
    return () => clearInterval(interval);
  }, [now, target]);

  // Redirect effect: jalan sekali ketika waktu habis
  useEffect(() => {
    if (left.ms <= 0) {
      // pastikan hanya redirect sekali
      router.replace(`/rapor-siswa/${encodeURIComponent(nisn)}`);
    }
  // kita pantau left.ms dan nisn/router
  }, [left.ms, nisn, router]);

  const dateLocal = useMemo(() => {
    try {
      const d = new Date(RELEASE_AT_ISO);
      return new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Makassar",
      }).format(d) + " WITA";
    } catch {
      return RELEASE_AT_ISO;
    }
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.20),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.20),transparent_40%),linear-gradient(120deg,#f8fafc,#ffffff)]" />
      <div className="pointer-events-none absolute -top-20 -left-24 h-[32rem] w-[32rem] rounded-full bg-indigo-400/20 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-fuchsia-400/20 blur-3xl animate-float-slower" />

      <div className="relative z-10 min-h-screen grid place-items-center px-4 py-10">
        <div className="relative w-full max-w-5xl">
          <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 blur-2xl -z-10" />

          <div className="rounded-[32px] overflow-hidden ring-1 ring-slate-200/70 bg-white/70 backdrop-blur-xl shadow-2xl">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600" />

            <div className="p-6 sm:p-10">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-indigo-300/50 text-indigo-700 bg-indigo-50/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  Akses Rapor Terkunci
                </div>
                <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                  {TITLE}
                </h1>
                <p className="mt-1 text-sm text-slate-600">Jadwal rilis: {dateLocal}</p>
              </div>

              {now !== null && (
                <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6 place-items-center">
                  <CircularStat value={left.days} max={totalDaysAtMount} label="HARI" />
                  <CircularStat value={left.hours} max={24} label="JAM" />
                  <CircularStat value={left.mins} max={60} label="MENIT" />
                  <CircularStat value={left.secs} max={60} label="DETIK" />
                </div>
              )}

              <div className="mt-8 text-center text-sm text-slate-600">
                Halaman rapor akan terbuka otomatis ketika hitung mundur mencapai <b>00:00</b>.
                Jika tidak berpindah, gunakan tombol berikut.
              </div>

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => router.replace(`/rapor-siswa/${encodeURIComponent(nisn)}`)}
                  disabled={left.ms > 0}
                  className={`rounded-full px-6 py-2 font-semibold transition-all duration-200
                    ${left.ms > 0
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg hover:shadow-xl hover:brightness-110"}`}
                >
                  {left.ms > 0 ? "Menunggu rilis..." : "Buka Rapor Sekarang"}
                </button>
                <Link
                  href="/"
                  className="rounded-full px-6 py-2 ring-1 ring-slate-300 text-slate-700 hover:bg-white/60 backdrop-blur transition-all duration-200"
                >
                  Kembali ke Beranda
                </Link>
              </div>

              <div className="mt-8 text-center text-[11px] text-slate-400">
                Sistem Rapor Digital • SMAS Assunnah Bagek Nyaka
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float-slow {
          0% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(25px) translateX(15px); }
          100% { transform: translateY(0) translateX(0); }
        }
        @keyframes float-slower {
          0% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-20px) translateX(-15px); }
          100% { transform: translateY(0) translateX(0); }
        }
        .animate-float-slow { animation: float-slow 10s ease-in-out infinite; }
        .animate-float-slower { animation: float-slower 14s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
