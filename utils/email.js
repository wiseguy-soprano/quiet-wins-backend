const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Sends a transactional email via Brevo. Never throws — logs and returns
// false on failure so a broken email send never breaks the API request
// that triggered it.
const sendEmail = async ({ to, toName, subject, htmlContent }) => {
  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { email: process.env.BREVO_SENDER_EMAIL, name: 'Quiet Wins' },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Brevo email failed:', response.status, errorBody);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Brevo email error:', err.message);
    return false;
  }
};

module.exports = { sendEmail };
