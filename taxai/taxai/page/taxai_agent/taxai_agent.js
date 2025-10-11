const tables = ['tabCustomer', 'tabReceipt']


frappe.pages['taxai-agent'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Taxai Agent',
		single_column: true
	});

	page.set_indicator('Beta testing', 'blue')
	label = page.add_label('Prompt is working with following tables: ' + tables.join(", "))
	label.removeClass('col-md-1')

	page.prompt_field = page.add_field({
		fieldname: "warehouse",
		label: __("Request"),
		fieldtype: 'Data',
		width: '12',
		default: frappe.route_options && frappe.route_options.prompt,
	});
	$(page.prompt_field.wrapper).removeClass('col-md-2').addClass('col-md-10')

	let button = $(`<button class="btn btn-primary btn-sm ellipsis col-md-2">Send</button>`);
	button.appendTo(page.page_form);
	button.on('click', () => {
		button.prop('disabled', true)
		fetch('http://localhost:3000/generate-sql', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				prompt: page.prompt_field.get_value(),
				tables
			})
		})
			.then(response => response.json())
			.then(data => {
				button.prop('disabled', false)
				console.log(data.sql);
				renderResult(data.explanation, data.fields, data.rows);
			})
			.catch(error => {
				console.error('Error:', error);
			});

	})


	let explanationEl = $('<p class="mt-3"></p>').appendTo(page.page_form).hide()
	let tableEl = $('<table class="table"></table>').appendTo(page.page_form).hide()


	const renderResult = (explanation, fields_map, rows) => {
		explanationEl.text(explanation).show();

		// console.log('Explanation:', explanation);
		// console.log('Fields Map:', fields_map);
		// console.log('Rows:', rows);

		// Clear previous table data
		tableEl.empty();

		console.log(Object.entries(fields_map));

		// // Render table headers
		let headerRow = $('<tr></tr>').appendTo(tableEl);
		Object.entries(fields_map).forEach(([field, label]) => {
			$('<th></th>').text(label).appendTo(headerRow);
		});

		// // Render table rows
		rows.forEach(row => {
			let tableRow = $('<tr></tr>').appendTo(tableEl);
			Object.keys(fields_map).forEach(field => {
				$('<td></td>').text(row[field]).appendTo(tableRow);
			});
		});

		explanationEl.show();
		tableEl.show();

	}

	console.log(tables);

}