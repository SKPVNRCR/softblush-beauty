# SoftBlush Beauty Landing Page

This repository contains a simple, responsive landing page for **SoftBlush
Beauty**. The page is built with Tailwind CSS and vanilla JavaScript and
includes a modal form that collects name and email addresses from users
interested in early access. Submissions are sent to a Google Sheet via a
Google Apps Script Web App. A localStorage fallback stores entries
client‑side so you never lose sign‑ups if the network is unavailable.

## Features

- **Aesthetic landing page** with a hero section, product highlights and
  calls to action matching the SoftBlush Beauty brand.
- **Modal sign‑up form** that collects name and email addresses.
- **Hidden honeypot field** to deter bots and reduce spam submissions.
- **Client‑side validation** for required fields and valid email format.
- **Duplicate prevention** on both the server and client. The Apps
  Script checks for existing email addresses before adding a new row,
  while the client stores sign‑ups in `localStorage` to avoid repeat
  submissions.
- **Automatic date formatting** on the server ensures timestamps look
  consistent in the sheet.
- **Confirmation emails** sent via the Apps Script to every new
  registrant.

## Setup

### 1. Create a Google Sheet

1. Create a new Google Sheet in your Google Drive (e.g. `SoftBlush Early
   Access`).
2. In row 1, add headers to the first four columns:
   - **Timestamp** (Column A)
   - **Name** (Column B)
   - **Email** (Column C)
   - **Source** (Column D)

### 2. Add the Apps Script

1. With the sheet open, choose **Extensions › Apps Script**.
2. Delete any placeholder code and paste in the contents of
   [`server.gs`](../server.gs) from this repository (create the file if
   necessary). The script code handles:
   - Parsing JSON submissions.
   - Checking the honeypot field to filter spam.
   - Validating required fields.
   - Preventing duplicate email entries.
   - Appending rows with automatic date formatting.
   - Sending confirmation emails via `MailApp`.
3. Save the project (e.g. `SoftBlush Signup Handler`).

### 3. Deploy as a Web App

1. Click **Deploy › New deployment**.
2. Choose **Web app** as the deployment type.
3. Set **Who has access** to **Anyone** (or **Anyone with the link**).
4. Click **Deploy** and grant any required permissions (you may need to
   authorize the script to send emails and modify your sheet).
5. Copy the **Web App URL** – it will look like `https://script.google.com/macros/s/AKfy.../exec`.

### 4. Configure the client

1. In `softblush-landing/app.js`, replace the placeholder value
   `PASTE_YOUR_GOOGLE_APPS_SCRIPT_URL_HERE` with the Web App URL you
   copied in step 3. **Keep the `/exec` suffix intact**.
2. Open `softblush-landing/index.html` in a web browser. When users
   submit the form their details will be sent to your Google Sheet and
   they will receive a confirmation email.

### 5. Customize

Feel free to customise the page further:

* Replace the copy in `index.html` with your own text and images.
* Adjust the colours and layout via Tailwind classes.
* Add more fields or validations to the form.
* Build a React or Next.js project around this foundation if you prefer
  a component‑based architecture.

## Server Code Reference

For convenience the Apps Script code is included below. Save this as
`Code.gs` (or any `.gs` file) in your Apps Script project.

```javascript
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
```

---

If you have questions or need assistance with customising the landing page
or Apps Script, feel free to open an issue or pull request.