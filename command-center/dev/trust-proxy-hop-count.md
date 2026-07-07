# Trust Proxy Hop Count — Railway deployment

**Set in:** `apps/api/src/main.ts` as `app.set('trust proxy', 1)`

## Why 1

Railway terminates TLS at its edge (Nginx) proxy and injects one X-Forwarded-For hop. The client IP that Railway writes into XFF is the actual public client IP. The API server's raw socket peer is Railway's internal proxy IP, not the client.

With `trust proxy = 1`:
- Express resolves `req.ip` from the **last** XFF entry (hop 1 = the entry written by the Railway edge proxy).
- Any additional XFF entries a client inserts before that hop are ignored.
- `req.ip` is the Railway-validated client IP — not the socket peer, not a client-forged value.

## Why not `true`

`app.set('trust proxy', true)` trusts **all** hops in XFF. A client could add `X-Forwarded-For: 1.2.3.4` before the Railway proxy rewrites it, and Express would use `1.2.3.4` as `req.ip`. This would let attackers forge their source IP and get a fresh rate-limit bucket per request.

## Why not `false` (default)

With no trust proxy setting, Express ignores XFF entirely and `req.ip` is the raw socket peer — Railway's internal proxy IP. All requests would share the same rate-limit bucket, making per-IP limiting useless.

## Rate-limit middleware (SEC-3)

`apps/api/src/modules/auth/rate-limit.middleware.ts` reads `req.ip` (not `req.headers['x-forwarded-for']` directly). With `trust proxy = 1` set in `main.ts` before the middleware is registered, `req.ip` is the trust-proxy-resolved value.

**Deployment assumption:** Railway places exactly 1 proxy hop between the internet and the API. If the deployment topology changes (e.g., a load balancer is added in front of Railway), the hop count must be updated.

## Reference

- Express trust proxy docs: https://expressjs.com/en/guide/behind-proxies.html
- Wave: 25 | Task: 6fe232e3 | SEC-3
