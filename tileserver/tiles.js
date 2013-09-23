"use strict";

var express = require("express"), http = require("http");
var mapnik = require("mapnik"),
    mercator = require("./sphericalmercator"),
    pool = require("./pool");

mapnik.register_datasources("..");
mapnik.register_fonts("/usr/share/fonts/truetype/ttf-dejavu");

// create a pool of 5 maps to manage concurrency under load
var maps = pool.create_pool(5);

function acquire(id, options, callback) {
    maps.acquire(id, {
        create: function(callback) {
            var obj = new mapnik.Map(options.width || 256, options.height || 256);
            obj.load(id, { strict: true },function(err, obj) {
                if (options.bufferSize)
                    obj.bufferSize = options.bufferSize;

                callback(err, obj);
            });
        },
        destroy: function(obj) {
            // delete obj; -- no need to do it
        }
    }, callback);
};

function serve(conf, route, callback) {
    var app = express(), server = http.createServer(app);

    app.configure(function() {
        app.use(express.bodyParser());

        if (typeof(route) === "function")
            route(app);

        app.use(app.router);
        app.use(express.errorHandler());
        app.use(express.static(process.cwd()));
    });

    server.on("error", function(err) {
        console.log("server error: ", err.message);
    });

    server.listen(conf.port, conf.host, callback);
}

function render(map, x, y, z, callback) {
    map.zoomToBox(mercator.xyz_to_envelope(x, y, z));

    var img = new mapnik.Image(256, 256);
    map.render(img, function(err, img) {
        if (err) return callback(new Error([ "rendering error", err.message ].join(": ")));

        img.encode("png", function(err, buffer) {
            if (err) return callback(new Error([ "encoding error", err.message ].join(": ")));
            callback(null, buffer);
        });
    });
}
function route(app) {
    app.get("/map/:z/:x/:y.png", function(req, resp) {
        var p = req.params;
        acquire("tiles.xml", {}, function(err, map) {
            if (err) return resp.send(500, err.message);

            console.log("render: ", [ +p.x, +p.y, +p.z]);
            render(map, +p.x, +p.y, +p.z, function(err, buffer) {
                process.nextTick(function() { maps.release("tiles.xml", map); });
                if (err) return resp.send(500, err.message);

                resp.set("Content-Type", "image/png");
                resp.send(200, buffer);
            });
        });
    });
}

serve({ host: "0.0.0.0", port: 10000 }, route, function() {
    console.log("server started...");
});
