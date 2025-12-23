// Copyright (c) 2025, Michal Chrmo and contributors
// For license information, please see license.txt
frappe.listview_settings["Your DocType"] = {
  onload(listview) {
    // Override a specific method inside listview
    listview.get_checked_items = function () {
      console.log("call");

      const docnames = Array.from(listview.$checks || []).map((check) =>
        cstr(unescape($(check).data().name))
      );
      console.log(this.data, docnames);

      if (only_docnames) return docnames;

      return this.data.filter((d) => docnames.includes(d.name.toString()));
    }
  }
};
