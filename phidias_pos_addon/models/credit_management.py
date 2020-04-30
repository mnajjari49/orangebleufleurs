# -*- coding: utf-8 -*-
#################################################################################
# Author      : Acespritech Solutions Pvt. Ltd. (<www.acespritech.com>)
# Copyright(c): 2012-Present Acespritech Solutions Pvt. Ltd.
# All Rights Reserved.
#
# This program is copyright property of the author mentioned above.
# You can`t redistribute it and/or modify it.
#
#################################################################################

from odoo import models, fields, api, _
from datetime import datetime, timedelta
import time
from pytz import timezone
import logging
_logger = logging.getLogger(__name__)


class account_payment(models.Model):
    _inherit = 'account.payment'
    _order = 'id desc'

    @api.model
    def payment(self, get_journal_id, amount, pos_session_id, partner_id, cashier_id, pay_due):
        pos_payment_method = self.env['pos.payment.method'].browse(get_journal_id)        
        account_journal = self.env['account.journal'].search([('default_debit_account_id', '=', pos_payment_method.receivable_account_id.id),('default_credit_account_id', '=', pos_payment_method.receivable_account_id.id)], limit=1)
        account_payment_obj = self.env['account.payment']
        pos_order_obj = self.env['pos.order']
        affected_order = []
        if pay_due:
            res = pos_order_obj.search([('partner_id', '=', partner_id), ('state', '=', 'draft')],order='date_order')
            for each in res:
                if amount > 0:
                    if each.amount_due < amount:
                        amount -= each.amount_due
                        values = self.env['pos.make.payment'].with_context(
                            {'active_id': each.id, 'default_journal_id': account_journal.id, 'default_amount':each.amount_due}).default_get(['payment_method_id', 'amount'])
                        self.env['pos.make.payment'].with_context({'active_id': each.id}).create(values).check()

                    elif each.amount_due >= amount:
                        values = self.env['pos.make.payment'].with_context(
                            {'active_id': each.id, 'default_journal_id': account_journal.id,
                             'default_amount': amount}).default_get(['payment_method_id', 'amount'])
                        self.env['pos.make.payment'].with_context({'active_id': each.id}).create(values).check()
                        amount = 0
                        affected_order.append(each.read())
                else:
                    break
        if amount > 0:
            vals = {
                'name': pos_session_id,
                'payment_type': "inbound",
                'amount': amount,
                'payment_date': datetime.now().date(),
                'journal_id': account_journal.id,
                'payment_method_id': 1,
                'partner_type': 'customer',
                'partner_id': partner_id,
            }           
            result = account_payment_obj.with_context({'default_from_pos':'credit'}).create(vals)
            result.post()
        res = pos_order_obj.search([('partner_id', '=', partner_id), ('state', '=', 'draft')])
        total_amt_due = 0
        for each in res:
            total_amt_due += each.amount_due
        customer = self.env['res.partner'].search([('id', '=', partner_id)])
        partner_obj = self.env['res.partner'].browse(partner_id)
        add_amount = amount - total_amt_due
        partner_obj.write({'remaining_credit_amount':(customer.remaining_credit_amount + add_amount)})
        if(pos_payment_method.allow_for_gift_card):
            return True
        else:
            return {'amount_due':total_amt_due,'credit_bal':customer.remaining_credit_amount,'affected_order':affected_order,'add_amount':add_amount}

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: