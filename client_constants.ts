import { MapOptions }       from "maplibre-gl";
import {Position}           from 'geojson'
import { getSquareCorners } from "./client_geospatial";

const start_pos             : [number,number]                           = [23.41, 65.94];
const perim_center          : [number,number]                           = [23.798001194926712,65.94792047215071];
const update_dist           : number                                    = 10;
const map_bounds_flat       : [number, number, number, number]          = [22.8,65.8,24.195,66.4];
const map_bounds_turf       : [number, number, number, number]          = [65.8,22.8,66.4,24.195];
const map_bounds            : [[number,number],[number,number]]         = [[22.8,65.8],[24.195,66.4]];
const map_default_center    : [number, number]                          = [23.61,65.98];
const perim_coords          : [number,number][]                         = [
    [23.525427575932326,66.0903488585733 ],[23.42668791159693 ,66.06844236664259],[23.47140021242788, 66.00450362832879 ],
    [23.432276949200798,65.95824681364806],[23.468605693625392,65.83842512404459],[23.66422200976305, 65.83232398441024 ],
    [23.887783513920027,65.79912368543009],[24.08619434886012 ,65.8044691547079 ],[24.19704359467036, 65.82545847133909 ],
    [24.190523050799385,65.8868015859372 ],[24.03030397282032 ,66.06239587288295],[23.852386275762512,66.04538240012698 ],
    [23.593427533447,   66.05256725398294],[23.525467719592257,66.09034391453025],[23.525427575932326,66.0903488585733  ]
];
const perim_coords_turf    : [number,number][]                         = [
  [66.0903488585733 ,23.525427575932326],[66.06844236664259,23.42668791159693 ],[66.00450362832879,23.47140021242788],
  [65.95824681364806,23.432276949200798],[65.83842512404459,23.468605693625392],[65.83232398441024,23.66422200976305],
  [65.79912368543009,23.887783513920027],[65.8044691547079 ,24.08619434886012 ],[65.82545847133909,24.19704359467036],
  [65.8868015859372 ,24.190523050799385],[66.06239587288295,24.03030397282032 ],[66.04538240012698,23.85238627576251],
  [66.05256725398294,23.593427533447,  ],[66.09034391453025,23.525467719592257],[66.0903488585733 ,23.525427575932326]
];



const map_description              : MapOptions                                 = {
  container:'map',
  bounds:map_bounds,
  maxBounds:map_bounds,
  center:map_default_center,
  minZoom:9,
  maxZoom:16,
  zoom:9,
  dragPan:true,
  dragRotate:false,
  pitchWithRotate:false,
  touchZoomRotate:false,
  touchPitch:false,
  keyboard:false,
  style:{
    "version": 8,
	  "sources": {
      "osm": {
			  "type": "raster",
			  "tiles": ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
			  "tileSize": 128,
        "attribution": "&copy; OpenStreetMap Contributors",
        "maxzoom": 16
      },
      "perim_src":{
        "type":"geojson",
        "data":{
          "type":"Feature",
          "properties":{},
          "geometry":{
            "type":"LineString",
            "coordinates":perim_coords as Position[]
          }
        }
      },
      "perim_pgon":{
        "type":"geojson",
        "data":{
          "type":"Feature",
          "properties":{},
          "geometry":{
            "type":"Polygon",
            "coordinates":[perim_coords] as Position[][]
          }
        }
      },
      "verner":{
        "type":"image",
        "url": "/assets/verner_bostrom_sprite.png",
        "coordinates": getSquareCorners(perim_center,10)
      }
    },
    "layers": [
      {
        "id": "osm",
        "type": "raster",
        "source": "osm"
      },
      {
        "id": "perim_fill",
        "source":"perim_pgon",
        "type":"fill",
        "paint":{
          "fill-color":"blue",
          "fill-opacity":0.2
        }
      },
      {
        "id":"verner_layer",
        "type":"raster",
        "source":"verner",
        "paint": {
            "raster-opacity": 0.3
        }
      }
    ]
  } 
}


export {
  map_description,
  start_pos,
  update_dist,
  map_default_center,
  map_bounds_flat,
  map_bounds_turf,
  perim_coords_turf,
  map_bounds,
  perim_center,
  perim_coords
}