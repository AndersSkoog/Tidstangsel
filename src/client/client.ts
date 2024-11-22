import { bboxPolygon } from "@turf/bbox-polygon";
import { distance } from "@turf/distance";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
import { distanceKm, pointInBbox, pointInPolygon, exceedDistance} from "./GeoSpatial";
import {Map, GeolocateControl, MapOptions, LngLat, LngLatBounds} from "maplibre-gl";
import {map_bounds_turf,perim_coords_turf, map_bounds,map_default_center,perim_coords,perim_center, getNonce, map_bounds_flat, get_event_name, update_dist,mock_center, mock_map_description, map_description} from "./tidstangsel_constants";
import {AudioLiveStream} from "./AudioLiveStream";
import eventBus from "./EventBus";

const inside_map_pos        : [number, number]        = [65.8725,23.3226];
const inside_perim_pos      : [number, number]        = [65.9297, 23.7950];
const test                  : boolean                 = location.pathname == "/tidstangsel/test";
const nonce                 : string                  = getNonce();
let audioStreamer           : AudioLiveStream         = new AudioLiveStream("/tidstangsel/stream/tidsstangsel.m3u8",4000);
let glmap                   : Map | null              = null;
let geotracker              : GeolocateControl | null = null;
let prev_pos                : [number,number]         = map_default_center;
let prev_pos_within_perim   : boolean                 = false;
//const map_opts              : MapOptions              = map_description;

function withinMapBounds(pos:[number, number]) : boolean {
  //return pointInBbox(pos,map_bounds_flat)  
  return booleanPointInPolygon(point(pos),bboxPolygon(map_bounds_turf));
}    
function withinPerim(pos:[number, number]) : boolean {
  //return booleanPointInPolygon(pos,polygon([perim_coords]));
  return booleanPointInPolygon(point(pos),polygon([perim_coords_turf]));
}
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
        geotracker.on('userlocationlostfocus', ()=> eventBus.emit(get_event_name("geopps","lostfocus"),{}));
        geotracker.on('userlocationfocus',     ()=> eventBus.emit(get_event_name("geopos","focus"),{}));
        geotracker.on('geolocate',             (geopos:GeolocationPosition)  => eventBus.emit(get_event_name("geopos","update"),geopos));
        geotracker.on('error',                 (err:GeolocationPositionError)=> eventBus.emit(get_event_name("geopos","error"),err));
        geotracker.on('outofmaxbounds',        ()=> eventBus.emit(get_event_name("geopos","outofbounds"),{}));
        eventBus.emit(get_event_name("geomap","ready"), {});
    });
  }
}

function HandleStreamError(usrmsg:string){
  document.getElementById("usrmsg")!.textContent = usrmsg;
  const retryBtn = document.createElement('button');
  retryBtn.textContent = "Försök öppna ljudström";
  document.body.insertBefore(retryBtn, document.body.firstChild);
  retryBtn.addEventListener('click', function () { 
    document.getElementById("usrmsg")!.textContent = "";
    audioStreamer!.open_stream();
    retryBtn.remove();
  });
}

function HandleOutOfBounds(){
  if(glmap){
    glmap.removeControl(geotracker!);
    glmap.remove();
    eventBus.clearAll();
    //note to self: fix kill_stream and close_stream method before running
    audioStreamer?.kill_stream();
    glmap = null;
    geotracker = null;
  }
  document.getElementById("map")?.remove();
  document.getElementById("tidstangsel_script")!.removeAttribute("data-nonce");
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
  eventBus.on(get_event_name("stream","network_error"),"main",(_)=> {
    HandleStreamError("ljudströmmen avslutade pga nätverksfel, kontrollera din internet uppkoppling, försök sedan öppna ljudströmmen igen");
  });
  eventBus.on(get_event_name("stream","media_error"),"main",(_)=> {
    HandleStreamError("ljudströmmen avslutades pga okänt medialäsningsfel, tryck på knappen för att försöka öppna ljudströmmen igen");
  });
  eventBus.on(get_event_name("stream","fatal_error"),"main",(_)=> {
    HandleStreamError("ljudströmmen avslutades pga okänt fel, tryck på knappen för att försöka öppna ljudströmmen igen");
  });
  eventBus.on(get_event_name("stream","autoplay_failed"),"main",(_)=> {
    HandleStreamError("ljudström kunde ej öppnas automatiskt tryck på knappen för att öppna ljudström");
  });
  eventBus.on(get_event_name("stream","cannot_load"),"main",(_)=> {
    console.log("stream could not load");
  });

  eventBus.on(get_event_name("geopos","lostfocus"),"main",()=> {
    alert("Förlorade kontakten till platstjänst, klicka på knappen för att försöka igen");
    const retryBtn = document.createElement('button');
    retryBtn.textContent = "Återupprätta kontakt med plaststjänst";
    document.body.insertBefore(retryBtn, document.body.firstChild);
    retryBtn.addEventListener('click', function () {
      retryBtn.remove(); 
      try_get_geoposition((geopos:GeolocationPosition)=> eventBus.emit(get_event_name("geopos","update"),{geopos:geopos}));
    });
  });

  eventBus.on(get_event_name("geomap","ready"),"main",()=> {
    eventBus.on(get_event_name("geopos","outofbounds"),"main",()=> HandleOutOfBounds());
    eventBus.on(get_event_name("geopos","update"),"main",(geopos:GeolocationPosition)=> {
      const new_pos      : [number,number] = [geopos.coords.longitude,geopos.coords.latitude];
      if(exceedDistance(prev_pos,new_pos,update_dist)){
        const inside       : boolean         = pointInPolygon(new_pos,perim_coords);  
        const perim_enter  : boolean         = !prev_pos_within_perim && inside;
        const perim_exit   : boolean         = prev_pos_within_perim && !inside;
        if(perim_enter){
          reportPerimEnter(()=> {audioStreamer.open_stream();},(error)=> console.error(error));
        }
        if(perim_exit){
          reportPerimEnter(()=> {audioStreamer.close_stream();},(error)=> console.error(error));
        }
      }
    });
    eventBus.on(get_event_name("geopos","error"),"main",(error:GeolocationPositionError)=> {
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
        try_get_geoposition((geopos:GeolocationPosition)=> eventBus.emit(get_event_name("geopos","update"),{geopos:geopos}));
      });
    });
  });
}

window.addEventListener("load", ()=> {
  if(navigator.geolocation && audioStreamer.stream_supported()){
    try_get_geoposition(
      (geopos:GeolocationPosition)=> {
        if(withinMapBounds([geopos.coords.latitude,geopos.coords.longitude])){
          console.log("inside map!");
          prev_pos = [geopos.coords.longitude,geopos.coords.latitude];
          prev_pos_within_perim = withinPerim([prev_pos[1],prev_pos[0]]);
          activateSession(()=> {
            console.log("session activated!");
            if(prev_pos_within_perim){
              console.log("perim enter!");
              reportPerimEnter(()=> {
                const start_stream_btn = document.createElement('button');
                start_stream_btn.textContent = "starta ljudström";
                start_stream_btn.setAttribute("id","start_stream_btn");
                document.body.insertBefore(start_stream_btn, document.body.firstChild);
                start_stream_btn.addEventListener('click', function () {
                  start_stream_btn.remove();
                  console.log("opening stream"); 
                  audioStreamer.open_stream();
                });
              },
              (error)=> {
                console.log("cant open stream");
                console.log(error);
              });
            }
            HandleEvents();
            GLMapInit();
            setInterval(()=> {navigator.sendBeacon("/tidstangsel/beacon/")},60000);
          },
          (error:any)=> {console.error(error)})
        }
        else{
          console.log("out of bounds");
          HandleOutOfBounds();
        }
    }
  );
  }
  else {
    document.getElementById("tidstangsel_script")!.removeAttribute("data-nonce");
    document.getElementById("usrmsg")!.textContent = "din webläsare stöds ej";
  }
});
