odoo.define('phi_pos_loyalty_won_lost.pos_loyalty', function (require) {
"use strict";

    var models = require('point_of_sale.models');
    var pos_models = require('pos_loyalty.pos_loyalty');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var utils = require('web.utils');

    var round_pr = utils.round_precision;
    var QWeb     = core.qweb;


    var _super = models.Order;
    models.Order = models.Order.extend({
        export_as_JSON: function(){
            var json = _super.prototype.export_as_JSON.apply(this,arguments);
            json.loyalty_points_won = this.get_won_points();
            json.loyalty_points_lost = this.get_spent_points();
            return json;
        },
    });
});