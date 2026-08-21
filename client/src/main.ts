import { DiscordSDK } from "@discord/embedded-app-sdk";
import { initDiscordBridge } from "./DiscordBridge";

declare const Elm: {
  Main: {
    init(options: {
      node: HTMLElement;
      flags: { apiBaseUrl: string; tableId: string };
    }): {
      ports: {
        toDiscord: { subscribe: (handler: (message: unknown) => void) => void };
        fromDiscord: { send: (message: unknown) => void };
      };
    };
  };
};

function getQueryParams(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

async function main() {
  const discordSdk = new DiscordSDK((window as any).DISCORD_CLIENT_ID);
  await discordSdk.ready();

  const queryParams = getQueryParams();

  const apiBaseUrl = (window as any).BACKEND_BASE_URL ?? window.location.origin;
  const tableId = queryParams["instance_id"] ?? "default-table";
  const root = document.getElementById("root");

  if (!root) {
    throw new Error('Missing required element with id "root"');
  }

  const app = Elm.Main.init({
    node: root,
    flags: {
      apiBaseUrl,
      tableId,
    },
  });

  await initDiscordBridge(discordSdk, app.ports, apiBaseUrl);
}

main().catch((err) => {
  console.error("Failed to start Activity:", err);
});
