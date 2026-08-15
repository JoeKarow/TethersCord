// client/src/main.ts

import { DiscordSDK } from "@discord/embedded-app-sdk";
import { initDiscordBridge } from "./DiscordBridge";
import { Elm } from "./Main.elm"; // depends on your bundler's Elm integration

function getQueryParams(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

async function main() {
  const queryParams = getQueryParams();

  const discordSdk = new DiscordSDK(queryParams);
  await discordSdk.ready();

  const apiBaseUrl = (window as any).BACKEND_BASE_URL ?? window.location.origin;
  const tableId = queryParams["instance_id"] ?? "default-table";

  const app = Elm.Main.init({
    node: document.getElementById("root"),
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
