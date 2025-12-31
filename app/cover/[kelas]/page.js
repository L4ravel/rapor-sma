"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import Image from "next/image";



export default function CoverKelasPage() {
  const { kelas } = useParams();
  const [siswa, setSiswa] = useState([]);
  const [kepalaSekolah, setKepalaSekolah] = useState("");
const [kepalaSekolahTtd, setKepalaSekolahTtd] = useState("");

function formatNamaKepsek(nama) {
  if (!nama) return "—";

  const parts = String(nama).trim().split(" ");
  if (parts.length === 1) return nama.toUpperCase();

  const gelar = parts.pop();              // ambil kata terakhir
  const namaUtama = parts.join(" ").toUpperCase();

  return `${namaUtama} ${gelar}`;
}

useEffect(() => {
  if (!kelas) return;

  (async () => {
    try {
      const snap = await getDoc(doc(db, "bio_sekolah", "default"));
      if (snap.exists()) {
        const data = snap.data() || {};
        setKepalaSekolah(data.kepala_sekolah || "");
        setKepalaSekolahTtd(
          data.kepala_sekolah_ttd || data.kepala_sekolah_foto || ""
        );
      }
    } catch (e) {
      console.error("Gagal ambil bio_sekolah:", e);
    }
  })();
}, [kelas]);


  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "siswa"));
      const all = snap.docs.map(d => d.data());
      setSiswa(all.filter(s => s.kelas === kelas));
    })();
  }, [kelas]);

  if (!siswa.length) {
    return <div className="p-10">Memuat cover kelas…</div>;
  }

  

  return (
    <>
    {/* ===== CSS KHUSUS PAGE COVER ===== */}
    <style jsx global>{`
      @page {
        size: A4;
        margin: 0;
      }

      body {
        margin: 0;
        background: white;
      }

      .page-break {
        page-break-after: always;
      }

      /* UI layar saja */
      .no-print {
        background: white;
      }

      /* Saat print */
      @media print {
        .no-print {
          display: none !important;
        }
      }
        .screen-preview {
  display: flex;
  flex-direction: column;
  align-items: center;      /* CENTER horizontal */
  gap: 24px;
  padding: 32px 0;
  background: #ffffffff;      /* abu muda biar kelihatan kertas */
}

/* Saat print: balikin normal */
@media print {
  .screen-preview {
    display: block;
    padding: 0;
    background: white;
  }
}
  /* ===== RESPONSIVE PREVIEW (LAYAR) ===== */
.page-a4 {
  width: 210mm;
  height: 297mm;
  background: white;
  transform-origin: top center;
}

/* Mobile scaling */
@media screen and (max-width: 768px) {
  .page-a4 {
    transform: scale(0.75);
  }
}

@media screen and (max-width: 480px) {
  .page-a4 {
    transform: scale(0.6);
  }
}

/* Print: full size */
@media print {
  .page-a4 {
    transform: none !important;
  }
}
    `}</style>

    {/* ===== UI PRINT (LAYAR SAJA) ===== */}
    <div className="no-print sticky top-0 z-50 bg-white border-b border-slate-300">
  <div className="max-w-[210mm] mx-auto py-3 flex items-center justify-center gap-4">
    <div className="font-semibold text-black">
      Cover Rapor — Kelas {kelas}
    </div>

    <button
      onClick={() => window.print()}
      className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition"
    >
      Print Semua
    </button>
  </div>
</div>

    {siswa.map((s, i) => (
  <div
    key={i}
    className="screen-preview"
  >
    {/* ================= HALAMAN 1 : COVER SISWA ================= */}
    <div className="page-a4 page-break flex flex-col items-center justify-between text-black"
  style={{
    padding: "25mm 20mm",
    fontFamily: "Times New Roman, serif",
  }}
>
      <div className="flex flex-col items-center gap-6">
        <Image src="/logo/tutyuri.png" alt="Tut Wuri Handayani" width={120} height={120} priority />
        <div className="text-center">
          <div className="text-xl font-bold">SEKOLAH MENENGAH ATAS</div>
          <div className="text-lg font-bold">( SMA )</div>
        </div>
        <Image src="/logo/sma.png" alt="Logo SMA" width={160} height={160} priority />
      </div>

      <div className="w-full flex flex-col items-center gap-4 mt-6">
        <div className="text-lg font-semibold">Nama Peserta Didik</div>
        <div className="w-[80%] border border-black py-2 text-center text-lg font-bold">
          {s.nama_siswa?.toUpperCase()}
        </div>

        <div className="text-lg font-semibold mt-4">NISN / NIS</div>
        <div className="w-[80%] border border-black py-2 text-center text-lg font-bold">
          {s.nisn} / {s.nis || "-"}
        </div>
      </div>

      <div className="text-center text-lg font-bold leading-relaxed">
        <div>KEMENTERIAN PENDIDIKAN, KEBUDAYAAN,</div>
        <div>RISET DAN TEKNOLOGI</div>
        <div>REPUBLIK INDONESIA</div>
      </div>
    </div>

    {/* ================= HALAMAN 2 : IDENTITAS SEKOLAH ================= */}
    <div
  className="page-a4 page-break flex flex-col items-center text-black"
  style={{
    padding: "25mm 20mm",
    fontFamily: "Times New Roman, serif",
  }}
>
      <div className="text-center mb-8">
        <div className="text-xl font-bold">SEKOLAH MENENGAH ATAS</div>
        <div className="text-lg font-bold">( SMA )</div>
      </div>

      <div className="w-full max-w-[170mm] mx-auto">
        <div className="grid grid-cols-[220px_20px_1fr] gap-y-3 text-[14pt]">
          <div>Nama Sekolah</div><div>:</div><div className="font-bold">SMAS ISLAM ASSUNNAH BAGEK NYAKA</div>
          <div>NPSN</div><div>:</div><div>50205721</div>
          <div>NIS/NSS/NDS</div><div>:</div><div>302230309046</div>
          <div>Alamat Sekolah</div><div>:</div><div>Jln. Raya Lab. Lombok Km.55</div>
          <div>Kelurahan / Desa</div><div>:</div><div>Kalijaga Timur</div>
          <div>Kecamatan</div><div>:</div><div>Kec. Aikmel</div>
          <div>Kota/Kabupaten</div><div>:</div><div>Kab. Lombok Timur</div>
          <div>Provinsi</div><div>:</div><div>Prov. Nusa Tenggara Barat</div>
          <div>Website</div><div>:</div><div className="font-semibold">www.sma-ia.sch.id</div>
          <div>E-mail</div><div>:</div><div>sma.islam.assunnah@gmail.com</div>
        </div>
      </div>
    </div> 

    {/* ================= HALAMAN 3 : IDENTITAS PESERTA DIDIK ================= */}
   <div
  className="page-a4 page-break flex flex-col text-black"
  style={{
    padding: "25mm 20mm",
    fontFamily: "Times New Roman, serif",
  }}
>
      <div className="text-center text-xl font-bold mb-8">
        IDENTITAS PESERTA DIDIK
      </div>

      <div className="w-full max-w-[170mm] mx-auto">
        <div className="grid grid-cols-[40px_1fr_20px_1.5fr] gap-y-2 text-[13pt]">
          <div>1.</div><div>Nama Lengkap Peserta Didik</div><div>:</div>
          <div className="font-bold">{s.nama_siswa?.toUpperCase()}</div>

          <div>2.</div><div>Nomor Induk / NISN</div><div>:</div>
          <div className="font-bold">- / {s.nisn}</div>

          {/* sisanya dikosongkan */}
          {[
            "Tempat, Tanggal Lahir","Jenis Kelamin","Agama","Status dalam Keluarga",
            "Anak ke","Alamat Peserta Didik","Nomor Telepon Rumah",
            "Sekolah Asal (SMP/MTs)","Diterima di sekolah ini","Di kelas",
            "Pada tanggal","Nama Orang Tua","Alamat Orang Tua",
            "Pekerjaan Orang Tua","Nama Wali Siswa",
            "Alamat Wali Peserta Didik","Pekerjaan Wali Peserta Didik",
          ].map((label, idx) => (
            <div key={idx} className="contents">
              <div>{idx + 3}.</div>
              <div>{label}</div>
              <div>:</div>
              <div>—</div>
            </div>
          ))}
        </div>
      </div>

      {/* TANDA TANGAN KEPALA SEKOLAH */}
<div className="mt-auto flex justify-end">
  <div className="text-right text-[13pt]">
    <div>Kepala Sekolah</div>

    {kepalaSekolahTtd && (
      <div className="mt-3 flex justify-end">
        <img
          src={kepalaSekolahTtd}
          alt="Tanda tangan Kepala Sekolah"
          className="h-20 w-48 object-contain"
        />
      </div>
    )}

    <div className="mt-1 font-bold underline">
  {formatNamaKepsek(kepalaSekolah)}
</div>
    <div>NIP.</div>
  </div>
</div>

    </div>
  </div>
))}


    </>
  );
}
