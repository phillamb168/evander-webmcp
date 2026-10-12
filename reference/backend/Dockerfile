FROM node:22-alpine
WORKDIR /app
COPY reference/backend/ ./
USER node
EXPOSE 8180
CMD ["node", "server.mjs"]
