// Copyright (c) 2025, Michal Chrmo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Cash Payment", {
  onload_post_render(frm) {
    frm.add_custom_button('New number', () => get_new_number(frm))
  },

  refresh(frm) {
    if(frm.is_new()) {
      get_new_number(frm);
    }
  }

});


async function get_new_number(frm) {
  const res = await frappe.call("taxai.utils.get_next_naming_series_number", { naming_series: "Cash Payment" })
  frm.set_value("internal_number", res.message);
}