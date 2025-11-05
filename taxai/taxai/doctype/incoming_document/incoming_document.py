# Copyright (c) 2025, Michal Chrmo and contributors
# For license information, please see license.txt

import json
import frappe
from frappe.model.document import Document
from frappe.utils import getdate
from taxai.utils import get_next_naming_series_number

import taxai.integrations.document_miner as document_miner
import time



class IncomingDocument(Document):

  def _clasifyDocument(self, classifiedType, data):
    
    self.classification_reasoning = ""
    company = frappe.get_doc("Company")      
      
    match classifiedType.lower():
      case "invoice":
        if company.company_name == data.get("supplier_name", ""):
          self.classification_reasoning += "Supplier name matches company name on the invoice = Sale Invoice"
          return "Sale Invoice"
        elif company.company_name == data.get("buyer_name", ""):
          self.classification_reasoning += "Customer name matches company name on the invoice = Purchase Invoice"
          return "Purchase Invoice"
        else:
          self.classification_reasoning += "Supplier and Customer names do not match company name on the invoice"
          return

      case "receipt":
          if company.company_name == data.get("supplier_name", ""):
            self.classification_reasoning += "Supplier name matches company name on the receipt = Cash Payment"
            return "Cash Payment"
          else:
            self.classification_reasoning += "Supplier name does not match company name on the receipt = Cash Receipt"
            return "Cash Receipt"
          
      case _:
        self.classification_reasoning += f"Unknown document type: {classifiedType}"
        return
        
  def _extractDataFromDocument(self):
    miner_response = document_miner.mine_document(self)
    
    self.extracted_data = json.dumps(miner_response, indent=2, ensure_ascii=False)
    
    if(miner_response.get("status") == 0):
      self.status = "Pending check"
      self.save()
      return
    
    confidence = float(miner_response.get("typeConfidence", 0))
    if confidence < 0.9:
      self.classification_reasoning = "Low confidence in classification"
      self.status = "Pending check"
      self.save()
      return
      
    self.document_type = self._clasifyDocument(
      miner_response.get("classifiedType", "Other"),
      miner_response.get("data", {})
    )
    self.save()

    data = miner_response["data"]
    
    
    
    # Create document based on classification
    if self.document_type == "Purchase Invoice" or self.document_type == "Sale Invoice":
      
      

      items = []
      for item in data.get("items", []):
        items.append({
          "item_name": item.get("description", "Unknown Item"),
          "quantity": item.get("quantity", 1),
          "unit": item.get("unit", 'x'),
          "unit_price": item.get("unit_price", 0),
          "total_price": item.get("line_total", 0),
          "vat_rate": item.get("vat_rate", 0),
          # Add more fields as necessary
        })

      invoice = frappe.get_doc({
        "doctype": self.document_type,
        "issued_date": getdate(data['issued_date']),
        "due_date": getdate(data['due_date']),
        "items": items,
        "currency": data.get("currency", "EUR"),
        "subtotal": data.get("subtotal", 0),
        "vat_total": data.get("vat_amount", 0),
        "total": data.get("total", 0),
      })
      
      if self.document_type == "Purchase Invoice":
        newNumber = get_next_naming_series_number(self.document_type)
        invoice.internal_number = newNumber
        invoice.external_number = data.get("invoice_number", "")

        partner = self._getPartner(data.get("supplier_name", ""))
        invoice.supplier = partner.name
      else:
        invoice.internal_number = data.get("invoice_number", "")

        partner = self._getPartner(data.get("buyer_name", ""))
        invoice.customer = partner.name

      invoice.name = invoice.internal_number
      invoice.insert()
      # self.created_document = invoice.name
    
    
    self.status = "Imported"
    self.save()
    print("Status updated to Imported")
    frappe.msgprint("Data extraction completed and status updated to 'Imported'.")

  def _getPartner(self, partner_name):
    try:
      partner = frappe.get_doc("Partner", {"partner_name": partner_name})
      return partner
    except frappe.DoesNotExistError:
      partner = frappe.new_doc('Partner')
      partner.partner_name = partner_name
      partner.insert()
      return partner

@frappe.whitelist()
def startExtraction(document_name):
  document = frappe.get_doc("Incoming Document", document_name)
  # if document.status != "Imported":
  #   raise Exception("Document status must be 'Imported' to start extraction.")

  document.status = "Processing"
  document.save()
  
  frappe.enqueue(document._extractDataFromDocument, queue='short', timeout=None, job_name='Extract Data from Document ' + document.doc_name)
