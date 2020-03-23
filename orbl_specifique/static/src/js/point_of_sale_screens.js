odoo.define('orbl_specifique.screens', function (require) {
"use strict";

    var core    = require('web.core');
    var _t      = core._t;

    var screens = require('point_of_sale.screens');
    
    screens.ClientListScreenWidget.include({
        save_client_details: function (partner) {
            var self = this;

            var fields = {};
            this.$('.client-details-contents .detail').each(function(idx,el){
                if (self.integer_client_details.includes(el.name)){
                    var parsed_value = parseInt(el.value, 10);
                    if (isNaN(parsed_value)){
                        fields[el.name] = false;
                    }
                    else{
                        fields[el.name] = parsed_value
                    }
                }
                else{
                    fields[el.name] = el.value || false;
                }
            });

            if (!fields.email) {
                this.gui.show_popup('error',_t("L'adresse email est obligatoire"));
                return;
            }

            if (!fields.phone) {
                this.gui.show_popup('error',_t("Le numéro de téléphone est obligatoire"));
                return;
            }

            this._super(partner);
        },
    });
});