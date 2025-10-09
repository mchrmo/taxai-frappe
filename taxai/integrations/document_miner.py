import frappe
import requests
import os
import json




@frappe.whitelist()
def mine_document(incoming_document_id) -> dict:
  # incoming_document_id = 4
  # Get the Incoming Document
  incoming_doc = frappe.get_doc("Incoming Document", incoming_document_id)
  
  # Get the attachment file path
  if not incoming_doc.file_url:
    frappe.throw("No attachment found in the Incoming Document")
  
  file_path = frappe.get_site_path() + incoming_doc.file_url
  
  print(f"Processing file at: {file_path}")
  # Prepare form data for POST request
  with open(file_path, 'rb') as file:
    files = {'pdf': file}
    response = requests.post('http://docker.for.mac.localhost:3000/process-pdf', files=files)

  print(f"response: {response.text}")

  # Save response to a Document

  # Parse and format the JSON response
  try:
    parsed_response = json.loads(response.text)
    formatted_json = json.dumps(parsed_response, indent=2, ensure_ascii=False)
    incoming_doc.db_set("extracted_data", formatted_json)
    incoming_doc.db_set("document_type", parsed_response.get("classifiedType", "Unknown"))
  except json.JSONDecodeError:
    # If response is not valid JSON, save as-is
    incoming_doc.db_set("extracted_data", response.text)

  file_path = incoming_doc.file_url

  # Placeholder implementation
  return {"status": "Document mined successfully", "file_path": file_path}