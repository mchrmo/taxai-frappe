



frappe.listview_settings['Incoming Document'] = {

  onload: (listview) => {

    listview.page.add_menu_item('Sync w Google Drive', () => {
      frappe.call({
        method: "taxai.integrations.google_drive_sync.sync_shared_folders",
        freeze: true,
        callback: (r) => {
          console.log(r);

          if (r.message) {
            frappe.show_alert({ message: __('Sync started'), indicator: 'green' });
          }
        }
      });
    });
  },

  formatters: {
    document_type: function (val) {
      return val
    }
  },

  button: {
    show(doc) {
      return doc.status == "Imported";
    },
    get_label() {
      return 'Extract Data';
    },
    get_description(doc) {
      return __('Extract Data from {0}', [`${doc.doc_name}`])
    },
    action(doc) {
      frappe.call({
        method: "taxai.taxai.doctype.incoming_document.incoming_document.startExtraction",
        args: {
          document_name: doc.name
        },
        freeze: false,
        callback: function (response) {
          frappe.show_alert(__('Document is being processed'), 5);
        }
      });
    }
  }
}