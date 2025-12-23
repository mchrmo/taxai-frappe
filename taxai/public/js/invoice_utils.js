
const invoiceTaxEvents = {
  rate(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    calculateTaxRow(frm, row);
  },
  base(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    calculateTaxRow(frm, row);
  }
}

const invoiceItemEvents = {
  qty(frm, cdt, cdn) {
    calculateTotal(frm);
  },
  unit_price(frm, cdt, cdn) {
    calculateTotal(frm);
  },
  unit_price_with_vat(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    row.unit_price = row.unit_price_with_vat / (1 + (row.vat_rate / 100));

    frm.refresh_field('items');
    calculateTotal(frm);
  },
  vat_rate(frm, cdt, cdn) {
    calculateTotal(frm);
  },
  items_remove(frm, cdt, cdn) {
    calculateTotal(frm);
  },
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
    item.unit_price_with_vat = item.unit_price + item.unit_price * (item.vat_rate / 100);
    item.total = item.quantity * item.unit_price;
    item.vat_amount = item.total * (item.vat_rate / 100);
    item.total_with_vat = item.total + item.vat_amount;
  });

  frm.refresh_field('items');


  let subtotal = 0;
  let total_with_vat = 0;
  frm.doc.items.forEach(item => {
    subtotal += item.total;
    total_with_vat += item.total_with_vat;
  });

  frm.set_value('subtotal', subtotal);
  frm.set_value('total', total_with_vat);

  calculateTax(frm);

}

async function get_new_number(frm, naming_series=null) {
  const res = await frappe.call("taxai.utils.get_next_naming_series_number", { naming_series: naming_series || frm.doctype })
  frm.set_value("internal_number", res.message);
}
