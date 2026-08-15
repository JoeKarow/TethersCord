// worker/src/types.ts

import type {
  D1Database,
  DurableObjectNamespace,
} from "@cloudflare/workers-types";

export type Role = "facilitator" | "player";

export type Message = {
  id: string;
  sessionId: string;
  authorId: string;
  authorName: string;
  role: Role;
  content: string;
  createdAt: number;
};

export type GameState = {
  sessionId: string;
  messages: Message[];
};

export type PostMessageInput = {
  content: string;
};

export type BackendAuthResult = {
  userId: string;
  username: string;
  role: Role;
  sessionToken: string;
};

export type Env = {
  DB: D1Database;
  GAME_TABLE: DurableObjectNamespace;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_REDIRECT_URI: string;
};
