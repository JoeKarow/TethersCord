// worker/src/GameTable.ts

import type {
  DurableObject,
  DurableObjectState,
} from "@cloudflare/workers-types";
import type { Env, GameState, Message, PostMessageInput, Role } from "./types";

export class GameTable implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private gameState: GameState | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId =
      url.searchParams.get("sessionId") ?? this.state.id.toString();

    if (!this.gameState) {
      this.gameState = await this.loadInitialState(sessionId);
    }

    if (url.pathname === "/messages" && request.method === "GET") {
      return this.handleGetMessages();
    }

    if (url.pathname === "/message" && request.method === "POST") {
      return this.handlePostMessage(request);
    }

    return new Response("Not found", { status: 404 });
  }

  private async loadInitialState(sessionId: string): Promise<GameState> {
    const rows = await this.env.DB.prepare(
      `
      SELECT id, session_id, author_id, author_name, role, content, created_at
      FROM messages
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `,
    )
      .bind(sessionId)
      .all<Message>();

    const messages = rows.results ? [...rows.results].reverse() : [];

    return { sessionId, messages };
  }

  private async handleGetMessages(): Promise<Response> {
    return jsonResponse(this.gameState);
  }

  private async handlePostMessage(request: Request): Promise<Response> {
    const authInfo = await getAuthFromRequest(this.env, request);
    if (!authInfo) {
      return new Response("Unauthorized", { status: 401 });
    }

    const inputRaw = (await request.json()) as PostMessageInput;

    const prev = this.gameState!;
    const next = addMessage(prev, {
      authorId: authInfo.discordUserId,
      authorName: authInfo.username,
      role: authInfo.role,
      content: inputRaw.content,
    });

    this.gameState = next;

    const msg = next.messages[next.messages.length - 1];

    await this.env.DB.prepare(
      `
      INSERT INTO messages (id, session_id, author_id, author_name, role, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        msg.id,
        msg.sessionId,
        msg.authorId,
        msg.authorName,
        msg.role,
        msg.content,
        msg.createdAt,
      )
      .run();

    return jsonResponse(next);
  }
}

type AddMessageInput = {
  authorId: string;
  authorName: string;
  role: Role;
  content: string;
};

function addMessage(state: GameState, input: AddMessageInput): GameState {
  const now = Date.now();
  const id = crypto.randomUUID();

  const msg: Message = {
    id,
    sessionId: state.sessionId,
    authorId: input.authorId,
    authorName: input.authorName,
    role: input.role,
    content: input.content,
    createdAt: now,
  };

  const maxMessages = 200;

  const cappedMessages =
    state.messages.length >= maxMessages
      ? [
          ...state.messages.slice(state.messages.length - (maxMessages - 1)),
          msg,
        ]
      : [...state.messages, msg];

  return { ...state, messages: cappedMessages };
}

type AuthInfo = {
  discordUserId: string;
  username: string;
  role: Role;
};

async function getAuthFromRequest(
  env: Env,
  request: Request,
): Promise<AuthInfo | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const row = await env.DB.prepare(
    `
    SELECT s.discord_user_id, dm.discord_user_id AS dm_id
    FROM sessions_auth s
    LEFT JOIN facilitators dm ON dm.discord_user_id = s.discord_user_id
    WHERE s.session_token = ?
    LIMIT 1
  `,
  )
    .bind(token)
    .first<{ discord_user_id: string; dm_id: string | null } | null>();

  if (!row) return null;

  const role: Role = row.dm_id ? "facilitator" : "player";

  // For now, we don’t store username in sessions_auth; frontend keeps it separately.
  const username = ""; // can be enriched later if desired

  return {
    discordUserId: row.discord_user_id,
    username,
    role,
  };
}

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}
