/**
 * The sales voice demo (kits/debrief) runs as a Docker container on a
 * Hetzner box behind that box's Traefik, not on AWS: the ECS service, its
 * load balancer and its VPC cost about $55 a month for a proof of concept.
 * scripts/deploy-voice.sh builds and restarts it there; the box's Compose
 * project holds its environment (see kits/debrief/README.md).
 *
 * SST only owns the DNS records for the voice host and hands its URL to the
 * MCP router and the web app.
 */
const voiceDomain = process.env.KITSTACK_DEMO_VOICE_DOMAIN?.trim();
const voiceIpv4 = process.env.KITSTACK_DEMO_VOICE_IPV4?.trim();
const voiceIpv6 = process.env.KITSTACK_DEMO_VOICE_IPV6?.trim();

if (voiceDomain) {
  if (!voiceIpv4) throw new Error("KITSTACK_DEMO_VOICE_IPV4 must be set with KITSTACK_DEMO_VOICE_DOMAIN");
  const zone = aws.route53.getZoneOutput({ name: voiceDomain.split(".").slice(-2).join(".") });
  new aws.route53.Record("VoiceDnsA", {
    zoneId: zone.zoneId,
    name: voiceDomain,
    type: "A",
    ttl: 300,
    records: [voiceIpv4],
  });
  if (voiceIpv6) {
    new aws.route53.Record("VoiceDnsAaaa", {
      zoneId: zone.zoneId,
      name: voiceDomain,
      type: "AAAA",
      ttl: 300,
      records: [voiceIpv6],
    });
  }
}

// The dashboard appends route paths itself, so this has no trailing slash.
export const demoVoiceUrl = voiceDomain ? `https://${voiceDomain}` : "";
