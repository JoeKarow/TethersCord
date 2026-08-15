// worker/src/index.ts

import type { ExecutionContext } from "@cloudflare/workers-types";
import type { Env } from "./types";
import { GameTable } from "./GameTable";
import { handleDiscordExchange } from "./oauth-discord";

export { GameTable };

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname === "/api/oauth/discord/exchange" &&
      request.method === "POST"
    ) {
      return handleDiscordExchange(request, env);
    }

    if (url.pathname.startsWith("/api/table/")) {
      const [, , , tableId, ...rest] = url.pathname.split("/");
      const objectId = env.GAME_TABLE.idFromName(tableId);
      const stub = env.GAME_TABLE.get(objectId);

      const proxyUrl = new URL(request.url);
      proxyUrl.pathname = "/" + rest.join("/");

      return stub.fetch(proxyUrl.toString(), request);
    }

    return new Response("Not found", { status: 404 });
  },
};
