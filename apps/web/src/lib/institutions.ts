// Daftar referensi institusi keuangan Indonesia, dipakai sebagai opsi
// datalist (autocomplete-tapi-tetap-bisa-ketik-bebas) di form rekening dan
// utang. Ini BUKAN daftar tertutup/validasi — pengguna tetap bisa mengetik
// nama institusi lain yang tidak ada di sini.

// Uang tunai / kas fisik — bukan institusi keuangan, tapi opsi paling umum
// untuk akun non-bank (dompet, kas di rumah, dll). Ditaruh di urutan
// pertama SEMUA_REKENING supaya mudah ditemukan.
export const KAS_TUNAI: string[] = [
  "Tunai",
];

// Bank umum konvensional (BUKU/KBMI berbagai skala) + bank pembangunan
// daerah (BPD) yang paling umum dikenal.
export const BANK_KONVENSIONAL: string[] = [
  "Bank Amar Indonesia",
  "Bank Artha Graha Internasional",
  "Bank Bumi Arta",
  "Bank Capital Indonesia",
  "Bank Central Asia (BCA)",
  "Bank China Construction Bank Indonesia",
  "Bank CIMB Niaga",
  "Bank Danamon Indonesia",
  "Bank DBS Indonesia",
  "Bank DKI",
  "Bank Ganesha",
  "Bank HSBC Indonesia",
  "Bank ICBC Indonesia",
  "Bank Index Selindo",
  "Bank Ina Perdana",
  "Bank Jabar Banten (bank bjb)",
  "Bank Jasa Jakarta",
  "Bank Jateng (BPD Jawa Tengah)",
  "Bank Jatim (BPD Jawa Timur)",
  "Bank Kalbar (BPD Kalimantan Barat)",
  "Bank Kaltimtara (BPD Kalimantan Timur & Utara)",
  "Bank Mandiri",
  "Bank Maybank Indonesia",
  "Bank Mayapada Internasional",
  "Bank Mega",
  "Bank Mizuho Indonesia",
  "Bank MNC Internasional",
  "Bank Multiarta Sentosa",
  "Bank Nagari (BPD Sumatera Barat)",
  "Bank Negara Indonesia (BNI)",
  "Bank Nobu (Bank National Nobu)",
  "Bank NTB Syariah",
  "Bank OCBC NISP",
  "Bank of India Indonesia",
  "Bank Panin (Pan Indonesia Bank)",
  "Bank Papua",
  "Bank Pembangunan Daerah Lainnya",
  "Bank Permata",
  "Bank QNB Indonesia",
  "Bank Rakyat Indonesia (BRI)",
  "Bank Rakyat Indonesia Agroniaga (BRI Agro)",
  "Bank Resona Perdania",
  "Bank Sahabat Sampoerna",
  "Bank Sinarmas",
  "Bank Standard Chartered Indonesia",
  "Bank Sulselbar (BPD Sulawesi Selatan & Barat)",
  "Bank Sumsel Babel (BPD Sumatera Selatan & Babel)",
  "Bank Sumut (BPD Sumatera Utara)",
  "Bank Tabungan Negara (BTN)",
  "Bank UOB Indonesia",
  "Bank Victoria International",
  "Bank Woori Saudara Indonesia 1906",
  "Citibank Indonesia",
  "Commonwealth Bank Indonesia",
  "KB Bukopin",
];

// Bank umum syariah dan unit usaha syariah yang beroperasi mandiri/dikenal luas.
export const BANK_SYARIAH: string[] = [
  "Bank Aladin Syariah",
  "Bank Jabar Banten Syariah (BJB Syariah)",
  "Bank Mega Syariah",
  "Bank Muamalat Indonesia",
  "Bank Panin Dubai Syariah",
  "Bank Syariah Indonesia (BSI)",
  "Bank Victoria Syariah",
  "BCA Syariah",
  "BTPN Syariah",
  "CIMB Niaga Syariah",
];

// Bank digital (full digital atau unit digital dari bank induk) yang populer di Indonesia.
export const BANK_DIGITAL: string[] = [
  "Allo Bank Indonesia",
  "Bank Jago",
  "Bank Neo Commerce (BNC)",
  "Bank Raya (eks BRI Agro)",
  "blu by BCA Digital",
  "Hibank",
  "Jenius (by Bank BTPN)",
  "Krom Bank Indonesia",
  "LINE Bank by Hana Bank",
  "SeaBank Indonesia",
  "Superbank",
  "TMRW by UOB",
  "Wokee by Bank KB Bukopin",
];

// Dompet digital / uang elektronik (e-wallet) yang umum dipakai di Indonesia.
export const E_WALLET: string[] = [
  "Astrapay",
  "DANA",
  "DANA Bisnis",
  "DOKU Wallet",
  "Flip",
  "GoPay",
  "i.saku (BNI)",
  "Jenius Pay",
  "LinkAja",
  "OVO",
  "Paytren",
  "RCash",
  "Sakuku (BCA)",
  "ShopeePay",
];

// Penyedia paylater / pinjaman fintech konsumtif yang umum dipakai di Indonesia.
export const PAYLATER_FINTECH: string[] = [
  "AdaKami",
  "Akulaku PayLater",
  "Atome",
  "BukuWarung PayLater",
  "Cashwagon",
  "Cicil",
  "Danacita",
  "DANA Paylater",
  "Easycash",
  "GoPayLater",
  "Home Credit Indonesia",
  "Indodana PayLater",
  "JULO",
  "Klik ACC",
  "Kredit Pintar",
  "Kredivo",
  "Pinjam Yuk",
  "Shopee PayLater (SPayLater)",
  "Traveloka PayLater",
  "TunaiKita",
  "Tunaiku (Bank Amar)",
  "Uangme",
];

// Untuk field "Nama Rekening" — mencakup semua jenis akun kas/tabungan/e-wallet.
export const SEMUA_REKENING: string[] = [
  ...KAS_TUNAI,
  ...BANK_KONVENSIONAL,
  ...BANK_SYARIAH,
  ...BANK_DIGITAL,
  ...E_WALLET,
];

// Untuk field "Nama Kartu / Penyedia" saat tipe utang = kartu_kredit —
// mencakup penerbit kartu kredit (bank konvensional & digital) dan paylater fintech.
export const SEMUA_KARTU_KREDIT_PAYLATER: string[] = [
  ...BANK_KONVENSIONAL,
  ...BANK_DIGITAL,
  ...PAYLATER_FINTECH,
];
