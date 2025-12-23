// Copyright (c) 2025, Michal Chrmo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Bank Transaction", {
	refresh(frm) {
		// Show pairing status indicator
		if (!frm.is_new()) {
			if (frm.doc.accounting_document) {
				frm.page.set_indicator(__('Paired'), 'green');
				
				// Add button to view the paired document
				frm.add_custom_button('View Paired Document', () => {
					frappe.set_route('Form', frm.doc.accounting_document_type, frm.doc.accounting_document);
				});
				
				// Add button to unpair
				frm.add_custom_button('Unpair', () => {
					unpair_transaction(frm);
				}, 'Payment');
			} else {
				frm.page.set_indicator(__('Unpaired'), 'orange');
				
				// Add button to pair with invoice
				frm.add_custom_button('Pair with Invoice', () => {
					pair_with_invoice(frm);
				}, 'Payment');
			}
		}
	},
});

function pair_with_invoice(frm) {
	let message = `<div style="margin-bottom: 15px; padding: 10px; background-color: #e3f2fd; border-left: 4px solid #2196f3;">
		<strong>ℹ Select an invoice to pair with this transaction</strong><br>
		Search by invoice number, customer/supplier name, or amount
	</div>`;

	let fields = [
		{
			fieldtype: 'HTML',
			options: message
		},
		{
			label: 'Invoice Type',
			fieldname: 'invoice_type',
			fieldtype: 'Select',
			options: ['Sale Invoice', 'Purchase Invoice'],
			reqd: 1,
			default: frm.doc.amount > 0 ? 'Sale Invoice' : 'Purchase Invoice',
			onchange: function() {
				// Clear invoice selection and details when type changes
				dialog.set_value('invoice', null);
				dialog.fields_dict.invoice_details.$wrapper.html('');
				// Update the invoice field's options
				let invoice_field = dialog.fields_dict.invoice;
				invoice_field.df.options = this.get_value();
				invoice_field.refresh();
			}
		},
		{
			label: 'Invoice',
			fieldname: 'invoice',
			fieldtype: 'Link',
			options: frm.doc.amount > 0 ? 'Sale Invoice' : 'Purchase Invoice',
			reqd: 1,
			get_query: function() {
				let invoice_type = dialog.get_value('invoice_type') || (frm.doc.amount > 0 ? 'Sale Invoice' : 'Purchase Invoice');
				return {
					query: 'taxai.services.pairing_api.get_unpaired_invoices_for_transaction',
					filters: {
						invoice_type: invoice_type,
						transaction_amount: frm.doc.absolute_amount
					}
				};
			},
			onchange: function() {
				// Show invoice details when selected
				let invoice_name = this.get_value();
				let invoice_type = dialog.get_value('invoice_type');
				if (invoice_name && invoice_type) {
					frappe.db.get_doc(invoice_type, invoice_name).then(doc => {
						let customer_or_supplier = invoice_type === 'Sale Invoice' ? 
							`Customer: <strong>${doc.customer || 'N/A'}</strong>` : 
							`Supplier: <strong>${doc.supplier || 'N/A'}</strong>`;
						let details = `<div style="margin-top: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 4px;">
							<strong>Invoice Details:</strong><br>
							${customer_or_supplier}<br>
							Total: <strong>${format_currency(doc.total, doc.currency)}</strong><br>
							Unpaid: <strong>${format_currency(doc.unpaid_amount || doc.total, doc.currency)}</strong><br>
							Issued: <strong>${doc.issued_date}</strong><br>
							VS: <strong>${doc.variable_symbol || doc.external_number || 'N/A'}</strong>
						</div>`;
						dialog.fields_dict.invoice_details.$wrapper.html(details);
					});
				} else {
					dialog.fields_dict.invoice_details.$wrapper.html('');
				}
			}
		},
		{
			fieldtype: 'HTML',
			fieldname: 'invoice_details'
		}
	];

	let dialog = new frappe.ui.Dialog({
		title: 'Pair with Invoice',
		fields: fields,
		size: 'large',
		primary_action_label: 'Pair',
		primary_action(values) {
			if (values.invoice && values.invoice_type) {
				frappe.call({
					method: 'taxai.services.pairing_api.manual_pair_invoice_with_transaction',
					args: {
						invoice_name: values.invoice,
						invoice_type: values.invoice_type,
						bank_transaction_name: frm.doc.name
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

function unpair_transaction(frm) {
	frappe.confirm(
		__('Are you sure you want to unpair this transaction from its invoice?'),
		() => {
			frappe.call({
				method: 'taxai.services.pairing_api.unpair_invoice_and_transaction',
				args: {
					bank_transaction_name: frm.doc.name
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
