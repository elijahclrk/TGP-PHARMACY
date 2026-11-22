FROM node:24-bookworm-slim AS frontend
WORKDIR /build/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:24-bookworm-slim AS dependencies
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=5000 PRODUCT_IMAGES_ENABLED=false
WORKDIR /app/server
COPY --from=dependencies --chown=node:node /build/server/node_modules ./node_modules
COPY --chown=node:node server/package.json ./package.json
COPY --chown=node:node server/src ./src
COPY --chown=node:node server/database/migrations/proposed/batch1/007_decision_workflows.sql server/database/migrations/proposed/batch1/008_return_dispositions.sql ./database/migrations/proposed/batch1/
COPY --chown=node:node server/database/migrations/proposed/batch13/012_local_product_exchanges.sql ./database/migrations/proposed/batch13/
COPY --chown=node:node server/database/migrations/proposed/batch7/010_in_app_notification_preferences.sql ./database/migrations/proposed/batch7/
COPY --chown=node:node server/database/migrations/proposed/batch14/013_operational_completion.sql ./database/migrations/proposed/batch14/
COPY --chown=node:node server/database/migrations/001_phase3_baseline.sql ./database/migrations/
COPY --chown=node:node server/database/migrations/proposed/002_supported_integrity.sql server/database/migrations/proposed/003_return_sale_item_link.sql server/database/migrations/proposed/004_lookup_indexes.sql ./database/migrations/proposed/
COPY --chown=node:node server/database/migrations/proposed/batch1/009_discount_financial_snapshots.sql ./database/migrations/proposed/batch1/
COPY --chown=node:node server/database/migrations/proposed/batch10/011_local_benefit_checkout.sql ./database/migrations/proposed/batch10/
COPY --from=frontend --chown=node:node /build/client/dist /app/client/dist
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
