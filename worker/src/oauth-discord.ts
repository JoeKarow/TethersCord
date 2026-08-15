// worker/src/oauth-discord.ts

import type { Env, BackendAuthResult, Role } from "./types";

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
};

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  discriminator: string;
  avatar: string | null;
};

export async function handleDiscordExchange(
  request: Request,
  env: Env,
): Promise<Response> {
  const { code } = (await request.json()) as { code: string };

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: env.DISCORD_REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return new Response(`Discord token error: ${text}`, { status: 400 });
  }

  const tokenData = (await tokenRes.json()) as DiscordTokenResponse;
  const accessToken = tokenData.access_token;

  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userRes.ok) {
    return new Response("Failed to fetch user from Discord", { status: 400 });
  }

  const user = (await userRes.json()) as DiscordUser;

  const username =
    user.global_name ??
    (user.discriminator === "0"
      ? user.username
      : `${user.username}#${user.discriminator}`);

  const role = (await inferRoleFromDb(env, user.id)) as Role;

  const sessionToken = crypto.randomUUID();

  await env.DB.prepare(
    `
    INSERT INTO sessions_auth (session_token, discord_user_id, created_at)
    VALUES (?, ?, ?)
  `,
  )
    .bind(sessionToken, user.id, Date.now())
    .run();

  const result: BackendAuthResult = {
    userId: user.id,
    username,
    role,
    sessionToken,
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function inferRoleFromDb(env: Env, discordUserId: string): Promise<Role> {
  const dmRow = await env.DB.prepare(
    `
    SELECT 1 FROM dungeon_masters
    WHERE discord_user_id = ?
    LIMIT 1
  `,
  )
    .bind(discordUserId)
    .first<{ "1": number } | null>();

  return dmRow ? "facilitator" : "player";
}
