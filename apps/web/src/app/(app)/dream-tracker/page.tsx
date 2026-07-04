"use client";

import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select, InputRupiah } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatRupiahInput, parseRupiahInput } from "@/lib/format";
import { apiFetch as apiFetchRaw } from "@/lib/apiFetch";

interface DreamGoal {
  id: string;
  namaGoal: string;
  accountId: string | null;
  targetNominal: number;
  saldoSaatIni: number;
  persentase: number;
  tercapai: boolean;
  sisaMenujuTarget: number;
}

interface Account {
  id: string;
  nama: string;
  isActive: boolean;
}

async function apiFetch(path: string, method: string, body?: unknown) {
  const res = await apiFetchRaw(`${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Gagal");
  }
  if (res.status === 204) return null;
  return res.json();
}

function StarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M12 21c-4.5-3-8-6.5-8-10.5A5.5 5.5 0 0112 6a5.5 5.5 0 018 4.5c0 4-3.5 7.5-8 10.5z" />
    </svg>
  );
}

interface GoalFormState {
  namaGoal: string;
  targetNominal: string;
  accountId: string; // "" = tanpa rekening (saldo manual)
  saldoManual: string;
}

const EMPTY_FORM: GoalFormState = { namaGoal: "", targetNominal: "", accountId: "", saldoManual: "" };

export default function DreamTrackerPage() {
  const [goals, setGoals] = useState<DreamGoal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [formMode, setFormMode] = useState<"none" | "new" | string>("none"); // string = editing goal id
  const [form, setForm] = useState<GoalFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DreamGoal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refetch = useCallback(async () => {
    setFetchError("");
    try {
      const [goalsData, accountsData] = await Promise.all([
        apiFetch("/api/dream-goals", "GET"),
        apiFetch("/api/accounts", "GET"),
      ]);
      setGoals(goalsData);
      setAccounts(accountsData.filter((a: Account) => a.isActive));
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Gagal memuat data Dream Tracker");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Dibungkus IIFE async (bukan panggilan langsung) supaya setState di dalam
    // refetch() berjalan sebagai microtask, bukan sinkron di badan effect.
    (async () => {
      await refetch();
    })();
  }, [refetch]);

  const openNewForm = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setFormMode("new");
  };

  const openEditForm = (goal: DreamGoal) => {
    setForm({
      namaGoal: goal.namaGoal,
      targetNominal: formatRupiahInput(String(goal.targetNominal)),
      accountId: goal.accountId ?? "",
      saldoManual: goal.accountId ? "" : formatRupiahInput(String(goal.saldoSaatIni)),
    });
    setFormError("");
    setFormMode(goal.id);
  };

  const closeForm = () => {
    setFormMode("none");
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = {
      namaGoal: form.namaGoal,
      targetNominal: parseRupiahInput(form.targetNominal),
      accountId: form.accountId || undefined,
      ...(form.accountId ? {} : { saldoManual: parseRupiahInput(form.saldoManual) }),
    };

    try {
      if (formMode === "new") {
        await apiFetch("/api/dream-goals", "POST", payload);
      } else {
        // PATCH: accountId eksplisit null jika user melepas link rekening
        await apiFetch(`/api/dream-goals/${formMode}`, "PATCH", {
          ...payload,
          accountId: form.accountId || null,
        });
      }
      closeForm();
      await refetch();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan goal");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/dream-goals/${deleteTarget.id}`, "DELETE");
      setDeleteTarget(null);
      await refetch();
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Gagal menghapus goal");
    } finally {
      setDeleting(false);
    }
  };

  const formCard = (formMode === "new" || formMode !== "none") && (
    <Card as="form" onSubmit={handleSubmit} className="mb-4 max-w-xl" padding="lg">
      <h3 className="font-semibold text-text-primary mb-4">{formMode === "new" ? "Impian Baru" : "Edit Impian"}</h3>
      {formError && <p role="alert" className="text-sm text-danger-text mb-3">{formError}</p>}
      <div className="space-y-3">
        <Input
          id="goal-nama"
          label="Nama Impian"
          placeholder="Cth: Liburan ke Jepang"
          value={form.namaGoal}
          onChange={(e) => setForm((f) => ({ ...f, namaGoal: e.target.value }))}
          required
        />
        <InputRupiah
          id="goal-target"
          label="Target Nominal"
          value={form.targetNominal}
          onChange={(v) => setForm((f) => ({ ...f, targetNominal: v }))}
          required
        />
        <div>
          <Select
            id="goal-account"
            label="Rekening Terkait (opsional)"
            value={form.accountId}
            onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
          >
            <option value="">Tanpa rekening (update saldo manual)</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.nama}</option>)}
          </Select>
          <p className="text-xs text-text-muted mt-1">
            {form.accountId ? "Progress akan mengikuti saldo rekening ini secara otomatis." : "Progress diupdate manual di bawah."}
          </p>
        </div>
        {!form.accountId && (
          <InputRupiah
            id="goal-saldo-manual"
            label="Saldo Terkumpul Saat Ini"
            value={form.saldoManual}
            onChange={(v) => setForm((f) => ({ ...f, saldoManual: v }))}
          />
        )}
      </div>
      <div className="flex gap-2 mt-4 max-w-xs">
        <Button type="button" variant="secondary" fullWidth onClick={closeForm}>Batal</Button>
        <Button type="submit" fullWidth loading={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
      </div>
    </Card>
  );

  return (
    <div className="max-w-3xl">
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Impian"
        message={`Hapus impian "${deleteTarget?.namaGoal}"? Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={deleting}
      />

      <PageHeader
        title="Dream Tracker"
        subtitle="Lacak progress menuju impian finansialmu"
        action={
          <Button onClick={openNewForm} size="sm">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></svg>
            Tambah
          </Button>
        }
      />

      {fetchError && (
        <div className="mb-4 p-3 bg-danger-soft border border-danger-soft-border rounded-xl flex items-start gap-2">
          <p className="text-sm text-danger-text flex-1" role="alert">{fetchError}</p>
          <button onClick={() => { setLoading(true); refetch(); }} className="text-xs text-danger-text font-medium hover:underline shrink-0">Coba lagi</button>
        </div>
      )}

      {formCard}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : goals.length === 0 && !fetchError ? (
        <EmptyState
          icon={<StarIcon />}
          title="Belum ada impian yang dicatat"
          description="Tambahkan target finansialmu — liburan, dana pendidikan, atau apa pun — dan lacak progressnya di sini."
          action={<Button size="sm" onClick={openNewForm}>Tambah Impian</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {goals.map((goal) => (
            <Card key={goal.id} className={goal.tercapai ? "border-brand" : ""}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary truncate">{goal.namaGoal}</p>
                  {goal.accountId ? (
                    <p className="text-xs text-text-muted">Terhubung rekening</p>
                  ) : (
                    <p className="text-xs text-text-muted">Update manual</p>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-1">
                  <IconButton
                    onClick={() => openEditForm(goal)}
                    size="sm"
                    variant="info"
                    aria-label={`Edit impian ${goal.namaGoal}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                  </IconButton>
                  <IconButton
                    onClick={() => setDeleteTarget(goal)}
                    size="sm"
                    variant="danger"
                    aria-label={`Hapus impian ${goal.namaGoal}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                  </IconButton>
                </div>
              </div>

              {goal.tercapai && <Badge variant="brand" className="mb-2">Tercapai! 🎉</Badge>}

              <div className="flex items-baseline justify-between mb-1">
                <span className="text-lg font-bold text-text-primary">{formatCurrency(goal.saldoSaatIni)}</span>
                <span className="text-xs text-text-muted">dari {formatCurrency(goal.targetNominal)}</span>
              </div>
              <div className="h-2 bg-surface-hover rounded-full overflow-hidden" role="progressbar" aria-valuenow={goal.persentase} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress ${goal.namaGoal}`}>
                <div className={`h-full ${goal.tercapai ? "bg-brand" : "bg-info"}`} style={{ width: `${goal.persentase}%` }} />
              </div>
              <p className="text-xs text-text-muted mt-1.5">
                {goal.tercapai ? "Target tercapai!" : `${goal.persentase}% — sisa ${formatCurrency(goal.sisaMenujuTarget)}`}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
