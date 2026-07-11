export interface Env {
  RESEND_API_KEY: string;
  FEEDBACK_EMAIL_FROM: string;
  FEEDBACK_EMAIL_TO: string;
}

const MAX_MESSAGE_LENGTH = 5000;
/** Max successful feedback posts per IP within the window. */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

function rateLimitCacheKey(ip: string): Request {
  return new Request(
    `https://pointy.website/__rate_limit/submit-feedback/${encodeURIComponent(ip)}`
  );
}

/**
 * Fixed-window limit via the Cache API (no KV binding required).
 * Returns false when the IP is over the limit.
 */
async function allowFeedbackRequest(request: Request): Promise<boolean> {
  const cache = caches.default;
  const key = rateLimitCacheKey(clientIp(request));
  const now = Date.now();

  let entry: RateLimitEntry = {
    count: 0,
    resetAt: now + RATE_LIMIT_WINDOW_MS,
  };

  const hit = await cache.match(key);
  if (hit) {
    try {
      const parsed = (await hit.json()) as Partial<RateLimitEntry>;
      if (
        typeof parsed.count === "number" &&
        typeof parsed.resetAt === "number" &&
        parsed.resetAt > now
      ) {
        entry = { count: parsed.count, resetAt: parsed.resetAt };
      }
    } catch {
      // treat as empty window
    }
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  const ttlSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  await cache.put(
    key,
    new Response(JSON.stringify(entry), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${ttlSec}`,
      },
    })
  );
  return true;
}

export async function onRequestPost(params: { request: Request; env: Env }) {
  try {
    if (!(await allowFeedbackRequest(params.request))) {
      return new Response("Too many feedback submissions. Try again later.", {
        status: 429,
        headers: { "Retry-After": "3600" },
      });
    }

    const data = await params.request.json();
    const customSubject = data.customSubject;
    const message = data.message;
    const contact = data.contact;
    const includeResumeRequest = data.includeResumeRequest;

    if (!message || typeof message !== "string" || message.trim().length < 4) {
      return new Response("Message too short", { status: 400 });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return new Response("Message too long", { status: 400 });
    }

    // If resume is requested but no contact info provided, return error
    if (includeResumeRequest && (!contact || contact.trim().length === 0)) {
      return new Response("Contact information required for resume request", {
        status: 400,
      });
    }

    let subject = customSubject || "New Website Feedback";
    if (includeResumeRequest) {
      subject += " - Resume Request";
    }

    const ip = clientIp(params.request);

    const emailBodyArray = [
      "Message:",
      message,
      "",
      "Contact Info:",
      contact || "Not provided",
      "",
      "IP:",
      ip,
    ];

    if (includeResumeRequest) {
      emailBodyArray.push("", "Resume Request: YES");
    }

    const emailBody = emailBodyArray.join("\n").trim();

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + params.env.RESEND_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: params.env.FEEDBACK_EMAIL_FROM,
          to: params.env.FEEDBACK_EMAIL_TO,
          subject: subject,
          text: emailBody,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        console.error("Resend error:", error);
        return new Response("Failed to send email", { status: 500 });
      }

      return new Response("Feedback received", { status: 200 });
    } catch (error) {
      console.error("Fetch error:", error);
      return new Response("Failed to send email", { status: 500 });
    }
  } catch (error) {
    console.error("JSON parse error:", error);
    return new Response("Invalid request", { status: 400 });
  }
}
