import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { sendEmail } from "../lib/email.js";

export const supportRouter = Router();

const supportRequestSchema = z.object({
  subject: z.string().min(1),
  message: z.string().min(1),
  userEmail: z.string().email().optional(),
  userName: z.string().optional(),
});

// Support endpoint - can be called with or without authentication
supportRouter.post("/", async (req, res, next) => {
  try {
    const data = supportRequestSchema.parse(req.body);
    
    // Get user info from request body (sent from frontend) or from auth if available
    const userEmail = data.userEmail || "unknown@waterways.com";
    const userName = data.userName || "Unknown User";

    // Log the support request
    console.log("=== SUPPORT REQUEST ===");
    console.log("From:", userEmail);
    console.log("Name:", userName);
    console.log("Subject:", data.subject);
    console.log("Message:", data.message);
    console.log("======================");

    // Send email to andy@bigteds.nz
    try {
      const emailText = `Support Request from Waterways Platform

From: ${userName} (${userEmail})
Subject: ${data.subject}

Message:
${data.message}

---
This email was sent from the Waterways support form.`;

      await sendEmail({
        to: "andy@bigteds.nz",
        subject: `[Waterways Support] ${data.subject}`,
        text: emailText,
      });

      console.log("Support email sent to andy@bigteds.nz");
    } catch (emailError) {
      console.error("Failed to send support email:", emailError);
      // Don't fail the request if email fails - still log it
    }

    res.json({
      success: true,
      message: "Support request received. We'll get back to you soon.",
    });
  } catch (error) {
    next(error);
  }
});
