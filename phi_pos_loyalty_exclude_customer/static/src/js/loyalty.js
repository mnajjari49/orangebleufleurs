odoo.define('phi_pos_loyalty_exclude_customer.pos_loyalty', function (require) {
"use strict";

    var models = require('point_of_sale.models');
    var pos_models = require('pos_loyalty.pos_loyalty');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var utils = require('web.utils');

    var round_pr = utils.round_precision;
    var QWeb     = core.qweb;

    models.load_fields('res.partner','is_loyalty_exclude');

    var _super = models.Order;
    models.Order = models.Order.extend({
        get_won_points: function(){
            if (!this.pos.loyalty || !this.get_client() || this.get_client().is_loyalty_exclude) {
                return 0;
            }
            return _super.prototype.get_won_points.apply(this);
        },
        get_spent_points: function(){
            if (!this.pos.loyalty || !this.get_client() || this.get_client().is_loyalty_exclude) {
                return 0;
            }
            return _super.prototype.get_spent_points.apply(this);
        },

        get_new_points: function(){
            if (!this.pos.loyalty || !this.get_client() || this.get_client().is_loyalty_exclude) {
                return 0;
            }
            return _super.prototype.get_new_points.apply(this);
        },

        get_new_total_points: function(){
            if (!this.pos.loyalty || !this.get_client() || this.get_client().is_loyalty_exclude) {
                return 0;
            }
            return _super.prototype.get_new_total_points.apply(this);
        },

        get_spendable_points: function(){
            if (!this.pos.loyalty || !this.get_client() || this.get_client().is_loyalty_exclude) {
                return 0;
            }
            return _super.prototype.get_spendable_points.apply(this);
        },

        export_for_printing: function(){
            var json = _super.prototype.export_for_printing.apply(this,arguments);
            if (this.get_client().is_loyalty_exclude) {
                json.loyalty = {};
            }
            return json;
        },

    });

screens.OrderWidget.include({
    update_summary: function(){
        this._super();

        var order = this.pos.get_order();

        var $loypoints = $(this.el).find('.summary .loyalty-points');

        if(this.pos.loyalty && order.get_client() && !order.get_client().is_loyalty_exclude){
            var points_won      = order.get_won_points();
            var points_spent    = order.get_spent_points();
            var points_total    = order.get_new_total_points();
            $loypoints.replaceWith($(QWeb.render('LoyaltyPoints',{
                widget: this,
                rounding: this.pos.loyalty.rounding,
                points_won: points_won,
                points_spent: points_spent,
                points_total: points_total,
            })));
            $loypoints = $(this.el).find('.summary .loyalty-points');
            $loypoints.removeClass('oe_hidden');

            if(points_total < 0){
                $loypoints.addClass('negative');
            }else{
                $loypoints.removeClass('negative');
            }
        }else{
            $loypoints.empty();
            $loypoints.addClass('oe_hidden');
        }

        if (this.pos.loyalty &&
            this.getParent().action_buttons &&
            this.getParent().action_buttons.loyalty) {

            var rewards = order.get_available_rewards();
            this.getParent().action_buttons.loyalty.highlight(!!rewards.length);
        }
    },
});

});