// Meetup OAuth2 — server-to-server signed-JWT flow.
// Docs: https://www.meetup.com/graphql/authentication/
//
// We sign a short-lived JWT with our private RSA key, exchange it at
// /oauth2/access for an access token, and return that. Tokens last an hour,
// so for a one-shot fetch we just request a fresh one each run.

import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";

const TOKEN_URL = "https://secure.meetup.com/oauth2/access";

function b64url(buf) {
  return Buffer.from(buf).toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt({ clientId, kid, memberId, privateKeyPem }) {
  const header = { alg: "RS256", typ: "JWT", kid };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(memberId),
    iss: clientId,
    aud: "api.meetup.com",
    exp: now + 120,
  };
  const head = b64url(JSON.stringify(header));
  const body = b64url(JSON.stringify(payload));
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${body}`);
  signer.end();
  const sig = b64url(signer.sign(privateKeyPem));
  return `${head}.${body}.${sig}`;
}

export async function getMeetupAccessToken(env) {
  const clientId = env.MEETUP_CLIENT_ID;
  const kid = env.MEETUP_SIGNING_KEY_ID;
  const memberId = env.MEETUP_MEMBER_ID;
  const keyPath = env.MEETUP_PRIVATE_KEY_PATH;

  const missing = [];
  if (!clientId) missing.push("MEETUP_CLIENT_ID");
  if (!kid) missing.push("MEETUP_SIGNING_KEY_ID");
  if (!memberId) missing.push("MEETUP_MEMBER_ID");
  if (!keyPath) missing.push("MEETUP_PRIVATE_KEY_PATH");
  if (missing.length) {
    const err = new Error(`Missing Meetup credentials: ${missing.join(", ")}`);
    err.code = "MEETUP_CREDS_MISSING";
    throw err;
  }

  const privateKeyPem = await readFile(keyPath, "utf8");
  const assertion = signJwt({ clientId, kid, memberId, privateKeyPem });

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meetup token exchange failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`Meetup token response missing access_token: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}
