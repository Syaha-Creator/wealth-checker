# Wealth Checker — Postman

## Pairing (collection ↔ environment)

| Item | Nama |
|------|------|
| Collection | **Wealth Checker** |
| Environment | **Wealth Checker — Production** |

Selalu pilih environment **Wealth Checker — Production** sebelum mengirim request.
Tanpa environment, `{{baseUrl}}` kosong.

### Variabel environment
| Key | Isi |
|-----|-----|
| `baseUrl` | `https://wealth.velrox.cloud` |
| `webOrigin` | `https://wealth.velrox.cloud` (untuk `redirectTo` reset password) |
| `bearerToken` | otomatis setelah Sign In / Sign Up |
| `householdId` | opsional |

### Variabel collection
ID resource (`accountId`, `debtId`, …) — diisi manual saat explorasi.

## Cara pakai
1. Import `Wealth-Checker.postman_collection.json` + `Wealth-Checker.production.postman_environment.json`
2. Pilih environment **Wealth Checker — Production**
3. Jalankan **1. Auth → Sign In** — token tersimpan otomatis
4. Jalankan request lain


## Origin / 403

POST/PATCH/DELETE tanpa `Origin` ditolak Better Auth (`MISSING_OR_NULL_ORIGIN`). Collection pre-request otomatis mengirim `Origin: {{webOrigin}}`.
