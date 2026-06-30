export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-600">
            <span className="text-3xl">💰</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Wealth Checker
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Ukur kondisi finansial dan level kebebasan finansialmu
          </p>
        </div>

        <div className="space-y-3">
          <a
            href="/auth/login"
            className="block w-full rounded-xl bg-blue-600 px-6 py-4 text-center font-semibold text-white transition hover:bg-blue-700"
          >
            Masuk
          </a>
          <a
            href="/auth/register"
            className="block w-full rounded-xl border-2 border-blue-600 px-6 py-4 text-center font-semibold text-blue-600 transition hover:bg-blue-50 dark:hover:bg-blue-950"
          >
            Daftar Akun Baru
          </a>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-4 text-center">
          {[
            { label: "Level 0–6", desc: "Kebebasan finansial" },
            { label: "Real-time", desc: "Kalkulasi otomatis" },
            { label: "Mobile-first", desc: "Input cepat" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-white p-3 shadow-sm dark:bg-gray-800">
              <div className="text-sm font-bold text-blue-600">{item.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
