// Copyright (c) 2025, Michal Chrmo and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Sale Invoice", {
// 	refresh(frm) {

// 	},
// });

// Copyright (c) 2025, Michal Chrmo and contributors
// For license information, please see license.txt






let current_value = 0
frappe.ui.form.on("Sale Invoice", {
  onload(frm) {

    if (frm.is_new()) {
      frm.set_value("type", "Vystavená faktúra");
      frm.set_value("issued_date", new Date());
      frm.set_value("delivery_date", new Date());
      frm.trigger('due_days');

      calculateTotal(frm);
      frm.trigger('payment_method');
    }

  },

  onload_post_render(frm) {
    if (!frm.doc.customer) {
      frm.fields_dict['customer_section'].collapse(false);
    }
    frm.fields_dict['totals_and_payment'].collapse(false);
    
  },

  refresh(frm) {
    
    let change_number_dialog = new frappe.ui.Dialog({
      title: 'Change number',
      fields: [
        {
          label: 'New number',
          fieldname: 'new_number',
          fieldtype: 'Data',
          default: frm.doc.number
        }
      ],
      size: 'small',
      primary_action_label: 'Submit',
      primary_action(values) {
        setInvoiceNumber(frm, values.new_number);
        change_number_dialog.hide();
      }
    })

    frm.add_custom_button('Change number', () => change_number_dialog.show());

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

    frm.page.add_action_item('Duplicate', () => {
      frappe.new_doc('Sale Invoice', { type: frm.doc.type, customer: frm.doc.customer, items: frm.doc.items });
    })

  },

  type(frm) {
    if (!frm.doc.type) return;

    // Get last invoice number of same type
    // frappe.db.get_list('Sale Invoice', {
    //   filters: {
    //     type: frm.doc.type
    //   },
    //   fields: ['number'],
    //   order_by: 'creation desc',
    //   limit: 1
    // }).then(async r => {
    //   let invoice_number = 1;

    //   if (r && r.length > 0) {
    //     invoice_number = parseInt(r[0].number) + 1;
    //   }
    //   setInvoiceNumber(frm, invoice_number);
    // });
  },

  customer(frm) {
    setCustomer(frm);
  },

  // payment_method(frm) {
  //   frm.toggle_display(['iban'], frm.doc.payment_method !== 'Cash');
  //   frm.toggle_reqd('iban', frm.doc.payment_method !== 'Cash');
  // },

  due_days(frm) {
    if (!frm.doc.issued_date || frm.doc.due_days == null) return;
    const new_due = frappe.datetime.add_days(frm.doc.issued_date, frm.doc.due_days);
    if (frm.doc.due_date !== new_due) {
      frm.set_value('due_date', new_due);
    }
  },

  issued_date(frm) {
    if (!frm.doc.issued_date || frm.doc.due_days == null) return;
    const new_due = frappe.datetime.add_days(frm.doc.issued_date, frm.doc.due_days);
    if (frm.doc.due_date !== new_due) {
      frm.set_value('due_date', new_due);
    }
  },

  due_date(frm) {
    if (!frm.doc.issued_date || !frm.doc.due_date) return;
    if (frm.doc.issued_date && frm.doc.due_date) {
      const days_diff = frappe.datetime.get_diff(frm.doc.due_date, frm.doc.issued_date);
      frm.set_value("due_days", days_diff);
    }
  },

  payment_method(frm) {
    if (frm.doc.payment_method === "Cash") {
      frm.set_value("payment_document_type", 'Cash Payments');
    } else {
      frm.set_value("payment_document_type", 'Bank Transaction');
    }
  }
});


frappe.ui.form.on('Invoice Item', {
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
    item.total = item.qty * item.unit_price;
    item.vat_amount = item.total * (item.vat_rate / 100);
    item.total_with_vat = item.total + item.vat;
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

async function setInvoiceNumber(frm, number) {
  let prefix = 'FA';
  let padding = 4;

  // const code = await frappe.db.get_doc('Code list', frm.doc.type);
  // if (code) {
  //   prefix = code.short || prefix;
  //   padding = code.padding || padding;
  // }

  const full_number = prefix + '-' + String(number).padStart(padding, '0');
  frm.set_value('number', number);
  frm.set_value('full_number', full_number);
}

// Others

function setCustomer(frm) {

  if (frm.doc.customer) {
    frappe.db.get_doc('Partner', frm.doc.customer).then(customer => {
      console.log(customer);
      
      if (customer) {
        frm.set_value({
          customer_business_id: customer.business_id,
          customer_tax_id: customer.tax_id,
          customer_vat_id: customer.vat_id,
          customer_address_1: customer.street,
          customer_address_2: ((customer.city || '') + ((customer.state ? ', ' + customer.state : '') || '')) || ''
        })

      }
    });
  } else {
    frm.set_value({
      customer_business_id: null,
      customer_tax_id: null,
      customer_vat_id: null,
      customer_address_1: null,
      customer_address_2: null
    });
  }
  frm.fields_dict['customer_section'].collapse(false);

}

async function get_new_number(frm) {
  const res = await frappe.call("taxai.utils.get_next_naming_series_number", { naming_series: "Sale Invoice" })
  frm.set_value("internal_number", res.message);
}

// Payment pairing functions
function pair_with_bank_transaction(frm) {
  frappe.call({
    method: 'taxai.services.pairing_api.pair_invoice_with_transaction',
    args: {
      invoice_name: frm.doc.name,
      invoice_type: 'Sale Invoice'
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
      document_type: 'Sale Invoice',
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
        label: `${c.name} - ${c.date} - ${c.opponent_name} - €${c.amount}${c.accounting_document ? ' (Already paired)' : ''}`,
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
        // Manual pairing via API (bypasses condition checks)
        frappe.call({
          method: 'taxai.services.pairing_api.manual_pair_invoice_with_transaction',
          args: {
            invoice_name: frm.doc.name,
            invoice_type: 'Sale Invoice',
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
          sale_invoice_name: frm.doc.name
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
