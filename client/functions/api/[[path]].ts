const backendOrigin = "https://tetherscord.tkshillinz.workers.dev";

type PagesRequestContext = {
  request: Request;
};

export async function onRequest({
  request,
}: PagesRequestContext): Promise<Response> {
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(
    incomingUrl.pathname + incomingUrl.search,
    backendOrigin,
  );

  // Pass the original Request straight through rather than rebuilding it with
  // `new Request(url, request)`. Reconstruction drops the WebSocket upgrade, so
  // the 101 response would come back without its `webSocket` and the game
  // socket could never connect through this proxy.
  return fetch(targetUrl, request);
}
