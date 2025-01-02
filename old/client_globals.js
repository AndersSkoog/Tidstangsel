/*
This code is depricated and not used in current deployment, left for reference and future development
*/
import { getSquareCorners } from "./client_geospatial";
//we declare an object called constants so that different files can have the same reference to information important to the functioning of our application
//these values cannot and should not be changed but only be read.
const constants = {
	minLng: 22.692261,
	minLat: 65.739656,
	maxLng: 24.329224,
	maxLat: 66.438715,
	center: [23.507996, 66.083241],
	start_pos: [23.603439, 66.114816],
	perim_center: [23.798001194926712, 65.94792047215071],
	update_dist: 10,
	map_bounds: [
		[22.692261, 65.739656],
		[24.329224, 66.438715],
	],
	map_bounds_flat: [22.692261, 65.739656, 24.329224, 66.438715],
	perim_coords: [
		[23.525427575932326, 66.0903488585733],
		[23.42668791159693, 66.06844236664259],
		[23.47140021242788, 66.00450362832879],
		[23.432276949200798, 65.95824681364806],
		[23.468605693625392, 65.83842512404459],
		[23.66422200976305, 65.83232398441024],
		[23.887783513920027, 65.79912368543009],
		[24.08619434886012, 65.8044691547079],
		[24.19704359467036, 65.82545847133909],
		[24.190523050799385, 65.8868015859372],
		[24.03030397282032, 66.06239587288295],
		[23.852386275762512, 66.04538240012698],
		[23.593427533447, 66.05256725398294],
		[23.525467719592257, 66.09034391453025],
		[23.525427575932326, 66.0903488585733],
	]
};
//we declare an object called globals so that different files can have the same reference to information important to the functioning of our application
let globals = {
	prev_pos: constants.start_pos,
	prev_pos_within_perim: false,
	maploaded: false,
	initialized: false,
	container: null,
	nav: null,
	debug_map: null,
	windowWidth: null,
	windowHeight: null,
	glmap: null,
	geotracker: null,
	marker: null,
	canvas: null,
	mapcontainer: null,
	canvascontainer: null,
	controlcontainer: null,
	markercontainer: null,
	retryBtn: null
};
//this is the declared "style" of the map which is not intended to change dynamically in the application.
//the word "style" is not a very descriptive name for what it is: see https://maplibre.org/maplibre-style-spec/ for documentation
constants.mapstyle = {
	version: 8,
	sources: {
		//this is the source for the openstreedmap raster maptiles.
		osm: {
			bounds: constants.map_bounds_flat,
			minzoom: 8,
			maxzoom: 16,
			type: "raster",
			tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
			tileSize: 256,
			attribution: "&copy; OpenStreetMap Contributors",
		},
		//this is source for the geojson polygon overlay that draws the perimeter on the map. 
		perim: {
			type: "geojson",
			data: {
				type: "Feature",
				properties: {},
				geometry: {
					type: "Polygon",
					coordinates: [constants.perim_coords],
				},
			},
		},
		//this is source for the image of verner boström inside drawn inside the perimeter on the map. 
		verner: {
			type: "image",
			url: "/verner_bostrom.png",
			coordinates: getSquareCorners(constants.perim_center, 10),
		},
	},
	//to mkae maplibre render something you first define a source and then a layer that has a reference to a source you have defined  
	layers: [
		{
			id: "osm",
			source: "osm",
			type: "raster",
		},
		{
			id: "pgon",
			source: "perim",
			type: "fill",
			paint: {
				"fill-color": "blue",
				"fill-opacity": 0.2,
			},
		},
		{
			id: "verner",
			source: "verner",
			type: "raster",
			paint: {
				"raster-opacity": 0.3,
			},
		},
	]
};
//this is options that is passed to the maplibre.Map constructor to render a map.
//see documentation for different options here: https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/
constants.map_description = {
	center: constants.center,
	container: "map", // id of html element which should contain the map 
	maxBounds: constants.map_bounds,
	dragPan: true,
	dragRotate: false,
	pitchWithRotate: false,
	touchZoomRotate: true,
	trackResize: false,
	touchPitch: false,
	keyboard: false,
	attributionControl: { compact: true },
	style: constants.mapstyle
};

export { constants, globals };
