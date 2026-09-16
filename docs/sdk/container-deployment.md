# Kit container artifacts

`kitstack build` produces the complete deployable artifact for a kit. Kit
authors do not write or maintain Dockerfiles. The SDK generates the container
build context and the deployment file from the kit manifest.

## Build

Run this from a kit directory:

```bash
npx kitstack build
```

The output is written to `.kitstack/build/`:

| File | Purpose |
| --- | --- |
| `container/Containerfile` | Generated OCI/ Docker/ Podman build recipe |
| `container/runner.mjs` | Small HTTP host for the built kit handler |
| `container/package.json` | Production dependencies with the SDK version pinned |
| `container/kit.mjs` | SDK-built kit server bundle |
| `container/views/` and `container/shell.html` | Published View and shell assets |
| `kitstack.yaml` | One Compose-compatible deployment file |
| `artifact.json` | Version, file hashes, image, and optional signature |

The image reference defaults to `<kit-id>:<kit-version>`. Set an explicit
registry reference for a deployment:

```bash
npx kitstack build \
  --image ghcr.io/example/sales-debrief:0.1.0 \
  --base-image node:22-bookworm-slim@sha256:<approved-digest> \
  --sign-key ./secrets/artifact-signing-key
```

`--sign-key` signs the canonical artifact payload with HMAC-SHA256. The same
value can be supplied through `KITSTACK_SIGNING_KEY` in CI. Builds without a
key remain useful for local development but are explicitly reported as
unsigned and must not be promoted.

To build the image after generating the context, add `--container`:

```bash
npx kitstack build --container --image ghcr.io/example/sales-debrief:0.1.0
# or: npx kitstack build --container --engine podman
```

The generated image listens on port `3001`, exposes `GET /healthz`, and
accepts JSON kit invocations at `POST /invoke`. The runner supplies
`KITSTACK_DB_URL` and `KITSTACK_DB_TOKEN` from the environment when an
invocation does not include them.

## Local Compose

The generated file is self-contained relative to `.kitstack/build`:

```bash
cd .kitstack/build
docker compose -f kitstack.yaml up --build
```

Set `KITSTACK_DB_URL` and `KITSTACK_DB_TOKEN` in the operator environment (or
an environment file supported by Compose). The `x-kitstack` block records the
kit ID, version, artifact reference, and baseline Fargate/Kubernetes settings
without creating a second deployment description.

## Fargate and Kubernetes

Push the exact image reference from `kitstack.yaml`, then pass the same file
to the organization's deployment adapter. ECS/Fargate adapters use the
Compose service, port, image, healthcheck, and `x-kitstack.fargate` sizing;
Kubernetes adapters use the same service, image, port, healthcheck, and
`x-kitstack.kubernetes.replicas` value. The adapter may add organization
specific IAM, ingress, secrets, and storage bindings, but the kit author does
not edit SST or create another kit deployment file.

Before promotion, verify:

```bash
cat .kitstack/build/artifact.json
docker image inspect ghcr.io/example/sales-debrief:0.1.0
```

The image tag and kit version must match. Prefer an immutable registry digest
for the final deployment and retain `artifact.json` beside the release record.

## Operator-facing build check

The SDK test validates the generated context, deployment file, SDK pin, base
image pin, and signature without requiring a local container daemon:

```bash
npm test --workspace @kitstackco/sdk -- container-build.test.ts
```

The check is intentionally daemon-free so it can run in CI and on a release
operator's laptop before the image is pushed.
