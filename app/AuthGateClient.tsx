"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";

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
    // Jika route publik → tidak perlu apa-apa
    if (isPublic(pathname)) {
      setReady(true);
      return;
    }

    const auth = getAuth();

    const local = typeof window !== "undefined" ? localStorage.getItem("appUser") : null;
    if (local) {
      // Sudah punya sesi lokal (username login)
      setReady(true);
      // Jika nyasar ke /login saat sudah login, lempar ke /
      if (pathname === "/login") router.replace("/");
      return;
    }

    // Dengarkan Firebase Auth (admin login)
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

  // Tidak perlu render apa pun; ini hanya gate redirect global
  if (!ready) return null;
  return null;
}
