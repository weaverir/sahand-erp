
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";

const ACCESS_TOKEN_MAX_AGE = 15 * 60;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

function getSecret(name: string): Uint8Array {
  const value = process.env[name];

  if (!value || value.length < 32) {
    throw new Error(
      `${name} must be configured with at least 32 characters.`
    );
  }

  return new TextEncoder().encode(value);
}

export function getAuthConfig() {
  return {
    accessSecret: getSecret("JWT_ACCESS_SECRET"),
    refreshSecret: getSecret("JWT_REFRESH_SECRET"),
    accessTokenTtl: ACCESS_TOKEN_TTL,
    refreshTokenTtl: REFRESH_TOKEN_TTL,
    accessTokenMaxAge: ACCESS_TOKEN_MAX_AGE,
    refreshTokenMaxAge: REFRESH_TOKEN_MAX_AGE,
    issuer: "sahand-erp",
    audience: "sahand-erp-client",
  };
}
