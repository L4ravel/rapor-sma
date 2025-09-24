"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { collection, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

export default function UploadPage() {
  const [data, setData] = useState([]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const workbook = XLSX.read(bstr, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const parsed = XLSX.utils.sheet_to_json(sheet);
      setData(parsed);
    };
    reader.readAsBinaryString(file);
  };

  const saveToFirestore = async () => {
    if (!data.length) return alert("❌ Tidak ada data yang diupload");

    try {
      for (let row of data) {
        if (!row.nisn) continue; // skip jika nisn kosong

        // gunakan NISN sebagai ID dokumen (unik per siswa per semester)
        const ref = doc(collection(db, "raport"), String(row.nisn));

        await setDoc(ref, {
          ...row,
          nisn: String(row.nisn), // pastikan NISN string
        });
      }
      alert("✅ Data berhasil disimpan / diperbarui ke Firestore!");
      setData([]);
    } catch (err) {
      console.error(err);
      alert("⚠️ Gagal menyimpan data");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          📤 Upload Data Raport
        </h1>

        {/* Upload Section */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="flex-1 border border-gray-300 px-3 py-2 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={saveToFirestore}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-200"
          >
            Simpan ke Firebase
          </button>
        </div>

        {/* Preview Data */}
        {data.length > 0 && (
          <div className="overflow-x-auto">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Preview Data (5 baris pertama)
            </h2>
            <table className="w-full border border-gray-300 text-sm">
              <thead className="bg-gray-200 text-gray-800">
                <tr>
                  {Object.keys(data[0]).map((key) => (
                    <th key={key} className="p-2 border text-left">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 5).map((row, i) => (
                  <tr
                    key={i}
                    className={`${
                      i % 2 === 0 ? "bg-gray-50" : "bg-white"
                    } hover:bg-gray-100`}
                  >
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="p-2 border text-gray-800">
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-sm text-gray-500 mt-2">
              Menampilkan maksimal 5 baris data untuk preview.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
