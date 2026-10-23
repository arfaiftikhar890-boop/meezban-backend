
import PDFDocument from 'pdfkit'

export function createReceiptPdf(order, settings = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 45 })
    const chunks = []

    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Restaurant brand
    doc.fontSize(22)
      .font('Helvetica-Bold')
      .text('MEZBAAN', {
        align: 'center'
      })

    doc.fontSize(10)
      .font('Helvetica')
      .text(settings.address || 'Karachi, Pakistan', {
        align: 'center'
      })

    doc.text(`Phone: ${settings.phone || 'N/A'}`, {
      align: 'center'
    })

    doc.moveDown()

    doc.fontSize(18)
      .font('Helvetica-Bold')
      .text('PAYMENT RECEIPT', { align: 'center' })

    doc.moveDown()
    doc.fontSize(11).font('Helvetica')

    doc.text(`Invoice No: ${order.invoiceNo || 'N/A'}`)
    doc.text(`Date: ${new Date(order.createdAt || Date.now()).toLocaleString('en-PK', {
      timeZone: 'Asia/Karachi'
    })}`)
    doc.text(`Customer: ${order.customer?.name || 'N/A'}`)
    doc.text(`Phone: ${order.customer?.phone || 'N/A'}`)
    doc.text(`Order Type: ${order.orderType || 'N/A'}`)
    doc.text(`Payment Method: ${order.payment?.method || 'N/A'}`)
    doc.text(`Payment Status: ${order.payment?.status || 'unpaid'}`)

    doc.moveDown()
    doc.font('Helvetica-Bold').text('Order Items')
    doc.moveDown(0.5)

    for (const item of order.items || []) {
      const qty = item.qty || 0
      const price = item.price || 0

      doc.font('Helvetica').text(
        `${item.name || 'Item'} x ${qty} - Rs. ${price * qty}`
      )
    }

    doc.moveDown()
    doc.text(`Subtotal: Rs. ${order.subtotal || 0}`)
    doc.text(`Discount: Rs. ${order.discount?.amount || 0}`)
    doc.text(`Tax: Rs. ${order.tax || 0}`)
    doc.text(`Delivery: Rs. ${order.deliveryFee || 0}`)

    doc.moveDown()
    doc.font('Helvetica-Bold')
      .fontSize(14)
      .text(`TOTAL: Rs. ${order.total || 0}`)

    doc.moveDown(1)
    doc.font('Helvetica')
      .fontSize(10)
       .fillColor('#155947')
      .text('Powered by EloraTech', {
        align: 'center'
      })

    doc.end()
  })
}
