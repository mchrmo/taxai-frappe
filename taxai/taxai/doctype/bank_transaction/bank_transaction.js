// Copyright (c) 2025, Michal Chrmo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Bank Transaction", {
	refresh(frm) {
		// Show pairing status indicator only
		if (!frm.is_new()) {
			if (frm.doc.accounting_document) {
				frm.page.set_indicator(__('Paired'), 'green');
				
				// Add button to view the paired document
				frm.add_custom_button('View Paired Document', () => {
					frappe.set_route('Form', frm.doc.accounting_document_type, frm.doc.accounting_document);
				});
			} else {
				frm.page.set_indicator(__('Unpaired'), 'orange');
			}
		}
	},
});
