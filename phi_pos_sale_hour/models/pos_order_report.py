# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, tools


class PosOrderReport(models.Model):
    _inherit = 'report.pos.order'

    creation_hour = fields.Char(string='Heure Création', store=True)

    def _select(self):
        select = super(PosOrderReport, self)._select()
        select = select + ",s.creation_hour"
        return select

    def _group_by(self):
        group = super(PosOrderReport, self)._group_by()
        group = group + ",s.creation_hour"
        return group

