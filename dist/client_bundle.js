// client_geospatial.ts
var LAT_CONVERSION = 111.32;
var earthRadius = 6371008.8;
var factors = {
  centimeters: earthRadius * 100,
  centimetres: earthRadius * 100,
  degrees: 360 / (2 * Math.PI),
  feet: earthRadius * 3.28084,
  inches: earthRadius * 39.37,
  kilometers: earthRadius / 1000,
  kilometres: earthRadius / 1000,
  meters: earthRadius,
  metres: earthRadius,
  miles: earthRadius / 1609.344,
  millimeters: earthRadius * 1000,
  millimetres: earthRadius * 1000,
  nauticalmiles: earthRadius / 1852,
  radians: 1,
  yards: earthRadius * 1.0936
};
function radiansToLength(radians, units = "kilometers") {
  const factor = factors[units];
  if (!factor) {
    throw new Error(units + " units is invalid");
  }
  return radians * factor;
}
function degreesToRadians(degrees) {
  const radians = degrees % 360;
  return radians * Math.PI / 180;
}
function getSquareCorners(center, distanceKm) {
  const centerLon = center[0];
  const centerLat = center[1];
  const deltaLat = distanceKm / LAT_CONVERSION;
  const deltaLon = distanceKm / (LAT_CONVERSION * Math.cos(centerLat * Math.PI / 180));
  const topLeft = [centerLon - deltaLon, centerLat + deltaLat];
  const topRight = [
    centerLon + deltaLon,
    centerLat + deltaLat
  ];
  const bottomLeft = [
    centerLon - deltaLon,
    centerLat - deltaLat
  ];
  const bottomRight = [
    centerLon + deltaLon,
    centerLat - deltaLat
  ];
  return [topLeft, topRight, bottomRight, bottomLeft];
}
function pointInPolygon(point, polygon) {
  let intersection_count = 0;
  for (let i = 0, j = polygon.length - 1;i < polygon.length; j = i++) {
    let [lng1, lat1] = polygon[i];
    let [lng2, lat2] = polygon[j];
    let [lng, lat] = point;
    let intersect = lat1 > lat !== lat2 > lat && lng < (lng2 - lng1) * (lat - lat1) / (lat2 - lat1) + lng1;
    if (intersect) {
      intersection_count += 1;
    }
  }
  return intersection_count % 2 === 1;
}
function pointInBbox(point, bbox) {
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
  return radiansToLength(2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)), "kilometers");
}

// client_globals.js
var constants = {
  minLng: 22.692261,
  minLat: 65.739656,
  maxLng: 24.329224,
  maxLat: 66.438715,
  center: [23.507996, 66.083241],
  start_pos: [23.603439, 66.114816],
  perim_center: [23.798001194926712, 65.94792047215071],
  update_dist: 10,
  map_bounds: [
    [22.692261, 65.739656],
    [24.329224, 66.438715]
  ],
  map_bounds_flat: [22.692261, 65.739656, 24.329224, 66.438715],
  perim_coords: [
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
  ]
};
var globals = {
  prev_pos: constants.start_pos,
  prev_pos_within_perim: false,
  maploaded: false,
  initialized: false,
  container: null,
  nav: null,
  debug_map: null,
  windowWidth: null,
  windowHeight: null,
  glmap: null,
  geotracker: null,
  marker: null,
  canvas: null,
  mapcontainer: null,
  canvascontainer: null,
  controlcontainer: null,
  markercontainer: null,
  retryBtn: null
};
constants.mapstyle = {
  version: 8,
  sources: {
    osm: {
      bounds: constants.map_bounds_flat,
      minzoom: 8,
      maxzoom: 16,
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap Contributors"
    },
    perim: {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [constants.perim_coords]
        }
      }
    },
    verner: {
      type: "image",
      url: "/verner_bostrom.png",
      coordinates: getSquareCorners(constants.perim_center, 10)
    }
  },
  layers: [
    {
      id: "osm",
      source: "osm",
      type: "raster"
    },
    {
      id: "pgon",
      source: "perim",
      type: "fill",
      paint: {
        "fill-color": "blue",
        "fill-opacity": 0.2
      }
    },
    {
      id: "verner",
      source: "verner",
      type: "raster",
      paint: {
        "raster-opacity": 0.3
      }
    }
  ]
};
constants.map_description = {
  center: constants.center,
  container: "map",
  maxBounds: constants.map_bounds,
  dragPan: true,
  dragRotate: false,
  pitchWithRotate: false,
  touchZoomRotate: true,
  trackResize: false,
  touchPitch: false,
  keyboard: false,
  attributionControl: { compact: true },
  style: constants.mapstyle
};

// client_audiostream.ts
var socket = null;
var audioCtx = new (window.AudioContext || window.webkitAudioContext)({
  sampleRate: 44100
});
var gainNode = audioCtx.createGain();
var streamQueue = [];
var isPlaying = false;
var sr = 44100;
var fadeTime = 4000;
gainNode.connect(audioCtx.destination);
function renderPlayBtn() {
  let playBtn = document.createElement("button");
  let handler = () => {
    audioCtx.resume().then(() => {
      console.log("AudioContext resumed successfully.");
      playBtn.removeEventListener("click", handler);
      playBtn.removeEventListener("touchstart", handler);
      playBtn.remove();
    }).catch((err) => {
      console.error("Failed to resume AudioContext:", err);
    });
  };
  playBtn.textContent = "starta ljudstöm";
  document.body.insertBefore(playBtn, document.body.firstChild);
  playBtn.addEventListener("click", handler);
}
async function playNextInQueue() {
  if (streamQueue.length > 0) {
    let buffer = streamQueue.shift();
    let source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    source.onended = () => {
      source.disconnect();
      source = null;
      buffer = null;
      playNextInQueue();
    };
    source.start();
    isPlaying = true;
    if (audioCtx.state === "suspended" || audioCtx.state === "interrupted") {
      renderPlayBtn();
    }
  } else {
    isPlaying = false;
  }
}
async function addPcmToQueue(pcmdata) {
  let buf = audioCtx.createBuffer(1, pcmdata.length, sr);
  buf.copyToChannel(pcmdata, 0);
  streamQueue.push(buf);
  if (!isPlaying && streamQueue.length >= 4) {
    fadeIn();
    playNextInQueue();
  }
}
async function fadeIn() {
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + fadeTime / 1000);
}
async function fadeOut() {
  gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + fadeTime / 1000);
}
async function openStream() {
  if (!socket) {
    console.log("opening stream!");
    let conn_str = `wss://${window.location.hostname}:3000/tidstangsel/stream?nonce=${globals.socket_nonce}`;
    socket = new WebSocket(conn_str);
    socket.onopen = async () => {
      console.log("WebSocket connection established");
    };
    socket.onmessage = async (event) => {
      if (event.data instanceof Blob) {
        const arrayBuffer = await event.data.arrayBuffer();
        const pcmdata = new Float32Array(arrayBuffer);
        addPcmToQueue(pcmdata);
      }
      if (typeof event.data === "string") {
        if (event.data.message === "init_stream") {
          sr = parseInt(event.data.sampleRate);
        }
      }
    };
    socket.onerror = async (error) => {
      console.log("WebSocket error:", error);
    };
    socket.onclose = async () => {
      console.log("WebSocket connection closed");
    };
  }
}
async function closeStream() {
  if (socket !== null) {
    fadeOut();
    setTimeout(() => {
      console.log("socket is closing!");
      socket.close(1000, "closed by application logic");
      socket = null;
      isPlaying = false;
      streamQueue = [];
    }, fadeTime);
  }
}

// client_geolocation.js
async function HandleOutOfBounds() {
  if (globals.glmap) {
    if (globals.marker) {
      globals.marker.remove();
      globals.marker = null;
    }
    if (globals.geotracker) {
      globals.glmap.removeControl(globals.geotracker);
      globals.geotracker = null;
    }
    globals.glmap.remove();
    globals.glmap = null;
  }
  document.getElementById("client_script_tag").removeAttribute("data-nonce");
  document.getElementById("appcontainer").remove();
  alert("Du befinner dig för långt bortom tidstängslet! ladda om när du befinner på kartan!");
  document.body.innerHTML = `<img id='static_map' src='/static_map.png' width='${globals.windowWidth}px' height='${globals.windowHeight}px'></img>`;
  console.log("out of bounds");
}
async function HandlePosUpdate(geopos) {
  let [lng, lat] = geopos.coords ? [geopos.coords.longitude, geopos.coords.latitude] : geopos;
  console.log("new pos:", [lng, lat]);
  let inside_map = pointInBbox([lng, lat], constants.map_bounds_flat);
  let inside_perim = pointInPolygon([lng, lat], constants.perim_coords);
  let move_dist = 1000 * distanceKm(globals.prev_pos, [lng, lat]);
  let exceed_dist = move_dist >= constants.update_dist;
  console.log("test point in polygon: ", inside_perim);
  console.log("test within map: ", inside_map);
  console.log("exceed_dist: " + exceed_dist);
  if (exceed_dist) {
    if (inside_map) {
      if (!globals.prev_pos_within_perim && inside_perim) {
        console.log("perim_enter!");
        openStream();
        globals.prev_pos_within_perim = true;
        globals.prev_pos = [lng, lat];
      } else if (globals.prev_pos_within_perim && !inside_perim) {
        console.log("perim_exit!");
        closeStream();
        globals.prev_pos_within_perim = false;
        globals.prev_pos = [lng, lat];
      } else {
        globals.prev_pos_within_perim = inside_perim;
        globals.prev_pos = [lng, lat];
      }
    } else {
      HandleOutOfBounds();
    }
  }
}
async function TryLocation(onsuccess) {
  navigator.geolocation.getCurrentPosition((geopos) => onsuccess(geopos), (error) => {
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
    globals.retryBtn = document.createElement("button");
    globals.retryBtn.textContent = "försök hitta geoposition";
    document.body.insertBefore(globals.retryBtn, document.body.firstChild);
    globals.retryBtn.addEventListener("click", function() {
      globals.retryBtn.remove();
      globals.retryBtn = null;
      TryLocation(onsuccess);
    });
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 1e4 });
}
async function HandleLostFocus() {
  alert("Förlorade kontakten till platstjänst, klicka på knappen för att Återupprätta kontakt");
  const retryBtn2 = document.createElement("button");
  globals.retryBtn.textContent = "Återupprätta kontakt med plaststjänst";
  document.body.insertBefore(globals.retryBtn, document.body.firstChild);
  globals.retryBtn.addEventListener("click", function() {
    globals.retryBtn.remove();
    TryLocation((geopos) => HandlePosUpdate(geopos));
  });
}
async function HandleGeoTrackError(error) {
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
  globals.retryBtn = document.createElement("button");
  globals.retryBtn.textContent = "Try Again";
  document.body.insertBefore(retryBtn, document.body.firstChild);
  globals.retryBtn.addEventListener("click", function() {
    globals.retryBtn.remove();
    globals.retryBtn = null;
    TryLocation((geopos) => HandlePosUpdate(geopos));
  });
}

// client.js
async function reSizeMap() {
  globals.container.setAttribute("style", `width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
  globals.mapcontainer.setAttribute("style", `width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
  globals.canvas.setAttribute("width", globals.windowWidth);
  globals.canvas.setAttribute("height", globals.windowHeight);
  globals.canvas.setAttribute("style", `width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
  globals.canvascontainer.setAttribute("style", `width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
  globals.markercontainer.setAttribute("style", `position:absolute;left:0px;top:0px;margin:0px;padding:0px;z-index:6`);
  globals.glmap.resize();
  globals.glmap.fitBounds(constants.map_bounds);
  globals.glmap.resize();
  globals.glmap.fitBounds(map_bounds);
}
async function init() {
  if (globals.simpos) {
    if (!globals.initialized) {
      globals.windowWidth = window.innerWidth;
      globals.windowHeight = window.innerHeight;
      globals.container = document.getElementById("appcontainer");
      globals.mapcontainer = document.getElementById("map");
      globals.container.setAttribute("style", `width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
      globals.mapcontainer.setAttribute("style", `width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
      globals.glmap = new maplibregl.Map(constants.map_description);
      globals.glmap.on("load", () => {
        globals.nav = new NavigationControl;
        globals.glmap.addControl(globals.nav);
        globals.marker = new maplibregl.Marker({ draggable: true });
        globals.marker.setLngLat(constants.start_pos);
        globals.marker.addTo(globals.glmap);
        globals.marker.on("dragend", () => {
          let p = globals.marker.getLngLat();
          HandlePosUpdate([p.lng, p.lat]);
        });
        globals.canvas = document.querySelector("canvas");
        globals.canvascontainer = document.querySelector(".maplibregl-canvas-container");
        globals.markercontainer = document.querySelector(".maplibregl-marker");
        reSizeMap();
        globals.initialized = true;
      });
    }
  } else {
    if (!globals.initialized) {
      globals.windowWidth = window.innerWidth;
      globals.windowHeight = window.innerHeight;
      globals.container = document.getElementById("appcontainer");
      globals.mapcontainer = document.getElementById("map");
      globals.container.setAttribute("style", `width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
      globals.mapcontainer.setAttribute("style", `width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
      globals.glmap = new maplibregl.Map(constants.map_description);
      globals.glmap.on("load", () => {
        globals.geotracker = new GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true,
            timeout: 1e4,
            maximumAge: 0
          },
          trackUserLocation: true,
          showUserLocation: true
        });
        globals.glmap.addControl(globals.geotracker);
        globals.glmap.addControl(new NavigationControl);
        globals.geotracker.on("userlocationlostfocus", () => HandleLostFocus());
        globals.geotracker.on("geolocate", (geopos) => HandlePosUpdate(geopos));
        globals.geotracker.on("error", (err) => HandleGeoTrackError(err));
        globals.geotracker.on("outofmaxbounds", () => HandleOutOfBounds());
        globals.initialized = true;
      });
    }
  }
}
window.addEventListener("resize", () => {
  globals.windowHeight = window.innerHeight;
  globals.windowWidth = window.innerWidth;
  console.log("resized window!");
  if (globals.initialized) {
    reSizeMap();
  }
});
window.addEventListener("load", () => {
  let socket_nonce = document.querySelector("#client_script_tag").dataset.socketnonce;
  globals.socket_nonce = socket_nonce;
  globals.nonce = socket_nonce;
  let canvascontainer = document.querySelector(".maplibregl-canvas-container");
  if (navigator.geolocation) {
    TryLocation((geopos) => {
      let [lng, lat] = [geopos.coords.longitude, geopos.coords.latitude];
      let inside_map = pointInBbox([lng, lat], constants.map_bounds_flat);
      let inside_perim = pointInPolygon([lng, lat], constants.perim_coords);
      console.log("inside_perim", inside_perim);
      console.log("inside_map", inside_map);
      if (inside_map) {
        init();
        if (inside_perim) {
          console.log("perim_enter!");
          globals.prev_pos_within_perim = true;
          globals.prev_pos = [lng, lat];
          openStream();
        } else {
          globals.prev_pos_within_perim = inside_perim;
          globals.prev_pos = [lng, lat];
        }
      } else {
        HandleOutOfBounds();
      }
    });
  } else {
    alert("din webbläsare stöds ej!");
  }
});
