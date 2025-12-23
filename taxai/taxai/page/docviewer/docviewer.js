frappe.pages["docviewer"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Docviewer"),
		single_column: true,
	});
};

frappe.pages["docviewer"].on_page_show = function (wrapper) {
	load_desk_page(wrapper);
};

function load_desk_page(wrapper) {
	let $parent = $(wrapper).find(".layout-main-section");
	$parent.empty();

	frappe.require("docviewer.bundle.jsx").then(() => {
		frappe.docviewer = new frappe.ui.Docviewer({
			wrapper: $parent,
			page: wrapper.page,
		});
	});
}