"use client";

import { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useRouter } from "next/navigation";

export default function SiswaPage() {
  const [nisn, setNisn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!nisn) return;

    setLoading(true);
    setError("");

    try {
      const q = query(collection(db, "raport"), where("nisn", "==", nisn));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError("❌ Data tidak ditemukan. Pastikan NISN benar.");
      } else {
        router.push(`/rapor-siswa/${nisn}`); // 🔹 alihkan ke halaman baru
      }
    } catch (err) {
      console.error(err);
      setError("⚠️ Terjadi kesalahan saat mencari data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center px-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          👨‍🎓 Cek Rapor Siswa
        </h1>

        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Masukkan NISN Anda"
            value={nisn}
            onChange={(e) => setNisn(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-gray-800"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200"
          >
            {loading ? "Mencari..." : "Cari Rapor"}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-center text-red-600 font-medium">{error}</p>
        )}
      </div>
    </div>
  );
}
