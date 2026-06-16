# Tiny maintenance-page image for 9router deploys.
# Holds the host port during the rebuild/recreate gap and answers with a 503
# (JSON for API clients, HTML for browsers). Built once, reused every deploy.
FROM node:22-alpine

WORKDIR /app
COPY server.js ./server.js

ENV NODE_ENV=production
ENV PORT=20128
EXPOSE 20128

USER node
CMD ["node", "server.js"]
