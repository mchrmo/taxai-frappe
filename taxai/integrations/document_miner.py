import frappe
import requests
import os
import json




@frappe.whitelist()
def mine_document(incoming_doc) -> dict:

  miner_url = frappe.get_doc("Taxai Settings").backend_url
  if not miner_url:
    frappe.throw("Please configure the Taxai Settings with the backend URL.")
  
  attachments = frappe.get_all(
    "File",
    filters={
      "attached_to_doctype": incoming_doc.doctype,
      "attached_to_name": incoming_doc.name
    },
    fields=["name", "file_name", "file_url"]
  )
  
  # Get the attachment file path
  if not len(attachments):
    frappe.throw("No attachment found in the Incoming Document")
  
  file_path = frappe.get_site_path() + attachments[0].file_url
  
  print(f"Processing file at: {file_path}")
  
  # Prepare form data for POST request
  with open(file_path, 'rb') as file:
    files = {'pdf': file}
    print(f"Miner URL: {miner_url}")
    response = requests.post(f'{miner_url}/process-pdf', files=files)


  # Save response to a Document
  try:
    parsed_response = json.loads(response.text)
    response = parsed_response

  except json.JSONDecodeError:
    response = {"status": 0,"message": "Invalid JSON response from miner service"}


  return response
 