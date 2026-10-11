const fs = require('node:fs');
const path = 'src/pages/Customers.jsx';
let source = fs.readFileSync(path, 'utf8');
const before = '{customer.status === "ACTIVE" && <button onClick={() => setCardCustomer(customer)} className="ml-2 inline-flex items-center gap-1 text-xs text-[#F5C400]"><CreditCard size={13} />{customer.card ? "Replace" : "Link card"}</button>}';
const after = '<span className="ml-2 text-xs text-[#777]">Managed by Admin</span>';
if (!source.includes(before)) throw new Error('Card action markup changed');
fs.writeFileSync(path, source.replace(before, after).trimEnd() + '\n');
