const fs = require('fs');
const path = require('path');
const { exec, execFile } = require('child_process');
const { findBlenderExecutable } = require('./thumbnailExtractor.cjs');

/**
 * Generates the standardized Blender Python script for rendering
 * an asset in 3/4 isometric perspective (camera pointing downwards)
 * and extracting mesh metadata (faces, verts, dimensions, materials).
 */
function buildRenderScriptContent(outPngPath, metaJsonPath, importFilePath) {
  const safeOutPng = outPngPath.replace(/\\/g, '/');
  const safeMetaJson = metaJsonPath ? metaJsonPath.replace(/\\/g, '/') : '';
  const safeImportPath = importFilePath ? importFilePath.replace(/\\/g, '/') : '';

  return `
import bpy
import sys
import os
import json
import math
from mathutils import Vector

def run():
    import_path = r'${safeImportPath}'
    if import_path:
        ext = os.path.splitext(import_path)[1].lower()
        if ext != '.blend':
            try:
                bpy.ops.wm.read_factory_settings(use_empty=True)
            except Exception:
                pass

            try:
                if ext == '.obj':
                    try:
                        bpy.ops.wm.obj_import(filepath=import_path)
                    except Exception:
                        bpy.ops.import_scene.obj(filepath=import_path)
                elif ext == '.fbx':
                    bpy.ops.import_scene.fbx(filepath=import_path)
                elif ext in ('.gltf', '.glb'):
                    bpy.ops.import_scene.gltf(filepath=import_path)
                elif ext == '.stl':
                    try:
                        bpy.ops.wm.stl_import(filepath=import_path)
                    except Exception:
                        bpy.ops.import_mesh.stl(filepath=import_path)
                elif ext == '.ply':
                    try:
                        bpy.ops.wm.ply_import(filepath=import_path)
                    except Exception:
                        bpy.ops.import_mesh.ply(filepath=import_path)
                elif ext == '.dae':
                    bpy.ops.wm.collada_import(filepath=import_path)
                elif ext == '.abc':
                    bpy.ops.wm.alembic_import(filepath=import_path)
            except Exception as e:
                print("IMPORT_ERROR:", e)

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

    # 4. Standardized studio material rendering settings with EEVEE & 3-point studio lighting
    world = scene.world or bpy.data.worlds.new('AlbaqrosStudioWorld')
    scene.world = world
    try:
        world.use_nodes = True
        bg = world.node_tree.nodes.get('Background')
        if bg:
            bg.inputs['Color'].default_value = (0.9, 0.92, 0.96, 1.0)
            bg.inputs['Strength'].default_value = 0.65
    except Exception:
        pass

    # Hide existing scene lights so they don't overpower or discolor the studio preview
    for obj in list(scene.objects):
        if obj.type == 'LIGHT':
            obj.hide_render = True

    # 3-Point Studio Lights
    # Key light (warm-white Sun from top-right)
    key_light_data = bpy.data.lights.new('AlbaqrosKeyLight', 'SUN')
    key_light_data.energy = 2.4
    key_light_data.color = (1.0, 0.98, 0.95)
    key_light = bpy.data.objects.new('AlbaqrosKeyLight', key_light_data)
    scene.collection.objects.link(key_light)
    key_light.rotation_euler = (math.radians(45), math.radians(15), math.radians(45))

    # Fill light (cool-soft fill from left)
    fill_light_data = bpy.data.lights.new('AlbaqrosFillLight', 'SUN')
    fill_light_data.energy = 1.0
    fill_light_data.color = (0.92, 0.95, 1.0)
    fill_light = bpy.data.objects.new('AlbaqrosFillLight', fill_light_data)
    scene.collection.objects.link(fill_light)
    fill_light.rotation_euler = (math.radians(35), math.radians(-30), math.radians(-60))

    # Rim light (back-light for crisp silhouette & edge definition)
    rim_light_data = bpy.data.lights.new('AlbaqrosRimLight', 'SUN')
    rim_light_data.energy = 1.8
    rim_light_data.color = (1.0, 1.0, 1.0)
    rim_light = bpy.data.objects.new('AlbaqrosRimLight', rim_light_data)
    scene.collection.objects.link(rim_light)
    rim_light.rotation_euler = (math.radians(-60), math.radians(10), math.radians(150))

    # Ensure all materials evaluate properly with shader nodes
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            try:
                mat.use_nodes = True
                bsdf = mat.node_tree.nodes.get('Principled BSDF')
                if bsdf and hasattr(mat, 'diffuse_color'):
                    bsdf.inputs['Base Color'].default_value = mat.diffuse_color
            except Exception:
                pass

    # Ensure meshes without materials have a clean studio neutral material
    default_studio_mat = None
    for obj in mesh_objs:
        if obj.type == 'MESH' and obj.data:
            has_mat = bool(obj.data.materials) and any(m is not None for m in obj.data.materials)
            if not has_mat:
                if not default_studio_mat:
                    default_studio_mat = bpy.data.materials.new('AlbaqrosStudioDefault')
                    default_studio_mat.use_nodes = True
                    bsdf = default_studio_mat.node_tree.nodes.get('Principled BSDF')
                    if bsdf:
                        bsdf.inputs['Base Color'].default_value = (0.75, 0.78, 0.82, 1.0)
                        bsdf.inputs['Roughness'].default_value = 0.4
                if not obj.data.materials:
                    obj.data.materials.append(default_studio_mat)
                else:
                    for idx in range(len(obj.data.materials)):
                        if obj.data.materials[idx] is None:
                            obj.data.materials[idx] = default_studio_mat

    # Remap missing texture image paths if located in same folder or textures/ subfolder
    source_dir = os.path.dirname(r'${safeImportPath || safeOutPng}')
    for img in bpy.data.images:
        try:
            if img.filepath and not os.path.exists(bpy.path.abspath(img.filepath)):
                base = os.path.basename(img.filepath)
                cand = os.path.join(source_dir, base)
                if os.path.exists(cand):
                    img.filepath = cand
                else:
                    cand_tex = os.path.join(source_dir, 'textures', base)
                    if os.path.exists(cand_tex):
                        img.filepath = cand_tex
        except Exception:
            pass

    # Detect available render engines and choose material-capable engine
    available_engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]

    if 'BLENDER_EEVEE' in available_engines:
        scene.render.engine = 'BLENDER_EEVEE'
    elif 'BLENDER_EEVEE_NEXT' in available_engines:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    elif 'CYCLES' in available_engines:
        scene.render.engine = 'CYCLES'
    else:
        scene.render.engine = 'BLENDER_WORKBENCH'
        scene.display.shading.color_type = 'TEXTURE'

    try:
        if hasattr(scene, 'eevee'):
            if hasattr(scene.eevee, 'taa_render_samples'):
                scene.eevee.taa_render_samples = 32
            if hasattr(scene.eevee, 'use_shadows'):
                scene.eevee.use_shadows = True
    except Exception:
        pass

    scene.render.film_transparent = True
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = r'${safeOutPng}'

    # Render with materials, falling back gracefully if necessary
    rendered_ok = False
    try:
        bpy.ops.render.render(write_still=True)
        rendered_ok = True
    except Exception as eevee_e:
        print("Primary render failed, trying fallback:", eevee_e)

    if not rendered_ok:
        try:
            if 'CYCLES' in available_engines:
                scene.render.engine = 'CYCLES'
                scene.cycles.samples = 16
                scene.cycles.use_denoising = True
                bpy.ops.render.render(write_still=True)
                rendered_ok = True
        except Exception as cyc_e:
            print("Cycles fallback failed:", cyc_e)

    if not rendered_ok:
        try:
            scene.render.engine = 'BLENDER_WORKBENCH'
            scene.display.shading.light = 'STUDIO'
            scene.display.shading.color_type = 'TEXTURE'
            bpy.ops.render.render(write_still=True)
            rendered_ok = True
        except Exception as wb_e:
            print("RENDER_ERROR:" + str(wb_e))
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

    const ext = path.extname(absBlendFilePath).toLowerCase();
    const isBlend = ext === '.blend';
    const pyCode = buildRenderScriptContent(finalPngPath, metaJsonPath, absBlendFilePath);
    try {
      fs.writeFileSync(scriptPath, pyCode, 'utf8');
    } catch (err) {
      return resolve({ success: false, error: 'Failed to write render script: ' + err.message });
    }

    const cmd = isBlend
      ? `"${blenderExe}" "${absBlendFilePath}" --factory-startup -b -noaudio -P "${scriptPath}"`
      : `"${blenderExe}" --factory-startup -b -noaudio -P "${scriptPath}"`;

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
