



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
        document_type: function(val) {
            if (val === "INVOICE") {
                return "<span class='indicator-pill green'>" + __(val) + "</span>";
            }
        }
    }


}