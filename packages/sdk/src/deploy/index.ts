/**
 * Deployment utilities for publishing kits to the KitStack platform.
 *
 * This module re-exports the three deployment steps that take a locally-built
 * kit and make it live:
 *
 * 1. **Upload** (`uploadKitBundle`) — push build artifacts to S3.
 * 2. **Registry seed** (`seedRegistry`) — upsert tool and view rows in the
 *    platform's Turso database so the McpRouter can discover them.
 * 3. **Lambda provision** (`provisionKitLambda`) — create or update a
 *    sandboxed Lambda for third-party kit execution.
 *
 * Typical usage is a deploy script run via `npx sst shell -- npx tsx deploy.ts`
 * that calls these three functions in sequence.
 *
 * @module
 *
 * @example
 * ```typescript
 * import {
 *   uploadKitBundle,
 *   seedRegistry,
 *   provisionKitLambda,
 * } from "@kitstack/sdk/deploy";
 * ```
 */
export { uploadKitBundle, type UploadOptions } from "./upload";
export { seedRegistry, type SeedRegistryOptions, type KitManifest } from "./seed-registry";
export { provisionKitLambda, type DeployLambdaOptions, type DeployLambdaResult } from "./deploy-lambda";
