const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD
  }
});

const sendWelcomeEmail = async (user) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: 'Welcome to Our Course Platform',
    text: `Hi ${user.firstName},\n\nWelcome to our platform! We're excited to have you on board.\n\nBest regards,\nThe Team`,
    html: `<p>Hi ${user.firstName},</p><p>Welcome to our platform! We're excited to have you on board.</p><p>Best regards,<br>The Team</p>`
  };

  await transporter.sendMail(mailOptions);
};

const sendCourseAccessEmail = async (user, course, pdfBuffer = null) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `🎉 Welcome to ${course.title} - Your Course Access is Ready!`,
    text: `Hi ${user.firstName},

Congratulations! Your purchase of "${course.title}" has been completed successfully.

📚 Course Details:
- Title: ${course.title}
- Duration: ${course.duration || 'Lifetime access'}
- Category: ${course.category || 'General'}
- Price: £${course.price}

🎯 What's included:
- Full course content and materials
- Video lessons and tutorials
- Course certificate upon completion
- Lifetime access to course updates

📖 Course Content:
${course.content || 'Comprehensive course materials and video content'}

🎥 Access Your Course:
You can now access your course through your dashboard at: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard

📧 Need Help?
If you have any questions or need assistance, please don't hesitate to contact our support team.

Happy learning!

Best regards,
The Course Platform Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c3e50; margin-bottom: 10px;">🎉 Welcome to ${course.title}</h1>
          <p style="color: #7f8c8d; font-size: 18px;">Your Course Access is Ready!</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #2c3e50; margin-bottom: 15px;">Hi ${user.firstName},</h2>
          <p style="color: #34495e; line-height: 1.6;">
            Congratulations! Your purchase of <strong>"${course.title}"</strong> has been completed successfully.
          </p>
        </div>
        
        <div style="background-color: #ecf0f1; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #2c3e50; margin-bottom: 15px;">📚 Course Details</h3>
          <ul style="color: #34495e; line-height: 1.6;">
            <li><strong>Title:</strong> ${course.title}</li>
            <li><strong>Duration:</strong> ${course.duration || 'Lifetime access'}</li>
            <li><strong>Category:</strong> ${course.category || 'General'}</li>
            <li><strong>Price:</strong> £${course.price}</li>
          </ul>
        </div>
        
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #2c3e50; margin-bottom: 15px;">🎯 What's included</h3>
          <ul style="color: #34495e; line-height: 1.6;">
            <li>Full course content and materials</li>
            <li>Video lessons and tutorials</li>
            <li>Course certificate upon completion</li>
            <li>Lifetime access to course updates</li>
          </ul>
        </div>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #2c3e50; margin-bottom: 15px;">📖 Course Content</h3>
          <p style="color: #34495e; line-height: 1.6;">
            ${course.content || 'Comprehensive course materials and video content'}
          </p>
        </div>
        
        <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #2c3e50; margin-bottom: 15px;">🎥 Access Your Course</h3>
          <p style="color: #34495e; line-height: 1.6;">
            You can now access your course through your dashboard at: 
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="color: #3498db;">Dashboard</a>
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #2c3e50; margin-bottom: 15px;">📧 Need Help?</h3>
          <p style="color: #34495e; line-height: 1.6;">
            If you have any questions or need assistance, please don't hesitate to contact our support team.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #ecf0f1;">
          <p style="color: #7f8c8d; font-size: 16px;">Happy learning!</p>
          <p style="color: #7f8c8d; font-size: 14px;">
            Best regards,<br>
            The Course Platform Team
          </p>
        </div>
      </div>
    `,
    attachments: pdfBuffer ? [{
      filename: `${course.title}_receipt.pdf`,
      content: pdfBuffer
    }] : []
  };

  await transporter.sendMail(mailOptions);
};

const sendCoursePurchaseEmail = async (user, course, pdfBuffer = null, payment = null) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `🎉 Purchase Confirmed - ${course.title}`,
    text: `Hi ${user.firstName},

Thank you for your purchase! Your payment has been processed successfully.

📋 Purchase Details:
- Course: ${course.title}
- Amount: £${payment?.amount || course.price}
- Transaction ID: ${payment?.transactionId || 'N/A'}
- Date: ${new Date().toLocaleDateString()}

🎯 What happens next:
- You now have immediate access to the course
- Check your dashboard to start learning
- Your receipt is attached to this email

📚 Course Access:
You can access your course through your dashboard at: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard

📧 Need Help?
If you have any questions or need assistance, please don't hesitate to contact our support team.

Happy learning!

Best regards,
The Course Platform Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c3e50; margin-bottom: 10px;">🎉 Purchase Confirmed</h1>
          <p style="color: #7f8c8d; font-size: 18px;">${course.title}</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #2c3e50; margin-bottom: 15px;">Hi ${user.firstName},</h2>
          <p style="color: #34495e; line-height: 1.6;">
            Thank you for your purchase! Your payment has been processed successfully.
          </p>
        </div>
        
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #2c3e50; margin-bottom: 15px;">📋 Purchase Details</h3>
          <ul style="color: #34495e; line-height: 1.6;">
            <li><strong>Course:</strong> ${course.title}</li>
            <li><strong>Amount:</strong> £${payment?.amount || course.price}</li>
            <li><strong>Transaction ID:</strong> ${payment?.transactionId || 'N/A'}</li>
            <li><strong>Date:</strong> ${new Date().toLocaleDateString()}</li>
          </ul>
        </div>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #2c3e50; margin-bottom: 15px;">🎯 What happens next</h3>
          <ul style="color: #34495e; line-height: 1.6;">
            <li>You now have immediate access to the course</li>
            <li>Check your dashboard to start learning</li>
            <li>Your receipt is attached to this email</li>
          </ul>
        </div>
        
        <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #2c3e50; margin-bottom: 15px;">📚 Course Access</h3>
          <p style="color: #34495e; line-height: 1.6;">
            You can access your course through your dashboard at: 
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="color: #3498db;">Dashboard</a>
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #2c3e50; margin-bottom: 15px;">📧 Need Help?</h3>
          <p style="color: #34495e; line-height: 1.6;">
            If you have any questions or need assistance, please don't hesitate to contact our support team.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #ecf0f1;">
          <p style="color: #7f8c8d; font-size: 16px;">Happy learning!</p>
          <p style="color: #7f8c8d; font-size: 14px;">
            Best regards,<br>
            The Course Platform Team
          </p>
        </div>
      </div>
    `,
    attachments: pdfBuffer ? [{
      filename: `${course.title}_purchase_receipt.pdf`,
      content: pdfBuffer
    }] : []
  };

  await transporter.sendMail(mailOptions);
};

module.exports = {
  sendWelcomeEmail,
  sendCourseAccessEmail,
  sendCoursePurchaseEmail
};