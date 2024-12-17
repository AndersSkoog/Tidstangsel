/*
	This file contains functions which responds to data sent by the Geolocation API or By moving the Marker 
	when the appication runs the simuated geo position mode. 
	I think the code is kind of self-explanatory and easy to understand. 
*/
import {
  pointInPolygon,
  pointInBbox,
  getSquareCorners,
  distanceKm,
} from "./client_geospatial";
import { openStream, closeStream, killStream } from "./client_audiostream";
import { globals, constants } from "./client_globals";

async function HandleOutOfBounds() {
  //free all allocated resources and kill the stream if its
  if (globals.glmap) {
    if (globals.marker) {
      globals.marker.remove();
      globals.marker = null;
    }
    if (globals.geotracker) {
      globals.glmap.removeControl(globals.geotracker);
      globals.geotracker = null;
    }
    globals.glmap.removeControl(globals.nav);
    globals.glmap.remove();
    globals.glmap = null;
    globals.geotracker = null;
  }
  document.getElementById("client_script_tag").removeAttribute("data-nonce");
  document.getElementById("appcontainer").remove(); //delete the first child of the DOM body, which will remove everything generated by maplibre.
  //display a popup alert message
  alert(
    "Du befinner dig för långt bortom tidstängslet! ladda om när du befinner på kartan!",
  );
  //render a static image on the screen indicating over the area which you need to be within in order to use the app.
  document.body.innerHTML = `<img id='static_map' src='/static_map.png' width='${globals.windowWidth}px' height='${globals.windowHeight}px'></img>`;
  console.log("out of bounds");
}
async function HandlePosUpdate(geopos) {
  let [lng, lat] = geopos.coords
    ? [geopos.coords.longitude, geopos.coords.latitude]
    : geopos;
  console.log("new pos:", [lng, lat]);
  //let new_pos   	 = geopos.coords ? [geopos.coords.longitude,geopos.coords.latitude] : geopos;
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
  navigator.geolocation.getCurrentPosition(
    (geopos) => onsuccess(geopos),
    (error) => {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          alert(
            "Åtkomst till geoposition nekad! Aktivera åtkomst, klicka på knappen för att försöka igen!",
          );
          break;
        case error.POSITION_UNAVAILABLE:
          alert(
            "Geoposition ej tillgänglig, klicka på knappen för att försöka igen!",
          );
          break;
        case error.TIMEOUT:
          alert(
            "Geoposition ej tillgänglig pga: tidsgärns för anrop har utgått, Kontrollera ditt nätverk och försök igen!",
          );
          break;
        default:
          alert(
            "Geoposition ej tillgänglig pga okänt fel, klicka på knappen för att försöka igen!",
          );
          break;
      }
      globals.retryBtn = document.createElement("button");
      globals.retryBtn.textContent = "Try Again";
      document.body.insertBefore(globals.retryBtn, document.body.firstChild);
      globals.retryBtn.addEventListener("click", function () {
        globals.retryBtn.remove();
        globals.retryBtn = null;
        TryLocation(onsuccess);
      });
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
  );
}
async function HandleLostFocus() {
  alert(
    "Förlorade kontakten till platstjänst, klicka på knappen för att Återupprätta kontakt",
  );
  const retryBtn = document.createElement("button");
  globals.retryBtn.textContent = "Återupprätta kontakt med plaststjänst";
  document.body.insertBefore(globals.retryBtn, document.body.firstChild);
  globals.retryBtn.addEventListener("click", function () {
    globals.retryBtn.remove();
    TryLocation((geopos) => HandlePosUpdate(geopos));
  });
}
async function HandleGeoTrackError(error) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      alert(
        "Åtkomst till geoposition nekad! Aktivera åtkomst, klicka på knappen för att försöka igen!",
      );
      break;
    case error.POSITION_UNAVAILABLE:
      alert(
        "Geoposition ej tillgänglig, klicka på knappen för att försöka igen!",
      );
      break;
    case error.TIMEOUT:
      alert(
        "Geoposition ej tillgänglig pga: tidsgärns för anrop har utgått, Kontrollera ditt nätverk och försök igen!",
      );
      break;
    default:
      alert(
        "Geoposition ej tillgänglig pga okänt fel, klicka på knappen för att försöka igen!",
      );
      break;
  }
  globals.retryBtn = document.createElement("button");
  globals.retryBtn.textContent = "Try Again";
  document.body.insertBefore(retryBtn, document.body.firstChild);
  globals.retryBtn.addEventListener("click", function () {
    globals.retryBtn.remove();
    globals.retryBtn = null;
    TryLocation((geopos) => HandlePosUpdate(geopos));
  });
}
export {
  HandlePosUpdate,
  TryLocation,
  HandleOutOfBounds,
  HandleLostFocus,
  HandleGeoTrackError,
};
