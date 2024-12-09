import { bboxPolygon } from "@turf/bbox-polygon";
import { distance } from "@turf/distance";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
import {Map, GeolocateControl, MapOptions, LngLat, LngLatBounds} from "maplibre-gl";
import {map_bounds_turf,perim_coords_turf, map_bounds,map_default_center,perim_coords,perim_center, map_bounds_flat, update_dist, map_description} from "./client_constants";
import {openStream, closeStream, killStream} from "./client_audiostream";
import eventBus from "./client_eventbus";


function _LngLat(lng:number,lat:number) : [number,number] {
  return [lng,lat]
}

function _LatLng(lat:number,lng:number) : [number,number] {
  return [lat,lng]
}

function withinMapBounds(lat:number,lon:number) : boolean {
  //return pointInBbox(pos,map_bounds_flat)  
  return booleanPointInPolygon(point([lat,lon]),bboxPolygon(map_bounds_turf));
}    

function withinPerim(lat:number,lon:number) : boolean {
  //return booleanPointInPolygon(pos,polygon([perim_coords]));
  return booleanPointInPolygon(point([lat,lon]),polygon([perim_coords_turf]));
}

function exceedDistance(p1:[number,number],p2:[number,number],dist:number = update_dist){
  return (1000 * distance(point(p1),point(p2))) >= dist;  
}



//const map_bounds_flat       : [number, number, number, number]          = [22.8,65.8,24.195,66.4];
//const map_bounds_turf       : [number, number, number, number]          = [65.8,22.8,66.4,24.195];




let glmap                   : Map | null              = null;
let geotracker              : GeolocateControl | null = null;
let prev_pos                : [number,number]         = map_default_center;
let prev_pos_turf           : [number,number]         = _LatLng(map_default_center[1],map_default_center[0]);
let prev_pos_within_perim   : boolean                 = false;





console.log(location.origin+"/stream/tidsstangsel.m3u8");
console.log(withinMapBounds(inside_map_pos));
console.log(withinPerim(inside_perim_pos));


function try_get_geoposition(onsuccess:(geopos:GeolocationPosition)=> void){
  navigator.geolocation.getCurrentPosition(
    (geopos:GeolocationPosition) => onsuccess(geopos),
    (error:GeolocationPositionError) => {
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
      const retryBtn = document.createElement('button');
      retryBtn.textContent = "Try Again";
      document.body.insertBefore(retryBtn, document.body.firstChild);
      retryBtn.addEventListener('click', function () {
        retryBtn.remove(); 
        try_get_geoposition(onsuccess);
      
      });
    },         
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );  
}

/*
function activateSession(onsuccess:()=> void,onerror:(error:any)=> void){
  fetch("/tidstangsel/activatesession/"+nonce, {
     method: 'GET',
     headers: {
         'Content-Type': 'application/json',
         'Accept': 'application/json',
     },
     credentials: 'same-origin' // This ensures cookies are included
  })
  .then(response => {
       if (response.status === 200) {
          console.log("activate session success")
          onsuccess();
       } else {
          onerror(response);
       }
  })
  .catch(error => {
    onerror(error);
  });
}

function reportPerimEnter(onsuccess:()=> void,onerror:(error:any)=> void){
  fetch("/tidstangsel/enter/",{
     method: 'GET',
     headers: {
         'Content-Type': 'application/json',
         'Accept': 'application/json',
     },
     credentials:'same-origin'
  })
  .then(response => {
       if (response.status === 200) {
          console.log("report enter success");
          onsuccess();
       } else {
          console.log("report enter error");
          onerror(response);
       }
  })
  .catch(error => {
    onerror(error);
  });
}

function reportPerimExit(onsuccess:()=> void,onerror:(error:any)=> void){
  fetch("/tidstangsel/exit/",{
     method: 'GET',
     headers: {
         'Content-Type': 'application/json',
         'Accept': 'application/json',
     },
     credentials:'same-origin'
  })
  .then(response => {
       if (response.status === 200) {
          console.log("report exit success");
          onsuccess();
       } else {
          onerror(response);
       }
  })
  .catch(error => {
    onerror(error);
  });
}
*/

function GLMapInit(){
  if(!glmap){
    glmap = new Map(map_description);
    glmap.on("load", ()=> {
        geotracker = new GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            },
            trackUserLocation: true,
            showUserLocation: true
        });
        glmap!.addControl(geotracker);
        geotracker.on('userlocationlostfocus', ()=> eventBus.emit("geopos_lostfocus", {}));
        geotracker.on('userlocationfocus',     ()=> eventBus.emit("geopos_focus",{}));
        geotracker.on('geolocate',             (geopos:GeolocationPosition)  => eventBus.emit("geopos_update",geopos));
        geotracker.on('error',                 (err:GeolocationPositionError)=> eventBus.emit("geopos_error",err));
        geotracker.on('outofmaxbounds',        ()=> eventBus.emit("geopos_outofbounds",{}));
        eventBus.emit("map_ready", {});
    });
  }
}

function HandleOutOfBounds(){
  if(glmap){
    glmap.removeControl(geotracker!);
    glmap.remove();
    eventBus.clearAll();
    //note to self: fix kill_stream and close_stream method before running
    killStream();
    glmap = null;
    geotracker = null;
  }
  document.getElementById("map")?.remove();
  document.body.innerHTML = `
    <div>
      <p id='usermsg'>Du befinner dig för långt bortom tidstängslet, ladda om sidan när du befinner dig på kartan</p>
    </div>
    <img id='static_map' src='/assets/tidstangsel_static_map.png' width='512px' height='512px'></img>
  `;
  /*
  let usermsg = new HTMLParagraphElement();
  usermsg.setAttribute("id","usermsg")
  usermsg.textContent = "Du befinner dig för långt bortom tidstängslet, ladda om sidan när du befinner dig på kartan";
  document.body.insertBefore(usermsg,document.body.firstChild);
  let static_map = new Image(512,512);
  static_map.src = "/assets/verner_bostrom_sprite.png";
  document.body.append(static_map);
  */
}





function HandleEvents(){

  eventBus.on("geopos_lostfocus","main", ()=> {
    alert("Förlorade kontakten till platstjänst, klicka på knappen för att försöka igen");
    const retryBtn = document.createElement('button');
    retryBtn.textContent = "Återupprätta kontakt med plaststjänst";
    document.body.insertBefore(retryBtn, document.body.firstChild);
    retryBtn.addEventListener('click', function () {
      retryBtn.remove(); 
      try_get_geoposition((geopos:GeolocationPosition)=> eventBus.emit("geopos_update"),{geopos:geopos});
    });
  });

  eventBus.on("geopos_outofbounds","main", ()=> HandleOutOfBounds());
  
  eventBus.on("geopos_update","main", (geopos:GeolocationPosition)=> {
      const new_pos_turf = _LatLng(geopos.coords.latitude,geopos.coords.longitude);
      const new_pos      = _LngLat(geopos.coords.longitude,geopos.coords.latitude);
      if(exceedDistance(prev_pos_turf,new_pos_turf)){
        const inside       : boolean         = withinPerim(geopos.coords.latitude,geopos.coords.longitude);
        const perim_enter  : boolean         = !prev_pos_within_perim && inside;
        const perim_exit   : boolean         = prev_pos_within_perim && !inside;
        if(perim_enter){
          console.log("perim_enter!");
          openStream();
          //prev_pos_within_perim = true;
          //prev_pos = new_pos;
          //prev_pos_turf = new_pos_turf;
          //reportPerimEnter(()=> {audioStreamer.open_stream();},(error)=> console.error(error));
        }
        if(perim_exit){
          console.log("perim_exit!");
          closeStream();
          //prev_pos_within_perim = false;
          //reportPerimEnter(()=> {audioStreamer.close_stream();},(error)=> console.error(error));
        }
        prev_pos_within_perim = inside;
        prev_pos_turf = new_pos_turf;
        prev_pos = new_pos;
      }
  });
    
  eventBus.on("geopos_error","main", (error:GeolocationPositionError)=> {
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
    const retryBtn = document.createElement('button');
    retryBtn.textContent = "Try Again";
    document.body.insertBefore(retryBtn, document.body.firstChild);
    retryBtn.addEventListener('click', function () {
      retryBtn.remove(); 
      try_get_geoposition((geopos:GeolocationPosition)=> eventBus.emit("geopos_update",{geopos:geopos}));
    });
  });
}

window.addEventListener("load", ()=> {
  if(navigator.geolocation){
    try_get_geoposition(
      (geopos:GeolocationPosition)=> {
        if(withinMapBounds([geopos.coords.latitude,geopos.coords.longitude])){
          console.log("inside map!");
          prev_pos_turf = [geopos.coords.latitude,geopos.coords.longitude];
          prev_pos      = [geopos.coords.longitude,geopos.coords.latitude];
          prev_pos_within_perim = withinPerim(geopos.coords.latitude,geopos.coords.longitude);
          GLMapInit();
          HandleEvents();
          if(prev_pos_within_perim){
            OpenStream();  
          }
        }
        else{
          console.log("out of bounds");
          HandleOutOfBounds();
        }
    }
  );
  }
  else {
    //document.getElementById("tidstangsel_script")!.removeAttribute("data-nonce");
    document.getElementById("usrmsg")!.textContent = "din webläsare stöds ej";
  }
});