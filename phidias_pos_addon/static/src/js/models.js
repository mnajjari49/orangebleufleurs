odoo.define('phidias_pos_addon.models', function (require) {
"use strict";

	var core = require('web.core');

	var _t = core._t;

    var gui = require('point_of_sale.gui');
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var DB = require('point_of_sale.DB');
    var keyboard = require('point_of_sale.keyboard').OnscreenKeyboardWidget;
    var rpc = require('web.rpc');
    var chrome = require('point_of_sale.chrome');
    var utils = require('web.utils');
    var PopupWidget = require('point_of_sale.popups');

    var QWeb = core.qweb;
    var round_di = utils.round_decimals;
    var round_pr = utils.round_precision;

    models.load_models({
        model: 'res.country.state',
        fields: [],
        context: [],
        loaded: function(self, states){
            self.states = [];
            _.each(states, function(state){
                self.states.push({
                    id: state.id,
                    value: state.name
                });
            });
        },
    });
    models.load_models({
        model: 'res.country',
        fields: [],
        context: [],
        loaded: function(self, countries){
            self.countries = [];
            _.each(countries, function(country){
                self.countries.push({
                    id: country.id,
                    value: country.name
                });
            });
        },
    });
    models.load_models({
        model:  'aspl.gift.card.type',
        fields: ['name'],
        loaded: function(self,card_type){
            self.card_type = card_type;
        },
    });
    models.load_models({
        model:  'aspl.gift.card',
        fields: ['card_no','card_value','card_type','customer_id','issue_date','expire_date','is_active'],
        domain: [['is_active', '=', true]],
        loaded: function(self,gift_cards){
            self.db.add_giftcard(gift_cards);
            self.set({'gift_card_order_list' : gift_cards});
        },
    });

    models.load_fields("res.partner", ['property_product_pricelist']);
    models.load_fields("product.product", ['type', 'invoice_policy']);
    models.load_fields("res.users", ['display_own_sales_order','display_amount_during_close_session']);
    models.load_fields("pos.payment.method", ['allow_for_gift_card','allow_for_credit']);

    chrome.HeaderButtonWidget.include({
        renderElement: function(){
            var self = this;
            this._super();
            if(this.action){
                this.$el.click(function(){
                    self.gui.show_popup('confirm_close_session_wizard');
                });
            }
        },
    });

    var _super_orderlines = models.Orderline.prototype;
     models.Orderline = models.Orderline.extend({
        set_from_credit: function(from_credit) {
            this.from_credit = from_credit;
        },
        get_from_credit: function() {
            return this.from_credit;
        },
        export_as_JSON: function() {
            var lines = _super_orderlines.export_as_JSON.call(this);
            var new_attr = {
                from_credit:this.get_from_credit(),
            }
            $.extend(lines, new_attr);
            return lines;
        },
     });
    
    var _super_Order = models.Order.prototype;
	models.Order = models.Order.extend({
	    initialize: function(attr,options){
	        var self = this;
	        var res = _super_Order.initialize.call(this, attr, options);
	        this.set({
	            'sale_order_name': false,
	            'invoice_name': false,
	            'order_id': false,
	            'shipping_address': false,
	            'invoice_address': false,
	            'sale_note': false,
	            'signature': false,
	            'inv_id': false,
	            'sale_order_date': false,
	            'edit_quotation': false,
	            'paying_sale_order': false,
	            'sale_order_pay': false,
	            'invoice_pay': false,
	            'sale_order_requested_date': false,
	            'invoice_id':false,
                'paying_order': false,
                type_for_credit: false,
                change_amount_for_credit: false,
                use_credit: false,
                amount_due: this.get_due() ? this.get_due() : 0.00,
                is_delivery: false,
                credit_detail: [],
                customer_credit:false,
	        });
            this.giftcard = [];
            this.recharge=[];
            this.redeem =[];
            this.date=[];
	        $('.js_edit_quotation').hide();
	    },
        set_paying_order: function(val){
            this.set('paying_order',val)
        },
        get_paying_order: function(){
            return this.get('paying_order')
        },
        set_user_name: function(user_id) {
            this.set('user_id', user_id);
        },
        get_user_name: function() {
            return this.get('user_id');
        },
        set_journal: function(statement_ids) {
            this.set('statement_ids', statement_ids)
        },
        get_journal: function() {
            return this.get('statement_ids');
        },
        set_credit_mode: function(credit_mode) {
            this.credit_mode = credit_mode;
        },
        get_credit_mode: function() {
            return this.credit_mode;
        },
        set_credit_detail: function(credit_detail) {
            var data = this.get('credit_detail')
            data.push(credit_detail);
            this.set('credit_detail',data);
        },
        get_credit_detail: function() {
            return this.get('credit_detail')
        },
	    set_sale_order_name: function(name){
			this.set('sale_order_name', name);
		},
		get_sale_order_name: function(){
			return this.get('sale_order_name');
		},
		set_invoice_name: function(name){
			this.set('invoice_name', name);
		},
		get_invoice_name: function(){
			return this.get('invoice_name');
		},
        set_free_data: function(freedata) {
            this.freedata = freedata;
        },
        get_free_data: function() {
            return this.freedata;
        },
        set_credit: function(credit){
            this.credit = credit;
        },
        get_credit: function(){
            return this.credit;
        },
        set_pos_reference: function(pos_reference) {
            this.set('pos_reference', pos_reference)
        },
        get_pos_reference: function() {
            return this.get('pos_reference')
        },
        set_type_for_credit: function(type_for_credit) {
            this.set('type_for_credit', type_for_credit);
        },
        get_type_for_credit: function() {
            return this.get('type_for_credit');
        },
        set_change_amount_for_credit: function(change_amount_for_credit) {
            this.set('change_amount_for_credit', change_amount_for_credit);
        },
        get_change_amount_for_credit: function() {
            return this.get('change_amount_for_credit');
        },
		export_as_JSON: function() {
            var submitted_order = _super_Order.export_as_JSON.call(this);

            var new_val = {
                signature: this.get_signature(),
                giftcard: this.get_giftcard() || false,
                redeem: this.get_redeem_giftcard() || false,
                recharge: this.get_recharge_giftcard() || false,
                old_order_id: this.get_order_id(),
                sequence: this.get_sequence(),
                pos_reference: this.get_pos_reference(),
                amount_due: this.get_due() ? this.get_due() : 0.00,
                credit_type: this.get_type_for_credit() || false,
                change_amount_for_credit: this.get_change_amount_for_credit() || false,
                // is_delivery: this.get_delivery() || false,
                credit_detail: this.get_credit_detail(),
            }
            $.extend(submitted_order, new_val);
            return submitted_order;
        },

		export_for_printing: function(){
            var orders = _super_Order.export_for_printing.call(this);
            var new_val = {
            	sale_order_name: this.get_sale_order_name() || false,
            	invoice_name: this.get_invoice_name() || false,
            	sale_note: this.get_sale_note() || '',
                signature: this.get_signature() || '',
                giftcard: this.get_giftcard() || false,
                recharge: this.get_recharge_giftcard() || false,
                redeem:this.get_redeem_giftcard() || false,
                free:this.get_free_data()|| false,
                
            };
            $.extend(orders, new_val);
            return orders;
        },
        set_sequence:function(sequence){
        	this.set('sequence',sequence);
        },
        get_sequence:function(){
        	return this.get('sequence');
        },
        set_order_id: function(order_id){
            this.set('order_id', order_id);
        },
        get_order_id: function(){
            return this.get('order_id');
        },
        set_amount_paid: function(amount_paid) {
            this.set('amount_paid', amount_paid);
        },
        get_amount_paid: function() {
            return this.get('amount_paid');
        },
        set_amount_return: function(amount_return) {
            this.set('amount_return', amount_return);
        },
        get_amount_return: function() {
            return this.get('amount_return');
        },
        set_amount_tax: function(amount_tax) {
            this.set('amount_tax', amount_tax);
        },
        get_amount_tax: function() {
            return this.get('amount_tax');
        },
        set_amount_total: function(amount_total) {
            this.set('amount_total', amount_total);
        },
        get_amount_total: function() {
            return this.get('amount_total');
        },
        set_company_id: function(company_id) {
            this.set('company_id', company_id);
        },
        get_company_id: function() {
            return this.get('company_id');
        },
        set_date_order: function(date_order) {
            this.set('date_order', date_order);
        },
        get_date_order: function() {
            return this.get('date_order');
        },
        
        set_shipping_address: function(val){
            this.set('shipping_address', val);
        },
        get_shipping_address: function() {
            return this.get('shipping_address');
        },
        set_invoice_address: function(val){
            this.set('invoice_address', val);
        },
        get_invoice_address: function() {
            return this.get('invoice_address');
        },
        set_sale_note: function(val){
            this.set('sale_note', val);
        },
        get_sale_note: function() {
            return this.get('sale_note');
        },
        set_signature: function(signature) {
            this.set('signature', signature);
        },
        get_signature: function() {
            return this.get('signature');
        },
        set_inv_id: function(inv_id) {
            this.set('inv_id', inv_id)
        },
        get_inv_id: function() {
            return this.get('inv_id');
        },
        set_sale_order_date: function(sale_order_date) {
            this.set('sale_order_date', sale_order_date)
        },
        get_sale_order_date: function() {
            return this.get('sale_order_date');
        },
        set_sale_order_requested_date: function(sale_order_requested_date) {
            this.set('sale_order_requested_date', sale_order_requested_date)
        },
        get_sale_order_requested_date: function() {
            return this.get('sale_order_requested_date');
        },
        set_edit_quotation: function(edit_quotation) {
            this.set('edit_quotation', edit_quotation)
        },
        get_edit_quotation: function() {
            return this.get('edit_quotation');
        },
        set_paying_sale_order: function(paying_sale_order) {
            this.set('paying_sale_order', paying_sale_order)
        },
        get_paying_sale_order: function() {
            return this.get('paying_sale_order');
        },
        set_sale_order_pay: function(sale_order_pay) {
            this.set('sale_order_pay', sale_order_pay)
        },
        get_sale_order_pay: function() {
            return this.get('sale_order_pay');
        },
        set_invoice_id: function(invoice_id) {
            this.set('invoice_id', invoice_id)
        },
        get_invoice_id: function() {
            return this.get('invoice_id');
        },
        set_invoice_pay: function(invoice_pay) {
            this.set('invoice_pay', invoice_pay)
        },
        get_invoice_pay: function() {
            return this.get('invoice_pay');
        },
        set_giftcard: function(giftcard) {
            this.giftcard.push(giftcard)
        },
        get_giftcard: function() {
            return this.giftcard;
        },
        set_recharge_giftcard: function(recharge) {
            this.recharge.push(recharge)
        },
        get_recharge_giftcard: function(){
            return this.recharge;
        },
        set_redeem_giftcard: function(redeem) {
            this.redeem.push(redeem)
        },
        get_redeem_giftcard: function() {
            return this.redeem;
        },
        remove_card:function(code){ 
            var redeem = _.reject(this.redeem, function(objArr){ return objArr.redeem_card == code });
            this.redeem = redeem
        },
        set_customer_credit:function(){
            var data = this.get('customer_credit')
            data = true;
            this.set('customer_credit',data);
        },
        get_customer_credit: function() {
            return this.get('customer_credit')
        },        
        add_paymentline_by_journal: function(cashregister) {
            this.assert_editable();
            var newPaymentline = new models.Paymentline({}, {order: this, cashregister:cashregister, pos: this.pos})
            var newPaymentline = new models.Paymentline({}, {order: this, cashregister:cashregister, pos: this.pos})
            if((this.pos.get_order().get_due() > 0) && (this.pos.get_order().get_client().remaining_credit_amount > this.pos.get_order().get_due())) {
                newPaymentline.set_amount(Math.min(this.pos.get_order().get_due(),this.pos.get_order().get_client().remaining_credit_amount));
            }else if((this.pos.get_order().get_due() > 0) && (this.pos.get_order().get_client().remaining_credit_amount < this.pos.get_order().get_due())) {
                newPaymentline.set_amount(Math.min(this.pos.get_order().get_due(),this.pos.get_order().get_client().remaining_credit_amount));
            }else if(this.pos.get_order().get_due() > 0) {
                    newPaymentline.set_amount( Math.max(this.pos.get_order().get_due(),0) );
            }
            this.paymentlines.add(newPaymentline);
            this.select_paymentline(newPaymentline);
        },
        set_records: function(records) {
            this.records = records;
        },
        get_records: function() {
            return this.records;
        },
        get_remaining_credit: function(){
            var credit_total = 0.00,use_credit = 0.00;
            var self = this;
            var partner = self.pos.get_client();
            if(partner){
                var params = {
                    model: 'account.move',
                    method: 'get_outstanding_info',
                    args: [partner.id,self.pos.config.enable_journal_id[0]]
                }
                rpc.query(params, {async: false}).then(function(res){
                    if(res){
                        partner['deposite_info'] = res;
                        _.each(res['content'], function(value){
                              self.pos.amount = value['amount'];
                        });
                    }
                });
                var client_account = partner.deposite_info['content'];
                var credit_detail = this.get_credit_detail();
                _.each(client_account, function(values){
                    credit_total = values.amount + credit_total
                });
                if(credit_detail && credit_detail.length > 0 && client_account && client_account.length > 0){
                    for (var i=0;i<client_account.length;i++){
                        for(var j=0;j<credit_detail.length;j++){
                            if(client_account[i].id == credit_detail[j].journal_id){
                                use_credit += Math.abs(credit_detail[j].amount)
                            }
                        }
                    }
                }
            }
            if(use_credit){
                return  credit_total - use_credit;
            } else{
                return false
            }
        },
        
	});

	var _super_posmodel = models.PosModel;
	models.PosModel = models.PosModel.extend({
		load_server_data: function(){
			var self = this;
			var product_index = _.findIndex(this.models, function (model) {
                return model.model === "product.product";
            });
            var product_model = this.models[product_index];
            product_model.domain = [['sale_ok','=',true]];
            var partner_index = _.findIndex(this.models, function (model) {
                return model.model === "res.partner";
            });
            var partner_model = this.models[partner_index];
            partner_model.domain = [];
			var loaded = _super_posmodel.prototype.load_server_data.call(this);
			return loaded.then(function(){
				var date = new Date();
				var domain;
				var start_date;
				self.domain_sale_order = [];
				if(date){
                    if(self.config.sale_order_last_days){
                        date.setDate(date.getDate() - self.config.sale_order_last_days);
                    }
                    start_date = date.toJSON().slice(0,10);
                    self.domain_sale_order.push(['create_date' ,'>=', start_date]);
                } else {
                    domain = [];
                }
                self.domain_sale_order.push(['state','not in',['cancel']]);
                var params = {
					model: 'sale.order',
					method: 'search_read',
					domain: self.domain_sale_order
				}
				rpc.query(params, {async: false}).then(function(orders){
					self.db.add_sale_orders(orders);                    
					if(self.user.display_own_sales_order){
						var user_orders = [];
						orders.map(function(sale_order){
							if(sale_order.user_id[0] == self.user.id){
								user_orders.push(sale_order);
							}
						});
						orders = user_orders;
					}
					orders.map(function(sale_order){
						if(sale_order.date_order){
							var dt = new Date(new Date(sale_order.date_order) + "GMT");
						   	var n = dt.toLocaleDateString(); 
						   	    var crmon = self.addZero(dt.getMonth()+1);
						   	    var crdate = self.addZero(dt.getDate());
						   	    var cryear = dt.getFullYear();
						   	    var crHour = self.addZero(dt.getHours());
						   	    var crMinute = self.addZero(dt.getMinutes());
						   	    var crSecond = self.addZero(dt.getSeconds());
						   	 sale_order.date_order = cryear + '/' + crmon +'/'+ crdate +' '+crHour +':'+ crMinute +':'+ crSecond;
						}
					});
					self.set({'pos_sale_order_list' : orders});
				});
                if(self.config.enable_credit){
                    var from_date = moment().locale('en').format('YYYY-MM-DD')
                    if(self.config.last_days){
                        from_date = moment().subtract(self.config.last_days, 'days').locale('en').format('YYYY-MM-DD');
                    }
                    self.domain_as_args = [['state','not in',['cancel']], ['create_date', '>=', from_date]];
                    var params = {
                        model: 'pos.order',
                        method: 'ac_pos_search_read',
                        args: [{'domain': self.domain_as_args}],
                    }
                    rpc.query(params, {async: false}).then(function(orders){
                        if(orders.length > 0){
                            self.db.add_orders(orders);
                            self.set({'pos_order_list' : orders});
                        }
                    });
                }
			});
		},
       
		addZero: function(value){
			if (value < 10) {
    			value = "0" + value;
    	    }
    	    return value;
    	},
		create_sale_order: function(delivery_done){
            var self = this;
            var order = this.get_order();
	        var currentOrderLines = order.get_orderlines();
	        var customer_id = order.get_client().id;
	        var location_id = self.config.stock_location_id ? self.config.stock_location_id[0] : false;
	        var paymentlines = false;
	        var paid = false;
	        var confirm = false;
            var orderLines = [];
            for(var i=0; i<currentOrderLines.length;i++){
                orderLines.push(currentOrderLines[i].export_as_JSON());
            }
            if(self.config.sale_order_operations === "paid" || order.get_order_id() || order.get_edit_quotation()) {
                paymentlines = [];
                _.each(order.get_paymentlines(), function(paymentline){
                    paymentlines.push({
                        'journal_id': paymentline.payment_method['id'],
                        'amount': paymentline.get_amount(),
                    })
                });
                paid = true
            }
            if(self.config.sale_order_operations === "confirm" && !order.get_edit_quotation()){
                confirm = true;
            }
            var vals = {
                orderlines: orderLines,
                customer_id: customer_id,
                location_id: location_id,
                journals: paymentlines,
                pricelist_id: order.pricelist.id || false,
                partner_shipping_id: parseInt(order.get_shipping_address() || customer_id),
                partner_invoice_id: parseInt(order.get_invoice_address() || customer_id),
                note: order.get_sale_note() || "",
                signature: order.get_signature() || "",
                inv_id: order.get_inv_id() || false,
                order_date: order.get_sale_order_date() || false,
                requested_date: order.get_sale_order_requested_date() || false,
                sale_order_id: order.get_order_id() || false,
                edit_quotation: order.get_edit_quotation() || false,
                warehouse_id: self.config.warehouse_id ? self.config.warehouse_id[0] : false,
                confirm: confirm,
                paid: paid,
                delivery_done:delivery_done,
                sale_redeem: order.get_redeem_giftcard() || false,
                credit_detail: order.get_credit_detail(),
            }
            var params = {
                model: 'sale.order',
                method: 'create_sales_order',
                args: [vals],
            }
			rpc.query(params, {async: false}).then(function(sale_order){
                if(sale_order && sale_order[0]){
                    sale_order = sale_order[0];
                    if(paid && order.get_paying_sale_order()){
                        $('#btn_so').show();
                        if(sale_order){
                            order.set_sale_order_name(sale_order.name);
                        }                       
                        self.gui.show_screen('receipt');
                    } else{
                        var edit = order.get_edit_quotation();
                        order.finalize();
                        var url = window.location.origin + '/web#id=' + sale_order.id + '&view_type=form&model=sale.order';
                        self.gui.show_popup('saleOrder', {'url':url, 'name':sale_order.name, 'edit': edit});

                    }
                    var record_exist = false;
                    _.each(self.get('pos_sale_order_list'), function(existing_order){
                        if(existing_order.id === sale_order.id){
                            _.extend(existing_order, sale_order);
                            record_exist = true;
                        }
                    });
                    if (!record_exist){
                        var exist = _.findWhere(self.get('pos_sale_order_list'), {id: sale_order.id});
                        if(!exist){
                            var defined_orders = self.get('pos_sale_order_list');
                            var new_orders = [sale_order].concat(defined_orders);
                            self.db.add_sale_orders(new_orders);
                            new_orders.map(function(new_order){
                            	var dt = new Date(new Date(new_order.date_order) + "GMT");
    						   		var n = dt.toLocaleDateString();
	    						   	var crmon = self.addZero(dt.getMonth()+1);
							   	    var crdate = self.addZero(dt.getDate());
							   	    var cryear = dt.getFullYear();
							   	    var crHour = self.addZero(dt.getHours());
							   	    var crMinute = self.addZero(dt.getMinutes());
							   	    var crSecond = self.addZero(dt.getSeconds());
    						   	 new_order.date_order = cryear + '/' + crmon +'/'+ crdate +' '+crHour +':'+ crMinute +':'+ crSecond;
                            });
                            self.set({'pos_sale_order_list': new_orders})
                        }

                    }
                }
            });
        },
        get_customer_due: function(partner){
            var self = this;
            var domain = [];
            var amount_due = 0;
            self.set({'amount_due': 0})
            domain.push(['partner_id', '=', partner.id]);


            return new Promise(function (resolve, reject) {
               var params = {
                    model: 'pos.order',
                    method: 'search_read',
                    domain: domain,                    
               }
               rpc.query(params, {
                    timeout: 3000,
                    shadow: true,
               })
               .then(function (orders) {
                    if(orders){
                        var filtered_orders = orders.filter(function(o){return (o.amount_total - o.amount_paid) > 0})
                        for(var i = 0; i < filtered_orders.length; i++){
                            amount_due = amount_due + filtered_orders[i].amount_due;
                        }
                        self.set({'amount_due': amount_due})
                        resolve();
                    }else {
                        reject();
                    }
               }, function (type, err) { reject(); });
            });
        },
	});

    var _super_paymentline = models.Paymentline.prototype;
    models.Paymentline = models.Paymentline.extend({
        set_giftcard_line_code: function(code) {
            this.code = code;
        },
        get_giftcard_line_code: function(){
            return this.code;
        },
        set_freeze: function(freeze) {
            this.freeze = freeze;
        },
        get_freeze: function(){
            return this.freeze;
        },
    });

});