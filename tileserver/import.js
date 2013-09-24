"use strict";

var path = require("path");
var mapnik = require("mapnik"), mongodb = require("mongodb");

if (process.argv < 4) {
    console.log("USAGE: node import.js collection shapefile.shp");
}

var server = new mongodb.Server("localhost", 27017),
    connector = new mongodb.Db("gis", server, { w: 1 });

var nReady = 0, cnt = 0;

connector.open(function(err, db) {
    if (err)
        return console.log("mongodb connect error:", err.message);

    db.collection(process.argv[2], function(err, collection) {
        if (err) {
            connector.close();
            return console.log("collection selecting error:", err.message);
        }

        collection.ensureIndex({ geometry: "2dsphere" }, function(err) {
            if (err) {
                connector.close();
                return console.log("collection selecting error:", err.message);
            }

            importShp(process.argv[3], collection);
        });
    });
});

function importShp(name, collection) {
    var dataSource = new mapnik.Datasource({
            type: "shape",
            file: name
        }),
        featureSet = dataSource.featureset(), feature;

    (function next(feature) {
        if (!feature) {
            console.log("done...");
            connector.close();

            return;
        }

        var json = JSON.parse(feature.toJSON()), geom = json.geometry;
        if (geom.type === "MultiPolygon") {
            geom.type = "Polygon";
            geom.coordinates = geom.coordinates.map(function(pol) { return pol[0]; });
        }

        if (geom.type === "Polygon") // workaround to remove the last [ 0, 0 ]
            geom.coordinates.forEach(function(pol) { pol.splice(-1, 1); });

        console.log("inserting:", geom.type, cnt++);
        collection.insert(json, function(err) {
            if (err) {
                connector.close();
                return console.log("inserting error:", err.message);
            }

            next(featureSet.next());
        });
    })(featureSet.next());
}
