const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const yauzl = require('yauzl');

/**
 * Extracts embedded preview or merged image from a Krita (.kra) file.
 * Krita files are zip archives containing 'preview.png' and/or 'mergedimage.png'.
 * @param {string} filePath 
 * @returns {Promise<string|null>} base64 data URL
 */
function extractKritaThumbnail(filePath) {
  return new Promise((resolve) => {
    try {
      if (!fs.existsSync(filePath)) return resolve(null);

      yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) return resolve(null);

        let resolved = false;

        const streamTarget = (entry) => {
          resolved = true;
          zipfile.openReadStream(entry, (streamErr, stream) => {
            if (streamErr || !stream) return resolve(null);

            const chunks = [];
            stream.on('data', (c) => chunks.push(c));
            stream.on('end', () => {
              const buf = Buffer.concat(chunks);
              if (buf.length > 20) {
                resolve(`data:image/png;base64,${buf.toString('base64')}`);
              } else {
                resolve(null);
              }
            });
            stream.on('error', () => resolve(null));
          });
        };

        zipfile.readEntry();
        zipfile.on('entry', (entry) => {
          const lower = entry.fileName.toLowerCase();
          if (lower.endsWith('preview.png') || lower.endsWith('mergedimage.png')) {
            streamTarget(entry);
          } else {
            zipfile.readEntry();
          }
        });

        zipfile.on('end', () => {
          if (!resolved) resolve(null);
        });

        zipfile.on('error', () => {
          if (!resolved) resolve(null);
        });
      });
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Extracts embedded JPEG thumbnail from a Photoshop (.psd) file.
 * Photoshop files contain 8BIM Image Resources with ID 1036 (Photoshop 5.0 thumbnail)
 * or 1033 (Photoshop 4.0 thumbnail).
 * @param {string} filePath 
 * @returns {string|null} base64 data URL
 */
function extractPsdThumbnail(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;

    const fd = fs.openSync(filePath, 'r');
    const stats = fs.fstatSync(fd);
    // Read up to 12MB of header & resource blocks
    const readSize = Math.min(stats.size, 12 * 1024 * 1024);
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, 0);
    fs.closeSync(fd);

    if (buf.length < 30 || buf.toString('ascii', 0, 4) !== '8BPS') {
      return null;
    }

    const colorModeLen = buf.readUInt32BE(26);
    let pos = 26 + 4 + colorModeLen;
    if (pos + 4 > buf.length) return null;

    const imgResLen = buf.readUInt32BE(pos);
    pos += 4;
    const endRes = Math.min(pos + imgResLen, buf.length);

    while (pos + 12 <= endRes) {
      const sig = buf.toString('ascii', pos, pos + 4);
      if (sig !== '8BIM' && sig !== 'MeSa') break;
      pos += 4;

      const resId = buf.readUInt16BE(pos);
      pos += 2;

      // Pascal string: length byte, then chars, padded to even length
      const nameLen = buf.readUInt8(pos);
      pos += 1;
      const totalPascal = (nameLen + 1 + 1) & ~1;
      pos += totalPascal - 1;

      if (pos + 4 > endRes) break;
      const dataSize = buf.readUInt32BE(pos);
      pos += 4;

      if (resId === 1033 || resId === 1036) {
        // Thumbnail resource: 28-byte header, then raw JFIF/JPEG stream
        if (dataSize > 28) {
          const jpegStart = pos + 28;
          const jpegBuf = buf.subarray(jpegStart, pos + dataSize);
          if (jpegBuf.length > 4 && jpegBuf[0] === 0xFF && jpegBuf[1] === 0xD8) {
            return `data:image/jpeg;base64,${jpegBuf.toString('base64')}`;
          }
        }
      }

      pos += dataSize + (dataSize % 2 === 1 ? 1 : 0);
    }

    // Fallback: Scan image resources area for JPEG SOI marker (0xFF, 0xD8, 0xFF)
    const scanArea = buf.subarray(26 + 4 + colorModeLen, endRes);
    const soiIdx = scanArea.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]));
    if (soiIdx !== -1) {
      const eoiIdx = scanArea.indexOf(Buffer.from([0xFF, 0xD9]), soiIdx);
      if (eoiIdx !== -1 && eoiIdx - soiIdx > 200) {
        const jpegBuf = scanArea.subarray(soiIdx, eoiIdx + 2);
        return `data:image/jpeg;base64,${jpegBuf.toString('base64')}`;
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Searches common locations for the Blender executable.
 * @returns {string|null}
 */
function findBlenderExecutable() {
  const commonVersions = ['5.2', '5.1', '5.0', '4.4', '4.3', '4.2', '4.1', '4.0', '3.6', '3.5', '3.4', '3.3'];
  for (const v of commonVersions) {
    const p = `C:\\Program Files\\Blender Foundation\\Blender ${v}\\blender.exe`;
    if (fs.existsSync(p)) return p;
  }

  const baseDir = 'C:\\Program Files\\Blender Foundation';
  if (fs.existsSync(baseDir)) {
    try {
      const entries = fs.readdirSync(baseDir);
      for (const d of entries.reverse()) {
        const candidate = path.join(baseDir, d, 'blender.exe');
        if (fs.existsSync(candidate)) return candidate;
      }
    } catch (e) {}
  }

  try {
    const which = execSync('where blender', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (which) {
      const firstLine = which.split('\n')[0].trim();
      if (fs.existsSync(firstLine)) return firstLine;
    }
  } catch (e) {}

  return null;
}

/**
 * Extracts a high-quality screenshot from a Blender (.blend) file using the Blender CLI
 * in headless background mode with the fast Workbench render engine (~1 second).
 * @param {string} filePath 
 * @returns {Promise<string|null>} base64 data URL
 */
function extractBlenderThumbnail(filePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) return resolve(null);

    const blenderExe = findBlenderExecutable();
    if (!blenderExe) return resolve(null);

    const tmpOut = path.join(
      process.env.TEMP || '.',
      `albaqros_blend_${Date.now()}_${Math.random().toString(36).slice(2)}.png`
    );
    const tmpPy = path.join(
      process.env.TEMP || '.',
      `albaqros_blend_script_${Date.now()}_${Math.random().toString(36).slice(2)}.py`
    );

    const pyScript = `import bpy
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 800
scene.render.resolution_y = 600
scene.render.resolution_percentage = 100
scene.render.filepath = r'${tmpOut.replace(/\\/g, '/')}'
scene.render.image_settings.file_format = 'PNG'
if not scene.camera:
    cam_data = bpy.data.cameras.new('AlbaqrosThumbCam')
    cam_obj = bpy.data.objects.new('AlbaqrosThumbCam', cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    cam_obj.location = (7.0, -7.0, 5.0)
    cam_obj.rotation_euler = (1.1, 0, 0.785)
try:
    bpy.ops.render.render(write_still=True)
except Exception:
    pass
`;

    try {
      fs.writeFileSync(tmpPy, pyScript, 'utf8');
    } catch (writeErr) {
      return resolve(null);
    }

    const cmd = `"${blenderExe}" -b "${filePath}" -noaudio -P "${tmpPy}"`;

    exec(cmd, { timeout: 25000 }, () => {
      try {
        if (fs.existsSync(tmpPy)) fs.unlinkSync(tmpPy);
      } catch (e) {}

      try {
        if (fs.existsSync(tmpOut)) {
          const buf = fs.readFileSync(tmpOut);
          try { fs.unlinkSync(tmpOut); } catch (u) {}
          if (buf.length > 50) {
            return resolve(`data:image/png;base64,${buf.toString('base64')}`);
          }
        }
      } catch (cleanErr) {}
      resolve(null);
    });
  });
}

/**
 * Windows Shell Thumbnail fallback via IShellItemImageFactory.
 * Can extract registered thumbnails for Clip Studio Paint (.clip), Photoshop (.psd),
 * Blender (.blend), etc. from Windows Explorer's shell thumbnail cache.
 * @param {string} filePath 
 * @returns {Promise<string|null>}
 */
function extractWindowsShellThumbnail(filePath) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' || !fs.existsSync(filePath)) {
      return resolve(null);
    }

    const tmpOut = path.join(
      process.env.TEMP || '.',
      `albaqros_shell_${Date.now()}_${Math.random().toString(36).slice(2)}.png`
    );

    const psScript = `
$code = @"
using System;
using System.Drawing;
using System.Runtime.InteropServices;
public class ShellThumbnail {
    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    public static extern void SHCreateItemFromParsingName([MarshalAs(UnmanagedType.LPWStr)] string pszPath, IntPtr pbc, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, out IShellItemImageFactory ppv);
    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);
    [ComImport]
    [Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IShellItemImageFactory {
        [PreserveSig]
        int GetImage([In, MarshalAs(UnmanagedType.Struct)] SIZE size, [In] int flags, out IntPtr phbm);
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct SIZE {
        public int cx; public int cy;
        public SIZE(int cx, int cy) { this.cx = cx; this.cy = cy; }
    }
    public static Bitmap GetThumbnail(string path, int width, int height) {
        Guid guid = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
        IShellItemImageFactory factory;
        SHCreateItemFromParsingName(path, IntPtr.Zero, guid, out factory);
        if (factory == null) return null;
        IntPtr hBitmap;
        int hr = factory.GetImage(new SIZE(width, height), 0x02, out hBitmap);
        if (hr != 0 || hBitmap == IntPtr.Zero) return null;
        try {
            Bitmap bmp = Image.FromHbitmap(hBitmap);
            return (Bitmap)bmp.Clone();
        } finally {
            DeleteObject(hBitmap);
        }
    }
}
"@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
$bmp = [ShellThumbnail]::GetThumbnail('${filePath.replace(/'/g, "''")}', 512, 512)
if ($bmp -ne $null) {
    $bmp.Save('${tmpOut.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}
`;

    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { timeout: 10000 }, () => {
      try {
        if (fs.existsSync(tmpOut)) {
          const buf = fs.readFileSync(tmpOut);
          try { fs.unlinkSync(tmpOut); } catch (e) {}
          if (buf.length > 500) {
            return resolve(`data:image/png;base64,${buf.toString('base64')}`);
          }
        }
      } catch (e) {}
      resolve(null);
    });
  });
}

/**
 * Universal thumbnail extractor for creative application files.
 * Supports:
 * - Krita (.kra)
 * - Photoshop (.psd)
 * - Blender (.blend)
 * - Other files with Windows Shell thumbnail extensions (.clip, etc.)
 * 
 * @param {string} filePath 
 * @returns {Promise<{ dataUrl: string, source: string }|null>}
 */
async function extractThumbnail(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;

  const ext = path.extname(filePath).toLowerCase();

  // 1. Krita (.kra)
  if (ext === '.kra') {
    const kraThumb = await extractKritaThumbnail(filePath);
    if (kraThumb) return { dataUrl: kraThumb, source: 'krita' };
    const shellThumb = await extractWindowsShellThumbnail(filePath);
    if (shellThumb) return { dataUrl: shellThumb, source: 'shell' };
    return null;
  }

  // 2. Photoshop (.psd)
  if (ext === '.psd') {
    const psdThumb = extractPsdThumbnail(filePath);
    if (psdThumb) return { dataUrl: psdThumb, source: 'photoshop' };
    const shellThumb = await extractWindowsShellThumbnail(filePath);
    if (shellThumb) return { dataUrl: shellThumb, source: 'shell' };
    return null;
  }

  // 3. Blender (.blend)
  if (ext === '.blend') {
    // First try Blender headless workbench render (produces beautiful high-res render)
    const blendThumb = await extractBlenderThumbnail(filePath);
    if (blendThumb) return { dataUrl: blendThumb, source: 'blender' };
    // Fallback to Windows shell thumbnail
    const shellThumb = await extractWindowsShellThumbnail(filePath);
    if (shellThumb) return { dataUrl: shellThumb, source: 'shell' };
    return null;
  }

  // 4. Other formats (.clip, .ai, etc.)
  const shellThumb = await extractWindowsShellThumbnail(filePath);
  if (shellThumb) return { dataUrl: shellThumb, source: 'shell' };

  return null;
}

module.exports = {
  extractThumbnail,
  extractKritaThumbnail,
  extractPsdThumbnail,
  extractBlenderThumbnail,
  extractWindowsShellThumbnail,
  findBlenderExecutable,
};
