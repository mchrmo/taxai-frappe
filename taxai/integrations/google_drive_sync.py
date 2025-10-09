import json, frappe
from taxai.integrations.google_drive import list_all_pdfs, download_pdf


def _already_ingested(file_id: str) -> bool:
    return bool(frappe.db.exists("Incoming Document", {"drive_file_id": file_id}))

@frappe.whitelist()
def sync_shared_folders():
      s = frappe.get_single("Google Drive Settings")
      if not s.folder_id:
          frappe.throw("Set Company Folder ID in Google Drive Settings.")
      print(f"Syncing folder {s.folder_id}")
      _ingest_folder(s.folder_id)

def _attach(doctype: str, name: str, content: bytes, filename: str):
    f = frappe.get_doc({
        "doctype": "File",
        "file_name": filename  ,
        "attached_to_doctype": doctype,
        "attached_to_name": name,
        "content": content,
        "is_private": 1
    }).insert(ignore_permissions=True)
    return f.file_url

def _ingest_folder(folder_id: str):
    for f in list_all_pdfs(folder_id, include_shared_drives=True):
        if _already_ingested(f["id"]):
            continue
        pdf = download_pdf(f["id"], include_shared_drives=True)
        # Create Incoming Document; you can reuse your earlier parser/classifier
        inc = frappe.get_doc({
            "doctype": "Incoming Document",
            "source": "Google Drive",
            "doc_name": f["name"],
            "drive_file_id": f["id"],
        }).insert(ignore_permissions=True)
        print(f"Created Incoming Document {inc.name} for file {f['name']}")
        url = _attach("Incoming Document", inc.name, pdf, f["name"])
        inc.db_set("file_url", url)
