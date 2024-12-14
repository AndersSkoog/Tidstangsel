import {RemotePcmAll, RemotePcmRange, getRemoteWavInfo} from './server_remotefile';
import {isValidIP,notExpired,findByIp,validateSession,querySession,deleteSession,insertSession} from "./server_session";
//import serverEvents from "./server_events";
const audio_url                  = Bun.env.AUDIO_URL
const domain                     = "0.0.0.0";
const port                       = Bun.env.PORT;

function getClientIP(req){
    // Check x-forwarded-for header first
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
      console.log(forwarded);
      return forwarded.split(",")[0].trim();
    }
    else {
      console.log(req);
      return req.socket.remoteAddress;
    }
};

const test_pcm_info                = {
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
}

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
}

const pcm_info                   = Bun.env.NODE_ENV === "production" ? prod_pcm_info : test_pcm_info;
const pcm                        = Bun.env.NODE_ENV === "production" ? new RemotePcmAll(audio_url,prod_pcm_info) : new RemotePcmRange(audio_url,test_pcm_info);
let interval_id                  = null;
let cursor                       = 0;
let stream_client_count          = 0;

const security_headers = {
    //"Access-Control-Request-Method": "GET",
    "X-Download-Options":            "noopen",
    "X-XSS-Protection":              "0",
    "Referrer-Policy":               "same-origin",
    "X-Content-Type-Options":        "nosniff",
    "X-Frame":                       "deny",
    "Strict-Transport-Security":     "max-age=63072000; includeSubDomains",
    "Cross-Origin-Opener-Policy":    "same-origin",
    "Cross-Origin-Embedder-Policy":  "require-corp"
};

const defaultCSP = [
    "default-src 'self'",
    "object-src 'none'",
    "media-src 'self' blob:",
    "frame-ancestors 'none'",
    "form-action 'none'"
].join(";");

//const connect_src = process.env.NODE_ENV === "production" ? "connect-src 'self' wss://landsvagsteater.se/tidsstangsel/strean wss://landsvagsteater.up.railway.app/tidstangsel/stream" : "connect-src 'self' ws://localhost:9000/tidsstangsel/strean";

const maplibreCSP = [
    "default-src 'self' https://tile.openstreetmap.org",
    "img-src 'self' https://tile.openstreetmap.org data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "media-src 'self' blob:",
    "worker-src blob:",
    "child-src blob:",
    "script-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'"
].join(";");

const test_view = (nonce)=> `
<!doctype html>
<html lang="sv">
    <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" src="/style.css"/>
        <link rel="stylesheet" src="/maplibre-gl.css"/>
        <title>Tidsstängsel</title>
    </head>
    <body>
        <button id="playStreamBtn" class="hidden" style="display:none">spela ljudström</button>
        <div id="appcontainer">
          <div id="map"></div>
        </div>
        <script src="/maplibre-gl.js"></script>
        <script id="client_script_tag" data-nonce=${nonce} src="/client_test.js"></script>
    </body>
</html>
`;

const view = (nonce)=> `
<!doctype html>
<html lang="sv">
    <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" src="/style.css"/>
        <link rel="stylesheet" src="/maplibre-gl.css"/>
        <title>Tidsstängsel</title>
    </head>
    <body>
        <button id="playStreamBtn" class="hidden" style="display:none">spela ljudström</button>
        <div id="appcontainer">
          <div id="map"></div>
        </div>
        <script id="client_script_tag" data-nonce=${nonce} src="/client.js"></script>
    </body>
</html>
`;

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



const server = Bun.serve({
  port:port,
  hostname:domain,
  static: {
    "/verner_bostrom_sprite.png": new Response(await Bun.file("./assets/verner_bostrom_sprite.png").bytes(),{
      headers: {
        "Content-Type": "image/png"
      },
    }),
    "/static_map.png": new Response(await Bun.file("./assets/static_map.png").bytes(),{
      headers: {
        "Content-Type": "image/png"
      },
    }),
    "/style.css": new Response(await Bun.file("./assets/style.css").bytes(),{
      headers: {
        "Content-Type": "text/css",
      },
    }),
    "/maplibre-gl.css": new Response(await Bun.file("./assets/maplibre-gl.css").bytes(),{
      headers: {
        "Content-Type": "text/css",
      },
    }),
    "/client.js": new Response(await Bun.file("./dist/client_main.js").bytes(),{
      headers: {
        "Content-Type": "text/javascript",
      },
    }),
    "/client_test.js": Bun.env.NODE_ENV != "production" ? new Response(await Bun.file("./dist/client_test.js").bytes(),{
      headers: {
        "Content-Type": "text/javascript",
      },
    }) : new Response("Not found",{status:404})
  },
  async fetch(req, server) {
    const url = new URL(req.url);
    const ip = req.headers.get("x-forwarded-for") || this.requestIP(req).address;
    const ip_valid = isValidIP(ip);
    console.log("ip: ",ip,"ip_valid: ",ip_valid);
    const method = req.method;
    if(method !== "GET" || !ip_valid){
      return new Response("Forbidden",{status:403});
    }
    else {
      if(url.pathname === "/"){
        return new Response(test_view,{headers:{"Content-Type": "text/html","Content-Security-Policy": defaultCSP,...security_headers}});
      }
      if(url.pathname === "/tidstangsel"){
        let checkobj = findByIp(ip);     
        if(checkobj){
          return new Response(view(checkobj.nonce),{headers:{"Content-Type":"text/html","Content-Security-Policy":maplibreCSP,...security_headers}});
        }
        else {
          let nonce = Bun.randomUUIDv7();
          insertSession(ip,nonce);   
          return new Response(view(nonce),{headers:{"Content-Type":"text/html","Content-Security-Policy":maplibreCSP,...security_headers}});
        }
      }
      if(url.pathname === "/tidstangsel_test"){
        if(Bun.env.NODE_ENV != "production"){
          let checkobj = findByIp(ip);     
          if(checkobj){
            return new Response(test_view(checkobj.nonce),{headers:{"Content-Type":"text/html","Content-Security-Policy":maplibreCSP,...security_headers}});
          }
          else{
            let nonce = Bun.randomUUIDv7();
            insertSession(ip,nonce);
            return new Response(test_view(nonce),{headers:{"Content-Type":"text/html","Content-Security-Policy":maplibreCSP,...security_headers}})
          }
        }
        else return new Response("Not found!",{status:404});
      }
      if (url.pathname === "/tidstangsel/stream") {
        let nonce = url.searchParams.get("nonce");
        if (!nonce) {return new Response("Bad Request",{ status: 400 });}
        else {
          let isvalid = validateSession(ip,nonce);
          console.log(querySession(ip,nonce));
          if(isvalid){
            console.log(`Received nonce: ${nonce}`);
            const success = server.upgrade(req);
            return success ? undefined : new Response("internal server error", { status: 500 });
          }
          else {return new Response("UnAuthorized!",{ status: 401 });}    
        }
      }
      return new Response("Not Found!",{status:404});
    }
  },
  websocket: {
    open(ws) {
      console.log("WebSocket open handler called!");
      console.log(ws);
      if(pcm.isReady()){
        ws.send(JSON.stringify({message:"init_stream",sampleRate:pcm_info.sampleRate}));
        ws.subscribe("tidstangsel");
        stream_client_count += 1;
        console.log("client opened stream connection");
        if(!interval_id){startStream();}
      }
      else {
        ws.send(JSON.stringify({message:"not_ready"}));
      }
    }, // a socket is opened
    close(ws, code, message) {
      ws.unsubscribe("tidstangsel");
      stream_client_count -= 1;
      if(stream_client_count < 0){stream_client_count = 0}
      console.log(message);
    }, // a socket is closed
  },
});

function startStream(){
    if(pcm.isReady() && !interval_id){
        console.log("starting stream!");
        interval_id = setInterval(()=> {
            if(stream_client_count > 0){
              let chunk_data = pcm.getChunk(cursor);
              server.publish("tidstangsel",chunk_data);
            }
            cursor = (cursor + 1) % pcm_info.duration;
        }, 1000);
    }
}

function stopStream(){
    if(pcm.isReady() && interval_id){
      clearInterval(interval_id);
      interval_id = null;
      //cursor = 0;
    }
}
/*
serverEvents.once('pcm_download_finished', () => {
  console.log("starting stream!");
  console.log("listening on port: " + port);
  startStream();
});
*/
pcm.startDownload();
console.log("listening on port:", port);
