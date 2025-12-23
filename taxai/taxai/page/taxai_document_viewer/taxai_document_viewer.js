frappe.pages['taxai-document-viewer'].on_page_load = async function (wrapper) {

  console.log("loaded");
  
  const container = $(`
    <div style="height: calc(100vh - 52px); overflow: hidden;">
      <iframe
        id="taxai-react-frame"
        src="/assets/taxai/react/index.html"
        style="width:100%; height:100%; border:0; background:white;"
      ></iframe>
    </div>
  `);

  $(wrapper).append(container);

}