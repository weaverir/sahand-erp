
export type LoginInput = {
  identifier: string;
  password: string;
};

export function validateLoginInput(
  value: unknown
): LoginInput {
  if (!value || typeof value !== "object") {
    throw new Error("اطلاعات ورود نامعتبر است.");
  }

  const data = value as Record<string, unknown>;

  const identifier =
    typeof data.identifier === "string"
      ? data.identifier.trim()
      : "";

  const password =
    typeof data.password === "string"
      ? data.password
      : "";

  if (!identifier || identifier.length > 254) {
    throw new Error("نام کاربری یا ایمیل معتبر نیست.");
  }

  if (!password || password.length > 128) {
    throw new Error("رمز عبور معتبر نیست.");
  }

  return { identifier, password };
}
