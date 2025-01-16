/*
This is the code that is currently deployed, decided to make the client code contained in one file,
Exploring an idea for generating this code from a json file, so that we easly can create geofence auido broadcast client applications.
*/
import * as maplibregl from "./lib/maplibre-gl.js";
import Hls from "./lib/hls.js";
const LAT_CONVERSION = 111.32;
const earthRadius = 63710088e-1;
const factors = {
    centimeters: earthRadius * 100,
    centimetres: earthRadius * 100,
    degrees: 360 / (2 * Math.PI),
    feet: earthRadius * 3.28084,
    inches: earthRadius * 39.37,
    kilometers: earthRadius / 1e3,
    kilometres: earthRadius / 1e3,
    meters: earthRadius,
    metres: earthRadius,
    miles: earthRadius / 1609.344,
    millimeters: earthRadius * 1e3,
    millimetres: earthRadius * 1e3,
    nauticalmiles: earthRadius / 1852,
    radians: 1,
    yards: earthRadius * 1.0936,
};
const areaFactors = {
    acres: 247105e-9,
    centimeters: 1e4,
    centimetres: 1e4,
    feet: 10.763910417,
    hectares: 1e-4,
    inches: 1550.003100006,
    kilometers: 1e-6,
    kilometres: 1e-6,
    meters: 1,
    metres: 1,
    miles: 386e-9,
    nauticalmiles: 29155334959812285e-23,
    millimeters: 1e6,
    millimetres: 1e6,
    yards: 1.195990046,
};
function radiansToLength(radians, units = "kilometers") {
    const factor = factors[units];
    if (!factor) {
        throw new Error(units + " units is invalid");
    }
    return radians * factor;
}
function lengthToRadians(distance, units = "kilometers") {
    const factor = factors[units];
    if (!factor) {
        throw new Error(units + " units is invalid");
    }
    return distance / factor;
}
function lengthToDegrees(distance, units) {
    return radiansToDegrees(lengthToRadians(distance, units));
}
function bearingToAzimuth(bearing) {
    let angle = bearing % 360;
    if (angle < 0) {
        angle += 360;
    }
    return angle;
}
function azimuthToBearing(angle) {
    angle = angle % 360;
    if (angle > 0) return angle > 180 ? angle - 360 : angle;
    return angle < -180 ? angle + 360 : angle;
}
function radiansToDegrees(radians) {
    const degrees = radians % (2 * Math.PI);
    return (degrees * 180) / Math.PI;
}
function degreesToRadians(degrees) {
    const radians = degrees % 360;
    return (radians * Math.PI) / 180;
}
function getSquareCorners(center,distanceKm){
    const centerLon = center[0];
    const centerLat = center[1];
    const deltaLat = distanceKm / LAT_CONVERSION;
    const deltaLon =
        distanceKm / (LAT_CONVERSION * Math.cos((centerLat * Math.PI) / 180));
    const topLeft = [centerLon - deltaLon, centerLat + deltaLat]; // North-West
    const topRight = [
        centerLon + deltaLon,
        centerLat + deltaLat,
    ]; // North-East
    const bottomLeft = [
        centerLon - deltaLon,
        centerLat - deltaLat,
    ]; // South-West
    const bottomRight = [
        centerLon + deltaLon,
        centerLat - deltaLat,
    ]; // South-East
    return [topLeft, topRight, bottomRight, bottomLeft];
}
function pointInPolygon(point, polygon){
    let intersection_count = 0;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let [lng1, lat1] = polygon[i];
        let [lng2, lat2] = polygon[j];
        let [lng, lat] = point;
        let intersect =
            lat1 > lat !== lat2 > lat &&
            lng < ((lng2 - lng1) * (lat - lat1)) / (lat2 - lat1) + lng1;
        if (intersect) {
            intersection_count += 1;
        }
    }
    return intersection_count % 2 === 1;
}
function pointInBbox(point,bbox) {
    const [lng, lat] = point;
    const [minLng, minLat, maxLng, maxLat] = bbox;
    return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}
function distanceKm(from, to) {
    let dLat = degreesToRadians(to[1] - from[1]);
    let dLon = degreesToRadians(to[0] - from[0]);
    let lat1 = degreesToRadians(from[1]);
    let lat2 = degreesToRadians(to[1]);
    let a = Math.pow(Math.sin(dLat / 2), 2) + Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);
    return radiansToLength(2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),"kilometers");
}
const constants = { 
    map_bounds:[22.692261, 65.739656, 24.329224, 66.438715],      
    map_center:[23.507996, 66.083241],       
    map_perim:[
        [23.525427575932326, 66.0903488585733],
        [23.42668791159693, 66.06844236664259],
        [23.47140021242788, 66.00450362832879],
        [23.432276949200798, 65.95824681364806],
        [23.468605693625392, 65.83842512404459],
        [23.66422200976305, 65.83232398441024],
        [23.887783513920027, 65.79912368543009],
        [24.08619434886012, 65.8044691547079],
        [24.19704359467036, 65.82545847133909],
        [24.190523050799385, 65.8868015859372],
        [24.03030397282032, 66.06239587288295],
        [23.852386275762512, 66.04538240012698],
        [23.593427533447, 66.05256725398294],
        [23.525467719592257, 66.09034391453025],
        [23.525427575932326, 66.0903488585733]
    ],
    map_perim_center:[23.798001194926712, 65.94792047215071],
    map_defaultzoom:8,   
    map_maxzoom:16,       
    map_minzoom:8,
    perim_entermsg:"Du inom tidstangslet tryck på knappen för att lyssna",
    perim_exitmsg:"Du inom tidstangslet ljudström stängs",
    outofboundsmessage:"Du befinner dig för långt bortom tidstängslet! ladda om sidan när du befinner på kartan!",
    image_url:"/verner_bostrom.png",
    static_map_url:"/static_map.png"                 
}
const mapstyle = {
    version: 8,
    sources: {
        //this is the source for the openstreedmap raster maptiles.
        osm: {
            bounds: constants.map_bounds,
            minzoom: constants.map_minzoom,
            maxzoom: constants.map_maxzoom,
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap Contributors",
        },
        //this is source for the geojson polygon overlay that draws the perimeter on the map. 
        perim: {
            type: "geojson",
            data: {
                type: "Feature",
                properties: {},
                geometry: {
                    type: "Polygon",
                    coordinates: [constants.map_perim],
                },
            },
        },
        //this is source for the image of verner boström inside drawn inside the perimeter on the map. 
        verner: {
            type: "image",
            url: constants.image_url,
            coordinates: getSquareCorners(constants.map_perim_center, 10),
        },
    },
    //to mkae maplibre render something you first define a source and then a layer that has a reference to a source you have defined  
    layers: [
        {
            id: "osm",
            source: "osm",
            type: "raster",
        },
        {
            id: "pgon",
            source: "perim",
            type: "fill",
            paint: {
                "fill-color": "blue",
                "fill-opacity": 0.2,
            },
        },
        {
            id: "verner",
            source: "verner",
            type: "raster",
            paint: {
                "raster-opacity": 0.3,
            },
        },
    ]
};
const maplibre_bounds = [[constants.map_bounds[0],constants.map_bounds[1]],[constants.map_bounds[2],constants.map_bounds[3]]];
const mapopts = {
    center: constants.map_center,
    container: "map",
    maxBounds: maplibre_bounds,
    dragPan: true,
    dragRotate: false,
    pitchWithRotate: false,
    touchZoomRotate: true,
    trackResize: false,
    touchPitch: false,
    keyboard: false,
    attributionControl: { compact: true },
    style:mapstyle
};
let canvas = null;
let canvascontainer = null;
let markercontainer = null;
let container = null;
let glmap = null;
let locmarker = null;
let geotracker = null;
let initialized = false;
let prev_pos = null;
let prev_pos_within_perim = false;
const audioPlayer = new Audio();
audioPlayer.controls = false;
audioPlayer.hidden = true;
audioPlayer.autoplay = false;
const backend = Hls.isSupported() ? "hls" : (audioPlayer.canPlayType('application/vnd.apple.mpegurl') === "probably" ? "mext" : "none");
const fadeDur = 3000;
const fadeCnt = 100;
const volStep = 1 / fadeCnt;
const fadeIntrv = Math.floor(fadeDur / fadeCnt);
const fadeInSteps = new Array(fadeCnt).fill(0).map((_, n) => volStep * n);
const fadeOutSteps = fadeInSteps.reverse();
const streamSupported = backend != "none";
const hls = backend === "hls" ? new Hls({maxBufferHole:2, debug:false}) : null;
let streamisLoaded = false;
let fadeIdx = 0;        
function renderPlayBtn(){
    let playBtn = document.createElement("button");
    playBtn.classList.add("w3-button");
    playBtn.classList.add("w3-black");
    playBtn.classList.add("w3-hover-green");
    playBtn.classList.add("centerElement");
    playBtn.textContent = "spela ljudström";
    document.body.insertBefore(playBtn, document.body.firstChild);
    playBtn.addEventListener("click",()=> {
        playBtn.remove();
        playBtn = null;
        audioPlayer.play();
    });
}
function renderStreamRestartBtn(){
    let streamrestartBtn = document.createElement("button");
    streamrestartBtn.classList.add("w3-button");
    streamrestartBtn.classList.add("w3-black");
    streamrestartBtn.classList.add("w3-hover-green");
    streamrestartBtn.classList.add("centerElement");
    streamrestartBtn.textContent = "Återupprätta ljudström";
    document.body.insertBefore(streamrestartBtn, document.body.firstChild);
    streamrestartBtn.addEventListener("click",()=> {
        streamrestartBtn.remove();
        streamrestartBtn = null;
        restartStream();
    });
}
if(hls != null){
    hls.on(Hls.Events.ERROR,(e, data) => {
        const { type, details, fatal } = data;
        console.log("Error Type:", type);
        console.log("Error Details:", details);
        console.log("Is Fatal:", fatal);    
        if (fatal) {
            switch (type) {
                case ErrorTypes.NETWORK_ERROR:
                    try {
                        hls.startLoad();
                    } catch(error) {
                        alert("ljudström stängdes pga nätverksfel, tryck på knappen för att återupprätta anslutning");
                        detachStream();
                        renderStreamRestartBtn();
                        console.error(error)
                    }
                    break;
                case ErrorTypes.MEDIA_ERROR:
                    try {
                        hls.recoverMediaError();
                    } catch(error) {
                        alert("ljudström stängdes pga mediafel, tryck på knappen för att återupprätta anslutning");
                        detachStream();
                        renderStreamRestartBtn();
                        console.error(error);   
                    }
                    break;
                default:
                    alert("ljudström stängdes pga okänt fel, tryck på knappen för att återupprätta anslutning");
                    detachStream();
                    renderStreamRestartBtn();
                    console.error(error);  
                    break;
            }
        }
    })
}

function detachStream(){
    if(hls){
        hls.detachMedia();
        streamisLoaded = false;
    }
    else {
        audioPlayer.src = '';
        document.body.removeChild(audioPlayer);
        streamisLoaded = false;
    }
}


function attachStream(){
    if(!streamisLoaded){
        if(hls){
            hls.loadSource(window.location.origin+"/tidstangsel/stream.m3u8");
            hls.attachMedia(audioPlayer);
            streamisLoaded = true;
            renderPlayBtn();
        }
        else {
            document.body.insertBefore(audioPlayer,document.body.firstChild);
            audioPlayer.src = window.location.origin+"/tidstangsel/stream.m3u8";
            audioPlayer.load();
            streamisLoaded = true;
            renderPlayBtn();
        }
    }
}
function openStream(){
    if(!streamisLoaded && streamSupported){
        attachStream();
        renderPlayBtn();
        alert(constants.perim_entermsg);
    }
}
function closeStream(){
    if(streamisLoaded && streamSupported){
        detachStream();
    }
}
function StartGeotracker(){
    if(initialized){
        if(geotracker){navigator.geolocation.clearWatch(geotracker);}
        geotracker = navigator.geolocation.watchPosition(HandlePosUpdate,HandleGeoTrackError,{enableHighAccuracy:true,timeout:10000,maximumAge:0});
        //console.log(globals.geotracker);
    }
}
function HandleOutOfBounds(){
    if (glmap) {
        navigator.geolocation.clearWatch(geotracker);
        glmap.remove();
        glmap = null;
    }
    alert(constants.outofboundsmessage);
    //render a static image on the screen of the area you need to be within, to use the app.
    document.body.innerHTML = "<img id='static_map' src='/static_map.png'/>" 
    console.log("out of bounds");        
}
function HandlePosUpdate(geopos) {
    if(initialized){
        let [lng, lat] = geopos.coords
            ? [geopos.coords.longitude, geopos.coords.latitude]
            : geopos;
        let move_dist = 1000 * distanceKm(prev_pos, [lng, lat]);
        let exceed_dist = move_dist >= 10;
        if (exceed_dist) {
            let inside_map = pointInBbox([lng, lat], constants.map_bounds);
            let inside_perim = pointInPolygon([lng, lat], constants.map_perim);
            if (inside_map) {
                locmarker.setLngLat([lng,lat]);
                if (!prev_pos_within_perim && inside_perim) {
                    //console.log("perim_enter!");
                    prev_pos_within_perim = true;
                    prev_pos = [lng, lat];
                    openStream();
                } else if (prev_pos_within_perim && !inside_perim) {
                    prev_pos_within_perim = false;
                    prev_pos = [lng, lat];
                    closeStream();
                    alert(constants.perim_exitmsg);
                } else {
                    prev_pos_within_perim = inside_perim;
                    prev_pos = [lng, lat];
                }
            } else {
                HandleOutOfBounds();
            }
        }
    }
}
function TryLocation(onsuccess) {
    navigator.geolocation.getCurrentPosition(
        (geopos) => onsuccess(geopos),
        (error) => {
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    alert("Åtkomst till geoposition nekad! Aktivera åtkomst, klicka på knappen för att försöka igen!");
                    break;
                case error.POSITION_UNAVAILABLE:
                    alert("Geoposition ej tillgänglig, klicka på knappen för att försöka igen!");
                    break;
                case error.TIMEOUT:
                    alert("Geoposition ej tillgänglig pga: tidsgärns för anrop har utgått, Kontrollera ditt nätverk och försök igen!");
                    break;
                default:
                    alert("Geoposition ej tillgänglig pga okänt fel, klicka på knappen för att försöka igen!");
                    break;
            }
            let retryBtn = document.createElement("button");
            retryBtn.textContent = "försök hitta geoposition";
            document.body.insertBefore(retryBtn, document.body.firstChild);
            retryBtn.addEventListener("click", function () {
                retryBtn.remove();
                retryBtn = null;
                TryLocation(onsuccess);
            });
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
}
function HandleGeoTrackError(error) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            alert("Åtkomst till geoposition nekad! Aktivera åtkomst, klicka på knappen för att försöka igen!");
            break;
        case error.POSITION_UNAVAILABLE:
            alert("Geoposition ej tillgänglig, klicka på knappen för att försöka igen!");
            break;
        case error.TIMEOUT:
            alert("Geoposition ej tillgänglig pga: tidsgärns för anrop har utgått, Kontrollera ditt nätverk och försök igen!");
            break;
        default:
            alert("Geoposition ej tillgänglig pga okänt fel, klicka på knappen för att försöka igen!");
            break;
    }
    let retryBtn = document.createElement("button");
    retryBtn.textContent = "Try Again";
    document.body.insertBefore(retryBtn, document.body.firstChild);
    retryBtn.addEventListener("click",()=> {
        retryBtn.remove();
        TryLocation((geopos) => {HandlePosUpdate(geopos); StartGeotracker()});
    });
}
function reSizeMap() {
    if(initialized){
        container.style.width = String(window.innerWidth)+"px";
        container.style.height = String(window.innerHeight)+"px";
        mapcontainer.style.width = String(window.innerWidth)+"px";
        mapcontainer.style.height = String(window.innerHeight)+"px";
        canvascontainer.style.width = String(window.innerWidth)+"px";
        canvascontainer.style.height = String(window.innerHeight)+"px";
        canvas.style.width = String(window.innerWidth)+"px";
        canvas.style.height = String(window.innerHeight)+"px";
        glmap.resize();
        glmap.fitBounds(maplibre_bounds);
    }
}
function init() {
    //only run if not initialized
    if(!initialized){
        container = document.getElementById("appcontainer");
        mapcontainer = document.getElementById("map");
        container.style.width = String(window.innerWidth)+"px";
        container.style.height = String(window.innerHeight)+"px";
        mapcontainer.style.width = String(window.innerWidth)+"px";
        mapcontainer.style.height = String(window.innerHeight)+"px";
        glmap = new maplibregl.Map(mapopts);
        glmap.on("load", () => {
            locmarker = new maplibregl.Marker({draggable:false});
            locmarker.setLngLat(prev_pos);
            locmarker.addTo(glmap);
            canvas = document.querySelector("canvas");
            canvascontainer = document.querySelector(".maplibregl-canvas-container");
            markercontainer = document.querySelector(".maplibregl-marker");
            markercontainer.style.width = "0px";
            markercontainer.style.height = "0px";
            markercontainer.style.position = "absolute";
            markercontainer.style.left = "0px";
            markercontainer.style.top = "0px";
            markercontainer.style.margin = "0px";
            markercontainer.style.padding = "0px";
            markercontainer.style.zIndex = 6;
            initialized = true;
            reSizeMap();
            StartGeotracker();
            if(prev_pos_within_perim){openStream()}
        });
    }
}
window.addEventListener("resize", () => {
    if (initialized) {reSizeMap();}
});
//runs when browser has loaded all content. 
window.addEventListener("load", () => {
    if(!navigator.geolocation || !streamSupported){alert("din webbläsare stöds ej!");return;}
    TryLocation((geopos) => {
        let [lng, lat] = [geopos.coords.longitude, geopos.coords.latitude];
        prev_pos = [lng,lat];
        let inside_map = pointInBbox([lng, lat], constants.map_bounds);
        let inside_perim = pointInPolygon([lng, lat], constants.map_perim);
        console.log("inside_perim",inside_perim);
        console.log("inside_map",inside_map);
        if (inside_map) {
            prev_pos_within_perim = inside_perim;
            init();
        }
        //runs if the geopos is outside of the map_bounds
        else {
            HandleOutOfBounds();
        }
    });
});