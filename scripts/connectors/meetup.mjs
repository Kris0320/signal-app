// Meetup connector. For each curated London group urlname, fetch upcoming
// events via the Meetup GraphQL API and normalize them into the Signal
// events.json schema. IDs are namespaced "mu:<eventId>" so they don't collide
// with other sources or seed data.

import { getMeetupAccessToken } from "../lib/meetup-auth.mjs";
import { isoDurationToMinutes } from "../lib/duration.mjs";

const GQL_URL = "https://api.meetup.com/gql-ext";

const GROUP_EVENTS_QUERY = /* GraphQL */ `
  query GroupUpcomingEvents($urlname: String!, $first: Int!) {
    groupByUrlname(urlname: $urlname) {
      id
      name
      urlname
      city
      upcomingEvents(input: { first: $first }) {
        count
        edges {
          node {
            id
            title
            description
            dateTime
            duration
            eventUrl
            eventType
            venue { name city neighborhood }
            group { name urlname }
            topics { edges { node { name } } }
            feeSettings { amount currency }
          }
        }
      }
    }
  }
`;

async function gql(accessToken, query, variables) {
  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meetup GraphQL ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Meetup GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

function stripHtml(s) {
  return (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function summary(text, max = 280) {
  const clean = stripHtml(text);
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

function normalize(node, group) {
  const isOnline = (node.eventType || "").toLowerCase() === "online";
  const venueName = isOnline ? "Online" : (node.venue?.name || group?.name || "TBA");
  const area = isOnline
    ? "Online"
    : (node.venue?.neighborhood || node.venue?.city || "London");

  const topics = (node.topics?.edges || [])
    .map((e) => e?.node?.name)
    .filter(Boolean)
    .slice(0, 3);

  const price = typeof node.feeSettings?.amount === "number" ? node.feeSettings.amount : 0;

  return {
    id: `mu:${node.id}`,
    sourceEventId: node.id,
    title: node.title,
    desc: summary(node.description),
    source: "MU",
    date: node.dateTime,
    durationMin: isoDurationToMinutes(node.duration),
    venue: venueName,
    area,
    price,
    tags: topics.length ? topics : (group?.name ? [group.name] : []),
    format: isOnline ? "Online" : "In person",
    match: 75,
    url: node.eventUrl || null,
  };
}

export async function fetchMeetupEvents({ env, groups, perGroup = 10, log = console }) {
  if (!groups?.length) return { events: [], errors: [], skipped: true };

  let token;
  try {
    token = await getMeetupAccessToken(env);
  } catch (err) {
    if (err.code === "MEETUP_CREDS_MISSING") {
      log.warn(`[meetup] skipping — ${err.message}. See README.md → "Connecting Meetup".`);
      return { events: [], errors: [], skipped: true };
    }
    throw err;
  }

  const events = [];
  const errors = [];

  for (const g of groups) {
    const urlname = typeof g === "string" ? g : g.urlname;
    if (!urlname) continue;
    try {
      const data = await gql(token, GROUP_EVENTS_QUERY, { urlname, first: perGroup });
      const group = data?.groupByUrlname;
      if (!group) {
        errors.push({ urlname, error: "group not found" });
        continue;
      }
      const edges = group.upcomingEvents?.edges || [];
      for (const edge of edges) {
        if (!edge?.node) continue;
        events.push(normalize(edge.node, group));
      }
      log.info(`[meetup] ${urlname}: ${edges.length} upcoming`);
    } catch (err) {
      log.warn(`[meetup] ${urlname}: ${err.message}`);
      errors.push({ urlname, error: err.message });
    }
  }

  return { events, errors, skipped: false };
}
