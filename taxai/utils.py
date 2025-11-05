
import frappe


@frappe.whitelist()
def get_next_naming_series_number(naming_series):
  series = frappe.get_doc("Naming Series", naming_series)
  
  if not series:
    raise ValueError(f"Naming Series '{naming_series}' does not exist.")
    
  new_number = series.current_number + 1
  padded = str(new_number).zfill(series.length)
  year_prefix = frappe.utils.get_datetime().strftime("%y")
  full_number = f"{series.prefix}-{year_prefix}{padded}"

  return full_number

