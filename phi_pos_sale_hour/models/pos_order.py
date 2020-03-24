# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class PosOrder(models.Model):
    _inherit = 'pos.order'

    creation_hour = fields.Char(string='Heure Création', store=True)

    @api.model
    def create(self, values):
        if values.get("date_order"):
            date = fields.Datetime.context_timestamp(self, fields.Datetime.to_datetime(values["date_order"]))
            hour = date.hour
            values["creation_hour"] = "%02d" % hour
        return super(PosOrder, self).create(values)
