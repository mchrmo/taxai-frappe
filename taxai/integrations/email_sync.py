
import frappe
import time

def handle_email_communication(doc, event):
  

  if not doc.get('has_attachment'):
    return
  
  print("Handling email communication with attachments...")
  
  frappe.enqueue(
    process_email_communication,
    queue='default',
    timeout=300,
    now=False,
    at_front=False,
    enqueue_after_commit=True,
    job_name=f'process_email_{doc.name}',
    communication=doc,
  )
  
  
  # frappe.delete_doc(doc.doctype, doc.name, ignore_permissions=True)
  # for att in attachments:
  #   print(f"Processing attachment {att['file_name']}")
  #   print(att)    
    # inc = frappe.get_doc({
    #     "doctype": "Incoming Document",
    #     "source": "Email",
    #     "doc_name": att["name"],
    # }).insert(ignore_permissions=True)
    

def process_email_communication(communication):
  attachments = frappe.get_all(
    "File",
    filters={
      "attached_to_doctype": communication.doctype,
      "attached_to_name": communication.name
    },
    fields=["name", "file_name", "file_url"]
  )
  
  
  for att in attachments:
    if not att["file_name"].lower().endswith('.pdf'):
      continue
    
    inc = frappe.get_doc({
      "doctype": "Incoming Document",
      "source": "Email",
      "doc_name": communication.subject,
    }).insert(ignore_permissions=True)

    frappe.get_doc({
      "doctype": "File",
      "file_url": att["file_url"],
      "file_name": att["file_name"],
      "attached_to_doctype": "Incoming Document",
      "attached_to_name": inc.name,
      "is_private": 0
    }).insert(ignore_permissions=True)
  
