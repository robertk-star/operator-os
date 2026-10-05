function headcount(contact: Contact) {
  return (contact.tags || []).find((tag) => /employee/i.test(tag)) || "";
}
