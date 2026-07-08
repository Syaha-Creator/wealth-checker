export function getPasswordChecks(password: string) {
  return [
    { label: "Min. 8 karakter", ok: password.length >= 8 },
    { label: "Huruf besar", ok: /[A-Z]/.test(password) },
    { label: "Angka", ok: /[0-9]/.test(password) },
  ];
}

export function isPasswordValid(password: string): boolean {
  return getPasswordChecks(password).every((check) => check.ok);
}

export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password harus minimal 8 karakter, mengandung huruf besar, dan angka.";
