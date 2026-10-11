const fs = require('node:fs');
const customersPath = 'src/pages/Customers.jsx';
let source = fs.readFileSync(customersPath, 'utf8');
source = source.replace('  const available = wallet.purchased - wallet.distributed', '  const [loadBusy, setLoadBusy] = useState(false)\n  const available = wallet.balance');
source = source.replace('  const load = async (event) => { event.preventDefault(); const ok = await loadPoints(selected.id, Number(event.currentTarget.amount.value)); setNotice(ok ? "Customized Buzz Points loaded successfully." : "Point loading failed."); if (ok) setSelected(null) }', `  const load = async (event) => {
    event.preventDefault()
    if (loadBusy) return
    const amount = Number(event.currentTarget.amount.value)
    setLoadBusy(true)
    try {
      const ok = await loadPoints(selected.id, amount, selected.requestId)
      setNotice(ok ? "Shared BuzzPoints loaded successfully." : "Point loading failed.")
      if (ok) setSelected(null)
    } finally { setLoadBusy(false) }
  }`);
source = source.replace('Customer Wallets', 'Shared Customer Wallets').replace('sum + item.wallet', 'sum + (item.wallet || 0)').replace('Customized Buzz Points', 'Shared BuzzPoints').replace('Available Inventory', 'Business BP Balance');
source = source.replace('{customer.wallet.toLocaleString()} BP', '{customer.wallet == null ? "Wallet unavailable" : `${customer.wallet.toLocaleString()} BP`}');
source = source.replace('onClick={() => setSelected(customer)}', 'disabled={!customer.profile_id || customer.profileStatus !== "ACTIVE" || customer.status !== "ACTIVE"} onClick={() => setSelected({ ...customer, requestId: crypto.randomUUID() })}');
source = source.replace('onClose={() => setSelected(null)}', 'onClose={() => { if (!loadBusy) setSelected(null) }}');
source = source.replace('Available inventory:', 'Available business balance:');
source = source.replace('name="amount" type="number" min="1" max={available} required', 'name="amount" type="number" min="1" step="1" max={available} required disabled={loadBusy} onChange={() => setSelected((current) => ({ ...current, requestId: crypto.randomUUID() }))}');
source = source.replace('<Button type="submit"><Plus size={17} />Confirm Load</Button>', '<Button type="submit" disabled={loadBusy}><Plus size={17} />{loadBusy ? "Loading…" : "Confirm Load"}</Button>');
fs.writeFileSync(customersPath, source);
const workstationPath = 'src/pages/Workstations.jsx';
source = fs.readFileSync(workstationPath, 'utf8');
source = source.replace('setSessionStation(item); setCustomerType', 'setRequestId(crypto.randomUUID()); setSessionStation(item); setCustomerType');
source = source.replace('disabled={Boolean(busyId)} defaultValue=""', 'disabled={Boolean(busyId)} defaultValue="" onChange={() => setRequestId(crypto.randomUUID())}');
source = source.replace('customer.status === "ACTIVE").map', 'customer.status === "ACTIVE").map');
source = source.replace('· {customer.wallet} BP', '· {customer.wallet == null ? "Wallet unavailable" : `${customer.wallet} BP`}');
source = source.replace('setCustomerType(event.target.value); setPaymentMethod', 'setRequestId(crypto.randomUUID()); setCustomerType(event.target.value); setPaymentMethod');
source = source.replace('onChange={(event) => setPaymentMethod(event.target.value)}', 'onChange={(event) => { setPaymentMethod(event.target.value); setRequestId(crypto.randomUUID()) }}');
source = source.replace('name="guestName" required', 'name="guestName" onChange={() => setRequestId(crypto.randomUUID())} required');
source = source.replace('min="0.01" step="0.01" disabled={Boolean(busyId)} placeholder="Enter amount"', 'min={paymentMethod === "BUZZPOINTS" ? "1" : "0.01"} step={paymentMethod === "BUZZPOINTS" ? "1" : "0.01"} onChange={() => setRequestId(crypto.randomUUID())} disabled={Boolean(busyId)} placeholder="Enter amount"');
fs.writeFileSync(workstationPath, source);
const transactionsPath = 'src/pages/Transactions.jsx';
source = fs.readFileSync(transactionsPath, 'utf8').replace('Business-scoped purchases, wallet loads, and linked refund audit entries.', 'Business purchases, shared wallet loads, and BP refunds.').replace('Record linked refund', 'Refund shared BP payment');
fs.writeFileSync(transactionsPath, source);
const walletPath = 'src/pages/Wallet.jsx';
source = fs.readFileSync(walletPath, 'utf8').replace('wallet.purchased - wallet.distributed', 'wallet.balance');
source = source.replace('Available Customized Buzz Points', 'Shared Business BP Balance');
source = source.replace('(available / wallet.purchased) * 100', 'Math.min(100, (available / wallet.purchased) * 100)');
fs.writeFileSync(walletPath, source);
