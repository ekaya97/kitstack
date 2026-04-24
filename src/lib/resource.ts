/**
 * Lazy accessor for SST Resource bindings.
 *
 * Resource can't be imported at the top level because it breaks
 * builds that run outside SST context (next build, vitest, etc.).
 * Returns undefined for missing resources instead of throwing.
 */

let _resource: any = null;

function getResource(): any {
  if (!_resource) {
    try {
      _resource = require("sst").Resource;
    } catch {
      _resource = {};
    }
  }
  return _resource;
}

export function resource(name: string): any {
  try {
    return getResource()[name];
  } catch {
    return undefined;
  }
}
