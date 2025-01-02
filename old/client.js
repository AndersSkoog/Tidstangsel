/*
NOTICE!  This code is depricated and not used in current deployment, left for reference and future development
*/
import * as maplibregl from "./assets/maplibre-gl.js";
import { pointInPolygon, pointInBbox, distanceKm } from "./client_geospatial";
import { globals, constants } from "./client_globals";
import { HandlePosUpdate,TryLocation, HandleOutOfBounds, HandleLostFocus, HandleGeoTrackError,} from "./client_geolocation";
import { openStream, closeStream, killStream } from "./client_audiostream";

async function reSizeMap() {
	//workaround to deal with some strange css behaviour that maplibre-gl has.
	globals.container.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
	globals.mapcontainer.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
	//globals.canvas.setAttribute("width", globals.windowWidth);
	//globals.canvas.setAttribute("height", globals.windowHeight);
	//globals.canvas.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
	//globals.canvascontainer.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
	//globals.markercontainer.setAttribute("style",`position:absolute;left:0px;top:0px;margin:0px;padding:0px;z-index:6`);
	globals.glmap.resize();
	globals.glmap.fitBounds(constants.map_bounds);
}

async function init() {
	//only run if not initialized
	if (!globals.initialized) {
		globals.windowWidth = window.innerWidth;
		globals.windowHeight = window.innerHeight;
		globals.container = document.getElementById("appcontainer");
		globals.mapcontainer = document.getElementById("map");
		globals.container.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
		globals.mapcontainer.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
		globals.glmap = new maplibregl.Map(constants.map_description);
		globals.glmap.on("load", () => {
			globals.geotracker = new GeolocateControl({
				positionOptions: {
					enableHighAccuracy: true,
					timeout: 10000,
					maximumAge: 0,
				},
				trackUserLocation: true,
				showUserLocation: true,
			});
			globals.glmap.addControl(globals.geotracker);
			//set up event handlers for the maplibre GeolocateControl
			//see reference: https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateControl/
			globals.geotracker.on("userlocationlostfocus", () => HandleLostFocus());
			globals.geotracker.on("geolocate", (geopos) => HandlePosUpdate(geopos));
			globals.geotracker.on("error", (err) => HandleGeoTrackError(err));
			globals.geotracker.on("outofmaxbounds", () => HandleOutOfBounds());
			globals.initialized = true;
		});
	}
}

window.addEventListener("resize", () => {
	//manually call the resize method on the map object when the window changes dimensions.
	//and update the global variables so that we always know the current screen dimensions.
	globals.windowHeight = window.innerHeight;
	globals.windowWidth = window.innerWidth;
	console.log("resized window!");
	if (globals.initialized) {
		reSizeMap();
	}
});
//runs when browser has loaded all content. 
window.addEventListener("load", () => {
	//prevent browser from autoplay restrictions by executing after user interaction
	const startBtn = document.createElement("button");
    startBtn.textContent = "Starta";
    startBtn.style.position = "absolute";
    startBtn.style.top = "50%";
    startBtn.style.left = "50%";
    startBtn.style.transform = "translate(-50%, -50%)";
    document.body.insertBefore(startBtn,document.body.firstChild);
    startBtn.addEventListener("click",()=> {
    	startBtn.remove();
		if (navigator.geolocation) {
			//check if the geolocation object exist in the global scope
			/*
				TryLocation takes a callback function which will be called if it retrieves a geolocation successfully,
				Otherwise it will handle the errors and provides the user with information and a button to try again. 
				if/when we retrieve a geoposition object, we first check if its within the map_bounds.
				if the geopos is within the map_bounds 
					we initialize the application, 
				if the geopos is outside the map_bounds 
					we call the HandleOutOfBounds function. 
				if the geopos is within the perimeter: 
					we iniialize the application and open the audio stream.
			*/
			TryLocation((geopos) => {
				//let socket_nonce = document.querySelector("#client_script_tag").dataset.socketnonce;
				//globals.socket_nonce = socket_nonce;
				//globals.nonce = socket_nonce;
				let [lng, lat] = [geopos.coords.longitude, geopos.coords.latitude];
				let inside_map = pointInBbox([lng, lat], constants.map_bounds_flat);
				let inside_perim = pointInPolygon([lng, lat], constants.perim_coords);
				console.log("inside_perim",inside_perim);
				console.log("inside_map",inside_map);
				if (inside_map) {
					console.log("setting websocket connection string");
					let socket_nonce = document.querySelector("#client_script_tag").dataset.socketnonce;
					let urlObj = new URL(window.location.origin);
					let pc = urlObj.protocol;
					let socket_pc = pc === "https:" ? "wss://" : "ws://";
					let conn_str = socket_pc+urlObj.hostname+":3000/tidstangsel/stream?nonce="+socket_nonce;
					globals.stream_connect_uri = conn_str;
					console.log("socket uri: ", globals.stream_connect_uri);
					globals.urlObj = urlObj; 
					globals.prev_pos_within_perim = inside_perim;
					globals.prev_pos = [lng,lat];
					init();
					if (inside_perim) {
						//console.log("perim_enter!");
						openStream();
						//open audio stream
					}
				}
				//runs if the geopos is outside of the map_bounds
				else {
					HandleOutOfBounds();
				}
			});
		} else {
			//alert a message that the browser must support the geolocation API
			alert("din webbläsare stöds ej!");
		}
	});
});
