import { pointInPolygon, pointInBbox, distanceKm } from "./client_geospatial";
import { globals, constants } from "./client_globals";
import {
	HandlePosUpdate,
	TryLocation,
	HandleOutOfBounds,
	HandleLostFocus,
	HandleGeoTrackError,
} from "./client_geolocation";
import { openStream, closeStream, killStream } from "./client_audiostream";
/*
the .env file includes an enviroment variable called SIMULATE_GEO_POS:
set this to a value of 1 or true if you want to if simulate the geo postion with a dragable marker,
can be useful for debuging and testing. You could also provide this enviroment varable in a staged deployment.
if SIMULATE_GEO_POS is not true, then the executed code will rely on obtaining a real geolocation from the browser,
which should be the case when deploying in production.
*/
async function reSizeMap() {
	//work around to deal with some strange css behaviour that maplibre has.
	globals.container.setAttribute(
		"style",
		`width:${globals.windowWidth}px;height:${globals.windowHeight}px`,
	);
	globals.mapcontainer.setAttribute(
		"style",
		`width:${globals.windowWidth}px;height:${globals.windowHeight}px`,
	);
	globals.canvas.setAttribute("width", globals.windowWidth);
	globals.canvas.setAttribute("height", globals.windowHeight);
	globals.canvas.setAttribute(
		"style",
		`width:${globals.windowWidth}px;height:${globals.windowHeight}px`,
	);
	globals.canvascontainer.setAttribute(
		"style",
		`width:${globals.windowWidth}px;height:${globals.windowHeight}px`,
	);
	globals.markercontainer.setAttribute(
		"style",
		`position:absolute;left:0px;top:0px;margin:0px;padding:0px;z-index:6`,
	);
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
			globals.container.setAttribute(
				"style",
				`width:${globals.windowWidth}px;height:${globals.windowHeight}px`,
			);
			globals.mapcontainer.setAttribute(
				"style",
				`width:${globals.windowWidth}px;height:${globals.windowHeight}px`,
			);
			globals.glmap = new maplibregl.Map(constants.map_description);
			globals.glmap.on("load", () => {
				globals.marker = new maplibregl.Marker({ draggable: true });
				globals.marker.setLngLat(constants.start_pos);
				globals.marker.addTo(globals.glmap);
				globals.marker.on("dragend", () => {
					let p = globals.marker.getLngLat();
					HandlePosUpdate([p.lng, p.lat]);
				});
				globals.canvas = document.querySelector("canvas");
				globals.canvascontainer = document.querySelector(
					".maplibregl-canvas-container",
				);
				globals.markercontainer = document.querySelector(".maplibregl-marker");
				reSizeMap();
				globals.initialized = true;
			});
		}
	}
}

window.addEventListener("resize", () => {
	//manually call the resize method on the map object when the window changes dimensions.
	//and update the global variables so that we always now the current screen dimensions.
	globals.windowHeight = window.innerHeight;
	globals.windowWidth = window.innerWidth;
	console.log("resized window!");
	if (globals.initialized) {
		reSizeMap();
	}
});
window.addEventListener("load", () => {
	let socket_nonce =
		document.querySelector("#client_script_tag").dataset.socketnonce;
	globals.socket_nonce = socket_nonce;
	globals.nonce = socket_nonce;
	init();
});
