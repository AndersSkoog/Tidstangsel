
function urlquery_boolean(term:string, truevals:string[], falsevals:string[], urlstr:string) : boolean {
    let qs = new URL(urlstr).search;
    if(qs.length > 0){
      let qo = new URLSearchParams(qs);
      let valid_vals = truevals.concat(falsevals);
      let check_val  = qo.get(term);
      if(check_val && valid_vals.includes(check_val)){return truevals.includes(check_val)}
      else {return false}
    }
    else {
      return false
    }
}

function getSquareCorners(centerLon:number, centerLat:number, distanceKm:number): [[number,number],[number,number],[number,number],[number,number]] {
  const latConversion : number = 111.32;
  const deltaLat      : number = distanceKm / latConversion;
  const deltaLon      : number = distanceKm / (latConversion * Math.cos(centerLat * Math.PI / 180));
  const topLeft       : [number,number] = [centerLon - deltaLon,centerLat + deltaLat]; // North-West
  const topRight      : [number,number] = [centerLon + deltaLon,centerLat + deltaLat]; // North-East
  const bottomLeft    : [number,number] = [centerLon - deltaLon,centerLat - deltaLat]; // South-West
  const bottomRight   : [number,number] = [centerLon + deltaLon,centerLat - deltaLat]; // South-East
  return [
      topLeft,
      topRight,
      bottomRight,
      bottomLeft
  ];
} 

export {urlquery_boolean, getSquareCorners}
