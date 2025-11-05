import frappe
import requests
import os
import json




@frappe.whitelist()
def mine_document(incoming_doc) -> dict:

  
  # Get the attachment file path
  if not incoming_doc.file_url:
    frappe.throw("No attachment found in the Incoming Document")
  
  file_path = frappe.get_site_path() + incoming_doc.file_url
  
  print(f"Processing file at: {file_path}")
  
  # Prepare form data for POST request
  with open(file_path, 'rb') as file:
    files = {'pdf': file}
    miner_url = frappe.get_site_config().backup["miner_url"]
    print(f"Miner URL: {miner_url}")
    response = requests.post(f'{miner_url}/process-pdf', files=files)


  # Save response to a Document
  try:
    parsed_response = json.loads(response.text)
    response = parsed_response

  except json.JSONDecodeError:
    response = {"status": 0,"message": "Invalid JSON response from miner service"}


  return response
 