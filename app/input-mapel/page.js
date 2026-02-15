"use client";

import Link from "next/link";
import { BookOpen, BookCopy, Database } from "lucide-react";

export default function InputMapelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-200 via-purple-200 to-pink-200 p-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 text-center space-y-8 max-w-lg w-full">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center justify-center gap-2">
            📚 Pilih Jenis Mapel
          </h1>
          <div className="mt-2 h-1 w-24 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 mx-auto rounded-full" />
        </div>

        {/* Tombol */}
        <div className="flex flex-col gap-5">
          <Link
            href="/input-mapel/mapel"
            className="flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-lg shadow-lg hover:scale-105 hover:shadow-purple-400/50 transition-all duration-300 text-lg font-semibold"
          >
            <BookOpen className="w-5 h-5" />
            Pengaturan Mata Pelajaran
          </Link>          

          <Link
            href="/input-mapel/dataset"
            className="flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-6 py-3 rounded-lg shadow-lg hover:scale-105 hover:shadow-cyan-400/50 transition-all duration-300 text-lg font-semibold"
          >
            <Database className="w-5 h-5" />
            Dataset Mata Pelajaran
          </Link>
        </div>
      </div>
    </div>
  );
}
