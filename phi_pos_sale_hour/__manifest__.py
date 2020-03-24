# -*- coding: utf-8 -*-
{
    'name': "POS Vente : Heures dans les ventes",

    'summary': """
        POS Vente : Heures dans les ventes
        """,

    'description': """
        POS Vente : Heures dans les ventes
    """,

    'author': "Phidias",
    'website': "http://www.phidias.fr",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/12.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'Uncategorized',
    'version': '0.2',

    # any module necessary for this one to work correctly
    'depends': [
        'base',
        'point_of_sale',
    ],

    # always loaded
    'data': [
        #'security/ir.model.access.csv',
        'views/pos_order.xml',
    ],
    # only loaded in demonstration mode
    'demo': [
        'demo/demo.xml',
    ],
    'post_init_hook': 'post_init_hook',
}
