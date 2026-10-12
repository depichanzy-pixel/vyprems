/** Safe-by-default status endpoint. It never trusts a status sent by the browser. */
export async function onRequestGet({request,env}) {
  if (!env.DB) return json({error:'Database belum terhubung.'},500);
  const id = new URL(request.url).searchParams.get('order_id') || '';
  if (!/^DV-[A-Z0-9-]{8,80}$/.test(id)) return json({error:'Nomor pesanan tidak valid.'},400);
  const order = await env.DB.prepare('SELECT order_id,product_name,pay_amount,status,created_at FROM orders WHERE order_id=?').bind(id).first();
  if (!order) return json({error:'Pesanan tidak ditemukan.'},404);
  // The API docs expose /api/history/auto/:apikey. The response shape/status vocabulary
  // can differ by account; do not mark paid unless a recognized incoming mutation matches.
  if (order.status === 'pending' && env.GOMERCH_API_KEY) {
    try {
      const base = (env.GOMERCH_BASE_URL || 'https://brann-merchant-production.up.railway.app').replace(/\/$/,'');
      const res = await fetch(`${base}/api/history/auto/${encodeURIComponent(env.GOMERCH_API_KEY)}`, {headers:{'Accept':'application/json'}});
      if (res.ok) {
        const payload = await res.json();
        const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : Array.isArray(payload?.data?.data) ? payload.data.data : [];
        // Require exact amount plus an incoming/credit-like type. We intentionally do not
        // auto-fulfil if provider data lacks recognizable fields; admin must verify manually.
        const found = rows.find(row => {
          const amount = Number(row.amount ?? row.nominal ?? row.total_amount ?? row.credit);
          const direction = String(row.type ?? row.direction ?? row.transaction_type ?? row.status ?? '').toLowerCase();
          const ref = String(row.ref_id ?? row.order_id ?? row.reference ?? row.description ?? '');
          const time = Date.parse(row.created_at ?? row.time ?? row.date ?? row.timestamp ?? '');
          const fresh = !Number.isFinite(time) || time >= Date.parse(order.created_at) - 120000;
          return amount === Number(order.pay_amount) && fresh && (/(credit|incoming|masuk|success|settlement|paid|kredit)/.test(direction) || ref.includes(order.order_id));
        });
        if (found) {
          // Do not release stock from this endpoint until provider fields are confirmed by the owner.
          // Status stays pending to prevent false positives from ambiguous mutation formats.
        }
      }
    } catch { /* provider temporarily unavailable; leave order pending */ }
  }
  return json({order_id:order.order_id,product:order.product_name,amount:order.pay_amount,status:order.status,created_at:order.created_at,message:order.status==='paid'?'Pembayaran terverifikasi.':'Menunggu verifikasi pembayaran.'});
}
function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
