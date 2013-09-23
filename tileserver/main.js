(function ($, undefined) {
    "use strict";

    function req(url, param, callback) {
        if (typeof(param) === "function") {
            callback = param;
            param = null;
        }

        $.ajax({
            url: param ? [ url, $.param(param) ].join("?") : url,
            type: "GET",
            success: callback
        });
    }

    $(document).ready(function() {
        // create a map in the "map" div, set the view to a given place and zoom
        var map = L.map('map').setView([ 0, 0 ], 2);

        // add an OpenStreetMap tile layer
        L.tileLayer("/map/{z}/{x}/{y}.png", {
            attribution: "&copy; <a href=\"http://evologics.de/\">EvoLogics</a> contributors"
        }).addTo(map);
    });
})(jQuery);

