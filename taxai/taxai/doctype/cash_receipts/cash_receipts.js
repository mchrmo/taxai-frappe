// Copyright (c) 2025, Michal Chrmo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Cash Receipts", {
  onload_post_render(frm) {
    frm.add_custom_button('New number', () => get_new_number(frm))

    frm.add_custom_button('Pair Payment', () => {
      frappe.call("taxai.taxai.doctype.receipt.receipt.pair_payment", { receipt_name: frm.doc.name }).then(r => {

        if (r.message) {
          frm.reload_doc();
          frappe.show_alert({
            message: 'Payment paired successfully',
            indicator: 'green'
          }, 5);
        }
      });
    });

  },

  refresh(frm) {
    if(frm.is_new()) {
      get_new_number(frm);
    }
  }

});


async function get_new_number(frm) {
  const res = await frappe.call("taxai.utils.get_next_naming_series_number", { naming_series: "Cash Receipts" })
  frm.set_value("internal_number", res.message);
}