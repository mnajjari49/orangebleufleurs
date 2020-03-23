# -*- coding: utf-8 -*-
from odoo import http

# class CdcSpecifique(http.Controller):
#     @http.route('/cdc_specifique/cdc_specifique/', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/cdc_specifique/cdc_specifique/objects/', auth='public')
#     def list(self, **kw):
#         return http.request.render('cdc_specifique.listing', {
#             'root': '/cdc_specifique/cdc_specifique',
#             'objects': http.request.env['cdc_specifique.cdc_specifique'].search([]),
#         })

#     @http.route('/cdc_specifique/cdc_specifique/objects/<model("cdc_specifique.cdc_specifique"):obj>/', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('cdc_specifique.object', {
#             'object': obj
#         })