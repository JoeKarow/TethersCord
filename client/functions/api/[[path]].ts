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

  return fetch(new Request(targetUrl, request));
}
