// Copyright (c) 2025, Michal Chrmo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Bank Account", {
	refresh(frm) {
		frm.add_custom_button(__('Sync Bank Transactions'), function() {
      frappe.call({
        method: 'taxai.integrations.bank_sync.sync_bank_transactions',
        args: {
          bank_account_name: frm.doc.name,
          from_date: frappe.datetime.add_days(frappe.datetime.get_today(), -30)
        },
        freeze: true,
        freeze_message: __('Syncing transactions...'),
        callback: function(r) {
          if (!r.exc) {
            frappe.show_alert({
              message: __('Bank transactions synced successfully'),
              indicator: 'green'
            });
            frm.reload_doc();
          }
        }
      });
		});
	},
});
