/**
 * Google Sheets Early Access endpoint
 *
 * This script accepts JSON posts with name, email, honeypot and source
 * properties. It writes the data to a Google Sheet, ensures the email
 * hasn’t already been recorded, formats the timestamp and sends a
 * confirmation email to the submitter.
 */

const SHEET_NAME = 'Sheet1'; // change to your sheet tab name if needed

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    const name = String(data.name || '').trim();
    const email = String(data.email || '').trim().toLowerCase();
    const honeypot = String(data.honeypot || '').trim();
    const source = String(data.source || 'softblush-landing');
    const ts = new Date();

    // Basic validation
    if (honeypot) {
      return _json({ ok: false, error: 'Spam detected' }, 400);
    }
    if (!name || !email) {
      return _json({ ok: false, error: 'Missing name or email' }, 400);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    const lastRow = sheet.getLastRow();

    // Read existing emails (lowercased) to prevent duplicates
    const emailRange = sheet.getRange(2, 3, Math.max(0, lastRow - 1), 1);
    const existing = emailRange
      .getValues()
      .flat()
      .map((x) => String(x).trim().toLowerCase());
    if (existing.includes(email)) {
      return _json({ ok: false, error: 'Duplicate entry' }, 200);
    }

    // Append new row
    sheet.appendRow([ts, name, email, source]);
    const newRow = sheet.getLastRow();
    // Format timestamp cell
    sheet.getRange(newRow, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');

    // Send confirmation email
    MailApp.sendEmail({
      to: email,
      subject: 'Thank you for joining SoftBlush!',
      htmlBody: `\n        <p>Hi ${name},</p>\n        <p>Thank you for signing up for early access to SoftBlush Beauty.\n        We’ll keep you updated on our launch and send exclusive offers\n        your way.</p>\n        <p>With love,<br>The SoftBlush Team</p>`
    });
    return _json({ ok: true }, 200);
  } catch (err) {
    return _json({ ok: false, error: String(err) }, 500);
  }
}

// OPTIONS handler for CORS preflight. Apps Script doesn’t provide
// fine‑grained control over response headers but we can return a simple
// JSON body that most browsers will accept.
function doOptions() {
  return _json({ ok: true }, 200);
}

// Helper to return JSON. Apps Script’s ContentService doesn’t let
// developers set HTTP status codes for Web Apps, so we include the
// status in the body as well.
function _json(obj, status) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}