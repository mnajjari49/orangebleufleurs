# -*- coding: utf-8 -*-
{
    'name': "POS fidélité : exclure client",

    'summary': """
        POS fidélité : exclure client
        """,

    'description': """
        POS fidélité : exclure client
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
        'pos_loyalty',
    ],

    # always loaded
    'data': [
        #'security/ir.model.access.csv',
        'views/partner.xml',
        'views/assets.xml',
    ],
    # only loaded in demonstration mode
    'demo': [
        'demo/demo.xml',
    ]
}
