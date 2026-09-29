const fs = require('fs');
const path = require('path');
const { exec, execFile } = require('child_process');
const { findBlenderExecutable } = require('./thumbnailExtractor.cjs');

/**
 * Generates the standardized Blender Python script for rendering
 * an asset in 3/4 isometric perspective (camera pointing downwards)
 * and extracting mesh metadata (faces, verts, dimensions, materials).
 */
function buildRenderScriptContent(outPngPath, metaJsonPath) {
  const safeOutPng = outPngPath.replace(/\\/g, '/');
  const safeMetaJson = metaJsonPath ? metaJsonPath.replace(/\\/g, '/') : '';

  return `
import bpy
import sys
import os
import json
import math
from mathutils import Vector

def run():
    scene = bpy.context.scene

    # 1. Gather all mesh objects (prefer visible in render)
    mesh_objs = [obj for obj in scene.objects if obj.type == 'MESH' and not obj.hide_render]
    if not mesh_objs:
        mesh_objs = [obj for obj in scene.objects if obj.type == 'MESH']
    if not mesh_objs:
        mesh_objs = [obj for obj in scene.objects if not obj.hide_render]
    if not mesh_objs:
        mesh_objs = list(scene.objects)

    if not mesh_objs:
        print("NO_OBJECTS_FOUND")
        return

    # 2. Compute combined world-space bounding box
    min_co = Vector((float('inf'), float('inf'), float('inf')))
    max_co = Vector((float('-inf'), float('-inf'), float('-inf')))
    total_verts = 0
    total_faces = 0
    materials_set = set()

    for obj in mesh_objs:
        if obj.type == 'MESH' and obj.data:
            total_verts += len(obj.data.vertices)
            total_faces += len(obj.data.polygons)
            for mat in getattr(obj.data, 'materials', []):
                if mat:
                    materials_set.add(mat.name)

        if hasattr(obj, 'bound_box') and obj.bound_box:
            for corner in obj.bound_box:
                w_co = obj.matrix_world @ Vector(corner)
                min_co.x = min(min_co.x, w_co.x)
                min_co.y = min(min_co.y, w_co.y)
                min_co.z = min(min_co.z, w_co.z)
                max_co.x = max(max_co.x, w_co.x)
                max_co.y = max(max_co.y, w_co.y)
                max_co.z = max(max_co.z, w_co.z)

    if math.isinf(min_co.x) or math.isinf(max_co.x):
        min_co = Vector((-1.0, -1.0, -1.0))
        max_co = Vector((1.0, 1.0, 1.0))

    center = (min_co + max_co) / 2.0
    dim = max_co - min_co
    diag = dim.length
    radius = max(diag / 2.0, 0.2)

    # 3. Create standardized 3/4 camera (angled downwards)
    cam_data = bpy.data.cameras.new('AlbaqrosStandardCam')
    cam_data.lens = 50
    cam_obj = bpy.data.objects.new('AlbaqrosStandardCam', cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # 3/4 View Vector: Front-right-top (+X, -Y, +Z)
    # 45 deg azimuth, ~32 deg elevation pointing downwards towards center
    view_dir = Vector((1.0, -1.0, 0.72)).normalized()
    fov = 2 * math.atan((cam_data.sensor_width / 2.0) / cam_data.lens)
    distance = (radius / math.sin(fov / 2.0)) * 1.35

    cam_obj.location = center + view_dir * distance
    look_dir = (center - cam_obj.location).normalized()
    rot_quat = look_dir.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()

    # Prevent near/far clipping plane issues
    cam_data.clip_start = max(0.01, distance - radius * 2.5)
    cam_data.clip_end = distance + radius * 3.5

    # 4. Standardized studio workbench rendering settings
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    try:
        scene.display.shading.show_cavity = True
        scene.display.shading.cavity_type = 'BOTH'
        scene.display.shading.curvature_ridge_factor = 1.2
        scene.display.shading.curvature_valley_factor = 0.8
    except Exception:
        pass

    scene.render.film_transparent = True
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = r'${safeOutPng}'

    try:
        bpy.ops.render.render(write_still=True)
    except Exception as e:
        print("RENDER_ERROR:" + str(e))
        return

    metadata = {
        'vertexCount': total_verts,
        'faceCount': total_faces,
        'objectCount': len(mesh_objs),
        'materialCount': len(materials_set),
        'materials': sorted(list(materials_set)),
        'dimensions': {
            'x': round(dim.x, 3),
            'y': round(dim.y, 3),
            'z': round(dim.z, 3)
        }
    }

    meta_path = r'${safeMetaJson}'
    if meta_path:
        try:
            with open(meta_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2)
        except Exception:
            pass

    print("METADATA_JSON:" + json.dumps(metadata))
    print("RENDER_COMPLETED:" + r'${safeOutPng}')

run()
`;
}

/**
 * Builds a script to assemble multiple assets into a new Blender scene.
 */
function buildSceneAssemblyScriptContent(assetFilePaths, outScenePath) {
  const safeOutScene = outScenePath.replace(/\\/g, '/');
  const safePaths = JSON.stringify(assetFilePaths.map((p) => p.replace(/\\/g, '/')));

  return `
import bpy
import math
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
paths = ${safePaths}

grid_spacing = 3.0
current_x = 0.0

for path in paths:
    col_name = bpy.path.display_name_from_filepath(path)
    new_col = bpy.data.collections.new(col_name)
    bpy.context.scene.collection.children.link(new_col)
    
    with bpy.data.libraries.load(path) as (data_from, data_to):
        data_to.objects = data_from.objects

    imported_objs = []
    for obj in data_to.objects:
        if obj is not None:
            new_col.objects.link(obj)
            imported_objs.append(obj)

    # Offset in grid along X axis
    for obj in imported_objs:
        if obj.parent is None:
            obj.location.x += current_x

    current_x += grid_spacing

bpy.ops.wm.save_as_mainfile(filepath=r'${safeOutScene}')
print("SCENE_SAVED:" + r'${safeOutScene}')
`;
}

/**
 * Renders a standardized 3/4 preview for a .blend file using headless Blender.
 * Returns { success, previewPath, dataUrl, metadata, error }
 */
async function renderBlenderAssetPreview(blendFilePath, outPngPath) {
  return new Promise((resolve) => {
    const absBlendFilePath = path.resolve(blendFilePath);
    if (!fs.existsSync(absBlendFilePath)) {
      return resolve({ success: false, error: 'File does not exist: ' + absBlendFilePath });
    }

    const blenderExe = findBlenderExecutable();
    if (!blenderExe) {
      return resolve({
        success: false,
        error: 'Blender executable not found. Please ensure Blender is installed.',
      });
    }

    const tmpDir = process.env.TEMP || '.';
    const safeBase = `albaqros_preview_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const finalPngPath = path.resolve(outPngPath || path.join(tmpDir, `${safeBase}.png`));
    const metaJsonPath = path.resolve(tmpDir, `${safeBase}_meta.json`);
    const scriptPath = path.resolve(tmpDir, `${safeBase}_script.py`);

    // Ensure output directory exists
    const outDir = path.dirname(finalPngPath);
    if (!fs.existsSync(outDir)) {
      try {
        fs.mkdirSync(outDir, { recursive: true });
      } catch (e) {}
    }

    const pyCode = buildRenderScriptContent(finalPngPath, metaJsonPath);
    try {
      fs.writeFileSync(scriptPath, pyCode, 'utf8');
    } catch (err) {
      return resolve({ success: false, error: 'Failed to write render script: ' + err.message });
    }

    const cmd = `"${blenderExe}" "${absBlendFilePath}" --factory-startup -b -noaudio -P "${scriptPath}"`;

    exec(cmd, { timeout: 35000 }, (error, stdout, stderr) => {
      // Clean up script
      try {
        if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
      } catch (e) {}

      let metadata = null;
      try {
        if (fs.existsSync(metaJsonPath)) {
          metadata = JSON.parse(fs.readFileSync(metaJsonPath, 'utf8'));
          fs.unlinkSync(metaJsonPath);
        } else {
          const match = (stdout || '').match(/METADATA_JSON:(.+)/);
          if (match && match[1]) {
            metadata = JSON.parse(match[1]);
          }
        }
      } catch (e) {}

      if (fs.existsSync(finalPngPath)) {
        try {
          const buf = fs.readFileSync(finalPngPath);
          const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
          return resolve({
            success: true,
            previewPath: finalPngPath,
            dataUrl,
            metadata,
          });
        } catch (readErr) {
          return resolve({ success: false, error: 'Failed to read preview file: ' + readErr.message });
        }
      }

      const errMsg = error ? error.message : stderr || stdout || 'Unknown render failure';
      resolve({ success: false, error: errMsg });
    });
  });
}

/**
 * Creates an assembled scene from multiple asset paths and opens it in Blender.
 */
async function assembleAndOpenScene(assetFilePaths, outScenePath) {
  return new Promise((resolve) => {
    const blenderExe = findBlenderExecutable();
    if (!blenderExe) {
      return resolve({ success: false, error: 'Blender not found' });
    }

    const tmpDir = process.env.TEMP || '.';
    const scriptPath = path.join(tmpDir, `albaqros_assemble_${Date.now()}.py`);
    const pyCode = buildSceneAssemblyScriptContent(assetFilePaths, outScenePath);

    fs.writeFileSync(scriptPath, pyCode, 'utf8');
    const cmd = `"${blenderExe}" --factory-startup -b -noaudio -P "${scriptPath}"`;

    exec(cmd, { timeout: 25000 }, (error) => {
      try {
        if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
      } catch (e) {}

      if (error || !fs.existsSync(outScenePath)) {
        return resolve({ success: false, error: error ? error.message : 'Failed to create scene' });
      }

      // Launch assembled scene in Blender GUI
      exec(`"${blenderExe}" "${outScenePath}"`, () => {});
      resolve({ success: true, scenePath: outScenePath });
    });
  });
}

module.exports = {
  renderBlenderAssetPreview,
  assembleAndOpenScene,
  findBlenderExecutable,
};
