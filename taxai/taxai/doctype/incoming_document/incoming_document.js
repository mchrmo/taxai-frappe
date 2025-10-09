// Copyright (c) 2025, Michal Chrmo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Incoming Document", {
	refresh(frm) {

		frm.add_custom_button(__('Mine Document'), function () {

			frappe.call({
				method: "taxai.integrations.document_miner.mine_document",
				args: {
					incoming_document_id: frm.doc.name
				},
				freeze: true,
				callback: function (response) {
					if (response.message) {
						frappe.show_alert(__('Document mined successfully'));
						frm.reload_doc();
					}
				}
			});
		});
	},
});
