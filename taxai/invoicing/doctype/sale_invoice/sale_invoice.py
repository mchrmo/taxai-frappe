# Copyright (c) 2025, Michal Chrmo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SaleInvoice(Document):
	
	def find_matching_bank_transaction(self):
		"""Find bank transaction that matches this sale invoice's variable symbol and total amount"""
		if not self.variable_symbol or not self.total:
			return None
		
		bank_transactions = frappe.get_all(
			"Bank Transaction",
			filters={
				"vs": self.variable_symbol,
				"absolute_amount": self.total,
				"accounting_document": ["is", "not set"]
			},
			fields=["name", "amount", "date", "opponent_name"]
		)
		
		return bank_transactions[0]["name"] if len(bank_transactions) == 1 else None
	
	def pair_with_bank_transaction(self):
		"""Automatically pair this sale invoice with matching bank transaction"""
		from taxai.services.pair_document import pair_sale_invoice_with_bank_transaction
		return pair_sale_invoice_with_bank_transaction(self.name)
	
	def unpair_payment_document(self):
		"""Remove pairing with payment document"""
		from taxai.services.pair_document import unpair_documents
		return unpair_documents(sale_invoice_name=self.name)
	
	def is_paid(self):
		"""Check if this invoice has been paid (has a linked payment document)"""
		return bool(self.payment_document and self.payment_document_type)

