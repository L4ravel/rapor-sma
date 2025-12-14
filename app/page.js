"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

function Icon({ name, className }) {
  const d = {
    shield:
      "M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4zm-1 12l5-5-1.4-1.4L11 10.2 9.4 8.6 8 10l3 4z",
    chart:
      "M4 20h16v-2H4v2zm2-4h3V8H6v8zm5 0h3V4h-3v12zm5 0h2V12h-2v4z",
    cap: "M12 3l9 4-9 4-9-4 9-4zm0 6l6 2.667V15l-6 3-6-3v-3.333L12 9z",
    upload:
      "M12 3l4 4h-3v6h-2V7H8l4-4zm-7 12h14v6H5v-6zm2 2v2h10v-2H7z",
    pencil:
      "M3 17.25V21h3.75l11-11-3.75-3.75-11 11zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z",
    userPlus:
      "M15 14c2.76 0 5 2.24 5 5v1H10v-1c0-2.76 2.24-5 5-5zm-7-2a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm13-6h-2V4h-2v2h-2v2h2v2h2V8h2V6z",
    book: "M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V7a3 3 0 0 1 3-3zm0 15a5 5 0 0 1 3-1h9V7a1 1 0 0 0-1-1H8a5 5 0 0 0-3 1v12z",
    calendar:
      "M7 2h2v2h6V2h2v2h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2V2zm12 6H5v10h14V8z",
    school:
      "M12 2L2 7v2h2v9h6v-6h4v6h6V9h2V7l-10-5z",
    users:
      "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V20h14v-3.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V20h6v-3.5c0-2.33-4.67-3.5-7-3.5z",
    logout:
      "M10 17l1.41 1.41L16.83 13H3v-2h13.83l-5.42-5.41L10 7l6 6-6 6z",
    chevronDown:
      "M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z",
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
      className="group relative flex items-center gap-3 rounded-xl px-4 py-3.5 bg-white text-slate-900 ring-1 ring-slate-200 hover:ring-blue-300 shadow-md shadow-slate-900/5 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-1"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-50/0 via-blue-50/50 to-blue-50/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl" />
      <span className="relative grid place-items-center rounded-lg p-2.5 bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-200/50 group-hover:ring-blue-200 group-hover:from-blue-50 group-hover:to-white transition-all duration-300 shadow-sm">
        <Icon
          name={icon}
          className="h-5 w-5 text-slate-700 group-hover:text-blue-600 transition-colors duration-300"
        />
      </span>
      <span className="relative font-semibold tracking-wide text-sm group-hover:text-slate-900">
        {label}
      </span>
    </Link>
  );
}

// SUSUNAN KATEGORI
const CATEGORIES = [
  {
    id: "admin",
    label: "Admin",
    description: "Pengelolaan data utama sekolah.",
    actions: [
      { href: "/bio-sekolah", label: "Bio Sekolah", icon: "school" },
      { href: "/input-siswa", label: "Input Siswa", icon: "userPlus" },
      { href: "/input-mapel", label: "Input Mapel", icon: "book" },
      { href: "/input-wali", label: "Input Wali", icon: "users" },
    ],
  },
  {
    id: "wali",
    label: "Wali Kelas",
    description: "Menu harian wali kelas.",
    actions: [
      { href: "/absensi-siswa", label: "Absensi Siswa", icon: "calendar" },
      { href: "/input-tahfidz", label: "Input Nilai Tahfidz", icon: "book" },
      { href: "/siswa", label: "Lihat Rapor", icon: "cap" },
      { href: "/preview-nilai", label: "Cetak Rapor", icon: "chart" },
    ],
  },
  {
    id: "guru",
    label: "Guru",
    description: "Pengisian nilai rapor.",
    actions: [
      { href: "/input-nilai/pondok", label: "Input Nilai Pondok", icon: "pencil" },
      { href: "/input-tahfidz", label: "Input Nilai Tahfidz", icon: "book" },
      { href: "/input-nilai/umum", label: "Input Nilai Umum", icon: "pencil" },
    ],
  },
];

// ✅ mapping email -> kategori yang diizinkan
function getAllowedCategoryIdsByEmail(emailRaw) {
  const email = (emailRaw || "").toLowerCase().trim();

  // ===== ADMIN =====
  if (email === "admin@smpia.com" || email === "admin@smaia.com" || email === "usmanirawan00@gmail.com") {
    // admin boleh semua
    return ["admin", "wali", "guru"];
  }

  // ===== WALI KELAS =====
  if (email === "walikelas@smpia.com" || email === "walikelas@smaia.com") {
    // wali kelas boleh wali + guru
    return ["wali", "guru"];
  }

  // ===== GURU =====
  if (email === "guru@smpia.com" || email === "guru@smaia.com") {
    // guru hanya kategori guru
    return ["guru"];
  }

  // email lain: tidak ada kategori (bisa kamu ubah kalau mau)
  return [];
}

export default function Home() {
  const router = useRouter();
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [openCategory, setOpenCategory] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const local =
      typeof window !== "undefined"
        ? localStorage.getItem("appUser")
        : null;

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
        const r = d?.role || null;
        setRole(r);
      } catch {
        setRole(null);
      }
      setInitializing(false);
    });
    return () => unsub();
  }, [router]);

  if (initializing) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-blue-50 via-white to-slate-100 px-4">
        <div className="text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl shadow-slate-900/10">
            <div className="h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <span className="text-slate-700 text-sm font-medium">
              Memeriksa sesi...
            </span>
          </div>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("appUser");
      }
      await signOut(getAuth());
    } finally {
      router.replace("/login");
    }
  };

  const toggleCategory = (id) => {
    setOpenCategory((prev) => (prev === id ? null : id));
  };

  // 🔐 Filter kategori berdasarkan email user
  const userEmail = user?.email || "";
  const allowedCategoryIds = getAllowedCategoryIdsByEmail(userEmail);
  const visibleCategories = CATEGORIES.filter((cat) =>
    allowedCategoryIds.includes(cat.id)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-100 px-4 py-8">
      <div className="relative w-full max-w-3xl mx-auto">
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-blue-400/20 via-slate-400/10 to-purple-400/20 blur-3xl" />

        <div className="relative rounded-[32px] bg-white ring-1 ring-slate-300/50 shadow-2xl shadow-slate-900/10 p-6 sm:p-8 md:p-10">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 pb-6 border-b border-slate-100">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-50 to-slate-50 ring-1 ring-blue-100 mb-3">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[11px] font-medium text-slate-600">
                  Dashboard Aktif
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent">
                Menu Utama
              </h2>
              <p className="mt-2.5 text-slate-600 text-xs sm:text-sm leading-relaxed max-w-lg">
                Pilih kategori sesuai peran Anda. Klik kategori untuk
                menampilkan menu yang tersedia.
              </p>
              {user && (
                <div className="mt-3 flex items-center gap-2 text-[11px] sm:text-xs text-slate-500">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-100 to-slate-100 grid place-items-center ring-2 ring-white">
                    <span className="text-[10px] font-bold text-slate-600">
                      {(user.email || "U").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span>
                    <b className="text-slate-700">{user.email || "user"}</b>
                    {role && (
                      <span className="ml-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                        {role}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
            {user && (
              <button
                onClick={handleLogout}
                className="group inline-flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 ring-1 ring-slate-200/50 hover:ring-slate-300 text-xs sm:text-sm font-medium transition-all duration-300"
                title="Logout"
              >
                <Icon
                  name="logout"
                  className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-0.5"
                />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            )}
          </div>

          {/* Accordion kategori */}
          <div className="mt-6 space-y-4">
            {visibleCategories.length === 0 && (
              <div className="text-center text-xs sm:text-sm text-slate-500 py-6">
                Tidak ada menu yang dapat diakses untuk akun ini.
              </div>
            )}

            {visibleCategories.map((cat) => {
              const isOpen = openCategory === cat.id;
              return (
                <div
                  key={cat.id}
                  className="group rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5 hover:shadow-xl hover:shadow-slate-900/10 transition-all duration-300"
                >
                  {/* Header kategori */}
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-xl grid place-items-center transition-all duration-300 ${
                          isOpen
                            ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/40"
                            : "bg-gradient-to-br from-slate-100 to-slate-50 shadow-sm shadow-slate-900/5 group-hover:from-blue-50 group-hover:to-white group-hover:shadow-md group-hover:shadow-blue-500/20"
                        }`}
                      >
                        <Icon
                          name={cat.actions[0].icon}
                          className={`h-5 w-5 transition-colors duration-300 ${
                            isOpen
                              ? "text-white"
                              : "text-slate-600 group-hover:text-blue-600"
                          }`}
                        />
                      </div>
                      <div className="flex flex-col items-start text-left">
                        <span
                          className={`text-sm sm:text-base font-bold transition-colors duration-300 ${
                            isOpen
                              ? "text-slate-900"
                              : "text-slate-800 group-hover:text-slate-900"
                          }`}
                        >
                          {cat.label}
                        </span>
                        <span className="mt-0.5 text-[11px] sm:text-xs text-slate-500 group-hover:text-slate-600 transition-colors duration-300">
                          {cat.description}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`h-8 w-8 rounded-lg grid place-items-center transition-all duration-300 ${
                        isOpen
                          ? "bg-blue-50 ring-2 ring-blue-200 shadow-sm shadow-blue-500/20"
                          : "bg-slate-50 group-hover:bg-white ring-1 ring-slate-200 group-hover:ring-slate-300 shadow-sm shadow-slate-900/5"
                      }`}
                    >
                      <Icon
                        name="chevronDown"
                        className={`h-4 w-4 transition-all duration-300 ${
                          isOpen
                            ? "rotate-180 text-blue-600"
                            : "text-slate-500 group-hover:text-slate-700"
                        }`}
                      />
                    </div>
                  </button>

                  {/* Isi kategori */}
                  {isOpen && (
                    <div className="px-4 pb-4 sm:px-6 sm:pb-6 animate-in slide-in-from-top-2 duration-300 border-t border-slate-100">
                      <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {cat.actions.map((action, idx) => (
                          <div
                            key={action.href}
                            className="animate-in fade-in-0 slide-in-from-bottom-2"
                            style={{
                              animationDelay: `${idx * 50}ms`,
                              animationFillMode: "backwards",
                            }}
                          >
                            <ActionBtn
                              href={action.href}
                              label={action.label}
                              icon={action.icon}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
