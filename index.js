import Parser from "rss-parser";
import pkg from "@atproto/api";
const { BskyAgent } = pkg;
import fetch from "node-fetch";

const FEED_URLS = process.env.FEED_URLS;
const BSKY_HANDLE = process.env.BSKY_HANDLE;
const BSKY_PASSWORD = process.env.BSKY_PASSWORD;

if (!FEED_URLS || !BSKY_HANDLE || !BSKY_PASSWORD) {
  console.error("Missing environment variables");
  process.exit(1);
}

const parser = new Parser({
  timeout: 30000,
  requestOptions: {
    headers: {
      "User-Agent": "Mozilla/5.0 (GitHub Actions Bot)"
    }
  }
});

async function extractImage(item) {
  // 1. media:content
  if (item.enclosure?.url) return item.enclosure.url;
  if (item["media:content"]?.url) return item["media:content"].url;

  // 2. Try to extract <img> from content
  if (item.content) {
    const match = item.content.match(/<img[^>]+src="([^">]+)"/i);
    if (match) return match[1];
  }

  return null;
}

async function uploadImage(agent, url) {
  try {
    const res = await fetch(url);
    const buffer = Buffer.from(await res.arrayBuffer());

    const blob = await agent.uploadBlob(buffer, {
      encoding: "image/jpeg"
    });

    return blob.data.blob;
  } catch (err) {
    console.error("Image upload failed:", err);
    return null;
  }
}

async function postToBluesky(agent, title, link, imageUrl) {
  const text = `${title}\n${link}`;

  if (!imageUrl) {
    return agent.post({ text });
  }

  const blob = await uploadImage(agent, imageUrl);

  if (!blob) {
    return agent.post({ text });
  }

  return agent.post({
    text,
    embed: {
      $type: "app.bsky.embed.images",
      images: [
        {
          image: blob,
          alt: title
        }
      ]
    }
  });
}

async function run() {
  const feeds = FEED_URLS.split("\n").map(f => f.trim()).filter(Boolean);

  const agent = new BskyAgent({ service: "https://bsky.social" });
  await agent.login({ identifier: BSKY_HANDLE, password: BSKY_PASSWORD });

  for (const url of feeds) {
    try {
      console.log("Fetching:", url);
      const feed = await parser.parseURL(url);

      if (!feed.items.length) continue;

      const latest = feed.items[0];
      const imageUrl = await extractImage(latest);

      console.log("Posting:", latest.title, imageUrl ? "(with image)" : "(no image)");

      await postToBluesky(agent, latest.title, latest.link, imageUrl);

    } catch (err) {
      console.error("Error with feed:", url, err);
    }
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
