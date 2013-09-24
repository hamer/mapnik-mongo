"use strict";
var mapnik = require("mapnik"), pool = require("generic-pool").Pool;

mapnik.register_datasources("..");
mapnik.register_fonts("/usr/share/fonts/truetype/ttf-dejavu");

var mercator = (function(mapnik) {
    var proj4 = "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +over";
    var mercator = new mapnik.Projection(proj4);

    /**
     * SphericalMercator constructor: precaches calculations
     * for fast tile lookups
     */
    function SphericalMercator() {
        var self = this, size = 256;
        self.Bc = [];
        self.Cc = [];
        self.zc = [];
        self.Ac = [];
        self.DEG_TO_RAD = Math.PI / 180;
        self.RAD_TO_DEG = 180 / Math.PI;
        self.size = 256;
        self.levels = 18;
        self.proj4 = proj4;
        for (var d = 0; d < self.levels; d++) {
            self.Bc.push(size / 360);
            self.Cc.push(size / (2 * Math.PI));
            self.zc.push(size / 2);
            self.Ac.push(size);
            size *= 2;
        }
    }

    /**
     * Get the max of the first two numbers and the min of that and the third
     *
     * @param {Number} a the first number.
     * @param {Number} b the second number.
     * @param {Number} c the third number.
     * @return {Number}
     */
    SphericalMercator.prototype.minmax = function(a, b, c) {
        return Math.min(Math.max(a, b), c);
    };

    /**
     * Convert lat lon to screen pixel value
     *
     * @param {Array} px [lat lon] array of geographic coordinates.
     * @param {Number} zoom number of the zoom level.
     */
    SphericalMercator.prototype.ll_to_px = function(ll, zoom) {
        var self = this;
        var d = self.zc[zoom];
        var f = self.minmax(Math.sin(self.DEG_TO_RAD * ll[1]), -0.9999, 0.9999);
        var x = Math.round(d + ll[0] * self.Bc[zoom]);
        var y = Math.round(d + 0.5 * Math.log((1 + f) / (1 - f)) * (-self.Cc[zoom]));
        return [ x, y ];
    };

    /**
     * Convert screen pixel value to lat lon
     *
     * @param {Array} px [x y] array of geographic coordinates.
     * @param {Number} zoom number of the zoom level.
     */
    SphericalMercator.prototype.px_to_ll = function(px, zoom) {
        var self = this;
        var zoom_denom = self.zc[zoom];
        var g = (px[1] - zoom_denom) / (-self.Cc[zoom]);
        var lat = (px[0] - zoom_denom) / self.Bc[zoom];
        var lon = self.RAD_TO_DEG * (2 * Math.atan(Math.exp(g)) - 0.5 * Math.PI);
        return [ lat, lon ];
    };

    /**
     * Convert tile xyz value to Mapnik envelope
     *
     * @param {Number} x latitude number.
     * @param {Number} y longitude number.
     * @param {Number} zoom zoom.
     * @param {Boolean} tms_style whether to compute a tms tile.
     * @return Object Mapnik envelope.
     */
    SphericalMercator.prototype.xyz_to_envelope = function(x, y, zoom, TMS_SCHEME) {
        if (TMS_SCHEME) {
            y = (Math.pow(2, zoom) - 1) - y;
        }
        var ll = [ x * this.size, (y + 1) * this.size ];
        var ur = [ (x + 1) * this.size, y * this.size ];
        var bbox = this.px_to_ll(ll, zoom).concat(this.px_to_ll(ur, zoom));
        return mercator.forward(bbox);
    };

    return new SphericalMercator();
})(mapnik);

var maps = {
    max: 5,
    pools: {},
    acquire: function(id, options, callback) {
        var self = this;
        if (!self.pools[id]) {
            self.pools[id] = pool({
                name: id,
                create: options.create,
                destroy: options.destroy,
                max: self.max,
                idleTimeoutMillis: 5000,
                log: false
            });
        }

        self.pools[id].acquire(callback, options.priority);
    },
    release: function(id, obj) {
        var self = this;
        if (self.pools[id])
            self.pools[id].release(obj);
    }
};

function acquire(id, callback) {
    maps.acquire(id, {
        create: function(callback) {
            var obj = new mapnik.Map(256, 256);
            obj.load(id, { strict: true }, callback);
        },
        destroy: function() {}
    }, callback);
}

function render(name, x, y, z, callback) {
    acquire(name, function(err, map) {
        if (err)
            return callback(err);

        map.zoomToBox(mercator.xyz_to_envelope(+x, +y, +z));
        map.render(new mapnik.Image(256, 256), function(err, img) {
            if (err)
                return callback(new Error([ "renderi", err.message ].join(": ")));

            img.encode("png", function(err, buffer) {
                process.nextTick(function() { maps.release(name, map); });

                if (err)
                    return callback(new Error([ "encode", err.message ].join(": ")));

                callback(null, buffer);
            });
        });
    });
}

module.exports = render;
