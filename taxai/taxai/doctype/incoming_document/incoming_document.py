# Copyright (c) 2025, Michal Chrmo and contributors
# For license information, please see license.txt

import json
import re

from distro import name
import frappe
from frappe.model.document import Document
from frappe.utils import getdate
from taxai.utils import get_next_naming_series_number

import taxai.integrations.document_miner as document_miner
import time



class IncomingDocument(Document):

  def _attach_files_to_document(self, target_doctype, target_docname):
    """Attach files from incoming document to target document"""
    if not self.file_url:
      return
    
    # Get all files attached to this incoming document
    incoming_files = frappe.get_all(
      "File",
      filters={
        "attached_to_doctype": "Incoming Document",
        "attached_to_name": self.name
      },
      fields=["name", "file_name", "file_url", "is_private"]
    )
    
    # Attach each file to the target document
    for file_doc in incoming_files:
      frappe.get_doc({
        "doctype": "File",
        "file_name": file_doc.file_name,
        "file_url": file_doc.file_url,
        "attached_to_doctype": target_doctype,
        "attached_to_name": target_docname,
        "folder": "Home/Attachments",
        "is_private": file_doc.is_private
      }).insert(ignore_permissions=True)

  def _clasifyDocument(self, classifiedType, data):
    

    self.classification_reasoning = ""
    company = frappe.get_doc("Company")    
    
    company_name = normalize_name(company.company_name)
    
      
    match classifiedType.lower():
      case "invoice":
        if company_name == normalize_name(data.get("supplier_name", "")):
          self.classification_reasoning += "Supplier name matches company name on the invoice = Sale Invoice"
          return "Sale Invoice"
        elif company_name == normalize_name(data.get("buyer_name", "")):
          self.classification_reasoning += "Customer name matches company name on the invoice = Purchase Invoice"
          return "Purchase Invoice"
        else:
          self.classification_reasoning += "Supplier and Customer names do not match company name on the invoice"
          return

      case "receipt":
          if company_name == normalize_name(data.get("supplier_name", "")):
            self.classification_reasoning += "Supplier name matches company name on the receipt = Cash Payment"
            return "Cash Payment"
          else:
            self.classification_reasoning += "Supplier name does not match company name on the receipt = Cash Receipt"
            return "Cash Receipt"
          
      case _:
        self.classification_reasoning += f"Unknown document type: {classifiedType}"
        return
       
  def _create_accounting_document(self):
    
    if not self.document_type:
      frappe.throw("Document type is not set. Cannot create accounting document.")
    
    if self.created_document:
      frappe.throw(f"Accounting document of type {self.document_type} is already created: {self.created_document}")
    
    extracted_data = json.loads(self.extracted_data)
    data = extracted_data.get("data", None)

    if not data:
      frappe.throw("No extracted data available to create accounting document.")
      
    if self.document_type == "Purchase Invoice" or self.document_type == "Sale Invoice":
      invoice = create_invoice(self, data)
      self.created_document = invoice.name

    elif self.document_type == "Cash Receipt": 
      cash_receipt = create_cash_receipt(self, data)
      self.created_document = cash_receipt.name
    
    else:
      self.note += f"Document creation for type {self.document_type} is not implemented yet."
    
    self.save()
    
    return {"success": 1, "created_document": self.created_document}
        
  def _extractDataFromDocument(self):
    miner_response = document_miner.mine_document(self)
    
    self.extracted_data = json.dumps(miner_response, indent=2, ensure_ascii=False)
    self.save()
    
    
    if(miner_response.get("status") == 0):
      self.status = "Pending check"
      self.save()
      return
    
    confidence = float(miner_response.get("classification", {}).get("confidence", 0))
    if confidence < 0.9:
      self.classification_reasoning = "Low confidence in classification"
      self.status = "Pending check"
      self.save()
      return
      
    self.document_type = self._clasifyDocument(
      miner_response.get("classification", {}).get("type", "Other"),
      miner_response.get("data", {})
    )
    self.status = "Pending check"


    data = miner_response["data"]
    
    if not frappe.get_doc("Taxai Settings").allow_doc_creation:
      self.note = "Document creation is disabled in Taxai Settings."
      self.save()
      return
    
    self.save()

    self._create_accounting_document()
    
    self.status = "Processed"
    self.save()
    frappe.msgprint("Data extraction completed and status updated to 'Processed'.")

  def _getPartner(self, partner_name, business_id = "", vat_id = ""):
    # Check if partner exists using filters
    existing_partners = frappe.get_all("Partner", filters={"partner_name": partner_name}, limit=1)
    
    if existing_partners and (existing_partners[0].business_id == business_id or business_id == ""):
      # Partner exists, get the full document
      return frappe.get_doc("Partner", existing_partners[0].name)
    else:
      # Partner doesn't exist, create new one
      partner = frappe.new_doc('Partner')
      partner.partner_name = partner_name
      partner.business_id = business_id
      partner.vat_id = vat_id
      partner.insert()
      return partner



@frappe.whitelist()
def startExtraction(document_name):
  document = frappe.get_doc("Incoming Document", document_name)
  # if document.status != "Imported":
  #   raise Exception("Document status must be 'Imported' to start extraction.")

  document.status = "Processing"
  document.save()
  
  res = document._extractDataFromDocument()
  print(json.dumps(res, indent=2, ensure_ascii=False))
  # frappe.enqueue(document._extractDataFromDocument, queue='short', timeout=None, job_name='Extract Data from Document ' + document.doc_name)

@frappe.whitelist()
def create_accounting_document(incoming_document_name):
  document = frappe.get_doc("Incoming Document", incoming_document_name)

  # if document.status != "Imported":
  #   raise Exception("Document status must be 'Imported' to start extraction.")
  res = document._create_accounting_document()
  frappe.response['message'] = "Document created: " + res.get("created_document", "")
  frappe.response['success'] = 1
   
@frappe.whitelist()
def remove_linked_document(incoming_document_name):
  document = frappe.get_doc("Incoming Document", incoming_document_name)
  if not document.created_document:
    frappe.throw("No linked document to remove.")

  linked_doc = frappe.get_doc(document.document_type, document.created_document)
  linked_doc.delete()
  frappe.response['message'] = f"Linked document {document.created_document} of type {document.document_type} has been removed."
  

# Helpers

def create_invoice(self, data):
  items = []
  for item in data.get("items", []):
    items.append({
      "item_name": item.get("description", "Unknown Item"),
      "quantity": item.get("quantity", 1),
      "unit_price": item.get("unit_price", 0),
      "unit_price_with_vat": item.get("unit_price_with_vat", 0),
      "vat_rate": item.get("vat_rate", 0),
      "total": item.get("line_total", 0),
      "total_with_vat": item.get("line_total_with_vat", 0),
      "vat_amount": item.get("vat_amount", 0)
    })
    
  discount = data.get("discount", 0)
  if discount and discount > 0:
    items.append({
      "item_name": "Discount",
      "quantity": 1,
      "unit_price": -discount,
      "total": -discount,
      "vat_rate": 0,
    })

  payment_method = data.get("payment_method", "")
  if payment_method.lower() == "cash":
    payment_method = "Cash"
  elif payment_method.lower() == "bank_transfer":
    payment_method = "Bank Transfer"
  
  invoice = frappe.get_doc({
    "doctype": self.document_type,
    "issued_date": getdate(data.get("issue_date", None)),
    "delivery_date": getdate(data.get("delivery_date", None)),
    "due_date": getdate(data.get("due_date", None)),
    "items": items,
    "currency": data.get("currency", ""),
    "subtotal": data.get("total_base", 0),
    "vat": data.get("total_vat_amount", 0),
    "total": data.get("total_with_vat", 0),
    "payment_method": payment_method,
    "iban": data.get("iban", "").replace(" ", ""),
    "variable_symbol": data.get("variable_symbol", "")
  })
  
  
  partner = None
  # Purchase Invoice
  if self.document_type == "Purchase Invoice":
    newNumber = get_next_naming_series_number(self.document_type)
    invoice.internal_number = newNumber
    invoice.external_number = data.get("invoice_number", "")

    partner = self._getPartner(data.get("supplier_name", ""), data.get("supplier_ico", ""), data.get("supplier_vat_id", ""))
    invoice.supplier = partner.name
    invoice.supplier_business_id = partner.business_id
    invoice.supplier_vat_id = partner.vat_id
    

  # Sale Invoice
  elif self.document_type == "Sale Invoice": 
    invoice.internal_number = data.get("invoice_number", "")

    partner = self._getPartner(data.get("buyer_name", ""), data.get("buyer_ico", ""))
    invoice.customer = partner.name
    invoice.customer_business_id = partner.business_id
    invoice.customer_vat_id = partner.vat_id

    invoice.name = invoice.internal_number


  try:
    invoice.insert()
    
    # Attach incoming document file to invoice
    self._attach_files_to_document(self.document_type, invoice.name)
    
    return invoice
  except Exception as e:
    return e

def create_cash_receipt(self, data):
  items = []
  for item in data.get("items", []):
    items.append({
      "description": item.get("description", "Unknown Item"),
      "quantity": item.get("quantity", 1),
      "unit": item.get("unit", 'x'),
      "unit_price": item.get("unit_price", 0),
      "total": item.get("line_total", 0),
      "vat_rate": item.get("vat_rate", 0),
    })


  payment_method = data.get("payment_method", "")
  if payment_method.lower() == "cash":
    payment_method = "Cash"
  elif payment_method.lower() == "card":
    payment_method = "Payment card"

  uid = data.get("uid", "")
  if len(uid) != 34:
    uid = ""

  cash_receipt = frappe.get_doc({
    "doctype": self.document_type,
    "supplier": data.get("merchant_name", "Unknown"),
    "receipt_number": data.get("receipt_number", ""),
    "uid": uid,
    "place": data.get("merchant_address", ""),
    "date": getdate(data.get("date", None)),
    "items": items,
    "currency": data.get("currency", ""),
    "payment_method": payment_method,
    "subtotal": data.get("vat_base", 0),
    "vat_amount": data.get("vat_amount", 0),
    "total": data.get("total_with_vat", 0),
    "rounding": data.get("rounding", 0),
    "incoming_document": self.name
  })
  
  
  newNumber = get_next_naming_series_number(self.document_type)
  cash_receipt.internal_number = newNumber

  try:
    cash_receipt.insert()
    
    # Attach incoming document file to cash receipt
    self._attach_files_to_document("Cash Receipt", cash_receipt.name)
    
    return cash_receipt
  except Exception as e:
    return e


def normalize_name(name: str) -> str:
  return re.sub(r'[\s\.\,\-]+', '', name).lower()
