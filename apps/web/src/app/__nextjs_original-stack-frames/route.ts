/** Development-tool compatibility shim.
 *
 * Next 14 serves the singular `/__nextjs_original-stack-frame` endpoint.
 * Some browser/devtool integrations still POST to the older/plural
 * `/__nextjs_original-stack-frames` path, which otherwise produces noisy
 * 404s and repeated dev-server work while localhost is open.
 */
function response() {
  return new Response(null, {
    status: process.env.NODE_ENV === "development" ? 204 : 404,
  });
}

export const GET = response;
export const POST = response;
