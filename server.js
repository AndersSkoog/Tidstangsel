const os                = require('os');
const express           = require('express');
const {WebSocketServer} = require('ws');
const https             = require('node:https');
//const { Buffer }      = require('node:buffer');  
const { MPEGDecoder }   = require('mpg123-decoder');
const {serverEvents}    = require("./server_events");
//var LokiStore       = require('connect-loki')(session);
//const session       = require('express-session');
const rateLimit         = require('express-rate-limit'); //rate limiters can be applied for security counter meassures
//const crypto        = require('crypto');
//const uuid          = require('uuid');
// used to generate a unique nonce which must match the one in the session in order to activate the session,
// added to prevent bots and malicious activity
const path             = require('path');
const url              = require('url');
const {RemoteMp3}      = require('./server_broadcastfile');
const app = express();
const assetsDir = path.join(__dirname, "assets"); 
//const streamDir = path.join(__dirname, "stream");
const distDir   = path.join(__dirname,   "dist");
//const tidstangsel_audio_file_dur = 15955;
const tidstangsel_audio_file_url = "https://filebrowser-production-288f.up.railway.app/api/public/dl/Je--u-Rd/tidsstangsel.mp3";
const domain                     = process.env.NODE_ENV === "production" ? process.env.DOMAIN : "localhost";
const port                       = process.env.NODE_ENV === "production" ? process.env.PORT : 3000;
const wss = new WebSocketServer({
    port:9000,
    host:"0.0.0.0",
    path: '/stream',
    maxPayload: 256 * 1024, // 256kb max payload
});
const remoteMp3                  = new RemoteMp3(tidstangsel_audio_file_url);
let mp3Sr                        = null;
let mp3Dur                       = null;
let interval_id                  = null;
let cursor                       = 0;

function startStream(){
    if(remoteMp3.isReady() && !interval_id){
        console.log("starting stream!");
        interval_id = setInterval(()=> {
            if(remoteMp3.clients.size >= 1){
                let pcmdata = remoteMp3.getDecodedChunk(cursor); 
                wss.clients.forEach((client)=> {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(pcmdata);
                    }
                });
            }
            cursor = (cursor + 1) % (mp3Dur - 1);
        }, 1000);

    }
}

function stopStream(){
    if(remoteMp3.isReady() && interval_id){
      clearInterval(interval_id);
      interval_id = null;
      cursor = 0;
    }
}

serverEvents.on('download_finished', () => {
    mp3Dur = remoteMp3.getDur();
    mp3Sr  = remoteMp3.getSr();
    startStream();
});


wss.on('connection', (ws) => {
    console.log('A new client connected.');
    ws.on('close', () => {
        console.log('Client disconnected.');
    });
});


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

const maplibreCSP = [
    "default-src 'self' https://tile.openstreetmap.org",
    "img-src 'self' https://tile.openstreetmap.org data: blob:",
    "media-src 'self' blob:",
    "worker-src blob:",
    "child-src blob:",
    "script-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'"
].join(";");

const view = `
    <!doctype html>
    <html lang="sv">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <link rel="stylesheet" href="/assets/style.css"/>
            <link rel="stylesheet" href="/assets/maplibre-gl.css"/>
            <title>Tidsstängsel</title>
        </head>
        <body>
            <div id="map"></div>
        </body>
        <script data-testid="tidstangsel_script" id="tidstangsel_script" type="module" src="/dist/client.js"></script>
    </html>
`;


//MIDLEWARE
if(process.env.NODE_ENV === "production"){
    app.set('trust-proxy',true) //Should work when run behind a managed proxy like Google Cloud Run, Railway, Herouku
}
//Dont know if this is needed or not
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.protocol !== 'https') {
            return res.redirect('https://' + req.get('host') + req.url);
        }
        next();
    });
}

//Used to ensure that we only allow get requests on our domain
function methodCheck(req, res, next) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    next();
}

//As a security meassure we reject all requests that tries to pass query strings, since we dont need it in our app
function blockQuery(req, res, next) {
    if (process.env.NODE_ENV === "production") {
        if (Object.keys(req.query).length > 0 && !req.query.simpos) {
            return res.status(400).json({ error: 'Query parameters not allowed' });
        }
    }
    next();
}

function setSecurityHeaders(csp) {
    return (req, res, next) => {
        res.set(security_headers);  // Apply general security headers
        res.setHeader("Content-Security-Policy", csp);  // Set specific CSP
        next();
    };
}


const defaultLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 10, // Limit each IP to 10 requests per `window` (here, per 5 minutes).
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false // Disable the `X-RateLimit-*` headers.
});


app.use(methodCheck);
app.use(blockQuery);
app.use('/assets', setSecurityHeaders(defaultCSP), express.static("./assets"));
app.use('/dist', setSecurityHeaders(defaultCSP), express.static("./dist"));
app.get("/",setSecurityHeaders(defaultCSP),(req, res)=> {
    res.setHeader("Content-Type","text/html");
    res.sendFile('index.html',{root:distDir});
});

app.get("/tidsstangsel",setSecurityHeaders(maplibreCSP),(req, res)=> {
    res.setHeader("Content-Type","text/html");
    res.send(view);
});

app.listen(port,'0.0.0.0', () => {
    console.log("Server is listening on port:"+port);
});

//server.keepAliveTimeout = 15 * 60 * 1000 // 15 minutes
