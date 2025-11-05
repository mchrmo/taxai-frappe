# Copyright (c) 2025, Michal Chrmo and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class NamingSeries(Document):
	

  def increment_series(self):
    self.current_number += 1
    self.save()
