/**
 * Test Email Script - AWS SES with Resend Fallback
 * 
 * Usage: node test-email.js recipient@example.com
 */

const nodemailer = require('nodemailer');
const { Resend } = require('resend');

// AWS SES Configuration
const AWS_SES_CONFIG = {
  host: 'email-smtp.us-east-1.amazonaws.com',
  port: 587,
  secure: false,
  auth: {
    user: 'AKIAYG32AOJUEKZIXYX2',
    pass: 'ZD7oD35UI1DU8z1/IU6QDCJ1GMVAOcHlk7YpYYqF',
  },
};

// Resend Configuration
const RESEND_API_KEY = 're_GjGWcqnE_NJv6R8sxUeeGFLDxcxGUoxUk';

// Email content
const FROM_EMAIL = 'noreply@hankers.tech';
const SUBJECT = '🧪 Test Email - AWS SES with Resend Fallback';
const HTML_CONTENT = `
  <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
      <h1 style="color: #4CAF50;">✅ Email Test Successful!</h1>
      <p>This email was sent using the Hankers email system with fallback support.</p>
      <hr>
      <h2>Test Details:</h2>
      <ul>
        <li><strong>Primary:</strong> AWS SES</li>
        <li><strong>Fallback:</strong> Resend</li>
        <li><strong>From:</strong> ${FROM_EMAIL}</li>
        <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
      </ul>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated test email from Hankers backend.
      </p>
    </body>
  </html>
`;
const TEXT_CONTENT = 'Email Test Successful! This email was sent using AWS SES with Resend fallback.';

/**
 * Send email via AWS SES SMTP
 */
async function sendWithAwsSes(toEmail) {
  console.log('📧 [AWS SES] Attempting to send email...');
  console.log(`📧 [AWS SES] From: ${FROM_EMAIL}`);
  console.log(`📧 [AWS SES] To: ${toEmail}`);

  try {
    const transporter = nodemailer.createTransport({
      ...AWS_SES_CONFIG,
      connectionTimeout: 10000, // 10 seconds timeout
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    // Verify connection first
    console.log('📧 [AWS SES] Verifying SMTP connection...');
    await transporter.verify();
    console.log('📧 [AWS SES] SMTP connection verified!');

    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: toEmail,
      subject: SUBJECT + ' (via AWS SES)',
      html: HTML_CONTENT,
      text: TEXT_CONTENT,
    });

    console.log(`✅ [AWS SES] Email sent successfully!`);
    console.log(`✅ [AWS SES] Message ID: ${info.messageId}`);
    return { success: true, provider: 'AWS SES', messageId: info.messageId };
  } catch (error) {
    console.error(`❌ [AWS SES] Failed to send email:`);
    console.error(`   Error: ${error.message}`);
    if (error.code) console.error(`   Code: ${error.code}`);
    if (error.response) console.error(`   Response: ${error.response}`);
    return null;
  }
}

/**
 * Send email via Resend
 */
async function sendWithResend(toEmail) {
  console.log('📧 [RESEND] Attempting to send email...');
  console.log(`📧 [RESEND] From: ${FROM_EMAIL}`);
  console.log(`📧 [RESEND] To: ${toEmail}`);

  try {
    const resend = new Resend(RESEND_API_KEY);

    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: SUBJECT + ' (via Resend)',
      html: HTML_CONTENT,
      text: TEXT_CONTENT,
    });

    if (response.error) {
      console.error(`❌ [RESEND] Failed to send email:`);
      console.error(`   Error: ${response.error.message}`);
      return null;
    }

    console.log(`✅ [RESEND] Email sent successfully!`);
    console.log(`✅ [RESEND] Message ID: ${response.data?.id}`);
    return { success: true, provider: 'Resend', messageId: response.data?.id };
  } catch (error) {
    console.error(`❌ [RESEND] Failed to send email:`);
    console.error(`   Error: ${error.message}`);
    return null;
  }
}

/**
 * Main function with fallback logic
 */
async function sendEmailWithFallback(toEmail) {
  console.log('\n🚀 Starting email test with fallback logic...\n');
  console.log('━'.repeat(60));

  // Try AWS SES first
  const awsResult = await sendWithAwsSes(toEmail);
  if (awsResult) {
    console.log('\n━'.repeat(60));
    console.log(`\n🎉 SUCCESS! Email sent via ${awsResult.provider}`);
    console.log(`📬 Message ID: ${awsResult.messageId}\n`);
    return awsResult;
  }

  // If AWS SES fails, fallback to Resend
  console.log('\n🔄 AWS SES failed, falling back to Resend...\n');
  console.log('━'.repeat(60));

  const resendResult = await sendWithResend(toEmail);
  if (resendResult) {
    console.log('\n━'.repeat(60));
    console.log(`\n🎉 SUCCESS! Email sent via ${resendResult.provider} (fallback)`);
    console.log(`📬 Message ID: ${resendResult.messageId}\n`);
    return resendResult;
  }

  // Both failed
  console.log('\n━'.repeat(60));
  console.error('\n❌ FAILED! Both AWS SES and Resend failed to send email.\n');
  return null;
}

// Main execution
const recipientEmail = process.argv[2];

if (!recipientEmail) {
  console.error('❌ Error: Please provide a recipient email address');
  console.log('\nUsage: node test-email.js recipient@example.com\n');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(recipientEmail)) {
  console.error('❌ Error: Invalid email address format');
  process.exit(1);
}

// Run the test
sendEmailWithFallback(recipientEmail)
  .then((result) => {
    if (result) {
      console.log('✨ Test completed successfully!');
      process.exit(0);
    } else {
      console.error('💥 Test failed!');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
