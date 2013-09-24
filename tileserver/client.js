(function ($, undefined) {
    "use strict";

    $(document).ready(function() {
        var map = L.map('map').setView([ 0, 0 ], 2);
        L.tileLayer("/map/{z}/{x}/{y}.png").addTo(map);
    });
})(jQuery);

