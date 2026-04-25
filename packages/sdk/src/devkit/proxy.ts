/**
 * Generate the mock sandbox proxy HTML for the View DevKit.
 *
 * In production, Claude.ai's sandbox proxy sits between the host page and the
 * app shell (inner iframe). The proxy:
 * 1. Sends `sandbox-proxy-ready` to the inner iframe
 * 2. Receives `sandbox-resource-ready` with the shell HTML
 * 3. Writes the HTML into the inner iframe via `srcdoc`
 * 4. Forwards all subsequent postMessages between inner iframe and host
 *
 * This mock replicates that behavior locally, ensuring views behave
 * identically to production. The double-iframe structure catches issues
 * that wouldn't surface with a single iframe (e.g., `sandbox-resource-ready`
 * sending back the full HTML, origin restrictions, message forwarding).
 *
 * @returns HTML string to use as `srcdoc` of the outer proxy iframe
 *
 * @example
 * ```typescript
 * import { generateProxyHtml } from "@kitstack/sdk/devkit";
 *
 * // Create the double-iframe structure in the DevKit viewport
 * const outer = document.createElement("iframe");
 * outer.sandbox = "allow-scripts allow-same-origin";
 * outer.srcdoc = generateProxyHtml();
 * document.getElementById("viewport").appendChild(outer);
 * ```
 */
export function generateProxyHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; }
  body { overflow: hidden; }
  iframe { width: 100%; border: none; }
</style>
</head>
<body>
<iframe id="inner" sandbox="allow-scripts allow-same-origin"></iframe>
<script>
(function() {
  const inner = document.getElementById("inner");
  let innerReady = false;

  // Listen for messages from the host page (parent)
  window.addEventListener("message", function(event) {
    // If the host sends shell HTML via sandbox-resource-ready flow,
    // write it into the inner iframe
    if (event.data && event.data.method === "ui/notifications/tool-result") {
      // Forward tool-result to inner iframe once it's ready
      if (innerReady && inner.contentWindow) {
        inner.contentWindow.postMessage(event.data, "*");
      }
      return;
    }

    // Forward all other host messages to the inner iframe
    if (event.source === window.parent && innerReady && inner.contentWindow) {
      inner.contentWindow.postMessage(event.data, "*");
    }
  });

  // Listen for messages from the inner iframe
  inner.addEventListener("load", function() {
    innerReady = true;

    // Send sandbox-proxy-ready to the inner iframe
    inner.contentWindow.postMessage({
      jsonrpc: "2.0",
      method: "ui/notifications/sandbox-proxy-ready"
    }, "*");
  });

  // Handle messages from the inner iframe
  window.addEventListener("message", function(event) {
    if (event.source !== inner.contentWindow) return;

    var msg = event.data;
    if (!msg) return;

    // Intercept sandbox-resource-ready: write shell HTML into inner iframe
    if (msg.method === "ui/notifications/sandbox-resource-ready" && msg.params && msg.params.html) {
      inner.srcdoc = msg.params.html;
      return;
    }

    // Forward everything else to the host page (parent)
    window.parent.postMessage(msg, "*");
  });

  // Resize inner iframe to match content
  function syncHeight() {
    if (inner.contentDocument && inner.contentDocument.body) {
      var h = inner.contentDocument.body.scrollHeight;
      if (h > 0) inner.style.height = h + "px";
    }
    requestAnimationFrame(syncHeight);
  }
  syncHeight();
})();
</script>
</body>
</html>`;
}
