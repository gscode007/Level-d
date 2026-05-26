/**
 * OAuth 2.1 + MCP discovery metadata.
 *
 * Mounted at /.well-known/oauth-authorization-server (and /.well-known/oauth-protected-resource)
 * via vercel.json rewrites. claude.ai fetches this to discover where to register,
 * authorize, and exchange tokens.
 */

function originFrom(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  const origin = originFrom(req);
  const metadata = {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint:         `${origin}/api/oauth/token`,
    registration_endpoint:  `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported:    ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"], // PKCE-only public clients
    scopes_supported: ["mcp"],
    // For /.well-known/oauth-protected-resource consumers
    resource: origin,
    authorization_servers: [origin],
  };

  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).json(metadata);
}
