import PDFDocument from 'pdfkit';

function safeText(value, fallback = 'N/A') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatDate(raw) {
  if (!raw) return 'N/A';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw);
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });
}

export class TicketDocumentService {
  static async buildCombinedPdf({ event, registrations }) {
    const docs = Array.isArray(registrations) ? registrations : [];
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks = [];

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      docs.forEach((registration, index) => {
        if (index > 0) doc.addPage();

        const eventTitle = safeText(event?.title, `Event #${safeText(registration?.eventId, 'unknown')}`);
        const venueName = safeText(event?.venue?.name || event?.venueName || event?.ownVenueName, 'Venue TBD');
        const venueAddress = safeText(event?.venue?.address || event?.venueAddress || event?.ownVenueAddress, 'Address TBD');
        const tier = safeText(registration?.tierName || registration?.tierId, 'General');
        const ticketId = safeText(registration?._id || registration?.id, 'N/A');
        const eventDate = formatDate(event?.eventDate || registration?.eventDate);
        const regDate = formatDate(registration?.registeredAt);

        doc.save();
        doc.rect(28, 28, 540, 765).fill('#10243a');
        doc.rect(20, 20, 540, 765).fill('#f8fffe');
        doc.lineWidth(3).strokeColor('#10243a').rect(20, 20, 540, 765).stroke();

        doc.rect(20, 20, 540, 88).fill('#87f5d5');
        doc.lineWidth(3).strokeColor('#10243a').moveTo(20, 108).lineTo(560, 108).stroke();

        doc.fillColor('#10243a').font('Helvetica-Bold').fontSize(26).text('EVENTZEN TICKET', 38, 48);
        doc.fontSize(11).text(`Ticket #${ticketId}`, 410, 52, { align: 'right', width: 130 });
        doc.fontSize(10).text(`Status: ${safeText(registration?.status, 'REGISTERED')}`, 410, 70, { align: 'right', width: 130 });

        doc.roundedRect(38, 128, 220, 30, 4).fill('#2e7de2');
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12).text(safeText(registration?.status, 'REGISTERED'), 48, 138, {
          width: 200,
          align: 'center',
        });

        doc.fillColor('#10243a').font('Helvetica-Bold').fontSize(17).text(eventTitle, 38, 178, { width: 500 });

        doc.fillColor('#10243a').font('Helvetica-Bold').fontSize(10).text('DATE', 38, 230);
        doc.font('Helvetica').fontSize(12).text(eventDate, 38, 244);

        doc.font('Helvetica-Bold').fontSize(10).text('TIER', 210, 230);
        doc.font('Helvetica').fontSize(12).text(tier, 210, 244);

        doc.font('Helvetica-Bold').fontSize(10).text('REGISTERED', 380, 230);
        doc.font('Helvetica').fontSize(12).text(regDate, 380, 244);

        doc.font('Helvetica-Bold').fontSize(10).text('VENUE', 38, 286);
        doc.font('Helvetica').fontSize(12).text(`${venueName}, ${venueAddress}`, 38, 300, { width: 500 });

        doc.roundedRect(125, 352, 320, 320, 8).lineWidth(3).strokeColor('#10243a').stroke();
        if (registration?.qrDataUri) {
          const qrBase64 = String(registration.qrDataUri).split(',')[1] || '';
          const qrBuffer = Buffer.from(qrBase64, 'base64');
          doc.image(qrBuffer, 142, 369, { width: 286, height: 286, fit: [286, 286] });
        } else {
          doc.fillColor('#10243a').font('Helvetica-Bold').fontSize(14).text('QR UNAVAILABLE', 220, 500);
        }

        doc.fillColor('#10243a').font('Helvetica-Bold').fontSize(12).text('Scan this QR at venue check-in', 38, 698);
        doc.font('Helvetica').fontSize(10).text('Keep this ticket and Ticket ID available for manual verification if needed.', 38, 716, {
          width: 500,
        });
        doc.restore();
      });

      doc.end();
    });
  }
}
