"""Export the source models as GLB and render matching transparent fallbacks."""
import hashlib
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from build_models import model_specs


ROOT = Path(__file__).resolve().parent


def unit(v):
    return v / np.linalg.norm(v)


def srgb(paint):
    return np.array([int(paint[s:s+2], 16) for s in (1, 3, 5)]) / 255


def linear(c):
    return np.where(c <= .04045, c / 12.92, ((c+.055)/1.055)**2.4)


class Buffer:
    def __init__(self):
        self.data = bytearray()
        self.views = []
        self.accessors = []

    def add(self, data, component, kind, *, target=None, bounds=False, normalized=False):
        self.data.extend(b'\x00' * (-len(self.data)%4))
        view = {'buffer':0,'byteOffset':len(self.data),'byteLength':data.nbytes}
        if target is not None:
            view['target'] = target
        self.data.extend(data.tobytes())
        accessor = {'bufferView':len(self.views),'componentType':component,'count':len(data),'type':kind}
        if bounds:
            accessor.update(min=np.atleast_1d(data.min(axis=0)).tolist(),max=np.atleast_1d(data.max(axis=0)).tolist())
        if normalized:
            accessor['normalized'] = True
        self.views.append(view)
        self.accessors.append(accessor)
        return len(self.accessors)-1


def write_glb(path, parts, clips):
    b = Buffer()
    meshes, nodes = [], []
    for i, mesh in enumerate(parts):
        positions, normals, colors, indices, known = [], [], [], [], {}
        for triangle, normal, paint in mesh.triangles:
            norm = tuple(np.round(normal,6))
            key_color = tuple(np.round(linear(srgb(paint))*255).astype(int))+(255,)
            for point in triangle:
                vertex = tuple(np.round(point-mesh.pivot,6))
                key = (vertex,norm,key_color)
                if key not in known:
                    known[key] = len(positions)
                    positions.append(vertex)
                    normals.append(norm)
                    colors.append(key_color)
                indices.append(known[key])
        p = b.add(np.array(positions,dtype='<f4'),5126,'VEC3',target=34962,bounds=True)
        n = b.add(np.array(normals,dtype='<f4'),5126,'VEC3',target=34962)
        c = b.add(np.array(colors,dtype='u1'),5121,'VEC4',target=34962,normalized=True)
        ix = b.add(np.array(indices,dtype='<u2'),5123,'SCALAR',target=34963)
        meshes.append({'name':mesh.name,'primitives':[{'attributes':{'POSITION':p,'NORMAL':n,'COLOR_0':c},'indices':ix,'material':0}]})
        nodes.append({'name':mesh.name,'mesh':i,'translation':list(mesh.pivot)})
    animations = []
    for name, channels in clips.items():
        samplers, targets = [], []
        for node, time, values in channels:
            start = b.add(np.array(time,dtype='<f4'),5126,'SCALAR',bounds=True)
            rotations = b.add(np.array(values,dtype='<f4'),5126,'VEC4')
            targets.append({'sampler':len(samplers),'target':{'node':node,'path':'rotation'}})
            samplers.append({'input':start,'output':rotations,'interpolation':'LINEAR'})
        animations.append({'name':name,'samplers':samplers,'channels':targets})
    b.data.extend(b'\x00' * (-len(b.data)%4))
    data = {'asset':{'version':'2.0','generator':'Hangul Defense village art exporter'},'scene':0,
            'scenes':[{'nodes':list(range(len(nodes)))}], 'nodes':nodes,'meshes':meshes,
            'materials':[{'name':'Matte paint','pbrMetallicRoughness':{'metallicFactor':0,'roughnessFactor':.88}}],
            'buffers':[{'byteLength':len(b.data)}], 'bufferViews':b.views, 'accessors':b.accessors}
    if animations:
        data['animations'] = animations
    raw = json.dumps(data,separators=(',',':')).encode()
    raw += b' ' * (-len(raw)%4)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(raw)+len(b.data))+
                     struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(b.data),b'BIN\x00')+b.data)


def render(parts, path, direction):
    size = 768
    camera = unit(np.array(direction, dtype=float))
    right = unit(np.cross([0,1,0], camera))
    up = np.cross(camera,right)
    transform = np.array([right,-up,camera]).T
    sun = unit(np.array([-.48,.88,.54]))
    projected = [(points @ transform, normal, paint) for part in parts for points,normal,paint in part.triangles]
    all_points = np.concatenate([t for t, _, _ in projected])
    low, high = all_points.min(axis=0), all_points.max(axis=0)
    scale = (size * .88) / max(high[:2]-low[:2])
    center = (high[:2]+low[:2])/2
    img = np.zeros((size,size,4),dtype=np.uint8)
    depth = np.full((size,size), -np.inf)
    for points, normal, paint in projected:
        if np.dot(camera, normal) <= 0:
            continue
        xy = (points[:,:2] - center)*scale + size/2
        x0,y0 = np.maximum(0,np.floor(xy.min(axis=0)).astype(int))
        x1,y1 = np.minimum(size,np.ceil(xy.max(axis=0)).astype(int)+1)
        x,y = np.meshgrid(np.arange(x0,x1)+.5,np.arange(y0,y1)+.5)
        a,b,c = xy
        ab,ac = b-a,c-a
        det = ab[0]*ac[1]-ab[1]*ac[0]
        if abs(det)<1e-8:
            continue
        u = ((x-a[0])*ac[1]-(y-a[1])*ac[0])/det
        v = (ab[0]*(y-a[1])-ab[1]*(x-a[0]))/det
        z = (1-u-v)*points[0,2]+u*points[1,2]+v*points[2,2]
        region = depth[y0:y1,x0:x1]
        inside = (u>=-1e-9)&(v>=-1e-9)&(u+v<=1+1e-9)&(z>region)
        region[inside]=z[inside]
        lighting = .69+.37*max(0, np.dot(normal,sun))+.06*max(0,normal[1])
        rgb = np.clip(srgb(paint)*lighting*[1.02,1.01,.97]*255,0,255)
        img[y0:y1,x0:x1][inside] = [*rgb.astype(int),255]
    output = Image.fromarray(img).resize((384,384), Image.Resampling.LANCZOS)
    output.save(path,optimize=True)
    bbox = output.getchannel('A').getbbox()
    assert bbox and bbox[0] > 0 and bbox[1] > 0 and bbox[2] < 384 and bbox[3] < 384
    anchor_3d = (0,0,0) @ transform
    anchor = (anchor_3d[:2]-center)*scale/2+192
    return [round(float(v),1) for v in anchor], bbox


def sheet(names):
    width,height = 1080,1143
    board = Image.new('RGB',(width,height),'#e9eadc')
    draw = ImageDraw.Draw(board)
    fonts = Path('C:/Windows/Fonts')
    title = ImageFont.truetype(str(fonts/'segoeuib.ttf'),38)
    small = ImageFont.truetype(str(fonts/'segoeui.ttf'),21)
    label = ImageFont.truetype(str(fonts/'segoeuib.ttf'),25)
    draw.text((35,25),'Hangul Defense',font=title,fill='#283e38')
    draw.text((36,78),'Watermill village and castle  /  0.15–0.16',font=small,fill='#54675a')
    for i, name in enumerate(names):
        x,y = 30+i%3*344,124+i//3*331
        draw.rounded_rectangle((x,y,x+332,y+314),radius=20,fill='#f6f4e9',outline='#dbdccb',width=2)
        sprite = Image.open(ROOT/'png'/f'{name}.png').resize((259,259),Image.Resampling.LANCZOS)
        board.paste(sprite,(x+36,y+4),sprite)
        draw.text((x+166,y+281),name.replace('-',' ').title(),font=label,fill='#34483f',anchor='mm')
    board.save(ROOT/'preview.png',optimize=True)


def main():
    (ROOT/'glb').mkdir(exist_ok=True)
    (ROOT/'png').mkdir(exist_ok=True)
    records = []
    # The village camera is fixed at this front-left direction.
    for name, parts, clips in model_specs():
        glb = ROOT/'glb'/f'{name}.glb'
        png = ROOT/'png'/f'{name}.png'
        write_glb(glb,parts,clips)
        camera = (-17,10,12) if name == 'waterwheel' else (-9,14,16)
        anchor,bbox = render(parts,png,camera)
        totals = sum(len(p.triangles) for p in parts)
        points = np.concatenate([points for p in parts for points,*_ in p.triangles])
        assert totals <= 3500, (name,totals)
        records.append({'asset':name, 'glb':glb.relative_to(ROOT).as_posix(),
                        'png':png.relative_to(ROOT).as_posix(), 'triangles':totals,'draw_calls':len(parts),
                        'world_bounds_min':points.min(axis=0).round(3).tolist(),
                        'world_bounds_max':points.max(axis=0).round(3).tolist(),
                        'png_origin_xy':anchor,'png_alpha_bbox_xyxy':bbox,'png_size':[384,384],
                        'nodes':{p.name:list(p.pivot) for p in parts},'animations':{key:value[0][1][-1] for key,value in clips.items()},
                        'sha256':{p.suffix[1:]:hashlib.sha256(p.read_bytes()).hexdigest() for p in (glb,png)},
                        'bytes':{p.suffix[1:]:p.stat().st_size for p in (glb,png)}})
    (ROOT/'manifest.json').write_text(json.dumps(records,indent=2)+'\n',encoding='utf-8',newline='\n')
    sheet([r['asset'] for r in records])
    for r in records:
        print(r['asset'],r['triangles'],r['draw_calls'],r['bytes'])


if __name__ == '__main__':
    main()
