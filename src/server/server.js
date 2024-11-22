const redis         = require('redis');
const connect_redis = require('connect-redis');
const express       = require('express');
const session       = require('express-session');
const rateLimit     = require('express-rate-limit');
const crypto        = require('crypto');
const uuid          = require('uuid');
const path          = require('path');
const url           = require('url');
const rmfs          = require('./RemoteAudioFileStreamer.js');

let redisClient  = redis.createClient();
redisClient.connect().catch(console.error);
let redisStore   = new connect_redis.RedisStore({
    client:redisClient,
    prefix:"tidstangsel"
});


const app = express();
if(process.env.NODE_ENV === "production"){
    app.set('trust-proxy',true);
}
const assetsDir = process.env.NODE_ENV === "production" ? path.join(__dirname, "assets")  : path.join(__dirname,"../../assets");
const streamDir = process.env.NODE_ENV === "production" ? path.join(__dirname, "stream")  : path.join(__dirname,"../../stream");
const distDir   = process.env.NODE_ENV === "production" ? path.join(__dirname,   "dist")  : path.join(__dirname,"../../dist");
const tidstangsel_audio_file_dur = 15955;
const tidstangsel_audio_file_url = process.env.REMOTEAUDIOURL || "https://filebrowser-production-288f.up.railway.app/api/public/dl/Je--u-Rd/tidsstangsel.mp3";
const domain                     = process.env.HOST || "localhost";
const port                       = process.env.PORT || 3000; 
const sessionSecret              = process.env.SESSIONSECRET || crypto.randomBytes(32).toString('hex');
const tidstangsel_audio_streamer = new rmfs.RemoteAudioFileStreamer(
    tidstangsel_audio_file_url,
    tidstangsel_audio_file_dur,
    streamDir
);

let sessions_within_perim       = new Set();

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
    "form-action 'none'"].join(";");
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

//MIDLEWARE FUNCTIONS

function methodCheck(req, res, next) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    next();
}


function blockQuery(req, res, next) {
    if (process.env.NODE_ENV === "production") {
        if (Object.keys(req.query).length > 0 && !req.query.simpos) {
            return res.status(400).json({ error: 'Query parameters are not allowed in production' });
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

function applyCacheing(){
    return (req, res, next) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000'); 
        next();
    };    
}

function streamCacheHeaders(){
    return (req,res,next)=> {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        next();
    };
}


const defaultLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 10, // Limit each IP to 10 requests per `window` (here, per 5 minutes).
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false // Disable the `X-RateLimit-*` headers.
});


const session_opts = {
    "name":"tidstangsel_session",
    "store":redisStore,
    "secret":sessionSecret,
    "resave":false,
    "saveUninitialized":false,
    "cookie":{
        "cookieDomain":domain,
        "maxAge":((6 * 60) * 60) * 1000, //6 hours
        "httpOnly":true,
        "sameSite":'strict',
        "secure": process.env.NODE_ENV === 'production'
    }
}

app.use(session(session_opts));

function check_session(req, res, next){
    if(!req.session.tidstangsel){
        console.log('Someone is trying to request session protected route without a session. Security Alert!');
        return res.status(403).json({ message: 'reporting uninteded use' });
    }
    else {
        if(req.ip === req.session.tidstangsel.ip){
            next();
        }
        else {
            console.log('mismatch of IP detected. Security Alert!');
            return res.status(403).json({ message: 'reporting uninteded use' });
        }
    }
}

function validateSession(req, res, next) {
    if(req.session.tidstangsel){
        if(req.ip === req.session.tidstangsel.ip){
            next();
        }
        else {
            console.log('mismatch of IP detected. Security Alert!');
            return res.status(403).json({ message: 'reporting uninteded use' });
        } 
    }
    else {
        console.log('Someone is trying to request session protected route without a session. Security Alert!');
        return res.status(403).json({ message: 'reporting uninteded use' });
    }
}

function destroySession(req, res) {
    if(sessions_within_perim.size === 1){
        tidstangsel_audio_streamer.stop_stream();
        sessions_within_perim.delete(req.session.tidstangsel.nonce);
    }
    else {
        sessions_within_perim.delete(req.session.tidstangsel.nonce);
    }
    console.log("destroying session!");
    req.session.destroy(err => {
        if (err) {
            res.clearCookie('tidstangsel');
            return res.status(500).json({message: 'session error'});
        }
        res.clearCookie('tidstangsel');
        return res.status(403).json({ message: 'reporting unintended use' });
    });
}


function handlePerimEnter(req,res){
    if(sessions_within_perim.size === 0){
        tidstangsel_audio_streamer.start_stream();
        sessions_within_perim.add(req.session.tidstangsel.nonce);
        console.log("handle_first_one_to_enter");
        res.status(200).json({message:"ok"});
    }
    else {
        sessions_within_perim.add(req.session.tidstangsel.nonce);
        console.log("handle_not_first_one_to_enter");
        res.status(200).json({message:"ok"});
    }
}


function handlePerimExit(req, res){
    if(sessions_within_perim.size === 1){
        tidstangsel_audio_streamer.stop_stream();
        sessions_within_perim.delete(req.session.tidstangsel.nonce);
        res.status(200).json({message:"ok"});
    }
    else {
        sessions_within_perim.add(req.session.tidstangsel.nonce);
        res.status(200).json({message:"ok"});
    }
}

app.use(methodCheck);
app.use(blockQuery);
app.use('/assets', setSecurityHeaders(defaultCSP), express.static("/tidstangsel/assets"));
app.use('/dist', setSecurityHeaders(defaultCSP), express.static("/tidstangsel/dist"));
app.get("/",setSecurityHeaders(defaultCSP),defaultLimiter, (req, res)=> {
    res.setHeader("Content-Security-Policy", "default-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'none';");
    res.sendFile('index.html',{root:distDir});
});

app.get("/tidstangsel",setSecurityHeaders(maplibreCSP),(req, res)=> {
    let tidstangsel_html = (_nonce)=> {
        return `
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
              <script data-testid="tidstangsel_script" id="tidstangsel_script" type="module" data-nonce="${_nonce}" src="/dist/client.js"></script>
            </html>
        `;
    }

    if (!req.session.tidstangsel) {
        console.log("creating session!");
        let nonce = uuid.v4();
        req.session.tidstangsel = { ip: req.ip, nonce: nonce };  // Create session if not present
        res.setHeader("Content-Type", "text/html");
        res.status(200);
        res.send(tidstangsel_html(nonce));  // Send the HTML with the nonce
    } 
    else {
        if (req.session.tidstangsel.ip !== req.ip) {
            destroySession(req,res);
        } 
        else {
            const nonce = uuid.v4();
            req.session.tidstangsel.nonce = nonce;  // Only update the nonce
            res.setHeader("Content-Type", "text/html");
            res.send(tidstangsel_html(nonce));
        }
    }

});

const session_activate_limiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1hour
	limit: 5, // Limit each IP to 1 request per window.
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false // Disable the `X-RateLimit-*` headers.
});

const perim_transition_limiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1hour
	limit: 10, // Limit each IP to 5 requests per window.
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false // Disable the `X-RateLimit-*` headers.
});


app.get("/tidstangsel/activatesession/:token",validateSession,setSecurityHeaders(defaultCSP),(req, res)=> {
    req.session.tidstangsel.isactive = true;
    req.session.cookie.maxAge = (2 * 60) * 1000; //2 minutes expiration
    console.log("session activated!");
    return res.status(200).json({ message: 'Session activated' });
});

app.get("/tidstangsel/beacon/",validateSession,setSecurityHeaders(defaultCSP),(req, res) => {
    if(req.session.tidstangsel.isactive){
        req.session.touch();
        res.status(200).json({ message: 'Session updated' });
    }
    else {
        console.log('Someone is trying to request a route with an inactive session. Security Alert!');
        destroySession(req,res);
    }    
});


app.get("/tidstangsel/enter/",validateSession,setSecurityHeaders(defaultCSP),(req, res)=> {
    if(req.session.tidstangsel.isactive){
        handlePerimEnter(req,res);
    }
    else {
        console.log('Someone is trying to request a route with an inactive session. Security Alert!');
        destroySession(req,res);
    }    

});

app.get("/tidstangsel/exit/",validateSession,setSecurityHeaders(defaultCSP),(req, res)=> {
    if(req.session.tidstangsel.isactive){
        handlePerimExit(req, res);
    }
    else {
        console.log('Someone is trying to request a route with an inactive session. Security Alert!');
        destroySession(req,res);
    } 

});


app.use('/tidstangsel/stream',validateSession,setSecurityHeaders(defaultCSP),streamCacheHeaders,express.static('/tidstangsel/stream'));

app.get('/close-ffmpeg', (req, res) => {
    tidstangsel_audio_streamer.close_stream();
});



/*

app.get("/tidstangsel/stream/tidsstangsel.m3u8",validateSession,setSecurityHeaders(defaultCSP),(req, res)=> {
    if(req.session.tidstangsel.isactive){
        if(tidstangsel_audio_streamer.is_running()){
            res.setHeader("Content-Type","application/vnd.apple.mpegurl");
            res.status(200).sendFile('/home/ays/landsvagsteater/stream/tidsstangsel.m3u8');
        }
        else {
            res.status(404).send({message:"not availble"});
        }
    }
    else {
        console.log('Someone is trying to request a route with an inactive session. Security Alert!');
        destroySession(req,res);
    } 
});

app.get("/tidstangsel/stream/tidsstangsel.ts",validateSession,setSecurityHeaders(defaultCSP),(req, res)=> {
    if(req.session.tidstangsel.isactive){
        if(tidstangsel_audio_streamer.is_running()){
            res.setHeader("Content-Type","application/video/mp2t");
            res.status(200).sendFile('/home/ays/landsvagsteater/stream/tidsstangsel.ts');
        }
        else {
            res.status(404).send({message:"not availble"});
        }
    }
    else {
        console.log('Someone is trying to request a route with an inactive session. Security Alert!');
        destroySession(req,res);
    } 
});
*/


let server = app.listen(port, () => {
    console.log("Server is running on port:"+port);
});

server.keepAliveTimeout = 15 * 60 * 1000 // 15 minutes