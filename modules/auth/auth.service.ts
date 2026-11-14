
import "server-only";

import { prisma } from "@/libs/prisma";
import { getAuthConfig } from "./auth.config";

import {
  SignJWT,
  jwtVerify,
  type JWTPayload,
} from "jose";

import {
  createHash,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { compare } from "bcryptjs";

const DAY = 24 * 60 * 60 * 1000;

export class AuthError extends Error {
  constructor(
    message = "احراز هویت نامعتبر است.",
    public statusCode = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

type TokenType = "access" | "refresh";

type TokenPayload = JWTPayload & {
  sid: string;
  typ: TokenType;
};

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

function hashToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function safeHashEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

async function signToken(
  userId: string,
  sessionId: string,
  type: TokenType
): Promise<string> {
  const config = getAuthConfig();

  const isAccess = type === "access";

  const secret = isAccess
    ? config.accessSecret
    : config.refreshSecret;

  const expiration = isAccess
    ? config.accessTokenTtl
    : config.refreshTokenTtl;

  return new SignJWT({
    sid: sessionId,
    typ: type,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(secret);
}

async function verifyToken(
  token: string,
  type: TokenType
): Promise<TokenPayload> {
  const config = getAuthConfig();

  const secret = type === "access"
    ? config.accessSecret
    : config.refreshSecret;

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ["HS256"],
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string" ||
      payload.typ !== type
    ) {
      throw new AuthError();
    }

    return payload as TokenPayload;
  } catch {
    throw new AuthError("توکن نامعتبر یا منقضی شده است.");
  }
}

async function createTokens(
  userId: string,
  sessionId: string
): Promise<AuthTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    signToken(userId, sessionId, "access"),
    signToken(userId, sessionId, "refresh"),
  ]);

  return { accessToken, refreshToken };
}

export async function loginUser(
  identifier: string,
  password: string,
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  }
) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: identifier },
        { email: identifier },
      ],
      isActive: true,
    },
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
      passwordHash: true,
    },
  });

  // پیام یکسان برای جلوگیری از افشای وجود حساب کاربری
  if (!user) {
    throw new AuthError("نام کاربری یا رمز عبور اشتباه است.");
  }

  const passwordIsValid = await compare(
    password,
    user.passwordHash
  );

  if (!passwordIsValid) {
    throw new AuthError("نام کاربری یا رمز عبور اشتباه است.");
  }

  const config = getAuthConfig();

  // ابتدا نشست ایجاد می‌شود؛ سپس Hash توکن واقعی در آن قرار می‌گیرد.
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(randomUUID()),
      expiresAt: new Date(Date.now() + 7 * DAY),
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    },
  });

  try {
    const tokens = await createTokens(user.id, session.id);

    await prisma.userSession.update({
      where: { id: session.id },
      data: {
        tokenHash: hashToken(tokens.refreshToken),
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
      },
      accessTokenMaxAge: config.accessTokenMaxAge,
      refreshTokenMaxAge: config.refreshTokenMaxAge,
    };
  } catch (error) {
    await prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    throw error;
  }
}

export async function refreshUserSession(
  refreshToken: string
) {
  const payload = await verifyToken(refreshToken, "refresh");
  const userId = payload.sub!;
  const sessionId = payload.sid;

  const session = await prisma.userSession.findFirst({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      user: { isActive: true },
    },
    select: {
      id: true,
      tokenHash: true,
      userId: true,
    },
  });

  if (!session) {
    throw new AuthError("نشست شما معتبر نیست.");
  }

  const presentedHash = hashToken(refreshToken);

  // استفاده مجدد از Refresh Token قبلی نشانه احتمالی سرقت توکن است.
  if (!safeHashEqual(session.tokenHash, presentedHash)) {
    await prisma.userSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    throw new AuthError(
      "نشست به دلیل استفاده مجدد از توکن لغو شد."
    );
  }

  const tokens = await createTokens(userId, sessionId);

  // شرط tokenHash مانع استفاده هم‌زمان از یک توکن برای دو بار تمدید می‌شود.
  const updated = await prisma.userSession.updateMany({
    where: {
      id: session.id,
      userId,
      tokenHash: presentedHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: {
      tokenHash: hashToken(tokens.refreshToken),
      expiresAt: new Date(Date.now() + 7 * DAY),
    },
  });

  if (updated.count !== 1) {
    throw new AuthError(
      "تمدید نشست انجام نشد؛ دوباره وارد شوید."
    );
  }

  return tokens;
}

export async function getAuthenticatedUser(
  accessToken: string
) {
  const payload = await verifyToken(accessToken, "access");

  const session = await prisma.userSession.findFirst({
    where: {
      id: payload.sid,
      userId: payload.sub!,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      user: { isActive: true },
    },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          isActive: true,
        },
      },
    },
  });

  if (!session) {
    throw new AuthError("نشست معتبر نیست.");
  }

  return session.user;
}

export async function logoutSession(
  token: string | undefined,
  type: TokenType
) {
  if (!token) return;

  try {
    const payload = await verifyToken(token, type);

    await prisma.userSession.updateMany({
      where: {
        id: payload.sid,
        userId: payload.sub!,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  } catch {
    // خروج باید حتی با توکن منقضی‌شده نیز Cookieها را پاک کند.
  }
}
