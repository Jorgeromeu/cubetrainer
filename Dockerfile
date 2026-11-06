# The whole app as one container: the server (node:http + node:sqlite, no npm dependencies,
# .ts run directly) serving its API and the built web app. Works on any host that runs a
# container with a persistent disk; see openspec/specs/foundation/deployment.
#
#   docker build -t cubetrainer .
#   docker run -p 8080:8080 -v cubetrainer-data:/data -e AUTH_TOKEN=<long random> cubetrainer

# Build: install everything and build the app into app/dist.
FROM node:24-slim AS build
WORKDIR /repo
COPY . .
RUN npm ci && npm run build

# Run: only what the server needs at runtime (it imports no packages).
FROM node:24-slim
WORKDIR /repo
COPY --from=build /repo/package.json ./
COPY --from=build /repo/server ./server
COPY --from=build /repo/packages/core ./packages/core
COPY --from=build /repo/tools ./tools
COPY --from=build /repo/scripts/devenv.ts /repo/scripts/datasync.ts ./scripts/
COPY --from=build /repo/app/dist ./app/dist
RUN rm -rf tools/*/app tools/*/catalog/builder
ENV PORT=8080 DATA_DIR=/data NODE_ENV=production
VOLUME /data
EXPOSE 8080
HEALTHCHECK CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/_/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/main.ts"]
