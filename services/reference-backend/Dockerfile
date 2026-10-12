FROM node:22-alpine
WORKDIR /app
COPY services/reference-backend/ services/reference-backend/
COPY packages/contracts/ node_modules/@evander-webmcp/contracts/
USER node
EXPOSE 8180
CMD ["node", "services/reference-backend/server.mjs"]
