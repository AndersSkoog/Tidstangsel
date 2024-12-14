import * as maplibregl from "./assets/maplibre-gl.js";
import {pointInPolygon, pointInBbox, distanceKm} from "./client_geospatial";
import {globals, constants} from "./client_globals";
import {HandlePosUpdate, TryLocation, HandleOutOfBounds, HandleLostFocus, HandleGeoTrackError} from "./client_geolocation";
import {openStream, closeStream, killStream} from "./client_audiostream";

async function reSizeMap(){
  globals.container.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
  globals.mapcontainer.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
  globals.canvas.setAttribute("width",globals.windowWidth);
  globals.canvas.setAttribute("height",globals.windowHeight); 
  globals.canvas.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
  globals.canvascontainer.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
  globals.markercontainer.setAttribute("style",`position:absolute;left:0px;top:0px;margin:0px;padding:0px;z-index:6`);
  globals.glmap.resize();
  globals.glmap.fitBounds(constants.map_bounds);
}

async function init_test(){
  if(!globals.initialized){
    globals.windowWidth = window.innerWidth;
    globals.windowHeight = window.innerHeight;
    globals.container = document.getElementById("appcontainer");
    globals.mapcontainer = document.getElementById("map");
    globals.container.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
    globals.mapcontainer.setAttribute("style",`width:${globals.windowWidth}px;height:${globals.windowHeight}px`);
    globals.glmap = new maplibregl.Map(constants.map_description);
    globals.glmap.on("load", ()=> {
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

async function init(){
  if(!globals.initialized){
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
      globals.geotracker.on('userlocationlostfocus', ()=> HandleLostFocus());
      globals.geotracker.on('geolocate',             (geopos) => HandlePosUpdate(geopos));
      globals.geotracker.on('error',                 (err) => HandleGeoTrackError(err));
      globals.geotracker.on('outofmaxbounds',        ()=> HandleOutOfBounds());
      globals.initialized = true;
    });
  }
}

window.addEventListener("resize",()=> {
  globals.windowHeight = window.innerHeight;
  globals.windowWidth = window.innerWidth;
  if(globals.initialized){reSizeMap();}
});

window.addEventListener("load",()=> {
  globals.nonce = document.querySelector("#client_script_tag").dataset.nonce;
  init_test();
});