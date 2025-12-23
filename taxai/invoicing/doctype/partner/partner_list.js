

frappe.listview_settings['Partner'] = {

  onload(listview) {
    listview.get_checked_items = function (only_docnames) {

      const docnames = Array.from(listview.$checks || []).map((check) =>
        cstr(unescape($(check).data().name))
      );

      if (only_docnames) return docnames;

      return this.data.filter((d) => docnames.includes(d.name.toString()));
    }
  },

};
