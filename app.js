/*
 * Client side logic for the SoftBlush Beauty landing page. This script
 * manages modal visibility, validates form input, posts data to a
 * Google Apps Script Web App, and maintains a local cache of signups.
 *
 * To enable Google Sheets connectivity, deploy the Apps Script provided
 * in the repository as a Web App and set the URL here. See README.md
 * for instructions on deploying the Apps Script.
 */

(function () {
  'use strict';

  // Replace this with your deployed Google Apps Script Web App URL. It must
  // end with "/exec" (not /dev). See softblush-landing/README.md for
  // deployment instructions. Without a valid URL the form will still
  // function and store submissions in localStorage, but data will not be
  // delivered to Google Sheets.
  const GOOGLE_SCRIPT_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';

  // DOM element references
  const modal = document.getElementById('modal');
  const openButtons = [
    document.getElementById('openModal'),
    document.getElementById('openModal2'),
  ].filter(Boolean);
  const closeModalButton = document.getElementById('closeModal');
  const form = document.getElementById('signupForm');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const honeypotInput = document.getElementById('honeypot');
  const errorDiv = document.getElementById('errorMessage');
  const successDiv = document.getElementById('successMessage');

  // Open the modal
  function openModal() {
    modal.classList.remove('hidden');
  }

  // Close the modal and reset messages
  function closeModal() {
    modal.classList.add('hidden');
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    errorDiv.textContent = '';
    successDiv.textContent = '';
    form.reset();
  }

  // Attach event listeners to open buttons
  openButtons.forEach((btn) => btn.addEventListener('click', openModal));
  closeModalButton.addEventListener('click', closeModal);

  // Helper: validate email with a simple regex. Not exhaustive but catches
  // common mistakes. Lowercase is enforced elsewhere.
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Read signups from localStorage. Returns an array of objects with
  // `name` and `email` properties. If nothing is stored yet, returns an
  // empty array.
  function readLocalSignups() {
    try {
      const raw = localStorage.getItem('softblushSignups');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  // Write signups to localStorage.
  function writeLocalSignups(list) {
    try {
      localStorage.setItem('softblushSignups', JSON.stringify(list));
    } catch (e) {
      // Most browsers allow ~5MB in localStorage. If we run into quota
      // limitations, fail silently—the network submission may still work.
    }
  }

  // Handler for form submission
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    // Trim user input
    const name = nameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const honeypot = honeypotInput.value.trim();

    // Reset messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Client‑side validation
    if (!name || !email) {
      errorDiv.textContent = 'Please provide both your name and email.';
      errorDiv.style.display = 'block';
      return;
    }
    if (honeypot) {
      // If the honeypot field has any value treat it as spam
      errorDiv.textContent = 'Invalid submission.';
      errorDiv.style.display = 'block';
      return;
    }
    if (!isValidEmail(email)) {
      errorDiv.textContent = 'Please enter a valid email address.';
      errorDiv.style.display = 'block';
      return;
    }

    // Check for duplicates in localStorage
    const signups = readLocalSignups();
    const alreadySignedUp = signups.some(
      (entry) => entry.email && entry.email.toLowerCase() === email
    );

    // Record signup to localStorage regardless of network status to avoid
    // duplicate submissions if the user reloads the page.
    function recordLocal() {
      if (!alreadySignedUp) {
        signups.push({ name, email });
        writeLocalSignups(signups);
      }
    }

    // If the email is already recorded locally, we still allow the call to
    // the server because the previous submission might have failed; we
    // present the user with a friendly message on duplicates.

    // Build payload for the Apps Script
    const payload = {
      name: name,
      email: email,
      honeypot: honeypot,
      source: 'softblush-landing',
      ts: new Date().toISOString(),
    };

    let serverResponse;
    let serverError;
    if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL.startsWith('http')) {
      try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        // Some Apps Script deployments always return 200 even on errors. Try
        // parsing JSON; if it fails treat as an error.
        try {
          serverResponse = await res.json();
        } catch (parseErr) {
          serverError = 'Unexpected server response.';
        }
      } catch (err) {
        // Network error – we'll rely on localStorage fallback
        serverError = 'Network error';
      }
    } else {
      // No script URL configured
      serverError = 'No server configured';
    }

    if (serverResponse && serverResponse.ok) {
      // Successful submission
      recordLocal();
      successDiv.textContent =
        'Thank you for signing up! We have received your details.';
      successDiv.style.display = 'block';
      return;
    } else if (serverResponse && serverResponse.error) {
      // Server returned an error. Check for duplicate indicator in the
      // message.
      const msg = serverResponse.error.toLowerCase();
      if (msg.includes('duplicate')) {
        recordLocal();
        successDiv.textContent =
          'You are already on our list. We appreciate your enthusiasm!';
        successDiv.style.display = 'block';
        return;
      }
      errorDiv.textContent =
        'There was a problem processing your request: ' +
        serverResponse.error;
      errorDiv.style.display = 'block';
      return;
    } else {
      // If we had a network error or no server configured, treat the local
      // submission as a success but inform the user that their data is
      // saved locally and will be transmitted later.
      recordLocal();
      if (serverError === 'No server configured') {
        successDiv.textContent =
          'Thank you for signing up! Your details have been saved locally. Configure the Google Apps Script URL to enable sheet connectivity.';
      } else {
        successDiv.textContent =
          'Thank you for signing up! We couldn\'t reach the server, but your details have been saved locally.';
      }
      successDiv.style.display = 'block';
      return;
    }
  });
})();