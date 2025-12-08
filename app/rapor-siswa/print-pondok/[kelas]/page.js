"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

export default function PrintPondokKelas() {
  const { kelas } = useParams();
  const [siswa, setSiswa] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sSnap = await getDocs(collection(db, "siswa"));
      const all = sSnap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
      const list = all.filter(s => s.kelas === kelas);
      setSiswa(list);
      setLoading(false);
    })();
  }, [kelas]);

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          .page { break-inside: avoid; page-break-after: always; }
          iframe { border: 0; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 p-3 flex items-center gap-3">
        <div className="font-semibold">Print Rapor Pondok — Kelas {kelas}</div>
        <div className="ml-auto text-sm text-slate-500">
          Total siswa: {loading ? "…" : siswa.length}
        </div>
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700"
        >
          Print → PDF
        </button>
      </div>

      {loading ? (
        <div className="p-6">⏳ Memuat siswa…</div>
      ) : siswa.length === 0 ? (
        <div className="p-6">Tidak ada siswa untuk kelas ini.</div>
      ) : (
        <div className="mx-auto max-w-[210mm]">
          {siswa.map((s, i) => (
            <div key={s.nisn || s.id || i} className="page my-4">
              <iframe
                title={`rapor-pondok-${s.nisn}`}
                src={`/rapor-siswa/${encodeURIComponent(s.nisn)}/cetak-pondok?embed=1`}
                className="w-[210mm] h-[297mm] bg-white"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
