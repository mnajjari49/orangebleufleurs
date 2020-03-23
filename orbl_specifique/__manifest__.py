# -*- coding: utf-8 -*-
{
    'name': "Spécifique Orange Bleu",

    'summary': """
        Spécifique ODOO pour Orange Bleu
        """,

    'description': """
        Spécifique ODOO pour Orange Bleu
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
        'account',
        'stock',
        'mrp',
        'sale_management',
        'point_of_sale',
        'hr',
        'contacts',
        'hr_skills',
        'stock_barcode',
        'calendar',
        'mail',
        'pos_loyalty',
    ],

    # always loaded
    'data': [
        #'security/ir.model.access.csv',
        'views/assets.xml',
    ],
    # only loaded in demonstration mode
    'demo': [
        'demo/demo.xml',
    ]
}
