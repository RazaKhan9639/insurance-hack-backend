const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  duration: { type: String, required: true },
  level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  category: { type: String, required: true },
  content: { type: String }, // Text content
  requirements: [String],
  whatYouWillLearn: [String],
  image: { type: String }, // URL to course image
  pdfUrl: { type: String }, // URL to PDF file
  videoUrl: { type: String }, // URL to video content
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);