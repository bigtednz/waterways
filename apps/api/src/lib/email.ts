import https from "https";
import http from "http";

/**
 * Send email using a webhook/HTTP service or SMTP
 * 
 * Option 1: Use EMAIL_WEBHOOK_URL (e.g., Zapier, Make.com, or custom webhook)
 * Option 2: Configure SMTP (requires SMTP_HOST, SMTP_USER, SMTP_PASS)
 * 
 * For production, recommended approach:
 * - Use a service like Resend, SendGrid, or Mailgun (via webhook)
 * - Or configure SMTP with a service like Gmail, SendGrid, etc.
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  from?: string;
}): Promise<void> {
  const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser || "noreply@waterways.com";

  // Option 1: Use webhook URL (simplest - works with Zapier, Make.com, etc.)
  if (webhookUrl) {
    try {
      const payload = {
        to: options.to,
        subject: options.subject,
        text: options.text,
        from: options.from || smtpFrom,
      };

      return new Promise((resolve, reject) => {
        const url = new URL(webhookUrl);
        const isHttps = url.protocol === "https:";
        const client = isHttps ? https : http;

        const postData = JSON.stringify(payload);
        const req = client.request(
          {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(postData),
            },
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => {
              data += chunk;
            });
            res.on("end", () => {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve();
              } else {
                reject(new Error(`Webhook returned ${res.statusCode}: ${data}`));
              }
            });
          }
        );

        req.on("error", reject);
        req.write(postData);
        req.end();
      });
    } catch (error) {
      console.error("Webhook email failed:", error);
      throw error;
    }
  }

  // Option 2: SMTP (if configured)
  if (smtpHost && smtpUser && smtpPass) {
    // For now, log that SMTP would be used
    // Full SMTP implementation would require TLS support which is complex without libraries
    console.warn("SMTP configuration detected but full SMTP implementation requires additional setup.");
    console.log("Email details:", {
      to: options.to,
      subject: options.subject,
      from: options.from || smtpFrom,
      text: options.text.substring(0, 100) + "...",
    });
    // In production, you would implement SMTP here or use a service
    return Promise.resolve();
  }

  // Fallback: Log email (for development)
  console.log("=== EMAIL (not configured - would send) ===");
  console.log("To:", options.to);
  console.log("From:", options.from || smtpFrom);
  console.log("Subject:", options.subject);
  console.log("Body:", options.text);
  console.log("===========================================");
  console.log("To enable email, configure one of:");
  console.log("  - EMAIL_WEBHOOK_URL (recommended - e.g., Zapier webhook)");
  console.log("  - SMTP_HOST, SMTP_USER, SMTP_PASS (requires SMTP implementation)");
}
