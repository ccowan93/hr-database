import Tesseract from 'tesseract.js';

export async function extractText(filePath: string): Promise<string> {
  // Only OCR image files (png, jpg, jpeg, tiff, bmp, gif)
  const ext = filePath.toLowerCase().split('.').pop();
  const imageExts = ['png', 'jpg', 'jpeg', 'tiff', 'bmp', 'gif'];
  if (!ext || !imageExts.includes(ext)) {
    return ''; // Not an image, skip OCR
  }

  const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
  return text.trim();
}
