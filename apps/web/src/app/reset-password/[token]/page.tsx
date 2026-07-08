"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ResetPasswordForm } from "../ResetPasswordForm";

function ResetPasswordTokenContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = typeof params.token === "string" ? params.token : "";
  // callbackURL dari email (Better Auth) — dibaca untuk konsistensi, tidak wajib dipakai di form.
  void searchParams.get("callbackURL");

  if (!token) {
    return <ResetPasswordForm token="" invalidLink />;
  }

  return <ResetPasswordForm token={token} />;
}

export default function ResetPasswordTokenPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordTokenContent />
    </Suspense>
  );
}
