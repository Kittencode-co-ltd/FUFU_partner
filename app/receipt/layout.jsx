export const metadata = {
  title: 'ใบเสร็จรับเงิน',
  robots: { index: false, follow: false },
}

export default function ReceiptLayout({ children }) {
  return <>
    {/* eslint-disable-next-line @next/next/no-css-tags -- print stylesheet is a shared public asset */}
    <link rel="stylesheet" href="/css/receipt.css" precedence="receipt-document" />
    {children}
  </>
}
