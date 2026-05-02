"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db, auth as authExported } from "@/lib/firebaseConfig";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";

/* util: sha256 (JS murni) */
async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* elemen dekor lembut */
function Deco({ className = "" }) {
  return (
    <div
      className={
        "absolute rounded-[2.5rem] bg-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.20)] " +
        "backdrop-blur-[1.5px] " +
        className
      }
    />
  );
}

export default function LoginPage() {
  const router = useRouter();
  const auth = useMemo(() => authExported || getAuth(), []);

  const [mode, setMode] = useState("nisn"); // "nisn" | "kelulusan" | "login"

  // login state
  const [idInput, setIdInput] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // NISN rapor state
  const [nisn, setNisn] = useState("");
  const [nisnErr, setNisnErr] = useState("");

  // NISN kelulusan state
  const [nisnKelulusan, setNisnKelulusan] = useState("");
  const [kelulusanErr, setKelulusanErr] = useState("");
  const [checkingKelulusan, setCheckingKelulusan] = useState(false);

  useEffect(() => {
    const s = localStorage.getItem("appUser");
    if (s) {
      router.replace("/");
      return;
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) router.replace("/");
    });

    return () => unsub();
  }, [router, auth]);

  const switchMode = (m) => {
    if (mode !== m) setMode(m);
  };

  const onSubmitNISN = async (e) => {
    e.preventDefault();
    setNisnErr("");

    const v = (nisn || "").trim();

    if (!/^\d{8,12}$/.test(v)) {
      setNisnErr("NISN harus angka 8—12 digit.");
      return;
    }

    router.push(`/rapor-siswa/${encodeURIComponent(v)}`);
  };

 const onSubmitKelulusan = async (e) => {
  e.preventDefault();
  setKelulusanErr("");

  const v = String(nisnKelulusan || "").replace(/[^\d]/g, "").trim();

  if (!/^\d{8,12}$/.test(v)) {
    setKelulusanErr("NISN harus angka 8—12 digit.");
    return;
  }

  try {
    setCheckingKelulusan(true);

    console.log("Cek NISN kelulusan:", v);

    const qy = query(
      collection(db, "kelulusan_siswa"),
      where("nisn", "==", v),
      limit(1)
    );

    const snap = await getDocs(qy);

    console.log("Jumlah data kelulusan ditemukan:", snap.size);
    console.log(
      "Data kelulusan:",
      snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    );

    if (snap.empty) {
      setKelulusanErr("NISN tidak ditemukan pada data kelulusan.");
      return;
    }

    const siswaDoc = snap.docs[0];
    const targetUrl = `/kelulusan/print/${siswaDoc.id}`;

    window.location.href = targetUrl;
  } catch (error) {
    console.error("Gagal cek kelulusan:", error);
    setKelulusanErr("Gagal mengecek data kelulusan. Cek Firestore Rules atau koneksi.");
  } finally {
    setCheckingKelulusan(false);
  }
};

  const onSubmitLogin = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const id = String(idInput || "").trim().toLowerCase();
      const pass = String(password || "");

      if (!id || !pass) throw new Error("Isi email/username dan password.");

      if (id.includes("@")) {
        try {
          await signInWithEmailAndPassword(auth, id, pass);
          router.replace("/");
          return;
        } catch {
          /* fallback: username */
        }
      }

      const qy = query(collection(db, "users_app"), where("username", "==", id), limit(1));
      const snap = await getDocs(qy);

      if (snap.empty) throw new Error("Akun tidak ditemukan.");

      const doc = snap.docs[0];
      const data = doc.data();

      if (data && data.isActive === false) throw new Error("Akun nonaktif.");

      const hash = await sha256(pass);
      if (!data || hash !== data.passwordHash) throw new Error("Password salah.");

      localStorage.setItem(
        "appUser",
        JSON.stringify({
          id: doc.id,
          username: data.username,
          role: data.role || "",
        })
      );

      router.replace("/");
    } catch (err) {
      setMsg(err?.message || "Gagal login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f3ff] px-4 py-10">
      {/* PANEL BACKGROUND besar — GRADIENT UNGU */}
      <div className="relative h-[620px] w-full max-w-6xl overflow-hidden rounded-[28px] shadow-2xl md:h-[540px]">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#5b2dff_0%,#6a2dff_35%,#7b2dff_70%,#8b35ff_100%)]" />
        <div className="absolute inset-0 bg-white/5 mix-blend-overlay" />
        <div className="absolute inset-0 bg-[radial-gradient(60rem_30rem_at_30%_20%,rgba(255,255,255,0.25),transparent)]" />

        <Deco className="-left-8 -top-8 h-28 w-36 rotate-[18deg]" />
        <Deco className="left-24 top-24 h-10 w-24 rounded-3xl" />
        <Deco className="right-12 top-10 h-24 w-40 rotate-12" />
        <Deco className="left-10 bottom-10 h-14 w-40 -rotate-12" />
        <Deco className="right-16 bottom-16 h-10 w-28 rotate-[25deg]" />
        <Deco className="left-1/2 top-24 h-48 w-48 -translate-x-1/2 rounded-full bg-white/15 shadow-[inset_0_0_60px_rgba(0,0,0,0.12)]" />

        {/* KARTU KACA di tengah */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div
            className="
              w-full max-w-md rounded-2xl
              border border-white/40 bg-white/25
              p-6 text-slate-900 shadow-[0_10px_50px_rgba(2,6,23,0.18)]
              backdrop-blur-xl md:p-7
            "
          >
            <div className="text-left">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Sistem Rapor Digital
              </h1>
              <p className="mt-1 text-sm text-slate-800/80 md:text-base">
                {mode === "nisn"
                  ? "Cek Rapor Siswa"
                  : mode === "kelulusan"
                    ? "Cek Informasi Kelulusan"
                    : "Login Guru/Admin"}
              </p>
            </div>

            {/* Toggle */}
            <div className="mt-5 grid w-full grid-cols-3 rounded-full bg-white/40 p-1">
              <button
                type="button"
                onClick={() => switchMode("nisn")}
                className={
                  "rounded-full px-3 py-2 text-xs font-semibold transition md:text-sm " +
                  (mode === "nisn"
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-900/70 hover:bg-white/30")
                }
              >
                Rapor
              </button>

              <button
                type="button"
                onClick={() => switchMode("kelulusan")}
                className={
                  "rounded-full px-3 py-2 text-xs font-semibold transition md:text-sm " +
                  (mode === "kelulusan"
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-900/70 hover:bg-white/30")
                }
              >
                Kelulusan
              </button>

              <button
                type="button"
                onClick={() => switchMode("login")}
                className={
                  "rounded-full px-3 py-2 text-xs font-semibold transition md:text-sm " +
                  (mode === "login"
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-900/70 hover:bg-white/30")
                }
              >
                Login
              </button>
            </div>

            <div className="mt-10 text-center text-sm font-semibold text-slate-900/80">
              {mode === "nisn"
                ? "NISN bisa dilihat di ijazah atau rapor siswa."
                : mode === "kelulusan"
                  ? "Masukkan NISN untuk melihat surat keterangan kelulusan."
                  : "Halaman Login adalah tempat guru/admin masuk."}
            </div>

            {/* FORM AREA */}
            <div className="mt-5 max-h-72 overflow-y-auto">
              {mode === "nisn" ? (
                <FormNISN
                  nisn={nisn}
                  setNisn={setNisn}
                  nisnErr={nisnErr}
                  onSubmit={onSubmitNISN}
                />
              ) : mode === "kelulusan" ? (
                <FormKelulusan
                  nisnKelulusan={nisnKelulusan}
                  setNisnKelulusan={setNisnKelulusan}
                  kelulusanErr={kelulusanErr}
                  checkingKelulusan={checkingKelulusan}
                  onSubmit={onSubmitKelulusan}
                />
              ) : (
                <FormLogin
                  idInput={idInput}
                  setIdInput={setIdInput}
                  password={password}
                  setPassword={setPassword}
                  msg={msg}
                  loading={loading}
                  onSubmit={onSubmitLogin}
                />
              )}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-white/30" />
      </div>
    </div>
  );
}

/* ——— SUB KOMPONEN ——— */

function FormNISN({ nisn, setNisn, nisnErr, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 text-slate-900">
      <label className="block">
        <span className="text-xs font-medium">NISN</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={12}
          className="mt-1 w-full rounded-lg border border-white/60 bg-white/80 px-3 py-2
                     placeholder-slate-500 outline-none transition
                     focus:border-violet-500 focus:ring-4 focus:ring-violet-200"
          placeholder="NISN (8—12 digit)"
          value={nisn}
          onChange={(e) => setNisn(e.target.value.replace(/[^\d]/g, ""))}
        />
      </label>

      {nisnErr && <div className="text-sm text-rose-600">{nisnErr}</div>}

      <button
        type="submit"
        className="w-full rounded-lg bg-violet-600/80 py-2 font-semibold text-white
                   transition hover:bg-violet-600 focus-visible:ring-4 focus-visible:ring-violet-200"
      >
        Lihat Rapor
      </button>
    </form>
  );
}

function FormKelulusan({
  nisnKelulusan,
  setNisnKelulusan,
  kelulusanErr,
  checkingKelulusan,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 text-slate-900">
      <label className="block">
        <span className="text-xs font-medium">NISN Kelulusan</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={12}
          className="mt-1 w-full rounded-lg border border-white/60 bg-white/80 px-3 py-2
                     placeholder-slate-500 outline-none transition
                     focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200"
          placeholder="Masukkan NISN siswa"
          value={nisnKelulusan}
          onChange={(e) => setNisnKelulusan(e.target.value.replace(/[^\d]/g, ""))}
        />
      </label>

      {kelulusanErr && <div className="text-sm text-rose-600">{kelulusanErr}</div>}

      <button
        type="submit"
        disabled={checkingKelulusan}
        className="w-full rounded-lg bg-emerald-600/85 py-2 font-semibold text-white
                   transition hover:bg-emerald-600 disabled:opacity-60
                   focus-visible:ring-4 focus-visible:ring-emerald-200"
      >
        {checkingKelulusan ? "Mengecek..." : "Lihat Kelulusan"}
      </button>
    </form>
  );
}

function FormLogin({
  idInput,
  setIdInput,
  password,
  setPassword,
  msg,
  loading,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 text-slate-900">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium">Email atau Username</span>
          <input
            className="mt-1 w-full rounded-lg border border-white/60 bg-white/80 px-3 py-2
                       placeholder-slate-500 outline-none transition
                       focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-200"
            placeholder="Email atau Username"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            autoComplete="username"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium">Password</span>
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-white/60 bg-white/80 px-3 py-2
                       placeholder-slate-500 outline-none transition
                       focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-200"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
      </div>

      {msg && <div className="text-sm text-rose-600">{msg}</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-violet-600/80 py-2 font-semibold text-white
                   transition hover:bg-fuchsia-600 disabled:opacity-60
                   focus-visible:ring-4 focus-visible:ring-fuchsia-200"
      >
        {loading ? "Memproses…" : "Masuk"}
      </button>
    </form>
  );
}