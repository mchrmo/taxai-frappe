// Copyright (c) 2025, Michal Chrmo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Incoming Document", {

  onload(frm) {

    const container = $(`
    <div style="height: calc(100vh - 52px); overflow: hidden;">
      <iframe
        id="taxai-react-frame"
        src="/assets/taxai/react/index.html?doc=${frm.doc.name}"
        style="width:100%; height:100%; border:0; background:white;"
      ></iframe>
    </div>
  `);

    $(frm.page.wrapper).html(container);
    console.log(frm.doc);


    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;

      const data = event.data;
      if (data?.type === "PARENT_ROUTE" && Array.isArray(data.route)) {
        frappe.set_route(...data.route);
      }
    });
  },


  refresh(frm) {
    return
    frm.page.add_inner_button(__(frm.doc.extracted_data ? 'Extract data again' : 'Extract data'), function () {
      mineDocument(frm.doc.name);
    }, null, 'secondary');


    if (!frm.is_new()) {
      // frm.disable_save();

      if (!frm.doc.linked_accounting_document) {
        frm.page.add_inner_button('Create document', () => {

          createAccountingDocument(frm.doc.name);
        }, null, 'primary');

      } else {
        frm.add_custom_button('Create', () => {

          createAccountingDocument(frm.doc.name);
        }, 'Accounting document');

        frm.add_custom_button('Delete linked', () => {
          frappe.confirm(
            __('Are you sure you want to delete the linked accounting document?'),
            () => {
              // Yes action
              deleteLinkedAccountingDocument(frm.doc.name);
            })
        }, 'Accounting document');
      }


      // Render Document Viewer tab
      if (frm.doc.file_url) {
        // Load document viewer component
        frappe.require('/assets/taxai/js/document_viewer/docviewer.js', () => {
          window.renderDocumentViewer(frm);
        });
      }
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