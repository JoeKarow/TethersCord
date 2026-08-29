// client/src/GameSocket.ts

type GameSocketPorts = {
  wsGameState: { send: (message: unknown) => void };
};

const MAX_RECONNECT_DELAY_MS = 10000;

export function connectGameSocket(
  backendBaseUrl: string,
  tableId: string,
  sessionToken: string,
  ports: GameSocketPorts,
): void {
  const url = buildWsUrl(backendBaseUrl, tableId);
  let attempt = 0;

  const open = () => {
    const socket = new WebSocket(url, ["bearer", sessionToken]);

    socket.addEventListener("open", () => {
      attempt = 0;
    });

    socket.addEventListener("message", (event) => {
      try {
        ports.wsGameState.send(JSON.parse(event.data as string));
      } catch (error) {
        console.error("Failed to parse game state push", error);
      }
    });

    socket.addEventListener("close", scheduleReconnect);
    socket.addEventListener("error", () => socket.close());
  };

  const scheduleReconnect = () => {
    const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
    attempt += 1;
    setTimeout(open, delay);
  };

  open();
}

function buildWsUrl(backendBaseUrl: string, tableId: string): string {
  const url = new URL(
    `/api/table/${tableId}/connect?sessionId=${tableId}`,
    backendBaseUrl || window.location.origin,
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
