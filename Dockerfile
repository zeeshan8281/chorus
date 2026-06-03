# Image deployed into the Intel TDX enclave by the EigenCompute `ecloud` CLI.
# The CLI builds for linux/amd64 and records this image's digest in the
# attestation — clients verify that digest on the Verifiability Dashboard.

FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# EigenCompute injects SIGNER_PRIVATE_KEY/SIGNER_PUBLIC_KEY (from KMS, bound to
# this image digest), TDX_QUOTE, IMAGE_DIGEST, EIGEN_APP_ID, and DATABASE_URL.
EXPOSE 3000
CMD ["node", "dist/server.js"]
