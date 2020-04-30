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

{
    "name" : "Phidias Pos Addon(Enterprise)",
    'summary' : "Phidias Pos Addon(Enterprise)",
    "version" : "1.0",
    "description": """
        Create sales order from Point of Sale with Extended Features with Gift Card, Credit Card and Close Session functionality.
    """,
    'author' : 'Acespritech Solutions Pvt. Ltd.',
    'category' : 'Point of Sale',
    'website' : 'http://www.acespritech.com',
    'price': 120.00,
    'currency': 'EUR',
    'images': ['static/description/ace_logo.png'],
    "depends" : ['sale_management', 'point_of_sale', 'stock_sms', 'account_accountant'],
    "data" : [
        'security/ir.model.access.csv',
        'views/aspl_pos_create_so_extension.xml',
        'views/point_of_sale.xml',
        'views/gift_card.xml',
        'data/data.xml',
    ],
    'qweb': ['static/src/xml/pos.xml',],
    "auto_install": False,
    "installable": True,
}

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: