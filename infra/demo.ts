import {
  demoAdminToken,
  demoAllowedDestination,
  openAiApiKey,
  twilioAccountSid,
  twilioAuthToken,
  twilioFromNumber,
  tursoAuthToken,
  tursoDbUrl,
} from "./secrets";

/**
 * The unreleased sales voice demo runs as a single long-lived task. This is
 * intentionally separate from the Kit Lambda VPC: the voice bridge needs
 * outbound access to Twilio and OpenAI and a stable WebSocket endpoint.
 */
const voiceDomain = process.env.KITSTACK_DEMO_VOICE_DOMAIN?.trim();
const voicePublicHttpsUrl = voiceDomain ? `https://${voiceDomain}` : "";
const voicePublicWssUrl = voiceDomain ? `wss://${voiceDomain}/t/voice/media` : "";

export const demoVoiceCluster = new sst.aws.Cluster("DemoVoiceCluster", {
  vpc: new sst.aws.Vpc("DemoVoiceVpc", { az: 2 }),
});

export const demoVoice = new sst.aws.Service("DemoVoice", {
  cluster: demoVoiceCluster,
  architecture: "arm64",
  cpu: "0.5 vCPU",
  memory: "1 GB",
  image: {
    context: ".",
    dockerfile: "packages/demo/Dockerfile",
  },
  environment: {
    HOST: "0.0.0.0",
    PORT: "3001",
    KITSTACK_DEMO_MCP_AUTH: "app-token",
    KITSTACK_DEMO_DB_URL: tursoDbUrl.value,
    KITSTACK_DEMO_DB_AUTH_TOKEN: tursoAuthToken.value,
    KITSTACK_DEMO_PUBLIC_HTTPS_URL: voicePublicHttpsUrl,
    KITSTACK_DEMO_PUBLIC_WSS_URL: voicePublicWssUrl,
    KITSTACK_DEMO_ADMIN_TOKEN: demoAdminToken.value,
    KITSTACK_DEMO_ALLOWED_DESTINATION: demoAllowedDestination.value,
    TWILIO_ACCOUNT_SID: twilioAccountSid.value,
    TWILIO_AUTH_TOKEN: twilioAuthToken.value,
    TWILIO_FROM_NUMBER: twilioFromNumber.value,
    OPENAI_API_KEY: openAiApiKey.value,
    OPENAI_REALTIME_MODEL: process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime",
    OPENAI_REALTIME_VOICE: process.env.OPENAI_REALTIME_VOICE?.trim() || "marin",
  },
  loadBalancer: voiceDomain
    ? {
        domain: voiceDomain,
        rules: [
          { listen: "80/http", redirect: "443/https" },
          { listen: "443/https", forward: "3001/http" },
        ],
        health: {
          "3001/http": {
            path: "/healthz",
            interval: "10 seconds",
            healthyThreshold: 2,
            unhealthyThreshold: 3,
          },
        },
      }
    : {
        rules: [{ listen: "80/http", forward: "3001/http" }],
        health: {
          "3001/http": {
            path: "/healthz",
            interval: "10 seconds",
            healthyThreshold: 2,
            unhealthyThreshold: 3,
          },
        },
      },
  logging: {
    retention: "1 week",
  },
  scaling: {
    min: 1,
    max: 1,
  },
  dev: {
    url: "http://localhost:3001",
    command: "npm run demo:server",
    directory: ".",
    autostart: false,
  },
});

// The dashboard appends route paths itself; avoid producing `//api/...` when
// the SST service URL is a custom-domain HTTPS URL with a trailing slash.
export const demoVoiceUrl = demoVoice.url.apply((url) => url.replace(/\/$/, ""));
