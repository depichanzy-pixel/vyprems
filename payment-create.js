/**
 * GoMerch QRIS invoice creation adapter.
 * Required Cloudflare secrets/vars: GOMERCH_API_KEY, GOMERCH_STATIC_QR.
 * NOTE: this endpoint is adapter code; verify response schema with your own API account before live sales.
 */
export async function onRequestPost({request, env}) {
  if (!env.DB) return json({error:'Database D1 belum terhubung.'},500);
  if (!env.GOMERCH_API_KEY || !env.GOMERCH_STATIC_QR) return json({error:'Admin perlu mengatur secret GOMERCH_API_KEY dan GOMERCH_STATIC_QR di Cloudflare.'},503);
  let body; try { body = await request.json(); } catch { return json({error:'JSON tidak valid.'},400); }
  const productId = Number(body.product_id);
  if (!Number.isSafeInteger(productId) || productId < 1) return json({error:'Produk tidak valid.'},400);
  const product = await env.DB.prepare('SELECT id,name,price,active FROM products WHERE id=?').bind(productId).first();
  if (!product || !product.active) return json({error:'Produk tidak tersedia.'},404);
  const stock = await env.DB.prepare("SELECT COUNT(*) AS n FROM stock_items WHERE product_id=? AND status='available'").bind(productId).first();
  if (!stock?.n) return json({error:'Stok produk habis.'},409);
  // Add a small random suffix to help distinguish simultaneous orders with the same product price.
  const suffix = 101 + Math.floor(Math.random()*899);
  const amount = Number(product.price) + suffix;
  const orderId = 'DV-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomUUID().slice(0,8).toUpperCase();
  const url = new URL('/api/qris/create', env.GOMERCH_BASE_URL || 'https://brann-merchant-production.up.railway.app');
  url.searchParams.set('amount',String(amount));
  url.searchParams.set('static_qr',env.GOMERCH_STATIC_QR);
  let result;
  try {
    const res = await fetch(url.toString(), {headers:{'Accept':'application/json','X-API-Key':env.GOMERCH_API_KEY}});
    result = await res.json();
    if (!res.ok) return json({error:'Provider menolak pembuatan QRIS. Periksa konfigurasi/API.'},502);
  } catch { return json({error:'Tidak dapat menghubungi API GoMerch.'},502); }
  const data = result?.data || result;
  const qrString = data?.qr_string || data?.qrString || data?.qr;
  const providerRef = data?.ref_id || data?.transaction_id || data?.id || orderId;
  if (!(result?.status === 'success' || result?.success === true) || !qrString) {
    return json({error:'Respons API belum cocok dengan adapter. Belum ada pesanan disimpan; sesuaikan parser berdasarkan respons API akunmu.'},502);
  }
  try {
    await env.DB.prepare(`INSERT INTO orders (order_id,product_id,product_name,base_price,pay_amount,provider_ref,qr_string,status,created_at) VALUES (?,?,?,?,?,?,?,'pending',?)`)
      .bind(orderId,product.id,product.name,product.price,amount,String(providerRef),String(qrString),new Date().toISOString()).run();
  } catch { return json({error:'Gagal menyimpan pesanan ke database.'},500); }
  return json({ok:true,order_id:orderId,product:product.name,base_price:product.price,pay_amount:amount,qr_string:qrString,status:'pending',note:'Invoice dibuat. Status pembayaran harus diverifikasi dari mutasi provider sebelum stok dibuka.'});
}
function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
