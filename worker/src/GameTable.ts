// worker/src/GameTable.ts

import type {
  DurableObject,
  DurableObjectState,
} from "@cloudflare/workers-types";
import type {
  Env,
  GameState,
  Message,
  PendingRoll,
  PostMessageInput,
  Role,
  StoneKind,
} from "./types";

const INITIAL_STONE_POOL: StoneKind[] = [
  "WhiteStone",
  "BlackStone",
  "WhiteStone",
  "BlackStone",
];

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

    if (url.pathname === "/stones/add-white" && request.method === "POST") {
      return this.handleAddWhiteStone(request);
    }

    if (url.pathname === "/stones/roll" && request.method === "POST") {
      return this.handleRoll(request, "Rolled");
    }

    if (url.pathname === "/stones/reroll" && request.method === "POST") {
      return this.handleRoll(request, "Rerolled");
    }

    if (url.pathname === "/stones/accept" && request.method === "POST") {
      return this.handleAcceptRoll(request);
    }

    if (
      url.pathname === "/connect" &&
      request.headers.get("Upgrade") === "websocket"
    ) {
      return this.handleConnect(request);
    }

    return new Response("Not found", { status: 404 });
  }

  private async handleConnect(request: Request): Promise<Response> {
    const token = parseTokenFromProtocol(
      request.headers.get("Sec-WebSocket-Protocol"),
    );
    const authInfo = token ? await getAuthFromToken(this.env, token) : null;
    if (!authInfo) {
      return new Response("Unauthorized", { status: 401 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hibernatable: the DO can evict from memory between messages and still
    // resume delivering broadcasts to this socket later.
    this.state.acceptWebSocket(server);
    server.send(JSON.stringify(this.gameState));

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { "Sec-WebSocket-Protocol": "bearer" },
    });
  }

  async webSocketMessage(): Promise<void> {
    // Clients only receive broadcasts; no inbound messages are expected.
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
  ): Promise<void> {
    ws.close(code, reason);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    ws.close(1011, "error");
  }

  private broadcast(state: GameState): void {
    const payload = JSON.stringify(state);
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // Ignore sends to sockets that are closing; webSocketClose will clean up.
      }
    }
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

    // The stone pool and pending roll are shared, in-memory session state:
    // not persisted to D1, they reset if the Durable Object restarts.
    return {
      sessionId,
      messages,
      stonePool: INITIAL_STONE_POOL,
      pendingRoll: null,
    };
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

    const next = await this.appendMessage(this.gameState!, {
      authorId: authInfo.discordUserId,
      authorName: authInfo.username,
      role: authInfo.role,
      content: inputRaw.content,
    });

    this.gameState = next;
    this.broadcast(next);

    return jsonResponse(next);
  }

  private async handleAddWhiteStone(request: Request): Promise<Response> {
    const authInfo = await getAuthFromRequest(this.env, request);
    if (!authInfo) {
      return new Response("Unauthorized", { status: 401 });
    }

    this.gameState = {
      ...this.gameState!,
      stonePool: [...this.gameState!.stonePool, "WhiteStone"],
    };
    this.broadcast(this.gameState);

    return jsonResponse(this.gameState);
  }

  private async handleRoll(
    request: Request,
    verb: "Rolled" | "Rerolled",
  ): Promise<Response> {
    const authInfo = await getAuthFromRequest(this.env, request);
    if (!authInfo) {
      return new Response("Unauthorized", { status: 401 });
    }

    const prev = this.gameState!;
    const pendingRoll = pickTwoRandom(prev.stonePool);

    const next = await this.appendMessage(
      { ...prev, pendingRoll },
      {
        authorId: authInfo.discordUserId,
        authorName: authInfo.username,
        role: authInfo.role,
        content: `${verb}: ${describeStones(pendingRoll.chosen)}`,
      },
    );

    this.gameState = next;
    this.broadcast(next);

    return jsonResponse(next);
  }

  private async handleAcceptRoll(request: Request): Promise<Response> {
    const authInfo = await getAuthFromRequest(this.env, request);
    if (!authInfo) {
      return new Response("Unauthorized", { status: 401 });
    }

    this.gameState = {
      ...this.gameState!,
      stonePool: INITIAL_STONE_POOL,
      pendingRoll: null,
    };
    this.broadcast(this.gameState);

    return jsonResponse(this.gameState);
  }

  private async appendMessage(
    state: GameState,
    input: AddMessageInput,
  ): Promise<GameState> {
    const next = addMessage(state, input);
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

    return next;
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

function pickTwoRandom(pool: StoneKind[]): PendingRoll {
  const indices = pool.map((_, i) => i);

  for (let i = indices.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const chosenIndices = new Set(indices.slice(0, Math.min(2, indices.length)));
  const chosen: StoneKind[] = [];
  const rest: StoneKind[] = [];

  pool.forEach((stone, i) => {
    if (chosenIndices.has(i)) {
      chosen.push(stone);
    } else {
      rest.push(stone);
    }
  });

  return { chosen, rest };
}

function randomInt(maxExclusive: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % maxExclusive;
}

function describeStones(stones: StoneKind[]): string {
  return stones.map((s) => (s === "WhiteStone" ? "White" : "Black")).join(", ");
}

type AuthInfo = {
  discordUserId: string;
  username: string;
  role: Role;
};

function parseTokenFromProtocol(header: string | null): string | null {
  if (!header) return null;

  const parts = header.split(",").map((part) => part.trim());
  return parts.find((part) => part && part !== "bearer") ?? null;
}

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

  return getAuthFromToken(env, token);
}

async function getAuthFromToken(
  env: Env,
  token: string,
): Promise<AuthInfo | null> {
  const row = await env.DB.prepare(
    `
    SELECT s.discord_user_id, s.discord_username, dm.discord_user_id AS dm_id
    FROM sessions_auth s
    LEFT JOIN facilitators dm ON dm.discord_user_id = s.discord_user_id
    WHERE s.session_token = ?
    LIMIT 1
  `,
  )
    .bind(token)
    .first<{
      discord_user_id: string;
      discord_username: string;
      dm_id: string | null;
    } | null>();

  if (!row) return null;

  const role: Role = row.dm_id ? "facilitator" : "player";

  return {
    discordUserId: row.discord_user_id,
    username: row.discord_username,
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
