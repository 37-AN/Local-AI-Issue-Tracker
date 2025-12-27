import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  userId?: string;
  username?: string;
};

const password = process.env.SESSION_PASSWORD;
if (!password || password.length < 32) {
  // Avoid throwing at import-time in production builds; but you should set it.
  // e.g. SESSION_PASSWORD="a-very-long-random-string-at-least-32-chars"
  // eslint-disable-next-line no-console
  console.warn("SESSION_PASSWORD missing/too short (min 32 chars).");
}

export const sessionOptions = {
  password: password ?? "dev-only-password-dev-only-password-dev-only!", // fallback for local dev only
  cookieName: "it_tracker_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    httpOnly: true,
    path: "/",
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
