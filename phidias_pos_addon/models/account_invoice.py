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

from odoo import fields,api,models,_
from odoo.tools import float_is_zero, float_compare, pycompat

class InvoiceInfo(models.Model):
    _inherit = 'account.move'

    @api.model
    def get_outstanding_info(self,vals,journal_id):
        if(vals):
            partner_id = self.env['res.partner'].browse(vals);
            account_id = partner_id.property_account_receivable_id
            comp_id = self.env['res.partner']._find_accounting_partner(partner_id).id;                    
            domain = [('account_id', '=', account_id.id),
                      ('partner_id', '=',  self.env['res.partner']._find_accounting_partner(partner_id).id),
                      ('reconciled', '=', False), '|', ('amount_residual', '!=', 0.0),
                      ('amount_residual_currency', '!=', 0.0)]
            domain.extend([('credit', '>', 0), ('debit', '=', 0)])
            type_payment = _('Outstanding credits')
            lines = self.env['account.move.line'].search(domain)

            info = {'title': '', 'outstanding': True, 'content': [], 'invoice_id': self.id}
            if len(lines) != 0:
                pos_payment_method = self.env['pos.payment.method'].browse(journal_id)        
                account_journal = self.env['account.journal'].search([('default_debit_account_id', '=', pos_payment_method.receivable_account_id.id),('default_credit_account_id', '=', pos_payment_method.receivable_account_id.id)], limit=1)
                for line in lines:
                    if(line.payment_id.journal_id != account_journal):                    
                        if line.currency_id and line.currency_id == self.currency_id:
                            amount_to_show = abs(line.amount_residual_currency)
                        else:
                            amount_to_show = line.company_id.currency_id.with_context(date=line.date).compute(abs(line.amount_residual), self.currency_id)
                        if float_is_zero(amount_to_show, self.currency_id.rounding):
                            continue
                        info['content'].append({
                            'journal_name': line.ref or line.move_id.name,
                            'amount': amount_to_show,
                            'id': line.id,
                        })
                info['title'] = type_payment
        return info

    @api.model
    def get_credit_info(self,vals):
        lines_info = []
        move_line_obj = self.env['account.move.line']
        if vals:
            for each in vals:
                if each['partner_id']:
                    partner_id = self.env['res.partner'].browse(each['partner_id']);
                credit_aml = self.env['account.move.line'].browse(each['journal_id'])
                move_line_obj |= credit_aml
                credit_journal_id = credit_aml.journal_id.default_credit_account_id
                debit_account_id = credit_aml.journal_id.default_debit_account_id
                account_id = partner_id.property_account_receivable_id
                lines_info.append((0, 0, {'account_id': account_id.id,
                                           'debit': each['amount'],
                                           'partner_id': partner_id.id,
                                      }))
                lines_info.append((0, 0, {'account_id': credit_journal_id.id,
                                      'credit': each['amount'],
                                      'partner_id': partner_id.id,
                                      }))
                move = self.env['account.move'].create({'ref':'',
                                                    'journal_id':credit_aml.payment_id.journal_id.id,
                                                    'line_ids':lines_info,
                                                    })
                lines_info = []
                line_id = move.line_ids.filtered(lambda l:l.account_id.id==account_id.id and l.partner_id.id == partner_id.id)
                self.env['account.partial.reconcile'].create(
                    {'credit_move_id': credit_aml.id, 'debit_move_id': line_id.id,
                     'amount': line_id.debit,
                     })
                redeem_credit_amount = partner_id.remaining_credit_amount - line_id.debit
                partner_id.write({'remaining_credit_amount':redeem_credit_amount})
                move.post()
        return True

    @api.model
    def get_gift_card_info(self,vals):
        lines_info = []
        move_line_obj = self.env['account.move.line']
        if vals:
            # for each in vals:
            for each_redeem in vals['redeem']:
                partner_id = self.env['res.partner'].browse(each_redeem['card_customer_id']);
                config_id = self.env['pos.session'].browse(vals['pos_session_id']).config_id
                account_journal = self.env['account.journal'].search([('default_debit_account_id', '=', config_id.enable_journal_id.receivable_account_id.id),('default_credit_account_id', '=', config_id.enable_journal_id.receivable_account_id.id)], limit=1)
                credit_journal_id = account_journal.default_credit_account_id
                debit_account_id = account_journal.default_debit_account_id
                account_id = partner_id.property_account_receivable_id
                lines_info.append((0, 0, {'account_id': account_id.id,
                                           'debit': each_redeem['redeem_card_amount'],
                                           'partner_id': partner_id.id,
                                      }))
                lines_info.append((0, 0, {'account_id': credit_journal_id.id,
                                      'credit': each_redeem['redeem_card_amount'],
                                      'partner_id': partner_id.id,
                                      }))
                move = self.env['account.move'].create({'ref':'',
                                                    'journal_id':account_journal.id,
                                                    'line_ids':lines_info,
                                                    })
                lines_info = []
                line_id = move.line_ids.filtered(lambda l:l.account_id.id==account_id.id and l.partner_id.id == partner_id.id)                
                move.post()              
        return True

    def _check_balanced(self):
        ''' Assert the move is fully balanced debit = credit.
        An error is raised if it's not the case.
        '''
        moves = self.filtered(lambda move: move.line_ids)
        if not moves:
            return

        # /!\ As this method is called in create / write, we can't make the assumption the computed stored fields
        # are already done. Then, this query MUST NOT depend of computed stored fields (e.g. balance).
        # It happens as the ORM makes the create with the 'no_recompute' statement.
        self.env['account.move.line'].flush(['debit', 'credit', 'move_id'])
        self.env['account.move'].flush(['journal_id'])
        self._cr.execute('''
            SELECT line.move_id, ROUND(SUM(debit - credit), currency.decimal_places)
            FROM account_move_line line
            JOIN account_move move ON move.id = line.move_id
            JOIN account_journal journal ON journal.id = move.journal_id
            JOIN res_company company ON company.id = journal.company_id
            JOIN res_currency currency ON currency.id = company.currency_id
            WHERE line.move_id IN %s
            GROUP BY line.move_id, currency.decimal_places
            HAVING ROUND(SUM(debit - credit), currency.decimal_places) != 0.0;
        ''', [tuple(self.ids)])
        query_res = self._cr.fetchall()
        if query_res:
            ids = [res[0] for res in query_res]
            sums = [res[1] for res in query_res]
            for move in moves:
                if sums and move.journal_id.name not in ['Point of Sale', 'Cash'] and move.type == 'entry':
                    raise UserError(_("Cannot create unbalanced journal entry. Ids: %s\nDifferences debit - credit: %s") % (ids, sums))

class InvoiceInfoLine(models.Model):
    _inherit = 'account.move.line'

    def _check_reconcile_validity(self):
        #Perform all checks on lines
        company_ids = set()
        all_accounts = []
        for line in self:
            company_ids.add(line.company_id.id)
            all_accounts.append(line.account_id)            
        if len(company_ids) > 1:
            raise UserError(_('To reconcile the entries company should be the same for all entries.'))
        if len(set(all_accounts)) > 1:
            raise UserError(_('Entries are not from the same account.'))
        if not (all_accounts[0].reconcile or all_accounts[0].internal_type == 'liquidity'):
            raise UserError(_('Account %s (%s) does not allow reconciliation. First change the configuration of this account to allow it.') % (all_accounts[0].name, all_accounts[0].code))



#vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
