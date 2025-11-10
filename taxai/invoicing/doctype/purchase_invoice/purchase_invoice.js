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

  refresh(frm) {
    // Add pairing functionality
    if (!frm.is_new()) {
      // Add button to pair with bank transaction
      frm.add_custom_button('Pair with Bank Transaction', () => {
        pair_with_bank_transaction(frm);
      }, 'Payment');

      // Add button to find pairing candidates
      frm.add_custom_button('Find Payment Candidates', () => {
        find_payment_candidates(frm);
      }, 'Payment');

      // Add button to unpair if already paired
      if (frm.doc.payment_document) {
        frm.add_custom_button('Unpair Payment', () => {
          unpair_payment_document(frm);
        }, 'Payment');
      }

      // Show payment status indicator
      if (frm.doc.payment_document) {
        frm.page.set_indicator(__('Paid'), 'green');
      } else {
        frm.page.set_indicator(__('Unpaid'), 'orange');
      }
    }
  },

  supplier(frm) {
    setSupplier(frm);
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


function setSupplier(frm) {

  if (frm.doc.supplier) {
    frappe.db.get_doc('Partner', frm.doc.supplier).then(supplier => {

      if (supplier) {
        frm.set_value({
          supplier_business_id: supplier.business_id,
          supplier_tax_id: supplier.tax_id,
          supplier_vat_id: supplier.vat_id,
          supplier_address_1: supplier.street,
          supplier_address_2: ((supplier.city || '') + ((supplier.state ? ', ' + supplier.state : '') || '')) || ''
        })

      }
    });
  } else {
    frm.set_value({
      supplier_business_id: null,
      supplier_tax_id: null,
      supplier_vat_id: null,
      supplier_address_1: null,
      supplier_address_2: null
    });
  }
  frm.fields_dict['supplier_section'].collapse(false);

}

// Payment pairing functions
function pair_with_bank_transaction(frm) {
  frappe.call({
    method: 'taxai.services.pairing_api.pair_invoice_with_transaction',
    args: {
      invoice_name: frm.doc.name,
      invoice_type: 'Purchase Invoice'
    },
    callback: function(r) {
      if (r.message.success) {
        frappe.show_alert({
          message: r.message.message,
          indicator: 'green'
        });
        frm.reload_doc();
      } else {
        frappe.msgprint({
          title: __('Pairing Failed'),
          message: r.message.message,
          indicator: 'red'
        });
      }
    }
  });
}

function find_payment_candidates(frm) {
  frappe.call({
    method: 'taxai.services.pairing_api.get_pairing_candidates',
    args: {
      document_type: 'Purchase Invoice',
      document_name: frm.doc.name
    },
    callback: function(r) {
      if (r.message && r.message.length > 0) {
        show_pairing_candidates_dialog(frm, r.message);
      } else {
        frappe.msgprint({
          title: __('No Candidates Found'),
          message: __('No matching bank transactions found for this invoice.'),
          indicator: 'yellow'
        });
      }
    }
  });
}

function show_pairing_candidates_dialog(frm, candidates) {
  let fields = [
    {
      label: 'Select Bank Transaction',
      fieldname: 'bank_transaction',
      fieldtype: 'Select',
      options: candidates.map(c => ({
        label: `${c.name} - ${c.date} - ${c.opponent_name} - ${format_currency(c.amount)}${c.accounting_document ? ' (Already paired)' : ''}`,
        value: c.name
      }))
    }
  ];

  let dialog = new frappe.ui.Dialog({
    title: 'Select Bank Transaction to Pair',
    fields: fields,
    primary_action_label: 'Pair',
    primary_action(values) {
      if (values.bank_transaction) {
        // First unpair the transaction from its current document if needed
        frappe.call({
          method: 'taxai.services.pairing_api.unpair_invoice_and_transaction',
          args: {
            bank_transaction_name: values.bank_transaction
          },
          callback: function(r) {
            // Then manually pair with this purchase invoice (bypasses condition checks)
            frappe.call({
              method: 'taxai.services.pairing_api.manual_pair_invoice_with_transaction',
              args: {
                invoice_name: frm.doc.name,
                invoice_type: 'Purchase Invoice',
                bank_transaction_name: values.bank_transaction
              },
              callback: function(r) {
                if (r.message.success) {
                  frappe.show_alert({
                    message: r.message.message,
                    indicator: 'green'
                  });
                  frm.reload_doc();
                } else {
                  frappe.msgprint({
                    title: __('Pairing Failed'),
                    message: r.message.message,
                    indicator: 'red'
                  });
                }
              }
            });
          }
        });
        dialog.hide();
      }
    }
  });

  dialog.show();
}

function unpair_payment_document(frm) {
  frappe.confirm(
    __('Are you sure you want to unpair this invoice from its payment document?'),
    () => {
      frappe.call({
        method: 'taxai.services.pairing_api.unpair_invoice_and_transaction',
        args: {
          purchase_invoice_name: frm.doc.name
        },
        callback: function(r) {
          if (r.message.success) {
            frappe.show_alert({
              message: r.message.message,
              indicator: 'green'
            });
            frm.reload_doc();
          } else {
            frappe.msgprint({
              title: __('Unpairing Failed'),
              message: r.message.message,
              indicator: 'red'
            });
          }
        }
      });
    }
  );
}