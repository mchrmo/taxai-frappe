// Copyright (c) 2025, Michal Chrmo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Purchase Invoice", {
  onload(frm) {
    if (frm.is_new()) {
      get_new_number(frm);
      frm.set_value("issued_date", new Date());
      frm.set_value("delivery_date", new Date());
      frm.set_value("due_date", new Date());
      
      calculateTotal(frm);
    }
  },

  onload_post_render(frm) {
    frm.add_custom_button('New number', () => get_new_number(frm))
	},


});

frappe.ui.form.on('Invoice Item', {
  qty(frm, cdt, cdn) {
    calculateTotal(frm);
  },
  unit_price(frm, cdt, cdn) {
    calculateTotal(frm);
  },
  unit_price_w_vat(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    row.unit_price = row.unit_price_w_vat / (1 + (row.vat_rate / 100));
    console.log(row.unit_price);

    frm.refresh_field('items');
    calculateTotal(frm);
  },
  vat_rate(frm, cdt, cdn) {
    calculateTotal(frm);
  }
});

frappe.ui.form.on('Invoice Tax', {

  rate(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    calculateTaxRow(frm, row);
  },
  base(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    calculateTaxRow(frm, row);
  }


});


async function get_new_number(frm) {
  const res = await frappe.call("taxai.utils.get_next_naming_series_number", { naming_series: "Purchase Invoice" })
  frm.set_value("internal_number", res.message);
}

function calculateTax(frm) {

  frm.doc.taxes = [];

  items_by_tax = {}

  frm.doc.items.forEach(item => {
    if (!items_by_tax[item.vat_rate]) {
      items_by_tax[item.vat_rate] = 0;
    }
    items_by_tax[item.vat_rate] += item.total;
  });

  let total_tax = 0
  for (const [rate, base] of Object.entries(items_by_tax)) {

    let vat = base * (rate / 100);
    total_tax += vat;

    frm.add_child('taxes', {
      base: base,
      rate: rate,
      vat: vat,
      total: base + vat
    });
  }

  frm.refresh_field('taxes');
  frm.set_value('vat', total_tax);

}

function calculateTotal(frm) {

  frm.doc.items.forEach(item => {
    item.unit_price_w_vat = item.unit_price + item.unit_price * (item.vat_rate / 100);
    item.total = item.qty * item.unit_price;
    item.vat = item.total * (item.vat_rate / 100);
    item.total_w_vat = item.total + item.vat;
  });

  frm.refresh_field('items');


  let subtotal = 0;
  let total_w_vat = 0;
  frm.doc.items.forEach(item => {
    subtotal += item.total;
    total_w_vat += item.total_w_vat;
  });

  frm.set_value('subtotal', subtotal);
  frm.set_value('total', total_w_vat);

  calculateTax(frm);

}
