import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

export const transactionsListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
    accountId: z.string().uuid().optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    kategori: z.string().min(1).optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: "from harus <= to",
    path: ["from"],
  });
