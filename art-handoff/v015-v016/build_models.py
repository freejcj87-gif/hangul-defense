"""Original low-poly village artwork. Coordinates follow glTF (Y up)."""
from dataclasses import dataclass, field
from math import atan2, cos, pi, sin, sqrt

import numpy as np


STONE = ('#9b9d86', '#afb098', '#8f957f', '#a3a68f', '#b9b59c')
ROOF = ('#438e87', '#55a19a', '#64aba1', '#3c7973')
CLAY = ('#ce7750', '#df875c', '#eb9c6c', '#b86948')
OAK = '#91613e'
DARK = '#503e32'
EDGE = '#d4c6a2'
GOLD = '#eab759'


@dataclass
class Mesh:
    name: str
    pivot: tuple = (0, 0, 0)
    triangles: list = field(default_factory=list)

    def face(self, vertices, paint, inside=None):
        points = np.array(vertices, dtype=float)
        normal = np.cross(points[1] - points[0], points[2] - points[0])
        length = np.linalg.norm(normal)
        if length < 1e-9:
            return
        if inside is not None and np.dot(normal, points.mean(axis=0) - inside) < 0:
            points = points[::-1]
            normal = -normal
        for i in range(1, len(points) - 1):
            self.triangles.append((points[[0, i, i + 1]], normal / length, paint))

    def rings(self, rings, colors, cap=True):
        count = len(rings[0])
        inside = np.mean(rings, axis=(0, 1))
        if cap:
            self.face(rings[0], colors[0], inside)
            self.face(rings[-1], colors[0], inside)
        for level, (low, high) in enumerate(zip(rings, rings[1:])):
            for i in range(count):
                j = (i + 1) % count
                self.face([low[i], low[j], high[j], high[i]], colors[(level + i) % len(colors)], inside)

    def prism(self, profile, y, height, colors):
        self.rings([[(x, h, z) for x, z in profile] for h in (y, y + height)], colors)

    def block(self, center, size, paint, bevel=.035, yaw=0):
        x, y, z = center
        w, h, d = np.array(size) / 2
        b = min(w * .5, h * .5, d * .5, bevel)
        outline = [(-w+b, -d), (w-b, -d), (w, -d+b), (w, d-b),
                   (w-b, d), (-w+b, d), (-w, d-b), (-w, -d+b)]
        rings = []
        profile = ((-h, 0), (h, 0)) if bevel < .042 else ((-h, b), (-h+b, 0), (h-b, 0), (h, b))
        for level, inset in profile:
            ring = []
            for u, v in outline:
                u, v = u * (1-inset/w), v * (1-inset/d)
                ring.append((x+u*cos(yaw)+v*sin(yaw), y+level, z-u*sin(yaw)+v*cos(yaw)))
            rings.append(ring)
        self.rings(rings, (paint,))

    def round(self, start, end, r1, r2, colors, sides=10, oval=1):
        start, end = np.array(start, dtype=float), np.array(end, dtype=float)
        axis = end - start
        axis /= np.linalg.norm(axis)
        reference = (0, 0, 1) if abs(axis[2]) < .9 else (0, 1, 0)
        right = np.cross(axis, reference)
        right /= np.linalg.norm(right)
        up = np.cross(axis, right)
        self.rings([[p + r * (right*cos(i*2*pi/sides) + up*sin(i*2*pi/sides)*oval)
                     for i in range(sides)] for p, r in ((start, r1), (end, r2))], colors)

    def gem(self, center, size, paints, sides=8):
        x, y, z = center
        w, h, d = size
        rings = []
        for ry, r in ((-1, .03), (-.64, .71), (0, 1), (.64, .71), (1, .03)):
            rings.append([(x+w*r*cos(i*2*pi/sides), y+ry*h, z+d*r*sin(i*2*pi/sides)) for i in range(sides)])
        self.rings(rings, paints)


def slab(m, x, z, w, d, y=.08):
    m.block((x, y, z), (w, y*2, d), STONE[2], .07)


def facade(m, width, depth, height, *, stone=False, z=0):
    colors = STONE if stone else ('#ead2a2', '#efddb6', '#d4ae77')
    m.block((0, height/2+.10, z), (width, height, depth), colors[0], .10)
    for ix, sign in enumerate((-1, 1)):
        for i in range(4):
            y = .25 + i * (height-.14)/4
            m.block((sign*(width/2-.10), y, z+depth/2), (.25, .19, .14), colors[(i+ix+1)%len(colors)])
            m.block((sign*width/2, y, z-depth/2+.12), (.14, .19, .25), colors[(i+ix)%len(colors)])
    for y in (.17, height+.07):
        m.block((0, y, z), (width+.12, .13, depth+.11), EDGE if stone else OAK, .035)


def window(m, x, y, z, size=.35, yaw=0):
    m.block((x, y, z), (size+.12, size+.17, .12), OAK, .025, yaw)
    dx, dz = .062*sin(yaw), .062*cos(yaw)
    m.block((x+dx, y, z+dz), (size, size+.05, .065), '#315558', .020, yaw)
    m.block((x+dx*1.7, y, z+dz*1.7), (.044, size+.02, .04), EDGE, .012, yaw)
    m.block((x+dx, y-(size+.10)*.68, z+dz), (size+.22, .07, .17), EDGE, .014, yaw)


def door(m, y, z, width=.55, height=.77):
    m.block((0, y+height/2, z), (width+.16, height+.11, .15), DARK, .05)
    for i in range(4):
        m.block(((i-1.5)*width/4, y+height/2, z+.09), (width/4-.011, height, .07), ('#926039','#ad7649')[i%2], .019)
    for level in (.26,.73):
        m.block((0, y+height*level, z+.14), (width+.03,.064,.06), '#6a4835', .013)
    m.gem((width*.29, y+height*.50, z+.18), (.042,.042,.025), (GOLD,), 6)


def roof(m, width, depth, eave, rise, colors=CLAY, offset=0):
    w, d = width/2, depth/2
    profile = [(-w,eave,offset), (0,eave+rise,offset), (w,eave,offset)]
    m.rings([[(x,y,z+dz) for x,y,dz in profile] for z in (-d,d)], (colors[3],))
    for side in (-1,1):
        for row in range(4):
            x0 = side*w*row/4
            x1 = side*w*(row+1)/4
            y0, y1 = eave+rise*(1-row/4)+.035, eave+rise*(1-(row+1)/4)+.035
            step = depth/5
            for col in range(5):
                z0 = -d+col*step+offset+.012
                z1 = z0+step-.021
                m.face([(x0,y0,z0),(x0,y0,z1),(x1,y1,z1),(x1,y1,z0)], colors[(row*3+col*5+int(side>0))%len(colors)], (0,eave-.12,offset))
                m.face([(x1,y1,z0),(x1,y1,z1),(x1,y1-.041,z1),(x1,y1-.041,z0)], colors[3], (0,eave-.10,offset))
        m.block((side*w, eave-.025,offset),( .085,.105,depth+.04), DARK,.017)
    m.round((0,eave+rise+.03,offset-d-.035),(0,eave+rise+.03,offset+d+.035),.080,.080,(colors[1],colors[2]),8)


def turret(m, x, z, radius, height, tall_roof=True):
    sides = 8 if tall_roof else 10
    m.round((x,.02,z),(x,height,z),radius*1.08,radius,STONE,sides)
    for y, mult, color in ((.16,1.14,STONE[2]),(height-.20,1.03,STONE[0]),(height-.06,1.12,EDGE)):
        m.round((x,y,z),(x,y+.11,z),radius*mult,radius*mult,(color,),sides)
    angles = (-pi/2, 0, pi/2)
    if tall_roof:
        angles = ((-pi/2 if x < 0 else 0),) if z > 0 else ()
    for yaw in angles:
        window(m,x+radius*sin(yaw),height*.61,z+radius*cos(yaw),radius*.42,yaw)
    if tall_roof:
        for i in range(4):
            r = radius*1.21
            m.round((x,height+i*radius*.26,z),(x,height+(i+1)*radius*.30,z),r*(1-i*.24),r*(.75-i*.24),ROOF,sides)
        m.gem((x,height+radius*1.3,z),(.075,.10,.075),(GOLD,),8)
    else:
        for i in range(8):
            a = i*pi/4
            m.block((x+radius*.84*sin(a),height+.12,z+radius*.84*cos(a)),(radius*.49,.25,radius*.36),STONE[i%5],.04,a)


def castle():
    m = Mesh('Castle_Hall')
    slab(m,0,0,3.70,2.60)
    facade(m,2.62,2.12,1.53,stone=True)
    roof(m,2.89,2.38,1.69,.73)
    door(m,.14,1.08,.66,.91)
    for x in (-.84,.84):
        window(m,x,.97,1.115,.31)
    for x in (-1.39,1.39):
        turret(m,x,.61,.40,1.75)
    for x in (-1.05,1.05):
        turret(m,x,-.85,.44,2.10)
    m.block((0,1.99,-.45),(.73,1.19,.75),STONE[0],.06)
    for x in (-.35,.35):
        for z in (-.83,-.07):
            m.block((x,2.91,z),(.13,.70,.13),EDGE,.025)
    m.block((0,2.60,-.45),(.86,.15,.87),EDGE,.035)
    m.block((0,3.22,-.45),(.91,.13,.92),STONE[3],.036)
    m.round((-.04,2.80,-.15),(-.04,3.04,-.15),.194,.087,(GOLD,'#edc370','#d99a47'),12)
    m.round((-.04,3.02,-.15),(-.04,3.17,-.15),.034,.034,(OAK,),6)
    m.gem((-.04,2.76,-.15),(.055,.064,.055),('#b87c3c',),6)
    roof(m,1.08,1.04,3.29,.50,ROOF,-.45)
    m.round((0,3.76,-.45),(0,4.13,-.45),.023,.023,(DARK,),6)
    m.face([(0,4.11,-.45),(.41,4.06,-.45),(.27,3.97,-.45),(.39,3.92,-.45),(0,3.95,-.45)], '#db884c')
    m.face([(0,3.95,-.45),(.39,3.92,-.45),(.27,3.97,-.45),(.41,4.06,-.45),(0,4.11,-.45)], '#cb7944')
    return [m]


def mill():
    m = Mesh('Watermill_House')
    slab(m,0,0,2.01,1.77)
    facade(m,1.74,1.49,1.31)
    roof(m,2.01,1.78,1.52,.62)
    door(m,.15,.77,.49,.73)
    window(m,-.52,1.01,.78,.23)
    window(m,.52,1.01,.78,.23)
    window(m,-.89,.79,.24,.29,-pi/2)
    m.block((-.57,1.86,-.34),(.27,.68,.30),STONE[0],.04)
    m.block((-.57,2.19,-.34),(.33,.11,.35),STONE[2],.03)
    m.block((-.90,.43,0),(.19,.83,.36),DARK,.042)
    m.round((-.84,.92,0),(-1.34,.92,0),.085,.085,(DARK,OAK),10)
    return [m]


def wheel(pivot=(-1.16,.92,0)):
    m = Mesh('WaterWheel',pivot)
    x,y,z = pivot
    m.round((x-.22,y,z),(x+.22,y,z),.18,.18,(OAK,DARK),12)
    m.round((x-.22,y,z),(x-.255,y,z),.11,.11,(STONE[2],EDGE),10)
    seg = 16
    for i in range(seg):
        a,b = i*2*pi/seg,(i+1)*2*pi/seg
        for ix in (-.16,.16):
            p = lambda r,t: (x+ix,y+r*cos(t),z+r*sin(t))
            m.round(p(.79,a),p(.79,b),.063,.063,(OAK,'#ae794c'),4)
        if i%2 == 0:
            end = (x,y+.75*cos(a),z+.75*sin(a))
            m.round(pivot,end,.041,.045,(OAK,),6)
            m.round((x-.227,end[1],end[2]),(x+.227,end[1],end[2]),.048,.048,('#c08a56',OAK),6)
            inner = (x,y+.62*cos(a+.12),z+.62*sin(a+.12))
            outer = (x,y+.87*cos(a+.12),z+.87*sin(a+.12))
            m.round(inner,outer,.18,.19,('#a97243','#ba8651'),4,.23)
    return m


def wall():
    m = Mesh('Wall_Segment')
    slab(m,0,0,2,.57)
    m.block((0,.57,0),(1.99,.93,.43),STONE[2],.045)
    for row in range(3):
        for i in range(4):
            left = max(-.993,-.995+i*.603-(.29 if row%2 else 0))
            right = min(.993,-1+i*.603-(.29 if row%2 else 0)+.594)
            if right-left > .02:
                m.block(((left+right)/2,.27+row*.28,0),(right-left,.27,.46),STONE[(row+i*2)%5],.028)
    m.block((0,1.00,0),(2,.18,.54),EDGE,.035)
    for x in (-.71,0,.71):
        m.block((x,1.23,0),(.40,.35,.53),STONE[3],.040)
    return [m]


def gate():
    m=Mesh('Gatehouse')
    for x in (-1.21,1.21):
        slab(m,x,0,.76,.92)
        m.block((x,.89,0),(.67,1.56,.74),STONE[2],.08)
        for row in range(5):
            m.block((x,.25+row*.30,0),(.67,.289,.77),STONE[row],.042)
        for y in (1.77,2.05,2.30):
            m.block((x*1.10,y,0),(.44,.26,.67),STONE[3],.028)
    for i in range(9):
        a,b = i*pi/9+.012,(i+1)*pi/9-.012
        section = [(r*cos(t),1.08+r*sin(t)) for r,t in ((.91,a),(1.25,a),(1.25,b),(.91,b))]
        m.rings([[(x,y,z) for x,y in section] for z in (-.35,.39)],(EDGE,STONE[i%5]))
        p,q = [(1.22*cos(t),1.08+1.22*sin(t)) for t in (i*pi/9,(i+1)*pi/9)]
        section = [p, q, (q[0],2.36), (p[0],2.36)]
        m.rings([[(x,y,z) for x,y in section] for z in (-.31,.33)],(STONE[(i+2)%5],))
    m.block((0,2.37,0),(3.16,.16,.75),EDGE,.05)
    for x in (-1.32,-.66,0,.66,1.32):
        m.block((x,2.57,0),(.36,.32,.51),STONE[0],.048)
    for x in (-1.21,1.21):
        window(m,x,1.51,.39,.19)
    m.block((0,2.20,.44),(.29,.25,.09),'#4e7775',.025)
    m.gem((0,2.21,.496),(.072,.083,.023),(GOLD,),6)
    return [m]


def tower():
    m = Mesh('Watchtower')
    slab(m,0,0,1.56,1.56)
    turret(m,0,0,.64,2.14,False)
    door(m,.12,.62,.43,.69)
    for x in (-.42,.42):
        for z in (-.42,.42):
            m.block((x,2.46,z),(.105,.60,.105),OAK,.02)
    roof(m,1.23,1.24,2.73,.48,ROOF)
    return [m]


def bridge():
    m = Mesh('Timber_Bridge')
    def deck(z):
        return .105+.32*max(0,1-(z/1.66)**2)
    for i in range(17):
        z=(i-8)*.197
        m.block((0,deck(z),z),(1.56,.16,.187),('#b58153','#c28f5d','#a57347')[i%3],.025)
    for side in (-1,1):
        x=side*.71
        positions=(-1.48,-.75,0,.75,1.48)
        for z in positions:
            y=deck(z)
            m.block((x,y+.20,z),(.16,.67,.16),OAK,.034)
            m.block((x,y+.55,z),(.19,.115,.19),'#d3a268',.027)
            m.gem((x+side*.083,y+.29,z),(.024,.040,.040),(STONE[2],),6)
        for za,zb in zip(positions,positions[1:]):
            for y,r,col in ((.40,.060,'#a67449'),(.04,.088,DARK)):
                m.round((x,deck(za)+y,za),(x,deck(zb)+y,zb),r,r,(col,),4)
    return [m]


def animal(fox=False):
    fur = ('#bd663b','#cf7548','#dc8951') if fox else ('#63646a','#757784','#565963')
    light = ('#f3d7a8','#f7e3bf') if fox else ('#b6ada1','#cec2ad')
    ink = '#462e29' if fox else '#31323c'
    body=Mesh('Fox_Body' if fox else 'WolfKing_Body')
    multiplier=1 if fox else 1.15
    body.gem((0,.63,-.10),(.29*multiplier,.29,.59*multiplier),fur,10)
    body.gem((0,.67,.25),(.26*multiplier,.31,.35),fur,9)
    body.gem((0,.65,.41),(.205,.22,.22),light,9)
    if not fox:
        body.gem((0,.62,.62),(.060,.064,.028),(GOLD,'#c58342'),7)
        body.round((-.19,.74,.36),(0,.66,.60),.035,.030,('#963f3c',),6)
        body.round((.19,.74,.36),(0,.66,.60),.035,.030,('#963f3c',),6)
    head = Mesh('Head',(0,.94,.49))
    head.gem((0,.96,.52),(.34 if fox else .37,.25 if fox else .30,.28),fur,10)
    for side in (-1,1):
        x=side*.23
        head.gem((x,.89,.62),(.134,.145,.14),light,8)
        head.round((x,.99,.42),(x*1.48,1.42 if fox else 1.40,.45),.15,.015,fur,4,.76)
        head.round((x,1.06,.478),(x*1.44,1.375 if fox else 1.36,.481),.088,.012,('#b55f57' if fox else '#9b7676',),4,.50)
        head.gem((side*.176,.984,.736),(.060,.063,.042),(ink,),8)
        head.gem((side*.179,1.001,.772),(.025,.030,.010),('#efb051' if not fox else '#f3bf78',),7)
        head.gem((side*.170,1.011,.781),(.010,.011,.006),('#fff3d6',),6)
    head.gem((0,.87,.75),(.20,.12,.23),light,9)
    head.gem((0,.904,.954),(.075,.047,.043),(ink,),8)
    if not fox:
        head.round((0,1.19,.46),(0,1.25,.46),.196,.201,('#bd8144',GOLD),10,.85)
        for i in range(7):
            a = i*2*pi/7
            p=(.172*cos(a),1.23,.46+.154*sin(a))
            q=(.219*cos(a),1.37+.032*(i%2),.46+.188*sin(a))
            head.round(p,q,.051,.012,(GOLD,'#e1a64e'),4)
        head.gem((0,1.245,.623),(.048,.054,.028),('#58a6a0','#387775'),7)
    tail=Mesh('Tail',(0,.63,-.54))
    tail.round(tail.pivot,(.17,.77,-.85),.098,.18,fur,8)
    tail.round((.17,.77,-.85),(.32,.98,-1.12),.18,.13,fur,8)
    tail.round((.32,.98,-1.12),(.33,1.13,-1.34),.13,.014,light if fox else (ink,fur[0]),8)
    legs=[]
    for tag,z in (('Front',.28),('Rear',-.43)):
        for side,side_tag in ((-.19,'L'),(.19,'R')):
            leg = Mesh(f'{tag}Foot_{side_tag}',(side,.52,z))
            leg.round(leg.pivot,(side,.26,z-.044),.124,.084,fur,8)
            leg.round((side,.28,z-.044),(side,.09,z+.041),.082,.064,(fur[0],ink),7)
            leg.gem((side,.069,z+.08),(.096,.069,.125),(ink,),8)
            legs.append(leg)
    if fox:
        body.gem((-.27,.68,-.17),(.154,.172,.20),('#866149','#a67a54'),8)
        body.round((-.12,.89,-.16),(-.36,.78,-.13),.034,.031,(GOLD,),6)
    return [body,head,tail,*legs]


def rotation(axis, angle):
    return [sin(angle/2) if i == axis else 0 for i in range(3)]+[cos(angle/2)]


def model_specs():
    loop = (.0, .24, .48, .72, .96)
    moving = []
    for i in range(4):
        swing = (.35 if i in (0,3) else -.35)
        moving.append((i+3,loop,[rotation(0,a) for a in (0,swing,0,-swing,0)]))
    moving.extend([(1,loop,[rotation(0,a) for a in (0,-.07,0,-.07,0)]),
                   (2,loop,[rotation(1,a) for a in (0,.23,0,-.23,0)])])
    turn = (1,(0,1.5,3,4.5,6),[rotation(0,a) for a in (0,pi/2,pi,3*pi/2,2*pi)])
    return [
        ('watermill',mill()+[wheel()],{'WheelTurn':[turn]}),
        ('waterwheel',[wheel((0,0,0))],{'WheelTurn':[(0,turn[1],turn[2])]}),
        ('bridge',bridge(),{}),
        ('castle-hall',castle(),{}),
        ('wall-segment',wall(),{}),
        ('castle-gate',gate(),{}),
        ('watchtower',tower(),{}),
        ('wolf-king',animal(),{'Trot':moving}),
        ('thief-fox',animal(True),{'Trot':moving}),
    ]
