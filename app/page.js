"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

function Icon({ name, className }) {
  const d = {
    shield:"M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4zm-1 12l5-5-1.4-1.4L11 10.2 9.4 8.6 8 10l3 4z",
    chart:"M4 20h16v-2H4v2zm2-4h3V8H6v8zm5 0h3V4h-3v12zm5 0h2V12h-2v4z",
    cap:"M12 3l9 4-9 4-9-4 9-4zm0 6l6 2.667V15l-6 3-6-3v-3.333L12 9z",
    upload:"M12 3l4 4h-3v6h-2V7H8l4-4zm-7 12h14v6H5v-6zm2 2v2h10v-2H7z",
    pencil:"M3 17.25V21h3.75l11-11-3.75-3.75-11 11zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z",
    userPlus:"M15 14c2.76 0 5 2.24 5 5v1H10v-1c0-2.76 2.24-5 5-5zm-7-2a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm13-6h-2V4h-2v2h-2v2h2v2h2V8h2V6z",
    book:"M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V7a3 3 0 0 1 3-3zm0 15a5 5 0 0 1 3-1h9V7a1 1 0 0 0-1-1H8a5 5 0 0 0-3 1v12z",
    calendar:"M7 2h2v2h6V2h2v2h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2V2zm12 6H5v10h14V8z",
    school:"M12 2L2 7v2h2v9h6v-6h4v6h6V9h2V7l-10-5z",
    users:"M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V20h14v-3.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V20h6v-3.5c0-2.33-4.67-3.5-7-3.5z",
    logout:"M10 17l1.41 1.41L16.83 13H3v-2h13.83l-5.42-5.41L10 7l6 6-6 6z",
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d={d[name]} />
    </svg>
  );
}

function ActionBtn({ href, label, icon }) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-3 rounded-xl px-4 py-3 bg-white text-slate-900 ring-1 ring-slate-200 hover:ring-slate-300 shadow transition-all duration-300 hover:-translate-y-0.5"
    >
      <span className="grid place-items-center rounded-lg p-2 bg-slate-50 ring-1 ring-slate-200">
        <Icon name={icon} className="h-5 w-5 text-slate-700" />
      </span>
      <span className="font-semibold tracking-wide">{label}</span>
    </Link>
  );
}

export default function Home() {
  const router = useRouter();
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const local = typeof window !== "undefined" ? localStorage.getItem("appUser") : null;
    if (local) {
      const u = JSON.parse(local);
      setUser({ email: u.email || u.username });
      setRole(u.role || null);
      setInitializing(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setInitializing(false);
        router.replace("/login");
        return;
      }
      setUser(u);
      try {
        const qy = query(
          collection(db, "users_app"),
          where("email", "==", u.email?.toLowerCase() || ""),
          limit(1)
        );
        const snap = await getDocs(qy);
        const d = snap.docs[0]?.data();
        setRole(d?.role || null);
      } catch {
        setRole(null);
      }
      setInitializing(false);
    });
    return () => unsub();
  }, [router]);

  if (initializing) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-sky-50 via-white to-slate-50 px-4">
        <div className="text-slate-600">Memeriksa sesi…</div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      localStorage.removeItem("appUser");
      await signOut(getAuth());
    } finally {
      router.replace("/login");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-sky-50 via-white to-slate-50 px-4">
      <div className="relative w-full max-w-5xl">
        <div className="absolute inset-0 rounded-[26px] bg-slate-900/5 blur-xl" />
        <div className="relative grid grid-cols-1 lg:grid-cols-2 rounded-[26px] bg-white ring-1 ring-slate-200 overflow-visible">
          {/* Kolom kiri */}
          <div className="relative z-20 p-8 md:p-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Menu Utama</h2>
                <p className="mt-2 text-slate-600">Akses fitur di bawah ini.</p>
                {user && (
                  <p className="mt-1 text-xs text-slate-500">
                    Login sebagai: <b>{user.email || "user"}</b> {role ? `(role: ${role})` : ""}
                  </p>
                )}
              </div>
              {user && (
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900"
                  title="Logout"
                >
                  <Icon name="logout" className="h-5 w-5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              )}
            </div>

            {/* Tombol Bio (tetap) */}
            <div className="mt-6 mb-4">
              <ActionBtn href="/bio-sekolah" label="Bio Sekolah" icon="school" />
            </div>

            {/* Grid tombol fitur */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ActionBtn href="/siswa" label="Lihat Rapor" icon="cap" />
              <ActionBtn href="/input-nilai" label="Input Nilai" icon="pencil" />
              <ActionBtn href="/absensi-siswa" label="Absensi Siswa" icon="calendar" />
              <ActionBtn href="/input-siswa" label="Input Siswa" icon="userPlus" />
              <ActionBtn href="/input-mapel" label="Input Mapel" icon="book" />
              <ActionBtn href="/input-wali" label="Input Wali" icon="users" />
            </div>

            {/* ── Tambahan: Tombol Preview Rapor (paling bawah, gaya sama dengan Bio) ── */}
            <div className="mt-6">
              <ActionBtn href="/preview-nilai" label="Preview Rapor" icon="chart" />
            </div>
          </div>

          {/* Kolom kanan */}
          <div className="relative isolate overflow-hidden rounded-tr-[26px] rounded-br-[26px]">
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-600 to-violet-600" />
            <div className="hidden md:block absolute -left-25 top-0 h-full w-32 rounded-r-[60px] bg-white -z-10 pointer-events-none" />
            <div className="relative z-10 h-full p-8 md:p-10 text-white flex flex-col items-center justify-center text-center">
              <h3 className="text-3xl font-extrabold">Sistem Rapor Digital</h3>
              <p className="mt-3 text-indigo-100 max-w-sm">
                &quot;Sistem rapor masih dalam tahap uji dan pengembangan. Semua data akan dihapus setelah selesai pembagian rapor tengah semester.&quot;
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/input-tahfidz"
                  className="rounded-full px-6 py-2 bg-white text-indigo-700 font-semibold hover:bg-indigo-50 transition"
                >
                  Input Nilai Tahfidz
                </Link>
                <Link
                  href="/input-nilai"
                  className="rounded-full px-6 py-2 bg-indigo-900/30 ring-1 ring-white/40 hover:bg-indigo-900/40 transition font-semibold"
                >
                  Input Nilai Rapor
                </Link>
              </div>
            </div>
          </div>
          {/* Akhir kolom kanan */}
        </div>
      </div>
    </div>
  );
}
