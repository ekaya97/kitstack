FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

# npm workspaces validates all workspace manifests while installing. Copy
# manifests first so dependency installation remains cacheable.
COPY package.json package-lock.json ./
COPY web/package.json web/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/mcp-server/package.json packages/mcp-server/package.json
COPY packages/authz/package.json packages/authz/package.json
COPY kits/debrief/package.json kits/debrief/package.json
RUN npm ci --omit=dev --ignore-scripts

# The demo executes TypeScript directly through the SDK's tsx dependency and
# imports the published SDK dist files from the workspace package.
COPY packages/sdk packages/sdk
COPY kits/debrief kits/debrief

EXPOSE 3001
CMD ["npm", "run", "start", "--workspace", "@kitstackco/debrief-kit"]
