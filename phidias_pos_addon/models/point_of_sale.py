# -*- coding: utf-8 -*-
#################################################################################
# Author      : Acespritech Solutions Pvt. Ltd. (<www.acespritech.com>)
# Copyright(c): 2012-Present Acespritech Solutions Pvt. Ltd.
# All Rights Reserved.
#
# This program is copyright property of the author mentioned above.
# You can`t redistribute it and/or modify it.
#
# You should have received a copy of the License along with this program.
#################################################################################

from odoo import models, fields, api, _, tools
from datetime import datetime, timedelta
import time
import ast
from pytz import timezone
from odoo.tools import float_is_zero
import psycopg2
import logging
_logger = logging.getLogger(__name__)


class PosConfig(models.Model):
    _inherit = 'pos.config'

    enable_gift_card = fields.Boolean('Enable Gift Card')
    gift_card_product_id = fields.Many2one('product.product', string="Gift Card Product")
    enable_journal_id = fields.Many2one("pos.payment.method", string="Enable Journal")
    manual_card_number = fields.Boolean('Manual Card No.')
    default_exp_date = fields.Integer('Default Card Expire Months')
    msg_before_card_pay = fields.Boolean('Confirm Message Before Card Payment')
    sale_order_operations = fields.Selection([('draft','Quotations'),
                            ('confirm', 'Confirm'),('paid', 'Paid')], "Operation", default="draft")
    paid_amount_product = fields.Many2one('product.product', string='Paid Amount Product', domain=[('available_in_pos', '=', True)])
    warehouse_id = fields.Many2one('stock.warehouse', string='Warehouse')
    sale_order_invoice = fields.Boolean("Invoice")
    allow_with_zero_amount = fields.Boolean(string="Allow to Close Session With 0 Amount")    
    enable_credit = fields.Boolean('Credit Management')
    receipt_balance = fields.Boolean('Display Balance info in Receipt')
    print_ledger = fields.Boolean('Print Credit Statement')
    pos_journal_id = fields.Many2one('pos.payment.method', string='Select Journal')
    prod_for_payment = fields.Many2one('product.product',string='Paid Amount Product',
                                      help="This is a dummy product used when a customer pays partially. This is a workaround to the fact that Odoo needs to have at least one product on the order to validate the transaction.")

    @api.onchange('enable_credit')
    def on_change_enable_credit(self):
        if(self.enable_credit):
            self.module_account = True  
        else: 
            self.module_account = False
        

class PosOrder(models.Model):
    _inherit = 'pos.order'

    amount_due = fields.Float(string='Amount Due', compute='_compute_amount_due')

    # @api.model_create_multi
    def _compute_amount_due(self):
        for each in self:
            each.amount_due = each.amount_total - each.amount_paid

    @api.model
    def ac_pos_search_read(self, domain):
        domain = domain.get('domain')
        search_vals = self.search_read(domain)
        user_id = self.env['res.users'].browse(self._uid)
        tz = False
        result = []
        if self._context and self._context.get('tz'):
            tz = timezone(self._context.get('tz'))
        elif user_id and user_id.tz:
            tz = timezone(user_id.tz)
        if tz:
            c_time = datetime.now(tz)
            hour_tz = int(str(c_time)[-5:][:2])
            min_tz = int(str(c_time)[-5:][3:])
            sign = str(c_time)[-6][:1]
            for val in search_vals:
                if sign == '-':
                    val.update({
                        'date_order': (val.get('date_order') - timedelta(hours=hour_tz, minutes=min_tz)).strftime(
                            '%Y-%m-%d %H:%M:%S')
                    })
                elif sign == '+':
                    val.update({
                        'date_order': (val.get('date_order') + timedelta(hours=hour_tz, minutes=min_tz)).strftime(
                            '%Y-%m-%d %H:%M:%S')
                    })
                result.append(val)
            return result
        else:
            return search_vals

    def _process_order(self, order, draft, existing_order):

        pos_line_obj = self.env['pos.order.line']
        old_order_id = order.get('data').get('old_order_id')
        draft_order_id = order.get('data').get('old_order_id')
        if order.get('data').get('old_order_id'):
            # order_id = old_order_id
            order_obj = self.browse([int(old_order_id)])
            # existing_order = order_obj
            if order.get('data').get('old_order_id'):
                if not draft_order_id:
                    # order.get('data').pop('draft_order')
                    order_id = self.create(self._order_fields(order))
                    return order_id
                else:
                    order_id = draft_order_id
                    pos_line_ids = pos_line_obj.search([('order_id', '=', order_id)])
                    if order_obj.lines and len(order.get('data').get('statement_ids')) == 0:
                        pos_line_ids.unlink()
                        order_obj.write({'lines': order['data']['lines']})
                        order_obj.write({'amount_due': order.get('data').get('amount_due'),
                                         'amount_total': order.get('data').get('amount_total'),
                                         'partner_id': order.get('data').get('partner_id'),
                                         'amount_paid': order.get('data').get('amount_paid')})
            currency = order_obj.currency_id
            for payments in order.get('data').get('statement_ids'):
                if not float_is_zero(payments[2].get('amount'), precision_rounding=currency.rounding):
                    order_obj.add_payment({
                        'pos_order_id': order_obj.id,
                        'payment_date': fields.Datetime.now(),
                        'amount': currency.round(payments[2].get('amount')) if currency else payments[2].get('amount'),
                        'payment_method_id': payments[2].get('payment_method_id'),
                    })
                    if not order_obj.amount_due:
                        order_obj.action_pos_order_paid()
            session = self.env['pos.session'].browse(order['data']['pos_session_id'])
            if session.sequence_number <= order.get('data').get('sequence_number'):
                session.write({'sequence_number': order.get('data').get('sequence_number') + 1})
                session.refresh()

        else:
            to_invoice = order['data']['to_invoice'] if not draft else False
            order = order['data']
            pos_session = self.env['pos.session'].browse(order['pos_session_id'])
            if pos_session.state == 'closing_control' or pos_session.state == 'closed':
                order['pos_session_id'] = self._get_valid_session(order).id

            pos_order = False
            if not existing_order:
                pos_order = self.create(self._order_fields(order))
            else:
                pos_order = existing_order
                # pos_order.lines.unlink()
                order['user_id'] = pos_order.user_id.id
                pos_order.write(self._order_fields(order))
            self._process_payment_lines(order, pos_order, pos_session, draft)

            if not draft:
                try:
                    pos_order.action_pos_order_paid()
                except psycopg2.DatabaseError:
                    # do not hide transactional errors, the order(s) won't be saved!
                    raise
                except Exception as e:
                    _logger.error('Could not fully process the POS Order: %s', tools.ustr(e))
            if to_invoice:
                pos_order.action_pos_order_invoice()
                pos_order.account_move.sudo().with_context(force_company=self.env.user.company_id.id).post()

            return pos_order.id

    @api.model
    def create_from_ui(self, orders, draft=False):
        # Keep only new orders
        for each_data in orders:
            credit_details = each_data['data'].get('credit_detail')
            if credit_details:
                self.env['account.move'].get_credit_info(credit_details)
                each_data['data']['to_invoice'] = True;    
            if(each_data['data'].get('redeem')):
                self.env['account.move'].get_gift_card_info(each_data['data'])            
        res = super(PosOrder, self).create_from_ui(orders, draft=False)
        pos_orders = self.browse([each.get('id') for each in res])
        existing_orders = pos_orders.read(['pos_reference'])
        existing_references = set([o['pos_reference'] for o in existing_orders])
        orders_to_read = [o for o in orders if o['data']['name'] in existing_references]

        for tmp_order in orders_to_read:
            order = tmp_order['data']
            order_obj = self.search([('pos_reference', '=', order['name'])])
            # create giftcard record
            if order.get('giftcard'):
                for create_details in order.get('giftcard'):
                    vals = {
                        'card_no': create_details.get('giftcard_card_no'),
                        'card_value': create_details.get('giftcard_amount'),
                        'customer_id': create_details.get('giftcard_customer') or False,
                        'expire_date':create_details.get('giftcard_expire_date'),
                        'card_type': create_details.get('card_type'),
                    }
                    self.env['aspl.gift.card'].create(vals)

            #  create redeem giftcard for use
            if order.get('redeem') and order_obj:
                for redeem_details in order.get('redeem'):                    
                    redeem_vals = {
                        'pos_order_id': order_obj.id,
                        'order_date': order_obj.date_order,
                        'customer_id': redeem_details.get('card_customer_id') or False,
                        'card_id': redeem_details.get('redeem_card_no'),
                        'amount': redeem_details.get('redeem_card_amount'),
                    }
                    use_giftcard = self.env['aspl.gift.card.use'].create(redeem_vals)
                    if use_giftcard and use_giftcard.card_id:
                        use_giftcard.card_id.write(
                            {'card_value': use_giftcard.card_id.card_value - use_giftcard.amount})

            # recharge giftcard
            if order.get('recharge'):
                for recharge_details in order.get('recharge'):
                    recharge_vals = {
                        'user_id': order_obj.user_id.id,
                        'recharge_date': order_obj.date_order,
                        'customer_id': recharge_details.get('card_customer_id') or False,
                        'card_id': recharge_details.get('recharge_card_id'),
                        'amount': recharge_details.get('recharge_card_amount'),
                    }
                    recharge_giftcard = self.env['aspl.gift.card.recharge'].create(recharge_vals)
                    if recharge_giftcard:
                        recharge_giftcard.card_id.write(
                            {'card_value': recharge_giftcard.card_id.card_value + recharge_giftcard.amount})
        return res


class PosPaymentMethod(models.Model):
    _inherit = 'pos.payment.method'

    allow_for_gift_card = fields.Boolean(string = "Allow For Gift Card")
    allow_for_credit = fields.Boolean(string = "Allow For Credit")

class ResPartner(models.Model):
    _inherit = 'res.partner'

    @api.model
    def create_from_ui(self, partner):
        if partner.get('property_product_pricelist'):
            price_list_id = int(partner.get('property_product_pricelist'))
            partner.update({'property_product_pricelist': price_list_id})
        return super(ResPartner, self).create_from_ui(partner)

    remaining_credit_amount = fields.Float(string="Remaining Amount",
                                           readonly=True)


# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:

class pos_session(models.Model):
    _inherit = 'pos.session'

    cashcontrol_ids = fields.One2many(comodel_name="custom.cashcontrol", inverse_name="pos_session_id",
                                      string="Cash Control Information")

    def _check_if_no_draft_orders(self):
        self.write({'stop_at': fields.Datetime.now()})
        return True



    def _validate_session(self):
        self.ensure_one()
        self._check_if_no_draft_orders()
        self._create_account_move()
        if self.move_id.line_ids:            
            self.env['pos.order'].search([('session_id', '=', self.id), ('state', '=', 'paid')]).write({'state': 'done'})
        else:
            # The cash register needs to be confirmed for cash diffs
            # made thru cash in/out when sesion is in cash_control.
            if self.config_id.cash_control:
                self.cash_register_id.button_confirm_bank()
            self.move_id.unlink()
        self.write({'state': 'closed'})
        return {
            'type': 'ir.actions.client',
            'name': 'Point of Sale Menu',
            'tag': 'reload',
            'params': {'menu_id': self.env.ref('point_of_sale.menu_point_root').id},
        }

    def action_pos_session_open(self):        
        pos_order = self.env['pos.order'].search([('state', '=', 'draft')])
        for order in pos_order:
            if order.session_id.state != 'opened':
                order.write({'session_id': self.id})
        return super(pos_session, self).action_pos_session_open()

    def end_validate_session(self):
        self.write({'state': 'closing_control', 'stop_at': fields.Datetime.now()})
        self.action_pos_session_closing_control()        
        return self.action_pos_session_validate()

    def custom_close_pos_session(self):
        for session in self:
            session.write({'state': 'closing_control', 'stop_at': fields.Datetime.now()})
            if not session.config_id.cash_control:
                return session.action_pos_session_close()
            if session.config_id.cash_control:                     
                session.write({'state': 'closing_control', 'stop_at': fields.Datetime.now()})          
                validate_session = session._validate_session()                    
                return validate_session

    def close_open_balance(self):        
        return True

    def cash_control_line(self, vals):
        total_amount = 0.00
        if vals:
            self.cashcontrol_ids.unlink()
            for data in vals:
                self.env['custom.cashcontrol'].create(data)
        for cash_line in self.cashcontrol_ids:
            total_amount += cash_line.subtotal
        for statement in self.statement_ids:
            temp_list = [{'end_bank_stmt_ids': statement, 'cashbox_lines_ids': [[0, 'virtual_87', {'number': total_amount, 'coin_value': 1}]], 'is_a_template': False}]
            res = self.env['account.bank.statement.cashbox'].create(temp_list)
            statement.write({'balance_end_real': total_amount})
        return True

class CashControl(models.Model):
    _name = 'custom.cashcontrol'

    coin_value = fields.Float(string="Coin/Bill Value")
    number_of_coins = fields.Integer(string="Number of Coins")
    subtotal = fields.Float(string="Subtotal")
    pos_session_id = fields.Many2one(comodel_name='pos.session', string="Session Id")
