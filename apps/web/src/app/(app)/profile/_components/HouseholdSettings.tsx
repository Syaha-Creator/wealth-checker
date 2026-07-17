"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmModal } from "@/components/ConfirmModal";
import { apiJson, getActiveHouseholdId, setActiveHouseholdId } from "@/lib/apiFetch";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/lib/auth-client";

const apiFetch = apiJson;

type Role = "owner" | "editor" | "viewer";

interface HouseholdListItem {
  id: string;
  nama: string;
  role: Role;
  memberCount: number;
}

interface Member {
  userId: string;
  role: Role;
  joinedAt: string;
  name: string;
  email: string;
}

interface Invite {
  id: string;
  invitedEmail: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
}

interface MembersResponse {
  householdId: string;
  currentUserRole: Role;
  members: Member[];
  invites: Invite[];
}

const ROLE_LABEL: Record<Role, string> = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

export function HouseholdSettings() {
  const { showToast } = useToast();
  const { data: session } = useSession();
  const [households, setHouseholds] = useState<HouseholdListItem[] | null>(null);
  const [membersData, setMembersData] = useState<MembersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);

  const [switching, setSwitching] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  // Sprint 28 (Fase 4) bugfix: sebelumnya tidak ada jalan bagi member
  // editor/viewer untuk keluar dari household sendiri (tombol "Keluarkan"
  // hanya muncul untuk owner, dan backend-nya memang menolak non-owner
  // memanggil endpoint itu sama sekali) — plan Fase 4 eksplisit mensyaratkan
  // "Tombol keluar dari household (bagi non-owner)". `leaveTarget` terpisah
  // dari `removeTarget` supaya salinan pesan konfirmasi bisa dibedakan
  // ("keluar" vs "keluarkan anggota lain").
  const [leaveTarget, setLeaveTarget] = useState<Member | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  // setState calls live inside this async function (not directly in the
  // effect body) — same pattern as useApiResource.ts.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [list, members] = await Promise.all([
          apiFetch("/api/households") as Promise<HouseholdListItem[]>,
          apiFetch("/api/households/members") as Promise<MembersResponse>,
        ]);
        if (cancelled) return;
        setHouseholds(list);
        setMembersData(members);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat data household");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const handleSwitch = async (householdId: string) => {
    if (householdId === membersData?.householdId) return;
    setSwitching(true);
    setMessage(null);
    try {
      await apiFetch("/api/households/switch", "POST", { householdId });
      setActiveHouseholdId(householdId);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal beralih household";
      setMessage({ type: "error", text: msg });
      showToast({ type: "error", message: msg });
      setSwitching(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setMessage(null);
    try {
      const invite = await apiFetch<{ inviteUrl: string; emailSent?: boolean }>("/api/households/invite", "POST", { email: inviteEmail.trim(), role: inviteRole });
      setMessage({
        type: "success",
        text: invite.emailSent
          ? `Undangan dikirim ke ${inviteEmail.trim()}. Link cadangan: ${invite.inviteUrl}`
          : `Email gagal terkirim — bagikan link ini ke ${inviteEmail.trim()}: ${invite.inviteUrl}`,
      });
      showToast({
        type: "success",
        message: invite.emailSent ? "Undangan anggota berhasil dikirim" : "Undangan dibuat (bagikan link manual)",
      });
      setInviteEmail("");
      await reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengundang anggota";
      setMessage({ type: "error", text: msg });
      showToast({ type: "error", message: msg });
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setBusyUserId(inviteId);
    setMessage(null);
    try {
      await apiFetch(`/api/households/invites/${inviteId}`, "DELETE");
      showToast({ type: "success", message: "Undangan berhasil dibatalkan" });
      await reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal membatalkan undangan";
      setMessage({ type: "error", text: msg });
      showToast({ type: "error", message: msg });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRoleChange = async (userId: string, role: Role) => {
    setBusyUserId(userId);
    setMessage(null);
    try {
      await apiFetch(`/api/households/members/${userId}`, "PATCH", { role });
      showToast({ type: "success", message: "Peran anggota berhasil diperbarui" });
      await reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengubah peran anggota";
      setMessage({ type: "error", text: msg });
      showToast({ type: "error", message: msg });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    setBusyUserId(removeTarget.userId);
    setMessage(null);
    try {
      await apiFetch(`/api/households/members/${removeTarget.userId}`, "DELETE");
      setRemoveTarget(null);
      showToast({ type: "success", message: "Anggota berhasil dikeluarkan" });
      await reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengeluarkan anggota";
      setMessage({ type: "error", text: msg });
      showToast({ type: "error", message: msg });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleLeave = async () => {
    if (!leaveTarget || !membersData) return;
    setBusyUserId(leaveTarget.userId);
    setMessage(null);
    try {
      await apiFetch(`/api/households/members/${leaveTarget.userId}`, "DELETE");
      // Household yang baru saja ditinggalkan bisa saja masih tersimpan sebagai
      // "aktif" di localStorage — bersihkan supaya apiFetch() berikutnya jatuh
      // ke default household lain di server (lihat resolveHousehold), bukan
      // terus mengirim id household yang sudah bukan miliknya lagi.
      if (getActiveHouseholdId() === membersData.householdId) setActiveHouseholdId(null);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal keluar dari household";
      setMessage({ type: "error", text: msg });
      showToast({ type: "error", message: msg });
      setBusyUserId(null);
      setLeaveTarget(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <Skeleton className="h-4 w-40 mb-2" />
        <Skeleton className="h-3 w-64 mb-4" />
        <Skeleton className="h-10 w-full mb-2" />
        <Skeleton className="h-10 w-full" />
      </Card>
    );
  }

  if (error || !membersData || !households) {
    return (
      <Card>
        <h2 className="text-base font-semibold text-text-primary mb-2">Kelola Household</h2>
        <p className="text-sm text-danger-text">{error || "Gagal memuat data household"}</p>
      </Card>
    );
  }

  const isOwner = membersData.currentUserRole === "owner";
  const activeHouseholdId = getActiveHouseholdId() ?? membersData.householdId;

  return (
    <Card>
      <h2 className="text-base font-semibold text-text-primary mb-1">Kelola Household</h2>
      <p className="text-xs text-text-muted mb-4">
        Bagikan data keuangan (rekening, transaksi, utang/piutang, aset, dsb) dengan anggota keluarga lain.
      </p>

      <div className="space-y-5">
        {/* ─── Household switcher ─────────────────────────────────────── */}
        {households.length > 1 && (
          <div>
            <p className="text-sm font-medium text-text-secondary mb-1.5">Household Aktif</p>
            <div className="flex flex-col gap-2">
              {households.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  disabled={switching}
                  onClick={() => handleSwitch(h.id)}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    h.id === activeHouseholdId
                      ? "border-brand bg-brand-soft"
                      : "border-border hover:bg-surface-hover"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-text-primary truncate">{h.nama}</span>
                    <span className="block text-xs text-text-muted">{h.memberCount} anggota &middot; {ROLE_LABEL[h.role]}</span>
                  </span>
                  {h.id === activeHouseholdId && <Badge variant="brand">Aktif</Badge>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Members list ───────────────────────────────────────────── */}
        <div>
          <p className="text-sm font-medium text-text-secondary mb-1.5">Anggota</p>
          <div className="flex flex-col gap-2">
            {membersData.members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-border">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {m.name}
                    {m.email === session?.user?.email && <span className="text-text-muted font-normal"> (Anda)</span>}
                  </p>
                  <p className="text-xs text-text-muted truncate">{m.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isOwner ? (
                    <Select
                      aria-label={`Peran ${m.name}`}
                      value={m.role}
                      disabled={busyUserId === m.userId}
                      onChange={(e) => handleRoleChange(m.userId, e.target.value as Role)}
                      className="!w-auto !py-1.5 text-xs"
                    >
                      <option value="owner">Owner</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </Select>
                  ) : (
                    <Badge variant="neutral">{ROLE_LABEL[m.role]}</Badge>
                  )}
                  {m.email === session?.user?.email ? (
                    // Household beranggota 1 (kasus paling umum — household
                    // pribadi bawaan) tidak punya siapa pun untuk "ditinggali",
                    // dan server memang menolaknya (409) — sembunyikan saja
                    // daripada menampilkan tombol yang pasti gagal.
                    membersData.members.length > 1 && (
                      <Button
                        type="button"
                        variant="outline-danger"
                        size="sm"
                        loading={busyUserId === m.userId}
                        onClick={() => setLeaveTarget(m)}
                      >
                        Keluar
                      </Button>
                    )
                  ) : isOwner && (
                    <Button
                      type="button"
                      variant="outline-danger"
                      size="sm"
                      loading={busyUserId === m.userId}
                      onClick={() => setRemoveTarget(m)}
                    >
                      Keluarkan
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Pending invites ─────────────────────────────────────────── */}
        {membersData.invites.length > 0 && (
          <div>
            <p className="text-sm font-medium text-text-secondary mb-1.5">Undangan Menunggu</p>
            <div className="flex flex-col gap-2">
              {membersData.invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-border bg-surface-hover">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{inv.invitedEmail}</p>
                    <p className="text-xs text-text-muted">Sebagai {ROLE_LABEL[inv.role]}</p>
                  </div>
                  {isOwner && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={busyUserId === inv.id}
                      onClick={() => handleRevokeInvite(inv.id)}
                    >
                      Batalkan
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Invite form (owner-only) ────────────────────────────────── */}
        {isOwner && (
          <div>
            <p className="text-sm font-medium text-text-secondary mb-1.5">Undang Anggota Baru</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="email@contoh.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  aria-label="Email yang diundang"
                />
              </div>
              <Select
                aria-label="Peran undangan"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                className="sm:!w-32"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </Select>
              <Button type="button" variant="secondary" loading={inviting} onClick={handleInvite}>
                Undang
              </Button>
            </div>
            <p className="text-xs text-text-muted mt-1.5">
              Undangan dikirim lewat email. Link cadangan tetap ditampilkan jika perlu dibagikan manual.
            </p>
          </div>
        )}

        {message && (
          <div
            role={message.type === "error" ? "alert" : "status"}
            className={`p-3 text-sm rounded-xl break-all ${
              message.type === "success"
                ? "bg-brand-soft border border-brand-soft-border text-brand"
                : "bg-danger-soft border border-danger-soft-border text-danger-text"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      <ConfirmModal
        open={Boolean(removeTarget)}
        title="Keluarkan Anggota"
        message={`Yakin ingin mengeluarkan ${removeTarget?.name} dari household ini? Data yang sudah dicatat tetap tersimpan.`}
        confirmLabel="Ya, Keluarkan"
        confirmVariant="danger"
        busy={busyUserId === removeTarget?.userId}
        onConfirm={handleRemoveMember}
        onCancel={() => setRemoveTarget(null)}
      />

      <ConfirmModal
        open={Boolean(leaveTarget)}
        title="Keluar dari Household"
        message={
          leaveTarget?.role === "owner"
            ? "Anda owner household ini — kalau masih ada owner lain, Anda bisa keluar. Kalau Anda satu-satunya owner, alihkan kepemilikan ke anggota lain dulu sebelum keluar."
            : "Yakin ingin keluar dari household ini? Anda akan kehilangan akses ke data keuangan bersama, tapi data yang pernah Anda catat tetap tersimpan."
        }
        confirmLabel="Ya, Keluar"
        confirmVariant="danger"
        busy={busyUserId === leaveTarget?.userId}
        onConfirm={handleLeave}
        onCancel={() => setLeaveTarget(null)}
      />
    </Card>
  );
}
