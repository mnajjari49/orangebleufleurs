# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class PosOrder(models.Model):
    _inherit = 'pos.order'

    loyalty_points_won = fields.Float(string="Points gagnés", group_operator='sum',store=True)
    loyalty_points_lost = fields.Float(string="Points perdus", group_operator='sum',store=True)

    @api.model
    def _order_fields(self, ui_order):
        fields = super(PosOrder, self)._order_fields(ui_order)
        fields['loyalty_points_won'] = ui_order.get('loyalty_points_won', 0)
        fields['loyalty_points_lost'] = ui_order.get('loyalty_points_lost', 0)
        return fields

