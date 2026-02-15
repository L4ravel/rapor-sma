"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

export default function RaporPage() {
  const [nilai, setNilai] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "raport"));
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNilai(data);
      } catch (error) {
        console.error("Gagal mengambil data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <p className="p-8 text-gray-600">⏳ Memuat data...</p>;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          📊 Data Raport Siswa
        </h1>
        <p className="text-gray-600">
          Daftar nilai siswa berdasarkan data yang telah diupload.
        </p>
      </div>

      {/* Tabel */}
      <div className="max-w-6xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-indigo-600 text-white text-xs uppercase">
            <tr>
              <th className="px-4 py-3">NISN</th>
              <th className="px-4 py-3">Nama Siswa</th>
              <th className="px-4 py-3">Kelas</th>
              <th className="px-4 py-3">Semester</th>
              <th className="px-4 py-3">Tahun</th>
              <th className="px-4 py-3">Mata Pelajaran</th>
              <th className="px-4 py-3">Nilai</th>
              <th className="px-4 py-3">Predikat</th>
              <th className="px-4 py-3">Keterangan</th>
              <th className="px-4 py-3">Sakit</th>
              <th className="px-4 py-3">Izin</th>
              <th className="px-4 py-3">Alpha</th>
            </tr>
          </thead>
          <tbody>
            {nilai.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b ${
                  i % 2 === 0 ? "bg-gray-50" : "bg-white"
                } hover:bg-indigo-50`}
              >
                <td className="px-4 py-3 text-gray-800">{row.nisn}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {row.nama_siswa}
                </td>
                <td className="px-4 py-3 text-gray-800">{row.kelas}</td>
                <td className="px-4 py-3 text-gray-800">{row.semester}</td>
                <td className="px-4 py-3 text-gray-800">
                  {row.tahun_pelajaran}
                </td>
                <td className="px-4 py-3 text-gray-800">
                  {row.mata_pelajaran}
                </td>
                <td className="px-4 py-3 font-semibold text-gray-900">
                  {row.nilai}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      row.predikat === "A"
                        ? "bg-green-100 text-green-700"
                        : row.predikat === "B"
                        ? "bg-blue-100 text-blue-700"
                        : row.predikat === "C"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {row.predikat}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      row.keterangan === "Lulus"
                        ? "bg-green-200 text-green-800"
                        : "bg-red-200 text-red-800"
                    }`}
                  >
                    {row.keterangan}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-800">{row.sakit}</td>
                <td className="px-4 py-3 text-gray-800">{row.izin}</td>
                <td className="px-4 py-3 text-gray-800">{row.alpha}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
