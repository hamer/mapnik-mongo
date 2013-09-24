"use strict";

var express = require("express"), http = require("http");
var render = require("./tile-render");

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

function route(app) {
    app.get("/map/:z/:x/:y.png", function(req, resp) {
        var p = req.params;
        console.log("render: ", [ +p.x, +p.y, +p.z ]);
        render("map.xml", +p.x, +p.y, +p.z, function(err, buffer) {
            if (err) return resp.send(500, err.message);

            resp.set("Content-Type", "image/png");
            resp.send(200, buffer);
        });
    });
}

serve({ host: "0.0.0.0", port: 10000 }, route, function() {
    console.log("server started...");
});
