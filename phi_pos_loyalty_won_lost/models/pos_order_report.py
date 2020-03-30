# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, tools


class PosOrderReport(models.Model):
    _inherit = 'report.pos.order'

    loyalty_points = fields.Float(string="Points fidélité", readonly=True)
    loyalty_points_won = fields.Float(string="Points gagnés", readonly=True)
    loyalty_points_lost = fields.Float(string="Points perdus", readonly=True)

    def _select(self):
        select = super(PosOrderReport, self)._select()
        select = select + ",s.loyalty_points,s.loyalty_points_lost,s.loyalty_points_won"
        return select

    def _group_by(self):
        group = super(PosOrderReport, self)._group_by()
        group = group + ",s.loyalty_points,s.loyalty_points_lost,s.loyalty_points_won"
        return group

