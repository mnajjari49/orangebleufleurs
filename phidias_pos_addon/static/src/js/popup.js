odoo.define('phidias_pos_addon.popup', function (require) {
	"use strict";

	var PopupWidget = require('point_of_sale.popups');
    var models = require('point_of_sale.models');
	var gui = require('point_of_sale.gui');
	var core = require('web.core');
	var rpc = require('web.rpc');
    var framework = require('web.framework');
    var QWeb = core.qweb;
	var _t = core._t;

	var SaleOrderConfirmPopupWidget = PopupWidget.extend({
	    template: 'SaleOrderConfirmPopupWidget',
	});
	gui.define_popup({name:'saleOrder', widget: SaleOrderConfirmPopupWidget});

    var SaleOrderPopup = PopupWidget.extend({
	    template: 'SaleOrderPopup',
	    show: function(options){
	        var self = this;
	        this._super(options);
	        this.delivery_done = options.delivery_done ? true : false;
	        var order = self.pos.get_order();
	        var options = options || {};
	        this.sale_order_button = options.sale_order_button ||
	        self.pos.gui.screen_instances.products.action_buttons.EditQuotationButton || false
	        self.payment_obj = self.pos.chrome.screens.payment || false;            	        
	        if (order.get_client()){
                self.get_client_detail(order.get_client()).then(function(){
                    self.contacts = self.pos.get('contacts');
                    self.renderElement();
                });
	        }
	        self.renderElement();
	        if(order.get_edit_quotation()){
	            if(order.get_sale_order_date()){
	                var date_order = moment(order.get_sale_order_date(), 'YYYY-MM-DD HH:mm');
                    $('#orderdate-datepicker').val(date_order.format('YYYY-MM-DD HH:mm'));
                }
	            if(order.set_sale_order_requested_date()){
	                var date_order = moment(order.get_sale_order_requested_date(), 'YYYY-MM-DD HH:mm');
                    $('#requesteddate-datepicker').val(date_order.format('YYYY-MM-DD HH:mm'));
                }
                var shipping_contact = _.find(self.contacts, function(o){
                    return o.id == order.get_shipping_address();
                })
                $('.shipping_contact_selection').val(shipping_contact ? shipping_contact.id : 0);
                var invoice_contact = _.find(self.contacts, function(o){
                    return o.id == order.get_invoice_address();
                })
                $('.invoicing_contact_selection').val(invoice_contact ? invoice_contact.id : 0);
	        }

            $('textarea.sale_order_note').focus(function() {
                if(self.payment_obj){
                     $('body').off('keypress', self.keyboard_handler);
                     $('body').off('keydown', self.keyboard_keydown_handler);                     
                 }
            });
	    },
	    get_client_detail: function(partner){
	        var self = this;
            return new Promise(function (resolve, reject) {
               var params = {
    				model: 'res.partner',
    				method: 'search_read',
    				domain: [['parent_id', '=', partner.id]],
    				fields: self.fieldNames,
    		   }
               rpc.query(params, {
                    timeout: 3000,
                    shadow: true,
               })
               .then(function (contacts) {
                    if(contacts){
                        self.pos.set({'contacts': contacts})
                        resolve();
                    }else {
                        reject();
                    }
               }, function (type, err) { reject(); });
            });
	    },
	    click_confirm: function(){
	        var self = this;
	        var order = self.pos.get_order();
	        var value = self.$("#signature").jSignature("getData", "image");
	        if(value && value[1]){
                order.set_signature(value[1]);
            }
	        if($('.sale_order_note').val()){
	            order.set_sale_note($.trim($('.sale_order_note').val()));
	        }
	        order.set_sale_order_date($('#orderdate-datepicker').val() || false);
	        order.set_sale_order_requested_date($('#requesteddate-datepicker').val() || false)
	        self.shipping_contact().then(function(){
	            self.invoice_contact().then(function(){
	                if(self.sale_order_button){
                        self.sale_order_button.renderElement();
                    }
                    if(self.payment_obj){
                        order.set_paying_sale_order(true);
                    }
                    self.gui.close_popup();
                    self.pos.create_sale_order(self.delivery_done);
	            });
            });
	    },
	    click_cancel: function(){
	        var self = this;
	        if(self.payment_obj){                
                $('#btn_so').show();
            }
            this.gui.close_popup();
	    },
	    renderElement: function(){
	        var self = this;
	        this._super();
			$('#orderdate-datepicker').datetimepicker({format:'Y-m-d H:i'}).val(new moment ().format("YYYY-MM-DD HH:mm"));
			$('#requesteddate-datepicker').datetimepicker({format:'Y-m-d H:i'}).val(new moment ().format("YYYY-MM-DD HH:mm"));
            $(".tabs-menu a").click(function(event) {                
                event.preventDefault();
                $(this).parent().addClass("current");
                $(this).parent().siblings().removeClass("current");
                var tab = $(this).attr("href");
                $(".tab-content").not(tab).css("display", "none");
                $(tab).fadeIn();
                $('body').off('keypress', self.payment_obj.keyboard_handler);
                $('body').off('keydown', self.payment_obj.keyboard_keydown_handler);
            });
            $(".tabs-menu .signature_tab").click(function(event) {
                if(!self.$("#signature").jSignature("getData", "image")){
                    self.$("#signature").jSignature();
                }
            });
            this.$('.clear').click(function(){
	        	self.$("#signature").jSignature("reset");
	        });
            $('.invoice_diff_address').click(function(){
                if($(this).prop('checked')){
                    if(self.payment_obj){
                        $('body').off('keypress', self.payment_obj.keyboard_handler);
                        $('body').off('keydown', self.payment_obj.keyboard_keydown_handler);                        
                    }
                    $('.invoicing_contact_selection').attr({'disabled': 'disabled'});
                    $('div.invoice_create_contact').show();
                } else {
                    $('.invoicing_contact_selection').removeAttr('disabled');
                    $('div.invoice_create_contact').hide();
                }
            });
            $('.ship_diff_address').click(function(){
                if($(this).prop('checked')){
                    if(self.payment_obj){
                        $('body').off('keypress', self.payment_obj.keyboard_handler);
                        $('body').off('keydown', self.payment_obj.keyboard_keydown_handler);
                    }
                    $('.shipping_contact_selection').attr({'disabled': 'disabled'});
                    $('div.ship_create_contact').show();
                } else {
                    $('.shipping_contact_selection').removeAttr('disabled');
                    $('div.ship_create_contact').hide();
                }
            });
            $('.ship_create_contact').find('.client_state').autocomplete({
				source: self.pos.sale_states || false,
				select: function (event, ui) {
				    self.shipping_state = ui.item.id;
					return ui.item.value
				}
			});
			$('.ship_create_contact').find('.client_country').autocomplete({
				source: self.pos.ship_countries || false,
				select: function (event, ui) {
				    self.shipping_country = ui.item.id;
					return ui.item.value
				}
			});
			$('.invoice_create_contact').find('.client_state').autocomplete({
				source: self.pos.sale_states || false,
				select: function (event, ui) {
				    self.invoice_state = ui.item.id;
					return ui.item.value
				}
			});
			$('.invoice_create_contact').find('.client_country').autocomplete({
				source: self.pos.ship_countries || false,
				select: function (event, ui) {
				    self.invoice_country = ui.item.id;
					return ui.item.value
				}
			});
	    },
	    get_diff_shipping_address: function(){
	        var self = this;
	        var order = self.pos.get_order();
	        var shipping_contact = $('.shipping_contact_selection option:selected').val();
	        if(shipping_contact > 0 && !$('.ship_diff_address').prop('checked')){
                order.set_shipping_address(shipping_contact);
                return true;
	        } else if($('.ship_diff_address').prop('checked')){
	        	var name = $('.ship_create_contact').find('.client_name');
	        	if(!name.val()){
	        	    $(name).attr('style', 'border: thin solid red !important');
	        	    return false
	        	}
	            var state = self.shipping_state || false;
	            var country = self.shipping_country || false;
	            var vals = {
            		'name': $('.ship_create_contact').find('.client_name').val(),
	                'email': $('.ship_create_contact').find('.client_email').val(),
	                'city': $('.ship_create_contact').find('.client_city').val(),
	                'state_id':  state,
	                'zip': $('.ship_create_contact').find('.client_zip').val(),
	                'country_id':  country,
	                'mobile': $('.ship_create_contact').find('.client_mobile').val(),
	                'phone': $('.ship_create_contact').find('.client_phone').val(),
	                'parent_id': order.get_client().id,
	                'type': 'delivery',
                }
                self.get_diff_shipping_address(vals).then(function(){
                    var diff_address = self.pos.get('diff_address');
                    order.set_shipping_address(diff_address);
                });
	        }
	        return true;
	    },
	    shipping_contact: function(vals){
	        var self = this;
	        var order = self.pos.get_order();
            return new Promise(function (resolve, reject) {
                var shipping_contact = $('.shipping_contact_selection option:selected').val();
                if(shipping_contact > 0 && !$('.ship_diff_address').prop('checked')){
                    order.set_shipping_address(shipping_contact);
                    resolve();
                } else if($('.ship_diff_address').prop('checked')){
                    var name = $('.ship_create_contact').find('.client_name');
                    if(!name.val()){
                        $(name).attr('style', 'border: thin solid red !important');
                        reject();
                    }
                    var state = self.shipping_state || false;
                    var country = self.shipping_country || false;
                    var vals = {
                        'name': $('.ship_create_contact').find('.client_name').val(),
                        'email': $('.ship_create_contact').find('.client_email').val(),
                        'city': $('.ship_create_contact').find('.client_city').val(),
                        'state_id':  state,
                        'zip': $('.ship_create_contact').find('.client_zip').val(),
                        'country_id':  country,
                        'mobile': $('.ship_create_contact').find('.client_mobile').val(),
                        'phone': $('.ship_create_contact').find('.client_phone').val(),
                        'parent_id': order.get_client().id,
                        'type': 'delivery',
                    }
                   var params = {
                        model: 'res.partner',
                        method: 'create',
                        args: [vals],
                    }
                   rpc.query(params, {
                        timeout: 3000,
                        shadow: true,
                   })
                   .then(function (res) {
                        if(res){
                            order.set_shipping_address(res);
                            resolve();
                        }else {
                            reject();
                        }
                   }, function (type, err) { reject(); });
                }else{
                    resolve();
                }
            });
	    },
	    invoice_contact: function(){
	        var self = this;
	        var order = self.pos.get_order();
            return new Promise(function (resolve, reject) {
                var invoice_contact = $('.invoicing_contact_selection option:selected').val();
                if(invoice_contact > 0 && !$('.invoice_diff_address').prop('checked')){
                    order.set_invoice_address(invoice_contact);
                    resolve();
                } else if($('.invoice_diff_address').prop('checked')){
                    var name = $('.invoice_create_contact').find('.client_name');
                    if(!name.val()){
                        $(name).attr('style', 'border: thin solid red !important');
                        reject();
                    }
                    var state = self.invoice_state || false;
                    var country = self.invoice_country || false;
                    var vals = {
                        'name': $('.invoice_create_contact').find('.client_name').val(),
                        'email': $('.invoice_create_contact').find('.client_email').val(),
                        'city': $('.invoice_create_contact').find('.client_city').val(),
                        'state_id':  state,
                        'zip': $('.invoice_create_contact').find('.client_zip').val(),
                        'country_id':  country,
                        'mobile': $('.invoice_create_contact').find('.client_mobile').val(),
                        'phone': $('.invoice_create_contact').find('.client_phone').val(),
                        'parent_id': order.get_client().id,
                        'type': 'invoice',
                    }
                     var params = {
                        model: 'res.partner',
                        method: 'create',
                        args: [vals],
                    }
                   rpc.query(params, {
                        timeout: 3000,
                        shadow: true,
                   })
                   .then(function (res) {
                        if(res){
                            order.set_shipping_address(res);
                            resolve();
                        }else {
                            reject();
                        }
                   }, function (type, err) { reject(); });
                }else{
                    resolve();
                }
            });
	    },
	});
	gui.define_popup({name:'sale_order_popup', widget: SaleOrderPopup});

	var SOConfirmPopup = PopupWidget.extend({
	    template: 'SOConfirmPopup',
	    show: function(options){
	       var self = this;
	       this.options = options;
	       this.deliver_products = options.deliver_products;
	       this._super(options);
	    },
	    click_confirm: function(){
	       var self = this;
	       self.gui.show_popup('sale_order_popup', {'sale_order_button': self.options.sale_order_buttonm,'delivery_done':true});
	    },
	});
	gui.define_popup({name:'so_confirm_popup', widget: SOConfirmPopup});

	var SOReturnPopup = PopupWidget.extend({
        template: 'SOReturnPopup',
        show: function(options){
            var self = this;
            this._super();
            this.lines = options.lines || "";
            this.sale_order = options.sale_order || "";
            this.renderElement();
        },
        renderElement: function(){
            var self = this;
            self._super();
            $('.js_return_qty').click(function(ev){
                ev.preventDefault();
                var $link = $(ev.currentTarget);
                var $input = $link.parent().parent().find("input");
                var min = parseFloat($input.data("min") || 1);
                var max = parseFloat($input.data("max") || $input.val());
                var total_qty = parseFloat($input.data("total-qty") || 0);
                var quantity = ($link.has(".fa-minus").length ? -1 : 1) + parseFloat($input.val(),10);
                $input.val(quantity > min ? (quantity < max ? quantity : max) : min);
                $input.change();
                return false;
            });
            $('.remove_line').click(function(event){
                $(this).parent().remove();
            });
        },
        click_confirm: function(){
            var self = this;
            var filter_records = [];
            $(".popup-product-return-list tbody tr").map(function(){
                var id = Number($(this).attr('id'));
                var qty = Number($(".popup-product-return-list tbody tr#"+id+"").find('.js_quantity').val());
                var line = _.find(self.lines, function(obj) { return obj.id == id });
                if(qty && qty > 0 && line){
                    line['return_qty'] = qty;
                    if(line){
                        filter_records.push(line);
                    }
                }
            });
            if(filter_records && filter_records[0]){
                var self = this;
	            var params = {
    				model: 'sale.order',
    				method: 'return_sale_order',
    				args: [filter_records],
    			}
	            rpc.query(params, {async: false}).then(function(result){
                    if(result){
                        alert("Sale order return successfully!");
                        self.gui.close_popup();
                    }
                });
            }
        },
        click_cancel: function(){
            this.gui.close_popup();
        }
    });
    gui.define_popup({name:'sale_return_popup', widget: SOReturnPopup});

    var CreateCardPopupWidget = PopupWidget.extend({
        template: 'CreateCardPopupWidget',

        show: function(options){
            var self = this;
            this._super(options);
            self.partner_id = '';
            options = options || {};
            self.panding_card = options.card_data || false;
            this.renderElement();
            $('#card_no').focus();
            var timestamp = new Date().getTime()/1000;
            var partners = this.pos.db.all_partners;
            var partners_list = [];
            if(self.pos.config.default_exp_date && !self.panding_card){
                var date = new Date();
                date.setMonth(date.getMonth() + self.pos.config.default_exp_date);
                var new_date = date.getFullYear()+ "/" +(date.getMonth() + 1)+ "/" +date.getDate();
                self.$('#text_expire_date').val(new_date);
            }
            if(partners && partners[0]){
                partners.map(function(partner){
                    partners_list.push({
                        'id':partner.id,
                        'value':partner.name,
                        'label':partner.name,
                    });
                });
                $('#select_customer').keypress(function(e){
                    $('#select_customer').autocomplete({
                        source:partners_list,
                        select: function(event, ui) {
                            self.partner_id = ui.item.id;
                        },
                    });
                });
                if(self.panding_card){
                    self.partner_id = self.panding_card.giftcard_customer;
                    $('#checkbox_paid').prop('checked',true);
                }
            }
            $("#text_amount").keypress(function (e) {
                if (e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && e.which != 46) {
                    return false;
               }
            });
            if(self.pos.config.manual_card_number && !self.panding_card){
                $('#card_no').removeAttr("readonly");
                $("#card_no").keypress(function (e) {
                    if (e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && e.which != 46) {
                        return false;
                   }
                });
            } else if(!self.panding_card){
                $('#card_no').val(window.parseInt(timestamp));
                $('#card_no').attr("readonly", "readonly");
            }
            var partner = null;
            for ( var j = 0; j < self.pos.partners.length; j++ ) {
                partner = self.pos.partners[j];
                self.partner=this.partner
            }
        },

        click_confirm: function(){
            var self = this;
            var move = true;
            var order = self.pos.get_order();
            if($('#select_customer').val() == ''){
                self.partner_id = false;
            }
            var checkbox_paid = document.getElementById("checkbox_paid");
            var expire_date = moment($('#text_expire_date').val(), 'YYYY/MM/DD').format('YYYY-MM-DD');
            var select_customer = self.partner_id;
            var select_card_type = $('#select_card_type').val();
            var card_number = $('#card_no').val();
            if(!card_number){
                alert("Enter gift card number");
                return;
            } else{
                var params = {
                        model: 'aspl.gift.card',
                        method: 'search_read',
                        domain: [['card_no', '=', $('#card_no').val()]],
                    }
                rpc.query(params, {async: false}).then(function(gift_count){
                    gift_count = gift_count.length;
                    if(gift_count > 0){
                        $('#card_no').css('border', 'thin solid red');
                        move = false;
                    } else{
                        $('#card_no').css('border', '0px');
                    }
                });
            }
            if(!move){
                alert("Card already exist");
                return
            }
            if(self.partner_id){
                var client = self.pos.db.get_partner_by_id(self.partner_id);
            }
            if(expire_date){
                if(checkbox_paid.checked){
                    $('#text_amount').focus();
                    var input_amount =this.$('#text_amount').val();
                    if(input_amount){
                        order.set_client(client);
                        var product = self.pos.db.get_product_by_id(self.pos.config.gift_card_product_id[0]);
                        if (self.pos.config.gift_card_product_id[0]){
                            var orderlines=order.get_orderlines()
                            for(var i = 0, len = orderlines.length; i < len; i++){
                                order.remove_orderline(orderlines);
                            }
                            var line = new models.Orderline({}, {pos: self.pos, order: order, product: product});
                            line.set_unit_price(input_amount);
                            order.add_orderline(line);
                            order.select_orderline(order.get_last_orderline());
                        }
                        var gift_order = {'giftcard_card_no': $('#card_no').val(),
                            'giftcard_customer': select_customer ? select_customer : false,
                            'giftcard_expire_date': moment($('#text_expire_date').val(), 'YYYY/MM/DD').format('YYYY-MM-DD'),
                            'giftcard_amount': $('#text_amount').val(),
                            'giftcard_customer_name': $("#select_customer").val(),
                            'card_type': $('#select_card_type').val(),
                        }
                        if(self.pos.config.msg_before_card_pay) {
                            self.gui.show_popup('confirmation_card_payment',{'card_data':gift_order});
                        } else{
                            order.set_giftcard(gift_order);
                            self.gui.show_screen('receipt');
                            $("#card_back").hide();
                            $( "div.js_set_customer" ).off("click");
                            $( "div#card_invoice" ).off("click");
                            this.gui.close_popup();                             
                            var params = {
                                model: 'account.payment',
                                method: 'payment',
                                args: [self.pos.config.enable_journal_id[0], Number(order.giftcard[0].giftcard_amount), self.pos.pos_session.name, order.giftcard[0].giftcard_customer, self.pos.get_cashier().id, 0],                                    
                            }
                            rpc.query(params, {async: false}).then(function(res){
                                var params = {
                                    model: "aspl.gift.card",
                                    method: "create",
                                    args: [{
                                        'card_no': Number($('#card_no').val()),
                                        'card_value': Number($('#text_amount').val()),
                                        'customer_id': self.partner_id ? Number(self.partner_id) : false,
                                        'expire_date': moment($('#text_expire_date').val(), 'YYYY/MM/DD').format('YYYY-MM-DD'),
                                        'card_type': Number($('#select_card_type').val()),
                                    }]
                                }
                                rpc.query(params, {async: false});
                            });                                
                        }
                    }else{
                        alert("Please enter card value.")
                        $('#text_amount').focus();
                    }
                }else{
                    var input_amount =this.$('#text_amount').val();
                    if(input_amount){
                        order.set_client(self.pos.db.get_partner_by_id(self.partner_id));
                        order.set_free_data({
                            'giftcard_card_no': $('#card_no').val(),
                            'giftcard_customer': select_customer ? select_customer : false,
                            'giftcard_expire_date': moment($('#text_expire_date').val(), 'YYYY/MM/DD').format('YYYY-MM-DD'),
                            'giftcard_amount': $('#text_amount').val(),
                            'giftcard_customer_name': $("#select_customer").val(),
                            'card_type': $('#select_card_type').val(),
                        })
                        var params = {
                            model: "aspl.gift.card",
                            method: "create",
                            args: [{
                                'card_no': Number($('#card_no').val()),
                                'card_value': Number($('#text_amount').val()),
                                'customer_id': self.partner_id ? Number(self.partner_id) : false,
                                'expire_date': moment($('#text_expire_date').val(), 'YYYY/MM/DD').format('YYYY-MM-DD'),
                                'card_type': Number($('#select_card_type').val()),
                            }]
                        }
                        rpc.query(params, {async: false});

                        self.gui.show_screen('receipt');
                        this.gui.close_popup();
                    }else{
                        alert("Please enter card value.")
                        $('#text_amount').focus();
                    }
                }
            }else{
                alert("Please select expire date.")
                $('#text_expire_date').focus();
            }
            
        },

        renderElement: function() {
            var self = this;
            this._super();
            $('.datetime').datepicker({
                minDate: 0,
                dateFormat:'yy/mm/dd',
            });
        },
    });
    gui.define_popup({name:'create_card_popup', widget: CreateCardPopupWidget});

    var EditCardPopupWidget = PopupWidget.extend({
        template: 'EditCardPopupWidget',

        show: function(options){
            self = this;
            this._super();
            this.card_no = options.card_no || "";
            this.card_id = options.card_id || "";
            this.expire_date = options.expire_date || "";
            this.renderElement();
            $('#new_expire_date').focus();
            $('#new_expire_date').keypress(function(e){
                if( e.which == 8 || e.keyCode == 46 ) return true;
                return false;
            });
        },

        click_confirm: function(){
            var self = this;
            var new_expire_date = moment(this.$('#new_expire_date').val(), 'YYYY/MM/DD').format('YYYY-MM-DD');
            if(new_expire_date){
                if(self.card_no){
                    var params = {
                        model: 'aspl.gift.card',
                        method: 'write',
                        args: [[self.card_id], {'expire_date': new_expire_date}],
                    }
                    rpc.query(params, {async: false})
                    .then(function(res){
                        if(res){
                            self.pos.gui.chrome.screens.giftcardlistscreen.reloading_gift_cards();
                        }
                    });
                    this.gui.close_popup();
                }else{
                    alert("Please enter valid card no.");
                }
            }else{
                alert("Please select date.");
                $('#new_expire_date').focus();
            }
        },

        renderElement: function() {
            var self = this;
            this._super();
            $('.date').datepicker({
                minDate: 0,
                dateFormat:'yy/mm/dd',
            });
            self.$(".emptybox_time").click(function(){ $('#new_expire_date').val('') });
        },
    });
    gui.define_popup({name:'edit_card_popup', widget: EditCardPopupWidget});

    var RechargeCardPopupWidget = PopupWidget.extend({
        template: 'RechargeCardPopupWidget',

        show: function(options){
            self = this;
            this._super();
            self.pending_card = options.recharge_card_data;
            if(!self.pending_card){
                this.card_no = options.card_no || "";
                this.card_id = options.card_id || "";
                this.card_value = options.card_value || 0 ;
                this.customer_id = options.customer_id || "";
            }
            this.renderElement();
            $('#text_recharge_amount').focus();
            $("#text_recharge_amount").keypress(function (e) {
                if(e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && e.which != 46) {
                    return false;
                }
            });
        },

        click_confirm: function(){
            var self = this;
            var order = self.pos.get_order();
            var client = order.get_client();
            var set_customer = $('#set_customers').val();
            if(!client){
                order.set_client(self.pos.db.get_partner_by_id(set_customer));
            }
            var recharge_amount = this.$('#text_recharge_amount').val();
            if (recharge_amount){
                if( 0 < Number(recharge_amount) ){
                    var vals = {
                    'recharge_card_id':self.card_id,
                    'recharge_card_no':self.card_no,
                    'recharge_card_amount':Number(recharge_amount),
                    'card_customer_id': self.customer_id[0] || false,
                    'customer_name': self.customer_id[1],
                    'total_card_amount':Number(recharge_amount)+self.card_value,
                    }
                    var get_recharge = order.get_recharge_giftcard();
                    if(get_recharge){
                        var product = self.pos.db.get_product_by_id(self.pos.config.gift_card_product_id[0]);
                        if (self.pos.config.gift_card_product_id[0]){
                            var orderlines=order.get_orderlines()
                            for(var i = 0, len = orderlines.length; i < len; i++){
                                order.remove_orderline(orderlines);
                            }
                            var line = new models.Orderline({}, {pos: self.pos, order: order, product: product});
                            line.set_unit_price(recharge_amount);
                            order.add_orderline(line);
                            order.select_orderline(order.get_last_orderline());
                        }
                        if(self.pos.config.msg_before_card_pay){
                            self.gui.show_popup('confirmation_card_payment',{'rechage_card_data':vals})
                        } else {
                            order.set_recharge_giftcard(vals);
                            self.gui.show_screen('payment');
                            $("#card_back").hide();
                            $( "div.js_set_customer" ).off("click");
                            $( "div#card_invoice" ).off("click");
                            this.gui.close_popup();
                        }
                          
                    }
                }else{
                   alert("Please enter valid amount.");
                   $('#text_recharge_amount').focus();
                }
            }else{
                alert("Please enter amount.");
                $('#text_recharge_amount').focus();
            }
        },
    });
    gui.define_popup({name:'recharge_card_popup', widget: RechargeCardPopupWidget});

    var ExchangeCardPopupWidget = PopupWidget.extend({
        template: 'ExchangeCardPopupWidget',

        show: function(options){
            self = this;
            this._super();
            this.card_no = options.card_no || "";
            this.card_id = options.card_id || "";
            this.renderElement();
            $('#new_card_no').focus();
            var timestamp = new Date().getTime()/1000;
            if(self.pos.config.manual_card_number){
                $('#new_card_no').removeAttr("readonly");
                $("#new_card_no").keypress(function (e) {
                    if (e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && e.which != 46) {
                        return false;
                   }
                });
            } else{
                $('#new_card_no').val(window.parseInt(timestamp));
                $('#new_card_no').attr("readonly", "readonly");
            }
            
        },

        click_confirm: function(){
            var self = this;
            if(self.card_no){
                var card_number = $('#new_card_no').val();
                var move = true;
                if(!card_number){
                    alert("Enter gift card number");
                    return;
                } else{
                    var params = {
                        model: 'aspl.gift.card',
                        method: 'search_read',
                        domain: [['card_no', '=', $('#new_card_no').val()]],
                    }
                    rpc.query(params, {async: false})
//                  new Model('aspl.gift.card').call('search_count', [[]], {}, {async: false})
                    .then(function(gift_count){
                        gift_count = gift_count.length
                        if(gift_count > 0){
                            $('#new_card_no').css('border', 'thin solid red');
                            move = false;
                        } else{
                            $('#new_card_no').css('border', '0px');
                        }
                    });
                }
                if(!move){
                    alert("Card already exist");
                    return
                }
               var exchange_card_no = confirm("Are you sure you want to change card number?");
               if( exchange_card_no){
                  var params = {
                     model: "aspl.gift.card",
                     method: "write",
                     args: [[self.card_id],{'card_no':this.$('#new_card_no').val()}],
                  }
                  rpc.query(params, {async: false})
                  .then(function(res){
                      if(res){
                          self.pos.gui.chrome.screens.giftcardlistscreen.reloading_gift_cards();
                      }
                  });
                  this.gui.close_popup();
               }
            }
        },
    });

    gui.define_popup({name:'exchange_card_popup', widget: ExchangeCardPopupWidget});

    var RedeemCardPopupWidget = PopupWidget.extend({
        template: 'RedeemCardPopupWidget',

        show: function(options){
           self = this;
           this.payment_self = options.payment_self || false;
           this._super();

           self.redeem = false;
           var order = self.pos.get_order();
           $('body').off('keypress', self.payment_self.keyboard_handler);
           $('body').off('keydown', self.payment_self.keyboard_keydown_handler);
           window.document.body.removeEventListener('keypress',self.payment_self.keyboard_handler);
           window.document.body.removeEventListener('keydown',self.payment_self.keyboard_keydown_handler);
           this.renderElement();
           $("#text_redeem_amount").keypress(function (e) {
               if(e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && e.which != 46) {
                    return false;
               }
            });
           $('#text_gift_card_no').focus();
           $('#redeem_amount_row').hide();
           $('#text_gift_card_no').keypress(function(e) {
               if (e.which == 13 && $(this).val()) {
                    var today = moment().format('YYYY-MM-DD');
                    var code = $(this).val();
                    var get_redeems = order.get_redeem_giftcard();
                    var existing_card = _.where(get_redeems, {'redeem_card': code });
                    var params = {
                        model: 'aspl.gift.card',
                        method: 'search_read',
                        domain: [['card_no', '=', code], ['expire_date', '>=', today], ['issue_date', '<=', today]],
                    }
                    rpc.query(params, {async: false})
//                    new Model('aspl.gift.card').get_func('search_read')([['card_no', '=', code], ['expire_date', '>=', today]])
                    .then(function(res){
                        if(res.length > 0){
                            if (res[0]){
                                if(existing_card.length > 0){
                                    res[0]['card_value'] = existing_card[existing_card.length - 1]['redeem_remaining']
                                }
                                self.redeem = res[0];
                                $('#lbl_card_no').html("Your Balance is  "+ self.format_currency(res[0].card_value));
                                if(res[0].customer_id[1]){
                                    $('#lbl_set_customer').html("Hello  "+ res[0].customer_id[1]);
                                } else{
                                    $('#lbl_set_customer').html("Hello  ");
                                }
                                
                                if(res[0].card_value <= 0){
                                    $('#redeem_amount_row').hide();
                                    $('#in_balance').show();
                                }else{
                                    $('#redeem_amount_row').fadeIn('fast');
                                    $('#text_redeem_amount').focus();
                                }
                            }
                        }else{
                            alert("Barcode not found or gift card has been expired.")
                            $('#text_gift_card_no').focus();
                            $('#lbl_card_no').html('');
                            $('#lbl_set_customer').html('');
                            $('#in_balance').html('');
                        }
                    });
                }
            });
        },
  
        click_cancel: function(){
            var self = this;
            self._super();  
            $('body').on('keypress', self.payment_self.keyboard_handler);
            $('body').on('keydown', self.payment_self.keyboard_keydown_handler);                
        },

        click_confirm: function(){
            var order = self.pos.get_order();
            var client = order.get_client();
            var redeem_amount = this.$('#text_redeem_amount').val();
            var code = $('#text_gift_card_no').val();
            if(self.redeem.card_no){
                if(code == self.redeem.card_no){
                    if(!self.redeem.card_value == 0){
                        if(redeem_amount){
                            if (redeem_amount <= (order.get_due() || order.get_total_with_tax())){
                                if(!client){
                                    order.set_client(self.pos.db.get_partner_by_id(self.redeem.customer_id[0]));
                                }
                                if( 0 < Number(redeem_amount)){
                                    if(self.redeem && self.redeem.card_value >= Number(redeem_amount) ){
                                        if(self.redeem.customer_id[0]){
                                            var vals = {
                                                'redeem_card_no':self.redeem.id,
                                                'redeem_card':$('#text_gift_card_no').val(),
                                                'redeem_card_amount':$('#text_redeem_amount').val(),
                                                'redeem_remaining':self.redeem.card_value - $('#text_redeem_amount').val(),
                                                'card_customer_id': client ? client.id : self.redeem.customer_id[0],
                                                'customer_name': client ? client.name : self.redeem.customer_id[1],
                                            };
                                        } else {
                                            var vals = {
                                                'redeem_card_no':self.redeem.id,
                                                'redeem_card':$('#text_gift_card_no').val(),
                                                'redeem_card_amount':$('#text_redeem_amount').val(),
                                                'redeem_remaining':self.redeem.card_value - $('#text_redeem_amount').val(),
                                                'card_customer_id': order.get_client() ? order.get_client().id : false,
                                                'customer_name': order.get_client() ? order.get_client().name : '',
                                            };
                                        }

                                        var get_redeem = order.get_redeem_giftcard();
                                        if(get_redeem){
                                            var product = self.pos.db.get_product_by_id(self.pos.config.enable_journal_id)
                                            if(self.pos.config.enable_journal_id[0]){
                                                var cashregisters = null;
                                                for ( var j = 0; j < self.pos.payment_methods.length; j++ ) {
                                                    if ( self.pos.payment_methods[j].id === self.pos.config.enable_journal_id[0] ){
                                                       cashregisters = self.pos.payment_methods[j];
                                                    }
                                                }
                                            }
                                            if (vals){                                                
                                                if (cashregisters){
                                                    order.add_paymentline(cashregisters);
                                                    order.selected_paymentline.set_amount( Math.max(redeem_amount),0 );
                                                    order.selected_paymentline.set_giftcard_line_code(code);
                                                    order.selected_paymentline.set_freeze(true);
                                                    self.chrome.screens.payment.reset_input();
                                                    self.chrome.screens.payment.render_paymentlines();
                                                    order.set_redeem_giftcard(vals);
                                                } 
                                            }
                                            this.gui.close_popup();
                                            $('body').on('keypress', self.payment_self.keyboard_handler);
                                            $('body').on('keydown', self.payment_self.keyboard_keydown_handler);
                                        }
                                    }else{
                                        alert("Please enter amount below card value.");
                                        $('#text_redeem_amount').focus();
                                    }
                                }else{
                                    alert("Please enter valid amount.");
                                    $('#text_redeem_amount').focus();
                                }
                            }else{
                                alert("Card amount should be less than or equal to Order Due Amount.");
                            } 
                            
                        }else{
                            alert("Please enter amount.");
                            $('#text_redeem_amount').focus();
                        }
                    }
                }else{
                    alert("Please enter valid barcode.");
                    $('#text_gift_card_no').focus();
                }
            }else{
                alert("Press enter key.");
                $('#text_gift_card_no').focus();
            }
        },
    });
    gui.define_popup({name:'redeem_card_popup', widget: RedeemCardPopupWidget});

    var ConfirmCloseSessionPopupWizard = PopupWidget.extend({
        template: 'ConfirmCloseSessionPopupWizard',
        show: function(options){
            options = options || {};
            this._super(options);
            this.statement_id = options.statement_id;
            var self = this;
            $("#close_session").click(function(){
                
                if(self.pos.config.cash_control){
                    self.gui.show_popup('cash_control',{
                            title:'Closing Cash Control',
                            statement_id:self.statement_id,
                    });
                } else{
                    var params = {
                        model: 'pos.session',
                        method: 'custom_close_pos_session',
                        args:[self.pos.pos_session.id]
                    }
                    rpc.query(params, {async: false}).then(function(res){
                        setTimeout(function(){
                            var cashier = self.pos.user || false;
                            if(cashier && cashier.login_with_pos_screen){
                                framework.redirect('/web/session/logout');
                            } else{
                                self.pos.gui.close();
                            }
                        }, 5000);                        
                    });
                }
            });
        },
        click_confirm: function(){
            var self = this;
            framework.redirect('/web/session/logout');
        },
    });
    gui.define_popup({name:'confirm_close_session_wizard', widget: ConfirmCloseSessionPopupWizard});

    var CashControlWizardPopup = PopupWidget.extend({
        template : 'CashControlWizardPopup',
        show : function(options) {
            var self = this;
            options = options || {};
            this.title = options.title || ' ';
            this.statement_id = options.statement_id || false;
            var selectedOrder = self.pos.get_order();
            this.difference = 0.00;
            this._super();
            this.renderElement();
            var self = this;            
            $(document).keypress(function (e) {
                if (e.which != 8 && e.which != 46 && e.which != 0 && (e.which < 48 || e.which > 57)) {
                    return false;
                }
            });
            var session_data = {
                model: 'pos.session',
                method: 'search_read',
                domain: [['id', '=', self.pos.pos_session.id]],
            }
            rpc.query(session_data, {async: false}).then(function(data){
                if(data){
                    _.each(data, function(value){
                        $("#open_bal").text(self.chrome.format_currency_no_symbol(value.cash_register_balance_start));
                        $("#transaction").text(self.chrome.format_currency_no_symbol(value.cash_register_total_entry_encoding));
                        $("#theo_close_bal").text(self.chrome.format_currency_no_symbol(value.cash_register_balance_end));
                        $("#real_close_bal").text(self.chrome.format_currency_no_symbol(value.cash_register_balance_end_real));
                        $("#differ").text(self.chrome.format_currency_no_symbol(value.cash_register_difference));
                        self.difference = value.cash_register_difference;
                        $('.button.close_session').show();
                    });
                }
            });
            $("#cash_details").show();
            this.$('.button.close_session').hide();            
            this.$('.button.close_session').click(function() {
                var dict = [];
                var items=[]
                var cash_details = []
                $(".cashcontrol_td").each(function(){
                    items.push($(this).val());
                });
                while (items.length > 0) {
                  cash_details.push(items.splice(0,3))
                }
                _.each(cash_details, function(cashDetails){
                    if(cashDetails[2] > 0.00){
                        dict.push({
                           'coin_value':Number(cashDetails[0]),
                           'number_of_coins':Number(cashDetails[1]),
                           'subtotal':Number(cashDetails[2]),
                           'pos_session_id':self.pos.pos_session.id
                        })
                    }
                });
                if(dict.length > 0){
                    var params = {
                        model: 'pos.session',
                        method: 'cash_control_line',
                        args:[self.pos.pos_session.id,dict]
                     }
                    rpc.query(params, {async: false}).then(function(res){
                            if(res){
                            }
                    }).guardedCatch(function (type, error) {
                        if(error.code === 200 ){    // Business Logic Error, not a connection problem
                            self.gui.show_popup('error-traceback',{
                                'title': error.data.message,
                                'body':  error.data.debug
                            });
                        }
                    });
                }
                var session_data = {
                    model: 'pos.session',
                    method: 'search_read',
                    domain: [['id', '=', self.pos.pos_session.id]],
                }
                rpc.query(session_data, {async: false}).then(function(data){
                    if(data){
                        _.each(data, function(value){
                            $("#open_bal").text(self.chrome.format_currency_no_symbol(value.cash_register_balance_start));
                            $("#transaction").text(self.chrome.format_currency_no_symbol(value.cash_register_total_entry_encoding));
                            $("#theo_close_bal").text(self.chrome.format_currency_no_symbol(value.cash_register_balance_end));
                            $("#real_close_bal").text(self.chrome.format_currency_no_symbol(value.cash_register_balance_end_real));
                            $("#differ").text(self.chrome.format_currency_no_symbol(value.cash_register_difference));
                            self.difference = self.chrome.format_currency_no_symbol(value.cash_register_difference);
                            $('.button.close_session').show();
                        });
                    }

                    // var self = this;
                    var params = {
                        model: 'pos.session',
                        method: 'end_validate_session',
                        args:[self.pos.pos_session.id]
                    }
                    rpc.query(params, {async: false}).then(function(res){
                        if(res){                        
                        }
                    }).catch(function () {
                        console.log("\n\n Connection Lost !");
                    });

                    if(self.difference < 0){
                        self.gui.show_popup('confirm',{
                            'title': _t('Do you want to continue ?'),
                            'body': _t('There is a difference, do you want to continue ?'),
                            confirm: function(){
                                self.close_session();
                            },
                            cancel: function(){
                                self.gui.show_popup('cash_control')
                            }
                        });
                    }else{
                        self.gui.close_popup();
                        self.close_session();
                    }
                });
            });
            this.$('.button.cancel').click(function() {
                  self.gui.close_popup();
            });
        },
        close_session: function(){
            var self = this;
            var params = {
                model: 'pos.session',
                method: 'custom_close_pos_session',
                args:[self.pos.pos_session.id]
            }
            rpc.query(params, {async: false}).then(function(res){
                if(res){                        
                    setTimeout(function(){
                        var cashier = self.pos.user || false;
                        if(cashier && cashier.login_with_pos_screen){
                            framework.redirect('/web/session/logout');
                        } else{
                            self.pos.gui.close();
                        }
                    }, 5000);
                }
            }).catch(function () {
                console.log("\n\n Connection Lost !");
            });
        },
        renderElement: function() {
            var self = this;
            this._super();
                
            var selectedOrder = self.pos.get_order();
            var table_row = "<tr id='cashcontrol_row'>" +
                            "<td><input type='text'  class='cashcontrol_td coin' id='value' value='"+ self.chrome.format_currency_no_symbol(0) +"' /></td>" + "<span id='errmsg'/>"+
                            "<td><input type='text' class='cashcontrol_td no_of_coin' id='no_of_values' value='"+ self.chrome.format_currency_no_symbol(0) +"' /></td>" +
                            "<td><input type='text' class='cashcontrol_td subtotal' id='subtotal' disabled='true' value='"+ self.chrome.format_currency_no_symbol(0) +"' /></td>" +
                            "<td id='delete_row'><span class='fa fa-trash-o'></span></td>" +
                            "</tr>";
            $('#cashbox_data_table tbody').append(table_row);
            $('#add_new_item').click(function(){
                $('#cashbox_data_table tbody').append(table_row);
            });
            $('#cashbox_data_table tbody').on('click', 'tr#cashcontrol_row td#delete_row',function(){
                $(this).parent().remove();
                self.compute_subtotal();
            });
            $('#cashbox_data_table tbody').on('change focusout', 'tr#cashcontrol_row td',function(){
                var no_of_value, value;
                if($(this).children().attr('id') === "value"){
                    value = Number($(this).find('#value').val());
                    no_of_value = Number($(this).parent().find('td #no_of_values').val());
                }else if($(this).children().attr('id') === "no_of_values"){
                    no_of_value = Number($(this).find('#no_of_values').val());
                    value = Number($(this).parent().find('td #value').val());
                }
                $(this).parent().find('td #subtotal').val(value * no_of_value);
                self.compute_subtotal();
            });
            this.compute_subtotal = function(event){
                var subtotal = 0;
                _.each($('#cashcontrol_row td #subtotal'), function(input){
                    if(Number(input.value) && Number(input.value) > 0){
                        subtotal += Number(input.value);
                    }
                });
                $('.subtotal_end').text(self.chrome.format_currency_no_symbol(subtotal));
            }
        }
    });
    gui.define_popup({name:'cash_control', widget: CashControlWizardPopup});

    var AddMoneyToCreditPopup = PopupWidget.extend({
        template: 'AddMoneyToCreditPopup',
        show: function(options){
            var self = this;
            this.client = options.new_client ? options.new_client : false;
            this.cust_due = 0;            
            this._super();
            $('#amount-to-be-added').focus();
            self.pos.get_customer_due(this.client).then(function(){
                var cust_due = self.pos.get('amount_due');  

                self.cust_due = cust_due.toFixed(2);  
                self.renderElement()              
            });
        },
        click_confirm: function(){
            var self = this;
            var order = this.pos.get_order();
            if($('#amount-to-be-added').val() == ""){
                alert(_t('Please, enter amount!'));
                return;
            }
            var get_journal_id = Number($('.select-journal').val());
            var amt_due = self.cust_due;
            var amount = Number($('#amount-to-be-added').val());
            var pos_session_id = self.pos.pos_session.name;
            var partner_id = Number($('.client-line.highlight').attr('-id')) || Number($('.client-line.lowlight').attr('data-id'));
            var client = self.pos.get_order().get_client()
            partner_id = partner_id ? partner_id : client.id;
            var cashier_id = self.pos.get_cashier().id;
            this.pay_due = $("#pay_amount").prop('checked');
            var params = {
                model: 'account.payment',
                method: "payment",
                args: [get_journal_id, amount, pos_session_id, partner_id, cashier_id, this.pay_due],
            }
            rpc.query(params, {async: false}).then(function(vals){
                if(vals){
                    if(vals.affected_order && vals.affected_order[0]){
                        if(self.pos.get('pos_order_list') && self.pos.get('pos_order_list').length > 0){
                            _.each(self.pos.get('pos_order_list'),function(order){
                                _.each(vals.affected_order,function(new_order){
                                    if(order.id == new_order[0].id){
                                        if(new_order[0].amount_total && new_order[0].amount_paid){
                                            order.amount_due = new_order[0].amount_total - new_order[0].amount_paid;
                                        }
                                    }
                                });
                            });
                        }
                    }
                    var partner = self.pos.db.get_partner_by_id(partner_id);
                    partner.remaining_credit_amount = vals.credit_bal;
                    var amount = partner.remaining_credit_amount + vals.add_amount
                    order.set_credit({                        
                        order: order,
                        get_journal_id: get_journal_id,
                        amount: vals.credit_bal,
                        amt_due: vals.amount_due,
                        pay_due: self.pay_due,
                        partner_id: self.pos.db.get_partner_by_id(partner_id).name,
                    })
                    self.gui.show_screen('receipt');                    
                }
            });
        },
        renderElement: function() {
            var self = this;
            self._super();
            $('#pay_amount').click(function(){
                if (!$(this).is(':checked')) {
                    $("#amount-to-be-added").val("");
                }else{
                    $("#amount-to-be-added").val(self.cust_due)
                }
            })
        },
        export_as_JSON: function() {
            var pack_lot_ids = [];
            if (this.has_product_lot){
                this.pack_lot_lines.each(_.bind( function(item) {
                    return pack_lot_ids.push([0, 0, item.export_as_JSON()]);
                }, this));
            }
            return {
                qty: this.get_quantity(),
                price_unit: this.get_unit_price(),
                discount: this.get_discount(),
                product_id: this.get_product().id,
                tax_ids: [[6, false, _.map(this.get_applicable_taxes(), function(tax){ return tax.id; })]],
                id: this.id,
                pack_lot_ids: pack_lot_ids
            };
        },
    });
    gui.define_popup({name:'AddMoneyToCreditPopup', widget: AddMoneyToCreditPopup});

    var ConfirmationCardPayment = PopupWidget.extend({
        template: 'ConfirmationCardPayment',

        show: function(options){
            self = this;
            this._super();
            self.options = options.card_data || false;
            self.recharge_card = options.rechage_card_data || false;

            self.renderElement();
        },
        click_confirm: function(){
            var self = this;
            var order = self.pos.get_order();
            if(self.recharge_card){
                var vals = {
                    'recharge_card_id':self.recharge_card.recharge_card_id,
                    'recharge_card_no':self.recharge_card.recharge_card_no,
                    'recharge_card_amount':self.recharge_card.recharge_card_amount,
                    'card_customer_id': self.recharge_card.card_customer_id || false,
                    'customer_name': self.recharge_card.customer_name,
                    'total_card_amount':self.recharge_card.total_card_amount,
                }
                order.set_recharge_giftcard(vals);


                self.gui.show_screen('receipt');
                $("#card_back").hide();
                $( "div.js_set_customer" ).off("click");
                $( "div#card_invoice" ).off("click");
                this.gui.close_popup();                 
                var params = {
                    model: 'account.payment',
                    method: 'payment',
                    args: [self.pos.config.enable_journal_id[0], Number(self.recharge_card.recharge_card_amount), self.pos.pos_session.name, self.recharge_card.card_customer_id, self.pos.get_cashier().id, 0],
                    // args: [{'name': self.pos.pos_session.name,'state':'posted','payment_type':'outbound','payment_date':order.creation_date,'partner_type':'customer','partner_id':self.recharge_card.card_customer_id,'amount':self.recharge_card.recharge_card_amount,'company_id':self.pos.config.company_id,'payment_method_id':1,'journal_id':journal}],
                }
                rpc.query(params, {async: false}).then(function(res){
                    var params = {
                        model: "aspl.gift.card",
                        method: "write",
                        args: [[self.recharge_card.recharge_card_id],{'card_value':self.recharge_card.total_card_amount}],                            
                    }
                    rpc.query(params, {async: false});
                });                
                this.gui.close_popup();
            } else if(self.options){
                var gift_order = {'giftcard_card_no': self.options.giftcard_card_no,
                        'giftcard_customer': self.options.giftcard_customer ? Number(self.options.giftcard_customer) : false,
                        'giftcard_expire_date': self.options.giftcard_expire_date,
                        'giftcard_amount': self.options.giftcard_amount,
                        'giftcard_customer_name': self.options.giftcard_customer_name,
                        'card_type': self.options.card_type,
                }


                order.set_giftcard(gift_order);
                self.gui.show_screen('receipt');
                $("#card_back").hide();
                $( "div.js_set_customer" ).off("click");
                $( "div#card_invoice" ).off("click");
                this.gui.close_popup();                                 
                var params = {
                    model: 'account.payment',
                    method: 'payment',
                    args: [self.pos.config.enable_journal_id[0], Number(order.giftcard[0].giftcard_amount), self.pos.pos_session.name, order.giftcard[0].giftcard_customer, self.pos.get_cashier().id, 0],                    
                }
                rpc.query(params, {async: false}).then(function(res){
                    var params = {
                        model: "aspl.gift.card",
                        method: "create",
                        args: [{
                            'card_no': Number($('#card_no').val()),
                            'card_value': Number($('#text_amount').val()),
                            'customer_id': self.options.giftcard_customer,
                            'expire_date': moment($('#text_expire_date').val(), 'YYYY/MM/DD').format('YYYY-MM-DD'),
                            'card_type': Number($('#select_card_type').val()),
                        }]
                    }
                    rpc.query(params, {async: false});
                });                    
                this.gui.close_popup();
            }
        },
        click_cancel: function(){
            var self = this;
            if(self.recharge_card){
                self.gui.show_popup('recharge_card_popup',{'recharge_card_data':self.recharge_card})
            }else if(self.options){
                self.gui.show_popup('create_card_popup',{'card_data':self.options});
            }
        }
    });

    gui.define_popup({name:'confirmation_card_payment', widget: ConfirmationCardPayment});
    
});
