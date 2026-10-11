const fs = require('node:fs');
const path = 'src/pages/Customers.jsx';
let source = fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replaceAll('\u00c2\u00b7', '\u00b7').replaceAll('\u00e2\u20ac\u00a6', '\u2026');
source = source.replace('`${item.name} ${item.id}', '`${item.name} ${item.customer_code || item.id}').replace('{customer.id} \u00b7 {customer.email}', '{customer.customer_code || customer.id} \u00b7 {customer.email}');
fs.writeFileSync(path, source);
