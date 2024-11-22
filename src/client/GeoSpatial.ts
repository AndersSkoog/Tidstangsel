const LAT_CONVERSION = 111.32;
const R_Earth = 6378;


/*
Calculate change in latitude (in degrees) for a given distance in km.
*/
function deltaLat(distanceKm:number) : number {
    return distanceKm / LAT_CONVERSION;
}

/*
Calculate change in longitude (in degrees) for a given distance in km and center latitude.
*/
function deltaLon(distanceKm:number, centerLat:number) : number {
    return (Math.PI/180) * R_Earth * Math.cos(centerLat*Math.PI/180);
}

/*
Normalize a geospatial relative to a bounding box.
*/
function normalizePoint(geopoint: [number, number], bbox: [number, number, number, number]): [number, number] {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const [lng, lat] = geopoint;

    const x = (lng - minLng) / (maxLng - minLng); // Normalize longitude
    const y = (lat - minLat) / (maxLat - minLat); // Normalize latitude

    return [x, y];
}

/*
Denormalize a normalized point into relative to a bounding box.
*/
function denormalizePoint(normalized: [number, number], bbox: [number, number, number, number]): [number, number] {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const [x, y] = normalized;
    const lng = minLng + x * (maxLng - minLng); // Scale longitude
    const lat = minLat + y * (maxLat - minLat); // Scale latitude

    return [lng, lat];
}

/*
Calculate approximate distance in km between two geographic points.
Uses basic spherical approximation, suitable for small distances.
*/
function distanceKm(p1:[number,number],p2:[number,number]) : number {
    const lat1 = p1[1];
    const lat2 = p2[1];
    const lon1 = p1[0];
    const lon2 = p2[0];
    const dLat = (lat2 - lat1) * LAT_CONVERSION;
    const dLon = (lon2 - lon1) * LAT_CONVERSION * Math.cos((lat1 + lat2) * Math.PI / 360);
    return Math.sqrt(dLat * dLat + dLon * dLon);
}

/*
Check if distance between two geographic points exceed a given threshold in meters 
*/
function exceedDistance(p1:[number,number],p2:[number,number],threshHoldInMeters:number){
    return (distanceKm(p1,p2) * 1000) >= threshHoldInMeters;
}

/*
Check if a geospatial coordinate is within a boundingbox (minlng,minlat,maxlng,maxlat) 
*/
function pointInBbox(point:[number,number], bbox:[number,number,number,number]) : boolean {
    const [lng, lat] = point;
    const [minLng, minLat, maxLng, maxLat] = bbox;
    return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

/*
Check if a geospatial coordinate is within a polygon (an array of minimum four geo coordinates where the first and the last index must be the same) 
*/
function pointInPolygon(point:[number,number], polygon:[number,number][]){
    let intersection_count = 0;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let [lng1, lat1] = polygon[i];
        let [lng2, lat2] = polygon[j];
        let [lng, lat] = point;
        let intersect = ((lat1 > lat) !== (lat2 > lat) && (lng < (lng2 - lng1) * (lat - lat1) / (lat2 - lat1) + lng1))
        if (intersect) {intersection_count += 1}
    }
    return intersection_count % 2 === 1;
}

/*
Return corners of a geographic square area from a center coordinate and a distance
*/
function getSquareCorners(center:[number,number], distanceKm:number): [[number,number],[number,number],[number,number],[number,number]] {
    const centerLon     : number = center[0];
    const centerLat     : number = center[1];
    const deltaLat      : number = distanceKm / LAT_CONVERSION;
    const deltaLon      : number = distanceKm / (LAT_CONVERSION * Math.cos(centerLat * Math.PI / 180));
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

/*
Computes the centroid as the mean of all vertices of a geospatial polygon
*/
function polygonCenter(polygoncoords:[number,number][]){
    let len = polygoncoords.length;
    if (len < 4 || polygoncoords[0].join(",") !== polygoncoords[len - 1].join(",")) {
        throw Error("Polygon must have at least four coordinates, with the first and last points being identical.");
    }
    let lonSum = 0;
    let latSum = 0;
    polygoncoords.forEach(([lon, lat]) => {
        lonSum += lon;
        latSum += lat;
    });
    return [lonSum / len,latSum / len];
}

/*
Computes the centeroid of a geospatial bounding box
*/
function bboxCenter(bbox:[number,number,number,number]){
   let [minLng,minLat,maxLng,maxLat] = bbox; 
   const lng = (minLng + maxLng) / 2;
   const lat = (minLat + maxLat) / 2;
   return [lng, lat]
}

/*
Shift a bounding box to a new centroid location.
*/
function shiftBbox(bbox: [number, number, number, number],new_center:[number,number]) : [number, number, number, number] {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const [srcLng, srcLat] = bboxCenter(bbox);
    const [newLng, newLat] = new_center;
    const dist = distanceKm([srcLng, srcLat], [newLng, newLat]);
    const latOffset = deltaLat(dist);
    const lngOffset = deltaLon(dist, (srcLat + newLat) / 2); 
    const new_bbox : [number,number,number,number] = [
        minLng + (newLng > srcLng ? lngOffset : -lngOffset),
        minLat + (newLat > srcLat ? latOffset : -latOffset),
        maxLng + (newLng > srcLng ? lngOffset : -lngOffset),
        maxLat + (newLat > srcLat ? latOffset : -latOffset)
    ];
    return new_bbox;
}

/*
Shift a geospatial polygon to a new center location
*/
function shiftPolygon(polygoncoords:[number,number][],new_center:[number,number]) : [number,number][] {
    const [pcLng, pcLat]   = polygonCenter(polygoncoords);
    const [newLng, newLat] = new_center;
    // Distance between source and new center
    const dist = distanceKm([pcLng, pcLat], [newLng, newLat]);
    // Compute offsets
    const latOffset = deltaLat(dist);
    const lngOffset = deltaLon(dist, (pcLat + newLat) / 2); // Average latitude for deltaLon
    return polygoncoords.map(([lng,lat])=> [
        lng + (newLng > pcLng ? lngOffset : -lngOffset),
        lat + (newLat > pcLat ? latOffset : -latOffset)
    ]);
}



export {
    distanceKm,
    pointInBbox,
    pointInPolygon,
    exceedDistance,
    shiftBbox,
    shiftPolygon,
    getSquareCorners,
    polygonCenter,
    bboxCenter,
    normalizePoint,
    denormalizePoint
}
