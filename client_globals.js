import {getSquareCorners} from "./client_geospatial";

const constants = {
	minLng:22.692261,
	minLat:65.739656,
	maxLng:24.329224,
	maxLat:66.438715,
	center:[23.507996,66.083241],
	start_pos:[23.603439,66.114816],
	perim_center:[23.798001194926712,65.94792047215071],
	update_dist:10,
	map_bounds:[[22.692261,65.739656],[24.329224,66.438715]],
	map_bounds_flat:[22.692261,65.739656,24.329224,66.438715],
	perim_coords:[
		[23.525427575932326,66.0903488585733 ],
		[23.42668791159693 ,66.06844236664259],
		[23.47140021242788, 66.00450362832879 ],
		[23.432276949200798,65.95824681364806],
		[23.468605693625392,65.83842512404459],
		[23.66422200976305, 65.83232398441024 ],
		[23.887783513920027,65.79912368543009],
		[24.08619434886012 ,65.8044691547079 ],
		[24.19704359467036, 65.82545847133909 ],
		[24.190523050799385,65.8868015859372 ],
		[24.03030397282032 ,66.06239587288295],
		[23.852386275762512,66.04538240012698 ],
		[23.593427533447,66.05256725398294],
		[23.525467719592257,66.09034391453025],
		[23.525427575932326,66.0903488585733  ]
	]
};

let globals = { 
	prev_pos:constants.start_pos,
	prev_pos_within_perim:false,
	maploaded:false,
	initialized:false,
	container:null,
	nav:null,
	debug_map:null,
	windowWidth:null,
	windowHeight:null,
	glmap:null,
	geotracker:null,
	marker:null,
	canvas:null,				
	mapcontainer:null,
	canvascontainer:null,
	controlcontainer:null,
	markercontainer:null,
	retryBtn:null
}

constants.mapstyle = {
	"version":8,
	"sources":{
		"osm":{
           	"bounds":constants.map_bounds_flat,
           	"minzoom":8,
           	"maxzoom":16,
               "type": "raster",
               "tiles": ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
               "tileSize": 256,
               "attribution": "&copy; OpenStreetMap Contributors"
		},
		"perim":{
			"type":"geojson",
			"data":{
				"type":"Feature",
				"properties":{},
				"geometry":{
					"type":"Polygon",
					"coordinates":[constants.perim_coords]
				}
			}
		},
		"verner":{
			"type":"image",
			"url": "/verner_bostrom_sprite.png",
			"coordinates": getSquareCorners(constants.perim_center,10)
		}
	},
	"layers":[
		{
			"id":"osm",
			"source":"osm",
			"type":"raster"
		},
		{
			"id":"pgon",
			"source":"perim",
			"type":"fill",
			"paint":{
				"fill-color":"blue",
				"fill-opacity":0.2
			}
	 	},
		{
			"id":"verner",
			"source":"verner",
			"type":"raster",
			"paint":{
				"raster-opacity": 0.3
			}
		}
	]
};

constants.map_description = {
	center:constants.center,
	container:'map',
	maxBounds:constants.map_bounds,
	dragPan:true,
	dragRotate:false,
	pitchWithRotate:false,
	touchZoomRotate:true,
	trackResize:false,
	touchPitch:false,
	keyboard:false,
	style:constants.mapstyle 
};


export {constants,globals};


