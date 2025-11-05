// Copyright (c) 2025, Michal Chrmo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Incoming Document", {
	refresh(frm) {

		frm.add_custom_button(__('Mine Document'), function () {

			frappe.call({
        method: "taxai.taxai.doctype.incoming_document.incoming_document.startExtraction",
        args: {
          document_name: frm.doc.name
        },
        freeze: false,
        callback: function (response) {
          frappe.show_alert(__('Document is being processed'), 5);
        }
      });
		});
	},
});
