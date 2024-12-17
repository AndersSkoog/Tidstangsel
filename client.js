import {pointInPolygon, pointInBbox, distanceKm} from "./client_geospatial";
import {globals, constants} from "./client_globals";
import {HandlePosUpdate, TryLocation, HandleOutOfBounds, HandleLostFocus, HandleGeoTrackError} from "./client_geolocation";
import {openStream, closeStream, killStream} from "./client_audiostream";
/*
the .env file includes an enviroment variable called SIMULATE_GEO_POS:
set this to a value of 1 or true if you want to if simulate the geo postion with a dragable marker,
can be useful for debuging and testing. You could also provide this enviroment varable in a staged deployment.
if SIMULATE_GEO_POS is not true, then the executed code will rely on obtaining a real geolocation from the browser,
which should be the case when deploying in production.
*/ 
async function reSizeMap(){
	//work around to deal with some strange css behaviour that maplibre has.
  	globals.container.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
  	globals.mapcontainer.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
  	globals.canvas.setAttribute("width",globals.windowWidth);
  	globals.canvas.setAttribute("height",globals.windowHeight); 
  	globals.canvas.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
  	globals.canvascontainer.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
  	globals.markercontainer.setAttribute("style",`position:absolute;left:0px;top:0px;margin:0px;padding:0px;z-index:6`);
  	globals.glmap.resize();
  	globals.glmap.fitBounds(constants.map_bounds);
	globals.glmap.resize();
	globals.glmap.fitBounds(map_bounds);
}

async function init(){
	if(globals.simpos){
 		if(!globals.initialized){
 		    globals.windowWidth = window.innerWidth;
 		    globals.windowHeight = window.innerHeight;
 		    globals.container = document.getElementById("appcontainer");
 		    globals.mapcontainer = document.getElementById("map");
 		    globals.container.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
 		    globals.mapcontainer.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
 		    globals.glmap = new maplibregl.Map(constants.map_description);
 		    globals.glmap.on("load", ()=> {
 		    	globals.nav = new NavigationControl();
 		    	globals.glmap.addControl(globals.nav);
 		    	globals.marker = new maplibregl.Marker({draggable: true});
 		    	globals.marker.setLngLat(constants.start_pos);
 		    	globals.marker.addTo(globals.glmap);
 		    	globals.marker.on("dragend",()=> {
 		    	  let p = globals.marker.getLngLat();
 		    	  HandlePosUpdate([p.lng,p.lat]);
 		    	});
 		    	globals.canvas  = document.querySelector("canvas");
 		    	globals.canvascontainer = document.querySelector(".maplibregl-canvas-container");
 		    	globals.markercontainer = document.querySelector(".maplibregl-marker");
 		    	reSizeMap();
 		    	globals.initialized = true;
 		   });
 		} 
	}
	else {
  		if(!globals.initialized){
			globals.windowWidth = window.innerWidth;
			globals.windowHeight = window.innerHeight;
			globals.container = document.getElementById("appcontainer");
			globals.mapcontainer = document.getElementById("map");
			globals.container.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
			globals.mapcontainer.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
  		  	globals.glmap = new maplibregl.Map(constants.map_description);
  		  	globals.glmap.on("load", ()=> {
  		    	globals.geotracker = new GeolocateControl({
  		    		positionOptions: {
  		    		  enableHighAccuracy: true,
  		    		  timeout: 10000,
  		    		  maximumAge: 0
  		    		},
  		    		trackUserLocation: true,
  		    		showUserLocation: true
  		    	});
  		    	globals.glmap.addControl(globals.geotracker);
  		    	globals.glmap.addControl(new NavigationControl());
  		    	globals.geotracker.on('userlocationlostfocus', ()=> HandleLostFocus());
  		    	globals.geotracker.on('geolocate',             (geopos) => HandlePosUpdate(geopos));
  		    	globals.geotracker.on('error',                 (err) => HandleGeoTrackError(err));
  		    	globals.geotracker.on('outofmaxbounds',        ()=> HandleOutOfBounds());
  		    	globals.initialized = true;
  		  	});
  		}	
	}
}

window.addEventListener("resize",()=> {
	//manually call the resize method on the map object when the window changes dimensions. 
	//and update the global variables so that we always now the current screen dimensions. 
	globals.windowHeight = window.innerHeight;
	globals.windowWidth = window.innerWidth;
	console.log("resized window!");
	if(globals.initialized){reSizeMap()}
});
window.addEventListener("load",()=> {
	let simpos = new URL(window.location).searchParams.get("simpos");
	let socket_nonce = document.querySelector("#client_script_tag").dataset.socketnonce;
	globals.socket_nonce = socket_nonce;
	globals.nonce = socket_nonce;
	let canvascontainer = document.querySelector(".maplibregl-canvas-container");
	console.log("canvas-container",canvascontainer);


	console.log("simpos",simpos);
	console.log("socket_nonce",socket_nonce);
	if(simpos){
		globals.simpos = simpos;	
		//console.og()
		init();
	}
	else {
		/*
			if no simulated geo position, then initialize the app only after having obtained a valid geopostion from the browser
			its valid when it lies within the map_bounds specifed in the constants object in the ./client_globals module
			if the position is outside of bounds then display a non-intetactive image of the map, 
			and a message informing the user that they have located on the map in order for the app to work.   			
		*/
		if(navigator.geolocation){ //check if the geolocation object exist in the global scope
			/*
				TryLocation takes a callback function which will be called if it retrieves a geolocation postion successfully,
				Otherwise it will handle the errors end provides the user with accurate information and a button to try again. 
				if/when we retrieve a geoposition object, we first check if its within the map_bounds.
				if the geopos is within the map_bounds we initiate the application, 
				if not: we handle that case in the HandleOutOfBounds function. 
				if within the perimeter we open the audio stream.
			*/
			TryLocation((geopos)=> {
				let [lng,lat]    = [geopos.coords.longitude,geopos.coords.latitude];
				let inside_map   = pointInBbox([lng,lat],globals.map_bounds_flat);
				let inside_perim = pointInPolygon([lng,lat],globals.perim_coords);
				if(inside_map){
					init(); //init application and render the map
					if(inside_perim){
						console.log("perim_enter!");
						globals.prev_pos_within_perim = true; //set the prev position which we use to determine when a user first enters and exists the perimeter
						globals.prev_pos = [lng,lat]; //set the prev position which we use to determine when a user first enters and exists the perimeter 
						openStream(); //open audio stream
				  	}
					else {
						//runs if the initial geopos is within the map but not within the perimeter.
						globals.prev_pos_within_perim = inside_perim;
						globals.prev_pos = [lng,lat];
					}
				}
				//runs if the geopos is outside of the map_bounds
				else {HandleOutOfBounds();}
			});
		}
		else {
			//alert a message that the browser must support the geolocation API
			alert("din webbläsare stöds ej!")
		}			
	}
});