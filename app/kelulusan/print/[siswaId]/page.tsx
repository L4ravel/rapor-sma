/* Halaman cetak surat keterangan lulus dengan layout mengikuti template lama, memakai data Firestore dan aset bio_sekolah. */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

type KelompokMapel = "A" | "B" | "C";

type MapelSnapshotItem = {
  mapelId: string;
  nama: string;
  kelompok?: KelompokMapel;
};

type SiswaKelulusan = {
  id: string;
  nama?: string;
  ttl?: string;
  orangTua?: string;
  npsn?: string;
  programJurusanId?: string;
  programJurusanNama?: string;
  mapelSnapshot?: MapelSnapshotItem[];
  nilaiByMapelId?: Record<string, string>;
};

type InformasiKelulusan = {
  id: string;
  nama?: string;
  ttl?: string;
  orangTua?: string;
  npsn?: string;
  jurusan?: string;
  nomorSurat?: string;
  tanggalSurat?: string;
  tempatSurat?: string;
  kepalaSekolah?: string;
  nipKepalaSekolah?: string;
  statusLulusText?: string;
};

type BioSekolah = {
  nama_sekolah?: string;
  alamat?: string;
  kepala_sekolah?: string;
  kopKelulusanUrl?: string;
  ttdKelulusanUrl?: string;
};

type NilaiRow = {
  no: number;
  nama: string;
  nilai: string;
  kelompok: KelompokMapel;
};

function formatTanggalIndonesia(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function normalizeKelompok(value?: string): KelompokMapel {
  const clean = String(value || "").trim().toUpperCase();
  if (clean === "A" || clean === "B" || clean === "C") return clean;
  return "A";
}

export default function PrintKelulusanPage() {
  const params = useParams<{ siswaId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [siswa, setSiswa] = useState<SiswaKelulusan | null>(null);
  const [info, setInfo] = useState<InformasiKelulusan | null>(null);
  const [bioSekolah, setBioSekolah] = useState<BioSekolah | null>(null);

  const siswaId = String(params?.siswaId || "").trim();

  useEffect(() => {
    async function loadData() {
      if (!siswaId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const siswaRef = doc(db, "kelulusan_siswa", siswaId);
        const bioRef = doc(db, "bio_sekolah", "default");

        const [siswaSnap, bioSnap] = await Promise.all([
          getDoc(siswaRef),
          getDoc(bioRef),
        ]);

        if (!siswaSnap.exists()) {
          setSiswa(null);
          setInfo(null);
          setBioSekolah(bioSnap.exists() ? (bioSnap.data() as BioSekolah) : null);
          return;
        }

        const siswaData = {
          id: siswaSnap.id,
          ...(siswaSnap.data() as Omit<SiswaKelulusan, "id">),
        };
        setSiswa(siswaData);
        setBioSekolah(bioSnap.exists() ? (bioSnap.data() as BioSekolah) : null);

        const npsn = String(siswaData.npsn || "").trim();
        let infoData: InformasiKelulusan | null = null;

        if (npsn) {
          const infoSnap = await getDocs(
            query(
              collection(db, "informasi_kelulusan"),
              where("npsn", "==", npsn),
              limit(1)
            )
          );

          if (!infoSnap.empty) {
            const found = infoSnap.docs[0];
            infoData = {
              id: found.id,
              ...(found.data() as Omit<InformasiKelulusan, "id">),
            };
          }
        }

        setInfo(infoData);
      } catch (error) {
        console.error(error);
        setSiswa(null);
        setInfo(null);
        setBioSekolah(null);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [siswaId]);

  const rows = useMemo<NilaiRow[]>(() => {
  if (!siswa) return [];

  const snapshot = Array.isArray(siswa.mapelSnapshot) ? siswa.mapelSnapshot : [];
  const nilaiByMapelId = siswa.nilaiByMapelId || {};

  const kelompokA = snapshot.filter(
    (mapel) => normalizeKelompok(mapel.kelompok) === "A"
  );

  const kelompokB = snapshot.filter(
    (mapel) => normalizeKelompok(mapel.kelompok) === "B"
  );

  const kelompokC = snapshot.filter(
    (mapel) => normalizeKelompok(mapel.kelompok) === "C"
  );

  return [...kelompokA, ...kelompokB, ...kelompokC].map((mapel, index) => ({
    no: index + 1,
    nama: mapel.nama || "-",
    nilai: String(nilaiByMapelId[mapel.mapelId] || ""),
    kelompok: normalizeKelompok(mapel.kelompok),
  }));
}, [siswa]);

  const groupedRows = useMemo(() => {
    return {
      A: rows.filter((item) => item.kelompok === "A"),
      B: rows.filter((item) => item.kelompok === "B"),
      C: rows.filter((item) => item.kelompok === "C"),
    };
  }, [rows]);

  const rataRata = useMemo(() => {
    const values = rows
      .map((item) => Number(String(item.nilai || "").replace(",", ".")))
      .filter((value) => !Number.isNaN(value));

    if (!values.length) return "";

    return (values.reduce((sum, item) => sum + item, 0) / values.length).toFixed(2);
  }, [rows]);

  const nama = info?.nama || siswa?.nama || "-";
  const ttl = info?.ttl || siswa?.ttl || "-";
  const orangTua = info?.orangTua || siswa?.orangTua || "-";
  const npsn = info?.npsn || siswa?.npsn || "-";
  const jurusan = info?.jurusan || siswa?.programJurusanNama || "-";

  const nomorSurat = info?.nomorSurat || "033/SMA-IA/E/V/2026";
  const tanggalSurat = formatTanggalIndonesia(info?.tanggalSurat) || "5 Mei 2026";
  const tempatSurat = info?.tempatSurat || "Bagek Nyaka";
  const kepalaSekolah =
    bioSekolah?.kepala_sekolah || info?.kepalaSekolah || "Kepala Sekolah";
  const nipKepalaSekolah = info?.nipKepalaSekolah || "";
  const statusLulusText = info?.statusLulusText || "LULUS";

  const kopKelulusanUrl = bioSekolah?.kopKelulusanUrl || "";
  const ttdKelulusanUrl = bioSekolah?.ttdKelulusanUrl || "";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-800">
        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          Memuat data cetak...
        </div>
      </div>
    );
  }

  if (!siswa) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-800">
        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <p className="text-lg font-bold">Data siswa tidak ditemukan.</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="print:hidden sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-slate-900">Preview Surat Kelulusan</p>
            <p className="text-xs text-slate-500">{nama}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Print
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-screen bg-slate-200 px-3 py-4 print:bg-white print:p-0">
        <div className="mx-auto w-full max-w-[850px] bg-white px-6 pb-6 pt-2 text-black print:max-w-none print:px-0 print:pb-0 print:pt-0">
          <div className="font-sans text-[11pt] leading-[1.15] text-black">
            <div className="mb-1">
              {kopKelulusanUrl ? (
                <img src={kopKelulusanUrl} alt="Kop Kelulusan" className="w-full" />
              ) : (
                <div className="border-b border-black py-4 text-center text-sm text-slate-400">
                  Kop kelulusan belum diatur
                </div>
              )}
            </div>

            <div className="mt-2 text-center">
              <span className="text-[16pt] font-bold uppercase underline">
                Surat Keterangan Lulus
              </span>
              <br />
              <span className="text-[12pt] font-bold">Nomor : {nomorSurat}</span>
            </div>

            <p className="mt-4 text-justify">
              Yang bertanda tangan dibawah ini, Kepala Sekolah, menerangkan bahwa:
            </p>

            <table className="mt-2 w-full border-collapse text-[11pt]">
              <tbody>
                <tr>
                  <td className="w-[40%] px-0 py-[2px] align-top">Nama</td>
                  <td className="w-[3%] px-0 py-[2px] align-top">:</td>
                  <td className="px-0 py-[2px] align-top font-bold uppercase">{nama}</td>
                </tr>
                <tr>
                  <td className="px-0 py-[2px] align-top">Tempat dan Tanggal Lahir</td>
                  <td className="px-0 py-[2px] align-top">:</td>
                  <td className="px-0 py-[2px] align-top font-bold uppercase">{ttl}</td>
                </tr>
                <tr>
                  <td className="px-0 py-[2px] align-top">Nama Orang Tua/Wali</td>
                  <td className="px-0 py-[2px] align-top">:</td>
                  <td className="px-0 py-[2px] align-top font-bold">{orangTua}</td>
                </tr>
                <tr>
                  <td className="px-0 py-[2px] align-top">Nomor Induk Siswa Nasional</td>
                  <td className="px-0 py-[2px] align-top">:</td>
                  <td className="px-0 py-[2px] align-top font-bold">{npsn}</td>
                </tr>
                <tr>
                  <td className="px-0 py-[2px] align-top">Program Jurusan</td>
                  <td className="px-0 py-[2px] align-top">:</td>
                  <td className="px-0 py-[2px] align-top font-bold uppercase">{jurusan}</td>
                </tr>
              </tbody>
            </table>

            <p className="mt-5 text-justify">
              Berdasarkan kriteria kelulusan peserta didik yang sudah ditetapkan, maka yang
              bersangkutan dinyatakan :
            </p>

            <div className="my-3 text-center">
              <span className="text-[18pt] font-bold tracking-[0.08em]">
  {statusLulusText.toUpperCase()}
</span>
            </div>

            <p className="text-justify">Dengan hasil sebagai berikut :</p>

            <table className="mx-auto mt-2 w-[90%] border-collapse text-[11pt]">
              <thead>
                <tr>
                  <th className="border border-[#999] px-[9px] py-[1px] text-center font-bold">
                    No
                  </th>
                  <th className="border border-[#999] px-[9px] py-[1px] text-center font-bold">
                    Mata Pelajaran
                  </th>
                  <th className="border border-[#999] px-[9px] py-[1px] text-center font-bold">
                    Nilai Ujian Sekolah
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="border border-[#999] px-[9px] py-[6px] text-center text-slate-500"
                    >
                      Belum ada nilai mapel.
                    </td>
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td colSpan={3} className="border border-[#999] px-[9px] py-[1px]">
                        Kelompok A
                      </td>
                    </tr>
                    {groupedRows.A.map((row) => (
                      <tr key={`A-${row.no}-${row.nama}`}>
                        <td className="border border-[#999] px-[9px] py-[1px] text-center">
                          {row.no}.
                        </td>
                        <td className="border border-[#999] px-[9px] py-[1px]">
                          {row.nama}
                        </td>
                        <td className="border border-[#999] px-[9px] py-[1px] text-center">
                          {row.nilai || "-"}
                        </td>
                      </tr>
                    ))}

                    <tr>
                      <td colSpan={3} className="border border-[#999] px-[9px] py-[1px]">
                        Kelompok B
                      </td>
                    </tr>
                    {groupedRows.B.map((row) => (
                      <tr key={`B-${row.no}-${row.nama}`}>
                        <td className="border border-[#999] px-[9px] py-[1px] text-center">
                          {row.no}.
                        </td>
                        <td className="border border-[#999] px-[9px] py-[1px]">
                          {row.nama}
                        </td>
                        <td className="border border-[#999] px-[9px] py-[1px] text-center">
                          {row.nilai || "-"}
                        </td>
                      </tr>
                    ))}

                    <tr>
                      <td colSpan={3} className="border border-[#999] px-[9px] py-[1px]">
                        Kelompok C
                      </td>
                    </tr>
                    {groupedRows.C.map((row) => (
                      <tr key={`C-${row.no}-${row.nama}`}>
                        <td className="border border-[#999] px-[9px] py-[1px] text-center">
                          {row.no}.
                        </td>
                        <td className="border border-[#999] px-[9px] py-[1px]">
                          {row.nama}
                        </td>
                        <td className="border border-[#999] px-[9px] py-[1px] text-center">
                          {row.nilai || "-"}
                        </td>
                      </tr>
                    ))}
                  </>
                )}

                <tr>
                  <td className="border border-[#999] px-[9px] py-[1px] text-center"></td>
                  <td className="border border-[#999] px-[9px] py-[1px]">
                    <b>Rata-rata nilai</b>
                  </td>
                  <td className="border border-[#999] px-[9px] py-[1px] text-center">
                    <b>{rataRata || "-"}</b>
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="mt-4 text-justify">
              Surat ini berlaku hingga ijazah diterbitkan. Jika ada kesalahan, akan
              diperbaiki sesuai ketentuan.
            </p>

            <table className="mt-6 w-full border-collapse text-[11pt]">
              <tbody>
                <tr>
                  <td className="w-[45%] align-top"></td>
                  <td className="align-top"></td>
                  <td className="w-[30%] align-top">
                    <div className="relative ml-auto h-[170px] w-[320px]">
                      <div className="absolute left-10 top-0 z-20 min-w-[180px] text-left">
                        <p>
                          {tempatSurat}, {tanggalSurat}
                        </p>
                        <p>Kepala Sekolah,</p>

                        <div className="mt-10">
                          <u>
                            <b>{kepalaSekolah}</b>
                          </u>
                          <br />
                          <b>NIY. 832 141203 1994 01 035</b>
                        </div>
                      </div>

                      <div
                        style={{
                          position: "absolute",
                          left: "0px",
                          top: "0px",
                          zIndex: 0,
                          display: "flex",
                          height: "180px",
                          width: "180px",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        {ttdKelulusanUrl ? (
                          <img
                            src={ttdKelulusanUrl}
                            alt="Tanda Tangan Kelulusan"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          body {
            background: white !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </>
  );
}