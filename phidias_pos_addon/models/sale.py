from odoo import fields, models, api, _
import datetime
from datetime import timedelta
import pytz
from pytz import timezone
import time
from odoo.tools.float_utils import float_compare, float_is_zero
from odoo.exceptions import UserError

class sale_order(models.Model):
    _inherit = "sale.order"

    @api.model
    def pay_invoice(self, vals):
        if vals.get('credit_detail'):
                self.env['account.move'].get_credit_info(vals.get('credit_detail'))
        invoices = []
        invoice_id = vals.get("invoice_id")
        paymentlines = vals.get("paymentlines")
        invoice = self.env['account.move'].browse(invoice_id)
        order_name = invoice.invoice_origin
        sale_order = self.search([('name', '=', order_name)])
        account_journal_obj = self.env['account.journal'].search([('name', 'ilike', 'Point of Sale')], limit=1)
        # invoice.write({'journal_id': account_journal_obj.id})
        invoices.append(invoice.id)
        if invoice.state == "draft":
            invoice.action_post()
        account_payment = self.env['account.payment']
        for line in paymentlines:
            pos_payment_method = self.env['pos.payment.method'].browse(line.get('journal_id'))

            if(pos_payment_method.is_cash_count):
                account_journal = pos_payment_method.cash_journal_id
            else:
                account_journal = self.env['account.journal'].search([('type', '=', 'bank')], limit=1)
            # account_journal = self.env['account.journal'].search([('type', 'ilike', pos_payment_method.name)], limit=1)
            payment_obj = account_payment.create({
                                               'payment_type': 'inbound',
                                               'partner_id': invoice.partner_id.id,
                                               'partner_type': 'customer',
                                               'journal_id': account_journal.id,
                                               'amount': line.get('amount'),
                                               'payment_method_id': invoice.journal_id.inbound_payment_method_ids.id,
                                               'invoice_ids': [(6, 0, invoices)],
                                               })
            payment_obj.post()
        sale_order.action_done()
        return sale_order

    @api.model
    def get_return_product(self, sale_order_id):
        picking_obj = self.env['stock.picking']
        if sale_order_id:
            picking_id = picking_obj.search([('sale_id', '=', sale_order_id),
                                             ('state', '=', 'done'),
                                             ('picking_type_id.code', '=', 'outgoing')])
            product_list = []
            qty = 0
            for out in picking_id:
                for out_move in out.move_lines:
                    product_list.append({
                        'product_id': out_move.product_id.id,
                        'qty': out_move.quantity_done,
                        'p_name': out_move.product_id.name,
                        'sale_order_id': sale_order_id,
                        'id': out_move.id,
                    })
                for product in product_list:
                    in_picking_id = picking_obj.search([('origin', '=', out.name),
                                                        ('state', '!=', 'cancel'),
                                                        ('picking_type_id.code', '=', 'incoming')])
                    for receipt in in_picking_id:
                        if receipt.origin == out.name:
                            for move in receipt.move_lines:
                                if move.product_id.id == product.get('product_id'):
                                    product.update({'qty': product.get('qty') - move.product_uom_qty})
        return product_list

    @api.model
    def return_sale_order(self, lines):
        order_id = int(lines[0].get('sale_order_id'))
        picking_obj = self.env['stock.picking']
        picking_id = picking_obj.search([('sale_id', '=', lines[0].get('sale_order_id')),
                                         ('state', '=', 'done'),('picking_type_id.code', '=', 'outgoing')])
        for pick in picking_id:
            picking_type_id = pick.picking_type_id.return_picking_type_id.id or pick.picking_type_id.id
            new_picking = picking_obj.create({
                'move_lines': [],
                'picking_type_id': picking_type_id,
                'state': 'draft',
                'origin': pick.name,
                'location_id': pick.location_dest_id.id,
                'location_dest_id': pick.move_lines[0].location_id.id,
                'partner_id': self.env['sale.order'].browse(lines[0].get('sale_order_id')).partner_id.id,

            })
            move_list = []
            for line in lines:
                move_id = self.env['stock.move'].search([('product_id', '=', line.get('product_id')),
                                                         ('picking_id', '=', pick.id),
                                                         ('state', '=', 'done'),
                                                         ])
                if move_id.origin_returned_move_id.move_dest_ids.ids and move_id.origin_returned_move_id.move_dest_ids.state != 'cancel':
                    move_dest_id = move_id.origin_returned_move_id.move_dest_id.id
                else:
                    move_dest_id = False
                return_move_id = {
                    'product_id': line.get('product_id'),
                    'product_uom_qty': abs(float(line.get('return_qty'))),
                    'state': 'draft',
                    'location_id': move_id.location_dest_id.id,
                    'location_dest_id': move_id.location_id.id,
                    'warehouse_id': pick.picking_type_id.warehouse_id.id,
                    'origin_returned_move_id': move_id.id,
                    'procure_method': 'make_to_stock',
                    'picking_id': new_picking.id,
                    'product_uom': move_id.product_uom.id,
                    'name': new_picking.name,

                }
                move_list.append((0, 0, return_move_id))
            new_picking.update({'move_lines': move_list})
        new_picking.action_confirm()
        new_picking.action_assign()
        new_picking.action_done()
        new_picking.with_context(from_pos=True).button_validate()
        self.env['stock.immediate.transfer'].create({'pick_ids': [(4, new_picking.id)]}).process()
        new_picking.write({
            'sale_id': order_id,
        })
        return new_picking.id

    @api.depends('state')
    def _compute_type_name(self):
        for record in self:
            record.type_name = _('Quotation') if record.state in ('draft', 'sent', 'cancel') else _('Sales Order')

    @api.depends('invoice_ids')
    def _calculate_amount_due(self):
        for each in self:
            total = 0.00
            for invoice in each.invoice_ids:
                # if not invoice.amount_residual:
                #     total = invoice.amount_total
                # else:
                total = invoice.amount_residual
            each.amount_due = total

    amount_due = fields.Float("Amount Due", compute="_calculate_amount_due")

    @api.model
    def create_sales_order(self, vals):
        if vals.get('credit_detail'):
                self.env['account.move'].get_credit_info(vals.get('credit_detail'))
        sale_pool = self.env['sale.order']
        prod_pool = self.env['product.product']
        sale_line_pool = self.env['sale.order.line']
        customer_id = vals.get('customer_id')
        orderline = vals.get('orderlines')
        journals = vals.get('journals')
        location_id = vals.get('location_id')
        sale_id = False
        st_date = False
        if self.env.user and self.env.user.tz:
            tz = timezone(self.env.user.tz)
        else:
            tz = pytz.utc
        c_time = datetime.datetime.now(tz)
        hour_tz = int(str(c_time)[-5:][:2])
        min_tz = int(str(c_time)[-5:][3:])
        sign = str(c_time)[-6][:1]
        c_time = c_time.date()
        if vals.get('order_date'):
            if sign == '-':
                st_date = (datetime.datetime.strptime(vals.get('order_date'), '%Y-%m-%d %H:%M') + timedelta(hours=hour_tz, minutes=min_tz)).strftime('%Y-%m-%d %H:%M')
            if sign == '+':
                st_date = (datetime.datetime.strptime(vals.get('order_date'), '%Y-%m-%d %H:%M') - timedelta(hours=hour_tz, minutes=min_tz)).strftime('%Y-%m-%d %H:%M')
        if not vals.get('sale_order_id'):
            if customer_id:
                customer_id = int(customer_id)
                sale = {
                    'partner_id': customer_id,
                    'partner_invoice_id': vals.get('partner_invoice_id', customer_id),
                    'partner_shipping_id': vals.get('partner_shipping_id', customer_id),
                    'date_order': st_date or datetime.datetime.now(),
                    'note': vals.get('note') or '',
                    'signature': vals.get('signature') or '',
                }
                new = sale_pool.new({'partner_id': customer_id})
                new.onchange_partner_id()
                if vals.get('pricelist_id'):
                    sale.update({'pricelist_id': vals.get('pricelist_id')})
                if vals.get('partner_shipping_id'):
                    sale.update({'partner_shipping_id': vals.get('partner_shipping_id')})
                if vals.get('partner_invoice_id'):
                    sale.update({'partner_invoice_id': vals.get('partner_invoice_id')})
                if vals.get('warehouse_id'):
                    sale.update({'warehouse_id': vals.get('warehouse_id')})
                sale_id = sale_pool.create(sale)
                sale_line = {'order_id': sale_id.id}
                for line in orderline:
                    prod_rec = prod_pool.browse(line['product_id'])
                    prod_desc = prod_rec.name_get()[0][1]
                    if prod_rec.description_sale:
                        prod_desc += '\n' + prod_rec.description_sale
                    sale_line.update({
                        'name': prod_desc or '',
                        'product_id': prod_rec.id,
                        'product_uom_qty': line['qty'],
                        'discount': line.get('discount'),
                        'price_unit': line.get('price_unit'),
                    })
                    new_prod = sale_line_pool.new({'product_id': prod_rec.id})
                    prod = new_prod.product_id_change()
                    sale_line.update(prod)
                    sale_line.update({'price_unit': line['price_unit']});
                    taxes = map(lambda a: a.id, prod_rec.taxes_id)
                    if taxes:
                        sale_line.update({'tax_id': [(6, 0, taxes)]})
                    sale_line.update({'product_uom': prod_rec.uom_id.id})
                    sale_line_pool.create(sale_line)

                if vals.get('confirm'):
                    sale_id.action_confirm()
                if vals.get('paid'):
                    ans = sale_id.action_confirm()
                    for picking_id in sale_id.picking_ids:
                        if not picking_id.delivery_order(location_id):
                            return False
                    if not sale_id._make_payment(journals):
                        return False


        elif vals.get('sale_order_id') and vals.get('edit_quotation'):
            if customer_id:
                customer_id = int(customer_id)
                sale_id = self.browse(vals.get('sale_order_id'))
                if sale_id:
                    vals = {
                        'partner_id': customer_id,
                        'partner_invoice_id': vals.get('partner_invoice_id', customer_id),
                        'partner_shipping_id': vals.get('partner_shipping_id', customer_id),
                        'date_order': st_date or datetime.datetime.now(),
                        'note': vals.get('note') or '',
                        'pricelist_id': vals.get('pricelist_id') or False,
                    }
                    sale_id.write(vals)
                    [line.unlink() for line in sale_id.order_line]
                    sale_line = {'order_id': sale_id.id}
                    for line in orderline:
                        prod_rec = prod_pool.browse(line['product_id'])
                        prod_desc = prod_rec.name_get()[0][1]
                        if prod_rec.description_sale:
                            prod_desc += '\n' + prod_rec.description_sale
                        sale_line.update({
                            'name': prod_desc or '',
                            'product_id': prod_rec.id,
                            'product_uom_qty': line['qty'],
                            'discount': line.get('discount'),
                        })
                        new_prod = sale_line_pool.new({'product_id': prod_rec.id})
                        prod = new_prod.product_id_change()
                        sale_line.update(prod)
                        sale_line.update({'price_unit': line['price_unit']})
                        taxes = map(lambda a: a.id, prod_rec.taxes_id)
                        if sale_line.get('tax_id'):
                            sale_line.update({'tax_id': sale_line.get('tax_id')})
                        elif taxes:
                            sale_line.update({'tax_id': [(6, 0, taxes)]})
                        sale_line.update({'product_uom': prod_rec.uom_id.id})
                        sale_line_pool.create(sale_line)
                    if journals:
                        if sale_id.state in ['draft', 'sent']:
                            sale_id.action_confirm()
                        for picking_id in sale_id.picking_ids:
                            if picking_id.state != "done":
                                if not picking_id.delivery_order(location_id):
                                    return False
                        sale_id._make_payment(journals)

        elif vals.get('sale_order_id') and not vals.get('edit_quotation'):
            sale_id = self.browse(vals.get('sale_order_id'))
            if sale_id:
                inv_id = False
                if vals.get('inv_id'):
                    inv_id = vals.get('inv_id')
                if sale_id.state in ['draft', 'sent']:
                    sale_id.action_confirm()
                for picking_id in sale_id.picking_ids:
                    if picking_id.state != "done":
                        if not picking_id.delivery_order(location_id):
                            return False
                sale_id._make_payment(journals)
        if not sale_id:
            return  False
        if sale_id._action_order_lock():
            sale_id.action_done()
        return sale_id.read()

    def _make_payment(self, journals):
        if not self.invoice_ids or self.invoice_status == "to invoice":
            try:
                self._create_invoices()
            except Exception as e:
                raise
        if not self.generate_invoice(journals):
            return False
        return True

    def _action_order_lock(self):
        if not self.invoice_ids:
            return False
        inv = [invoice.id for invoice in self.invoice_ids if invoice.state != "paid"]
        picking = [picking.id for picking in self.picking_ids if picking.state != "done"]
        if self and not inv and not picking:
            return True
        return False

    @api.model
    def generate_invoice(self, journals):
        invoices = []
        if self.invoice_ids:
            for account_invoice in self.invoice_ids:
                pos_journal = self.env['account.journal'].search([('name', 'ilike', 'Point of Sale')], limit=1)
                # account_invoice.write({'journal_id': pos_journal})
                account_invoice.action_post()
                if account_invoice.state != "paid":
                    invoices.append(account_invoice.id)
            account_payment_obj = self.env['account.payment']
            for journal in journals:
                pos_payment_method = self.env['pos.payment.method'].browse(journal.get('journal_id'))
                if(pos_payment_method.is_cash_count):
                    account_journal = pos_payment_method.cash_journal_id
                else:
                    account_journal = self.env['account.journal'].search([('type', '=', 'bank')], limit=1)
                # account_journal = self.env['account.journal'].search([('type', 'ilike', pos_payment_method.name)], limit=1)
                if account_journal:
                    payment_id = account_payment_obj.create({
                                               'payment_type': 'inbound',
                                               'partner_id': account_invoice.partner_id.id,
                                               'partner_type': 'customer',
                                               'journal_id': account_journal.id,
                                               'amount': journal.get('amount'),
                                               'payment_method_id': account_invoice.journal_id.inbound_payment_method_ids.id,
                                               'invoice_ids': [(6, 0, invoices)],
                                               })
                    payment_id.post()
            return True
        return False

class StockPicking(models.Model):
    _inherit = "stock.picking"

    def delivery_order(self, location_id):
        if not self:
            return False
        if location_id:
            self.move_lines.write({'location_id': location_id})
        self.action_confirm()
        self.action_assign()
        self.action_done()
        self.with_context(from_pos=True).button_validate()
        stock_transfer_id = self.env['stock.immediate.transfer'].search([('pick_ids', 'in', self.id)])
        if stock_transfer_id:
            stock_transfer_id.process()
        return True

    def _check_sms_confirmation_popup(self):
        if not self._context.get('from_pos', False):
            return super(StockPicking, self)._check_sms_confirmation_popup()
        return False

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
