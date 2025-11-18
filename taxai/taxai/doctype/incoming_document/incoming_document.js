// Copyright (c) 2025, Michal Chrmo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Incoming Document", {
  refresh(frm) {

    frm.add_custom_button(__('Mine Document'), function () {
      mineDocument(frm.doc.name);
    });


    if (!frm.is_new()) {
      frm.add_custom_button('Create', () => {

        createAccountingDocument(frm.doc.name);
      }, 'Accounting document');

      frm.add_custom_button('Delete linked', () => {
        console.log(frm.doc.name);
        
        frappe.confirm(
          __('Are you sure you want to delete the linked accounting document?'),
          () => {
            // Yes action
            deleteLinkedAccountingDocument(frm.doc.name);
          })
      }, 'Accounting document');

    }

  },
});

function mineDocument(documentName) {
  frappe.call({
    method: "taxai.taxai.doctype.incoming_document.incoming_document.startExtraction",
    args: {
      document_name: documentName
    },
    freeze: false,
    callback: function (response) {
      frappe.show_alert(__('Document is being processed'), 5);
    }
  });
}

function createAccountingDocument(documentName) {
  frappe.call({
    method: 'taxai.taxai.doctype.incoming_document.incoming_document.create_accounting_document',
    args: { incoming_document_name: documentName },
    callback: function (r) {
      if (r.success) {
        frappe.show_alert({
          message: r.message,
          indicator: 'green'
        });
      } else {
        frappe.msgprint({
          title: __('Document Creation Failed'),
          message: r.message,
          indicator: 'red'
        });
      }
    }
  });
}

function deleteLinkedAccountingDocument(documentName) {
  frappe.call({
    method: 'taxai.taxai.doctype.incoming_document.incoming_document.remove_linked_document',
    args: { incoming_document_name: documentName },
    callback: function (r) {
      if (r.message) {
        frappe.show_alert({
          message: r.message,
          indicator: 'green'
        });
      } else {
        frappe.msgprint({
          title: __('Failed'),
          message: r.message,
          indicator: 'red'
        });
      }
    }
  });
}