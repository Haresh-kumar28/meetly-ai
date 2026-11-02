import express from "express";
import { google } from "googleapis";

const router = express.Router();

// Temporary local-development token storage.
// Later we'll move this into MongoDB securely.
let googleTokens = null;

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Start Google OAuth
router.get("/google", (req, res) => {
  try {
    const oauth2Client = getOAuthClient();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/meetings.space.created",
      ],
    });

    res.redirect(authUrl);
  } catch (error) {
    console.error("OAuth start error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Google OAuth callback
router.get("/google/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code is missing.",
      });
    }

    const oauth2Client = getOAuthClient();

    const { tokens } = await oauth2Client.getToken(code);

    googleTokens = tokens;

    console.log("Google OAuth successful ✅");
    console.log("Google access token received:", !!tokens.access_token);

    res.json({
      success: true,
      message: "Google account connected successfully.",
      tokenReceived: !!tokens.access_token,
    });
  } catch (error) {
    console.error("Google OAuth error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Google authentication failed.",
    });
  }
});

// Create Google Meet
router.post("/google/meet", async (req, res) => {
  try {
    if (!googleTokens) {
      return res.status(401).json({
        success: false,
        message: "Google account is not connected.",
      });
    }

    const oauth2Client = getOAuthClient();

    oauth2Client.setCredentials(googleTokens);

    const accessToken = await oauth2Client.getAccessToken();

    const response = await fetch(
      "https://meet.googleapis.com/v2/spaces",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Google Meet API error:", data);

      return res.status(response.status).json({
        success: false,
        message: data.error?.message || "Failed to create Google Meet.",
        error: data,
      });
    }

    console.log("Google Meet created ✅");
    console.log("Meeting URL:", data.meetingUri);

    res.json({
      success: true,
      meetingUri: data.meetingUri,
      meetingName: data.name,
    });
  } catch (error) {
    console.error("Create Meet error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create Google Meet.",
    });
  }
});

export default router;