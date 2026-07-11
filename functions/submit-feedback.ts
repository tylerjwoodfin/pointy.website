export interface Env {
  RESEND_API_KEY: string;
  FEEDBACK_EMAIL_FROM: string;
  FEEDBACK_EMAIL_TO: string;
}

export async function onRequestPost(params: { request: Request; env: Env }) {
  try {
    const data = await params.request.json();
    const customSubject = data.customSubject;
    const message = data.message;
    const contact = data.contact;
    const includeResumeRequest = data.includeResumeRequest;

    if (!message || message.length < 4) {
      return new Response("Message too short", { status: 400 });
    }

    // If resume is requested but no contact info provided, return error
    if (includeResumeRequest && (!contact || contact.trim().length === 0)) {
      return new Response("Contact information required for resume request", { status: 400 });
    }

    let subject = customSubject || "New Website Feedback";
    if (includeResumeRequest) {
      subject += " - Resume Request";
    }

    const clientIp = params.request.headers.get("CF-Connecting-IP") ?? "Unknown";

    const emailBodyArray = [
      "Message:",
      message,
      "",
      "Contact Info:",
      contact || "Not provided",
      "",
      "IP:",
      clientIp
    ];

    if (includeResumeRequest) {
      emailBodyArray.push("", "Resume Request: YES");
    }

    const emailBody = emailBodyArray.join("\n").trim();

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + params.env.RESEND_API_KEY,
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
