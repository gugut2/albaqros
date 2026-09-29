const fs = require('fs');
const path = require('path');
const { exec, execFile, execSync } = require('child_process');
const {
  extractKritaThumbnail,
  extractPsdThumbnail,
  extractWindowsShellThumbnail,
} = require('./thumbnailExtractor.cjs');

/**
 * Searches common locations for the Krita executable.
 * @returns {string|null}
 */
function findKritaExecutable() {
  const commonPaths = [
    'C:\\Program Files\\Krita (x64)\\bin\\krita.exe',
    'C:\\Program Files\\Krita\\bin\\krita.exe',
    'C:\\Program Files (x86)\\Krita (x64)\\bin\\krita.exe',
    'C:\\Program Files (x86)\\Krita\\bin\\krita.exe',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }

  // AppData local Microsoft Store or custom install
  if (process.env.LOCALAPPDATA) {
    const storePath = path.join(process.env.LOCALAPPDATA, 'Programs', 'Krita', 'bin', 'krita.exe');
    if (fs.existsSync(storePath)) return storePath;
  }

  try {
    const which = execSync('where krita', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (which) {
      const firstLine = which.split('\n')[0].trim();
      if (fs.existsSync(firstLine)) return firstLine;
    }
  } catch (e) {}

  return null;
}

/**
 * Searches common locations for the Adobe Photoshop executable.
 * @returns {string|null}
 */
function findPhotoshopExecutable() {
  const years = ['2026', '2025', '2024', '2023', '2022', '2021', '2020', 'CC 2019', 'CC 2018'];
  for (const y of years) {
    const p = `C:\\Program Files\\Adobe\\Adobe Photoshop ${y}\\Photoshop.exe`;
    if (fs.existsSync(p)) return p;
  }

  const baseDir = 'C:\\Program Files\\Adobe';
  if (fs.existsSync(baseDir)) {
    try {
      const entries = fs.readdirSync(baseDir);
      for (const d of entries) {
        if (d.toLowerCase().includes('photoshop')) {
          const candidate = path.join(baseDir, d, 'Photoshop.exe');
          if (fs.existsSync(candidate)) return candidate;
        }
      }
    } catch (e) {}
  }

  try {
    const which = execSync('where photoshop', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (which) {
      const firstLine = which.split('\n')[0].trim();
      if (fs.existsSync(firstLine)) return firstLine;
    }
  } catch (e) {}

  return null;
}

/**
 * Inspects PSD header (first 26 bytes) to extract true canvas dimensions, channels, bit depth, and color mode.
 * @param {string} filePath 
 * @returns {object|null}
 */
function parsePsdHeader(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(30);
    fs.readSync(fd, buf, 0, 30, 0);
    fs.closeSync(fd);

    if (buf.toString('ascii', 0, 4) !== '8BPS') return null;

    const channels = buf.readUInt16BE(12);
    const height = buf.readUInt32BE(14);
    const width = buf.readUInt32BE(18);
    const bitDepth = buf.readUInt16BE(22);
    const modeNum = buf.readUInt16BE(24);

    const colorModes = ['Bitmap', 'Grayscale', 'Indexed', 'RGB', 'CMYK', '', '', 'Multichannel', 'Duotone', 'Lab'];
    const colorMode = colorModes[modeNum] || 'RGB';

    return {
      width,
      height,
      channels,
      bitDepth,
      colorMode,
      hasAlpha: channels > 3,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Inspects PNG header (IHDR chunk) to extract dimensions and bit depth.
 * @param {string} filePath 
 * @returns {object|null}
 */
function parsePngHeader(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(32);
    fs.readSync(fd, buf, 0, 32, 0);
    fs.closeSync(fd);

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4E || buf[3] !== 0x47) {
      return null;
    }

    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const bitDepth = buf.readUInt8(24);
    const colorType = buf.readUInt8(25);

    const hasAlpha = colorType === 4 || colorType === 6;
    const colorMode = (colorType === 0 || colorType === 4) ? 'Grayscale' : 'RGBA';

    return {
      width,
      height,
      bitDepth,
      colorMode,
      hasAlpha,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Inspects JPEG SOF markers to extract width and height.
 * @param {string} filePath 
 * @returns {object|null}
 */
function parseJpegHeader(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const fd = fs.openSync(filePath, 'r');
    const stats = fs.fstatSync(fd);
    const readSize = Math.min(stats.size, 128 * 1024);
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, 0);
    fs.closeSync(fd);

    if (buf[0] !== 0xFF || buf[1] !== 0xD8) return null;

    let pos = 2;
    while (pos < buf.length - 8) {
      if (buf[pos] !== 0xFF) break;
      const marker = buf[pos + 1];

      // SOF markers: C0 (baseline), C1 (extended sequential), C2 (progressive), C3 (lossless)
      if (
        (marker >= 0xC0 && marker <= 0xC3) ||
        (marker >= 0xC5 && marker <= 0xC7) ||
        (marker >= 0xC9 && marker <= 0xCB) ||
        (marker >= 0xCD && marker <= 0xCF)
      ) {
        const height = buf.readUInt16BE(pos + 5);
        const width = buf.readUInt16BE(pos + 7);
        const channels = buf.readUInt8(pos + 9);
        return {
          width,
          height,
          channels,
          bitDepth: 8,
          colorMode: channels === 1 ? 'Grayscale' : (channels === 4 ? 'CMYK' : 'RGB'),
          hasAlpha: false,
        };
      }

      // Variable length chunk
      const len = buf.readUInt16BE(pos + 2);
      pos += 2 + len;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Reads Krita maindoc.xml inside .kra zip archive to find exact canvas dimensions.
 * @param {string} filePath 
 * @returns {object|null}
 */
function parseKritaXml(filePath) {
  try {
    const zlib = require('zlib');
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);

    // Fast search for maindoc.xml in zip headers
    let pos = 0;
    while (pos + 30 <= buf.length) {
      const sig = buf.readUInt32LE(pos);
      if (sig !== 0x04034b50) break;
      const flags = buf.readUInt16LE(pos + 6);
      const compression = buf.readUInt16LE(pos + 8);
      const compressedSize = buf.readUInt32LE(pos + 18);
      const fileNameLen = buf.readUInt16LE(pos + 26);
      const extraLen = buf.readUInt16LE(pos + 28);
      const fileName = buf.toString('utf8', pos + 30, pos + 30 + fileNameLen).toLowerCase();
      const dataStart = pos + 30 + fileNameLen + extraLen;

      if (fileName === 'maindoc.xml') {
        if ((flags & 0x08) === 0 && compressedSize > 0 && dataStart + compressedSize <= buf.length) {
          const raw = buf.subarray(dataStart, dataStart + compressedSize);
          const xmlStr = (compression === 0 ? raw : zlib.inflateRawSync(raw)).toString('utf8');

          const wMatch = xmlStr.match(/width="(\d+)"/i);
          const hMatch = xmlStr.match(/height="(\d+)"/i);
          const mimeMatch = xmlStr.match(/mime="([^"]+)"/i);
          const xResMatch = xmlStr.match(/x-res="(\d+)"/i);

          if (wMatch && hMatch) {
            const width = parseInt(wMatch[1], 10);
            const height = parseInt(hMatch[1], 10);
            const dpi = xResMatch ? parseInt(xResMatch[1], 10) : 300;
            return {
              width,
              height,
              dpi,
              software: 'krita',
              colorMode: 'RGBA',
              hasAlpha: true,
            };
          }
        }
        break;
      }
      pos = dataStart + compressedSize;
    }
  } catch (e) {}

  return null;
}

/**
 * Calculates human-friendly resolution preset label (e.g. 4K UHD, 1080p, Square, etc.)
 * @param {number} width 
 * @param {number} height 
 * @returns {string}
 */
function getResolutionLabel(width, height) {
  if (!width || !height) return '';
  const maxD = Math.max(width, height);
  const minD = Math.min(width, height);

  if (maxD >= 7680) return '8K UHD';
  if (maxD >= 3840 && minD >= 2160) return '4K UHD';
  if (maxD >= 2560 && minD >= 1440) return '2K QHD';
  if (maxD >= 1920 && minD >= 1080) return '1080p FHD';
  if (width === height) return `Square (${width}px)`;
  if (Math.abs(width / height - 16 / 9) < 0.05) return '16:9 Landscape';
  if (Math.abs(height / width - 16 / 9) < 0.05) return '9:16 Portrait';
  if (Math.abs(width / height - 4 / 3) < 0.05) return '4:3 Standard';
  if (Math.abs(height / width - 4 / 3) < 0.05) return '3:4 Portrait';
  if (width / height > 2.2) return 'Ultrawide Panorama';

  return `${width} × ${height} px`;
}

/**
 * Universal 2D Artwork Metadata Inspector
 * @param {string} filePath 
 * @returns {object}
 */
function inspectArtworkMetadata(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return {};
  const ext = path.extname(filePath).toLowerCase();

  let meta = {
    format: ext.replace('.', ''),
  };

  if (ext === '.psd' || ext === '.psb') {
    const psd = parsePsdHeader(filePath);
    if (psd) meta = { ...meta, ...psd, software: 'photoshop' };
    else meta.software = 'photoshop';
  } else if (ext === '.kra') {
    const kra = parseKritaXml(filePath);
    if (kra) meta = { ...meta, ...kra, software: 'krita' };
    else meta.software = 'krita';
  } else if (ext === '.png') {
    const png = parsePngHeader(filePath);
    if (png) meta = { ...meta, ...png, software: 'image' };
    else meta.software = 'image';
  } else if (ext === '.jpg' || ext === '.jpeg') {
    const jpg = parseJpegHeader(filePath);
    if (jpg) meta = { ...meta, ...jpg, software: 'image' };
    else meta.software = 'image';
  } else if (ext === '.clip') {
    meta.software = 'clipstudio';
  } else if (ext === '.svg') {
    meta.software = 'vector';
  } else {
    meta.software = 'other';
  }

  if (meta.width && meta.height) {
    meta.aspectRatio = Number((meta.width / meta.height).toFixed(3));
    meta.resolutionLabel = getResolutionLabel(meta.width, meta.height);
  }

  return meta;
}

/**
 * Extracts or generates a high-quality preview PNG and saves it directly to previewPngPath.
 * Returns { success: boolean, dataUrl: string, metadata: object, error?: string }
 * @param {string} sourceFilePath 
 * @param {string} previewPngPath 
 * @param {any} nativeImage Electron nativeImage module
 * @returns {Promise<{ success: boolean, dataUrl?: string, metadata?: object, error?: string }>}
 */
async function extractAndSave2DPreview(sourceFilePath, previewPngPath, nativeImage) {
  try {
    if (!sourceFilePath || !fs.existsSync(sourceFilePath)) {
      return { success: false, error: 'Source file does not exist' };
    }

    const ext = path.extname(sourceFilePath).toLowerCase();
    const meta = inspectArtworkMetadata(sourceFilePath);

    // Ensure preview directory exists
    const previewDir = path.dirname(previewPngPath);
    if (!fs.existsSync(previewDir)) {
      fs.mkdirSync(previewDir, { recursive: true });
    }

    let previewBuffer = null;
    let previewDataUrl = null;

    // 1. Krita (.kra)
    if (ext === '.kra') {
      const thumbDataUrl = await extractKritaThumbnail(sourceFilePath);
      if (thumbDataUrl) {
        previewDataUrl = thumbDataUrl;
        const b64 = thumbDataUrl.replace(/^data:image\/\w+;base64,/, '');
        previewBuffer = Buffer.from(b64, 'base64');
      }
    }

    // 2. Photoshop (.psd, .psb)
    if (!previewBuffer && (ext === '.psd' || ext === '.psb')) {
      const psdThumb = extractPsdThumbnail(sourceFilePath);
      if (psdThumb) {
        previewDataUrl = psdThumb;
        const b64 = psdThumb.replace(/^data:image\/\w+;base64,/, '');
        previewBuffer = Buffer.from(b64, 'base64');
      }
    }

    // 3. Standard Images (.png, .jpg, .jpeg, .webp, .bmp, .gif) via Electron nativeImage
    if (!previewBuffer && nativeImage && ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'].includes(ext)) {
      try {
        const img = nativeImage.createFromPath(sourceFilePath);
        if (!img.isEmpty()) {
          const imgSize = img.getSize();
          if (!meta.width || !meta.height) {
            meta.width = imgSize.width;
            meta.height = imgSize.height;
            meta.aspectRatio = Number((imgSize.width / imgSize.height).toFixed(3));
            meta.resolutionLabel = getResolutionLabel(imgSize.width, imgSize.height);
          }

          // If image is huge (e.g. 8K), resize preview to 1800px max edge for snappy UI
          const maxDim = 1800;
          let outImg = img;
          if (imgSize.width > maxDim || imgSize.height > maxDim) {
            const scale = Math.min(maxDim / imgSize.width, maxDim / imgSize.height);
            outImg = img.resize({
              width: Math.round(imgSize.width * scale),
              height: Math.round(imgSize.height * scale),
              quality: 'better',
            });
          }

          previewBuffer = outImg.toPNG();
          previewDataUrl = `data:image/png;base64,${previewBuffer.toString('base64')}`;
        }
      } catch (err) {
        console.error('Error generating preview via nativeImage:', err);
      }
    }

    // 4. SVG vector files
    if (!previewBuffer && ext === '.svg') {
      try {
        const svgBuf = fs.readFileSync(sourceFilePath);
        previewDataUrl = `data:image/svg+xml;base64,${svgBuf.toString('base64')}`;
        previewBuffer = svgBuf;
      } catch (e) {}
    }

    // 5. Windows Shell Thumbnail fallback (.clip, or if above extraction yielded nothing)
    if (!previewBuffer) {
      const shellThumb = await extractWindowsShellThumbnail(sourceFilePath);
      if (shellThumb) {
        previewDataUrl = shellThumb;
        const b64 = shellThumb.replace(/^data:image\/\w+;base64,/, '');
        previewBuffer = Buffer.from(b64, 'base64');
      }
    }

    // Save preview to disk
    if (previewBuffer && previewBuffer.length > 50) {
      fs.writeFileSync(previewPngPath, previewBuffer);

      // If dimensions weren't found from header, parse from the extracted preview
      if (!meta.width || !meta.height) {
        const thumbPng = parsePngHeader(previewPngPath);
        if (thumbPng) {
          meta.width = thumbPng.width;
          meta.height = thumbPng.height;
          meta.aspectRatio = Number((thumbPng.width / thumbPng.height).toFixed(3));
          meta.resolutionLabel = getResolutionLabel(thumbPng.width, thumbPng.height);
        }
      }

      return {
        success: true,
        dataUrl: previewDataUrl || `data:image/png;base64,${previewBuffer.toString('base64')}`,
        metadata: meta,
      };
    }

    return {
      success: false,
      error: 'Could not extract embedded thumbnail or render image preview',
      metadata: meta,
    };
  } catch (err) {
    console.error('extractAndSave2DPreview error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  findKritaExecutable,
  findPhotoshopExecutable,
  inspectArtworkMetadata,
  extractAndSave2DPreview,
  parsePsdHeader,
  parsePngHeader,
  parseJpegHeader,
  parseKritaXml,
  getResolutionLabel,
};
