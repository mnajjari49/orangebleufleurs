# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    is_loyalty_exclude = fields.Boolean(string="Exclu Programme Fidélité", default=False)

    def write(self, values):
        is_loyalty_exclude_change = False
        if values.get('is_loyalty_exclude') and values['is_loyalty_exclude']:
            is_loyalty_exclude_change = True
        res = super(ResPartner, self).write(values)
        if is_loyalty_exclude_change and self.is_loyalty_exclude:
            pos_orders = self.env['pos.order'].search([('partner_id', '=', self.id), ('loyalty_points_won', '!=', 0)])
            for pos_order in pos_orders:
                pos_order.write({'loyalty_points_won': 0})
                pos_order.write({'loyalty_points_lost': 0})
            pos_orders = self.env['pos.order'].search([('partner_id', '=', self.id), ('loyalty_points_lost', '!=', 0)])
            for pos_order in pos_orders:
                pos_order.write({'loyalty_points_lost': 0})
        return res
