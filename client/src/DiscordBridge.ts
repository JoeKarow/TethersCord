// client/src/DiscordBridge.ts

import { DiscordSDK } from "@discord/embedded-app-sdk";

type ElmPorts = {
  toDiscord: {
    subscribe: (handler: (msg: any) => void) => void;
  };
  fromDiscord: {
    send: (msg: any) => void;
  };
};

export async function initDiscordBridge(
  discordSdk: DiscordSDK,
  ports: ElmPorts,
  backendBaseUrl: string,
): Promise<void> {
  ports.toDiscord.subscribe(async (msg: any) => {
    if (msg.type === "Authorize") {
      const scopes = (msg.scopes as string[]) ?? ["identify"];

      try {
        const authCode = await runDiscordAuthorize(discordSdk, scopes);
        const backendResult = await exchangeCodeWithBackend(
          backendBaseUrl,
          authCode,
        );

        ports.fromDiscord.send({
          type: "BackendAuthResult",
          data: backendResult,
        });
      } catch (error) {
        console.error("Authorize flow failed", error);
      }
    }
  });
}

async function runDiscordAuthorize(
  discordSdk: DiscordSDK,
  scopes: string[],
): Promise<string> {
  const response = await discordSdk.commands.authorize({
    client_id: (window as any).DISCORD_CLIENT_ID,
    response_type: "code",
    scope: scopes.join(" "),
    prompt: "none",
  });

  return response.code;
}

type BackendAuthResult = {
  userId: string;
  username: string;
  role: "dm" | "player";
  sessionToken: string;
};

async function exchangeCodeWithBackend(
  backendBaseUrl: string,
  code: string,
): Promise<BackendAuthResult> {
  const res = await fetch(`${backendBaseUrl}/api/oauth/discord/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    throw new Error(`Backend auth failed: ${res.status}`);
  }

  return res.json();
}
