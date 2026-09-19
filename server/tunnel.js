// tunnel.js — expose the local server on a public URL via localtunnel.
// Run `npm start` in one terminal, then `npm run tunnel` in another.

import "dotenv/config";

const PORT = Number(process.env.PORT) || 3000;
const SUBDOMAIN = process.env.TUNNEL_SUBDOMAIN || undefined;

async function main() {
  let localtunnel;
  try {
    localtunnel = (await import("localtunnel")).default;
  } catch {
    console.error(
      "\n  localtunnel is not installed. Install it with:\n    npm install localtunnel\n" +
        "  Or use another tunnel such as ngrok / cloudflared pointing at port " +
        PORT +
        ".\n"
    );
    process.exit(1);
  }

  const tunnel = await localtunnel({ port: PORT, subdomain: SUBDOMAIN });
  console.log("\n  Public URL is live:");
  console.log(`    ${tunnel.url}`);
  console.log(
    "\n  Share this URL to use the voice chatbox from anywhere.\n" +
      "  Note: localtunnel may show an interstitial page the first time.\n" +
      "  Press Ctrl+C to stop.\n"
  );

  tunnel.on("close", () => {
    console.log("  Tunnel closed.");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Failed to start tunnel:", err.message);
  process.exit(1);
});
