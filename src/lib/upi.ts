import QRCode from 'qrcode';

// Builds a standard UPI deep link (upi://pay?...) that any Indian UPI app
// (GPay, PhonePe, Paytm, BHIM...) recognises when scanned, pre-filled with
// the payee, amount and a reference note, then renders it as a QR data URL.
export async function buildUpiQrDataUrl(opts: {
  upiId: string;
  payeeName: string;
  amount: number; // decimal, not cents
  note: string;
}): Promise<string> {
  const params = new URLSearchParams({
    pa: opts.upiId,
    pn: opts.payeeName,
    am: opts.amount.toFixed(2),
    cu: 'INR',
    tn: opts.note
  });
  const uri = `upi://pay?${params.toString()}`;
  return QRCode.toDataURL(uri, { margin: 1, width: 220 });
}
