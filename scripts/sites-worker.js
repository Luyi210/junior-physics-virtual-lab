const withSpaFallback = async (request, assets) => {
  const response = await assets.fetch(request);
  if (response.status !== 404 || request.method !== "GET") return response;

  const url = new URL(request.url);
  url.pathname = "/index.html";
  return assets.fetch(new Request(url, request));
};

export default {
  async fetch(request, environment) {
    if (!environment.ASSETS?.fetch) {
      return new Response("Physics Lab assets are not available.", { status: 503 });
    }
    return withSpaFallback(request, environment.ASSETS);
  }
};
