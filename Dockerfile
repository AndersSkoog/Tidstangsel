FROM node:22-alpine
EXPOSE 3000
RUN mkdir tidstangsel
# Set environment variables
ENV NODE_ENV=production \
    BUN_INSTALL=/usr/local/bin/bun

# Install Bun
RUN apk add --no-cache curl \
    && curl -fsSL https://bun.sh/install | bash \
    && export PATH="/root/.bun/bin:$PATH"

COPY package.json /tidstangsel/package.json
COPY /dist/client.js /tidstangsel/client.js
COPY server_bun.js /tidstangsel/server_bun.js
COPY server_remotefile.js /tidstangsel/server_remotefile.js
COPY server_events.js /tidstangsel/server_events.js
COPY server_session.js /tidstangsel/server_session.js
COPY wav-decoder.js /tidstangsel/wav-decoder.js
COPY /assets /tidstangsel/assets
WORKDIR tidstangsel
RUN bun install
CMD bun run start_prod
