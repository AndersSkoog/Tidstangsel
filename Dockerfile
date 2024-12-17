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

RUN mkdir -p /tidstangsel/assets tidstangsel/dist
COPY assets/ /tidstangsel/assets/
COPY dist/  /tidstangsel/dist/
COPY server.js /tidstangsel/server.js
COPY server_remotefile.js /tidstangsel/server_remotefile.js
COPY server_events.js /tidstangsel/server_events.js
COPY server_session.js /tidstangsel/server_session.js
COPY wav-decoder.js /tidstangsel/wav-decoder.js
WORKDIR tidstangsel
RUN bun install
CMD bun run start_prod
