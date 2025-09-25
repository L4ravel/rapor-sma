"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseConfig"; 
// Daftar route publik (tidak perlu login)
const PUBLIC_ROUTES: (string | RegExp)[] = [
  "/login",
  "/rapor-siswa",
  "/siswa",
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /^\/api\//,
];

function isPublic(pathname: string) {
  return PUBLIC_ROUTES.some((p) =>
    typeof p === "string" ? pathname === p || pathname.startsWith(p + "/") : p.test(pathname)
  );
}

export default function AuthGateClient() {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Jika route publik → tidak perlu gate
    if (isPublic(pathname)) {
      setReady(true);
      return;
    }

    // Hanya jalan di browser
    if (typeof window === "undefined") return;

    // Jika pakai sesi lokal (flow username), izinkan
    const local = localStorage.getItem("appUser");
    if (local) {
      setReady(true);
      if (pathname === "/login") router.replace("/");
      return;
    }

    // Pastikan Firebase client siap
    if (!auth) {
      // Biasanya terjadi bila di-evaluate di server/SSR
      // atau modul inisialisasi belum terpanggil di client.
      // Kita izinkan render dulu agar halaman client sempat inisialisasi.
      setReady(true);
      return;
    }

    // Dengarkan Firebase Auth (flow email/password)
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setReady(true);
        if (pathname === "/login") router.replace("/");
      } else {
        // Belum login dan route bukan publik → paksa ke /login
        if (!isPublic(pathname)) router.replace("/login");
      }
    });

    return () => unsub();
  }, [pathname, router]);

  // Gate tidak merender UI
  if (!ready) return null;
  return null;
}
