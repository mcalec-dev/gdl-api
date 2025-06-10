const sharp = require('sharp');
sharp.cache(true);

async function resizeImage(imagePath, { width, height, scale }) {
  let resizeOptions = {};
  let metadata;
  try { metadata = await sharp(imagePath, { failOnError: true, useOriginalDate: true }).metadata(); } 
  catch (error) { throw new Error(`Failed to read image metadata: ${error.message}`); }
  if (scale) {
    width = Math.round(metadata.width * (scale / 100));
    height = Math.round(metadata.height * (scale / 100));
    resizeOptions = {
      width, 
      height,
      kernel: scale > 100 ? 'lanczos3' : 'mitchell',
      fastShrink: scale < 100
    };
  } else {
    if (width) resizeOptions.width = width;
    if (height) resizeOptions.height = height;
    const isUpscaling = width > metadata.width || height > metadata.height;
    resizeOptions.kernel = isUpscaling ? 'lanczos3' : 'mitchell';
    resizeOptions.fastShrink = !isUpscaling;
  }

  let mtime;
  try {
    const stat = await require('fs').promises.stat(imagePath);
    mtime = stat.mtime;
  } catch { mtime = new Date(); }

  const transformer = sharp(imagePath, { failOnError: false, useOriginalDate: true })
  .resize(resizeOptions)
  .withMetadata()

  function formatExifDateTime(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
  
    return `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
  }

  // Add common metadata and image processing tags
  const metaIFD0 = {
    // Basic file info
    'Software': 'Gallery-DL API',
    'ProcessingSoftware': 'Sharp',
    'Description': 'Downloaded from api.mcalec.dev',
    'ImageDescription': 'Downloaded from api.mcalec.dev',
    'Copyright': 'All Rights Reserved',

    // Date and time metadata
    'DateTime': formatExifDateTime(mtime),
    'DateTimeOriginal': formatExifDateTime(mtime),
    'DateTimeDigitized': formatExifDateTime(mtime),
    'ModifyDate': formatExifDateTime(new Date()),

    // Other fields
    'Artist': 'Gallery-DL API',
    'XPComment': 'Processed by Gallery-DL API',
    'UserComment': `Processed on ${new Date().toISOString()}`,

    // Technical metadata
    'ColorSpace': 'sRGB',
    'YCbCrPositioning': 'centered'
  };
  const metaExifIFD = {
    // Basic file info
    'Software': 'Gallery-DL API',
    'ProcessingSoftware': 'Sharp',
    'Description': 'Downloaded from api.mcalec.dev',
    'ImageDescription': 'Downloaded from api.mcalec.dev',
    'Copyright': 'All Rights Reserved',

    // Date and time metadata
    'DateTimeOriginal': formatExifDateTime(mtime),
    'DateTimeDigitized': formatExifDateTime(mtime),

    // Other fields
    'Artist': 'Gallery-DL API',
    'XPComment': 'Processed by Gallery-DL API',
    'UserComment': `Processed on ${new Date().toISOString()}`,

    // Technical metadata
    'ColorSpace': 'sRGB',
    'YCbCrPositioning': 'centered'
  };
  transformer.withMetadata({
    exif: {
      IFD0: metaIFD0,
      ExifIFD: metaExifIFD
    }
  });
  return transformer;
}

module.exports = { resizeImage };