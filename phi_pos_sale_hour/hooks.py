

def post_init_hook(cr, registry):

    cr.execute("update pos_order set creation_hour = lpad(date_part('hour' , date_order)::text, 2, '0');")
