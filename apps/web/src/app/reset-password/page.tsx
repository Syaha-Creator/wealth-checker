"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ResetPasswordForm } from "./ResetPasswordForm";

/** Better Auth redirect setelah klik link email: /reset-password?token=... */
function ResetPasswordQueryContent() {
  const searchParams = useSearchParams();
  void searchParams.get("callbackURL");

  if (searchParams.get("error") === "INVALID_TOKEN") {
    return <ResetPasswordForm token="" invalidLink />;
  }

  const token = searchParams.get("token") ?? "";
  if (!token) {
    return <ResetPasswordForm token="" invalidLink />;
  }

  return <ResetPasswordForm token={token} />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordQueryContent />
    </Suspense>
  );
}
