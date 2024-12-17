import {
  RemotePcmAll,
  RemotePcmRange,
  getRemoteWavInfo,
} from "./server_remotefile";
import {
  isValidIP,
  notExpired,
  findByIp,
  validateSession,
  querySession,
  deleteSession,
  insertSession,
} from "./server_session";
const productionMode = Bun.env.NODE_ENV === "production";
const useCsp = Bun.env.USE_CSP === "true";
const audio_url = Bun.env.AUDIO_URL;
const host = Bun.env.HOST;
const port = Bun.env.PORT;
const gen_uuid = () => Bun.randomUUIDv7();
//let script_hash = null;
const tidstangsel_headers = (script_nonce, worker_nonce) => {
  //if(!script_hash){script_hash = await Bun.file("./dist/client_hash.txt").text();}
  /*
  let csp_val = [
    "default-src 'self' https://tile.openstreetmap.org",
    "img-src 'self' https://tile.openstreetmap.org data: blob:",
    `script-src 'nonce-${script_nonce}'`,
    "worker-src blob:",
    "child-src blob:",
    "style-src 'self' 'unsafe-inline'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "strict-dynamic"
  ].join("; ");
  */
  let csp_val = [
    "default-src 'self' https://tile.openstreetmap.org",
    "img-src 'self' https://tile.openstreetmap.org data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "worker-src blob:",
    "child-src blob:",
    "script-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
  ].join("; ");
  //console.log(csp_val);
  return new Headers([
    ["Content-Type", "text/html"],
    ["X-Download-Options", "noopen"],
    ["X-XSS-Protection", "0"],
    ["Referrer-Policy", "same-origin"],
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame", "deny"],
    ["Strict-Transport-Security", "max-age=63072000; includeSubDomains"],
    ["Cross-Origin-Opener-Policy", "same-origin"],
    ["Cross-Origin-Embedder-Policy", "require-corp"],
    ["Content-Security-Policy", csp_val],
  ]);
};
const tidstangsel_view = (script_nonce, socket_nonce) => {
  //if(!script_hash){script_hash = await Bun.file("./dist/client_hash.txt").text();}
  return `
  <!doctype html>
  <html lang="sv">
    <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" src="/maplibre-gl.css"/>
        <link rel="stylesheet" src="/style.css"/>
        <title>Tidsstängsel</title>
    </head>
    <body>
        <div id="appcontainer">
          <div id="map"></div>
        </div>
        <script src="/maplibre-gl.js"></script>
        <script data-socketnonce="${socket_nonce}" id="client_script_tag" nonce="${script_nonce}" src="/client.js"></script>
    </body>
  </html>`;
};
const index_headers = new Headers([
  ["Content-Type", "text/html"],
  ["X-Download-Options", "noopen"],
  ["X-XSS-Protection", "0"],
  ["Referrer-Policy", "same-origin"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame", "deny"],
  ["Strict-Transport-Security", "max-age=63072000; includeSubDomains"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["Cross-Origin-Embedder-Policy", "require-corp"],
  [
    "Content-Security-Policy",
    "default-src 'none' form-action 'none'; frame-ancestors 'none'; object-src 'none'; script-src 'none';",
  ],
]);

const index_view = `
<!doctype html>
<html lang="se">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Landsvägsteater</title>
  </head>
  <body>
    <p>Välkommen till Landsvägsteater, ett nytt projekt skapat av <a href="https://institutet.eu">insitutet</a></p>
    <p>Informationen här kommer att uppdateras</p>
  </body>
</html>
`;
//tidstangsel_headers(gen_uuid()).then((res)=> console.log(res));

function getClientIP(req) {
  // Check x-forwarded-for header first
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    console.log(forwarded);
    return forwarded.split(",")[0].trim();
  } else {
    console.log(req);
    return req.socket.remoteAddress;
  }
}

const test_pcm_info = {
  startIndex: 258,
  orgDatasize: 3770311028,
  rifftag: "RIFF",
  wavetag: "WAVE",
  datatag: "LIST",
  channels: 1,
  sampleRate: 44100,
  bytesPerSec: 88200,
  bytesPerSample: 2,
  bitDepth: 16,
  dataSize: 88200 * 64,
  chunkSize: 88200,
  padSize: 0,
  chunkDur: 1,
  duration: 64,
  totalChunks: 64,
  playBufSize: 88200,
};

const prod_pcm_info = {
  startIndex: 258,
  orgDatasize: 3770311028,
  rifftag: "RIFF",
  wavetag: "WAVE",
  datatag: "LIST",
  channels: 1,
  sampleRate: 44100,
  bytesPerSec: 88200,
  bytesPerSample: 2,
  bitDepth: 16,
  dataSize: 3770373600,
  chunkSize: 88200,
  padSize: 62572,
  chunkDur: 1,
  duration: 42748,
  totalChunks: 42748,
  playBufSize: 88200,
};

const pcm_info = Bun.env.AUDIO_FULL === "true" ? prod_pcm_info : test_pcm_info;
const pcm =
  Bun.env.AUDIO_FULL === "true"
    ? new RemotePcmAll(audio_url, prod_pcm_info)
    : new RemotePcmRange(audio_url, test_pcm_info);
let interval_id = null;
let cursor = 0;
let stream_client_count = 0;

const server = Bun.serve({
  port: port,
  hostname: host,
  static: {
    "/verner_bostrom.png": new Response(
      await Bun.file("./assets/verner_bostrom.png").bytes(),
      {
        headers: {
          "Content-Type": "image/png",
          "X-Content-Type-Options": "nosniff",
        },
      },
    ),
    "/static_map.png": new Response(
      await Bun.file("./assets/static_map.png").bytes(),
      {
        headers: {
          "Content-Type": "image/png",
          "X-Content-Type-Options": "nosniff",
        },
      },
    ),
    "/style.css": new Response(await Bun.file("./assets/style.css").bytes(), {
      headers: {
        "Content-Type": "text/css",
        "X-Content-Type-Options": "nosniff",
      },
    }),
    "/maplibre-gl.css": new Response(
      await Bun.file("./assets/maplibre-gl.css").bytes(),
      {
        headers: {
          "Content-Type": "text/css",
          "X-Content-Type-Options": "nosniff",
        },
      },
    ),
    "/client.js": new Response(
      await Bun.file("./dist/client_bundle.js").bytes(),
      {
        headers: {
          "Content-Type": "text/javascript",
          "X-Content-Type-Options": "nosniff",
        },
      },
    ),
    "/maplibre-gl.js": new Response(
      await Bun.file("./assets/maplibre-gl.js").bytes(),
      {
        headers: {
          "Content-Type": "text/javascript",
          "X-Content-Type-Options": "nosniff",
        },
      },
    ),
  },
  fetch(req, server) {
    const url = new URL(req.url);
    const ip =
      req.headers.get("x-forwarded-for") || this.requestIP(req).address;
    const ip_valid = isValidIP(ip);
    //console.log("ip: ",ip,"ip_valid: ",ip_valid);
    const method = req.method;
    //only allow http get requests on our server
    if (method !== "GET" || !ip_valid) {
      return new Response("Forbidden", { status: 403 });
    } else {
      if (url.pathname === "/") {
        return new Response(index_view, { headers: index_headers });
      }
      if (url.pathname === "/tidstangsel") {
        let script_nonce = gen_uuid();
        let worker_nonce = gen_uuid();
        let socket_nonce = null;
        let checkobj = findByIp(ip);
        if (checkobj) {
          socket_nonce = checkobj.nonce;
          //console.log("socket_nonce",socket_nonce);
          //console.log("script_nonce",script_nonce);
          let _headers = tidstangsel_headers(script_nonce);
          let _view = tidstangsel_view(script_nonce, socket_nonce);
          //console.log("headers",_headers);
          //console.log("view",_view);
          return new Response(_view, { headers: _headers });
        } else {
          socket_nonce = gen_uuid();
          insertSession(ip, socket_nonce);
          let _headers = tidstangsel_headers(script_nonce);
          let _view = tidstangsel_view(script_nonce, socket_nonce);
          //console.log("headers",_headers);
          //console.log("view",_view);
          return new Response(_view, { headers: _headers });
        }
      }
      if (url.pathname === "/tidstangsel/stream") {
        let nonce = url.searchParams.get("nonce");
        if (!nonce) {
          return new Response("Bad Request", { status: 400 });
        } else {
          let isvalid = validateSession(ip, nonce);
          console.log(querySession(ip, nonce));
          if (isvalid) {
            //when a websocket connection has been authorized we the unique nonce token that can only be used once,
            //we should delete the session in the database!
            //this way we only allow a single connection for each ip,
            //if the connection is closed. a user has to reload the page to get a new nonce to be able to reconnect.
            //we do this in order to protect our socket so that no one can connect to it outside of our control.
            deleteSession(ip);
            //console.log(`Received nonce: ${nonce}`);
            const success = server.upgrade(req);
            return success
              ? undefined
              : new Response("internal server error", { status: 500 });
          } else {
            return new Response("UnAuthorized!", { status: 401 });
          }
        }
      }
      return new Response("Not Found!", { status: 404 });
    }
  },
  websocket: {
    open(ws) {
      //console.log("WebSocket open handler called!");
      //console.log(ws);
      if (pcm.isReady()) {
        ws.send(
          JSON.stringify({
            message: "init_stream",
            sampleRate: pcm_info.sampleRate,
          }),
        );
        ws.subscribe("tidstangsel");
        stream_client_count += 1;
        //console.log("client opened stream connection");
        if (!interval_id) {
          startStream();
        }
      } else {
        ws.send(JSON.stringify({ message: "not_ready" }));
      }
    }, // a socket is opened
    close(ws, code, message) {
      ws.unsubscribe("tidstangsel");
      stream_client_count -= 1;
      if (stream_client_count < 0) {
        stream_client_count = 0;
      }
      //console.log(message);
    }, // a socket is closed
  },
});

function startStream() {
  if (pcm.isReady() && !interval_id) {
    //console.log("starting stream!");
    interval_id = setInterval(() => {
      if (stream_client_count > 0) {
        let chunk_data = pcm.getChunk(cursor);
        server.publish("tidstangsel", chunk_data);
      }
      cursor = (cursor + 1) % pcm_info.duration;
    }, 1000);
  }
}

function stopStream() {
  if (pcm.isReady() && interval_id) {
    clearInterval(interval_id);
    interval_id = null;
    //cursor = 0;
  }
}
pcm.startDownload();
console.log("listening on port:", port);

/*
serverEvents.once('pcm_download_finished', () => {
  console.log("starting stream!");
  console.log("listening on port: " + port);
  startStream();
});
*/
