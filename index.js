import Parser from "rss-parser";
import pkg from "@atproto/api";
const { BskyAgent } = pkg;

const FEED_URL = process.env.FEED_URL;
const BSKY_HANDLE = process.env.BSKY_HANDLE;
const BSKY_PASSWORD = process.env.BSKY_PASSWORD;

if (!FEED_URL || !BSKY_HANDLE || !BSKY_PASSWORD) {
  console.error("Missing environment variables");
  process.exit(1);
}

async function fetchFeed(url) {
  const parser = new Parser({
    requestOptions: {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    }
  });

  return parser.parseURL(url);
}

async function run() {
  console.log("Fetching RSS feed:", FEED_URL);

  const feed = await fetchFeed(FEED_URL);

  if (!feed.items.length) {
    console.log("No items found");
    return;
  }

  const latest = feed.items[0];
  const text = `${latest.title}\n${latest.link}`;

  const agent = new BskyAgent({ service: "https://bsky.social" });
  await agent.login({ identifier: BSKY_HANDLE, password: BSKY_PASSWORD });

  await agent.post({ text });

  console.log("Posted to Bluesky:", text);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
