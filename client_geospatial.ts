/*
Geospatial mathematics, do not change unless you know what you are doing! 
*/
const LAT_CONVERSION = 111.32;
const earthRadius = 63710088e-1;
const factors = {
	centimeters: earthRadius * 100,
	centimetres: earthRadius * 100,
	degrees: 360 / (2 * Math.PI),
	feet: earthRadius * 3.28084,
	inches: earthRadius * 39.37,
	kilometers: earthRadius / 1e3,
	kilometres: earthRadius / 1e3,
	meters: earthRadius,
	metres: earthRadius,
	miles: earthRadius / 1609.344,
	millimeters: earthRadius * 1e3,
	millimetres: earthRadius * 1e3,
	nauticalmiles: earthRadius / 1852,
	radians: 1,
	yards: earthRadius * 1.0936,
};
const areaFactors = {
	acres: 247105e-9,
	centimeters: 1e4,
	centimetres: 1e4,
	feet: 10.763910417,
	hectares: 1e-4,
	inches: 1550.003100006,
	kilometers: 1e-6,
	kilometres: 1e-6,
	meters: 1,
	metres: 1,
	miles: 386e-9,
	nauticalmiles: 29155334959812285e-23,
	millimeters: 1e6,
	millimetres: 1e6,
	yards: 1.195990046,
};

function radiansToLength(radians, units = "kilometers") {
	const factor = factors[units];
	if (!factor) {
		throw new Error(units + " units is invalid");
	}
	return radians * factor;
}
function lengthToRadians(distance, units = "kilometers") {
	const factor = factors[units];
	if (!factor) {
		throw new Error(units + " units is invalid");
	}
	return distance / factor;
}
function lengthToDegrees(distance, units) {
	return radiansToDegrees(lengthToRadians(distance, units));
}
function bearingToAzimuth(bearing) {
	let angle = bearing % 360;
	if (angle < 0) {
		angle += 360;
	}
	return angle;
}
function azimuthToBearing(angle) {
	angle = angle % 360;
	if (angle > 0) return angle > 180 ? angle - 360 : angle;
	return angle < -180 ? angle + 360 : angle;
}
function radiansToDegrees(radians) {
	const degrees = radians % (2 * Math.PI);
	return (degrees * 180) / Math.PI;
}
function degreesToRadians(degrees) {
	const radians = degrees % 360;
	return (radians * Math.PI) / 180;
}

function getSquareCorners(center: [number, number],distanceKm: number,): [[number, number], [number, number], [number, number], [number, number]] {
	const centerLon: number = center[0];
	const centerLat: number = center[1];
	const deltaLat: number = distanceKm / LAT_CONVERSION;
	const deltaLon: number =
		distanceKm / (LAT_CONVERSION * Math.cos((centerLat * Math.PI) / 180));
	const topLeft: [number, number] = [centerLon - deltaLon, centerLat + deltaLat]; // North-West
	const topRight: [number, number] = [
		centerLon + deltaLon,
		centerLat + deltaLat,
	]; // North-East
	const bottomLeft: [number, number] = [
		centerLon - deltaLon,
		centerLat - deltaLat,
	]; // South-West
	const bottomRight: [number, number] = [
		centerLon + deltaLon,
		centerLat - deltaLat,
	]; // South-East
	return [topLeft, topRight, bottomRight, bottomLeft];
}
function pointInPolygon(point: [number, number], polygon: [number, number][]) : boolean {
	let intersection_count = 0;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		let [lng1, lat1] = polygon[i];
		let [lng2, lat2] = polygon[j];
		let [lng, lat] = point;
		let intersect =
			lat1 > lat !== lat2 > lat &&
			lng < ((lng2 - lng1) * (lat - lat1)) / (lat2 - lat1) + lng1;
		if (intersect) {
			intersection_count += 1;
		}
	}
	return intersection_count % 2 === 1;
}

function pointInBbox(point: [number, number],bbox: [number, number, number, number]): boolean {
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
	return radiansToLength(2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),"kilometers");
}
export { pointInBbox, pointInPolygon, distanceKm, getSquareCorners };
